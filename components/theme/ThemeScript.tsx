const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem("rfpilot-admin-theme");
      const preference = saved === "light" || saved === "dark" ? saved : "light";
      const resolved = preference === "system"
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : preference;
      const root = document.documentElement;
      root.classList.toggle("dark", resolved === "dark");
      root.dataset.theme = resolved;
      root.dataset.themePreference = preference;
      root.style.colorScheme = resolved;
    } catch (_) {}
  })();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
