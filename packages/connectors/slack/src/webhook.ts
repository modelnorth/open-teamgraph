import { IGraphStore } from "../../../core/src/graph/store";
import { IdentityResolver } from "../../../core/src/identity/resolver";

export interface SlackMessageEvent {
  client_msg_id?: string;
  type: "message";
  text: string;
  user: string; // Slack User ID (e.g. "U0123ABCD")
  ts: string;   // Epoch timestamp e.g. "1710892800.000100"
  channel: string;
  team?: string;
  thread_ts?: string;
}

export interface SlackEventPayload {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  event: SlackMessageEvent;
  type: "event_callback";
  event_id: string;
  event_time: number;
}

export class SlackWebhookProcessor {
  private store: IGraphStore;
  private identityResolver: IdentityResolver;

  constructor(store: IGraphStore, identityResolver: IdentityResolver) {
    this.store = store;
    this.identityResolver = identityResolver;
  }

  /**
   * Extracts referenced task keys (e.g., "ENG-104", "PAY-402") from text.
   */
  private extractTaskKeys(text: string): string[] {
    const regex = /\b([A-Z]{2,10}-\d+)\b/g;
    const matches = text.match(regex);
    return matches ? Array.from(new Set(matches.map(m => m.toLowerCase()))) : [];
  }

  /**
   * Extracts GitHub PR references (e.g., "#42" or "pull/42") from text.
   */
  private extractPrReferences(text: string): number[] {
    const prRegex = /(?:#|pull\/)(\d+)\b/g;
    const results: number[] = [];
    let match;
    while ((match = prRegex.exec(text)) !== null) {
      results.push(parseInt(match[1], 10));
    }
    return Array.from(new Set(results));
  }

  async processEvent(payload: SlackEventPayload): Promise<void> {
    const event = payload.event;
    if (event.type !== "message" || !event.text || !event.user) {
      return;
    }

    const messageDate = new Date(parseFloat(event.ts) * 1000).toISOString();
    const messageId = `urn:tg:message:slack:${event.channel}:${event.ts}`;
    const now = new Date().toISOString();

    // 1. Resolve Slack Author
    const author = await this.identityResolver.resolvePerson([
      { provider: "slack", identifier: event.user },
    ], `Slack User ${event.user}`);

    // 2. Add Message Node
    await this.store.addNode({
      id: messageId,
      type: "Message",
      name: event.text.slice(0, 80),
      properties: {
        text: event.text,
        channel: event.channel,
        slack_user: event.user,
        ts: event.ts,
        thread_ts: event.thread_ts,
      },
      valid_from: messageDate,
      created_at: now,
    });

    // 3. Edge: Author -AUTHORED-> Message
    await this.store.addEdge({
      id: `urn:tg:edge:AUTHORED:${author.id}->${messageId}`,
      type: "AUTHORED",
      source: author.id,
      target: messageId,
      confidence: 1.0,
      source_connector: "slack",
      properties: {},
      valid_from: messageDate,
      created_at: now,
    });

    // 4. Link Referenced Tasks (e.g. ENG-104)
    const taskKeys = this.extractTaskKeys(event.text);
    for (const key of taskKeys) {
      // Find matching Task nodes in graph
      const matches = await this.store.queryNodes(
        n => n.type === "Task" && (n.id.includes(`:${key}`) || n.name.toLowerCase().includes(`[${key}]`))
      );

      for (const taskNode of matches) {
        await this.store.addEdge({
          id: `urn:tg:edge:REFERENCES:${messageId}->${taskNode.id}`,
          type: "REFERENCES",
          source: messageId,
          target: taskNode.id,
          confidence: 0.95,
          source_connector: "slack",
          properties: { context: "inferred_mention" },
          valid_from: messageDate,
          created_at: now,
        });
      }
    }

    // 5. Link Referenced Pull Requests (e.g. #42)
    const prNumbers = this.extractPrReferences(event.text);
    for (const prNum of prNumbers) {
      const matches = await this.store.queryNodes(
        n => n.type === "PullRequest" && (n.properties?.number === prNum || n.id.endsWith(`:${prNum}`))
      );

      for (const prNode of matches) {
        await this.store.addEdge({
          id: `urn:tg:edge:REFERENCES:${messageId}->${prNode.id}`,
          type: "REFERENCES",
          source: messageId,
          target: prNode.id,
          confidence: 0.95,
          source_connector: "slack",
          properties: { context: "inferred_pr_reference" },
          valid_from: messageDate,
          created_at: now,
        });
      }
    }
  }
}
