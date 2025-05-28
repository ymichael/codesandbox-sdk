import type { IPitcherClient } from "@codesandbox/pitcher-client";
import { Disposable } from "../../utils/disposable";
import { PRInfo, PRStatus, ThreadInfo } from "../../types";

export class PRManagement {
  private prStorage: Map<string, PRInfo> = new Map();
  private threadStorage: Map<string, ThreadInfo> = new Map();
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private disposable: Disposable,
    private pitcherClient: IPitcherClient
  ) {
    this.disposable.onWillDispose(() => {
      this.pollIntervals.forEach((interval) => clearInterval(interval));
      this.pollIntervals.clear();
    });
  }

  /**
   * Store PR information when a PR is created
   */
  async storePR(prInfo: Omit<PRInfo, "id" | "createdAt" | "updatedAt">): Promise<PRInfo> {
    const id = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const pr: PRInfo = {
      ...prInfo,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.prStorage.set(id, pr);
    return pr;
  }

  /**
   * Update PR status
   */
  async updatePRStatus(prId: string, status: PRStatus): Promise<PRInfo | null> {
    const pr = this.prStorage.get(prId);
    if (!pr) {
      return null;
    }

    const updatedPR: PRInfo = {
      ...pr,
      status,
      updatedAt: new Date(),
    };

    this.prStorage.set(prId, updatedPR);
    return updatedPR;
  }

  /**
   * Get PR by ID
   */
  getPR(prId: string): PRInfo | null {
    return this.prStorage.get(prId) || null;
  }

  /**
   * Get all PRs with optional status filter
   */
  getAllPRs(statusFilter?: PRStatus): PRInfo[] {
    const prs = Array.from(this.prStorage.values());
    if (statusFilter) {
      return prs.filter(pr => pr.status === statusFilter);
    }
    return prs;
  }

  /**
   * Get all open PRs
   */
  getOpenPRs(): PRInfo[] {
    return this.getAllPRs("open");
  }

  /**
   * Create or update thread information
   */
  async storeThread(threadInfo: Omit<ThreadInfo, "id" | "createdAt" | "updatedAt">): Promise<ThreadInfo> {
    const existingThread = Array.from(this.threadStorage.values())
      .find(t => t.sandboxId === threadInfo.sandboxId);

    if (existingThread) {
      const updatedThread: ThreadInfo = {
        ...existingThread,
        ...threadInfo,
        updatedAt: new Date(),
      };
      this.threadStorage.set(existingThread.id, updatedThread);
      return updatedThread;
    }

    const id = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const thread: ThreadInfo = {
      ...threadInfo,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.threadStorage.set(id, thread);
    return thread;
  }

  /**
   * Update thread's active branch
   */
  async updateThreadBranch(sandboxId: string, activeBranch: string): Promise<ThreadInfo | null> {
    const thread = Array.from(this.threadStorage.values())
      .find(t => t.sandboxId === sandboxId);

    if (!thread) {
      return null;
    }

    const updatedThread: ThreadInfo = {
      ...thread,
      activeBranch,
      updatedAt: new Date(),
    };

    this.threadStorage.set(thread.id, updatedThread);
    return updatedThread;
  }

  /**
   * Link a PR to a thread
   */
  async linkPRToThread(sandboxId: string, prId: string): Promise<ThreadInfo | null> {
    const thread = Array.from(this.threadStorage.values())
      .find(t => t.sandboxId === sandboxId);

    if (!thread) {
      return null;
    }

    const updatedThread: ThreadInfo = {
      ...thread,
      prId,
      updatedAt: new Date(),
    };

    this.threadStorage.set(thread.id, updatedThread);
    return updatedThread;
  }

  /**
   * Get thread by sandbox ID
   */
  getThreadBySandboxId(sandboxId: string): ThreadInfo | null {
    return Array.from(this.threadStorage.values())
      .find(t => t.sandboxId === sandboxId) || null;
  }

  /**
   * Get thread by ID
   */
  getThread(threadId: string): ThreadInfo | null {
    return this.threadStorage.get(threadId) || null;
  }

  /**
   * Start polling for PR status updates
   */
  startPRPolling(intervalMs: number = 30000): void {
    const pollInterval = setInterval(async () => {
      const openPRs = this.getOpenPRs();
      
      for (const pr of openPRs) {
        try {
          // In a real implementation, you would call an external API
          // to check the actual PR status. For now, this is a placeholder.
          const updatedStatus = await this.checkPRStatusExternal(pr);
          if (updatedStatus && updatedStatus !== pr.status) {
            await this.updatePRStatus(pr.id, updatedStatus);
          }
        } catch (error) {
          console.error(`Failed to poll PR ${pr.id}:`, error);
        }
      }
    }, intervalMs);

    this.pollIntervals.set("main", pollInterval);
  }

  /**
   * Stop PR polling
   */
  stopPRPolling(): void {
    const interval = this.pollIntervals.get("main");
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete("main");
    }
  }

  /**
   * Manually trigger PR status check for all open PRs
   */
  async pollPRStatusUpdates(): Promise<PRInfo[]> {
    const openPRs = this.getOpenPRs();
    const updatedPRs: PRInfo[] = [];

    for (const pr of openPRs) {
      try {
        const updatedStatus = await this.checkPRStatusExternal(pr);
        if (updatedStatus && updatedStatus !== pr.status) {
          const updated = await this.updatePRStatus(pr.id, updatedStatus);
          if (updated) {
            updatedPRs.push(updated);
          }
        }
      } catch (error) {
        console.error(`Failed to check PR ${pr.id}:`, error);
      }
    }

    return updatedPRs;
  }

  /**
   * External API call to check PR status - placeholder implementation
   * In a real implementation, this would call GitHub API, GitLab API, etc.
   */
  private async checkPRStatusExternal(pr: PRInfo): Promise<PRStatus | null> {
    // Placeholder - implement actual API calls to GitHub/GitLab/etc
    // This would typically use the PR URL or repository info to make API calls
    
    // Example for GitHub API:
    // const response = await fetch(`https://api.github.com/repos/${pr.repository}/pulls/${pr.number}`);
    // const data = await response.json();
    // return data.state; // "open", "closed", "merged"
    
    return null;
  }

  /**
   * Export all PR and thread data
   */
  exportData(): { prs: PRInfo[], threads: ThreadInfo[] } {
    return {
      prs: Array.from(this.prStorage.values()),
      threads: Array.from(this.threadStorage.values()),
    };
  }

  /**
   * Import PR and thread data
   */
  importData(data: { prs: PRInfo[], threads: ThreadInfo[] }): void {
    this.prStorage.clear();
    this.threadStorage.clear();

    data.prs.forEach(pr => this.prStorage.set(pr.id, pr));
    data.threads.forEach(thread => this.threadStorage.set(thread.id, thread));
  }
}