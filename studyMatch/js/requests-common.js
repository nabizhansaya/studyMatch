function el(id) { return document.getElementById(id); }

async function loadOptions() {
  const [subjects, locations] = await Promise.all([
    db.from("subjects").select("subject_id, code, name").order("name"),
    db.from("locations").select("location_id, name, is_online").order("location_id")
  ]);
  if (subjects.error) throw subjects.error;
  if (locations.error) throw locations.error;
  return { subjects: subjects.data, locations: locations.data };
}

function fillFilters(options) {
  fillSelect(el("fSubject"), options.subjects, "subject_id", s => `${s.name} (${s.code})`, "Any subject");
  fillSelect(el("fLocation"), options.locations, "location_id", l => l.name, "Any place");
}


function readFilters() {
  let from = null, to = null;
  const dateInput = el("fDate");
  if (dateInput && dateInput.value) {
    const start = new Date(dateInput.value + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    from = start.toISOString();
    to = end.toISOString();
  }
  return {
    p_subject_id: el("fSubject").value ? Number(el("fSubject").value) : null,
    p_location_id: el("fLocation").value ? Number(el("fLocation").value) : null,
    p_format: el("fFormat").value || null,
    p_from: from,
    p_to: to,
    p_my_subjects: el("fMine").checked,
    p_limit: 30
  };
}


async function fetchRequests() {
  const { data, error } = await db.rpc("find_requests", readFilters());
  if (error) throw error;
  return data;
}

async function acceptRequest(requestId) {
  const { error } = await db.rpc("accept_request", { p_request: requestId });
  if (error) throw error;
}

async function skipRequest(requestId, myId) {
  const { error } = await db.from("request_responses")
    .insert({ request_id: requestId, responder_id: myId, status: "declined" });
  if (error) throw error;
}

async function undoSkip(requestId, myId) {
  const { error } = await db.from("request_responses").delete()
    .eq("request_id", requestId).eq("responder_id", myId).eq("status", "declined");
  if (error) throw error;
}

async function resetSkips(myId) {
  const { error } = await db.from("request_responses").delete()
    .eq("responder_id", myId).eq("status", "declined");
  if (error) throw error;
}

function requestLines(r) {
  const who = [r.owner_name, r.owner_faculty, r.owner_year ? `year ${r.owner_year}` : null]
    .filter(Boolean).join(" - ");
  return {
    who,
    when: formatWhen(r.proposed_start),
    place: `${formatDuration(r.duration_minutes)} - ${r.location_name}${r.is_online ? " (online)" : ""}`
  };
}

async function showMatch(r) {
  const { data } = await db.from("profile_contacts")
    .select("telegram_username").eq("profile_id", r.owner_id).maybeSingle();

  const dlg = document.createElement("dialog");
  dlg.setAttribute("aria-labelledby", "matchTitle");

  const title = document.createElement("h2");
  title.id = "matchTitle";
  title.textContent = "It's a match!";

  const info = document.createElement("p");
  info.textContent = `You accepted ${r.owner_name}'s request: ${r.subject_name}, ` +
                     `${formatWhen(r.proposed_start)}, ${r.location_name}.`;

  const contact = document.createElement("p");
  const link = data ? telegramAnchor(data.telegram_username) : null;
  if (link) {
    contact.append("Write to them on Telegram: ", link);
  } else {
    contact.textContent = `${r.owner_name} has not added a Telegram username yet. Check Sessions later.`;
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Keep swiping";
  close.addEventListener("click", () => dlg.close());
  const sessions = document.createElement("a");
  sessions.href = "matches.html";
  sessions.textContent = "Go to my sessions";
  actions.append(close, sessions);

  dlg.append(title, info, contact, actions);
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}