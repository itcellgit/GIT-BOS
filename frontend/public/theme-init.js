// Applies the saved colour theme before the app renders, so dark mode does not flash white.
// A separate file (not inline) so the production Content-Security-Policy allows it. See src/lib/theme.js.
(function () {
  try {
    var saved = localStorage.getItem("acp-theme");
    var dark = saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {
    /* storage blocked: stay light */
  }
})();
