import type { Metadata } from "next";

// The browser bar colour (theme-color) is set live by SystemBarsSync in the
// root layout, so it always matches the page and the light/dark theme.

// Staff-only shell metadata: makes the admin and employee panels
// installable to a phone's home screen (required for push notifications
// on iPhone) without changing the public customer pages.
export const metadata: Metadata = {
  manifest: "/staff.webmanifest",
  // Nested-layout `icons` REPLACES the root layout's, rather than merging
  // with it — so the browser-tab favicon (normally auto-detected from
  // app/icon.png) has to be listed here explicitly, or it silently falls
  // back to a generic globe on every page under this layout.
  icons: {
    icon: "/icon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "QureoCity" },
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
