import { IGraphStore } from "../../../core/src/graph/store";
import { IdentityResolver, IdentityLink } from "../../../core/src/identity/resolver";

export interface LinearIssueData {
  id: string;
  identifier: string; // e.g. "ENG-104"
  title: string;
  description?: string;
  priority?: number;
  state?: {
    name: string;
    type: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
    key: string;
  };
  project?: {
    id: string;
    name: string;
  };
  parent?: {
    id: string;
    identifier: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LinearWebhookPayload {
  action: "create" | "update" | "remove";
  type: "Issue" | "Comment" | "Project";
  data: LinearIssueData;
  url?: string;
}

export class LinearWebhookProcessor {
  private store: IGraphStore;
  private identityResolver: IdentityResolver;

  constructor(store: IGraphStore, identityResolver: IdentityResolver) {
    this.store = store;
    this.identityResolver = identityResolver;
  }

  async processWebhook(payload: LinearWebhookPayload): Promise<void> {
    if (payload.type === "Issue") {
      await this.processIssue(payload.data, payload.action);
    }
  }

  private async processIssue(issue: LinearIssueData, action: string): Promise<void> {
    const taskId = `urn:tg:task:linear:${issue.identifier.toLowerCase()}`;
    const now = new Date().toISOString();
    const taskDate = issue.createdAt || now;

    // 1. Ensure Team Node if present
    let teamId: string | undefined;
    if (issue.team) {
      teamId = `urn:tg:team:${issue.team.key.toLowerCase()}`;
      await this.store.addNode({
        id: teamId,
        type: "Team",
        name: issue.team.name,
        properties: {
          key: issue.team.key,
          linear_id: issue.team.id,
        },
        valid_from: taskDate,
        created_at: now,
      });
    }

    // 2. Resolve Creator Person
    let creatorNode;
    if (issue.creator) {
      const creatorLinks: IdentityLink[] = [
        { provider: "email", identifier: issue.creator.email, name: issue.creator.name },
        { provider: "linear", identifier: issue.creator.id, name: issue.creator.name },
      ];
      creatorNode = await this.identityResolver.resolvePerson(creatorLinks, issue.creator.name);
    }

    // 3. Resolve Assignee Person
    let assigneeNode;
    if (issue.assignee) {
      const assigneeLinks: IdentityLink[] = [
        { provider: "email", identifier: issue.assignee.email, name: issue.assignee.name },
        { provider: "linear", identifier: issue.assignee.id, name: issue.assignee.name },
      ];
      assigneeNode = await this.identityResolver.resolvePerson(assigneeLinks, issue.assignee.name);
    }

    // 4. Create/Update Task Node
    await this.store.addNode({
      id: taskId,
      type: "Task",
      name: `[${issue.identifier}] ${issue.title}`,
      properties: {
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || "",
        state: issue.state?.name || "Open",
        priority: issue.priority,
        linear_id: issue.id,
      },
      valid_from: taskDate,
      created_at: now,
    });

    // 5. Edge: Creator -AUTHORED-> Task
    if (creatorNode) {
      await this.store.addEdge({
        id: `urn:tg:edge:AUTHORED:${creatorNode.id}->${taskId}`,
        type: "AUTHORED",
        source: creatorNode.id,
        target: taskId,
        confidence: 1.0,
        source_connector: "linear",
        properties: {},
        valid_from: taskDate,
        created_at: now,
      });
    }

    // 6. Edge: Assignee -WORKED_ON-> Task
    if (assigneeNode) {
      await this.store.addEdge({
        id: `urn:tg:edge:WORKED_ON:${assigneeNode.id}->${taskId}`,
        type: "WORKED_ON",
        source: assigneeNode.id,
        target: taskId,
        confidence: 1.0,
        source_connector: "linear",
        properties: { state: issue.state?.name },
        valid_from: issue.updatedAt || now,
        created_at: now,
      });
    }

    // 7. Edge: Task -PART_OF-> Team
    if (teamId) {
      await this.store.addEdge({
        id: `urn:tg:edge:PART_OF:${taskId}->${teamId}`,
        type: "PART_OF",
        source: taskId,
        target: teamId,
        confidence: 1.0,
        source_connector: "linear",
        properties: {},
        valid_from: taskDate,
        created_at: now,
      });
    }

    // 8. If parent issue is set: Task -PART_OF-> Parent Task
    if (issue.parent) {
      const parentTaskId = `urn:tg:task:linear:${issue.parent.identifier.toLowerCase()}`;
      await this.store.addEdge({
        id: `urn:tg:edge:PART_OF:${taskId}->${parentTaskId}`,
        type: "PART_OF",
        source: taskId,
        target: parentTaskId,
        confidence: 1.0,
        source_connector: "linear",
        properties: {},
        valid_from: taskDate,
        created_at: now,
      });
    }
  }
}
