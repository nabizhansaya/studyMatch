const pageStatus  = document.getElementById("pageStatus");
const noteList    = document.getElementById("noteList");
const sessionList = document.getElementById("sessionList");
const openList    = document.getElementById("openList");
const waitingList = document.getElementById("waitingList");

let myId = null;


function line(className, text) {
  const d = document.createElement("div");
  if (className) d.className = className;
  d.textContent = text;
  return d;
}

function actionButton(label, secondary, ariaLabel, handler) {
  const b = document.createElement("button");
  b.type = "button";
  if (secondary) b.className = "secondary";
  b.textContent = label;
  b.setAttribute("aria-label", ariaLabel);
  b.addEventListener("click", async () => {
    b.disabled = true;
    await handler();
    b.disabled = false;
  });
  return b;
}

function headLines(li, subject, code, start, duration, place, message) {
  const title = document.createElement("strong");
  title.textContent = `${subject} (${code})`;
  li.append(title, line("req-when", formatWhen(start)), line("", `${formatDuration(duration)} - ${place}`));
  if (message) li.appendChild(line("", `"${message}"`));
}


async function act(rpcName, args, doneText) {
  const { error } = await db.rpc(rpcName, args);
  if (error) {
    setStatus(pageStatus, error.message, true);
    return;
  }
  setStatus(pageStatus, doneText);
  await render();
}


async function loadMine() {
  const { data, error } = await db.from("study_requests")
    .select(`request_id, status, proposed_start, duration_minutes, message,
             subjects(name, code), locations(name),
             request_responses(status, responder:profiles!responder_id(profile_id, full_name, study_year, bio))`)
    .eq("sender_id", myId).in("status", ["open", "confirmed"])
    .order("proposed_start");
  if (error) throw error;
  return data;
}

async function loadAnswered() {
  const { data, error } = await db.from("request_responses")
    .select(`request_id, status,
             study_requests(request_id, status, proposed_start, duration_minutes, message,
               subjects(name, code), locations(name),
               owner:profiles!sender_id(profile_id, full_name))`)
    .eq("responder_id", myId).in("status", ["accepted", "confirmed"]);
  if (error) throw error;
  return data.filter(a => a.study_requests);
}

async function loadNotes() {
  const { data } = await db.from("notifications")
    .select("notification_id, type, is_read, created_at")
    .order("created_at", { ascending: false }).limit(10);
  return data || [];
}


function noteItem(n) {
  const li = document.createElement("li");
  li.appendChild(line("", (NOTE_TEXT[n.type] || "Notification") + (n.is_read ? "" : " (new)")));
  li.appendChild(line("hint", formatWhen(n.created_at)));
  return li;
}

function sessionItem(s, contacts) {
  const li = document.createElement("li");
  headLines(li, s.subject, s.code, s.start, s.duration, s.place, s.message);
  const partner = document.createElement("div");
  partner.append(`With ${s.partnerName} - `);
  const link = telegramAnchor(contacts.get(s.partnerId));
  if (link) partner.appendChild(link); else partner.append("no Telegram username yet");
  li.appendChild(partner);
  const actions = document.createElement("div");
  actions.className = "actions";
  actions.appendChild(actionButton("Cancel session", true, `Cancel the session about ${s.subject}`, async () => {
    if (confirm("Cancel this session? The other student will be told.")) {
      await act("cancel_request", { p_request: s.requestId }, "Session cancelled.");
    }
  }));
  li.appendChild(actions);
  return li;
}

