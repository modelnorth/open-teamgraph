import { describe, it, expect, beforeEach } from "bun:test";
import * as crypto from "node:crypto";
import { InMemoryGraphStore } from "../packages/core/src/graph/memory-store";
import { IdentityResolver } from "../packages/core/src/identity/resolver";
import { GitHubWebhookProcessor } from "../packages/connectors/github/src/webhook";
import { LinearWebhookProcessor } from "../packages/connectors/linear/src/webhook";
import { SlackWebhookProcessor } from "../packages/connectors/slack/src/webhook";
import { GitHubBackfillCrawler } from "../packages/connectors/github/src/backfill";
import { createWebhookGateway, verifyHmacSignature } from "../packages/gateway/src/server";

describe("Live Webhook Gateway & Historical Backfill Suite", () => {
  let store: InMemoryGraphStore;
  let identity: IdentityResolver;
  let github: GitHubWebhookProcessor;
  let linear: LinearWebhookProcessor;
  let slack: SlackWebhookProcessor;
  let backfill: GitHubBackfillCrawler;

  beforeEach(() => {
    store = new InMemoryGraphStore();
    identity = new IdentityResolver(store);
    github = new GitHubWebhookProcessor(store, identity);
    linear = new LinearWebhookProcessor(store, identity);
    slack = new SlackWebhookProcessor(store, identity);
    backfill = new GitHubBackfillCrawler(store, identity);
  });

  describe("HMAC SHA256 Signature Verification", () => {
    const secret = "super_webhook_secret_123";
    const body = JSON.stringify({ hello: "world" });

    it("should accept valid sha256 signatures", () => {
      const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
      expect(verifyHmacSignature(secret, body, `sha256=${sig}`)).toBe(true);
      expect(verifyHmacSignature(secret, body, sig)).toBe(true);
    });

    it("should reject tampered bodies or invalid secrets", () => {
      const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
      expect(verifyHmacSignature("wrong_secret", body, `sha256=${sig}`)).toBe(false);
      expect(verifyHmacSignature(secret, body + "tampered", `sha256=${sig}`)).toBe(false);
      expect(verifyHmacSignature(secret, body, undefined)).toBe(false);
    });
  });

  describe("Webhook Gateway HTTP Router", () => {
    it("should respond to GET /health with live node and edge counts", async () => {
      const gateway = createWebhookGateway(store, github, linear, slack);
      const req = new Request("http://localhost:3000/health", { method: "GET" });
      const res = await gateway.handleRequest(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.graph_stats.total_nodes).toBe(0);
    });

    it("should handle Slack URL verification challenge", async () => {
      const gateway = createWebhookGateway(store, github, linear, slack);
      const challengeReq = new Request("http://localhost:3000/webhooks/slack", {
        method: "POST",
        body: JSON.stringify({ type: "url_verification", challenge: "random_token_42" }),
      });

      const res = await gateway.handleRequest(challengeReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.challenge).toBe("random_token_42");
    });

    it("should ingest GitHub push events received via HTTP", async () => {
      const gateway = createWebhookGateway(store, github, linear, slack);
      const payload = {
        repository: { name: "infra", full_name: "acme/infra", html_url: "" },
        commits: [
          {
            id: "sha-http-1",
            message: "feat: add terraform state lock",
            timestamp: new Date().toISOString(),
            author: { name: "DevOps Lead", email: "devops@acme.corp" },
            modified: ["terraform/main.tf"],
          },
        ],
      };

      const req = new Request("http://localhost:3000/webhooks/github", {
        method: "POST",
        headers: { "x-github-event": "push" },
        body: JSON.stringify(payload),
      });

      const res = await gateway.handleRequest(req);
      expect(res.status).toBe(200);

      const commit = await store.getNode("urn:tg:commit:sha-http-1");
      expect(commit).toBeDefined();
      expect(commit?.name).toBe("feat: add terraform state lock");
    });
  });

  describe("Historical Git Backfill Crawler", () => {
    it("should backfill commits and modified files from the local git log", async () => {
      const stats = await backfill.ingestLocalGitRepo({
        repoFullName: "local/antigravity",
        daysLimit: 30,
      });

      expect(stats.commitsIngested).toBeGreaterThan(0);
      expect(stats.filesTouched).toBeGreaterThan(0);

      const allNodes = await store.getAllNodes();
      expect(allNodes.length).toBeGreaterThan(0);
      const commits = allNodes.filter(n => n.type === "Commit");
      expect(commits.length).toBe(stats.commitsIngested);
    });
  });
});
