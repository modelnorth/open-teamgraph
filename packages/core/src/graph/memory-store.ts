import { GraphNode, GraphEdge, EntityType } from "../types/schema.js";
import { IGraphStore, NeighborOptions, NeighborResult, GraphDiffResult } from "./store.js";

export class InMemoryGraphStore implements IGraphStore {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  
  // Adjacency lists for instant O(1) traversal
  private outEdges: Map<string, Set<string>> = new Map();
  private inEdges: Map<string, Set<string>> = new Map();

  async addNode(node: GraphNode): Promise<void> {
    this.nodes.set(node.id, { ...node });
    if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, new Set());
    if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, new Set());
  }

  async addEdge(edge: GraphEdge): Promise<void> {
    this.edges.set(edge.id, { ...edge });
    
    if (!this.outEdges.has(edge.source)) {
      this.outEdges.set(edge.source, new Set());
    }
    this.outEdges.get(edge.source)!.add(edge.id);

    if (!this.inEdges.has(edge.target)) {
      this.inEdges.set(edge.target, new Set());
    }
    this.inEdges.get(edge.target)!.add(edge.id);
  }

  async getNode(id: string): Promise<GraphNode | undefined> {
    return this.nodes.get(id);
  }

  async getEdge(id: string): Promise<GraphEdge | undefined> {
    return this.edges.get(id);
  }

  async getAllNodes(): Promise<GraphNode[]> {
    return Array.from(this.nodes.values());
  }

  async getAllEdges(): Promise<GraphEdge[]> {
    return Array.from(this.edges.values());
  }

  async findNodesByType(type: EntityType): Promise<GraphNode[]> {
    const results: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.type === type) results.push(node);
    }
    return results;
  }

  async queryNodes(predicate: (node: GraphNode) => boolean): Promise<GraphNode[]> {
    const results: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (predicate(node)) results.push(node);
    }
    return results;
  }

  async queryEdges(predicate: (edge: GraphEdge) => boolean): Promise<GraphEdge[]> {
    const results: GraphEdge[] = [];
    for (const edge of this.edges.values()) {
      if (predicate(edge)) results.push(edge);
    }
    return results;
  }

  private isTemporallyValid(item: { valid_from: string; valid_to?: string }, asOf?: string): boolean {
    if (!asOf) return true;
    const target = new Date(asOf).getTime();
    const from = new Date(item.valid_from).getTime();
    if (target < from) return false;
    if (item.valid_to) {
      const to = new Date(item.valid_to).getTime();
      if (target >= to) return false;
    }
    return true;
  }

  async getNeighbors(id: string, options: NeighborOptions = {}): Promise<NeighborResult[]> {
    const results: NeighborResult[] = [];
    const direction = options.direction || "both";
    const asOf = options.asOf;

    // Check Outgoing Edges
    if (direction === "out" || direction === "both") {
      const outEdgeIds = this.outEdges.get(id) || new Set();
      for (const edgeId of outEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) continue;
        if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) continue;
        if (!this.isTemporallyValid(edge, asOf)) continue;

        const targetNode = this.nodes.get(edge.target);
        if (!targetNode) continue;
        if (!this.isTemporallyValid(targetNode, asOf)) continue;

        results.push({ edge, node: targetNode, direction: "out" });
      }
    }

    // Check Incoming Edges
    if (direction === "in" || direction === "both") {
      const inEdgeIds = this.inEdges.get(id) || new Set();
      for (const edgeId of inEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) continue;
        if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) continue;
        if (!this.isTemporallyValid(edge, asOf)) continue;

        const sourceNode = this.nodes.get(edge.source);
        if (!sourceNode) continue;
        if (!this.isTemporallyValid(sourceNode, asOf)) continue;

        results.push({ edge, node: sourceNode, direction: "in" });
      }
    }

    return results;
  }

  async diff(t1: string, t2: string): Promise<GraphDiffResult> {
    const nodesAtT1 = new Map<string, GraphNode>();
    const nodesAtT2 = new Map<string, GraphNode>();

    for (const [id, node] of this.nodes.entries()) {
      if (this.isTemporallyValid(node, t1)) nodesAtT1.set(id, node);
      if (this.isTemporallyValid(node, t2)) nodesAtT2.set(id, node);
    }

    const addedNodes: GraphNode[] = [];
    const removedNodes: GraphNode[] = [];

    for (const [id, node] of nodesAtT2.entries()) {
      if (!nodesAtT1.has(id)) addedNodes.push(node);
    }
    for (const [id, node] of nodesAtT1.entries()) {
      if (!nodesAtT2.has(id)) removedNodes.push(node);
    }

    const edgesAtT1 = new Map<string, GraphEdge>();
    const edgesAtT2 = new Map<string, GraphEdge>();

    for (const [id, edge] of this.edges.entries()) {
      if (this.isTemporallyValid(edge, t1)) edgesAtT1.set(id, edge);
      if (this.isTemporallyValid(edge, t2)) edgesAtT2.set(id, edge);
    }

    const addedEdges: GraphEdge[] = [];
    const removedEdges: GraphEdge[] = [];

    for (const [id, edge] of edgesAtT2.entries()) {
      if (!edgesAtT1.has(id)) addedEdges.push(edge);
    }
    for (const [id, edge] of edgesAtT1.entries()) {
      if (!edgesAtT2.has(id)) removedEdges.push(edge);
    }

    return { addedNodes, removedNodes, addedEdges, removedEdges };
  }

  async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
    this.outEdges.clear();
    this.inEdges.clear();
  }
}
