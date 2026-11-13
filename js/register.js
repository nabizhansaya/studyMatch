document.querySelector("header").appendChild(createThemeButton());

const signupForm = document.getElementById("signupForm");
const suStatus   = document.getElementById("suStatus");
const suMajor    = document.getElementById("suMajor");
const suEmail    = document.getElementById("suEmail");
const suPassword = document.getElementById("suPassword");
const suPassword2 = document.getElementById("suPassword2");

attachPasswordMeter(suPassword, document.getElementById("rules"),
  document.getElementById("meterBar"), document.getElementById("meterLabel"), () => suEmail.value);
wireShowPassword(document.getElementById("showPw"), [suPassword, suPassword2]);

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();


  if (!checkPassword(suPassword.value, suEmail.value).ok) {
    setStatus(suStatus, "The password does not meet all the rules yet.", true);
    suPassword.focus();
    return;
  }
  if (suPassword.value !== suPassword2.value) {
    setStatus(suStatus, "The two passwords are different.", true);
    suPassword2.focus();
    return;
  }

  const button = signupForm.querySelector("button");
  button.disabled = true;
  setStatus(suStatus, "Creating account...");

  const { data, error } = await db.auth.signUp({
    email: suEmail.value.trim(),
    password: suPassword.value,
    options: {

      data: {
        full_name: document.getElementById("suName").value.trim(),
        major_id: suMajor.value,
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
    markActive();
    location.href = "swipe.html";
    return;
  }
  location.href = "login.html?notice=registered";
});

async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(suStatus, "The service is not available right now. Please try again later.", true);
    return;
  }
  const { data, error } = await db.from("majors").select("major_id, name").order("name");
  if (error) {
    setStatus(suStatus, "Could not load the list of majors: " + error.message, true);
    return;
  }
  fillSelect(suMajor, data, "major_id", m => m.name, "Choose...");
}

init();
