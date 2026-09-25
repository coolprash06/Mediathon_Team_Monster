/* =============================================================================
   Rush Hour - exploring the lit room
   -----------------------------------------------------------------------------
   Once the lamp is on, the three desktops and two filing cabinets respond.

   How a zoom works: the whole 3D render (.camera) is scaled and translated in
   2D so the clicked object lands exactly on the rectangle its close-up will
   occupy, then the close-up (#views) fades in over it. Moving the eye through
   the 3D room would clip through chairs and the desk; a lens zoom never does.

   Flows (every step can be abandoned with Back to Room / Escape):
     room -> monitor -> slideshow
     room -> cabinet -> drawer open -> take file -> (file flies to the desk)
          -> desk -> open file (spread) / put it back (file flies home)
============================================================================= */
(function () {
  'use strict';

  var RH = window.RushHour;
  var STAGE_W = 1600;

  var app = document.getElementById('app');
  var viewport = document.getElementById('viewport');
  var stage = document.getElementById('stage');
  var camera = document.getElementById('camera');
  var backBtn = document.getElementById('back-btn');
  var targetLabel = document.getElementById('target-label');

  var scene = RH.scene;
  var geo = RH.world.file;
  var photos = RH.photos || [];

  var TIMES = {
    'morning-rush': 'Morning Rush',
    'afternoon-rush': 'Afternoon Rush',
    'peak-rush': 'Peak Rush'
  };
  /** How far a room drawer slides out (matches .drawer.is-pulled in room.css) */
  var ROOM_PULL = 170;
  var ZOOM_MS = 1100;

  /** Matches .ccab's perspective and .cd.is-open's translateZ in views.css,
   *  and the leaned-in eye (LEAN_IN) below - used to counter the vertical
   *  parallax an opened drawer would otherwise pick up (see buildCloseCabinet). */
  var CCAB_PERSPECTIVE = 1100;
  var CD_OPEN_Z = 190;
  /** Headroom above the cabinet, in close-up px, for the file an open drawer
   *  lifts clear of its footprint (see --head in views.css). */
  var CCAB_HEAD = 112;

  /** Close-up px per room px at the cabinets' distance: the room's 1200px
   *  perspective seen from the cabinet fronts, expressed in the close-up's
   *  1100px one. Turns a room eye position into a close-up eye position. */
  var CCAB_EYE_R = CCAB_PERSPECTIVE / (1200 - (geo.drawerZ + geo.drawerDepth / 2));
  /** How far the room's eye sits above a cabinet's top edge, in close-up px.
   *  The close-up holds this height so the cabinet keeps the exact angle it
   *  had in the room; only the sideways offset is levelled out (LEAN_IN). */
  var CABINET_EYE_Y = -(RH.world.FLOOR - 532) * CCAB_EYE_R;

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function motionOn() { return !reduceQuery.matches; }

  /* ---------------------------------------------------------------- utils */

  function $(id) { return document.getElementById(id); }
  function noop() {}
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ms(n) { return motionOn() ? n : 0; }
  function nextFrame() { return new Promise(function (r) { window.requestAnimationFrame(function () { r(); }); }); }

  /** Pause between steps. Under reduced motion it collapses to two frames:
   *  enough for the 1ms transitions room.css leaves behind to settle, so a
   *  just-shown view is really visible before anything inside it is focused. */
  function wait(n) {
    if (!motionOn()) return nextFrame().then(nextFrame);
    return new Promise(function (r) { window.setTimeout(r, n); });
  }

  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  /** Apply a state change with every transition inside `node` switched off. */
  function instantly(node, fn) {
    node.classList.add('is-instant');
    fn();
    void node.offsetWidth;
    node.classList.remove('is-instant');
  }

  function decoded(img) {
    return img.decode ? img.decode().catch(noop) : Promise.resolve();
  }

  function preload(src) {
    var i = new Image();
    i.src = src;
  }

  /* ---------------------------------------------------------------- state */

  var state = {
    view: 'room', // room | monitor | cabinet | desk | spread
    busy: false,
    origin: null, // the room object to hand focus back to
    slot: null, // monitor: morning-rush | afternoon-rush | peak-rush
    slides: [],
    index: 0,
    cabinet: -1,
    drawer: -1, // open drawer in the cabinet close-up
    file: null // { cabinet, drawer, category, label, photos, index }
  };

  /** Bumped by every flow; a flow that sees a newer number has been cancelled. */
  var flow = 0;

  /* ------------------------------------------------------------ the camera */

  /* Every camera move and file flight runs inside .is-moving. See "a moving
     camera" in room.css for what that class buys: while the camera travels,
     nothing inside the room repaints, so every frame is drawn purely from
     tiles that already exist. */
  var moveTimer = 0;

  function beginMove(dur) {
    if (!dur) return;
    app.classList.add('is-moving');
    window.clearTimeout(moveTimer);
    // Outlast the tween: the last frame, and the clip and layer changes
    // that come with settling, must land inside the quiet window too.
    moveTimer = window.setTimeout(endMove, dur + 120);
  }

  function endMove() {
    window.clearTimeout(moveTimer);
    app.classList.remove('is-moving');
  }

  /* How the camera moves, and why it is not a CSS transition.

     The room is ~390 composited 3D surfaces. When a CSS transform transition
     starts, Chrome re-rasterises every layer under it at the animation's
     MAXIMUM scale - ~4.5x for a desktop, times the screen's pixel ratio - all
     at once, before the first frame. It cannot, so it skips frames (the
     stall at the start of a zoom) and then draws with tiles missing (the
     black patches). Back to Room is worse: the whole room swings into view
     needing tiles at the zoomed-in scale.

     So the camera is tweened here, one frame at a time, and .camera always
     carries will-change: transform (room.css). Under that hint, and with no
     animation for Chrome to plan around, a layer keeps the raster it already
     has: the room is painted once, at its resting resolution, and every
     zoom, pan and flight after that only moves those tiles. Nothing is
     repainted, so nothing can be missing. The price is that the room behind
     a close-up is an upscaled copy - soft, like a lens focused on the
     close-up in front of it - which is where the eye is anyway.

     (Do not turn this back into a CSS transition: with the hint on, Chrome
     would raster the whole room at the zoomed-in scale and keep it there,
     which does not fit in tile memory and blanks the room entirely.)

     The one-off lift: a pinned layer is never kept below the screen's own
     pixel density, and the far walls rest below it (they are small in
     perspective). The first time the camera changes at all, every one of
     them is repainted up to that floor at once. primeRaster() makes that
     happen while the room is still dark and fading in, not on the first
     zoom. */
  var cam = { z: 1, x: 0, y: 0 };
  var camFrame = 0;

  /** cubic-bezier(x1, y1, x2, y2) as a function of linear progress 0..1 */
  function bezier(x1, y1, x2, y2) {
    function at(a, b, t) { return ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t; }
    return function (p) {
      if (p <= 0 || p >= 1) return p <= 0 ? 0 : 1;
      var lo = 0, hi = 1, t = p;
      for (var i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        if (at(x1, x2, t) < p) lo = t; else hi = t;
      }
      return at(y1, y2, t);
    };
  }
  var zoomEase = bezier(0.65, 0, 0.25, 1); // --zoom-ease in views.css

  function atRest(c) { return Math.abs(c.z - 1) < 1e-4 && Math.abs(c.x) < 0.01 && Math.abs(c.y) < 0.01; }

  function writeCamera() {
    camera.style.transform = 'translate(' + cam.x.toFixed(2) + 'px,' + cam.y.toFixed(2) + 'px) scale(' + cam.z.toFixed(4) + ')';
  }

  function setCamera(z, x, y, dur) {
    var to = { z: z, x: x, y: y };
    window.cancelAnimationFrame(camFrame);
    beginMove(dur);
    if (!dur) {
      cam = to;
      writeCamera();
      return;
    }
    var from = { z: cam.z, x: cam.x, y: cam.y };
    var t0 = -1;
    camFrame = window.requestAnimationFrame(function step(now) {
      if (t0 < 0) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      var e = zoomEase(p);
      cam = { z: from.z + (to.z - from.z) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      writeCamera();
      if (p < 1) camFrame = window.requestAnimationFrame(step);
    });
  }

  /** Settle the room's raster before anyone zooms: see "the one-off lift"
   *  above. A 0.01% nudge of the camera is enough for Chrome to re-evaluate
   *  every layer; two frames later the camera is back where it was. Only
   *  ever done with the camera at rest in the room. */
  function primeRaster() {
    if (!atRest(cam) || state.view !== 'room') return;
    camera.style.transform = 'scale(1.0001)';
    nextFrame().then(nextFrame).then(function () {
      if (atRest(cam) && state.view === 'room') writeCamera();
    });
  }

  /** After a resize: the hint would keep the room at its OLD resting
   *  resolution (soft, if the window grew). Let go of it for a couple of
   *  frames so Chrome repaints at the new size, then pin and settle again. */
  function repinRaster() {
    // The stage eases to its new fit (.is-fitted .stage in room.css); let
    // that land first, or Chrome is still mid-animation and changes nothing.
    var settling = stage.getAnimations().map(function (a) { return a.finished.catch(noop); });
    Promise.all(settling).then(function () {
      if (!atRest(cam) || state.view !== 'room') return null;
      camera.classList.add('is-unpinned');
      return nextFrame().then(nextFrame).then(function () {
        camera.classList.remove('is-unpinned');
        return nextFrame();
      }).then(primeRaster);
    });
  }

  /** The stage's settled fit, as main.js last set it. */
  function stageFit() {
    var st = stage.style;
    return {
      s: parseFloat(st.getPropertyValue('--s')) || 1,
      x: parseFloat(st.getPropertyValue('--tx')) || 0,
      y: parseFloat(st.getPropertyValue('--ty')) || 0
    };
  }

  function cameraNow() { return cam; }

  /** A room element's on-screen box, in stage px, as if the camera were at rest. */
  function roomBox(node) {
    var r = node.getBoundingClientRect();
    var sr = stage.getBoundingClientRect();
    var s = sr.width / STAGE_W;
    var c = cameraNow();
    return {
      x: ((r.left - sr.left) / s - c.x) / c.z,
      y: ((r.top - sr.top) / s - c.y) / c.z,
      w: r.width / s / c.z,
      h: r.height / s / c.z
    };
  }

  /** A client-px rectangle, in stage px. */
  function screenBox(r) {
    var f = stageFit();
    return { x: (r.left - f.x) / f.s, y: (r.top - f.y) / f.s, w: r.width / f.s, h: r.height / f.s };
  }

  function union(a, b) {
    var x = Math.min(a.x, b.x);
    var y = Math.min(a.y, b.y);
    return { x: x, y: y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }

  /** Zoom so room box `src` lands on stage box `dst`. */
  function aim(src, dst, dur) {
    var z = Math.min(dst.w / src.w, dst.h / src.h);
    setCamera(z,
      dst.x + dst.w / 2 - z * (src.x + src.w / 2),
      dst.y + dst.h / 2 - z * (src.y + src.h / 2), dur);
  }

  /** Cabinet + desk, with headroom above for the folder's arc between them. */
  function flightBox(ci) {
    var b = union(roomBox(cavityOf(ci)), roomBox(deskTop));
    return { x: b.x, y: b.y - 50, w: b.w, h: b.h + 50 };
  }

  /** Zoom so a room box fills `fill` of the window, centred. */
  function aimWide(src, fill, dur) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    aim(src, screenBox({ left: vw * (1 - fill) / 2, top: vh * (1 - fill) / 2, width: vw * fill, height: vh * fill }), dur);
  }

  /* -------------------------------------------------------- room pieces */

  var monitorFace = function (node) { return node.querySelector('.crt-face'); };
  var cavityOf = function (ci) { return scene.cabinets[ci].querySelector('.cab-cavity'); };
  var deskTop = scene.desk.faces.top;

  /** roomDrawers[cabinet][k] -> the 3D drawer box in the room */
  var roomDrawers = scene.cabinets.map(function (c) {
    return Array.prototype.slice.call(c.querySelectorAll('.drawer'));
  });

  var CATEGORY_ORDER = [];
  roomDrawers.forEach(function (list) {
    list.forEach(function (d) { if (d.dataset.label) CATEGORY_ORDER.push(d.dataset.category); });
  });

  function locationName(slug) {
    for (var ci = 0; ci < roomDrawers.length; ci++) {
      for (var k = 0; k < roomDrawers[ci].length; k++) {
        if (roomDrawers[ci][k].dataset.category === slug) return roomDrawers[ci][k].dataset.label;
      }
    }
    return slug;
  }

  function pullRoomDrawer(ci, k, out) {
    roomDrawers[ci][k].classList.toggle('is-pulled', out);
  }

  function closeRoomDrawers() {
    roomDrawers.forEach(function (list) {
      list.forEach(function (d) { d.classList.remove('is-pulled'); });
    });
  }

  /** The close-up only matches the room cabinet's CLOSED footprint (see
   *  buildCloseCabinet); once a drawer pulls forward, perspective grows and
   *  shifts its projection past that footprint. Hide the real cabinet behind
   *  the close-up rather than trust the two 3D renders to stay pixel-aligned. */
  function hideRoomCabinet(ci) {
    scene.cabinets[ci].classList.add('is-behind-closeup');
  }

  function showRoomCabinet(ci) {
    scene.cabinets[ci].classList.remove('is-behind-closeup');
  }

  /* ------------------------------------------------ the travelling file */

  var travel = scene.file;
  var travelLabel = travel.querySelector('.tf-label');
  var travelAnim = null;

  function fileAt(where, ci, k) {
    var x = geo.cabinetX[ci];
    var top = geo.drawerTop(k);
    var z = geo.drawerZ + ROOM_PULL;
    var d = geo.drop;
    switch (where) {
      case 'inside': return { x: x, y: top + 62, z: z, ry: 0, rx: 0, rz: 0 };
      case 'above': return { x: x, y: top - 70, z: z, ry: 0, rx: 0, rz: 0 };
      case 'arc': return { x: (x + d.x + 75) / 2, y: Math.min(top - 70, d.y - 100) - 40, z: (z + d.z) / 2 + 60, ry: -24, rx: 42, rz: -4 };
      // #file-drop marks the folder's back-left corner on the desk
      default: return { x: d.x + 75, y: d.y, z: d.z + 56, ry: 0, rx: 90, rz: -8 };
    }
  }

  function pose(p) {
    return 'translate3d(' + p.x + 'px,' + p.y + 'px,' + p.z + 'px) rotateY(' + p.ry + 'deg) rotateX(' + p.rx + 'deg) rotateZ(' + p.rz + 'deg)';
  }

  /** Animate the folder through the given poses (offsets spread evenly). */
  function flyFile(poses, dur, easing) {
    var f = state.file;
    var frames = poses.map(function (w) { return { transform: pose(fileAt(w, f.cabinet, f.drawer)) }; });
    travel.style.transform = frames[frames.length - 1].transform;
    if (travelAnim) travelAnim.cancel();
    if (!motionOn()) return Promise.resolve();
    beginMove(dur); // the folder crosses the room; hold the room still for it
    travelAnim = travel.animate(frames, { duration: dur, easing: easing || 'cubic-bezier(0.45, 0, 0.25, 1)' });
    return travelAnim.finished.catch(noop);
  }

  function hideTravelFile() {
    if (travelAnim) travelAnim.cancel();
    travelAnim = null;
    travel.classList.remove('is-visible');
  }

  /* ============================================================ monitor view */

  var mon = {
    view: $('view-monitor'),
    title: $('monitor-title'),
    wrap: $('ccrt-wrap'),
    crt: $('ccrt'),
    feed: $('ccrt-feed'),
    cam: $('ccrt-cam'),
    slotLabel: $('ccrt-slot'),
    play: $('ccrt-play'),
    photo: $('ccrt-photo'),
    tag: $('ccrt-tag'),
    where: $('ccrt-where'),
    count: $('ccrt-count'),
    prev: $('ccrt-prev'),
    next: $('ccrt-next')
  };

  function fitMonitor() {
    var r = mon.wrap.parentNode.getBoundingClientRect();
    mon.wrap.style.setProperty('--k', Math.max(0.5, Math.min(r.width / 216, r.height / 200)).toFixed(4));
  }

  function dressMonitor(node) {
    var slot = node.dataset.slot;
    var cam = node.querySelector('.osd-cam').textContent;
    state.slot = slot;
    state.slides = photos.filter(function (p) { return p.time === slot; });
    state.index = 0;
    mon.title.textContent = TIMES[slot] + ' desktop';
    mon.feed.className = 'crt-feed crt-feed--' + slot;
    mon.cam.textContent = cam;
    mon.tag.textContent = cam + ' ▶ PLAY';
    mon.slotLabel.textContent = TIMES[slot].toUpperCase();
    mon.play.textContent = 'Click to See Pictures from the ' + TIMES[slot];
    mon.play.hidden = false;
    mon.crt.classList.remove('is-playing', 'is-switching');
    mon.photo.removeAttribute('src');
    if (state.slides.length) preload(state.slides[0].src);
  }

  async function openMonitor(node) {
    if (!canExplore()) return;
    var id = ++flow;
    state.busy = true;
    state.view = 'monitor';
    state.origin = node;
    dressMonitor(node);
    enterZoom();
    fitMonitor();
    await nextFrame();
    if (id !== flow) return;
    aim(roomBox(monitorFace(node)), screenBox(mon.wrap.getBoundingClientRect()), ms(ZOOM_MS));
    await wait(ZOOM_MS - 300);
    if (id !== flow) return;
    showView(mon.view);
    await wait(450);
    if (id !== flow) return;
    state.busy = false;
    mon.play.focus({ preventScroll: true });
  }

  function startSlideshow() {
    if (state.busy || state.view !== 'monitor') return;
    mon.play.hidden = true;
    mon.crt.classList.add('is-playing');
    if (!state.slides.length) {
      mon.where.textContent = '';
      mon.count.textContent = 'NO TAPES YET';
      mon.prev.hidden = mon.next.hidden = true;
      return;
    }
    mon.prev.hidden = mon.next.hidden = state.slides.length < 2;
    showSlide(0);
    (mon.next.hidden ? backBtn : mon.next).focus({ preventScroll: true });
  }

  var slideTimer = 0;

  function showSlide(i) {
    var n = state.slides.length;
    state.index = (i + n) % n;
    var p = state.slides[state.index];
    var shown = state.index;
    mon.crt.classList.add('is-switching');
    window.clearTimeout(slideTimer);
    slideTimer = window.setTimeout(function () {
      mon.photo.src = p.src;
      mon.photo.alt = p.caption;
      mon.where.textContent = locationName(p.location).toUpperCase();
      mon.count.textContent = pad(shown + 1) + ' / ' + pad(n);
      decoded(mon.photo).then(function () {
        if (state.index === shown) mon.crt.classList.remove('is-switching');
      });
    }, ms(130));
    preload(state.slides[(state.index + 1) % n].src);
  }

  function stepSlide(d) {
    if (state.view !== 'monitor' || !mon.crt.classList.contains('is-playing') || state.slides.length < 2) return;
    showSlide(state.index + d);
  }

  mon.play.addEventListener('click', startSlideshow);
  mon.prev.addEventListener('click', function () { stepSlide(-1); });
  mon.next.addEventListener('click', function () { stepSlide(1); });

  /* ============================================================ cabinet view */

  var cab = {
    view: $('view-cabinet'),
    title: $('cabinet-title'),
    wrap: $('ccab-wrap'),
    box: $('ccab'),
    prompt: $('cab-prompt'),
    take: $('cab-take'),
    ret: $('cab-return'),
    drawers: []
  };

  /* The close-up cabinet uses the room cabinet's exact measurements
     (see buildCabinet in scene.js): 215 x 532, drawers 124 tall every 128. */
  (function buildCloseCabinet() {
    var body = el('div', 'ccab-body', cab.box);
    el('div', 'cc-cavity', body);
    el('div', 'cc-top m-olive', body);
    el('div', 'cc-side cc-side--l m-olive', body);
    el('div', 'cc-side cc-side--r m-olive', body);
    ['top', 'l', 'r', 'kick'].forEach(function (s) { el('div', 'cc-rim cc-rim--' + s + ' m-olive', body); });

    for (var k = 0; k < 4; k++) {
      var d = el('div', 'cd', body);
      var top = 8 + 128 * k;
      d.style.top = top + 'px';
      // Under the leaned-in perspective-origin, pulling a drawer toward the
      // camera (translateZ) also drags it visually down/up toward the eye's
      // own vanishing point - enough for a middle drawer to slide over the
      // labelled drawer below it. Counter that drift so opening a drawer
      // only grows it in place, whatever row it's in.
      var growth = CCAB_PERSPECTIVE / (CCAB_PERSPECTIVE - CD_OPEN_Z);
      var driftFix = (top + 62 - CABINET_EYE_Y) * (1 - growth) / growth;
      d.style.setProperty('--open-dy', driftFix.toFixed(1) + 'px');
      el('div', 'cd-floor', d);
      el('div', 'cd-back', d);
      el('div', 'cd-wall cd-wall--l m-olive', d);
      el('div', 'cd-wall cd-wall--r m-olive', d);
      el('span', 'cd-tab', el('div', 'cd-folder cd-folder--spare cd-folder--c', d));
      el('span', 'cd-tab', el('div', 'cd-folder cd-folder--spare cd-folder--b', d));
      var folder = el('button', 'cd-folder', d);
      folder.type = 'button';
      var tabLabel = el('span', 'cd-tab-label', el('span', 'cd-tab', folder));
      var front = el('button', 'cd-front m-olive', d);
      front.type = 'button';
      var card = el('span', 'label-card', el('span', 'label-holder', front));
      el('span', 'drawer-pull', front);

      cab.drawers.push({ el: d, front: front, folder: folder, card: card, tabLabel: tabLabel, category: '', label: '' });
      front.addEventListener('click', toggleDrawer.bind(null, k));
      folder.addEventListener('click', takeFile);
      d.querySelector('.cd-floor').addEventListener('click', takeFile);
    }
  })();

  /** Fit the cabinet to its slot, keeping CCAB_HEAD of clear sky above it for
   *  the file an open drawer lifts out (see --head in views.css). */
  function fitCabinet() {
    var r = cab.wrap.parentNode.getBoundingClientRect();
    cab.wrap.style.setProperty('--head', CCAB_HEAD + 'px');
    cab.wrap.style.setProperty('--k',
      Math.max(0.3, Math.min(r.width / 215, r.height / (532 + CCAB_HEAD))).toFixed(4));
  }

  /** Where the room's eye sits relative to cabinet ci, in close-up units,
   *  so the first frame of the close-up sees it from the same angle. */
  function roomEye(ci) {
    return { x: 107.5 - geo.cabinetX[ci] * CCAB_EYE_R, y: CABINET_EYE_Y };
  }

  function setEye(p) {
    cab.box.style.setProperty('--eye-x', p.x.toFixed(1) + 'px');
    cab.box.style.setProperty('--eye-y', p.y.toFixed(1) + 'px');
  }

  /** The cabinets stand off to the right of the room, so the room sees them
   *  from their left. The close-up slides the eye round to dead centre, which
   *  is what "look closer" means here - and keeps the room's own height, so
   *  the cabinet settles front-on at the angle it already had rather than
   *  tipping into a plan view the visitor never asked for. */
  var LEAN_IN = { x: 107.5, y: CABINET_EYE_Y };

  function dressCabinet(ci) {
    state.cabinet = ci;
    state.drawer = -1;
    cab.title.textContent = 'Filing cabinet ' + (ci + 1);
    instantly(cab.box, function () {
      cab.drawers.forEach(function (d, k) {
        var src = roomDrawers[ci][k];
        d.label = src.dataset.label;
        d.category = src.dataset.category;
        d.card.textContent = d.label;
        d.tabLabel.textContent = d.label;
        d.el.className = 'cd ' + (d.label ? 'cd--file' : 'cd--empty');
        d.front.disabled = !d.label;
        d.front.setAttribute('aria-label', d.label ? d.label + ' drawer' : 'Empty drawer');
        d.folder.setAttribute('aria-label', 'Take the ' + d.label + ' file');
        d.folder.tabIndex = -1;
      });
    });
    updateCabinetActions();
  }

  function updateCabinetActions() {
    var open = state.drawer >= 0;
    cab.prompt.hidden = open;
    cab.take.hidden = !open;
    cab.ret.hidden = !open;
    if (open) cab.take.textContent = 'Take the file';
  }

  async function openCabinet(ci) {
    if (!canExplore()) return;
    var id = ++flow;
    state.busy = true;
    state.view = 'cabinet';
    state.origin = scene.cabinets[ci];
    dressCabinet(ci);
    instantly(cab.box, function () { setEye(roomEye(ci)); });
    enterZoom();
    fitCabinet();
    await nextFrame();
    if (id !== flow) return;
    aim(roomBox(cavityOf(ci)), screenBox(cab.wrap.getBoundingClientRect()), ms(ZOOM_MS));
    await wait(ZOOM_MS - 300);
    if (id !== flow) return;
    showView(cab.view);
    hideRoomCabinet(ci); // the close-up now covers it exactly; stop trusting alignment
    await wait(120);
    setEye(LEAN_IN); // the camera leans in over the cabinet
    await wait(330);
    if (id !== flow) return;
    state.busy = false;
    var first = cab.drawers.filter(function (d) { return d.label; })[0];
    if (first) first.front.focus({ preventScroll: true });
  }

  function toggleDrawer(k) {
    if (state.busy || state.view !== 'cabinet') return;
    var d = cab.drawers[k];
    if (!d.label) return;
    if (state.drawer === k) {
      closeDrawer();
      return;
    }
    if (state.drawer >= 0) {
      cab.drawers[state.drawer].el.classList.remove('is-open');
      cab.drawers[state.drawer].folder.tabIndex = -1;
      pullRoomDrawer(state.cabinet, state.drawer, false);
    }
    state.drawer = k;
    d.el.classList.add('is-open');
    d.folder.tabIndex = 0;
    pullRoomDrawer(state.cabinet, k, true); // hidden behind the close-up
    updateCabinetActions();
  }

  function closeDrawer() {
    if (state.busy || state.view !== 'cabinet' || state.drawer < 0) return;
    var d = cab.drawers[state.drawer];
    d.el.classList.remove('is-open');
    d.folder.tabIndex = -1;
    pullRoomDrawer(state.cabinet, state.drawer, false);
    state.drawer = -1;
    updateCabinetActions();
    d.front.focus({ preventScroll: true });
  }

  cab.take.addEventListener('click', takeFile);
  cab.ret.addEventListener('click', closeDrawer);

  /* ================================================ file: drawer -> desk */

  var desk = {
    view: $('view-desk'),
    title: $('desk-title'),
    scene: $('desk-scene'),
    cam: $('desk-cam'),
    folder: $('folder'),
    sheet: document.querySelector('.folder-sheet'),
    coverFront: $('cover-front'),
    coverTab: $('cover-tab'),
    coverLabel: $('cover-label'),
    recNo: $('rec-no'),
    recTitle: $('rec-title'),
    recMeta: $('rec-meta'),
    recList: $('rec-list'),
    print: $('print'),
    img: $('print-img'),
    cap: $('sheet-cap'),
    count: $('page-count'),
    prev: $('page-prev'),
    next: $('page-next'),
    open: $('file-open'),
    ret: $('file-return'),
    close: $('file-close')
  };

  async function takeFile() {
    if (state.busy || state.view !== 'cabinet' || state.drawer < 0) return;
    var id = ++flow;
    state.busy = true;
    var ci = state.cabinet;
    var k = state.drawer;
    var d = cab.drawers[k];
    state.file = {
      cabinet: ci,
      drawer: k,
      category: d.category,
      label: d.label,
      photos: photos.filter(function (p) { return p.location === d.category; }),
      index: 0
    };
    dressFolder();

    // 1. Lift it clear of the drawer in the close-up
    d.el.classList.add('is-lifting');
    await wait(560);
    if (id !== flow) return;

    // 2. Cut back to the room: the real drawer is out, the folder above it
    travelLabel.textContent = d.label;
    travel.style.transform = pose(fileAt('above', ci, k));
    travel.classList.add('is-visible');
    showRoomCabinet(ci);
    hideView(cab.view);
    await wait(220);
    if (id !== flow) return;

    // 3. Pull back to hold cabinet and desk in frame while it flies over
    aimWide(flightBox(ci), 0.86, ms(1400));
    await flyFile(['above', 'arc', 'desk'], ms(1500));
    if (id !== flow) return;

    // 4. Push in on the desk, then cut to the close-up of the folder
    aimWide(roomBox(deskTop), 0.96, ms(900));
    await wait(650);
    if (id !== flow) return;
    instantly(desk.view, function () {
      desk.view.classList.remove('is-spread');
      desk.folder.classList.remove('is-open', 'is-spread');
      layoutDesk(false);
    });
    state.view = 'desk';
    updateDeskActions();
    showView(desk.view);
    if (motionOn()) {
      desk.folder.animate([
        { transform: 'translate3d(30px, -60px, 260px) rotateZ(-14deg)', opacity: 0 },
        { transform: 'translate3d(0, 0, 0) rotateZ(-4deg)', opacity: 1, offset: 0.8 },
        { transform: 'translate3d(0, 0, 0) rotateZ(-4deg)', opacity: 1 }
      ], { duration: 700, easing: 'cubic-bezier(0.3, 0.6, 0.3, 1)' });
    }
    await wait(700);
    if (id !== flow) return;
    state.busy = false;
    desk.open.focus({ preventScroll: true });
  }

  /* ----------------------------------------------------- desk + spread */

  var PAGE_W = 520;
  var PAGE_H = 560;

  function layoutDesk(spread) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // The free area is whatever the action buttons leave: a bar along the
    // bottom, or a column down the right on short landscape screens.
    var ar = desk.view.querySelector('.view-actions').getBoundingClientRect();
    var side = ar.top < vh / 2;
    var box = side
      ? { l: 16, t: 16, r: ar.left, b: vh - 16 }
      : { l: 16, t: vw <= 760 ? 76 : 112, r: vw - 16, b: ar.top }; // clear Back to Room / the slate
    var aw = box.r - box.l;
    var ah = Math.max(160, box.b - box.t);
    var cx = (box.l + box.r - vw) / 2;
    var cy = (box.t + box.b - vh) / 2;
    var cam = desk.cam.style;
    if (spread) {
      // Narrow screens show the right-hand (photo) page on its own.
      var single = aw / ah < 1.25;
      var k = single ? Math.min(aw / PAGE_W, ah / PAGE_H) : Math.min(aw / (PAGE_W * 2), ah / PAGE_H);
      cam.setProperty('--dk', k.toFixed(4));
      cam.setProperty('--tilt', '0deg');
      cam.setProperty('--dx', (cx + (single ? 0 : PAGE_W / 2 * k)).toFixed(1) + 'px');
      cam.setProperty('--dy', cy.toFixed(1) + 'px');
      desk.sheet.style.setProperty('--k', k.toFixed(4));
    } else {
      var kd = Math.min(aw * 0.62 / PAGE_W, ah * 0.95 / PAGE_H);
      cam.setProperty('--dk', kd.toFixed(4));
      cam.setProperty('--tilt', '40deg');
      cam.setProperty('--dx', cx.toFixed(1) + 'px');
      cam.setProperty('--dy', (cy + ah * 0.02).toFixed(1) + 'px');
    }
  }

  function dressFolder() {
    var f = state.file;
    var n = f.photos.length;
    desk.title.textContent = f.label + ' file';
    desk.coverTab.textContent = f.label;
    desk.coverLabel.textContent = f.label;
    desk.coverFront.setAttribute('aria-label', 'Open the ' + f.label + ' file');
    desk.recNo.textContent = 'File No. ' + pad(CATEGORY_ORDER.indexOf(f.category) + 1);
    desk.recTitle.textContent = f.label;
    desk.recMeta.textContent = (n === 1 ? '1 photograph' : n + ' photographs') + ' · Team Monster';
    desk.recList.textContent = '';
    f.photos.forEach(function (p, i) {
      var b = el('button', '', el('li', '', desk.recList));
      b.type = 'button';
      el('b', '', b, pad(i + 1));
      el('span', '', b, TIMES[p.time] + ' — ' + p.caption);
      b.addEventListener('click', function () { showPage(i); });
    });
    desk.prev.hidden = desk.next.hidden = n < 2;
    showPage(0, true);
  }

  var pageToken = 0;

  async function showPage(i, instant) {
    var f = state.file;
    var n = f.photos.length;
    if (!n) {
      desk.img.removeAttribute('src');
      desk.cap.textContent = 'No photographs filed yet.';
      desk.count.textContent = '';
      return;
    }
    var dir = i < f.index ? -1 : 1;
    f.index = (i + n) % n;
    var p = f.photos[f.index];
    var token = ++pageToken;
    var rest = 'rotate(-1.2deg)';

    Array.prototype.forEach.call(desk.recList.querySelectorAll('button'), function (b, j) {
      b.setAttribute('aria-current', j === f.index ? 'true' : 'false');
    });
    desk.count.textContent = pad(f.index + 1) + ' / ' + pad(n);

    if (!instant && motionOn()) {
      await desk.print.animate([
        { transform: rest, opacity: 1 },
        { transform: 'translateX(' + -40 * dir + 'px) rotate(' + -5 * dir + 'deg)', opacity: 0 }
      ], { duration: 170, easing: 'ease-in', fill: 'forwards' }).finished.catch(noop);
      if (token !== pageToken) return;
    }
    desk.img.src = p.src;
    desk.img.alt = p.caption;
    desk.cap.textContent = '';
    desk.cap.appendChild(document.createTextNode(p.caption));
    el('small', '', desk.cap, locationName(p.location) + ' · ' + TIMES[p.time]);
    await decoded(desk.img);
    if (token !== pageToken) return;
    desk.print.getAnimations().forEach(function (a) { a.cancel(); });
    if (!instant && motionOn()) {
      desk.print.animate([
        { transform: 'translateX(' + 46 * dir + 'px) rotate(' + 4 * dir + 'deg)', opacity: 0 },
        { transform: rest, opacity: 1 }
      ], { duration: 260, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
    }
    if (n > 1) preload(f.photos[(f.index + 1) % n].src);
  }

  function stepPage(d) {
    if (state.view !== 'spread' || !state.file || state.file.photos.length < 2) return;
    showPage(state.file.index + d);
  }

  function updateDeskActions() {
    var spread = state.view === 'spread';
    desk.open.hidden = spread;
    desk.ret.hidden = spread;
    desk.close.hidden = !spread;
  }

  async function openFile() {
    if (state.busy || state.view !== 'desk') return;
    var id = ++flow;
    state.busy = true;
    desk.folder.classList.add('is-open'); // the cover swings over
    await wait(420);
    if (id !== flow) return;
    desk.view.classList.add('is-spread');
    desk.folder.classList.add('is-spread');
    layoutDesk(true); // ...as the camera rises to look straight down on it
    await wait(1000);
    if (id !== flow) return;
    state.view = 'spread';
    state.busy = false;
    updateDeskActions();
    (desk.next.hidden ? desk.close : desk.next).focus({ preventScroll: true });
  }

  async function closeFile() {
    if (state.busy || state.view !== 'spread') return;
    var id = ++flow;
    state.busy = true;
    desk.view.classList.remove('is-spread');
    desk.folder.classList.remove('is-spread');
    layoutDesk(false);
    await wait(500);
    if (id !== flow) return;
    desk.folder.classList.remove('is-open');
    await wait(800);
    if (id !== flow) return;
    state.view = 'desk';
    state.busy = false;
    updateDeskActions();
    desk.open.focus({ preventScroll: true });
  }

  /** Desk -> the file flies home -> cabinet close-up, where it drops back in. */
  async function returnFile() {
    if (state.busy || state.view !== 'desk') return;
    var id = ++flow;
    state.busy = true;
    var f = state.file;
    var d = cab.drawers[f.drawer];

    hideView(desk.view);
    await wait(250);
    if (id !== flow) return;
    aimWide(flightBox(f.cabinet), 0.86, ms(1300));
    await flyFile(['desk', 'arc', 'above'], ms(1400));
    if (id !== flow) return;

    // Back to the cabinet close-up with the drawer still out
    instantly(cab.box, function () {
      d.el.classList.add('is-open', 'is-lifting');
      setEye(LEAN_IN);
    });
    state.drawer = f.drawer;
    updateCabinetActions();
    fitCabinet();
    aim(roomBox(cavityOf(f.cabinet)), screenBox(cab.wrap.getBoundingClientRect()), ms(900));
    await wait(650);
    if (id !== flow) return;
    showView(cab.view);
    hideRoomCabinet(f.cabinet);
    state.view = 'cabinet';
    await wait(300);
    if (id !== flow) return;
    hideTravelFile();
    d.el.classList.remove('is-lifting'); // drops back into the drawer
    await wait(650);
    if (id !== flow) return;
    state.file = null;
    state.busy = false;
    closeDrawer(); // and the drawer rolls shut
  }

  desk.open.addEventListener('click', openFile);
  desk.coverFront.addEventListener('click', openFile);
  desk.ret.addEventListener('click', returnFile);
  desk.close.addEventListener('click', closeFile);
  desk.prev.addEventListener('click', function () { stepPage(-1); });
  desk.next.addEventListener('click', function () { stepPage(1); });

  /* ============================================================ navigation */

  function canExplore() {
    return app.classList.contains('is-lit') && state.view === 'room' && !state.busy;
  }

  var allViews = [mon.view, cab.view, desk.view];

  function showView(v) {
    v.inert = false;
    v.classList.add('is-active');
  }

  function hideView(v) {
    v.inert = true;
    v.classList.remove('is-active');
  }

  /** Take the room out of reach while a close-up owns the screen.
   *
   *  `inert` on #viewport is the obvious tool and was the wrong one: setting
   *  it re-resolves style for all ~390 surfaces in the room at once, and the
   *  compositor spends two frames rebuilding layers it has not painted yet -
   *  landing a near-empty room on screen at exactly the moment a zoom starts
   *  or a Back to Room lands. Reaching for the handful of controls that can
   *  actually take focus costs nothing. Pointer and hover are already handled:
   *  every hotspot goes through canExplore(), which is false unless the view
   *  is the room and no flow is running, and the lamp's chain disables itself
   *  once it has been pulled. */
  function setRoomReachable(on) {
    if (on) viewport.removeAttribute('aria-hidden');
    else viewport.setAttribute('aria-hidden', 'true');
    scene.monitors.concat(scene.cabinets).forEach(function (n) { n.tabIndex = on ? 0 : -1; });
  }

  function enterZoom() {
    setHot(null);
    app.classList.add('is-zoomed', 'has-explored');
    setRoomReachable(false);
  }

  /** Straight back to the full lit room, tidying up whatever was left out. */
  async function backToRoom() {
    if (state.view === 'room') return;
    var id = ++flow;
    var origin = state.origin;
    state.busy = true;
    allViews.forEach(hideView);
    setCamera(1, 0, 0, ms(1000));
    closeRoomDrawers();
    scene.cabinets.forEach(function (c) { c.classList.remove('is-behind-closeup'); });
    hideTravelFile();
    await wait(1000);
    if (id !== flow) return;

    // Reset every close-up while nobody can see it
    window.clearTimeout(slideTimer);
    mon.crt.classList.remove('is-playing', 'is-switching');
    mon.photo.removeAttribute('src');
    instantly(cab.box, function () {
      cab.drawers.forEach(function (d) { d.el.classList.remove('is-open', 'is-lifting'); });
    });
    instantly(desk.view, function () {
      desk.view.classList.remove('is-spread');
      desk.folder.classList.remove('is-open', 'is-spread');
    });
    state.view = 'room';
    state.slot = null;
    state.slides = [];
    state.cabinet = -1;
    state.drawer = -1;
    state.file = null;
    state.origin = null;
    state.busy = false;
    app.classList.remove('is-zoomed');
    setRoomReachable(true);
    if (origin && lastInput === 'key') origin.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.closest('#views')) document.activeElement.blur();
  }

  backBtn.addEventListener('click', backToRoom);

  /** Re-aim for the current view without animating (window resized). */
  function reframe() {
    switch (state.view) {
      case 'monitor':
        fitMonitor();
        aim(roomBox(monitorFace(state.origin)), screenBox(mon.wrap.getBoundingClientRect()), 0);
        break;
      case 'cabinet':
        fitCabinet();
        aim(roomBox(cavityOf(state.cabinet)), screenBox(cab.wrap.getBoundingClientRect()), 0);
        break;
      case 'desk':
      case 'spread':
        aimWide(roomBox(deskTop), 0.96, 0);
        instantly(desk.view, function () { layoutDesk(state.view === 'spread'); });
        break;
    }
  }

  var primeTimer = 0;
  window.addEventListener('resize', function () {
    if (state.view !== 'room' && !state.busy) window.requestAnimationFrame(reframe);
    // A new window size is a new resting scale for the room: settle its
    // raster again once the resizing stops.
    window.clearTimeout(primeTimer);
    primeTimer = window.setTimeout(repinRaster, 400);
  });

  // First settle: once the (still dark) room has faded in, long before the
  // lamp can have been found and the first zoom asked for.
  (function whenReady() {
    if (app.classList.contains('is-ready')) window.setTimeout(primeRaster, 1600);
    else window.setTimeout(whenReady, 200);
  })();

  var lastInput = 'pointer';
  window.addEventListener('pointerdown', function () { lastInput = 'pointer'; }, true);

  document.addEventListener('keydown', function (e) {
    lastInput = 'key';
    if (e.key === 'Escape' && app.classList.contains('is-zoomed')) {
      e.preventDefault();
      backToRoom();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      var d = e.key === 'ArrowLeft' ? -1 : 1;
      if (state.view === 'monitor') stepSlide(d);
      else if (state.view === 'spread') stepPage(d);
    }
  });

  /* ================================================== room hotspots */

  // A drag that pans the room (narrow screens) must not also open things.
  var press = null;
  var dragged = false;
  viewport.addEventListener('pointerdown', function (e) {
    press = { x: e.clientX, y: e.clientY };
    dragged = false;
  }, true);
  window.addEventListener('pointermove', function (e) {
    if (press && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 10) dragged = true;
  }, { passive: true });
  window.addEventListener('pointerup', function () { press = null; });

  var hot = null;

  function setHot(node, text) {
    if (hot) hot.classList.remove('is-hot');
    hot = node;
    if (node) {
      node.classList.add('is-hot');
      targetLabel.textContent = text;
    }
    app.classList.toggle('show-target', !!node);
  }

  function hotspot(node, name, hint, open) {
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', name);
    node.addEventListener('click', function () {
      if (!dragged) open();
    });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    function on() { if (canExplore()) setHot(node, hint); }
    function off() { if (hot === node) setHot(null); }
    node.addEventListener('pointerenter', on);
    node.addEventListener('pointerleave', off);
    node.addEventListener('focus', on);
    node.addEventListener('blur', off);
  }

  scene.monitors.forEach(function (node) {
    var t = TIMES[node.dataset.slot];
    hotspot(node, t + ' desktop: see pictures from the ' + t.toLowerCase(),
      node.querySelector('.osd-cam').textContent + ' · ' + t + ' — look closer',
      function () { openMonitor(node); });
  });

  scene.cabinets.forEach(function (node, ci) {
    var labels = roomDrawers[ci].map(function (d) { return d.dataset.label; }).filter(Boolean).join(', ');
    hotspot(node, 'Filing cabinet ' + (ci + 1) + ': ' + labels,
      'Cabinet ' + (ci + 1) + ' · ' + labels,
      function () { openCabinet(ci); });
  });

  // Only reachable by keyboard once there is light to see them by.
  document.addEventListener('rushhour:lit', function () {
    scene.monitors.concat(scene.cabinets).forEach(function (n) { n.tabIndex = 0; });
    window.setTimeout(function () {
      if (state.view !== 'room' || hot) return;
      targetLabel.textContent = 'Click a screen or a filing cabinet to look closer';
      app.classList.add('show-target');
      window.setTimeout(function () { if (!hot) app.classList.remove('show-target'); }, 5000);
    }, 3200);
  });

  allViews.forEach(function (v) { v.inert = true; });
})();
