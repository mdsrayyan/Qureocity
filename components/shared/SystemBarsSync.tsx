"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Keeps the phone's status bar (top) and navigation bar (bottom) the same
// colour as the screen underneath them.
//
// It reads the actual painted background colour at the top and bottom edge
// of the page, so it follows every screen, the light/dark toggle, open
// sheets and modals without any page having to declare its colour.
//
// - In a browser / home-screen install it updates <meta name="theme-color">
//   (which only controls the top bar).
// - Inside the Android app (mobile/) it also sends both colours to the
//   native shell, which paints the two bars.

type Rgba = [number, number, number, number];

const META_ID = "qureocity-theme-color";
const FALLBACK = "#ffffff";

type CapacitorBridge = {
  nativePromise?: (
    plugin: string,
    method: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};

function parseColor(value: string): Rgba | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

// Walks up from the element at (x, y), blending any see-through backgrounds
// over the first solid one, to get the colour the eye actually sees there.
function colorAt(x: number, y: number): string {
  let el: Element | null = document.elementFromPoint(x, y);
  const layers: Rgba[] = [];
  while (el) {
    const c = parseColor(getComputedStyle(el).backgroundColor);
    if (c && c[3] > 0) {
      layers.push(c);
      if (c[3] >= 1) break;
    }
    el = el.parentElement;
  }
  let rgb: [number, number, number] = [255, 255, 255];
  if (layers.length && layers[layers.length - 1][3] >= 1) {
    const base = layers.pop()!;
    rgb = [base[0], base[1], base[2]];
  }
  for (let i = layers.length - 1; i >= 0; i--) {
    const [r, g, b, a] = layers[i];
    rgb = [r * a + rgb[0] * (1 - a), g * a + rgb[1] * (1 - a), b * a + rgb[2] * (1 - a)];
  }
  return (
    "#" +
    rgb
      .map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function SystemBarsSync() {
  const pathname = usePathname();

  useEffect(() => {
    let last = "";
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      frame = 0;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!w || !h) return;
      const top = colorAt(w / 2, 1) || FALLBACK;
      const bottom = colorAt(w / 2, h - 1) || FALLBACK;
      const key = top + bottom;
      if (key === last) return;
      last = key;

      let meta = document.getElementById(META_ID) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.id = META_ID;
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.content = top;

      const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
      if (cap?.nativePromise) {
        cap
          .nativePromise("QureoSystemBars", "setColors", {
            statusBar: top,
            navigationBar: bottom,
          })
          .catch(() => {
            // Older app build without the plugin: nothing to do.
          });
      }
    };

    // Coalesce bursts of DOM changes / animations into one read, and read
    // again shortly after so transitions (sheets sliding in, theme fade)
    // are caught once they settle.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => requestAnimationFrame(sync), 350);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "open"],
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", schedule);
      if (frame) cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