function openItem(r) {
  const li = document.createElement("li");
  headLines(li, r.subjects.name, r.subjects.code, r.proposed_start, r.duration_minutes, r.locations.name, r.message);

  const interested = r.request_responses.filter(x => x.status === "accepted");
  if (interested.length === 0) {
    li.appendChild(line("hint", "Nobody has accepted yet."));
  } else {
    li.appendChild(line("", `${interested.length} student(s) accepted:`));
    for (const x of interested) {
      const who = x.responder;
      const row = document.createElement("div");
      row.appendChild(line("", `${who.full_name}${who.study_year ? ", year " + who.study_year : ""}${who.bio ? " - " + who.bio : ""}`));
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.append(
        actionButton("Confirm", false, `Confirm ${who.full_name}`, () =>
          act("confirm_response", { p_request: r.request_id, p_responder: who.profile_id },
              `Confirmed ${who.full_name}. The request is closed.`)),
        actionButton("Decline", true, `Decline ${who.full_name}`, () =>
          act("decline_response", { p_request: r.request_id, p_responder: who.profile_id },
              `Declined ${who.full_name}.`))
      );
      row.appendChild(actions);
      li.appendChild(row);
    }
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.appendChild(actionButton("Delete request", true, `Delete my request about ${r.subjects.name}`, async () => {
    if (confirm("Delete this request? Students who accepted it will be told.")) {
      await act("cancel_request", { p_request: r.request_id }, "Request deleted.");
    }
  }));
  li.appendChild(actions);
  return li;
}

function waitingItem(a) {
  const r = a.study_requests;
  const li = document.createElement("li");
  headLines(li, r.subjects.name, r.subjects.code, r.proposed_start, r.duration_minutes, r.locations.name, r.message);
  li.appendChild(line("", `From ${r.owner.full_name}`));
  const actions = document.createElement("div");
  actions.className = "actions";
  actions.appendChild(actionButton("Withdraw", true, `Withdraw from ${r.owner.full_name}'s request`, () =>
    act("withdraw_interest", { p_request: r.request_id }, "You withdrew your answer.")));
  li.appendChild(actions);
  return li;
}

async function render() {
  const [mine, answered, notes] = await Promise.all([loadMine(), loadAnswered(), loadNotes()]);


  const sessions = [];
  for (const r of mine.filter(x => x.status === "confirmed")) {
    const hit = r.request_responses.find(x => x.status === "confirmed");
    if (!hit) continue;
    sessions.push({ requestId: r.request_id, subject: r.subjects.name, code: r.subjects.code,
      start: r.proposed_start, duration: r.duration_minutes, place: r.locations.name, message: r.message,
      partnerId: hit.responder.profile_id, partnerName: hit.responder.full_name });
  }
  for (const a of answered.filter(x => x.status === "confirmed" && x.study_requests.status === "confirmed")) {
    const r = a.study_requests;
    sessions.push({ requestId: r.request_id, subject: r.subjects.name, code: r.subjects.code,
      start: r.proposed_start, duration: r.duration_minutes, place: r.locations.name, message: r.message,
      partnerId: r.owner.profile_id, partnerName: r.owner.full_name });
  }
  sessions.sort((x, y) => new Date(x.start) - new Date(y.start));


  const contacts = new Map();
  const ids = [...new Set(sessions.map(s => s.partnerId))];
  if (ids.length) {
    const { data } = await db.from("profile_contacts")
      .select("profile_id, telegram_username").in("profile_id", ids);
    for (const c of data || []) contacts.set(c.profile_id, c.telegram_username);
  }

  const fill = (ul, items, empty) => {
    ul.innerHTML = "";
    if (items.length === 0) ul.appendChild(line("", empty));
    for (const li of items) ul.appendChild(li);
  };
  fill(noteList, notes.map(noteItem), "No notifications yet.");
  fill(sessionList, sessions.map(s => sessionItem(s, contacts)), "No confirmed sessions yet.");
  fill(openList, mine.filter(x => x.status === "open").map(openItem), "You have no open requests.");
  fill(waitingList,
       answered.filter(x => x.status === "accepted" && x.study_requests.status === "open").map(waitingItem),
       "You are not waiting for any request.");
}


async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(pageStatus, "Open js/supabase-client.js and paste your Supabase URL and public key.", true);
    return;
  }
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