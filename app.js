const SUPABASE_URL = "https://qbzlvwsziygpxacrdxef.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiemx2d3N6aXlncHhhY3JkeGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MTE2MzgsImV4cCI6MjEwNzE4NzYzOH0.NhoNNnw4EfukDAX8KpG2eVbv37n_pLKNzb7e94Rk8FA";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const meSelect      = document.getElementById("meSelect");
const subjectSelect = document.getElementById("subjectSelect");
const dayFilter     = document.getElementById("dayFilter");
const searchBtn     = document.getElementById("searchBtn");
const messageInput  = document.getElementById("messageInput");
const statusEl      = document.getElementById("status");
const resultsEl     = document.getElementById("results");
const myRequestsEl  = document.getElementById("myRequests");

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "ok";
}

function timeText(t) {
  return t.slice(0, 5);
}


function fillSelect(select, rows, valueKey, labelFn) {
  select.innerHTML = "";
  for (const row of rows) {
    const option = document.createElement("option");
    option.value = row[valueKey];
    option.textContent = labelFn(row);
    select.appendChild(option);
  }
}


async function loadSubjects() {
  const { data, error } = await db
    .from("subjects")
    .select("subject_id, code, name")
    .order("name");
  if (error) throw error;
  fillSelect(subjectSelect, data, "subject_id", s => `${s.name} (${s.code})`);
}

async function loadUsers() {
  const { data, error } = await db
    .from("profiles")
    .select("profile_id, full_name")
    .order("full_name");
  if (error) throw error;
  fillSelect(meSelect, data, "profile_id", p => p.full_name);
}

async function searchPartners() {
  const subjectId = Number(subjectSelect.value);
  const day = dayFilter.value;           
  const me = Number(meSelect.value);

  setStatus("Searching...");

 
  const availabilityPart = day
    ? "availability!inner(day_of_week, start_time, end_time)"
    : "availability(day_of_week, start_time, end_time)";

  let query = db
    .from("profiles")
    .select(
      `profile_id, full_name, study_year, bio,
       faculties(name),
       profile_subjects!inner(subject_id),
       ${availabilityPart}`
    )
    .eq("profile_subjects.subject_id", subjectId)
    .neq("profile_id", me)                
    .order("full_name")
    .limit(30);

  if (day) query = query.eq("availability.day_of_week", Number(day));

  const { data, error } = await query;
  if (error) {
    setStatus("Could not load students: " + error.message, true);
    return;
  }

  renderResults(data);
  setStatus(`${data.length} student(s) found.`);
}

function renderResults(profiles) {
  resultsEl.innerHTML = "";
  if (profiles.length === 0) {
    resultsEl.textContent = "No students found for this subject and day.";
    return;
  }

  for (const p of profiles) {
    const card = document.createElement("article");
    card.className = "student";

    const name = document.createElement("h3");
    name.textContent = p.full_name;

    const info = document.createElement("p");
    info.textContent = `${p.faculties ? p.faculties.name : ""} - year ${p.study_year}`;

    const bio = document.createElement("p");
    bio.textContent = p.bio || "";

    const slots = document.createElement("p");
    slots.textContent =
      "Free: " +
      p.availability
        .map(a => `${DAYS[a.day_of_week]} ${timeText(a.start_time)}-${timeText(a.end_time)}`)
        .join(", ");

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Send study request";
    button.addEventListener("click", () => sendRequest(p.profile_id, p.full_name, button));

    card.append(name, info, bio, slots, button);
    resultsEl.appendChild(card);
  }
}

async function sendRequest(receiverId, receiverName, button) {
  button.disabled = true;

  const { error } = await db.from("study_requests").insert({
    sender_id: Number(meSelect.value),
    receiver_id: receiverId,
    subject_id: Number(subjectSelect.value),
    message: messageInput.value.trim() || null
  });

  button.disabled = false;

  if (error) {
    setStatus("Could not send the request: " + error.message, true);
    return;
  }

  setStatus(`Request sent to ${receiverName}.`);
  loadMyRequests();                     
}

async function loadMyRequests() {
  const { data, error } = await db
    .from("study_requests")
    .select(
      `request_id, status, message, created_at,
       receiver:profiles!study_requests_receiver_id_fkey(full_name),
       subjects(name)`
    )
    .eq("sender_id", Number(meSelect.value))
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    setStatus("Could not load your requests: " + error.message, true);
    return;
  }

  myRequestsEl.innerHTML = "";
  if (data.length === 0) {
    const li = document.createElement("li");
    li.textContent = "You have not sent any requests yet.";
    myRequestsEl.appendChild(li);
    return;
  }

  for (const r of data) {
    const li = document.createElement("li");
    const date = new Date(r.created_at).toLocaleDateString();
    li.textContent =
      `To ${r.receiver.full_name} - ${r.subjects.name} - ${r.status} (${date})` +
      (r.message ? `: "${r.message}"` : "");
    myRequestsEl.appendChild(li);
  }
}

async function init() {

  try {
    await Promise.all([loadSubjects(), loadUsers()]);
  } catch (err) {
    setStatus("Could not connect to the database: " + err.message, true);
    return;
  }

  searchBtn.addEventListener("click", searchPartners);
  meSelect.addEventListener("change", () => {
    searchPartners();
    loadMyRequests();
  });

  searchPartners();
  loadMyRequests();
}

init();