import {
  database, getBody, handleCors, normalizeTransaction, requireUser
} from "../lib/api.js";

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default async function handler(req, res) {
  if (!handleCors(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const sql = database();
    if (req.method === "GET") {
      const rows = await sql`
        SELECT id, transaction_date, transaction_type, reason, amount, created_at
        FROM transactions
        WHERE user_id = ${userId}
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT 10000
      `;
      return res.status(200).json({ transactions: rows.map(normalizeTransaction) });
    }

    const body = getBody(req);
    const date = body?.date;
    const type = body?.type;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
    if (!validDate(date)) return res.status(400).json({ error: "Enter a real transaction date." });
    if (type !== "Debit" && type !== "Credit") return res.status(400).json({ error: "Transaction type must be Debit or Credit." });
    if (!reason || reason.length > 120) return res.status(400).json({ error: "Reason must be between 1 and 120 characters." });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return res.status(400).json({ error: "Enter an amount greater than zero." });

    const [row] = await sql`
      INSERT INTO transactions (user_id, transaction_date, transaction_type, reason, amount)
      VALUES (${userId}, ${date}, ${type}, ${reason}, ${Math.round(amount * 100) / 100})
      RETURNING id, transaction_date, transaction_type, reason, amount, created_at
    `;
    return res.status(201).json({ transaction: normalizeTransaction(row) });
  } catch (error) {
    console.error("Transaction request failed:", error);
    return res.status(500).json({ error: "Could not load or save transactions. Check the database setup and try again." });
  }
}
