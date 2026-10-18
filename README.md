# Personal Expense Tracker Portal

A responsive expense tracker with a static GitHub Pages frontend, a Vercel serverless API, and a Neon PostgreSQL database. Passwords are hashed by the API; accounts and transactions persist in Neon and are separated by user.

## 1. Create the Neon database tables

1. Open your Neon project and select **SQL Editor**.
2. Open [`db/schema.sql`](./db/schema.sql) in this project, copy its contents into the editor, and run the script.
3. In Neon, select **Connect** and copy the pooled connection string for your database. Treat it as a password.

The schema creates `users` and `transactions`, with unique usernames, case-insensitive unique email addresses, per-user transaction ownership, and database-level type and amount checks.

## 2. Deploy the API

The API must run on a serverless host because a browser page must not contain the Neon connection string. This project uses Vercel Functions; the browser calls the API, and only the serverless functions connect to Neon.

1. Push this project to a GitHub repository.
2. Import that repository into Vercel. The project root is the repository root; no build command is required.
3. In **Vercel → Project → Settings → Environment Variables**, add:
   - `DATABASE_URL`: your Neon pooled connection string.
   - `AUTH_SECRET`: a new random secret with at least 32 characters. Generate one locally with `python -c "import secrets; print(secrets.token_hex(32))"`; do not reuse your Neon password.
   - `FRONTEND_ORIGINS`: comma-separated website origins, such as `https://YOUR-GITHUB-USERNAME.github.io,http://localhost:8765,http://127.0.0.1:8765`. Origins have no repository path or trailing slash.
4. Deploy or redeploy the Vercel project after setting the variables. Save the resulting API origin (for example, `https://your-project.vercel.app`).

Never put `DATABASE_URL` or `AUTH_SECRET` in `config.js`, frontend JavaScript, GitHub Pages files, or a public GitHub repository. `.env` files are excluded by `.gitignore`; `.env.example` contains placeholders only.

## 3. Connect and publish the GitHub Pages frontend

1. In [`config.js`](./config.js), set `window.PENNYWISE_API_URL` to your Vercel origin, with no trailing slash:

   ```js
   window.PENNYWISE_API_URL = "https://your-project.vercel.app";
   ```

   If the site is served from the same Vercel deployment as the API, leave it as an empty string.
2. Commit and push the change to `config.js`.
3. In GitHub, open the repository's **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose **main** and **/(root)**, then save.
5. Wait for the Pages deployment to finish. GitHub shows the website URL in the Pages settings. Its origin (for example, `https://YOUR-GITHUB-USERNAME.github.io`) must exactly match one of the entries in Vercel's `FRONTEND_ORIGINS`.

## Run the frontend locally

Serve the folder from localhost and add that exact origin to Vercel's `FRONTEND_ORIGINS`:

```text
python -m http.server 8765
```

Then visit `http://localhost:8765`.

## API endpoints

- `POST /api/auth/register` creates a user and returns a short-lived signed session token.
- `POST /api/auth/login` verifies the password and returns a session token.
- `GET /api/auth/session` validates the current session.
- `GET /api/transactions` lists the signed-in user's transactions.
- `POST /api/transactions` saves a transaction for the signed-in user.

Passwords are hashed with bcrypt in the API. The API signs seven-day access tokens using `AUTH_SECRET`, and filters database operations by the authenticated user's ID. The frontend keeps the token in session storage (not the database password or Neon credentials). Sign out clears the browser's current session; existing copied tokens remain valid until expiry, so keep your device private.

## Existing browser-only data

Accounts and expenses entered in the earlier browser-only version are not automatically migrated. They remain in that browser's old local storage and are not uploaded by this version. New registrations and expenses are stored in Neon.

## Free-plan and security notes

Neon Free has usage limits and provider terms can change; keep your own backups of important information. This is a student project, not a production financial service. Do not store real financial credentials or highly sensitive information in it.
