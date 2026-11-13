// Helpers used by every page.

// Show a message in a status element (green = ok, red = error)
function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.className = "status " + (isError ? "error" : "ok");
}

// Fill a <select> with options built from database rows
function fillSelect(select, rows, valueKey, labelFn, emptyLabel) {
  select.innerHTML = "";
  if (emptyLabel) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    select.appendChild(empty);
  }
  for (const row of rows) {
    const option = document.createElement("option");
    option.value = row[valueKey];
    option.textContent = labelFn(row);
    select.appendChild(option);
  }
  if (select.hasAttribute("data-searchable")) buildSearchable(select);
}

// ---- Selects you can search by typing ----------------------------
// Add the attribute data-searchable to a <select>. The select stays in the page (hidden) and keeps
// its value, and a text box with a suggestion list is shown in its place.
function matchOption(select, text) {
  const t = text.trim().toLowerCase();
  return [...select.options].find(o => o.value !== "" && o.textContent.trim().toLowerCase() === t);
}

// Shows the text of the selected option in the text box (call it after setting select.value in code)
function syncSearchable(select) {
  const input = select._combo;
  if (!input) return;
  const option = select.selectedOptions[0];
  input.value = option && option.value !== "" ? option.textContent : "";
  input.setCustomValidity("");
}

// Enables or disables a searchable select (its text box is the visible part)
function setSearchableDisabled(select, disabled) {
  select.disabled = disabled;
  if (select._combo) select._combo.disabled = disabled;
}

// The place of a request as text. "Other" shows what the student wrote.
function placeLabel(name, note) {
  return note ? `${name}: ${note}` : name;
}

function buildSearchable(select) {
  if (!select._combo) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = select.id + "-search";
    input.className = "combo";
    input.autocomplete = "off";
    input.setAttribute("list", select.id + "-list");
    const list = document.createElement("datalist");
    list.id = select.id + "-list";
    if (select.required) { input.required = true; select.required = false; }

    input.addEventListener("input", () => {
      const text = input.value.trim();
      if (text === "") {
        select.value = "";
        input.setCustomValidity("");
        select.dispatchEvent(new Event("change"));
        return;
      }
      const hit = matchOption(select, text);
      if (hit) {
        select.value = hit.value;
        input.setCustomValidity("");
        select.dispatchEvent(new Event("change"));
      } else {
        input.setCustomValidity("Choose one of the options from the list.");
      }
    });
    // leaving the box with half-typed text puts the chosen option back
    input.addEventListener("blur", () => syncSearchable(select));

    select.after(input, list);
    select.hidden = true;
    select.tabIndex = -1;
    select._combo = input;
    select._list = list;
    const label = document.querySelector('label[for="' + select.id + '"]');
    if (label) label.setAttribute("for", input.id);
  }

  select._list.innerHTML = "";
  for (const option of select.options) {
    if (option.value === "") continue;
    const entry = document.createElement("option");
    entry.value = option.textContent;
    select._list.appendChild(entry);
  }
  const first = select.options[0];
  select._combo.placeholder = first && first.value === "" ? first.textContent + " (type to search)" : "Type to search";
  syncSearchable(select);
}

// ---- Signing in and out --------------------------------------------
const IDLE_MINUTES = 60;                       // sign out after 1 hour without activity
const ACTIVE_KEY = "studymatch.lastActive";

function markActive() {
  try { localStorage.setItem(ACTIVE_KEY, String(Date.now())); } catch (e) { /* ignore */ }
}

function idleExpired() {
  try {
    const last = Number(localStorage.getItem(ACTIVE_KEY));
    return last > 0 && Date.now() - last > IDLE_MINUTES * 60000;
  } catch (e) { return false; }
}

// Signs out after IDLE_MINUTES without a click, key press, touch or scroll
function startIdleTimer() {
  markActive();
  let lastMark = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastMark > 30000) { lastMark = now; markActive(); }
  };
  for (const name of ["click", "keydown", "touchstart", "scroll", "pointermove"]) {
    window.addEventListener(name, onActivity, { passive: true });
  }
  setInterval(() => { if (idleExpired()) signOut("timeout"); }, 60000);
}

