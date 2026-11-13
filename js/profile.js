const pageStatus     = document.getElementById("pageStatus");
const profileForm    = document.getElementById("profileForm");
const profileStatus  = document.getElementById("profileStatus");
const fullNameInput  = document.getElementById("fullName");
const majorSelect    = document.getElementById("major");
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

profileForm.addEventListener("input", e => { if (!e.target.closest("[data-nodirty]")) setDirty(true); });
profileForm.addEventListener("change", e => { if (!e.target.closest("[data-nodirty]")) setDirty(true); });
window.addEventListener("beforeunload", event => {
  if (dirty) { event.preventDefault(); event.returnValue = ""; }
});


let catalog = null;
const selectedSubjects = new Set();

async function loadProfile() {
  const [{ data: majors }, { data: locations }, { data: profile, error }, { data: contact }] =
    await Promise.all([
      db.from("majors").select("major_id, name").order("name"),
      db.from("locations").select("location_id, name").order("location_id"),
      db.from("profiles")
        .select("full_name, study_year, bio, major_id, location_id")
        .eq("profile_id", myId).single(),
      db.from("profile_contacts").select("telegram_username").eq("profile_id", myId).maybeSingle()
    ]);
  if (error) throw error;

  fillSelect(majorSelect, majors, "major_id", m => m.name, "Choose...");
  fillSelect(locationSelect, locations, "location_id", l => l.name, "Choose...");

  fullNameInput.value  = profile.full_name || "";
  majorSelect.value    = profile.major_id ?? "";
  yearSelect.value     = profile.study_year ?? "";
  locationSelect.value = profile.location_id ?? "";
  bioInput.value       = profile.bio || "";
  telegramInput.value  = contact ? contact.telegram_username : "";
  syncSearchable(majorSelect);
  syncSearchable(locationSelect);

  if (!profile.major_id || !profile.study_year) {
    setStatus(pageStatus, "Please choose your major and year so other students can find you.", true);
  }
  return profile;
}


const sfMajor = document.getElementById("sfMajor");
const sfYear  = document.getElementById("sfYear");
const sfTerm  = document.getElementById("sfTerm");
const sfText  = document.getElementById("sfText");
const sfHint  = document.getElementById("sfHint");

function renderSubjectChecks() {
  const list = subjectsFor(catalog, Number(sfMajor.value) || 0, Number(sfYear.value) || 0, Number(sfTerm.value) || 0)
    .filter(s => {
      const text = sfText.value.trim().toLowerCase();
      return !text || s.name.toLowerCase().includes(text) || s.code.toLowerCase().includes(text);
    });

  subjectChecks.innerHTML = "";
  if (list.length === 0) {
    const none = document.createElement("p");
    none.textContent = "No subjects match. Change the filter or press Show all subjects.";
    subjectChecks.appendChild(none);
  }
  for (const s of list) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = s.subject_id;
    box.checked = selectedSubjects.has(s.subject_id);
    box.addEventListener("change", () => {
      if (box.checked) selectedSubjects.add(s.subject_id); else selectedSubjects.delete(s.subject_id);
      sfHint.textContent = `${list.length} subject(s) shown, ${selectedSubjects.size} ticked.`;
    });
    label.append(box, document.createTextNode(`${s.name} (${s.code})`));
    subjectChecks.appendChild(label);
  }
  sfHint.textContent = `${list.length} subject(s) shown, ${selectedSubjects.size} ticked.`;
}

async function loadSubjects(profile) {
  catalog = await loadCatalog();
  const { data: mine } = await db.from("profile_subjects").select("subject_id").eq("profile_id", myId);
  for (const r of mine) selectedSubjects.add(r.subject_id);

  fillSelect(sfMajor, catalog.majors, "major_id", m => m.name, "Any major");
  const showMine = () => {
    sfMajor.value = profile.major_id || "";
    sfYear.value = profile.study_year || "";
    sfTerm.value = "";
    syncSearchable(sfMajor);
  };
  const showAll = () => {
    sfMajor.value = "";
    sfYear.value = "";
    sfTerm.value = "";
    syncSearchable(sfMajor);
  };
  for (const control of [sfMajor, sfYear, sfTerm]) control.addEventListener("change", renderSubjectChecks);
  sfText.addEventListener("input", renderSubjectChecks);
  document.getElementById("sfMine").addEventListener("click", () => { showMine(); renderSubjectChecks(); });
  document.getElementById("sfAll").addEventListener("click", () => { showAll(); renderSubjectChecks(); });

  showMine();
  renderSubjectChecks();
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


  const subjects = [...selectedSubjects];
  const { error } = await db.rpc("save_profile", {
    p_full_name: fullNameInput.value.trim(),
    p_major: majorSelect.value ? Number(majorSelect.value) : null,
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


  async function sendCode() {
    setStatus(status, "Sending the code...");
    const { data } = await db.auth.getUser();
    email = data && data.user ? data.user.email : null;
    if (!email) { setStatus(status, "Could not read your e-mail address. Sign in again.", true); return; }

    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) { console.error(error); setStatus(status, error.message, true); return; }
    step1.hidden = true;
    step2.hidden = false;
    setStatus(status, "We sent a code to " + email + ". Use the newest e-mail and enter the code below.");
    codeBox.focus();
  }
  document.getElementById("sendCodeBtn").addEventListener("click", sendCode);
  document.getElementById("resendCodeBtn").addEventListener("click", sendCode);


  document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
    const token = codeBox.value.replace(/\s+/g, "");
    if (!token) { setStatus(status, "Enter the code from the e-mail.", true); return; }
    setStatus(status, "Checking the code...");

    const { error: codeError } = await db.auth.verifyOtp({ email, token, type: "email" });
    if (codeError) {
      console.error(codeError);
      setStatus(status, "The code is wrong or has expired. Press Send a new code and use the code from the newest e-mail.", true);
      return;
    }

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
    const profile = await loadProfile();
    await loadSubjects(profile);
  } catch (err) {
    setStatus(pageStatus, "Could not load your profile: " + err.message, true);
  }
}

init();
