import bcrypt from "bcryptjs";
import { database, getBody, handleCors, issueToken, normalizeUser, requireMethod } from "../../lib/api.js";

export default async function handler(req, res) {
  if (!handleCors(req, res) || !requireMethod(req, res, "POST")) return;
  const body = getBody(req);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || password.length > 72) {
    return res.status(400).json({ error: "Enter your username and password." });
  }

  try {
    const sql = database();
    const [user] = await sql`
      SELECT id, username, full_name, email, password_hash
      FROM users WHERE username = ${username} LIMIT 1
    `;
    const valid = user && await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "That username and password don't match. Please try again." });
    return res.status(200).json({ user: normalizeUser(user), token: issueToken(user.id) });
  } catch (error) {
    console.error("Account sign-in failed:", error);
    return res.status(500).json({ error: "Could not sign in. Check the database setup and try again." });
  }
}
