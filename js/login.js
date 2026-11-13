// theme button (system / light / dark) in the top bar
document.querySelector("header").appendChild(createThemeButton());

const signinForm = document.getElementById("signinForm");
const siStatus   = document.getElementById("siStatus");
const siKeep     = document.getElementById("siKeep");

// short messages shown after being sent back to this page
const NOTICES = {
  timeout: "You were signed out after 1 hour without activity. Please sign in again.",
  deleted: "Your account was deleted.",
  reset: "Your password was changed. Please sign in with the new password.",
  registered: "Almost done: open the confirmation link we sent to your e-mail, then sign in."
};

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = signinForm.querySelector("button");
  button.disabled = true;
  setStatus(siStatus, "Signing in...");

  // The choice decides where the login is kept: localStorage stays after the tab is closed,
  // sessionStorage ends when the tab is closed.
  const keep = siKeep.checked;
  setKeepSignedIn(keep);
  clearStoredSessions();
  const client = createDb(keep ? window.localStorage : window.sessionStorage);

  const { error } = await client.auth.signInWithPassword({
    email: document.getElementById("siEmail").value.trim(),
    password: document.getElementById("siPassword").value
  });

  button.disabled = false;
  if (error) {
    setStatus(siStatus, error.message, true);   // e.g. wrong password, e-mail not confirmed
    return;
  }
  markActive();
  location.href = "swipe.html";
});

async function init() {
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(siStatus, "The service is not available right now. Please try again later.", true);
    return;
  }
  const notice = new URLSearchParams(location.search).get("notice");
  if (notice && NOTICES[notice]) setStatus(siStatus, NOTICES[notice]);

  const { data } = await db.auth.getSession();
  if (data.session) location.href = "swipe.html";      // already signed in
}

init();
