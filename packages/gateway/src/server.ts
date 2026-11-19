import * as crypto from "node:crypto";
import { IGraphStore } from "../../core/src/graph/store";
import { GitHubWebhookProcessor } from "../../connectors/github/src/webhook";
import { LinearWebhookProcessor } from "../../connectors/linear/src/webhook";
import { SlackWebhookProcessor } from "../../connectors/slack/src/webhook";
import { PRReviewerBot } from "../../automation/blast-bot/src/reviewer-bot";
import { getExplorerHtml } from "./ui";

export interface GatewayConfig {
  port?: number;
  githubSecret?: string;
  linearSecret?: string;
  slackSecret?: string;
}

export function verifyHmacSignature(secret: string, rawBody: string, signatureHeader?: string): boolean {
  if (!signatureHeader) return false;
  try {
    const cleanedSignature = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice(7)
      : signatureHeader;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf-8")
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(cleanedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

export function createWebhookGateway(
  store: IGraphStore,
  githubProcessor: GitHubWebhookProcessor,
  linearProcessor: LinearWebhookProcessor,
  slackProcessor: SlackWebhookProcessor,
  config: GatewayConfig = {}
) {
  const startTime = Date.now();
  const bot = new PRReviewerBot(store);

  return {
    async handleRequest(req: Request): Promise<Response> {
      const url = new URL(req.url);

      // 1. Web Graph Explorer UI
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(getExplorerHtml(), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // 2. Graph Data API (for visualization)
      if (req.method === "GET" && url.pathname === "/api/graph") {
        const nodes = await store.getAllNodes();
        const edges = await store.getAllEdges();
        return new Response(
          JSON.stringify({ nodes, edges }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 3. PR Audit & Impact API
      if (req.method === "GET" && url.pathname === "/api/audit") {
        const file = url.searchParams.get("file") || "src/auth/jwt.ts";
        const report = await bot.generateReport([file]);
        return new Response(
          JSON.stringify({
            targetFile: file,
            reviewers: report.recommendedReviewers,
            affectedServices: report.affectedServices,
            affectedTeams: report.affectedTeams,
            relatedTasks: report.relatedTasks,
            markdown: report.markdownComment,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 4. Seed Demo Data API
      if (req.method === "POST" && url.pathname === "/api/demo/seed") {
        const now = new Date().toISOString();

        // Ingest Linear Task
        await linearProcessor.processWebhook({
          action: "create",
          type: "Issue",
          data: {
            id: "issue-104",
            identifier: "ENG-104",
            title: "Upgrade token verification and rotators",
            description: "Automated JWT secret rotation",
            team: { id: "t-sec", name: "Security Guild", key: "SEC" },
            creator: { id: "u-sarah", name: "Sarah Chen", email: "sarah@acme.corp" },
            assignee: { id: "u-sarah", name: "Sarah Chen", email: "sarah@acme.corp" },
            createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
            updatedAt: now,
          },
        });

        // Ingest GitHub Commits
        await githubProcessor.processPush({
          repository: {
            name: "payments-core",
            full_name: "acme/payments-core",
            html_url: "https://github.com/acme/payments-core",
          },
          commits: [
            {
              id: "sha-c101",
              message: "refactor(auth): upgrade token verification [ENG-104]",
              timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
              author: { name: "Sarah Chen", email: "sarah@acme.corp", username: "sarah-c" },
              modified: ["src/auth/jwt.ts", "src/auth/keys.ts"],
            },
            {
              id: "sha-c102",
              message: "fix(stripe): handle webhook idempotency key collisions",
              timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
              author: { name: "Tariq Khan", email: "tariq@acme.corp", username: "tkhan" },
              modified: ["src/gateways/stripe.ts"],
            },
          ],
        });

        // Ingest PR & Review
        await githubProcessor.processPullRequest({
          action: "opened",
          pull_request: {
            id: 42,
            number: 42,
            title: "feat(ledger): double-entry audit engine",
            state: "open",
            created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
            updated_at: now,
            user: { login: "sarah-c", id: 101 },
            head: { ref: "feature/ledger", sha: "sha-c103" },
          },
          repository: { name: "payments-core", full_name: "acme/payments-core" },
        });

        await githubProcessor.processReview({
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

        // Ingest Slack Event
        await slackProcessor.processEvent({
          event: {
            type: "message",
            text: "Discussed in triage: ENG-104 is blocking release 2.4. PR #42 is ready for review.",
            user: "U_TARIQ",
            ts: `${Math.floor(Date.now() / 1000)}.000200`,
            channel: "C_DEV",
          },
          type: "event_callback",
          event_id: "evt_1",
          event_time: Math.floor(Date.now() / 1000),
        });

        return new Response(
          JSON.stringify({ success: true, message: "Multi-platform demo entities and edges seeded." }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 5. Healthcheck API
      if (req.method === "GET" && url.pathname === "/health") {
        const nodes = await store.getAllNodes();
        const edges = await store.getAllEdges();
        return new Response(
          JSON.stringify({
            status: "healthy",
            service: "open-teamgraph-gateway",
            uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
            graph_stats: {
              total_nodes: nodes.length,
              total_edges: edges.length,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 6. GitHub Webhook Endpoint
      if (req.method === "POST" && url.pathname === "/webhooks/github") {
        const event = req.headers.get("x-github-event");
        const signature = req.headers.get("x-hub-signature-256");
        const rawBody = await req.text();

        if (config.githubSecret && !verifyHmacSignature(config.githubSecret, rawBody, signature || undefined)) {
          return new Response(JSON.stringify({ error: "Invalid HMAC signature" }), { status: 401 });
        }

        try {
          const payload = JSON.parse(rawBody);
          if (event === "push") {
            await githubProcessor.processPush(payload);
          } else if (event === "pull_request") {
            await githubProcessor.processPullRequest(payload);
          } else if (event === "pull_request_review") {
            await githubProcessor.processReview(payload);
          }

          return new Response(JSON.stringify({ received: true, event }), { status: 200 });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
      }

      // 7. Linear Webhook Endpoint
      if (req.method === "POST" && url.pathname === "/webhooks/linear") {
        const signature = req.headers.get("linear-signature");
        const rawBody = await req.text();

        if (config.linearSecret && !verifyHmacSignature(config.linearSecret, rawBody, signature || undefined)) {
          return new Response(JSON.stringify({ error: "Invalid Linear signature" }), { status: 401 });
        }

        try {
          const payload = JSON.parse(rawBody);
          await linearProcessor.processWebhook(payload);
          return new Response(JSON.stringify({ received: true }), { status: 200 });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
      }

      // 8. Slack Webhook Endpoint
      if (req.method === "POST" && url.pathname === "/webhooks/slack") {
        const rawBody = await req.text();
        try {
          const payload = JSON.parse(rawBody);

          if (payload.type === "url_verification") {
            return new Response(JSON.stringify({ challenge: payload.challenge }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (payload.type === "event_callback") {
            await slackProcessor.processEvent(payload);
          }

          return new Response(JSON.stringify({ received: true }), { status: 200 });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    },
  };
}
