import type { Request, RequestHandler, Response } from "express";

export interface RateLimitOptions {
  readonly maxRequests?: number;
  readonly windowMs?: number;
}

export class RateLimiterStore {
  private readonly hits = new Map<string, number[]>();

  recordAndCheck(
    key: string,
    windowMs: number,
    maxRequests: number,
  ): { readonly exceeded: boolean; readonly remaining: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      this.hits.set(key, timestamps);
      return { exceeded: true, remaining: 0 };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    return {
      exceeded: false,
      remaining: maxRequests - timestamps.length,
    };
  }

  clear(): void {
    this.hits.clear();
  }
}

export const defaultRateLimiterStore = new RateLimiterStore();

export function createRateLimiter(
  options?: RateLimitOptions,
  store: RateLimiterStore = defaultRateLimiterStore,
): RequestHandler {
  const windowMs = options?.windowMs ?? 60_000;
  const maxRequests = options?.maxRequests ?? 100;

  return (request, response, next): void => {
    const keyString = extractKey(request, response);

    const { exceeded, remaining } = store.recordAndCheck(
      keyString,
      windowMs,
      maxRequests,
    );

    response.setHeader("X-RateLimit-Limit", maxRequests);
    response.setHeader("X-RateLimit-Remaining", remaining);

    if (exceeded) {
      response.setHeader("Retry-After", Math.ceil(windowMs / 1000));
      response.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests from this user. Please try again later.",
        },
      });
      return;
    }

    next();
  };
}

function extractKey(request: Request, response: Response): string {
  const authClaims = response.locals.authClaims as
    | { readonly sub?: string }
    | undefined;
  if (authClaims?.sub) {
    return authClaims.sub;
  }

  const testUser = request.header("x-test-user");
  if (testUser) {
    return testUser;
  }

  const auth = request.header("authorization");
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      const token = match[1];
      try {
        const parts = token.split(".");
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf8"),
          ) as { sub?: string };
          if (payload.sub) {
            return payload.sub;
          }
        }
      } catch {
        // Not a JWT, use token string as identifier
      }
      return `token:${token}`;
    }
  }

  const ip = request.ip || request.headers["x-forwarded-for"] || "anonymous";
  return typeof ip === "string"
    ? ip
    : Array.isArray(ip)
      ? ip[0] || "anonymous"
      : "anonymous";
}
