export interface HttpConfig {
  /** Timelog API base URL for the organisation, e.g. https://app[X].timelog.com/<account>/api. */
  timelogBaseUrl: string;
  /** Public origin of this server. Used in the OAuth discovery documents. */
  publicBaseUrl: string;
  /** Base64-encoded 32-byte AES key that seals client ids, codes and access tokens. */
  tokenEncryptionKey: string;
  port: number;
  accessTokenTtlDays: number;
  /** Hosts a client may register as an OAuth redirect target. */
  allowedRedirectHosts: string[];
  /** Reverse proxies in front of the process; App Service is one. */
  trustedProxyHops: number;
}

const DEFAULT_REDIRECT_HOSTS = "claude.ai,claude.com,localhost,127.0.0.1";

export function loadHttpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} environment variable is required`);
    return value;
  };
  const integer = (name: string, fallback: number): number => {
    const value = env[name];
    if (value === undefined || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${name} must be a non-negative integer`);
    }
    return parsed;
  };

  const publicBaseUrl = required("PUBLIC_BASE_URL").replace(/\/+$/, "");
  try {
    new URL(publicBaseUrl);
  } catch {
    throw new Error("PUBLIC_BASE_URL must be a valid URL");
  }

  const accessTokenTtlDays = integer("ACCESS_TOKEN_TTL_DAYS", 30);
  if (accessTokenTtlDays < 1) throw new Error("ACCESS_TOKEN_TTL_DAYS must be at least 1");

  return {
    timelogBaseUrl: required("TIMELOG_BASE_URL").replace(/\/+$/, ""),
    publicBaseUrl,
    tokenEncryptionKey: required("TOKEN_ENCRYPTION_KEY"),
    port: integer("PORT", 8080),
    accessTokenTtlDays,
    allowedRedirectHosts: (env.ALLOWED_REDIRECT_HOSTS || DEFAULT_REDIRECT_HOSTS)
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
    trustedProxyHops: integer("TRUSTED_PROXY_HOPS", 0),
  };
}
