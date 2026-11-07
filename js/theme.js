(function () {
  var KEY = "studymatch.theme";
  var ORDER = ["system", "light", "dark"];
  var ICON = { system: "i-monitor", light: "i-sun", dark: "i-moon" };

  function get() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch (e) { return "system"; }
  }

  function apply(mode) {
    var root = document.documentElement;
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
    else root.removeAttribute("data-theme");
  }

  function set(mode) {
    try {
      if (mode === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode);
    } catch (e) { /* storage blocked: the choice lasts until the page is closed */ }
    apply(mode);
  }

  apply(get());

  window.createThemeButton = function () {
    var NS = "http://www.w3.org/2000/svg";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "icon-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var use = document.createElementNS(NS, "use");
    svg.appendChild(use);
    button.appendChild(svg);

    function refresh() {
      var mode = get();
      var next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      var base = typeof ASSET_BASE !== "undefined" ? ASSET_BASE : "assets/";
      use.setAttribute("href", base + "icons.svg#" + ICON[mode]);
      button.setAttribute("aria-label", "Theme: " + mode + ". Switch to " + next + ".");
      button.title = "Theme: " + mode;
    }
    button.addEventListener("click", function () {
      set(ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length]);
      refresh();
    });
    refresh();
    return button;
  };
})();
