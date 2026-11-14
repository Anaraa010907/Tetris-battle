// Host menu capsule: part of every playable shell (inline it as a classic
// script before the game script and call adoptHostGeometry() once).
//
// Every client draws one menu capsule (author avatar + exit) in the top-right
// corner, just under the status bar; the top-left corner belongs to the game.
// The constants below are the contract the upload check enforces (rules H1-H4):
// nothing readable or tappable inside MENU_BOX, nothing above SAFE_TOP or
// outside the EDGE_GUARD columns, no taps below SAFE_BOTTOM. They mirror
// layout.css :root and game-tools/src/review_contract.rs (HOST_*); change all
// three together.
//
// Like TikTok / WeChat mini games, the top bar sits on the capsule's centre
// line when the host reports the real capsule: it may then rise above
// SAFE_TOP, but its top stays at or below capsule.top - 4 (the checks allow
// exactly that for items left of the menu box). The second row starts 8 px
// under the capsule and the bar; while it is still beside the menu box
// (above y 168) it stops at x 372. Nothing ever enters MENU_BOX.
//
// Sources, in order:
//   1. window.mable.getMenuButtonBoundingClientRect(): synchronous, canvas
//      logical px { left, top, right, bottom, width, height }, injected by the
//      host before the game script runs. A rect taller than a capsule (the
//      host's MENU_BOX fallback) means "no real capsule".
//   2. `mable:host-geometry` message: the rect with role "menu" is the
//      capsule. Older hosts send no "menu"; their buttons on the right half
//      (back / more / app) only nudge the bar inside y 98..160, and the left
//      half and edge-guard / browser-* bands are ignored.
//   3. Neither: MENU_BOX, top bar y 98..150, second row from y 168.

var MABLE_HOST = {
  canvas: { width: 504, height: 1092 },
  menuBox: { x: 380, y: 0, width: 124, height: 160 },
  safeTop: 98,
  safeBottom: 970,
  edgeGuard: 22,
  topBarH: 52,
  rowGap: 8,
  // Sound toggle (games with audio): this size, at the bar's left end, centred
  // on it; the bar's other items start soundGap after it.
  soundSize: 44,
  soundGap: 12,
  // The bar's top may sit this far above the capsule's top, no further.
  capsuleSlack: 4,
  // Anything taller is a reserved box, not a capsule (32pt is ~45 px at most).
  capsuleMaxH: 64,
};

function hostFinite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// A clamped { left, top, right, bottom, width, height } or null.
function hostRect(left, top, right, bottom) {
  var W = MABLE_HOST.canvas.width, H = MABLE_HOST.canvas.height;
  if (![left, top, right, bottom].every(hostFinite)) return null;
  var clamp = function (v, hi) { return Math.min(hi, Math.max(0, v)); };
  var l = clamp(left, W), t = clamp(top, H), r = clamp(right, W), b = clamp(bottom, H);
  if (!(r > l) || !(b > t)) return null;
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}

// A real capsule: on the right half, near the top, capsule-sized.
function hostCapsule(rect) {
  var W = MABLE_HOST.canvas.width, H = MABLE_HOST.canvas.height;
  if (!rect || rect.height > MABLE_HOST.capsuleMaxH || rect.left + rect.width / 2 < W / 2 || rect.top > H / 4) return null;
  rect.menu = true;
  return rect;
}

// The capsule from the synchronous host API, or null.
function readMenuButton() {
  try {
    var api = window.mable && window.mable.getMenuButtonBoundingClientRect;
    var rect = typeof api === 'function' ? api.call(window.mable) : null;
    if (!rect) return null;
    var right = hostFinite(rect.right) ? rect.right : rect.left + rect.width;
    var bottom = hostFinite(rect.bottom) ? rect.bottom : rect.top + rect.height;
    return hostCapsule(hostRect(rect.left, rect.top, right, bottom));
  } catch (_error) {
    return null;
  }
}

// The capsule from a mable:host-geometry payload, or null. `menu` is true
// only for a role "menu" rect (a capsule host).
function readHostGeometry(payload) {
  if (!payload || !payload.canvas || !hostFinite(payload.canvas.width) || !hostFinite(payload.canvas.height)) return null;
  var rects = Array.isArray(payload.occlusionRects) ? payload.occlusionRects : [];
  var W = MABLE_HOST.canvas.width, H = MABLE_HOST.canvas.height;
  var capsule = null;
  for (var i = 0; i < rects.length; i++) {
    var r = rects[i];
    if (!r) continue;
    var role = String(r.role || '');
    if (role === 'edge-guard' || role.indexOf('browser-') === 0) continue;
    var box = hostRect(r.x, r.y, r.x + r.width, r.y + r.height);
    if (role === 'menu') {
      var menu = hostCapsule(box);
      if (menu) return menu;
      continue;
    }
    // Position decides, not the role name: a back button on the right is part
    // of the buttons there, and nothing on the left is.
    if (!box || box.left + box.width / 2 < W / 2 || box.top > H / 4 || box.width * box.height > W * H * 0.05) continue;
    capsule = capsule
      ? hostRect(Math.min(capsule.left, box.left), Math.min(capsule.top, box.top), Math.max(capsule.right, box.right), Math.max(capsule.bottom, box.bottom))
      : box;
  }
  return capsule;
}

