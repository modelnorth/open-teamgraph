import { GraphNode } from "../types/schema.js";
import { IGraphStore } from "../graph/store.js";

export interface ExpertScore {
  person: GraphNode;
  score: number;
  commitCount: number;
  reviewCount: number;
  lastActive: string;
}

export class ExpertFinder {
  private store: IGraphStore;
  // Half life in days (90 days recency decay)
  private halfLifeDays = 90;

  constructor(store: IGraphStore, halfLifeDays = 90) {
    this.store = store;
    this.halfLifeDays = halfLifeDays;
  }

  private calculateDecay(eventDateIso: string, referenceDate: Date = new Date()): number {
    const eventTime = new Date(eventDateIso).getTime();
    const diffDays = Math.max(0, (referenceDate.getTime() - eventTime) / (1000 * 60 * 60 * 24));
    // exponential decay: e^(-lambda * diffDays), lambda = ln(2) / halfLife
    const lambda = Math.LN2 / this.halfLifeDays;
    return Math.exp(-lambda * diffDays);
  }

  /**
   * Finds the best experts for a specific target node (File, Service, or Component).
   */
  async findExperts(targetId: string, limit = 5): Promise<ExpertScore[]> {
    const scores = new Map<string, {
      person: GraphNode;
      score: number;
      commitCount: number;
      reviewCount: number;
      lastActive: string;
    }>();

    // 1. Find all incoming MODIFIES edges (Commits and PRs that modified this file/service)
    const modifyingEvents = await this.store.getNeighbors(targetId, {
      direction: "in",
      edgeTypes: ["MODIFIES", "PART_OF"],
    });

    for (const item of modifyingEvents) {
      const workNode = item.node; // Commit or PullRequest
      const eventDate = workNode.valid_from || workNode.created_at;
      const decay = this.calculateDecay(eventDate);

      // 2. Find Authors of this workNode
      const authors = await this.store.getNeighbors(workNode.id, {
        direction: "in",
        edgeTypes: ["AUTHORED"],
      });

      for (const authorItem of authors) {
        const person = authorItem.node;
        const entry = scores.get(person.id) || {
          person,
          score: 0,
          commitCount: 0,
          reviewCount: 0,
          lastActive: eventDate,
        };

        const weight = 1.0 * decay;
        entry.score += weight;
        entry.commitCount += 1;
        if (new Date(eventDate) > new Date(entry.lastActive)) {
          entry.lastActive = eventDate;
        }
        scores.set(person.id, entry);
      }

      // 3. Find Reviewers of this workNode
      const reviewers = await this.store.getNeighbors(workNode.id, {
        direction: "in",
        edgeTypes: ["REVIEWED"],
      });

      for (const reviewerItem of reviewers) {
        const person = reviewerItem.node;
        const entry = scores.get(person.id) || {
          person,
          score: 0,
          commitCount: 0,
          reviewCount: 0,
          lastActive: eventDate,
        };

        const weight = 0.6 * decay; // Reviewers get 0.6x author weight
        entry.score += weight;
        entry.reviewCount += 1;
        if (new Date(eventDate) > new Date(entry.lastActive)) {
          entry.lastActive = eventDate;
        }
        scores.set(person.id, entry);
      }
    }

    // Sort by descending score
    const results = Array.from(scores.values())
      .map(e => ({ ...e, score: Math.round(e.score * 100) / 100 }))
      .sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }
}
