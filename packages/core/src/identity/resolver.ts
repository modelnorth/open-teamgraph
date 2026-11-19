import { GraphNode } from "../types/schema.js";
import { IGraphStore } from "../graph/store.js";

export interface IdentityLink {
  provider: "github" | "email" | "slack" | "jira" | "linear";
  identifier: string; // e.g. "octocat", "octo@github.com", "U12345"
  name?: string;
}

export class IdentityResolver {
  private store: IGraphStore;
  // In-memory mapping of provider:identifier -> canonical person ID
  private lookupTable: Map<string, string> = new Map();

  constructor(store: IGraphStore) {
    this.store = store;
  }

  private makeKey(provider: string, identifier: string): string {
    return `${provider.toLowerCase()}:${identifier.toLowerCase()}`;
  }

  /**
   * Resolves or creates a canonical Person node from one or more identity links.
   * If links intersect with an existing person, the profiles are merged.
   */
  async resolvePerson(links: IdentityLink[], displayName?: string): Promise<GraphNode> {
    let canonicalId: string | undefined;

    // 1. Check if any link already maps to an existing person
    for (const link of links) {
      const key = this.makeKey(link.provider, link.identifier);
      if (this.lookupTable.has(key)) {
        canonicalId = this.lookupTable.get(key);
        break;
      }
    }

    // 2. If existing person found, fetch and merge
    if (canonicalId) {
      const existing = await this.store.getNode(canonicalId);
      if (existing) {
        const identities = existing.properties.identities as IdentityLink[] || [];
        
        // Merge new links
        for (const link of links) {
          const key = this.makeKey(link.provider, link.identifier);
          this.lookupTable.set(key, canonicalId);
          if (!identities.some(i => i.provider === link.provider && i.identifier.toLowerCase() === link.identifier.toLowerCase())) {
            identities.push(link);
          }
        }

        existing.properties.identities = identities;
        if (displayName && !existing.name) {
          existing.name = displayName;
        }
        await this.store.addNode(existing);
        return existing;
      }
    }

    // 3. Create new canonical Person node
    const primaryLink = links[0];
    const baseId = primaryLink.identifier.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const newId = `urn:tg:person:${baseId}`;
    const now = new Date().toISOString();

    const personNode: GraphNode = {
      id: newId,
      type: "Person",
      name: displayName || primaryLink.name || primaryLink.identifier,
      properties: {
        identities: [...links],
        primary_email: links.find(l => l.provider === "email")?.identifier,
        github_handle: links.find(l => l.provider === "github")?.identifier,
      },
      valid_from: now,
      created_at: now,
    };

    await this.store.addNode(personNode);

    // Register all links in lookup
    for (const link of links) {
      this.lookupTable.set(this.makeKey(link.provider, link.identifier), newId);
    }

    return personNode;
  }

  async getPersonByIdentifier(provider: string, identifier: string): Promise<GraphNode | undefined> {
    const key = this.makeKey(provider, identifier);
    const canonicalId = this.lookupTable.get(key);
    if (!canonicalId) return undefined;
    return this.store.getNode(canonicalId);
  }
}
