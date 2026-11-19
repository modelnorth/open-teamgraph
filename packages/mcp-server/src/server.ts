import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { IGraphStore } from "../../core/src/graph/store.js";
import { InMemoryGraphStore } from "../../core/src/graph/memory-store.js";
import { ExpertFinder } from "../../core/src/algorithms/expert-finder.js";
import { BlastRadiusAnalyzer } from "../../core/src/algorithms/blast-radius.js";
import { EntityType } from "../../core/src/types/schema.js";

export function createTeamGraphServer(store: IGraphStore) {
  const expertFinder = new ExpertFinder(store);
  const blastAnalyzer = new BlastRadiusAnalyzer(store);

  const server = new Server(
    {
      name: "open-teamgraph-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "who_knows",
          description: "Find top engineers and reviewers for a file, service, or component with recency decay.",
          inputSchema: {
            type: "object",
            properties: {
              target: {
                type: "string",
                description: "File path, service name, or URN (e.g. 'src/auth/jwt.ts' or 'urn:tg:file:...').",
              },
              limit: {
                type: "number",
                description: "Maximum number of experts to return (default: 5).",
              },
            },
            required: ["target"],
          },
        },
        {
          name: "blast_radius",
          description: "Analyze downstream impact, dependent services, tasks, and teams affected by modifying a component.",
          inputSchema: {
            type: "object",
            properties: {
              target: {
                type: "string",
                description: "Target node ID or component name.",
              },
              depth: {
                type: "number",
                description: "Traversal depth (default: 3).",
              },
            },
            required: ["target"],
          },
        },
        {
          name: "what_changed",
          description: "Query temporal changes (commits, PRs, file edits) in the graph between timestamps.",
          inputSchema: {
            type: "object",
            properties: {
              since: {
                type: "string",
                description: "ISO date string or relative format ('7d', '24h', '30d').",
              },
              until: {
                type: "string",
                description: "Optional ending ISO date string.",
              },
            },
            required: ["since"],
          },
        },
        {
          name: "query_graph",
          description: "Directly query graph nodes, relations, and neighbor connectivity.",
          inputSchema: {
            type: "object",
            properties: {
              node_id: {
                type: "string",
                description: "Node URN to inspect.",
              },
              entity_type: {
                type: "string",
                description: "Optional entity type filter (e.g. Person, Service, Repository, Task).",
              },
              as_of: {
                type: "string",
                description: "Optional historical timestamp for temporal time-travel.",
              },
            },
          },
        },
        {
          name: "search",
          description: "Search entities across the teamwork graph by keyword or semantic name.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Keyword or name query.",
              },
              limit: {
                type: "number",
                description: "Maximum results (default: 10).",
              },
            },
            required: ["query"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    if (name === "who_knows") {
      const target = String(args.target);
      const limit = Number(args.limit) || 5;

      // Find node matching target (either exact ID, or matching path)
      let targetNode = await store.getNode(target);
      if (!targetNode) {
        const matches = await store.queryNodes(
          (n) => n.name === target || n.id.endsWith(`:${target}`) || (n.properties?.path === target)
        );
        targetNode = matches[0];
      }

      if (!targetNode) {
        return {
          content: [
            {
              type: "text",
              text: `No entity found matching target: "${target}". Verify the file path or URN.`,
            },
          ],
        };
      }

      const experts = await expertFinder.findExperts(targetNode.id, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                target: targetNode.name,
                target_id: targetNode.id,
                experts: experts.map((e) => ({
                  name: e.person.name,
                  id: e.person.id,
                  score: e.score,
                  commits: e.commitCount,
                  reviews: e.reviewCount,
                  last_active: e.lastActive,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "blast_radius") {
      const target = String(args.target);
      const depth = Number(args.depth) || 3;

      let targetNode = await store.getNode(target);
      if (!targetNode) {
        const matches = await store.queryNodes((n) => n.name === target || n.id.endsWith(`:${target}`));
        targetNode = matches[0];
      }

      if (!targetNode) {
        return {
          content: [
            {
              type: "text",
              text: `Target "${target}" not found in graph.`,
            },
          ],
        };
      }

      const radius = await blastAnalyzer.analyze(targetNode.id, depth);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                target: targetNode.name,
                affected_services: radius?.affectedServices.map((s) => s.name) || [],
                affected_files: radius?.affectedFiles.map((f) => f.name) || [],
                dependent_tasks: radius?.dependentTasks.map((t) => t.name) || [],
                owning_teams: radius?.owningTeams.map((t) => t.name) || [],
                traversal_depth: radius?.depthReached || 0,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "what_changed") {
      let sinceIso: string;
      const sinceArg = String(args.since);
      if (sinceArg.endsWith("d")) {
        const days = parseInt(sinceArg.replace("d", ""), 10) || 7;
        sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      } else if (sinceArg.endsWith("h")) {
        const hours = parseInt(sinceArg.replace("h", ""), 10) || 24;
        sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      } else {
        sinceIso = new Date(sinceArg).toISOString();
      }

      const untilIso = args.until ? new Date(String(args.until)).toISOString() : new Date().toISOString();

      const diff = await store.diff(sinceIso, untilIso);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                time_range: { since: sinceIso, until: untilIso },
                added_nodes_count: diff.addedNodes.length,
                added_edges_count: diff.addedEdges.length,
                recent_entities: diff.addedNodes.slice(0, 20).map((n) => ({
                  type: n.type,
                  name: n.name,
                  id: n.id,
                  valid_from: n.valid_from,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "query_graph") {
      if (args.node_id) {
        const node = await store.getNode(String(args.node_id));
        if (!node) {
          return { content: [{ type: "text", text: `Node not found: ${args.node_id}` }] };
        }
        const neighbors = await store.getNeighbors(node.id, {
          asOf: args.as_of ? String(args.as_of) : undefined,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  node,
                  neighbors: neighbors.map((n) => ({
                    edge_type: n.edge.type,
                    direction: n.direction,
                    neighbor: { id: n.node.id, name: n.node.name, type: n.node.type },
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (args.entity_type) {
        const nodes = await store.findNodesByType(args.entity_type as EntityType);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { count: nodes.length, nodes: nodes.slice(0, 50).map((n) => ({ id: n.id, name: n.name, type: n.type })) },
                null,
                2
              ),
            },
          ],
        };
      }

      const allNodes = await store.getAllNodes();
      const allEdges = await store.getAllEdges();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total_nodes: allNodes.length,
                total_edges: allEdges.length,
                sample_nodes: allNodes.slice(0, 10).map((n) => ({ id: n.id, name: n.name, type: n.type })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "search") {
      const q = String(args.query).toLowerCase();
      const limit = Number(args.limit) || 10;
      const matches = await store.queryNodes(
        (n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: q,
                results: matches.slice(0, limit).map((n) => ({
                  id: n.id,
                  type: n.type,
                  name: n.name,
                  properties: n.properties,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

// Standalone execution entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const defaultStore = new InMemoryGraphStore();
  const server = createTeamGraphServer(defaultStore);
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
}
