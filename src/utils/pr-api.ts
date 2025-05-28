import { PRInfo, PRStatus } from "../types";

export interface PRApiClient {
  /**
   * Poll for PR status updates
   */
  pollPRUpdates(prIds?: string[]): Promise<PRStatusUpdate[]>;
  
  /**
   * Get PR details by ID
   */
  getPRDetails(prId: string): Promise<PRInfo | null>;
  
  /**
   * Get PR status by repository and PR number
   */
  getPRStatus(repository: string, prNumber: number): Promise<PRStatus | null>;
}

export interface PRStatusUpdate {
  prId: string;
  oldStatus: PRStatus;
  newStatus: PRStatus;
  updatedAt: Date;
}

export interface PRApiClientConfig {
  baseUrl?: string;
  apiToken?: string;
  headers?: Record<string, string>;
}

/**
 * Generic PR API client that can be extended for different Git providers
 */
export class BasePRApiClient implements PRApiClient {
  protected baseUrl: string;
  protected headers: Record<string, string>;

  constructor(config: PRApiClientConfig) {
    this.baseUrl = config.baseUrl || "";
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    if (config.apiToken) {
      this.headers["Authorization"] = `Bearer ${config.apiToken}`;
    }
  }

  async pollPRUpdates(prIds?: string[]): Promise<PRStatusUpdate[]> {
    const endpoint = `/api/prs/poll`;
    const body = prIds ? { prIds } : {};

    try {
      const response = await this.makeRequest("POST", endpoint, body);
      return response.updates || [];
    } catch (error) {
      console.error("Failed to poll PR updates:", error);
      return [];
    }
  }

  async getPRDetails(prId: string): Promise<PRInfo | null> {
    const endpoint = `/api/prs/${prId}`;

    try {
      const response = await this.makeRequest("GET", endpoint);
      return response.pr || null;
    } catch (error) {
      console.error(`Failed to get PR details for ${prId}:`, error);
      return null;
    }
  }

  async getPRStatus(repository: string, prNumber: number): Promise<PRStatus | null> {
    const endpoint = `/api/prs/status`;
    const params = new URLSearchParams({
      repository,
      prNumber: prNumber.toString(),
    });

    try {
      const response = await this.makeRequest("GET", `${endpoint}?${params}`);
      return response.status || null;
    } catch (error) {
      console.error(`Failed to get PR status for ${repository}#${prNumber}:`, error);
      return null;
    }
  }

  protected async makeRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * GitHub-specific PR API client
 */
export class GitHubPRApiClient extends BasePRApiClient {
  constructor(token: string, baseUrl: string = "https://api.github.com") {
    super({
      baseUrl,
      apiToken: token,
      headers: {
        "Accept": "application/vnd.github.v3+json",
      },
    });
  }

  async getPRStatusFromGitHub(owner: string, repo: string, prNumber: number): Promise<PRStatus | null> {
    try {
      const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}`;
      const response = await this.makeRequest("GET", endpoint);
      
      // GitHub API returns state: "open", "closed", and merged is determined by merged_at
      if (response.state === "closed" && response.merged_at) {
        return "merged";
      }
      return response.state as PRStatus;
    } catch (error) {
      console.error(`Failed to get GitHub PR status:`, error);
      return null;
    }
  }

}

/**
 * Factory function to create PR API clients
 */
export function createPRApiClient(
  provider: "github" | "custom",
  config: PRApiClientConfig & { token?: string }
): PRApiClient {
  switch (provider) {
    case "github":
      if (!config.token) {
        throw new Error("GitHub token is required");
      }
      return new GitHubPRApiClient(config.token, config.baseUrl);
    case "custom":
      return new BasePRApiClient(config);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}