import { z } from "zod";

export const EntityTypeEnum = z.enum([
  "Person",
  "Team",
  "Agent",
  "Task",
  "PullRequest",
  "Commit",
  "Review",
  "Repository",
  "Service",
  "File",
  "Document",
  "Message",
]);

export type EntityType = z.infer<typeof EntityTypeEnum>;

export const EdgeTypeEnum = z.enum([
  "AUTHORED",
  "REVIEWED",
  "OWNS",
  "MEMBER_OF",
  "WORKED_ON",
  "BLOCKS",
  "REFERENCES",
  "DEPENDS_ON",
  "DEPLOYED_TO",
  "CAUSED",
  "RESOLVED",
  "MENTIONS",
  "MODIFIES",
  "PART_OF",
  "TRIGGERED_BY",
]);

export type EdgeType = z.infer<typeof EdgeTypeEnum>;

export interface GraphNode {
  id: string; // e.g. "urn:tg:person:alex", "urn:tg:file:auth/token.go"
  type: EntityType;
  name: string;
  properties: Record<string, any>;
  embedding?: number[];
  valid_from: string; // ISO 8601
  valid_to?: string;   // ISO 8601
  created_at: string;
}

export interface GraphEdge {
  id: string; // e.g. "urn:tg:edge:AUTHORED:pr_123->commit_abc"
  type: EdgeType;
  source: string; // Source Node ID
  target: string; // Target Node ID
  properties: Record<string, any>;
  confidence: number; // 0.0 to 1.0
  source_connector: string; // "github", "linear", "slack", "heuristic"
  valid_from: string;
  valid_to?: string;
  created_at: string;
}

export interface TemporalFilter {
  as_of?: string; // Query state of world at specific historical time
  from?: string;
  to?: string;
}

export interface SearchQuery {
  text?: string;
  entityTypes?: EntityType[];
  limit?: number;
}
