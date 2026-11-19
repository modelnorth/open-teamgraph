import { GraphNode, GraphEdge, EdgeType, EntityType } from "../types/schema.js";

export interface NeighborResult {
  edge: GraphEdge;
  node: GraphNode;
  direction: "in" | "out";
}

export interface NeighborOptions {
  edgeTypes?: EdgeType[];
  direction?: "in" | "out" | "both";
  asOf?: string; // Temporal filtering
}

export interface GraphDiffResult {
  addedNodes: GraphNode[];
  removedNodes: GraphNode[];
  addedEdges: GraphEdge[];
  removedEdges: GraphEdge[];
}

export interface IGraphStore {
  addNode(node: GraphNode): Promise<void>;
  addEdge(edge: GraphEdge): Promise<void>;
  getNode(id: string): Promise<GraphNode | undefined>;
  getEdge(id: string): Promise<GraphEdge | undefined>;
  getAllNodes(): Promise<GraphNode[]>;
  getAllEdges(): Promise<GraphEdge[]>;
  
  getNeighbors(id: string, options?: NeighborOptions): Promise<NeighborResult[]>;
  
  findNodesByType(type: EntityType): Promise<GraphNode[]>;
  queryNodes(predicate: (node: GraphNode) => boolean): Promise<GraphNode[]>;
  queryEdges(predicate: (edge: GraphEdge) => boolean): Promise<GraphEdge[]>;
  
  diff(t1: string, t2: string): Promise<GraphDiffResult>;
  clear(): Promise<void>;
}
