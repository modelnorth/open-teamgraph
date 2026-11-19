import { promises as fs } from "fs";
import * as path from "path";
import { GraphNode, GraphEdge } from "../types/schema";
import { InMemoryGraphStore } from "./memory-store";

export class PersistentGraphStore extends InMemoryGraphStore {
  private filePath: string;
  private dirty = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(filePath: string) {
    super();
    this.filePath = path.resolve(filePath);
  }

  /**
   * Initializes the store by loading snapshots from disk if present.
   */
  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(data) as {
        nodes: GraphNode[];
        edges: GraphEdge[];
      };

      await this.clear();
      for (const node of parsed.nodes || []) {
        await super.addNode(node);
      }
      for (const edge of parsed.edges || []) {
        await super.addEdge(edge);
      }
      this.dirty = false;
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.warn(`[PersistentGraphStore] Warning loading store from ${this.filePath}:`, err.message);
      }
    }
  }

  private scheduleSave() {
    this.dirty = true;
    if (this.saveTimeout) return;

    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      if (this.dirty) {
        await this.flush();
      }
    }, 100);
  }

  async flush(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const nodes = await this.getAllNodes();
      const edges = await this.getAllEdges();

      const tempPath = `${this.filePath}.tmp`;
      const payload = JSON.stringify({ nodes, edges }, null, 2);

      await fs.writeFile(tempPath, payload, "utf-8");
      await fs.rename(tempPath, this.filePath);
      this.dirty = false;
    } catch (err: any) {
      console.error(`[PersistentGraphStore] Failed to flush to disk:`, err.message);
    }
  }

  override async addNode(node: GraphNode): Promise<void> {
    await super.addNode(node);
    this.scheduleSave();
  }

  override async addEdge(edge: GraphEdge): Promise<void> {
    await super.addEdge(edge);
    this.scheduleSave();
  }

  override async clear(): Promise<void> {
    await super.clear();
    this.scheduleSave();
  }
}
