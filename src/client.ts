import { TimelogConfig } from "./config.js";

export class TimelogClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: TimelogConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      Authorization: `Bearer ${config.pat}`,
      Accept: "application/json",
    };
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), { headers: this.headers });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Timelog API ${response.status}: ${body}`);
    }
    return (await response.json()) as T;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Timelog API ${response.status}: ${text}`);
    }
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Timelog API ${response.status}: ${text}`);
    }
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Timelog API ${response.status}: ${body}`);
    }
  }
}
