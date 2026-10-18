import { neon } from "@neondatabase/serverless";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

function allowedOrigins() {
  return (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function handleCors(req, res) {
  const origin = req.headers.origin;
  const origins = allowedOrigins();
  if (origin && !origins.includes(origin)) {
    res.status(403).json({ error: "This website is not allowed to access the API." });
    return false;
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Token");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  return true;
}

export function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader("Allow", `${method}, OPTIONS`);
  res.status(405).json({ error: "Method not allowed." });
  return false;
}

export function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

export function issueToken(userId) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function authIsConfigured() {
  return typeof process.env.AUTH_SECRET === "string" && process.env.AUTH_SECRET.length >= 32;
}

export function authenticatedUser(req) {
  const token = String(req.headers["x-session-token"] || "");
  if (!/^[A-Za-z0-9_.-]+$/.test(token)) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims.sub !== "string" || !claims.sub || !Number.isInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

export function requireUser(req, res) {
  const userId = authenticatedUser(req);
  if (userId) return userId;
  res.status(401).json({ error: "Your session has expired. Please sign in again." });
  return null;
}

export function normalizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email
  };
}

export function normalizeTransaction(row) {
  return {
    id: row.id,
    date: row.transaction_date instanceof Date
      ? row.transaction_date.toISOString().slice(0, 10)
      : String(row.transaction_date).slice(0, 10),
    type: row.transaction_type,
    reason: row.reason,
    amount: Number(row.amount),
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString()
  };
}
