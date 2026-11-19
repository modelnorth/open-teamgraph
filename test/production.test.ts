import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "fs";
import * as path from "path";
import { PersistentGraphStore } from "../packages/core/src/graph/persistent-store";
import { IdentityResolver } from "../packages/core/src/identity/resolver";
import { GitHubWebhookProcessor } from "../packages/connectors/github/src/webhook";
import { LinearWebhookProcessor } from "../packages/connectors/linear/src/webhook";
import { SlackWebhookProcessor } from "../packages/connectors/slack/src/webhook";
import { PRReviewerBot } from "../packages/automation/blast-bot/src/reviewer-bot";

describe("Open TeamGraph Production Suite", () => {
  const testDbPath = path.resolve("./data/test-teamgraph.json");
  let store: PersistentGraphStore;
  let identity: IdentityResolver;
  let github: GitHubWebhookProcessor;
  let linear: LinearWebhookProcessor;
  let slack: SlackWebhookProcessor;
  let bot: PRReviewerBot;

  beforeEach(async () => {
    try {
      await fs.unlink(testDbPath);
    } catch {}

    store = new PersistentGraphStore(testDbPath);
    await store.init();

    identity = new IdentityResolver(store);
    github = new GitHubWebhookProcessor(store, identity);
    linear = new LinearWebhookProcessor(store, identity);
    slack = new SlackWebhookProcessor(store, identity);
    bot = new PRReviewerBot(store);
  });

  afterEach(async () => {
    try {
      await fs.unlink(testDbPath);
    } catch {}
  });

  describe("Linear Ingestion & Task Modeling", () => {
    it("should ingest Linear issue with creator, assignee, and team links", async () => {
      await linear.processWebhook({
        action: "create",
        type: "Issue",
        data: {
          id: "issue-999",
          identifier: "PAY-100",
          title: "Implement 3D Secure 2.0 flow",
          description: "Required for European card compliance",
          team: { id: "t-payments", name: "Payments Core", key: "PAY" },
          creator: { id: "u-tariq", name: "Tariq", email: "tariq@acme.corp" },
          assignee: { id: "u-sarah", name: "Sarah Chen", email: "sarah@acme.corp" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      const task = await store.getNode("urn:tg:task:linear:pay-100");
      expect(task).toBeDefined();
      expect(task?.name).toBe("[PAY-100] Implement 3D Secure 2.0 flow");

      const team = await store.getNode("urn:tg:team:pay");
      expect(team).toBeDefined();
      expect(team?.name).toBe("Payments Core");

      // Verify creator authored task
      const authorNeighbors = await store.getNeighbors(task!.id, {
        direction: "in",
        edgeTypes: ["AUTHORED"],
      });
      expect(authorNeighbors.length).toBe(1);
      expect(authorNeighbors[0].node.name).toBe("Tariq");
    });
  });

  describe("Slack Decision Extraction & Graph Linking", () => {
    it("should extract task keys and PR references from Slack text and link edges", async () => {
      // 1. Seed Task
      await store.addNode({
        id: "urn:tg:task:linear:pay-100",
        type: "Task",
        name: "[PAY-100] Implement 3D Secure 2.0 flow",
        properties: {},
        valid_from: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      // 2. Seed PR
      await store.addNode({
        id: "urn:tg:pr:acme/payments:42",
        type: "PullRequest",
        name: "3DS Auth implementation",
        properties: { number: 42 },
        valid_from: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      // 3. Ingest Slack Message mentioning PAY-100 and PR #42
      await slack.processEvent({
        event: {
          type: "message",
          text: "Heads up: for PAY-100, we verified the SCA challenge in PR #42 today.",
          user: "U_LEAD",
          ts: "1710000000.001000",
          channel: "C_DEV",
        },
        type: "event_callback",
        event_id: "evt_test",
        event_time: 1710000000,
      });

      const messageNode = await store.getNode("urn:tg:message:slack:C_DEV:1710000000.001000");
      expect(messageNode).toBeDefined();

      // Check REFERENCES edge to Task
      const references = await store.getNeighbors(messageNode!.id, {
        direction: "out",
        edgeTypes: ["REFERENCES"],
      });

      expect(references.length).toBe(2);
      const targetTypes = references.map(r => r.node.type);
      expect(targetTypes).toContain("Task");
      expect(targetTypes).toContain("PullRequest");
    });
  });

  describe("Durable Disk Persistence Across Restarts", () => {
    it("should survive process restart by reloading nodes and edges from disk", async () => {
      // Add node and edge to store
      const now = new Date().toISOString();
      await store.addNode({
        id: "urn:tg:service:auth-gateway",
        type: "Service",
        name: "Auth Gateway",
        properties: { tier: "critical" },
        valid_from: now,
        created_at: now,
      });

      await store.flush();

      // Instantiate completely fresh store pointing to the same file
      const newStore = new PersistentGraphStore(testDbPath);
      await newStore.init();

      const restored = await newStore.getNode("urn:tg:service:auth-gateway");
      expect(restored).toBeDefined();
      expect(restored?.name).toBe("Auth Gateway");
      expect(restored?.properties.tier).toBe("critical");
    });
  });

  describe("Autonomous PR Reviewer Bot", () => {
    it("should produce a complete markdown review comment for modified files", async () => {
      // Seed file and commit
      await github.processPush({
        repository: { name: "billing", full_name: "acme/billing", html_url: "" },
        commits: [
          {
            id: "commit-1",
            message: "update tax engine",
            timestamp: new Date().toISOString(),
            author: { name: "Zainab", email: "zainab@acme.corp", username: "zainab" },
            modified: ["src/tax/rates.ts"],
          },
        ],
      });

      const report = await bot.generateReport(["src/tax/rates.ts"]);
      expect(report.recommendedReviewers.length).toBe(1);
      expect(report.recommendedReviewers[0].person.name).toBe("Zainab");
      expect(report.markdownComment).toContain("Autonomous PR Review");
      expect(report.markdownComment).toContain("Zainab");
    });
  });
});
