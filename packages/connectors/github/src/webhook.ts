import { IGraphStore } from "../../../core/src/graph/store";
import { IdentityResolver, IdentityLink } from "../../../core/src/identity/resolver";

export interface GitHubPushPayload {
  repository: {
    name: string;
    full_name: string;
    html_url: string;
  };
  sender?: {
    login: string;
    id: number;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>;
}

export interface GitHubPullRequestPayload {
  action: "opened" | "closed" | "reopened" | "synchronize";
  pull_request: {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: "open" | "closed";
    created_at: string;
    updated_at: string;
    merged_at?: string;
    user: {
      login: string;
      id: number;
      email?: string;
    };
    head: {
      ref: string;
      sha: string;
    };
  };
  repository: {
    name: string;
    full_name: string;
  };
}

export interface GitHubReviewPayload {
  action: "submitted" | "edited" | "dismissed";
  review: {
    id: number;
    state: "approved" | "changes_requested" | "commented";
    submitted_at: string;
    user: {
      login: string;
      id: number;
    };
  };
  pull_request: {
    id: number;
    number: number;
    title: string;
  };
  repository: {
    full_name: string;
  };
}

export class GitHubWebhookProcessor {
  private store: IGraphStore;
  private identityResolver: IdentityResolver;

  constructor(store: IGraphStore, identityResolver: IdentityResolver) {
    this.store = store;
    this.identityResolver = identityResolver;
  }

  async processPush(payload: GitHubPushPayload): Promise<void> {
    const repoId = `urn:tg:repo:${payload.repository.full_name}`;
    const now = new Date().toISOString();

    // 1. Ensure Repository Node
    await this.store.addNode({
      id: repoId,
      type: "Repository",
      name: payload.repository.name,
      properties: {
        full_name: payload.repository.full_name,
        url: payload.repository.html_url,
      },
      valid_from: now,
      created_at: now,
    });

    // 2. Process Commits
    for (const commit of payload.commits) {
      const commitId = `urn:tg:commit:${commit.id}`;
      const commitDate = commit.timestamp || now;

      // Resolve author
      const identityLinks: IdentityLink[] = [
        { provider: "email", identifier: commit.author.email, name: commit.author.name },
      ];
      if (commit.author.username) {
        identityLinks.push({ provider: "github", identifier: commit.author.username, name: commit.author.name });
      }

      const author = await this.identityResolver.resolvePerson(identityLinks, commit.author.name);

      // Add Commit Node
      await this.store.addNode({
        id: commitId,
        type: "Commit",
        name: commit.message.split("\n")[0].slice(0, 80),
        properties: {
          sha: commit.id,
          message: commit.message,
          author_email: commit.author.email,
        },
        valid_from: commitDate,
        created_at: now,
      });

      // Edge: Person -AUTHORED-> Commit
      await this.store.addEdge({
        id: `urn:tg:edge:AUTHORED:${author.id}->${commitId}`,
        type: "AUTHORED",
        source: author.id,
        target: commitId,
        confidence: 1.0,
        source_connector: "github",
        properties: {},
        valid_from: commitDate,
        created_at: now,
      });

      // Edge: Commit -PART_OF-> Repository
      await this.store.addEdge({
        id: `urn:tg:edge:PART_OF:${commitId}->${repoId}`,
        type: "PART_OF",
        source: commitId,
        target: repoId,
        confidence: 1.0,
        source_connector: "github",
        properties: {},
        valid_from: commitDate,
        created_at: now,
      });

      // Modified/Added Files
      const files = [...(commit.added || []), ...(commit.modified || [])];
      for (const filepath of files) {
        const fileId = `urn:tg:file:${payload.repository.full_name}:${filepath}`;

        // Ensure File Node
        await this.store.addNode({
          id: fileId,
          type: "File",
          name: filepath,
          properties: {
            path: filepath,
            repository: payload.repository.full_name,
          },
          valid_from: commitDate,
          created_at: now,
        });

        // Edge: Commit -MODIFIES-> File
        await this.store.addEdge({
          id: `urn:tg:edge:MODIFIES:${commitId}->${fileId}`,
          type: "MODIFIES",
          source: commitId,
          target: fileId,
          confidence: 1.0,
          source_connector: "github",
          properties: {},
          valid_from: commitDate,
          created_at: now,
        });
      }
    }
  }

  async processPullRequest(payload: GitHubPullRequestPayload): Promise<void> {
    const repoId = `urn:tg:repo:${payload.repository.full_name}`;
    const prId = `urn:tg:pr:${payload.repository.full_name}:${payload.pull_request.number}`;
    const now = new Date().toISOString();
    const prDate = payload.pull_request.created_at || now;

    // Resolve PR Author
    const authorLinks: IdentityLink[] = [
      { provider: "github", identifier: payload.pull_request.user.login },
    ];
    if (payload.pull_request.user.email) {
      authorLinks.push({ provider: "email", identifier: payload.pull_request.user.email });
    }
    const author = await this.identityResolver.resolvePerson(authorLinks, payload.pull_request.user.login);

    // Add PullRequest Node
    await this.store.addNode({
      id: prId,
      type: "PullRequest",
      name: payload.pull_request.title,
      properties: {
        number: payload.pull_request.number,
        title: payload.pull_request.title,
        state: payload.pull_request.state,
        branch: payload.pull_request.head.ref,
        merged_at: payload.pull_request.merged_at,
      },
      valid_from: prDate,
      created_at: now,
    });

    // Edge: Author -AUTHORED-> PR
    await this.store.addEdge({
      id: `urn:tg:edge:AUTHORED:${author.id}->${prId}`,
      type: "AUTHORED",
      source: author.id,
      target: prId,
      confidence: 1.0,
      source_connector: "github",
      properties: {},
      valid_from: prDate,
      created_at: now,
    });

    // Edge: PR -PART_OF-> Repository
    await this.store.addEdge({
      id: `urn:tg:edge:PART_OF:${prId}->${repoId}`,
      type: "PART_OF",
      source: prId,
      target: repoId,
      confidence: 1.0,
      source_connector: "github",
      properties: {},
      valid_from: prDate,
      created_at: now,
    });
  }

  async processReview(payload: GitHubReviewPayload): Promise<void> {
    const prId = `urn:tg:pr:${payload.repository.full_name}:${payload.pull_request.number}`;
    const reviewer = await this.identityResolver.resolvePerson([
      { provider: "github", identifier: payload.review.user.login },
    ], payload.review.user.login);

    const reviewDate = payload.review.submitted_at || new Date().toISOString();
    const edgeId = `urn:tg:edge:REVIEWED:${reviewer.id}->${prId}:${payload.review.id}`;

    // Edge: Reviewer -REVIEWED-> PR
    await this.store.addEdge({
      id: edgeId,
      type: "REVIEWED",
      source: reviewer.id,
      target: prId,
      confidence: 1.0,
      source_connector: "github",
      properties: {
        state: payload.review.state,
        review_id: payload.review.id,
      },
      valid_from: reviewDate,
      created_at: new Date().toISOString(),
    });
  }
}
