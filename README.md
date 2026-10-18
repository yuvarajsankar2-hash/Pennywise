# Personal Expense Tracker Portal

A responsive, static expense tracker that runs on GitHub Pages with no backend, database service, build step, or server.

## Run locally

Serve the project folder from localhost:

```text
python -m http.server 8765
```

Open `http://localhost:8765`.

## Publish on GitHub Pages

1. Push the project files to the repository's `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose **main** and **/(root)**, then save.
5. Wait for the Pages deployment. GitHub displays the public site URL in the Pages settings.

## Accounts and data storage

Registration, sign-in, and transactions work entirely in the browser. Each account and its expenses are stored in that browser's local storage. Data does not get uploaded to GitHub and is not shared between users, browsers, devices, or computers. Clearing the site's browser data removes the locally stored accounts and transactions. Existing browser-only accounts are preserved when this version runs in the same browser.

GitHub Pages only hosts static files; a GitHub URL cannot act as a private database. Password hashing in the browser is not server-backed authentication. This version is suitable as a local demo or student project, not as a secure multi-user financial service. Do not enter real financial credentials or sensitive personal data.
