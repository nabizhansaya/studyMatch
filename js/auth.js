function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.className = "status " + (isError ? "error" : "ok");
}


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
}


async function requireLogin() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    location.href = "login.html";
    return null;
  }
  return data.session;
}


async function getMyProfileId() {
  const { data, error } = await db.rpc("current_profile_id");
  if (error) throw error;
  return data;
}

async function signOut() {
  await db.auth.signOut();
  location.href = "login.html";
}


const ASSET_BASE = "assets/";


function formatWhen(iso) {
  return new Date(iso).toLocaleString([], {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

function formatDuration(min) {
  if (min < 60) return `${min} min`;
  return min % 60 === 0 ? `${min / 60} h` : `${(min / 60).toFixed(1)} h`;
}


function telegramAnchor(username) {
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username || "")) return null;
  const a = document.createElement("a");
  a.href = "https://t.me/" + username;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "@" + username;
  return a;
}


const NAV_ITEMS = [
  { id: "swipe",   href: "swipe.html",   icon: "\u21C4", label: "Swipe" },
  { id: "browse",  href: "browse.html",  icon: "\u2630", label: "Browse" },
  { id: "create",  href: "create.html",  icon: "+",       label: "Create" },
  { id: "matches", href: "matches.html", icon: "\u2714", label: "Sessions" },
  { id: "profile", href: "profile.html", icon: "\u25CF", label: "Profile" }
];


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
    close.textContent = "Close";
    close.addEventListener("click", () => dlg.close());
    const sessions = document.createElement("a");
    sessions.href = "matches.html";
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


  await db.from("notifications").update({ is_read: true }).eq("is_read", false);
  if (window.refreshNavBadge) window.refreshNavBadge();
}

function renderNav(active, myId) {
  toastBox = document.createElement("div");
  toastBox.className = "toast";
  toastBox.setAttribute("role", "status");
  toastBox.setAttribute("aria-live", "polite");
  toastBox.hidden = true;
  document.body.appendChild(toastBox);


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
  signOutButton.addEventListener("click", signOut);

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