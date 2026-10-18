import { database, handleCors, normalizeUser, requireMethod, requireUser } from "../../lib/api.js";

export default async function handler(req, res) {
  if (!handleCors(req, res) || !requireMethod(req, res, "GET")) return;
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const sql = database();
    const [user] = await sql`
      SELECT id, username, full_name, email FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (!user) return res.status(401).json({ error: "Account no longer exists. Please sign in again." });
    return res.status(200).json({ user: normalizeUser(user) });
  } catch (error) {
    console.error("Session validation failed:", error);
    return res.status(500).json({ error: "Could not verify your session." });
  }
}
