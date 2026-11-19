// Injected by the Android app into every page of the QureoCity site.
// Makes the app look right even when the website itself hasn't been
// redeployed yet:
//  1. light-theme page backgrounds are plain white;
//  2. the phone's status bar / navigation bar take the colour of the page
//     edge underneath them (sent to SystemBarColorsPlugin).
// Safe to run more than once per page.
(function () {
  if (window.__qureoAppInjected) return;
  window.__qureoAppInjected = true;

  // Same rules as the all-white block in app/globals.css (keep in sync).
  var css = "[data-theme=\"light\"]{--night-bg:255 255 255 !important}.bg-brand-cloud[class*=\"min-h-\"]{background-color:#fff !important}html,body{background-color:#fff}[data-theme=\"light\"]{--night-surface:255 255 255 !important;--night-surface-2:255 255 255 !important} :root{--palette-cloud:255 255 255 !important} [data-theme=\"light\"] .dark-ui [class~=\"bg-brand-nightSurface\"] { box-shadow: 0 1px 2px rgb(21 19 15 / 0.05), 0 4px 14px rgb(21 19 15 / 0.06); } [data-theme=\"light\"] .dark-ui [class~=\"bg-brand-nightSurface\"]:not([class*=\"border\"]) { box-shadow: 0 0 0 1px rgb(21 19 15 / 0.08), 0 1px 2px rgb(21 19 15 / 0.05), 0 4px 14px rgb(21 19 15 / 0.06); } [data-theme=\"light\"] .dark-ui [class*=\"bg-brand-nightSurface2\"]:not([class*=\"border\"]) { box-shadow: 0 0 0 1px rgb(21 19 15 / 0.08); } .bg-brand-cloud:not([class*=\"min-h-\"]):not([class*=\"border\"]), [class*=\"bg-brand-cloud/\"]:not([class*=\"border\"]) { box-shadow: 0 0 0 1px rgb(21 19 15 / 0.08); } .bg-white.shadow-sm { box-shadow: 0 0 0 1px rgb(21 19 15 / 0.06), 0 1px 2px rgb(21 19 15 / 0.05), 0 4px 14px rgb(21 19 15 / 0.06); }";
  var style = document.createElement("style");
  style.id = "qureocity-app-style";
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  function parse(v) {
    var m = /rgba?\(([^)]+)\)/.exec(v || "");
    if (!m) return null;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some(isNaN)) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }

  function colorAt(x, y) {
    var el = document.elementFromPoint(x, y);
    var layers = [];
    while (el) {
      var c = parse(getComputedStyle(el).backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
      el = el.parentElement;
    }
    var rgb = [255, 255, 255];
    if (layers.length && layers[layers.length - 1][3] >= 1) {
      var base = layers.pop();
      rgb = [base[0], base[1], base[2]];
    }
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i], a = l[3];
      rgb = [l[0] * a + rgb[0] * (1 - a), l[1] * a + rgb[1] * (1 - a), l[2] * a + rgb[2] * (1 - a)];
    }
    return "#" + rgb.map(function (n) {
      var h = Math.round(Math.min(255, Math.max(0, n))).toString(16);
      return h.length < 2 ? "0" + h : h;
    }).join("");
  }

  var last = "", frame = 0, timer = 0;
  function sync() {
    frame = 0;
    var w = window.innerWidth, h = window.innerHeight;
    if (!w || !h || !document.body) return;
    var top = colorAt(w / 2, 1), bottom = colorAt(w / 2, h - 1);
    if (top + bottom === last) return;
    last = top + bottom;
    var cap = window.Capacitor;
    if (cap && cap.nativePromise) {
      cap.nativePromise("QureoSystemBars", "setColors", { statusBar: top, navigationBar: bottom })
        .catch(function () {});
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
    clearTimeout(timer);
    timer = setTimeout(function () { requestAnimationFrame(sync); }, 350);
  }

  function start() {
    schedule();
    new MutationObserver(schedule).observe(document.body, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "style", "open"]
    });
    new MutationObserver(schedule).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"]
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
