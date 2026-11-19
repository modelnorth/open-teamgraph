import { spawnSync } from "node:child_process";
import { IGraphStore } from "../../../core/src/graph/store";
import { IdentityResolver } from "../../../core/src/identity/resolver";
import { GitHubWebhookProcessor } from "./webhook";

export interface BackfillOptions {
  repoPath?: string;
  repoFullName: string;
  daysLimit?: number;
}

export class GitHubBackfillCrawler {
  private store: IGraphStore;
  private identityResolver: IdentityResolver;
  private webhookProcessor: GitHubWebhookProcessor;

  constructor(store: IGraphStore, identityResolver: IdentityResolver) {
    this.store = store;
    this.identityResolver = identityResolver;
    this.webhookProcessor = new GitHubWebhookProcessor(store, identityResolver);
  }

  /**
   * Fast, zero-token local git log ingestion.
   * Directly extracts commits, authors, and touched files from the local git working tree.
   */
  async ingestLocalGitRepo(options: BackfillOptions): Promise<{ commitsIngested: number; filesTouched: number }> {
    const cwd = options.repoPath || process.cwd();
    const days = options.daysLimit || 90;
    const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().split("T")[0];

    // Format: COMMIT_START%n%H%n%an%n%ae%n%aI%n%s
    const gitLog = spawnSync(
      "git",
      ["log", `--since=${sinceDate}`, "--name-only", "--pretty=format:COMMIT_MARKER%n%H%n%an%n%ae%n%aI%n%s"],
      { cwd, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );

    if (gitLog.error || gitLog.status !== 0) {
      throw new Error(`Failed to read git log: ${gitLog.stderr || gitLog.error?.message}`);
    }

    const output = gitLog.stdout;
    const rawChunks = output.split("COMMIT_MARKER\n").filter(Boolean);

    const commits: Array<{
      id: string;
      message: string;
      timestamp: string;
      author: { name: string; email: string };
      modified: string[];
    }> = [];

    const uniqueFiles = new Set<string>();

    for (const chunk of rawChunks) {
      const lines = chunk.trim().split("\n");
      if (lines.length < 5) continue;

      const sha = lines[0].trim();
      const authorName = lines[1].trim();
      const authorEmail = lines[2].trim();
      const timestamp = lines[3].trim();
      const subject = lines[4].trim();

      const files = lines.slice(5).map(f => f.trim()).filter(Boolean);
      files.forEach(f => uniqueFiles.add(f));

      commits.push({
        id: sha,
        message: subject,
        timestamp,
        author: { name: authorName, email: authorEmail },
        modified: files,
      });
    }

    // Process in batches through the webhook processor
    await this.webhookProcessor.processPush({
      repository: {
        name: options.repoFullName.split("/").pop() || "local-repo",
        full_name: options.repoFullName,
        html_url: `https://github.com/${options.repoFullName}`,
      },
      commits,
    });

    return {
      commitsIngested: commits.length,
      filesTouched: uniqueFiles.size,
    };
  }
}
