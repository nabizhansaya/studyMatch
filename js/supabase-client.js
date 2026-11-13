// The connection to Supabase. Your own URL and key are in js/config.js.
if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
  // a hint for the developer only (users see a friendly message on the page)
  console.error("StudyMatch setup: open js/config.js and paste your Supabase URL and public key.");
}

// "Keep me signed in": "yes" keeps the login after the tab is closed, "no" ends it when the tab closes.
const KEEP_KEY = "studymatch.keepSignedIn";

function keepSignedIn() {
  try { return localStorage.getItem(KEEP_KEY) !== "no"; } catch (e) { return true; }
}

function setKeepSignedIn(on) {
  try { localStorage.setItem(KEEP_KEY, on ? "yes" : "no"); } catch (e) { /* ignore */ }
}

// A Supabase client that keeps its login in the given storage:
// localStorage stays after the tab is closed, sessionStorage ends when the tab is closed.
function createDb(storage) {
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage: storage } });
}

const db = createDb(keepSignedIn() ? window.localStorage : window.sessionStorage);