// The top of the visible canvas from a mable:host-geometry payload (0 if none).
function readVisibleTop(payload) {
  var v = payload && payload.visibleRect;
  return v && hostFinite(v.y) ? Math.min(MABLE_HOST.safeTop, Math.max(0, v.y)) : 0;
}

// Layout numbers for a capsule rect (null: the MENU_BOX fallback).
function hostLayout(capsule, visibleTop) {
  var h = MABLE_HOST, m = h.menuBox, W = h.canvas.width;
  var menuBottom = m.y + m.height;
  var round = function (v) { return Math.round(v * 10) / 10; };
  var barH = h.topBarH, top, rowTop;
  if (capsule && capsule.menu) {
    // Centre on the capsule; shrink the bar rather than rise above capsule.top - 4.
    barH = Math.min(h.topBarH, capsule.height + 2 * h.capsuleSlack);
    top = Math.max(capsule.top + capsule.height / 2 - barH / 2, capsule.top - h.capsuleSlack, hostFinite(visibleTop) ? visibleTop : 0);
    top = Math.min(top, menuBottom - barH);
    rowTop = Math.max(capsule.bottom, top + barH) + h.rowGap;
  } else {
    // No capsule, or an older host's buttons: stay in y 98..160.
    var min = h.safeTop + h.topBarH / 2, max = menuBottom - h.topBarH / 2;
    var centre = capsule ? Math.min(max, Math.max(min, capsule.top + capsule.height / 2)) : min;
    top = centre - barH / 2;
    rowTop = menuBottom + h.rowGap;
  }
  top = round(top);
  rowTop = round(rowTop);
  var beside = rowTop < menuBottom + h.rowGap;
  return {
    menuBox: { left: m.x, top: m.y, right: m.x + m.width, bottom: menuBottom },
    capsule: capsule,
    rowCenter: round(top + barH / 2),
    topBar: { left: h.edgeGuard, right: m.x - h.rowGap, top: top, bottom: round(top + barH) },
    // Where a canvas-drawn sound toggle goes; other bar items from its right + soundGap.
    // Never above the bar's top (a short capsule makes the bar shorter than 44).
    soundButton: {
      left: h.edgeGuard,
      top: round(Math.max(top, top + barH / 2 - h.soundSize / 2)),
      right: h.edgeGuard + h.soundSize,
      bottom: round(Math.max(top, top + barH / 2 - h.soundSize / 2) + h.soundSize),
    },
    soundGap: h.soundGap,
    rowTop: rowTop,
    // Right edge of the second row: beside the menu box it stops at x 372.
    rowRight: beside ? m.x - h.rowGap : W - h.edgeGuard,
    safeTop: h.safeTop,
    safeBottom: h.safeBottom,
    edgeGuard: h.edgeGuard,
  };
}

function adoptHostGeometry(onChange) {
  var root = document.documentElement;
  var W = MABLE_HOST.canvas.width;
  var legacy = null, visibleTop = 0;
  var last = '';
  function apply() {
    var layout = hostLayout(readMenuButton() || legacy, visibleTop);
    var bar = layout.topBar;
    var key = [bar.top, bar.bottom, layout.rowTop, layout.rowRight].join();
    if (key === last) return layout;
    last = key;
    root.style.setProperty('--top-bar-top', bar.top + 'px');
    root.style.setProperty('--top-bar-h', Math.round((bar.bottom - bar.top) * 10) / 10 + 'px');
    root.style.setProperty('--host-row-center', layout.rowCenter + 'px');
    root.style.setProperty('--row-top', layout.rowTop + 'px');
    root.style.setProperty('--row-right', W - layout.rowRight + 'px');
    if (typeof onChange === 'function') onChange(layout);
    return layout;
  }
  function receive(event) {
    var payload = event && event.data;
    if (!payload || payload.type !== 'mable:host-geometry' || payload.version !== 1) return;
    legacy = readHostGeometry(payload);
    visibleTop = readVisibleTop(payload);
    apply();
  }
  window.addEventListener('message', receive);
  window.addEventListener('resize', apply);
  if (window.__mableHostGeometry) receive({ data: window.__mableHostGeometry });
  try {
    window.parent.postMessage({ type: 'mable:host-geometry-request', version: 1 }, '*');
  } catch (_error) {
    // No parent, or a parent that refuses the message. MENU_BOX stays in force.
  }
  apply();
  return function () {
    window.removeEventListener('message', receive);
    window.removeEventListener('resize', apply);
  };
}

adoptHostGeometry();