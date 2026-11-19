import { describe, it, expect, beforeEach } from "bun:test";
import { InMemoryGraphStore } from "../packages/core/src/graph/memory-store.js";
import { IdentityResolver } from "../packages/core/src/identity/resolver.js";
import { GitHubWebhookProcessor } from "../packages/connectors/github/src/webhook.js";
import { ExpertFinder } from "../packages/core/src/algorithms/expert-finder.js";
import { BlastRadiusAnalyzer } from "../packages/core/src/algorithms/blast-radius.js";

describe("Open TeamGraph Core Engine", () => {
  let store: InMemoryGraphStore;
  let identity: IdentityResolver;
  let github: GitHubWebhookProcessor;

  beforeEach(() => {
    store = new InMemoryGraphStore();
    identity = new IdentityResolver(store);
    github = new GitHubWebhookProcessor(store, identity);
  });

  describe("Identity Resolution", () => {
    it("should resolve and merge identities from different providers into a single canonical Person", async () => {
      // 1. First event: commit with email
      const person1 = await identity.resolvePerson([
        { provider: "email", identifier: "alex@example.corp", name: "Alex" },
      ]);
      expect(person1.type).toBe("Person");
      expect(person1.id).toBe("urn:tg:person:alex_example_corp");

      // 2. Second event: GitHub event with handle and same email
      const person2 = await identity.resolvePerson([
        { provider: "github", identifier: "alex-dev" },
        { provider: "email", identifier: "alex@example.corp" },
      ], "Alexander Dev");

      // Both should resolve to the exact same canonical ID
      expect(person2.id).toBe(person1.id);
      expect(person2.properties.identities.length).toBe(2);

      // Lookup by github handle should now yield the same person
      const lookedUp = await identity.getPersonByIdentifier("github", "alex-dev");
      expect(lookedUp).toBeDefined();
      expect(lookedUp?.id).toBe(person1.id);
    });
  });

  describe("GitHub Ingestion Pipeline", () => {
    it("should ingest push webhooks creating Repository, Commit, File, and Edge relations", async () => {
      await github.processPush({
        repository: {
          name: "web-portal",
          full_name: "acme/web-portal",
          html_url: "https://github.com/acme/web-portal",
        },
        commits: [
          {
            id: "sha-001",
            message: "feat: add oauth session store",
            timestamp: new Date().toISOString(),
            author: { name: "Fatima Noor", email: "fatima@acme.corp", username: "fatima-n" },
            modified: ["src/auth/session.ts"],
          },
        ],
      });

      const repo = await store.getNode("urn:tg:repo:acme/web-portal");
      expect(repo).toBeDefined();
      expect(repo?.name).toBe("web-portal");

      const commit = await store.getNode("urn:tg:commit:sha-001");
      expect(commit).toBeDefined();
      expect(commit?.type).toBe("Commit");

      const file = await store.getNode("urn:tg:file:acme/web-portal:src/auth/session.ts");
      expect(file).toBeDefined();
      expect(file?.type).toBe("File");

      // Check authoring edge
      const authorNeighbors = await store.getNeighbors(commit!.id, {
        direction: "in",
        edgeTypes: ["AUTHORED"],
      });
      expect(authorNeighbors.length).toBe(1);
      expect(authorNeighbors[0].node.type).toBe("Person");
      expect(authorNeighbors[0].node.name).toBe("Fatima Noor");
    });
  });

  describe("Expert Discovery Algorithm ('who_knows')", () => {
    it("should rank authors and reviewers with recency decay weighting", async () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - 1 * 24 * 3600 * 1000).toISOString();
      const hundredDaysAgo = new Date(now - 100 * 24 * 3600 * 1000).toISOString();

      // Old commit by Alice
      await github.processPush({
        repository: { name: "core-api", full_name: "acme/core-api", html_url: "" },
        commits: [
          {
            id: "commit-old",
            message: "initial auth module",
            timestamp: hundredDaysAgo,
            author: { name: "Alice", email: "alice@acme.corp", username: "alice" },
            modified: ["src/security/crypto.ts"],
          },
        ],
      });

      // Recent commit by Bob
      await github.processPush({
        repository: { name: "core-api", full_name: "acme/core-api", html_url: "" },
        commits: [
          {
            id: "commit-recent",
            message: "update cipher suites",
            timestamp: oneDayAgo,
            author: { name: "Bob", email: "bob@acme.corp", username: "bob" },
            modified: ["src/security/crypto.ts"],
          },
        ],
      });

      const finder = new ExpertFinder(store);
      const experts = await finder.findExperts("urn:tg:file:acme/core-api:src/security/crypto.ts");

      expect(experts.length).toBe(2);
      // Bob made the recent commit, so Bob's recency score should be higher than Alice's decayed score
      expect(experts[0].person.name).toBe("Bob");
      expect(experts[1].person.name).toBe("Alice");
      expect(experts[0].score).toBeGreaterThan(experts[1].score);
    });
  });

  describe("Blast Radius Dependency Traversal", () => {
    it("should traverse services, files, and teams affected by a component", async () => {
      const now = new Date().toISOString();

      // Seed service, team, and dependent files
      await store.addNode({
        id: "urn:tg:service:auth-service",
        type: "Service",
        name: "Auth Service",
        properties: {},
        valid_from: now,
        created_at: now,
      });

      await store.addNode({
        id: "urn:tg:team:security-guild",
        type: "Team",
        name: "Security Guild",
        properties: {},
        valid_from: now,
        created_at: now,
      });

      await store.addNode({
        id: "urn:tg:service:checkout-api",
        type: "Service",
        name: "Checkout API",
        properties: {},
        valid_from: now,
        created_at: now,
      });

      // Edges: Security Guild OWNS Auth Service
      await store.addEdge({
        id: "edge-1",
        type: "OWNS",
        source: "urn:tg:team:security-guild",
        target: "urn:tg:service:auth-service",
        confidence: 1.0,
        source_connector: "manual",
        properties: {},
        valid_from: now,
        created_at: now,
      });

      // Edge: Checkout API DEPENDS_ON Auth Service
      await store.addEdge({
        id: "edge-2",
        type: "DEPENDS_ON",
        source: "urn:tg:service:checkout-api",
        target: "urn:tg:service:auth-service",
        confidence: 1.0,
        source_connector: "manual",
        properties: {},
        valid_from: now,
        created_at: now,
      });

      const analyzer = new BlastRadiusAnalyzer(store);
      const blast = await analyzer.analyze("urn:tg:service:auth-service", 2);

      expect(blast).toBeDefined();
      expect(blast?.affectedServices.some(s => s.name === "Checkout API")).toBe(true);
      expect(blast?.owningTeams.some(t => t.name === "Security Guild")).toBe(true);
    });
  });

  describe("Temporal Diffing Engine", () => {
    it("should accurately capture entities added between time boundaries", async () => {
      const t0 = new Date("2026-01-01T00:00:00Z").toISOString();
      const t1 = new Date("2026-06-01T00:00:00Z").toISOString();
      const t2 = new Date("2026-12-01T00:00:00Z").toISOString();

      await store.addNode({
        id: "node-early",
        type: "Task",
        name: "Q1 Goal",
        properties: {},
        valid_from: t0,
        created_at: t0,
      });

      await store.addNode({
        id: "node-later",
        type: "Task",
        name: "Q4 Goal",
        properties: {},
        valid_from: t2,
        created_at: t2,
      });

      const diff = await store.diff(t1, t2);
      expect(diff.addedNodes.some(n => n.id === "node-later")).toBe(true);
      expect(diff.addedNodes.some(n => n.id === "node-early")).toBe(false);
    });
  });
});
