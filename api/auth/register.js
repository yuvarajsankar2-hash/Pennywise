import bcrypt from "bcryptjs";
import {
  authIsConfigured, database, getBody, handleCors, issueToken, normalizeUser, requireMethod, validEmail
} from "../../lib/api.js";

export default async function handler(req, res) {
  if (!handleCors(req, res) || !requireMethod(req, res, "POST")) return;
  const body = getBody(req);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3–24 characters: letters, numbers, dots, dashes, or underscores." });
  }
  if (!fullName || fullName.length > 70 || !validEmail(email)) {
    return res.status(400).json({ error: "Enter a valid full name and email address." });
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ error: "Password must be at least 8 characters and no more than 72 bytes." });
  }
  if (!authIsConfigured()) {
    return res.status(500).json({ error: "The API administrator has not configured AUTH_SECRET." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const sql = database();
    const [user] = await sql`
      INSERT INTO users (username, full_name, email, password_hash)
      VALUES (${username}, ${fullName}, ${email}, ${passwordHash})
      RETURNING id, username, full_name, email
    `;
    return res.status(201).json({ user: normalizeUser(user), token: issueToken(user.id) });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That username or email address is already registered." });
    }
    console.error("Account registration failed:", error);
    return res.status(500).json({ error: "Could not create your account. Check the database setup and try again." });
  }
}
