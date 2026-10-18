(() => {
  "use strict";

  const DB_KEY = "pennywise-data-v1";
  const SESSION_KEY = "pennywise-session-v1";
  const ITERATIONS = 150000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const authScreen = $("#auth-screen");
  const appShell = $("#app-shell");
  const content = $("#view-content");
  let database;
  let currentUser;
  let currentView = "home";
  let transactionPage = 1;
  let messageTimeout;

  function loadDatabase() {
    const stored = localStorage.getItem(DB_KEY);
    if (!stored) return { users: [], transactions: {} };
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.users) || !parsed.transactions || typeof parsed.transactions !== "object") {
      throw new Error("Saved browser data is not in the expected format. Clear this site's browser storage to start fresh.");
    }
    for (const user of parsed.users) {
      if (!user.fullName && user.fullname) user.fullName = user.fullname;
    }
    return parsed;
  }

  function saveDatabase() {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function todayIso() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  function formatDate(isoDate) {
    const [year, month, day] = isoDate.split("-");
    return `${day}-${month}-${year}`;
  }

  function formatLongDate(date = new Date()) {
    return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
  }

  function getTransactions() {
    return database.transactions[currentUser.username] || [];
  }

  function sortedTransactions(transactions = getTransactions()) {
    return transactions.map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.date.localeCompare(a.item.date) || b.item.createdAt.localeCompare(a.item.createdAt) || b.index - a.index)
      .map(entry => entry.item);
  }

  function filterByDates(transactions, from, to) {
    return transactions.filter(item => (!from || item.date >= from) && (!to || item.date <= to));
  }

  function sumType(transactions, type) {
    return transactions.filter(item => item.type === type).reduce((total, item) => total + item.amount, 0);
  }

  function dateRangeIsValid(from, to) {
    return !from || !to || from <= to;
  }

  function dateInputMarkup(id, label, value) {
    return `<div class="filter-field"><label for="${id}">${label}</label><input id="${id}" type="date" value="${value}" aria-label="${label}"></div>`;
  }

  function transactionMarkup(item) {
    const debit = item.type === "Debit";
    return `<tr>
      <td>${formatDate(item.date)}</td>
      <td><span class="type-badge ${debit ? "debit" : "credit"}">${debit ? "↗" : "↙"} ${item.type}</span></td>
      <td><div class="reason-cell"><span class="reason-icon">${debit ? "−" : "+"}</span>${escapeHtml(item.reason)}</div></td>
      <td class="amount-cell ${debit ? "debit-text" : "credit-text"}">${debit ? "−" : "+"}${formatCurrency(item.amount)}</td>
    </tr>`;
  }

  function transactionTable(transactions, options = {}) {
    if (!transactions.length) {
      return `<div class="empty-state ${options.dashboard ? "dashboard-empty" : ""}">
        <span class="empty-icon">↗</span>
        <strong>${options.filtered ? "No transactions found" : "Nothing here just yet"}</strong>
        <p>${options.filtered ? "Try a different date range, or clear the filters to see all your entries." : "Add your first transaction and it will show up here."}</p>
        ${options.noButton ? "" : `<button class="button button-primary" type="button" data-view="add">＋ Add a transaction</button>`}
      </div>`;
    }
    return `<div class="table-scroll"><table class="transaction-table">
      <thead><tr><th>Date</th><th>Type</th><th>Reason</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${transactions.map(transactionMarkup).join("")}</tbody>
    </table></div>`;
  }

  function renderHome() {
    const all = sortedTransactions();
    const month = todayIso().slice(0, 7);
    const currentMonth = all.filter(item => item.date.startsWith(month));
    const recent = all.slice(0, 5);
    const balance = sumType(currentMonth, "Credit") - sumType(currentMonth, "Debit");
    content.innerHTML = `
      <section class="page-heading welcome-heading">
        <div><span class="section-eyebrow">YOUR MONEY, AT A GLANCE</span>
          <h1>Good to see you, ${escapeHtml(currentUser.fullName.split(/\s+/)[0])} <span aria-hidden="true">✳</span></h1>
          <p>A little check-in with your finances goes a long way.</p></div>
        <button class="button button-primary" type="button" data-view="add">＋ Add expense</button>
      </section>
      <section class="summary-grid" aria-label="This month's totals">
        <article class="summary-card"><div class="summary-top"><span>This month's balance</span><span class="summary-icon balance">↗</span></div><div class="summary-value">${formatCurrency(balance)}</div><div class="summary-caption">Credits minus debits · ${new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date())}</div></article>
        <article class="summary-card"><div class="summary-top"><span>Money out</span><span class="summary-icon debit">↗</span></div><div class="summary-value">${formatCurrency(sumType(currentMonth, "Debit"))}</div><div class="summary-caption">${currentMonth.filter(item => item.type === "Debit").length} debit ${currentMonth.filter(item => item.type === "Debit").length === 1 ? "transaction" : "transactions"} this month</div></article>
        <article class="summary-card"><div class="summary-top"><span>Money in</span><span class="summary-icon credit">↙</span></div><div class="summary-value">${formatCurrency(sumType(currentMonth, "Credit"))}</div><div class="summary-caption">${currentMonth.filter(item => item.type === "Credit").length} credit ${currentMonth.filter(item => item.type === "Credit").length === 1 ? "transaction" : "transactions"} this month</div></article>
      </section>
      <section class="content-card">
        <div class="card-heading"><div><h2>Recent transactions</h2><p>Your latest money moves, all in one place.</p></div><button class="inline-link" type="button" data-view="transactions">See all transactions&nbsp; →</button></div>
        ${transactionTable(recent, { noButton: true })}
      </section>`;
  }

  function renderTransactions() {
    const all = sortedTransactions();
    const from = $("#transaction-from")?.value || "";
    const to = $("#transaction-to")?.value || "";
    const filtered = filterByDates(all, from, to);
    const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
    transactionPage = Math.min(transactionPage, totalPages);
    const pageItems = filtered.slice((transactionPage - 1) * 10, transactionPage * 10);
    const hasFilter = Boolean(from || to);
    content.innerHTML = `
      <section class="page-heading"><div><span class="section-eyebrow">YOUR MONEY, YOUR RECORD</span><h1>Transactions</h1><p>Every debit and credit, in one tidy list.</p></div>
        <button class="button button-primary" type="button" data-view="add">＋ Add expense</button></section>
      <section class="content-card">
        <div class="card-heading"><div><h2>All transactions</h2><p>Showing up to 10 entries per page.</p></div></div>
        <form id="transaction-filter" class="filter-bar">
          ${dateInputMarkup("transaction-from", "From date", from)}
          ${dateInputMarkup("transaction-to", "To date", to)}
          <div class="filter-actions"><button class="button button-primary" type="submit">Apply filter</button><button class="button button-secondary" type="button" id="clear-transaction-filter">Clear</button></div>
        </form>
        <div class="filter-summary"><span>${filtered.length} ${filtered.length === 1 ? "transaction" : "transactions"}${hasFilter ? " in selected date range" : ""}</span></div>
        ${transactionTable(pageItems, { filtered: hasFilter })}
        ${filtered.length ? `<div class="pagination"><span>Showing ${(transactionPage - 1) * 10 + 1}–${Math.min(transactionPage * 10, filtered.length)} of ${filtered.length}</span>
          <div class="pagination-controls"><button type="button" data-page="${transactionPage - 1}" aria-label="Previous page" ${transactionPage === 1 ? "disabled" : ""}>‹</button>
          <button class="page-number current-page" type="button" aria-current="page">${transactionPage}</button>
          <button type="button" data-page="${transactionPage + 1}" aria-label="Next page" ${transactionPage === totalPages ? "disabled" : ""}>›</button></div></div>` : ""}
      </section>`;
    $("#transaction-filter").addEventListener("submit", event => {
      event.preventDefault();
      const start = $("#transaction-from").value;
      const end = $("#transaction-to").value;
      if (!dateRangeIsValid(start, end)) {
        showMessage("From date must be on or before the to date.", true);
        return;
      }
      transactionPage = 1;
      renderTransactions();
    });
    $("#clear-transaction-filter").addEventListener("click", () => {
      transactionPage = 1;
      $("#transaction-from").value = "";
      $("#transaction-to").value = "";
      renderTransactions();
    });
    $$(".pagination-controls [data-page]").forEach(button => button.addEventListener("click", () => {
      transactionPage = Number(button.dataset.page);
      renderTransactions();
    }));
  }

  function chartModel(transactions, from, to) {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const bucketCount = Math.min(7, days);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(start.getTime() + Math.floor(index * days / bucketCount) * 86400000);
      const bucketEnd = new Date(start.getTime() + (Math.floor((index + 1) * days / bucketCount) - 1) * 86400000);
      return {
        start: `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, "0")}-${String(bucketStart.getDate()).padStart(2, "0")}`,
        end: `${bucketEnd.getFullYear()}-${String(bucketEnd.getMonth() + 1).padStart(2, "0")}-${String(bucketEnd.getDate()).padStart(2, "0")}`,
        label: days <= 7 ? `${bucketStart.getDate()} ${new Intl.DateTimeFormat("en-IN", { month: "short" }).format(bucketStart)}` : days <= 31 ? `${bucketStart.getDate()}–${bucketEnd.getDate()}` : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(bucketStart),
        debit: 0, credit: 0
      };
    });
    for (const item of transactions) {
      const bucket = buckets.find(candidate => item.date >= candidate.start && item.date <= candidate.end);
      if (bucket) bucket[item.type.toLowerCase()] += item.amount;
    }
    const max = Math.max(1, ...buckets.flatMap(bucket => [bucket.debit, bucket.credit]));
    const tickValues = [max, max * .66, max * .33, 0];
    const compactCurrency = value => value >= 100000 ? `${(value / 100000).toFixed(value >= 1000000 ? 0 : 1)}L` : value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : `${Math.round(value)}`;
    return { buckets, max, ticks: tickValues.map(compactCurrency) };
  }

  function renderDashboard() {
    const from = $("#dashboard-from")?.value || `${todayIso().slice(0, 7)}-01`;
    const to = $("#dashboard-to")?.value || todayIso();
    const selected = filterByDates(sortedTransactions(), from, to);
    const debit = sumType(selected, "Debit");
    const credit = sumType(selected, "Credit");
    const model = chartModel(selected, from, to);
    const max = model.max;
    const chartGroups = model.buckets.map(bucket => `<div class="chart-group" title="${escapeHtml(bucket.label)} · Out ${formatCurrency(bucket.debit)} · In ${formatCurrency(bucket.credit)}">
      <span class="chart-bar" style="height:${Math.max(bucket.debit ? 3 : 0, bucket.debit / max * 100)}%"></span>
      <span class="chart-bar credit" style="height:${Math.max(bucket.credit ? 3 : 0, bucket.credit / max * 100)}%"></span></div>`).join("");
    const chartLabels = model.buckets.map(bucket => `<span>${escapeHtml(bucket.label)}</span>`).join("");
    const recent = sortedTransactions(selected).slice(0, 5);
    content.innerHTML = `
      <section class="page-heading"><div><span class="section-eyebrow">THE BIGGER PICTURE</span><h1>Your dashboard</h1><p>A clear view of your money over time.</p></div></section>
      <section class="content-card">
        <form id="dashboard-filter" class="filter-bar">
          ${dateInputMarkup("dashboard-from", "From date", from)}
          ${dateInputMarkup("dashboard-to", "To date", to)}
          <div class="filter-actions"><button class="button button-primary" type="submit">Apply filter</button><button class="button button-secondary" type="button" id="reset-dashboard-filter">This month</button></div>
        </form>
      </section>
      <section class="summary-grid" style="margin-top:16px" aria-label="Selected period totals">
        <article class="summary-card"><div class="summary-top"><span>Net balance</span><span class="summary-icon balance">↗</span></div><div class="summary-value">${formatCurrency(credit - debit)}</div><div class="summary-caption">Money in minus money out</div></article>
        <article class="summary-card"><div class="summary-top"><span>Total money out</span><span class="summary-icon debit">↗</span></div><div class="summary-value">${formatCurrency(debit)}</div><div class="summary-caption">${selected.filter(item => item.type === "Debit").length} debit transactions</div></article>
        <article class="summary-card"><div class="summary-top"><span>Total money in</span><span class="summary-icon credit">↙</span></div><div class="summary-value">${formatCurrency(credit)}</div><div class="summary-caption">${selected.filter(item => item.type === "Credit").length} credit transactions</div></article>
      </section>
      <section class="dashboard-grid">
        <article class="content-card chart-card"><div class="chart-heading"><div><h2>Money flow</h2><p>Debits and credits across the selected period</p></div><div class="chart-legend"><span><i class="legend-dot"></i>Out</span><span><i class="legend-dot credit"></i>In</span></div></div>
          <div class="chart"><div class="chart-y-axis">${model.ticks.map(tick => `<span>${tick}</span>`).join("")}</div><div class="chart-plot">${chartGroups}</div></div>
          <div class="chart-x-axis">${chartLabels}</div></article>
        <article class="content-card breakdown-card"><h2>Period summary</h2><p>${escapeHtml(formatDate(from))} — ${escapeHtml(formatDate(to))}</p>
          <div class="breakdown-row"><div class="breakdown-line"><span>Money out</span><strong>${formatCurrency(debit)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${debit + credit ? debit / (debit + credit) * 100 : 0}%"></div></div></div>
          <div class="breakdown-row"><div class="breakdown-line"><span>Money in</span><strong>${formatCurrency(credit)}</strong></div><div class="progress-track"><div class="progress-fill credit-fill" style="width:${debit + credit ? credit / (debit + credit) * 100 : 0}%"></div></div></div>
          <div class="breakdown-total"><span>Transactions in period</span><strong>${selected.length}</strong></div></article>
      </section>
      <section class="content-card dashboard-recent"><div class="card-heading"><div><h2>Recent in this period</h2><p>Your latest entries within the selected dates.</p></div><button class="inline-link" type="button" data-view="transactions">All transactions&nbsp; →</button></div>${transactionTable(recent, { noButton: true, filtered: Boolean(selected.length === 0 && getTransactions().length), dashboard: true })}</section>`;
    $("#dashboard-filter").addEventListener("submit", event => {
      event.preventDefault();
      const start = $("#dashboard-from").value;
      const end = $("#dashboard-to").value;
      if (!dateRangeIsValid(start, end)) {
        showMessage("From date must be on or before the to date.", true);
        return;
      }
      renderDashboard();
    });
    $("#reset-dashboard-filter").addEventListener("click", () => {
      $("#dashboard-from").value = `${todayIso().slice(0, 7)}-01`;
      $("#dashboard-to").value = todayIso();
      renderDashboard();
    });
  }

  function renderAddExpense() {
    content.innerHTML = `
      <section class="page-heading"><div><span class="section-eyebrow">A QUICK MONEY NOTE</span><h1>Add a transaction</h1><p>Keep track of every little thing that moves your money.</p></div></section>
      <section class="add-layout">
        <form id="expense-form" class="content-card form-card">
          <h2>Transaction details</h2><p>Fields marked with * are required.</p>
          <div class="expense-form">
            <div class="form-field"><label for="expense-date">Date <span>*</span></label><input id="expense-date" name="date" type="text" inputmode="numeric" autocomplete="off" placeholder="DD-MM-YYYY" pattern="(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-[0-9]{4}" value="${formatDate(todayIso())}" required aria-describedby="date-hint"><span id="date-hint" class="field-hint">Enter date as DD-MM-YYYY</span></div>
            <div class="form-field"><label for="expense-type">Transaction type <span>*</span></label><select id="expense-type" name="type" required><option value="Debit">Debit · money out</option><option value="Credit">Credit · money in</option></select></div>
            <div class="form-field full-width"><label for="expense-reason">Reason <span>*</span></label><input id="expense-reason" name="reason" maxlength="120" required placeholder="What was this transaction for?"></div>
            <div class="form-field full-width"><label for="expense-amount">Amount in rupees <span>*</span></label><div class="amount-wrap"><span>₹</span><input id="expense-amount" name="amount" type="number" min="0.01" max="999999999.99" step="0.01" inputmode="decimal" required placeholder="0.00"></div><span class="field-hint">Enter an amount greater than zero.</span></div>
          </div>
          <div id="expense-error" class="form-error" role="alert"></div>
          <div class="form-actions"><button class="button button-primary" type="submit">Save transaction&nbsp; →</button><button class="button button-secondary" type="button" data-view="home">Cancel</button></div>
        </form>
        <aside class="form-side-note"><span class="note-glyph">✦</span><strong>It's the little things</strong><p>A quick note today can give you a clearer picture of your spending habits over time. Add both expenses and income to make your dashboard more useful.</p><div class="privacy-line">◉ &nbsp;Your entries are saved to your online account.</div></aside>
      </section>`;
    $("#expense-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const dateParts = $("#expense-date").value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
      const error = $("#expense-error");
      error.textContent = "";
      if (!dateParts) {
        error.textContent = "Please enter the date in DD-MM-YYYY format.";
        return;
      }
      const [, day, month, year] = dateParts;
      const date = `${year}-${month}-${day}`;
      const parsedDate = new Date(`${date}T00:00:00`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.getFullYear() !== Number(year) || parsedDate.getMonth() + 1 !== Number(month) || parsedDate.getDate() !== Number(day)) {
        error.textContent = "Please enter a real calendar date.";
        return;
      }
      const amount = Number($("#expense-amount").value);
      const reason = $("#expense-reason").value.trim();
      if (!reason) {
        error.textContent = "Please enter a reason for this transaction.";
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999.99) {
        error.textContent = "Please enter an amount greater than zero.";
        return;
      }
      const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date, type: $("#expense-type").value, reason, amount: Math.round(amount * 100) / 100,
        createdAt: new Date().toISOString()
      };
      if (!database.transactions[currentUser.username]) database.transactions[currentUser.username] = [];
      database.transactions[currentUser.username].push(entry);
      try {
        saveDatabase();
      } catch (saveError) {
        database.transactions[currentUser.username].pop();
        error.textContent = `Could not save your transaction in this browser: ${saveError.message}`;
        return;
      }
      form.reset();
      showMessage("Transaction saved. Nice and simple!");
      navigate("home");
    });
  }

  function updateShell() {
    $("#profile-name").textContent = currentUser.fullName;
    $("#profile-email").textContent = currentUser.email;
    const initial = currentUser.username.trim().charAt(0).toUpperCase();
    $("#profile-avatar").textContent = initial;
    $("#account-menu-button").textContent = initial;
    $("#account-menu-button").setAttribute("aria-label", `Account options for ${currentUser.fullName}`);
    $("#menu-profile-name").textContent = currentUser.fullName;
    $("#menu-profile-username").textContent = `@${currentUser.username}`;
    $("#topbar-date").textContent = formatLongDate();
  }

  function navigate(view) {
    currentView = view;
    const names = { home: "Home", dashboard: "Dashboard", transactions: "Transactions", add: "Add transaction" };
    $("#breadcrumb-current").textContent = names[view] || "Home";
    $$(".nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view || (view === "add" && button.dataset.view === "transactions"));
    });
    if (view === "dashboard") renderDashboard();
    else if (view === "transactions") { transactionPage = 1; renderTransactions(); }
    else if (view === "add") renderAddExpense();
    else renderHome();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showMessage(message, isError = false) {
    const element = $("#app-message");
    element.textContent = message;
    element.classList.toggle("error-message", isError);
    element.classList.add("visible");
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => element.classList.remove("visible"), 3800);
  }

  function showAuthenticatedApp(user) {
    currentUser = user;
    authScreen.hidden = true;
    appShell.hidden = false;
    updateShell();
    navigate("home");
  }

  function showAuthView(view) {
    const isRegister = view === "register";
    $("#login-form-panel").hidden = isRegister;
    $("#register-form-panel").hidden = !isRegister;
    $("#login-error").textContent = "";
    $("#register-error").textContent = "";
  }

  async function hashPassword(password, salt) {
    if (!globalThis.crypto?.subtle) throw new Error("Secure password hashing is unavailable. Open this site over HTTPS or on localhost.");
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: "SHA-256" }, keyMaterial, 256);
    return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function makeSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function setFormBusy(form, busy) {
    const button = $('button[type="submit"]', form);
    button.disabled = busy;
    button.style.opacity = busy ? ".65" : "";
  }

  function closeAccountMenu() {
    $("#account-menu-panel").hidden = true;
    $("#account-menu-button").setAttribute("aria-expanded", "false");
  }

  function logOut() {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    appShell.hidden = true;
    authScreen.hidden = false;
    closeAccountMenu();
    showAuthView("login");
  }

  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = $("#login-error");
    error.textContent = "";
    setFormBusy(form, true);
    try {
      const username = form.elements.username.value.trim().toLowerCase();
      const user = database.users.find(item => item.username === username);
      if (!user || await hashPassword(form.elements.password.value, user.salt) !== user.passwordHash) {
        error.textContent = "That username and password don't match. Please try again.";
        return;
      }
      localStorage.setItem(SESSION_KEY, user.username);
      form.reset();
      showAuthenticatedApp(user);
    } catch (loginError) {
      error.textContent = loginError.message || "Could not sign in. Please try again.";
    } finally {
      setFormBusy(form, false);
    }
  });

  $("#register-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = $("#register-error");
    error.textContent = "";
    setFormBusy(form, true);
    try {
      const username = form.elements.username.value.trim().toLowerCase();
      const fullName = form.elements.fullname.value.trim();
      const email = form.elements.email.value.trim();
      if (database.users.some(user => user.username === username)) {
        error.textContent = "That username is already taken. Try another one.";
        return;
      }
      if (database.users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
        error.textContent = "That email address is already registered.";
        return;
      }
      const salt = makeSalt();
      const passwordHash = await hashPassword(form.elements.password.value, salt);
      const user = { username, fullName, email, salt, passwordHash };
      database.users.push(user);
      database.transactions[username] = [];
      try {
        saveDatabase();
      } catch (saveError) {
        database.users.pop();
        delete database.transactions[username];
        throw new Error(`Could not save your account in this browser: ${saveError.message}`);
      }
      localStorage.setItem(SESSION_KEY, user.username);
      form.reset();
      showAuthenticatedApp(user);
      showMessage("Your account is ready. Welcome to Pennywise!");
    } catch (registerError) {
      error.textContent = registerError.message || "Could not create your account. Please try again.";
    } finally {
      setFormBusy(form, false);
    }
  });

  $$("[data-auth-view]").forEach(button => button.addEventListener("click", () => showAuthView(button.dataset.authView)));
  $("#account-menu-button").addEventListener("click", () => {
    const panel = $("#account-menu-panel");
    const isOpening = panel.hidden;
    panel.hidden = !isOpening;
    $("#account-menu-button").setAttribute("aria-expanded", String(isOpening));
  });
  $("#change-password-button").addEventListener("click", () => {
    closeAccountMenu();
    $("#password-error").textContent = "";
    $("#password-form").reset();
    $("#password-dialog").showModal();
    $("#current-password").focus();
  });
  $("#cancel-password-button").addEventListener("click", () => $("#password-dialog").close());
  $("#password-dialog").addEventListener("close", () => {
    $("#password-form").reset();
    $("#password-error").textContent = "";
  });
  $("#password-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = $("#password-error");
    error.textContent = "";
    setFormBusy(form, true);
    try {
      const currentPassword = form.elements.currentPassword.value;
      const newPassword = form.elements.newPassword.value;
      const confirmPassword = form.elements.confirmPassword.value;
      if (newPassword.length < 8) {
        error.textContent = "Your new password must be at least 8 characters.";
        return;
      }
      if (newPassword !== confirmPassword) {
        error.textContent = "The new passwords do not match.";
        return;
      }
      if (await hashPassword(currentPassword, currentUser.salt) !== currentUser.passwordHash) {
        error.textContent = "Your current password is incorrect.";
        return;
      }
      const previousSalt = currentUser.salt;
      const previousHash = currentUser.passwordHash;
      currentUser.salt = makeSalt();
      currentUser.passwordHash = await hashPassword(newPassword, currentUser.salt);
      try {
        saveDatabase();
      } catch (saveError) {
        currentUser.salt = previousSalt;
        currentUser.passwordHash = previousHash;
        throw new Error(`Could not save your new password in this browser: ${saveError.message}`);
      }
      $("#password-dialog").close();
      showMessage("Your password has been changed.");
    } catch (changeError) {
      error.textContent = changeError.message || "Could not change your password. Please try again.";
    } finally {
      setFormBusy(form, false);
    }
  });
  $("#logout-button").addEventListener("click", logOut);
  document.addEventListener("click", event => {
    if (!event.target.closest(".account-menu")) closeAccountMenu();
    const button = event.target.closest("[data-view]");
    if (button) {
      event.preventDefault();
      navigate(button.dataset.view);
    }
  });

  try {
    database = loadDatabase();
    const sessionUsername = localStorage.getItem(SESSION_KEY);
    const sessionUser = database.users.find(user => user.username === sessionUsername);
    if (sessionUser) showAuthenticatedApp(sessionUser);
  } catch (error) {
    $("#storage-notice").textContent = error.message;
    $("#storage-notice").classList.add("form-error");
  }
})();
