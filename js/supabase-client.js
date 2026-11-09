if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
  console.error("StudyMatch setup: open js/config.js and paste your Supabase URL and public key.");
}

const KEEP_KEY = "studymatch.keepSignedIn";

function keepSignedIn() {
  try { return localStorage.getItem(KEEP_KEY) !== "no"; } catch (e) { return true; }
}

function setKeepSignedIn(on) {
  try { localStorage.setItem(KEEP_KEY, on ? "yes" : "no"); } catch (e) { /* ignore */ }
}

function createDb(storage) {
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage: storage } });
}

const db = createDb(keepSignedIn() ? window.localStorage : window.sessionStorage);
