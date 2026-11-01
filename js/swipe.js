const pageStatus = el("pageStatus");
const stage      = el("stage");
const skipBtn    = el("skipBtn");
const undoBtn    = el("undoBtn");
const acceptBtn  = el("acceptBtn");

let myId = null;
let deck = [];          // open requests, the first one is on screen
let lastSkip = null;    // for "Undo"
let busy = false;

// ---- Load the feed (all filters at once) -----------------------
async function load() {
  setStatus(pageStatus, "Loading...");
  try {
    deck = await fetchRequests();
  } catch (err) {
    setStatus(pageStatus, "Could not load requests: " + err.message, true);
    return;
  }
  lastSkip = null;
  render();
  setStatus(pageStatus, `${deck.length} request(s) waiting.`);
}

// ---- Drawing the card ------------------------------------------
function buildCard(r) {
  const text = requestLines(r);
  const card = document.createElement("article");
  card.className = "swipe-card";

  const no = document.createElement("span");
  no.className = "stamp stamp-no";
  no.textContent = "SKIP";
  const yes = document.createElement("span");
  yes.className = "stamp stamp-yes";
  yes.textContent = "ACCEPT";

  const subject = document.createElement("h2");
  subject.className = "req-subject";
  subject.textContent = r.subject_name;
  const code = document.createElement("p");
  code.className = "req-line";
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = r.subject_code + (r.in_my_subjects ? " - on your profile" : "");
  code.appendChild(tag);

  const when = document.createElement("p");
  when.className = "req-when";
  when.textContent = text.when;
  const place = document.createElement("p");
  place.className = "req-line";
  place.textContent = text.place;
  const who = document.createElement("p");
  who.className = "req-line";
  who.textContent = "From " + text.who;
  const message = document.createElement("p");
  message.className = "req-line";
  message.textContent = r.message ? `"${r.message}"` : "";

  card.append(no, yes, subject, code, when, place, who, message);
  attachSwipe(card);
  return card;
}

function render() {
  stage.innerHTML = "";
  if (deck.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card empty";
    const p = document.createElement("p");
    p.textContent = "No more requests for these filters.";
    const link = document.createElement("a");
    link.href = "create.html";
    link.textContent = "Create your own request";
    const img = document.createElement("img");
    img.className = "empty-img";
    img.src = ASSET_BASE + "empty-480.webp";
    img.srcset = `${ASSET_BASE}empty-480.webp 480w, ${ASSET_BASE}empty-960.webp 960w`;
    img.sizes = "(max-width: 600px) 70vw, 320px";
    img.width = 480;
    img.height = 320;
    img.alt = "";                       // decorative: the text below says the same
    empty.append(img, p, link);
    stage.appendChild(empty);
  } else {
    stage.appendChild(buildCard(deck[0]));
  }
  skipBtn.disabled = acceptBtn.disabled = deck.length === 0;
  undoBtn.disabled = !lastSkip;
}

// ---- Swipe with finger or mouse ----------------------------------
function attachSwipe(card) {
  let startX = null;
  let dx = 0;

  function reset() {
    startX = null;
    card.classList.remove("dragging");
    card.style.transform = "";
    card.dataset.dir = "";
  }
  card.addEventListener("pointerdown", e => {
    startX = e.clientX;
    dx = 0;
    card.setPointerCapture(e.pointerId);
    card.classList.add("dragging");
  });
  card.addEventListener("pointermove", e => {
    if (startX === null) return;
    dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
    card.dataset.dir = dx > 40 ? "right" : dx < -40 ? "left" : "";
  });
  card.addEventListener("pointerup", () => {
    if (startX === null) return;
    const moved = dx;
    reset();
    if (moved > 100) doAccept(deck[0]);        // swipe right = accept
    else if (moved < -100) doSkip(deck[0]);    // swipe left = skip
  });
  card.addEventListener("pointercancel", reset);
}

stage.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") doAccept(deck[0]);
  if (e.key === "ArrowLeft") doSkip(deck[0]);
});

// ---- WRITE: accept, skip, undo -----------------------------------
async function doAccept(r) {
  if (!r || busy) return;
  busy = true;
  try {
    await acceptRequest(r.request_id);
    deck = deck.filter(x => x.request_id !== r.request_id);
    lastSkip = null;
    render();
    setStatus(pageStatus, `Accepted ${r.owner_name}'s request.`);
    await showMatch(r);
  } catch (err) {
    await load();                                  // e.g. someone else was faster
    setStatus(pageStatus, err.message, true);
  } finally {
    busy = false;
  }
}

async function doSkip(r) {
  if (!r || busy) return;
  busy = true;
  try {
    await skipRequest(r.request_id, myId);
    deck = deck.filter(x => x.request_id !== r.request_id);
    lastSkip = r;
    render();
    setStatus(pageStatus, "Skipped.");
  } catch (err) {
    setStatus(pageStatus, "Could not skip: " + err.message, true);
  } finally {
    busy = false;
  }
}

async function doUndo() {
  if (!lastSkip || busy) return;
  busy = true;
  try {
    await undoSkip(lastSkip.request_id, myId);
    deck.unshift(lastSkip);
    lastSkip = null;
    render();
    setStatus(pageStatus, "Back in the deck.");
  } catch (err) {
    setStatus(pageStatus, "Could not undo: " + err.message, true);
  } finally {
    busy = false;
  }
}

async function init() {

  // Temporary
  // if (SUPABASE_URL.includes("YOUR-PROJECT-ID")) {
  //   setStatus(siStatus, "js/supabase-client.js requires Supabase URL and public key.", true);
  //   return;
  // }
  // checking public keys and project URL

  if (!(await requireLogin())) return;

  try {
    myId = await getMyProfileId();
    if (myId === null) {
      setStatus(pageStatus, "No profile found for this account. Create a new account first.", true);
      return;
    }
    renderNav("swipe", myId);
    fillFilters(await loadOptions());
  } catch (err) {
    setStatus(pageStatus, "Could not load the page: " + err.message, true);
    return;
  }

  for (const id of ["fSubject", "fLocation", "fFormat", "fMine"]) el(id).addEventListener("change", load);
  el("resetSkipsBtn").addEventListener("click", async () => {
    try { await resetSkips(myId); load(); }
    catch (err) { setStatus(pageStatus, "Could not reset: " + err.message, true); }
  });
  const helpDialog = el("helpDialog");
  el("helpBtn").addEventListener("click", () => helpDialog.showModal());
  el("helpClose").addEventListener("click", () => helpDialog.close());
  try {
    if (!localStorage.getItem("studymatch.helpSeen")) {
      localStorage.setItem("studymatch.helpSeen", "yes");
      helpDialog.showModal();
    }
  } catch (e) { /* storage blocked: skip the first-visit help */ }

  skipBtn.addEventListener("click", () => doSkip(deck[0]));
  undoBtn.addEventListener("click", doUndo);
  acceptBtn.addEventListener("click", () => doAccept(deck[0]));

  load();
}

init();