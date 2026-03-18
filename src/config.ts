export interface TimelogConfig {
  pat: string;
  baseUrl: string;
}

export function loadConfig(): TimelogConfig {
  const pat = process.env.TIMELOG_PAT;
  if (!pat) {
    throw new Error("TIMELOG_PAT environment variable is required");
  }

  const baseUrl = process.env.TIMELOG_BASE_URL;
  if (!baseUrl) {
    throw new Error("TIMELOG_BASE_URL environment variable is required");
  }

  return { pat, baseUrl };
}
