const pageStatus     = document.getElementById("pageStatus");
const profileForm    = document.getElementById("profileForm");
const profileStatus  = document.getElementById("profileStatus");
const fullNameInput  = document.getElementById("fullName");
const facultySelect  = document.getElementById("faculty");
const yearSelect     = document.getElementById("studyYear");
const locationSelect = document.getElementById("location");
const bioInput       = document.getElementById("bio");
const telegramInput  = document.getElementById("telegram");
const subjectsForm   = document.getElementById("subjectsForm");
const subjectChecks  = document.getElementById("subjectChecks");
const subjectsStatus = document.getElementById("subjectsStatus");

const TELEGRAM_RULE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

let myId = null;
let savedSubjectIds = new Set();


async function loadProfile() {
  const [{ data: faculties }, { data: locations }, { data: profile, error }, { data: contact }] =
    await Promise.all([
      db.from("faculties").select("faculty_id, name").order("name"),
      db.from("locations").select("location_id, name").order("location_id"),
      db.from("profiles")
        .select("full_name, study_year, bio, faculty_id, location_id")
        .eq("profile_id", myId).single(),
      db.from("profile_contacts").select("telegram_username").eq("profile_id", myId).maybeSingle()
    ]);
  if (error) throw error;

  fillSelect(facultySelect, faculties, "faculty_id", f => f.name, "Choose...");
  fillSelect(locationSelect, locations, "location_id", l => l.name, "Choose...");

  fullNameInput.value  = profile.full_name || "";
  facultySelect.value  = profile.faculty_id ?? "";
  yearSelect.value     = profile.study_year ?? "";
  locationSelect.value = profile.location_id ?? "";
  bioInput.value       = profile.bio || "";
  telegramInput.value  = contact ? contact.telegram_username : "";

  if (!profile.faculty_id || !profile.study_year) {
    setStatus(pageStatus, "Please complete your profile so other students can find you.", true);
  }
}

async function loadSubjects() {
  const [{ data: subjects, error }, { data: mine }] = await Promise.all([
    db.from("subjects").select("subject_id, code, name").order("name"),
    db.from("profile_subjects").select("subject_id").eq("profile_id", myId)
  ]);
  if (error) throw error;

  savedSubjectIds = new Set(mine.map(r => r.subject_id));
  subjectChecks.innerHTML = "";
  for (const s of subjects) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = s.subject_id;
    box.checked = savedSubjectIds.has(s.subject_id);
    label.append(box, document.createTextNode(`${s.name} (${s.code})`));
    subjectChecks.appendChild(label);
  }
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = profileForm.querySelector("button");

  const telegram = telegramInput.value.trim().replace(/^@/, "");
  if (telegram && !TELEGRAM_RULE.test(telegram)) {
    setStatus(profileStatus,
      "Telegram username: 5-32 characters, start with a letter, only letters, digits and _.", true);
    return;
  }

  button.disabled = true;
  setStatus(profileStatus, "Saving...");

  const { error } = await db.from("profiles").update({
    full_name: fullNameInput.value.trim(),
    faculty_id: facultySelect.value || null,
    study_year: yearSelect.value || null,
    location_id: locationSelect.value || null,
    bio: bioInput.value.trim() || null
  }).eq("profile_id", myId);

  let contactError = null;
  if (!error) {
    if (telegram) {
      ({ error: contactError } = await db.from("profile_contacts")
        .upsert({ profile_id: myId, telegram_username: telegram }, { onConflict: "profile_id" }));
    } else {
      ({ error: contactError } = await db.from("profile_contacts").delete().eq("profile_id", myId));
    }
  }

  button.disabled = false;
  const failed = error || contactError;
  if (failed) {
    setStatus(profileStatus, "Could not save: " + failed.message, true);
    return;
  }
  telegramInput.value = telegram;
  setStatus(profileStatus, "Profile saved.");
  setStatus(pageStatus, "");
});


subjectsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = subjectsForm.querySelector("button");
  button.disabled = true;
  setStatus(subjectsStatus, "Saving...");

  const chosen = new Set(
    [...subjectChecks.querySelectorAll("input:checked")].map(box => Number(box.value))
  );
  const toAdd    = [...chosen].filter(id => !savedSubjectIds.has(id))
                     .map(id => ({ profile_id: myId, subject_id: id }));
  const toRemove = [...savedSubjectIds].filter(id => !chosen.has(id));

  let failed = null;
  if (toAdd.length) {
    ({ error: failed } = await db.from("profile_subjects").insert(toAdd));
  }
  if (!failed && toRemove.length) {
    ({ error: failed } = await db.from("profile_subjects")
      .delete().eq("profile_id", myId).in("subject_id", toRemove));
  }

  button.disabled = false;
  if (failed) {
    setStatus(subjectsStatus, "Could not save: " + failed.message, true);
    return;
  }
  savedSubjectIds = chosen;
  setStatus(subjectsStatus, `Saved (${chosen.size} subject(s)).`);
});



async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(pageStatus, "Open js/supabase-client.js and paste your Supabase URL and public key.", true);
    return;
  }
  const session = await requireLogin();
  if (!session) return;

  try {
    myId = await getMyProfileId();
    if (myId === null) {
      setStatus(pageStatus, "No profile found for this account. Run migration_v2.sql, then create a new account.", true);
      return;
    }
    renderNav("profile", myId);

    const soundToggle = document.getElementById("soundToggle");
    const soundStatus = document.getElementById("soundStatus");
    soundToggle.checked = soundEnabled();
    soundToggle.addEventListener("change", () => {
      setSoundEnabled(soundToggle.checked);
      setStatus(soundStatus, soundToggle.checked ? "Sound is on." : "Sound is off.");
    });
    document.getElementById("soundTest").addEventListener("click", () => {
      showToast("Test: this is how a notification looks.");
      if (soundEnabled()) playChime();
      setStatus(soundStatus, soundEnabled() ? "Message shown and sound played." : "Message shown (sound is off).");
    });
    await Promise.all([loadProfile(), loadSubjects()]);
  } catch (err) {
    setStatus(pageStatus, "Could not load your profile: " + err.message, true);
  }
}

init();