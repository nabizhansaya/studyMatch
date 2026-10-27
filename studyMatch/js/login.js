const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");
const siStatus   = document.getElementById("siStatus");
const suStatus   = document.getElementById("suStatus");
const suFaculty  = document.getElementById("suFaculty");


signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(siStatus, "Signing in...");

  const { error } = await db.auth.signInWithPassword({
    email: document.getElementById("siEmail").value.trim(),
    password: document.getElementById("siPassword").value
  });

  if (error) {
    setStatus(siStatus, error.message, true);
    return;
  }
  location.href = "swipe.html";
});


signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = signupForm.querySelector("button");
  button.disabled = true;
  setStatus(suStatus, "Creating account...");

  const { data, error } = await db.auth.signUp({
    email: document.getElementById("suEmail").value.trim(),
    password: document.getElementById("suPassword").value,
    options: {
      data: {
        full_name: document.getElementById("suName").value.trim(),
        faculty_id: suFaculty.value,
        study_year: document.getElementById("suYear").value
      },
      emailRedirectTo: new URL("login.html", location.href).href
    }
  });

  button.disabled = false;

  if (error) {
    setStatus(suStatus, error.message, true);
    return;
  }

  if (data.session) {
    location.href = "swipe.html";
    return;
  }
  setStatus(suStatus, "Almost done: open the confirmation link we sent to your e-mail, then sign in.");
  signupForm.reset();
});


async function init() {

  // Temporary
  // if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
  //   setStatus(siStatus, "js/supabase-client.js requires Supabase URL and public key.", true);
  //   return;
  // }
  // checking public keys and project URL

  const { data: sessionData } = await db.auth.getSession();
  if (sessionData.session) {
    location.href = "swipe.html";
    return;
  }

  const { data, error } = await db.from("faculties").select("faculty_id, name").order("name");
  if (error) {
    setStatus(suStatus, "Could not load faculties: " + error.message, true);
    return;
  }
  fillSelect(suFaculty, data, "faculty_id", f => f.name, "Choose...");
}

init();