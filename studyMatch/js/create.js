const createForm = document.getElementById("createForm");
const cStatus    = document.getElementById("cStatus");
const cSubject   = document.getElementById("cSubject");
const cStart     = document.getElementById("cStart");
const cDuration  = document.getElementById("cDuration");
const cLocation  = document.getElementById("cLocation");
const cMessage   = document.getElementById("cMessage");

function toLocalInput(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function setDefaultTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(16, 0, 0, 0);
  cStart.min = toLocalInput(new Date());
  cStart.value = toLocalInput(tomorrow);
}


createForm.addEventListener("submit", async event => {
  event.preventDefault();
  const start = new Date(cStart.value);
  if (isNaN(start) || start <= new Date()) {
    setStatus(cStatus, "Choose a date and time in the future.", true);
    return;
  }

  const button = createForm.querySelector("button");
  button.disabled = true;
  setStatus(cStatus, "Posting...");

  const { error } = await db.rpc("create_request", {
    p_subject: Number(cSubject.value),
    p_start: start.toISOString(),
    p_duration: Number(cDuration.value),
    p_location: Number(cLocation.value),
    p_message: cMessage.value.trim() || null
  });

  button.disabled = false;
  if (error) {
    setStatus(cStatus, error.message, true);
    return;
  }
  setStatus(cStatus, "Request posted. Other students can see it now.");
  cMessage.value = "";
  setDefaultTime();
});


async function init() {

  // Temporary
  // if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
  //   setStatus(siStatus, "js/supabase-client.js requires Supabase URL and public key.", true);
  //   return;
  // }
  // checking public keys and project URL

  if (!(await requireLogin())) return;

  try {
    const myId = await getMyProfileId();
    if (myId === null) {
      setStatus(cStatus, "No profile found for this account. Create a new account first.", true);
      return;
    }
    renderNav("create", myId);

    const [subjects, locations, me] = await Promise.all([
      db.from("subjects").select("subject_id, code, name").order("name"),
      db.from("locations").select("location_id, name").order("location_id"),
      db.from("profiles").select("location_id").eq("profile_id", myId).single()
    ]);
    if (subjects.error) throw subjects.error;
    if (locations.error) throw locations.error;

    fillSelect(cSubject, subjects.data, "subject_id", s => `${s.name} (${s.code})`);
    fillSelect(cLocation, locations.data, "location_id", l => l.name, "Choose...");
    if (me.data && me.data.location_id) cLocation.value = me.data.location_id;   // your usual place
    setDefaultTime();
  } catch (err) {
    setStatus(cStatus, "Could not load the page: " + err.message, true);
  }
}

init();