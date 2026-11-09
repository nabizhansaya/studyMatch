async function fetchAll(table, columns, orderColumns) {
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let query = db.from(table).select(columns);
    for (const column of orderColumns) query = query.order(column);
    const { data, error } = await query.range(from, from + size - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < size) break;
  }
  return rows;
}

let catalogCache = null;


async function loadCatalog() {
  if (catalogCache) return catalogCache;
  const [majors, subjects, curriculum] = await Promise.all([
    fetchAll("majors", "major_id, name", ["name"]),
    fetchAll("subjects", "subject_id, code, name", ["subject_id"]),
    fetchAll("curriculum", "major_id, subject_id, study_year, trimester", ["major_id", "subject_id", "study_year"])
  ]);
  subjects.sort((a, b) => a.name.localeCompare(b.name));
  catalogCache = { majors, subjects, curriculum };
  return catalogCache;
}


function subjectsFor(catalog, major, year, trimester) {
  if (!major && !year && !trimester) return catalog.subjects;
  const ids = new Set(
    catalog.curriculum
      .filter(c => (!major || c.major_id === major) &&
                   (!year || c.study_year === year) &&
                   (!trimester || c.trimester === trimester))
      .map(c => c.subject_id)
  );
  return catalog.subjects.filter(s => ids.has(s.subject_id));
}


async function getMyAcademic(myId) {
  const { data } = await db.from("profiles").select("major_id, study_year").eq("profile_id", myId).single();
  return data || {};
}


async function setupSubjectFilters(options) {
  const catalog = await loadCatalog();
  const major = document.getElementById("sfMajor");
  const year = document.getElementById("sfYear");
  const term = document.getElementById("sfTerm");
  const hint = document.getElementById("sfHint");
  const subjectSelect = options.subjectSelect;

  fillSelect(major, catalog.majors, "major_id", m => m.name, "Any major");

  function refresh() {
    const list = subjectsFor(catalog, Number(major.value) || 0, Number(year.value) || 0, Number(term.value) || 0);
    const keep = subjectSelect.value;
    fillSelect(subjectSelect, list, "subject_id", s => `${s.name} (${s.code})`, options.emptyLabel);
    if (keep && [...subjectSelect.options].some(o => o.value === keep)) subjectSelect.value = keep;
    syncSearchable(subjectSelect);
    if (hint) hint.textContent = `${list.length} subject(s) shown.`;
  }

  function showMine() {
    major.value = options.myMajor || "";
    year.value = options.myYear || "";
    term.value = "";
    syncSearchable(major);
  }

  function showAll() {
    major.value = "";
    year.value = "";
    term.value = "";
    syncSearchable(major);
  }

  function changed() {
    refresh();
    if (options.onChange) options.onChange();
  }

  for (const control of [major, year, term]) control.addEventListener("change", changed);
  document.getElementById("sfMine").addEventListener("click", () => { showMine(); changed(); });
  document.getElementById("sfAll").addEventListener("click", () => { showAll(); changed(); });

  showMine();
  refresh();

  return {
    showAll(silent) { showAll(); refresh(); if (!silent) changed(); },
    refresh
  };
}
