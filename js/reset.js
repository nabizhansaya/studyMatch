document.querySelector("header").appendChild(createThemeButton());

const resetForm  = document.getElementById("resetForm");
const resetNote  = document.getElementById("resetNote");
const rsStatus   = document.getElementById("rsStatus");
const rsPassword = document.getElementById("rsPassword");
const rsPassword2 = document.getElementById("rsPassword2");

attachPasswordMeter(rsPassword, document.getElementById("rules"),
  document.getElementById("meterBar"), document.getElementById("meterLabel"), null);
wireShowPassword(document.getElementById("showPw"), [rsPassword, rsPassword2]);

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!checkPassword(rsPassword.value, "").ok) {
    setStatus(rsStatus, "The password does not meet all the rules yet.", true);
    return;
  }
  if (rsPassword.value !== rsPassword2.value) {
    setStatus(rsStatus, "The two passwords are different.", true);
    return;
  }

  const button = resetForm.querySelector("button");
  button.disabled = true;
  setStatus(rsStatus, "Saving...");
  const { error } = await db.auth.updateUser({ password: rsPassword.value });
  button.disabled = false;

  if (error) {
    setStatus(rsStatus, error.message, true); 
    return;
  }
  try { await db.auth.signOut({ scope: "local" }); } catch (e) { /* ignore */ }
  clearStoredSessions();
  location.href = "login.html?notice=reset";
});

async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(resetNote, "Open js/config.js and paste your Supabase URL and public key.", true);
    return;
  }

  const { data } = await db.auth.getSession();
  if (!data.session) {
    setStatus(resetNote, "This link is not valid or has expired. Please ask for a new one on the Forgot password page.", true);
    return;
  }
  resetForm.hidden = false;
}

init();
