import { GraphNode } from "../types/schema.js";
import { IGraphStore } from "../graph/store.js";

export interface BlastRadiusResult {
  target: GraphNode;
  affectedServices: GraphNode[];
  affectedFiles: GraphNode[];
  dependentTasks: GraphNode[];
  owningTeams: GraphNode[];
  depthReached: number;
}

export class BlastRadiusAnalyzer {
  private store: IGraphStore;

  constructor(store: IGraphStore) {
    this.store = store;
  }

  async analyze(targetId: string, maxDepth = 3): Promise<BlastRadiusResult | undefined> {
    const target = await this.store.getNode(targetId);
    if (!target) return undefined;

    const visited = new Set<string>([targetId]);
    const affectedServices: GraphNode[] = [];
    const affectedFiles: GraphNode[] = [];
    const dependentTasks: GraphNode[] = [];
    const owningTeams: GraphNode[] = [];

    let currentLevel = [targetId];
    let depth = 0;

    while (currentLevel.length > 0 && depth < maxDepth) {
      depth++;
      const nextLevel: string[] = [];

      for (const nodeId of currentLevel) {
        // Find outgoing and incoming dependency edges
        const neighbors = await this.store.getNeighbors(nodeId, {
          edgeTypes: ["DEPENDS_ON", "PART_OF", "BLOCKS", "OWNS"],
        });

        for (const item of neighbors) {
          const neighbor = item.node;
          if (visited.has(neighbor.id)) continue;
          visited.add(neighbor.id);
          nextLevel.push(neighbor.id);

          if (neighbor.type === "Service") affectedServices.push(neighbor);
          else if (neighbor.type === "File") affectedFiles.push(neighbor);
          else if (neighbor.type === "Task") dependentTasks.push(neighbor);
          else if (neighbor.type === "Team") owningTeams.push(neighbor);
        }
      }

      currentLevel = nextLevel;
    }

    return {
      target,
      affectedServices,
      affectedFiles,
      dependentTasks,
      owningTeams,
      depthReached: depth,
    };
  }
}
