import { z } from "zod";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import { generateApiKey, hashApiKey } from "../auth/apiKeys.js";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

export function signupHandler(db: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    const { email } = parsed.data;

    const { raw, prefix } = generateApiKey();
    const hash = hashApiKey(raw);

    try {
      await db.query(
        `INSERT INTO api_keys (key_prefix, key_hash, owner_email, label) VALUES ($1, $2, $3, 'self-signup')`,
        [prefix, hash, email]
      );
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        res.status(409).json({ error: "An API key already exists for this email" });
        return;
      }
      throw err;
    }

    res.status(201).json({
      apiKey: raw,
      prefix,
      message: "Save this key now - it will not be shown again.",
    });
  };
}
