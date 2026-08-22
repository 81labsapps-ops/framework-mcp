import type { Pool } from "pg";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { verifyApiKey } from "./apiKeys.js";

export function apiKeyAuthMiddleware(pool: Pool) {
  return requireBearerAuth({
    verifier: {
      verifyAccessToken: async (token: string) => {
        const key = await verifyApiKey(pool, token);
        if (!key) throw new Error("Invalid or revoked API key");
        return {
          token,
          clientId: key.id,
          scopes: [],
          // Our API keys don't expire on a fixed schedule - revocation is checked
          // fresh on every request via verifyApiKey's revoked_at lookup. The SDK's
          // middleware requires *some* expiresAt though, so we hand back a rolling
          // far-future value rather than a real fixed expiry.
          expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
          extra: { apiKeyId: key.id },
        };
      },
    },
    requiredScopes: [],
  });
}
