
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "qwerty", "qwerty123", "qwertyuiop", "12345678", "123456789",
  "1234567890", "11111111", "iloveyou", "admin123", "letmein1", "welcome1", "abc12345", "passw0rd",
  "p@ssw0rd", "p@ssword", "zaq12wsx", "1q2w3e4r", "asdfghjk", "asdf1234", "qazwsxedc", "qwerty12",
  "qwerty1234", "monkey123", "dragon123", "football1", "baseball1", "superman1", "trustno1", "changeme"
]);

const SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

function checkPassword(pw, email) {
  const local = (email || "").split("@")[0].toLowerCase();
  const rules = [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "One uppercase letter (A-Z)", ok: /[A-Z]/.test(pw) },
    { label: "One lowercase letter (a-z)", ok: /[a-z]/.test(pw) },
    { label: "One number (0-9)", ok: /[0-9]/.test(pw) },
    { label: "One special character, for example ! @ # $ % ?", ok: SPECIAL.test(pw) },
    { label: "Not a common password", ok: pw.length > 0 && !COMMON_PASSWORDS.has(pw.toLowerCase()) },
    { label: "Does not contain your e-mail name", ok: pw.length > 0 && !(local.length >= 3 && pw.toLowerCase().includes(local)) }
  ];
  const done = rules.filter(r => r.ok).length;
  const ok = done === rules.length;
  let level = "weak";
  if (ok) level = pw.length >= 12 ? "strong" : "good";
  else if (done >= 5) level = "fair";
  return { rules, ok, level, percent: Math.round((done / rules.length) * 100) };
}


function attachPasswordMeter(input, list, bar, label, getEmail) {
  const TEXT = { weak: "Weak", fair: "Fair", good: "Good", strong: "Strong" };
  function update() {
    const r = checkPassword(input.value, getEmail ? getEmail() : "");
    list.innerHTML = "";
    for (const rule of r.rules) {
      const li = document.createElement("li");
      if (rule.ok) li.className = "ok";
      li.textContent = (rule.ok ? "\u2713 " : "\u2022 ") + rule.label;
      list.appendChild(li);
    }
    bar.style.width = (input.value ? r.percent : 0) + "%";
    bar.dataset.level = r.level;
    label.textContent = input.value ? "Password strength: " + TEXT[r.level] : "";
  }
  input.addEventListener("input", update);
  update();
}


function wireShowPassword(checkbox, inputs) {
  checkbox.addEventListener("change", () => {
    for (const input of inputs) input.type = checkbox.checked ? "text" : "password";
  });
}
