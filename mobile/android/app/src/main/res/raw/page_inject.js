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
  // Page runs underneath the navigation bar: same rules as the "Android
  // app" block in app/globals.css, plus overrides for the live site's
  // older inline styles that only knew about env(safe-area-inset-bottom).
  css +=
    '.dark-ui{padding-bottom:var(--qc-inset-bottom,0px)}' +
    '.fixed.inset-0{border-bottom:var(--qc-inset-bottom,0px) solid transparent}' +
    '[style*="safe-area-inset-bottom) + 12px"]{bottom:calc(var(--qc-inset-bottom,0px) + 12px) !important}' +
    '[style*="safe-area-inset-bottom) + 88px"]{bottom:calc(var(--qc-inset-bottom,0px) + 88px) !important}' +
    '[style*="safe-area-inset-bottom) + 94px"]{bottom:calc(var(--qc-inset-bottom,0px) + 94px) !important}' +
    '#qc-ptr{position:fixed;top:0;left:50%;z-index:2147483647;width:40px;height:40px;margin-left:-20px;' +
    'border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(21,19,15,.18);display:flex;' +
    'align-items:center;justify-content:center;pointer-events:none;opacity:0;transform:translateY(-48px)}' +
    '#qc-ptr svg{width:22px;height:22px}' +
    '#qc-ptr.qc-spin svg{animation:qc-ptr-spin .8s linear infinite}' +
    '@keyframes qc-ptr-spin{to{transform:rotate(360deg)}}';

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

  // ---- Pull to refresh ---------------------------------------------------
  // Pull down from the very top of a page to reload it, like in Chrome.
  // Ignored while a pop-up is open or when the finger is in a list that is
  // itself scrolled down.
  var THRESHOLD = 70, MAX = 110;
  var ptr = null, startX = 0, startY = 0, pulling = false, pull = 0, refreshing = false;

  function indicator() {
    if (ptr) return ptr;
    ptr = document.createElement("div");
    ptr.id = "qc-ptr";
    ptr.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#7b5a8e" stroke-width="2.6" stroke-linecap="round">' +
      '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/></svg>';
    document.body.appendChild(ptr);
    return ptr;
  }

  function scrolledAncestor(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollTop > 0) {
        var oy = getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll") return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function overlayOpen() {
    var els = document.querySelectorAll(".fixed.inset-0");
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      var cs = getComputedStyle(els[i]);
      if (r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden") return true;
    }
    return false;
  }

  function render() {
    var el = indicator();
    var p = Math.min(pull, MAX);
    el.style.transition = "none";
    el.style.opacity = String(Math.min(1, p / THRESHOLD));
    el.style.transform = "translateY(" + (p - 40) + "px) rotate(" + (p * 3) + "deg)";
  }

  function reset() {
    if (!ptr) return;
    ptr.style.transition = "transform .2s ease, opacity .2s ease";
    ptr.style.opacity = "0";
    ptr.style.transform = "translateY(-48px)";
  }

  document.addEventListener("touchstart", function (e) {
    pulling = false;
    if (refreshing || e.touches.length !== 1) return;
    var top = (document.scrollingElement || document.documentElement).scrollTop;
    if (top > 0 || overlayOpen() || scrolledAncestor(e.target)) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pulling = true;
    pull = 0;
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    if (!pulling) return;
    var dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
    if (dy <= 0 || (pull === 0 && Math.abs(dx) > dy)) {
      // Scrolling up, or a sideways swipe: not a pull.
      pulling = false;
      pull = 0;
      reset();
      return;
    }
    pull = dy * 0.5;
    render();
  }, { passive: true });

  function end() {
    if (!pulling) return;
    pulling = false;
    if (pull >= THRESHOLD) {
      refreshing = true;
      var el = indicator();
      el.style.transition = "transform .2s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(" + (THRESHOLD - 30) + "px)";
      el.className = "qc-spin";
      location.reload();
    } else {
      reset();
    }
    pull = 0;
  }
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
