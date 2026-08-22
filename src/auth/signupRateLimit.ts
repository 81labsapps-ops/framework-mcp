import rateLimit from "express-rate-limit";

export const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 signups per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Try again later." },
});