// Removes every stored Supabase login from this browser (both kinds of storage)
function clearStoredSessions() {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of Object.keys(store)) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) store.removeItem(key);
      }
    } catch (e) { /* ignore */ }
  }
}

// Pages that need a logged-in user call this first.
// Not logged in -> go to the login page.
// If "Keep me signed in" was not ticked, the login also ends after 1 hour without activity.
async function requireLogin() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    location.href = "login.html";
    return null;
  }
  if (!keepSignedIn()) {
    if (idleExpired()) {
      await signOut("timeout");
      return null;
    }
    startIdleTimer();
  }
  return data.session;
}

// The id of the profile that belongs to the logged-in user
async function getMyProfileId() {
  const { data, error } = await db.rpc("current_profile_id");
  if (error) throw error;
  return data;                      // null if the profile row does not exist
}

async function signOut(reason) {
  try { await db.auth.signOut({ scope: "local" }); } catch (e) { /* ignore */ }
  clearStoredSessions();
  location.href = "login.html" + (reason ? "?notice=" + reason : "");
}

// Folder of the images, icons and sounds
const ASSET_BASE = "assets/";

// ---- Formatting helpers --------------------------------------
function formatWhen(iso) {
  return new Date(iso).toLocaleString([], {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

function formatDuration(min) {
  if (min < 60) return `${min} min`;
  return min % 60 === 0 ? `${min / 60} h` : `${(min / 60).toFixed(1)} h`;
}

// A clickable Telegram link, or null if the username looks wrong
function telegramAnchor(username) {
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username || "")) return null;
  const a = document.createElement("a");
  a.href = "https://t.me/" + username;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "@" + username;
  return a;
}

// ---- Navigation: sign-out button in the header + tab bar at the bottom ----
const NAV_ITEMS = [
  { id: "swipe",   href: "swipe.html",   icon: "\u21C4", label: "Swipe" },
  { id: "browse",  href: "browse.html",  icon: "\u2630", label: "Browse" },
  { id: "create",  href: "create.html",  icon: "+",       label: "Create" },
  { id: "matches", href: "matches.html", icon: "\u2714", label: "Sessions" },
  { id: "profile", href: "profile.html", icon: "\u25CF", label: "Profile" }
];

// An icon from the SVG sprite (decorative: the text label next to it says the same)
function svgIcon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "icon-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", ASSET_BASE + "icons.svg#" + name);
  svg.appendChild(use);
  return svg;
}

// One short message for each kind of notification
const NOTE_TEXT = {
  new_request: "A new request is available.",
  request_accepted: "Someone accepted your request. Open Sessions to confirm them.",
  request_confirmed: "Your request was confirmed. Open Sessions for the Telegram link.",
  request_declined: "An owner declined your request.",
  request_not_chosen: "The owner chose another student for a request you accepted.",
  session_cancelled: "A session or request was cancelled. Open Sessions for details.",
  session_reminder_24h: "Reminder: you have a study session within 24 hours.",
  session_reminder_1h: "Reminder: your study session starts within an hour."
};

// ---- Notification message on screen + optional sound ------------
// The message always appears. The sound is ON by default and can be switched off in the profile.
const SOUND_KEY = "studymatch.sound";
function soundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { return true; }
}
function setSoundEnabled(on) {
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch (e) { /* ignore */ }
}
function playChime() {
  new Audio(ASSET_BASE + "notify.mp3").play().catch(() => { /* blocked by the browser: ignore */ });
}

let toastBox = null;
let toastTimer = null;
function showToast(text) {
  if (!toastBox) return;
  toastBox.textContent = "";
  const message = document.createElement("span");
  message.textContent = text;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => { toastBox.hidden = true; });
  toastBox.append(message, close);
  toastBox.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastBox.hidden = true; }, 10000);
}

