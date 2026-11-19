import "./globals.css";
import { SystemBarsSync } from "@/components/shared/SystemBarsSync";

export const metadata = {
  title: "QureoCity",
  description: "Play. Discover. Belong.",
};

// Runs before paint, before React hydrates — reads the saved theme (if
// any) and sets it on <html> immediately, so staff pages never flash the
// wrong theme for a frame on load. Only ever touches data-theme, never
// removes/adds classes, so it can't fight with anything else here.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem("qureocity-theme");
    var theme = saved === "light" || saved === "dark" ? saved : "light";
    document.documentElement.setAttribute("data-theme", theme);
    // First guess for the phone's top-bar colour, so it doesn't flash before
    // SystemBarsSync reads the real colour (staff pages follow the theme,
    // customer pages are always light).
    var path = location.pathname;
    var staff = path.indexOf("/admin") === 0 || path.indexOf("/employee") === 0;
    var meta = document.createElement("meta");
    meta.id = "qureocity-theme-color";
    meta.name = "theme-color";
    meta.content = staff && theme === "dark" ? "#15130F" : "#FFFFFF";
    document.head.appendChild(meta);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        {children}
        <SystemBarsSync />
      </body>
    </html>
  );
}
