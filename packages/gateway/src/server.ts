import * as crypto from "node:crypto";
import { IGraphStore } from "../../core/src/graph/store";
import { GitHubWebhookProcessor } from "../../connectors/github/src/webhook";
import { LinearWebhookProcessor } from "../../connectors/linear/src/webhook";
import { SlackWebhookProcessor } from "../../connectors/slack/src/webhook";

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

  return {
    async handleRequest(req: Request): Promise<Response> {
      const url = new URL(req.url);

      // Healthcheck
      if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
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

      // GitHub Webhook Endpoint
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

      // Linear Webhook Endpoint
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

      // Slack Webhook Endpoint
      if (req.method === "POST" && url.pathname === "/webhooks/slack") {
        const rawBody = await req.text();
        try {
          const payload = JSON.parse(rawBody);

          // URL Verification Challenge
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
