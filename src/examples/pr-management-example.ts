import { CodeSandbox, createPRApiClient, PRInfo, ThreadInfo } from "../index";

/**
 * Example demonstrating PR and thread management functionality
 */
export async function prManagementExample() {
  // Initialize the CodeSandbox SDK
  const sdk = new CodeSandbox("your-api-token");
  
  // Create a sandbox
  const sandbox = await sdk.sandboxes.create({
    source: "template",
    title: "PR Management Example",
  });

  // Get a session to the sandbox
  const session = await sandbox.connect();

  // 1. Create a thread for this sandbox with an active branch
  const thread = await session.prs.storeThread({
    sandboxId: sandbox.id,
    activeBranch: "feature/new-feature",
    metadata: {
      description: "Working on a new feature",
      author: "developer@example.com",
    },
  });

  console.log("Created thread:", thread);

  // 2. Store PR information when a PR is created
  const prInfo = await session.prs.storePR({
    number: 123,
    title: "Add new feature functionality",
    status: "open",
    url: "https://github.com/owner/repo/pull/123",
    branch: "feature/new-feature",
    baseBranch: "main",
    author: "developer@example.com",
    repository: "owner/repo",
  });

  console.log("Stored PR:", prInfo);

  // 3. Link the PR to the thread
  await session.prs.linkPRToThread(sandbox.id, prInfo.id);

  // 4. Update the thread's active branch
  await session.prs.updateThreadBranch(sandbox.id, "feature/updated-feature");

  // 5. Get all open PRs
  const openPRs = session.prs.getOpenPRs();
  console.log("Open PRs:", openPRs);

  // 6. Start polling for PR updates (every 30 seconds)
  session.prs.startPRPolling(30000);

  // 7. Manually poll for updates
  const updates = await session.prs.pollPRStatusUpdates();
  console.log("PR updates:", updates);

  // 8. Update PR status
  await session.prs.updatePRStatus(prInfo.id, "merged");

  // 9. Get thread information
  const threadInfo = session.prs.getThreadBySandboxId(sandbox.id);
  console.log("Thread info:", threadInfo);

  // 10. Export all data
  const exportedData = session.prs.exportData();
  console.log("Exported data:", exportedData);

  // Clean up
  session.prs.stopPRPolling();
  session.dispose();
}

/**
 * Example using external PR API clients
 */
export async function externalPRApiExample() {
  // Create a GitHub PR API client
  const githubClient = createPRApiClient("github", {
    token: "your-github-token",
  });

  // Get PR status from GitHub
  const status = await githubClient.getPRStatus("owner/repo", 123);
  console.log("GitHub PR status:", status);

  // Poll for updates
  const updates = await githubClient.pollPRUpdates(["pr-id-1", "pr-id-2"]);
  console.log("PR updates:", updates);

  // Create a custom API client
  const customClient = createPRApiClient("custom", {
    baseUrl: "https://your-api.com",
    apiToken: "your-api-token",
  });

  const prDetails = await customClient.getPRDetails("pr-id");
  console.log("Custom API PR details:", prDetails);
}

/**
 * Example showing thread and PR lifecycle
 */
export async function prLifecycleExample() {
  const sdk = new CodeSandbox("your-api-token");
  const sandbox = await sdk.sandboxes.create({ source: "template" });
  const session = await sandbox.connect();

  // Step 1: Create thread when starting work
  const thread = await session.prs.storeThread({
    sandboxId: sandbox.id,
    activeBranch: "feature/user-auth",
    metadata: {
      ticketId: "AUTH-123",
      priority: "high",
    },
  });

  // Step 2: Create PR
  const pr = await session.prs.storePR({
    number: 456,
    title: "Implement user authentication",
    status: "draft",
    url: "https://github.com/company/app/pull/456",
    branch: "feature/user-auth",
    baseBranch: "main",
    author: "developer@company.com",
    repository: "company/app",
  });

  // Step 3: Link PR to thread
  await session.prs.linkPRToThread(sandbox.id, pr.id);

  // Step 4: Update PR status as work progresses
  await session.prs.updatePRStatus(pr.id, "open");

  // Step 5: Switch branches during development
  await session.prs.updateThreadBranch(sandbox.id, "feature/user-auth-fixes");

  // Step 6: Final PR merge
  await session.prs.updatePRStatus(pr.id, "merged");

  // Step 7: Get final state
  const finalThread = session.prs.getThreadBySandboxId(sandbox.id);
  const finalPR = session.prs.getPR(pr.id);

  console.log("Final thread state:", finalThread);
  console.log("Final PR state:", finalPR);

  session.dispose();
}

// Type definitions for better development experience
export interface PRWorkflow {
  thread: ThreadInfo;
  pr: PRInfo;
  sandbox: any; // Replace with actual Sandbox type
  session: any; // Replace with actual WebSocketSession type
}

export class PRWorkflowManager {
  private workflows: Map<string, PRWorkflow> = new Map();

  async createWorkflow(
    sdk: CodeSandbox,
    branchName: string,
    metadata?: Record<string, any>
  ): Promise<PRWorkflow> {
    const sandbox = await sdk.sandboxes.create({
      source: "template",
      title: `Workflow for ${branchName}`,
    });

    const session = await sandbox.connect();

    const thread = await session.prs.storeThread({
      sandboxId: sandbox.id,
      activeBranch: branchName,
      metadata,
    });

    const workflow: PRWorkflow = {
      thread,
      pr: null as any, // Will be set when PR is created
      sandbox,
      session,
    };

    this.workflows.set(sandbox.id, workflow);
    return workflow;
  }

  async attachPR(sandboxId: string, prInfo: Omit<PRInfo, "id" | "createdAt" | "updatedAt">): Promise<void> {
    const workflow = this.workflows.get(sandboxId);
    if (!workflow) {
      throw new Error(`Workflow not found for sandbox ${sandboxId}`);
    }

    const pr = await workflow.session.prs.storePR(prInfo);
    await workflow.session.prs.linkPRToThread(sandboxId, pr.id);
    workflow.pr = pr;
  }

  getWorkflow(sandboxId: string): PRWorkflow | undefined {
    return this.workflows.get(sandboxId);
  }

  async getAllOpenPRs(): Promise<PRInfo[]> {
    const allPRs: PRInfo[] = [];
    for (const workflow of this.workflows.values()) {
      if (workflow.pr) {
        const openPRs = workflow.session.prs.getOpenPRs();
        allPRs.push(...openPRs);
      }
    }
    return allPRs;
  }

  async pollAllWorkflows(): Promise<void> {
    for (const workflow of this.workflows.values()) {
      if (workflow.session) {
        await workflow.session.prs.pollPRStatusUpdates();
      }
    }
  }

  dispose(): void {
    for (const workflow of this.workflows.values()) {
      workflow.session.dispose();
    }
    this.workflows.clear();
  }
}