document.querySelector("header").appendChild(createThemeButton());

const forgotForm = document.getElementById("forgotForm");
const fgStatus   = document.getElementById("fgStatus");

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
    setStatus(fgStatus, "Open js/config.js and paste your Supabase URL and public key.", true);
    return;
  }
  const button = forgotForm.querySelector("button");
  button.disabled = true;
  setStatus(fgStatus, "Sending...");

  const { error } = await db.auth.resetPasswordForEmail(
    document.getElementById("fgEmail").value.trim(),
    { redirectTo: new URL("reset.html", location.href).href }
  );

  button.disabled = false;
  if (error) {
    setStatus(fgStatus, error.message, true);
    return;
  }
  setStatus(fgStatus, "If an account exists for this address, a link is on its way. Check the spam folder too.");
});
