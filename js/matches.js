const pageStatus  = document.getElementById("pageStatus");
const sessionList = document.getElementById("sessionList");
const openList    = document.getElementById("openList");
const waitingList = document.getElementById("waitingList");

let myId = null;


const TAB_IDS = ["confirmed", "open", "accepted"];

function showTab(id) {
  for (const t of TAB_IDS) {
    const selected = t === id;
    const tab = document.getElementById("tab-" + t);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById("panel-" + t).hidden = !selected;
  }
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
}

function setCount(id, n) {
  document.getElementById("count-" + id).textContent = n;
}

function setupTabs() {
  for (const t of TAB_IDS) {
    document.getElementById("tab-" + t).addEventListener("click", () => showTab(t));
  }
  // arrow keys move between the tabs
  document.querySelector(".tabs").addEventListener("keydown", e => {
    const current = TAB_IDS.findIndex(t => document.getElementById("tab-" + t).getAttribute("aria-selected") === "true");
    let next = -1;
    if (e.key === "ArrowRight") next = (current + 1) % TAB_IDS.length;
    if (e.key === "ArrowLeft") next = (current + TAB_IDS.length - 1) % TAB_IDS.length;
    if (next >= 0) { showTab(TAB_IDS[next]); document.getElementById("tab-" + TAB_IDS[next]).focus(); }
  });

  const fromHash = () => {
    const id = location.hash.slice(1);
    showTab(TAB_IDS.includes(id) ? id : "confirmed");
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();
}


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
  const [mine, answered] = await Promise.all([loadMine(), loadAnswered()]);


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
  const open = mine.filter(x => x.status === "open");
  const waiting = answered.filter(x => x.status === "accepted" && x.study_requests.status === "open");
  fill(sessionList, sessions.map(s => sessionItem(s, contacts)), "No confirmed sessions yet.");
  fill(openList, open.map(openItem), "You have no open requests.");
  fill(waitingList, waiting.map(waitingItem), "You are not waiting for any request.");
  setCount("confirmed", sessions.length);
  setCount("open", open.length);
  setCount("accepted", waiting.length);
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
    setupTabs();
    await render();
  } catch (err) {
    setStatus(pageStatus, "Could not load your sessions: " + err.message, true);
  }
}

init();