// ---- Notifications panel (the bell in the top bar) ----------------
async function openNotifications() {
  let dlg = document.getElementById("notesDialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "notesDialog";
    dlg.setAttribute("aria-labelledby", "notesTitle");
    const title = document.createElement("h2");
    title.id = "notesTitle";
    title.textContent = "Notifications";
    const ul = document.createElement("ul");
    ul.id = "notesList";
    ul.className = "people";
    const actions = document.createElement("div");
    actions.className = "actions";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "secondary";
    close.textContent = "Close";
    close.addEventListener("click", () => dlg.close());
    const sessions = document.createElement("a");
    sessions.href = "matches.html";
    sessions.className = "button-link";
    sessions.textContent = "Open Sessions";
    actions.append(close, sessions);
    dlg.append(title, ul, actions);
    document.body.appendChild(dlg);
  }
  const list = dlg.querySelector("#notesList");
  list.textContent = "Loading...";
  dlg.showModal();

  const { data, error } = await db.from("notifications")
    .select("notification_id, type, is_read, created_at")
    .order("created_at", { ascending: false }).limit(20);
  list.textContent = "";
  if (error) {
    list.textContent = "Could not load notifications: " + error.message;
    return;
  }
  if (data.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No notifications yet.";
    list.appendChild(li);
  }
  for (const n of data) {
    const li = document.createElement("li");
    const text = document.createElement("div");
    text.textContent = (NOTE_TEXT[n.type] || "Notification") + (n.is_read ? "" : " (new)");
    const when = document.createElement("div");
    when.className = "hint";
    when.textContent = formatWhen(n.created_at);
    li.append(text, when);
    list.appendChild(li);
  }

  // opening the panel counts as reading the notifications
  await db.from("notifications").update({ is_read: true }).eq("is_read", false);
  if (window.refreshNavBadge) window.refreshNavBadge();
}

function renderNav(active, myId) {
  // empty "live region" is created first, so screen readers announce the message later
  toastBox = document.createElement("div");
  toastBox.className = "toast";
  toastBox.setAttribute("role", "status");
  toastBox.setAttribute("aria-live", "polite");
  toastBox.hidden = true;
  document.body.appendChild(toastBox);

  // top bar: notifications bell, theme button, sign out
  const actions = document.createElement("div");
  actions.className = "header-actions";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.hidden = true;
  badge.setAttribute("aria-hidden", "true");
  const bell = document.createElement("button");
  bell.type = "button";
  bell.className = "icon-btn";
  bell.setAttribute("aria-label", "Notifications");
  bell.title = "Notifications";
  bell.append(svgIcon("i-bell"), badge);
  bell.addEventListener("click", openNotifications);

  const signOutButton = document.createElement("button");
  signOutButton.type = "button";
  signOutButton.className = "signout";
  signOutButton.textContent = "Sign out";
  signOutButton.addEventListener("click", () => signOut());

  actions.append(bell, createThemeButton(), signOutButton);
  document.querySelector("header").appendChild(actions);

  const nav = document.createElement("nav");
  nav.className = "tabbar";
  nav.setAttribute("aria-label", "Main");

  for (const item of NAV_ITEMS) {
    const link = document.createElement("a");
    link.href = item.href;
    if (item.id === active) link.setAttribute("aria-current", "page");
    const icon = svgIcon("i-" + item.id);
    const label = document.createElement("span");
    label.textContent = item.label;
    link.append(icon, label);
    nav.appendChild(link);
  }
  document.body.appendChild(nav);
  document.body.classList.add("has-tabbar");

  // number of unread notifications on the bell, updated live
  async function refreshBadge() {
    const { count } = await db.from("notifications")
      .select("notification_id", { count: "exact", head: true }).eq("is_read", false);
    badge.hidden = !count;
    badge.textContent = count || "";
    bell.setAttribute("aria-label", count ? `Notifications, ${count} new` : "Notifications");
  }
  window.refreshNavBadge = refreshBadge;
  refreshBadge();
  if (myId) {
    db.channel("notes-" + myId)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${myId}` },
          payload => {
            refreshBadge();
            const text = payload.new && NOTE_TEXT[payload.new.type];
            if (text) {
              showToast(text);
              if (soundEnabled()) playChime();
            }
          })
      .subscribe();
  }
}
