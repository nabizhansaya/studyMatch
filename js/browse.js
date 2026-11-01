const pageStatus = el("pageStatus");
const list       = el("list");
const matchSelect = el("matchRequest");

let myId = null;
let items = [];
let myOpenRequests = [];


async function load() {
  setStatus(pageStatus, "Searching...");
  try {
    items = await fetchRequests();
  } catch (err) {
    setStatus(pageStatus, "Could not load requests: " + err.message, true);
    return;
  }
  render();
  setStatus(pageStatus, `${items.length} request(s) found.`);
}

function render() {
  list.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No requests match these filters.";
    list.appendChild(li);
    return;
  }
  for (const r of items) {
    const text = requestLines(r);
    const li = document.createElement("li");

    const subject = document.createElement("strong");
    subject.textContent = `${r.subject_name} (${r.subject_code})`;
    const when = document.createElement("div");
    when.className = "req-when";
    when.textContent = text.when;
    const place = document.createElement("div");
    place.textContent = text.place;
    const who = document.createElement("div");
    who.className = "hint";
    who.textContent = "From " + text.who + (r.in_my_subjects ? " - on your profile" : "");
    const message = document.createElement("div");
    message.textContent = r.message ? `"${r.message}"` : "";

    const actions = document.createElement("div");
    actions.className = "actions";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept";
    accept.setAttribute("aria-label", `Accept ${r.owner_name}'s request for ${r.subject_name}`);
    accept.addEventListener("click", () => doAccept(r, accept));
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "secondary";
    skip.textContent = "Skip";
    skip.setAttribute("aria-label", `Skip ${r.owner_name}'s request`);
    skip.addEventListener("click", () => doSkip(r, skip));
    actions.append(accept, skip);

    li.append(subject, when, place, who, message, actions);
    list.appendChild(li);
  }
}


async function doAccept(r, button) {
  button.disabled = true;
  try {
    await acceptRequest(r.request_id);
    items = items.filter(x => x.request_id !== r.request_id);
    render();
    setStatus(pageStatus, `Accepted ${r.owner_name}'s request.`);
    await showMatch(r);
  } catch (err) {
    await load();
    setStatus(pageStatus, err.message, true);
  }
}

async function doSkip(r, button) {
  button.disabled = true;
  try {
    await skipRequest(r.request_id, myId);
    items = items.filter(x => x.request_id !== r.request_id);
    render();
    setStatus(pageStatus, "Skipped.");
  } catch (err) {
    button.disabled = false;
    setStatus(pageStatus, "Could not skip: " + err.message, true);
  }
}


async function loadMyRequests() {
  const { data, error } = await db.from("study_requests")
    .select("request_id, subject_id, location_id, proposed_start, subjects(name)")
    .eq("sender_id", myId).eq("status", "open").order("proposed_start");
  if (error) throw error;
  myOpenRequests = data;

  matchSelect.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = data.length ? "No - use my own filters" : "You have no open requests";
  matchSelect.appendChild(none);
  for (const r of data) {
    const option = document.createElement("option");
    option.value = r.request_id;
    option.textContent = `${r.subjects.name} - ${formatWhen(r.proposed_start)}`;
    matchSelect.appendChild(option);
  }
}

matchSelect.addEventListener("change", () => {
  const mine = myOpenRequests.find(r => String(r.request_id) === matchSelect.value);
  if (mine) {
    el("fSubject").value = mine.subject_id;
    el("fLocation").value = mine.location_id;
  }
  load();
});


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
    renderNav("browse", myId);
    fillFilters(await loadOptions());
    await loadMyRequests();
  } catch (err) {
    setStatus(pageStatus, "Could not load the page: " + err.message, true);
    return;
  }

  for (const id of ["fSubject", "fLocation", "fFormat", "fDate", "fMine"]) el(id).addEventListener("change", load);
  el("searchBtn").addEventListener("click", load);
  el("resetSkipsBtn").addEventListener("click", async () => {
    try { await resetSkips(myId); load(); }
    catch (err) { setStatus(pageStatus, "Could not reset: " + err.message, true); }
  });

  load();
}

init();