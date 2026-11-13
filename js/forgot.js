document.querySelector("header").appendChild(createThemeButton());

const forgotForm = document.getElementById("forgotForm");
const codeForm   = document.getElementById("codeForm");
const stepEmail  = document.getElementById("stepEmail");
const stepCode   = document.getElementById("stepCode");
const fgStatus   = document.getElementById("fgStatus");
const fgEmail    = document.getElementById("fgEmail");
const fgPassword = document.getElementById("fgPassword");
const fgPassword2 = document.getElementById("fgPassword2");

attachPasswordMeter(fgPassword, document.getElementById("rules"),
  document.getElementById("meterBar"), document.getElementById("meterLabel"), () => fgEmail.value);
wireShowPassword(document.getElementById("showPw"), [fgPassword, fgPassword2]);

let email = "";


async function sendCode() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(fgStatus, "The service is not available right now. Please try again later.", true);
    return false;
  }
  setStatus(fgStatus, "Sending...");
  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error) {
    console.error(error);
    setStatus(fgStatus, error.message, true);
    return false;
  }
  setStatus(fgStatus, "If an account exists for " + email + ", a code is on its way. Check the spam folder too, and use the newest e-mail.");
  return true;
}

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  email = fgEmail.value.trim();
  const button = forgotForm.querySelector("button");
  button.disabled = true;
  const sent = await sendCode();
  button.disabled = false;
  if (sent) {
    stepEmail.hidden = true;
    stepCode.hidden = false;
    document.getElementById("codeNote").textContent = "Enter the code we sent to " + email + " and choose a new password.";
    document.getElementById("fgCode").focus();
  }
});

document.getElementById("resendBtn").addEventListener("click", sendCode);


codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!checkPassword(fgPassword.value, email).ok) {
    setStatus(fgStatus, "The password does not meet all the rules yet.", true);
    return;
  }
  if (fgPassword.value !== fgPassword2.value) {
    setStatus(fgStatus, "The two passwords are different.", true);
    return;
  }

  const button = codeForm.querySelector("button[type=submit]");
  button.disabled = true;
  setStatus(fgStatus, "Checking the code...");

  const token = document.getElementById("fgCode").value.replace(/\s+/g, "");
  const { error: codeError } = await db.auth.verifyOtp({ email, token, type: "recovery" });
  if (codeError) {
    console.error(codeError);
    button.disabled = false;
    setStatus(fgStatus, "The code is wrong or has expired. Press Send a new code and use the newest e-mail.", true);
    return;
  }

  const { error } = await db.auth.updateUser({ password: fgPassword.value });
  button.disabled = false;
  if (error) {
    setStatus(fgStatus, error.message, true); 
    return;
  }
  try { await db.auth.signOut({ scope: "local" }); } catch (e) { /* ignore */ }
  clearStoredSessions();
  location.href = "login.html?notice=reset";
});
