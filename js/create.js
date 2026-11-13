const createForm = document.getElementById("createForm");
const cStatus    = document.getElementById("cStatus");
const cSubject   = document.getElementById("cSubject");
const cStart     = document.getElementById("cStart");
const cDuration  = document.getElementById("cDuration");
const cLocation  = document.getElementById("cLocation");
const cFormat    = document.getElementById("cFormat");
const placeBox   = document.getElementById("placeBox");
const detailsBox = document.getElementById("detailsBox");
const cDetails   = document.getElementById("cDetails");

let locations = [];

const isOnline = () => cFormat.value === "online";
function needsDetails() {
  const place = locations.find(l => String(l.location_id) === cLocation.value);
  return !isOnline() && !!(place && place.needs_details);
}


function updatePlaceFields() {
  placeBox.hidden = isOnline();
  if (cLocation._combo) cLocation._combo.required = !isOnline();
  detailsBox.hidden = !needsDetails();
  cDetails.required = needsDetails();
}
cFormat.addEventListener("change", updatePlaceFields);
cLocation.addEventListener("change", updatePlaceFields);
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

  const online = locations.find(l => l.is_online);
  const locationId = isOnline() ? (online && online.location_id) : Number(cLocation.value);
  if (!locationId) {
    setStatus(cStatus, "Choose a place.", true);
    return;
  }
  if (needsDetails() && !cDetails.value.trim()) {
    setStatus(cStatus, "Please write where you want to meet.", true);
    cDetails.focus();
    return;
  }

  const button = createForm.querySelector("button");
  button.disabled = true;
  setStatus(cStatus, "Posting...");

  const { error } = await db.rpc("create_request", {
    p_subject: Number(cSubject.value),
    p_start: start.toISOString(),
    p_duration: Number(cDuration.value),
    p_location: locationId,
    p_message: cMessage.value.trim() || null,
    p_location_note: needsDetails() ? cDetails.value.trim() : null
  });

  button.disabled = false;
  if (error) {
    setStatus(cStatus, error.message, true);
    return;
  }
  setStatus(cStatus, "Request posted. Other students can see it now.");
  cMessage.value = "";
  cDetails.value = "";
  setDefaultTime();
});


async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(cStatus, "The service is not available right now. Please try again later.", true);
    return;
  }
  if (!(await requireLogin())) return;

  try {
    const myId = await getMyProfileId();
    if (myId === null) {
      setStatus(cStatus, "We could not find your profile. Please sign out and create a new account.", true);
      return;
    }
    renderNav("create", myId);

    const [locations, me] = await Promise.all([
      db.from("locations").select("location_id, name, is_online, needs_details").order("location_id"),
      db.from("profiles").select("location_id, major_id, study_year").eq("profile_id", myId).single()
    ]);
    if (locations.error) throw locations.error;

    locations = locations.data;

    fillSelect(cLocation, locations.filter(l => !l.is_online), "location_id", l => l.name, "Choose...");
    const usual = me.data && locations.find(l => l.location_id === me.data.location_id);
    if (usual && usual.is_online) cFormat.value = "online";
    else if (usual) { cLocation.value = usual.location_id; syncSearchable(cLocation); }
    updatePlaceFields();
    
    await setupSubjectFilters({ subjectSelect: cSubject, emptyLabel: null,
                                myMajor: me.data && me.data.major_id, myYear: me.data && me.data.study_year });
    setDefaultTime();
  } catch (err) {
    setStatus(cStatus, "Could not load the page: " + err.message, true);
  }
}

init();
