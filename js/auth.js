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


const SOUND_KEY = "studymatch.sound";
function soundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) === "on"; } catch (e) { return false; }
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

function renderNav(active, myId) {
  toastBox = document.createElement("div");
  toastBox.className = "toast";
  toastBox.setAttribute("role", "status");
  toastBox.setAttribute("aria-live", "polite");
  toastBox.hidden = true;
  document.body.appendChild(toastBox);

  const signOutButton = document.createElement("button");
  signOutButton.type = "button";
  signOutButton.textContent = "Sign out";
  signOutButton.addEventListener("click", signOut);
  document.querySelector("header").appendChild(signOutButton);

  const nav = document.createElement("nav");
  nav.className = "tabbar";
  nav.setAttribute("aria-label", "Main");
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.hidden = true;

  for (const item of NAV_ITEMS) {
    const link = document.createElement("a");
    link.href = item.href;
    if (item.id === active) link.setAttribute("aria-current", "page");
    const icon = svgIcon("i-" + item.id);
    const label = document.createElement("span");
    label.textContent = item.label;
    link.append(icon, label);
    if (item.id === "matches") link.appendChild(badge);
    nav.appendChild(link);
  }
  document.body.appendChild(nav);
  document.body.classList.add("has-tabbar");


  async function refreshBadge() {
    const { count } = await db.from("notifications")
      .select("notification_id", { count: "exact", head: true }).eq("is_read", false);
    badge.hidden = !count;
    badge.textContent = count || "";
    badge.setAttribute("aria-label", `${count} new`);
  }
  window.refreshNavBadge = refreshBadge;
  refreshBadge();
  if (myId) {
    db.channel("notes-" + myId)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${myId}` },
          payload => {
            refreshBadge();
            if (payload.new && payload.new.type === "request_accepted") {
              showToast("Someone accepted your request. Open Sessions to see who.");
              if (soundEnabled()) playChime();
            }
          })
      .subscribe();
  }
}