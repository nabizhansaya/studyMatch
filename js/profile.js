const pageStatus     = document.getElementById("pageStatus");
const profileForm    = document.getElementById("profileForm");
const profileStatus  = document.getElementById("profileStatus");
const fullNameInput  = document.getElementById("fullName");
const facultySelect  = document.getElementById("faculty");
const yearSelect     = document.getElementById("studyYear");
const locationSelect = document.getElementById("location");
const bioInput       = document.getElementById("bio");
const telegramInput  = document.getElementById("telegram");
const subjectChecks  = document.getElementById("subjectChecks");
const saveBtn        = document.getElementById("saveBtn");
const dirtyNote      = document.getElementById("dirtyNote");

const TELEGRAM_RULE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

let myId = null;
let dirty = false;
function setDirty(on) {
  dirty = on;
  dirtyNote.textContent = on ? "You have unsaved changes." : "";
}
profileForm.addEventListener("input", () => setDirty(true));
profileForm.addEventListener("change", () => setDirty(true));
window.addEventListener("beforeunload", event => {
  if (dirty) { event.preventDefault(); event.returnValue = ""; }
});


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
  syncSearchable(facultySelect);
  syncSearchable(locationSelect);

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

  const saved = new Set(mine.map(r => r.subject_id));
  subjectChecks.innerHTML = "";
  for (const s of subjects) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = s.subject_id;
    box.checked = saved.has(s.subject_id);
    label.append(box, document.createTextNode(`${s.name} (${s.code})`));
    subjectChecks.appendChild(label);
  }
}


profileForm.addEventListener("submit", async event => {
  event.preventDefault();


  const telegram = telegramInput.value.trim().replace(/^@/, "");
  if (telegram && !TELEGRAM_RULE.test(telegram)) {
    setStatus(profileStatus,
      "Telegram username: 5-32 characters, start with a letter, only letters, digits and _.", true);
    telegramInput.focus();
    return;
  }

  saveBtn.disabled = true;
  setStatus(profileStatus, "Saving...");


  const subjects = [...subjectChecks.querySelectorAll("input:checked")].map(box => Number(box.value));
  const { error } = await db.rpc("save_profile", {
    p_full_name: fullNameInput.value.trim(),
    p_faculty: facultySelect.value ? Number(facultySelect.value) : null,
    p_year: yearSelect.value ? Number(yearSelect.value) : null,
    p_location: locationSelect.value ? Number(locationSelect.value) : null,
    p_bio: bioInput.value.trim() || null,
    p_telegram: telegram || null,
    p_subjects: subjects
  });

  saveBtn.disabled = false;
  if (error) {
    setStatus(profileStatus, "Could not save: " + error.message, true);
    return;
  }
  telegramInput.value = telegram;
  setDirty(false);
  setStatus(profileStatus, "Profile saved.");
  setStatus(pageStatus, "");
});


function setupDeleteAccount() {
  const dialog   = document.getElementById("deleteDialog");
  const step1    = document.getElementById("deleteStep1");
  const step2    = document.getElementById("deleteStep2");
  const codeBox  = document.getElementById("deleteCode");
  const status   = document.getElementById("deleteStatus");
  let email = null;

  document.getElementById("deleteBtn").addEventListener("click", () => {
    step1.hidden = false;
    step2.hidden = true;
    codeBox.value = "";
    setStatus(status, "");
    dialog.showModal();
  });
  document.getElementById("deleteCancel1").addEventListener("click", () => dialog.close());
  document.getElementById("deleteCancel2").addEventListener("click", () => dialog.close());

  
  document.getElementById("sendCodeBtn").addEventListener("click", async () => {
    setStatus(status, "Sending the code...");
    const { data } = await db.auth.getUser();
    email = data && data.user ? data.user.email : null;
    if (!email) { setStatus(status, "Could not read your e-mail address. Sign in again.", true); return; }

    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) { setStatus(status, error.message, true); return; }
    step1.hidden = true;
    step2.hidden = false;
    setStatus(status, "We sent a code to " + email + ". Enter it below.");
    codeBox.focus();
  });


  document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
    const token = codeBox.value.trim();
    if (!token) { setStatus(status, "Enter the code from the e-mail.", true); return; }
    setStatus(status, "Checking the code...");

    const { error: codeError } = await db.auth.verifyOtp({ email, token, type: "email" });
    if (codeError) { setStatus(status, "The code is wrong or has expired.", true); return; }

    const { error: deleteError } = await db.rpc("delete_my_account");
    if (deleteError) { setStatus(status, "Could not delete the account: " + deleteError.message, true); return; }

    try { await db.auth.signOut({ scope: "local" }); } catch (e) { /* the account is already gone */ }
    clearStoredSessions();
    location.href = "login.html?notice=deleted";
  });
}


function setupSoundSetting() {
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
}


async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(pageStatus, "The service is not available right now. Please try again later.", true);
    return;
  }
  const session = await requireLogin();
  if (!session) return;

  try {
    myId = await getMyProfileId();
    if (myId === null) {
      setStatus(pageStatus, "We could not find your profile. Please sign out and create a new account.", true);
      return;
    }
    renderNav("profile", myId);
    setupDeleteAccount();
    setupSoundSetting();
    await Promise.all([loadProfile(), loadSubjects()]);
  } catch (err) {
    setStatus(pageStatus, "Could not load your profile: " + err.message, true);
  }
}

init();
