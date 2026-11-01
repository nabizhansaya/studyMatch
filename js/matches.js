const pageStatus  = document.getElementById("pageStatus");
const sessionList = document.getElementById("sessionList");
const openList    = document.getElementById("openList");

let myId = null;

async function loadMine() {
  const { data, error } = await db.from("study_requests")
    .select(`request_id, status, proposed_start, duration_minutes, message,
             subjects(name, code), locations(name),
             request_responses(status, responder:profiles!responder_id(profile_id, full_name))`)
    .eq("sender_id", myId)
    .order("proposed_start");
  if (error) throw error;
  return data;
}


async function loadAccepted() {
  const { data, error } = await db.from("request_responses")
    .select(`request_id,
             study_requests(request_id, proposed_start, duration_minutes, message,
               subjects(name, code), locations(name),
               owner:profiles!sender_id(profile_id, full_name))`)
    .eq("responder_id", myId)
    .eq("status", "accepted");
  if (error) throw error;
  return data;
}


function line(className, text) {
  const p = document.createElement("div");
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function sessionItem(s, contacts) {
  const li = document.createElement("li");
  const title = document.createElement("strong");
  title.textContent = `${s.subject} (${s.code})`;
  li.append(title, line("req-when", formatWhen(s.start)),
            line("", `${formatDuration(s.duration)} - ${s.place}`));
  if (new Date(s.start) < new Date()) li.appendChild(line("hint", "This session is in the past."));

  const partner = document.createElement("div");
  partner.append(`With ${s.partnerName} - `);
  const link = telegramAnchor(contacts.get(s.partnerId));
  if (link) partner.appendChild(link);
  else partner.append("no Telegram username added yet");
  li.appendChild(partner);
  if (s.message) li.appendChild(line("", `"${s.message}"`));
  return li;
}

function openItem(r) {
  const li = document.createElement("li");
  const title = document.createElement("strong");
  title.textContent = `${r.subjects.name} (${r.subjects.code})`;
  li.append(title, line("req-when", formatWhen(r.proposed_start)),
            line("", `${formatDuration(r.duration_minutes)} - ${r.locations.name}`));
  if (r.message) li.appendChild(line("", `"${r.message}"`));

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary";
  cancel.textContent = "Cancel request";
  cancel.setAttribute("aria-label", `Cancel my request for ${r.subjects.name}`);
  cancel.addEventListener("click", () => cancelRequest(r.request_id, cancel));
  li.appendChild(cancel);
  return li;
}

async function render() {
  const [mine, accepted] = await Promise.all([loadMine(), loadAccepted()]);

  const sessions = [];
  for (const r of mine.filter(x => x.status === "matched")) {
    const hit = r.request_responses.find(x => x.status === "accepted");
    if (!hit) continue;
    sessions.push({
      subject: r.subjects.name, code: r.subjects.code, start: r.proposed_start,
      duration: r.duration_minutes, place: r.locations.name, message: r.message,
      partnerId: hit.responder.profile_id, partnerName: hit.responder.full_name
    });
  }
  for (const a of accepted) {
    const r = a.study_requests;
    if (!r) continue;
    sessions.push({
      subject: r.subjects.name, code: r.subjects.code, start: r.proposed_start,
      duration: r.duration_minutes, place: r.locations.name, message: r.message,
      partnerId: r.owner.profile_id, partnerName: r.owner.full_name
    });
  }
  sessions.sort((a, b) => new Date(a.start) - new Date(b.start));

  const contacts = new Map();
  const ids = [...new Set(sessions.map(s => s.partnerId))];
  if (ids.length) {
    const { data } = await db.from("profile_contacts")
      .select("profile_id, telegram_username").in("profile_id", ids);
    for (const c of data || []) contacts.set(c.profile_id, c.telegram_username);
  }

  sessionList.innerHTML = "";
  if (sessions.length === 0) sessionList.appendChild(line("", "No sessions yet. Swipe right on a request or wait for someone to accept yours."));
  for (const s of sessions) sessionList.appendChild(sessionItem(s, contacts));

  openList.innerHTML = "";
  const open = mine.filter(x => x.status === "open");
  if (open.length === 0) openList.appendChild(line("", "You have no open requests."));
  for (const r of open) openList.appendChild(openItem(r));
}

async function cancelRequest(requestId, button) {
  button.disabled = true;
  const { error } = await db.from("study_requests").delete().eq("request_id", requestId);
  if (error) {
    button.disabled = false;
    setStatus(pageStatus, "Could not cancel: " + error.message, true);
    return;
  }
  setStatus(pageStatus, "Request cancelled.");
  render();
}


async function init() {

  // Temporary
  // if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
  //   setStatus(siStatus, "js/supabase-client.js requires Supabase URL and public key.", true);
  //   return;
  // }
  // checking public keys and project URL

  if (!(await requireLogin())) return;

  try {
    myId = await getMyProfileId();
    if (myId === null) {
      setStatus(pageStatus, "No profile found for this account. Create a new account first.", true);
      return;
    }
    renderNav("matches", myId);
    await render();


    await db.from("notifications").update({ is_read: true }).eq("is_read", false);
    if (window.refreshNavBadge) window.refreshNavBadge();
  } catch (err) {
    setStatus(pageStatus, "Could not load your sessions: " + err.message, true);
  }
}

init();