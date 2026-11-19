#!/usr/bin/env bun
import { PersistentGraphStore } from "../../core/src/graph/persistent-store";
import { IdentityResolver } from "../../core/src/identity/resolver";
import { GitHubWebhookProcessor } from "../../connectors/github/src/webhook";
import { GitHubBackfillCrawler } from "../../connectors/github/src/backfill";
import { LinearWebhookProcessor } from "../../connectors/linear/src/webhook";
import { SlackWebhookProcessor } from "../../connectors/slack/src/webhook";
import { PRReviewerBot } from "../../automation/blast-bot/src/reviewer-bot";
import { createWebhookGateway } from "../../gateway/src/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTeamGraphServer } from "../../mcp-server/src/server";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  const storePath = process.env.TEAMGRAPH_STORE || "./data/teamgraph.json";
  const store = new PersistentGraphStore(storePath);
  await store.init();

  const identity = new IdentityResolver(store);
  const github = new GitHubWebhookProcessor(store, identity);
  const linear = new LinearWebhookProcessor(store, identity);
  const slack = new SlackWebhookProcessor(store, identity);
  const backfill = new GitHubBackfillCrawler(store, identity);
  const bot = new PRReviewerBot(store);

  if (command === "serve") {
    const server = createTeamGraphServer(store);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  if (command === "gateway") {
    const portIndex = args.indexOf("--port");
    const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;

    const gateway = createWebhookGateway(store, github, linear, slack, {
      port,
      githubSecret: process.env.GITHUB_WEBHOOK_SECRET,
      linearSecret: process.env.LINEAR_WEBHOOK_SECRET,
    });

    console.log(`
🚀 Open TeamGraph Live Webhook Gateway
─────────────────────────────────────────────
Listening on: http://localhost:${port}
Healthcheck:  http://localhost:${port}/health
GitHub Hook:  http://localhost:${port}/webhooks/github
Linear Hook:  http://localhost:${port}/webhooks/linear
Slack Hook:   http://localhost:${port}/webhooks/slack
`);

    // @ts-ignore - Bun.serve available in Bun runtime
    if (typeof Bun !== "undefined" && Bun.serve) {
      Bun.serve({
        port,
        fetch: gateway.handleRequest,
      });
    }
    return;
  }

  if (command === "sync") {
    const repoIndex = args.indexOf("--repo");
    const repo = repoIndex !== -1 ? args[repoIndex + 1] : "local/repo";
    const daysIndex = args.indexOf("--days");
    const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1], 10) : 90;

    console.log(`⏳ Backfilling historical Git repository: ${repo} (last ${days} days)...`);
    const stats = await backfill.ingestLocalGitRepo({
      repoFullName: repo,
      daysLimit: days,
    });

    await store.flush();
    console.log(`✅ Ingested ${stats.commitsIngested} commits affecting ${stats.filesTouched} unique files.`);
    console.log(`💾 Knowledge graph persisted to ${storePath}.`);
    return;
  }

  if (command === "audit") {
    const filesIndex = args.indexOf("--files");
    const files = filesIndex !== -1 && args[filesIndex + 1]
      ? args[filesIndex + 1].split(",")
      : ["src/auth/jwt.ts"];

    const report = await bot.generateReport(files);
    console.log(report.markdownComment);
    return;
  }

  if (command === "demo") {
    console.log("🌱 Seeding realistic engineering teamwork graph (GitHub + Linear + Slack)...");
    const now = new Date().toISOString();

    // 1. Ingest Linear Issue
    await linear.processWebhook({
      action: "create",
      type: "Issue",
      data: {
        id: "lin-issue-104",
        identifier: "ENG-104",
        title: "Upgrade token verification and rotators",
        description: "Migrate auth service to rotate JWT secrets automatically",
        team: { id: "team-sec", name: "Security Guild", key: "SEC" },
        creator: { id: "u-sarah", name: "Sarah Chen", email: "sarah@acme.corp" },
        assignee: { id: "u-sarah", name: "Sarah Chen", email: "sarah@acme.corp" },
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        updatedAt: now,
      },
    });

    // 2. Ingest GitHub Push & Commits
    await github.processPush({
      repository: {
        name: "payments-core",
        full_name: "acme/payments-core",
        html_url: "https://github.com/acme/payments-core",
      },
      commits: [
        {
          id: "c101",
          message: "refactor(auth): upgrade token verification [ENG-104]",
          timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          author: { name: "Sarah Chen", email: "sarah@acme.corp", username: "sarah-c" },
          modified: ["src/auth/jwt.ts", "src/auth/keys.ts"],
        },
        {
          id: "c102",
          message: "fix(stripe): handle webhook idempotency key collisions",
          timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          author: { name: "Tariq Khan", email: "tariq@acme.corp", username: "tkhan" },
          modified: ["src/gateways/stripe.ts"],
        },
      ],
    });

    // 3. Ingest GitHub PR and Review
    await github.processPullRequest({
      action: "opened",
      pull_request: {
        id: 42,
        number: 42,
        title: "feat(ledger): double-entry audit engine",
        state: "open",
        created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        updated_at: now,
        user: { login: "sarah-c", id: 101 },
        head: { ref: "feature/ledger", sha: "c103" },
      },
      repository: { name: "payments-core", full_name: "acme/payments-core" },
    });

    await github.processReview({
      action: "submitted",
      review: {
        id: 901,
        state: "approved",
        submitted_at: now,
        user: { login: "tkhan", id: 22 },
      },
      pull_request: { id: 42, number: 42, title: "feat(ledger): double-entry audit engine" },
      repository: { full_name: "acme/payments-core" },
    });

    // 4. Ingest Slack Decision
    await slack.processEvent({
      event: {
        type: "message",
        text: "Team: regarding ENG-104, we are testing the new rotators against PR #42 in staging.",
        user: "U_TARIQ",
        ts: `${Math.floor(Date.now() / 1000)}.000200`,
        channel: "C_PAYMENTS",
      },
      type: "event_callback",
      event_id: "evt_1",
      event_time: Math.floor(Date.now() / 1000),
    });

    await store.flush();
    console.log("✅ Seeded nodes, edges, and persisted snapshot to disk.");

    // 5. Generate Autonomous PR Audit Comment
    console.log("\n🤖 Running Autonomous PR Blast Radius & Reviewer Bot for `src/auth/jwt.ts`:\n");
    const report = await bot.generateReport(["src/auth/jwt.ts"]);
    console.log(report.markdownComment);

    console.log("\n🚀 Open TeamGraph is fully operational and production-ready!");
    return;
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                      OPEN TEAMGRAPH CLI                       ║
║       Open-Source, Temporal & Agent-Native Teamwork Graph     ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  teamgraph gateway [--port 3000]     Start the live webhook receiver HTTP gateway
  teamgraph sync [--repo r --days d]  Backfill historical commits from local/remote git
  teamgraph serve                     Start Model Context Protocol (MCP) server
  teamgraph audit --files <f1,f2>      Generate PR impact analysis & reviewer markdown
  teamgraph demo                      Seed full multi-platform graph and run demonstration
  teamgraph help                      Display this guidance
`);
}

main().catch(console.error);
