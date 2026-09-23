/* =============================================================================
   Rush Hour - room builder
   -----------------------------------------------------------------------------
   Builds the security room out of plain <div>s placed with CSS 3D transforms.
   No canvas, no WebGL, no libraries: every surface is a flat element with a
   photographic texture as its background-image, rotated/translated into place.

   World units are CSS px, 400px ~ 1 metre. Axes follow CSS: x to the right,
   y DOWN, z TOWARD the viewer. The camera eye sits at the room origin,
   1.6 m above the floor, so the floor is at y = +640.
============================================================================= */
(function () {
  'use strict';

  var RH = (window.RushHour = window.RushHour || {});

  var FLOOR = 640;
  var CEIL = FLOOR - 1120;
  var BACK = -1000;
  var FRONT = 200;
  var HALF_W = 1100;

  /* Surface heights (distance from floor -> y) */
  var COUNTER_TOP = 336; // 0.76 m
  var DESK_TOP = 330;

  /* ---------------------------------------------------------------- helpers */

  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function transform(p) {
    var t = 'translate3d(' + (p.x || 0) + 'px,' + (p.y || 0) + 'px,' + (p.z || 0) + 'px)';
    if (p.ry) t += ' rotateY(' + p.ry + 'deg)';
    if (p.rx) t += ' rotateX(' + p.rx + 'deg)';
    if (p.rz) t += ' rotateZ(' + p.rz + 'deg)';
    return t;
  }

  function size(n, w, h) {
    n.style.width = w + 'px';
    n.style.height = h + 'px';
    n.style.marginLeft = -w / 2 + 'px';
    n.style.marginTop = -h / 2 + 'px';
  }

  /* Deterministic scatter so texture offsets look random but never change
     between visits (and never jump on reload). */
  var seed = 7;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  /** A single flat surface, centred on `pos`. */
  function plane(parent, w, h, pos, cls) {
    var f = el('div', cls, parent);
    size(f, w, h);
    f.style.transform = transform(pos);
    return f;
  }

  /* Where each face of a w*h*d box sits relative to the box centre. */
  var FACES = {
    front: function (w, h, d) { return [w, h, 'translateZ(' + d / 2 + 'px)']; },
    back: function (w, h, d) { return [w, h, 'rotateY(180deg) translateZ(' + d / 2 + 'px)']; },
    right: function (w, h, d) { return [d, h, 'rotateY(90deg) translateZ(' + w / 2 + 'px)']; },
    left: function (w, h, d) { return [d, h, 'rotateY(-90deg) translateZ(' + w / 2 + 'px)']; },
    top: function (w, h, d) { return [w, d, 'rotateX(90deg) translateZ(' + h / 2 + 'px)']; },
    bottom: function (w, h, d) { return [w, d, 'rotateX(-90deg) translateZ(' + h / 2 + 'px)']; }
  };

  /**
   * A textured cuboid. `x`/`z` are the centre of its footprint and `y` is the
   * level of its BOTTOM face, so `y: FLOOR` stands it on the floor.
   * Faces default to `mat`; `faces.<name>` overrides one, `skip` omits faces
   * the camera can never see (the default skips back and bottom).
   */
  function box(parent, o) {
    var g = el('div', 'obj ' + (o.cls || ''), parent);
    if (o.id) g.id = o.id;
    g.style.transform = transform({ x: o.x, y: o.y - o.h / 2, z: o.z, ry: o.ry });
    g.style.setProperty('--bx', Math.round(rand() * -900) + 'px');
    g.style.setProperty('--by', Math.round(rand() * -900) + 'px');

    var skip = o.skip || ['back', 'bottom'];
    g.faces = {};
    Object.keys(FACES).forEach(function (name) {
      if (skip.indexOf(name) !== -1) return;
      var spec = FACES[name](o.w, o.h, o.d);
      var f = el('div', 'f f--' + name + ' ' + ((o.faces && o.faces[name]) || o.mat || ''), g);
      size(f, spec[0], spec[1]);
      f.style.transform = spec[2];
      g.faces[name] = f;
    });
    return g;
  }

  /** Soft contact shadow lying on a horizontal surface at height `y`. */
  function groundShadow(parent, x, y, z, w, d, strength) {
    var s = plane(parent, w, d, { x: x, y: y - 0.5, z: z, rx: 90 }, 'contact-shadow');
    if (strength != null) s.style.opacity = strength;
    return s;
  }

  /* ------------------------------------------------------------ the shell */

  function buildShell(room) {
    var midY = (CEIL + FLOOR) / 2;
    var depth = FRONT - BACK;
    var midZ = (FRONT + BACK) / 2;

    var back = plane(room, HALF_W * 2, FLOOR - CEIL, { y: midY, z: BACK }, 'f f--wall m-wall wall-back');
    plane(room, depth, FLOOR - CEIL, { x: -HALF_W, y: midY, z: midZ, ry: 90 }, 'f f--wall f--side-wall m-wall wall-left');
    var right = plane(room, depth, FLOOR - CEIL, { x: HALF_W, y: midY, z: midZ, ry: -90 }, 'f f--wall f--side-wall m-wall wall-right');
    var floor = plane(room, HALF_W * 2, depth, { y: FLOOR, z: midZ, rx: 90 }, 'f f--floor m-floor');
    var ceiling = plane(room, HALF_W * 2, depth, { y: CEIL, z: midZ, rx: -90 }, 'f f--ceiling m-ceiling');

    // Rubber skirting where walls meet the floor
    plane(room, HALF_W * 2, 26, { y: FLOOR - 13, z: BACK + 1 }, 'f f--front m-skirting');
    plane(room, depth, 26, { x: -HALF_W + 1, y: FLOOR - 13, z: midZ, ry: 90 }, 'f f--right m-skirting');
    plane(room, depth, 26, { x: HALF_W - 1, y: FLOOR - 13, z: midZ, ry: -90 }, 'f f--left m-skirting');

    // Street light through the blinds, raking across the ceiling
    el('div', 'ceiling-sweep', ceiling);

    return { back: back, right: right, floor: floor, ceiling: ceiling };
  }

  /* ------------------------------------------------------ window + traffic */

  function buildWindow(room) {
    var cx = -470, cy = -170, w = 560, h = 300;

    var view = plane(room, w, h, { x: cx, y: cy, z: BACK + 2 }, 'window-view');
    el('div', 'skyline', view);
    var traffic = el('div', 'traffic', view);
    // Two lanes of rush-hour traffic: headlights one way, tail-lights the other.
    for (var i = 0; i < 9; i++) {
      var car = el('span', 'car car--head', traffic);
      car.style.setProperty('--d', (7 + rand() * 5).toFixed(2) + 's');
      car.style.setProperty('--delay', (-rand() * 12).toFixed(2) + 's');
      car.style.setProperty('--lane', (58 + rand() * 6).toFixed(1) + '%');
    }
    for (var j = 0; j < 9; j++) {
      var tail = el('span', 'car car--tail', traffic);
      tail.style.setProperty('--d', (9 + rand() * 6).toFixed(2) + 's');
      tail.style.setProperty('--delay', (-rand() * 14).toFixed(2) + 's');
      tail.style.setProperty('--lane', (68 + rand() * 6).toFixed(1) + '%');
    }

    plane(room, w - 8, h - 6, { x: cx, y: cy - 2, z: BACK + 10 }, 'f f--front blinds');

    // Frame + sill
    var t = 14;
    box(room, { w: w + t * 2, h: t, d: 18, x: cx, y: cy - h / 2, z: BACK + 9, mat: 'm-frame' });
    box(room, { w: t, h: h, d: 18, x: cx - w / 2 - t / 2, y: cy + h / 2, z: BACK + 9, mat: 'm-frame' });
    box(room, { w: t, h: h, d: 18, x: cx + w / 2 + t / 2, y: cy + h / 2, z: BACK + 9, mat: 'm-frame' });
    box(room, { w: w + 50, h: 16, d: 46, x: cx, y: cy + h / 2 + 16, z: BACK + 23, mat: 'm-frame' });
  }

  /* ------------------------------------------------ monitor counter + CRTs */

  var SLOTS = [
    { x: -880, cam: 'CAM 01', label: 'Morning', id: 'morning' },
    { x: -450, cam: 'CAM 02', label: 'Afternoon', id: 'afternoon' },
    { x: -20, cam: 'CAM 03', label: 'Evening', id: 'evening' }
  ];

  function buildCounter(room) {
    var cx = -420, w = 1280, d = 320, cz = BACK + d / 2;
    var slab = box(room, {
      w: w, h: 22, d: d, x: cx, y: FLOOR - 304 + 22, z: cz,
      mat: 'm-counter', skip: ['back'], cls: 'counter'
    });
    slab.faces.bottom.classList.add('f--under');

    // Shadow cast on the wall and floor under the counter
    plane(room, w, FLOOR - COUNTER_TOP - 22, { x: cx, y: (COUNTER_TOP + 22 + FLOOR) / 2, z: BACK + 2 }, 'under-counter');
    groundShadow(room, cx, FLOOR, BACK + 150, w + 60, 320, 0.9);

    // Drawer pedestals at both ends
    [-975, 135].forEach(function (px) {
      var ped = box(room, {
        w: 170, h: FLOOR - COUNTER_TOP - 22, d: 290, x: px, y: FLOOR, z: BACK + 152,
        mat: 'm-beige-metal', cls: 'pedestal'
      });
      var front = ped.faces.front;
      [0, 1, 2].forEach(function (k) {
        var dr = el('div', 'ped-drawer' + (k === 2 ? ' ped-drawer--deep' : ''), front);
        el('span', 'ped-pull', dr);
      });
      groundShadow(room, px, FLOOR, BACK + 160, 230, 330, 0.8);
    });

    return slab;
  }

  function buildMonitor(room, counter, slot, i) {
    var mx = slot.x;
    var top = COUNTER_TOP;
    var g = el('div', 'obj monitor', room);
    g.id = 'desktop-' + (i + 1);
    g.dataset.slot = slot.id;
    g.style.setProperty('--i', i);

    // Swivel base, tube housing, and the front bezel that carries the screen
    box(g, { w: 120, h: 12, d: 80, x: mx, y: top, z: -820, mat: 'm-plastic' });
    box(g, { w: 178, h: 168, d: 150, x: mx, y: top - 8, z: -885, mat: 'm-plastic', cls: 'crt-rear' });
    var bezel = box(g, { w: 216, h: 200, d: 56, x: mx, y: top - 12, z: -782, mat: 'm-plastic', cls: 'crt-bezel' });

    var face = bezel.faces.front;
    face.classList.add('crt-face');
    var screen = el('div', 'crt-screen', face);
    var power = el('div', 'crt-power', screen);
    el('div', 'crt-feed crt-feed--' + slot.id, power);
    var osd = el('div', 'crt-osd', power);
    el('span', 'osd-cam', osd, slot.cam);
    var rec = el('span', 'osd-rec', osd, 'REC');
    rec.setAttribute('aria-hidden', 'true');
    el('span', 'osd-slot', osd, slot.label.toUpperCase());
    el('span', 'osd-time', osd, '');
    el('div', 'crt-scan', screen);
    el('div', 'crt-glass', screen);
    el('span', 'crt-badge', face, 'TMV-14');
    el('span', 'crt-led', face);
    var knobs = el('span', 'crt-knobs', face);
    el('i', '', knobs); el('i', '', knobs); el('i', '', knobs);

    // Keyboard
    var kb = box(g, { w: 200, h: 11, d: 70, x: mx, y: top, z: -716, mat: 'm-plastic', cls: 'keyboard' });
    kb.faces.top.classList.add('keys');
    groundShadow(g, mx, top, -712, 230, 90, 0.55);

    // Tower PC beside it
    var tower = box(g, { w: 84, h: 196, d: 210, x: mx + 168, y: top, z: -880, mat: 'm-plastic', cls: 'tower' });
    el('span', 'bay bay--cd', tower.faces.front);
    el('span', 'bay bay--floppy', tower.faces.front);
    el('span', 'tower-power', tower.faces.front);
    el('span', 'tower-vent', tower.faces.front);
    groundShadow(g, mx + 168, top, -880, 120, 250, 0.6);
    groundShadow(g, mx, top, -850, 250, 230, 0.7);

    // Blue spill from the tube onto the counter once the screen is on
    var spill = el('div', 'crt-spill', counter.faces.top);
    spill.style.left = (mx - (-420 - 640)) - 170 + 'px';

    return g;
  }

  /** Five-star swivel chair, turned `ry` degrees, pushed back from the counter. */
  function buildChair(room, x, z, ry) {
    var g = el('div', 'obj chair', room);
    g.style.transform = transform({ x: x, z: z, ry: ry });
    var seatTop = FLOOR - 190;

    for (var k = 0; k < 5; k++) {
      var a = k * 72 + 18;
      var r = a * Math.PI / 180;
      box(g, {
        w: 12, h: 9, d: 96, x: Math.sin(r) * 46, y: FLOOR - 12, z: Math.cos(r) * 46,
        ry: a, mat: 'm-dark-steel', skip: ['back', 'bottom']
      });
    }
    groundShadow(g, 0, FLOOR, 0, 210, 210, 0.85);
    box(g, { w: 16, h: FLOOR - 12 - (seatTop + 24), d: 16, x: 0, y: FLOOR - 12, z: 0, mat: 'm-dark-steel' });
    box(g, { w: 168, h: 24, d: 158, x: 0, y: seatTop + 24, z: 0, mat: 'm-fabric', cls: 'chair-seat' });
    // Backrest faces away from the counter, towards the camera
    box(g, { w: 12, h: 60, d: 10, x: 0, y: seatTop + 14, z: 84, mat: 'm-dark-steel' });
    box(g, { w: 158, h: 128, d: 20, x: 0, y: seatTop - 34, z: 90, mat: 'm-fabric', cls: 'chair-back', skip: ['bottom'] });
    return g;
  }

  /* ---------------------------------------------------------- file cabinets */

  var CABINETS = [
    { x: 505, drawers: ['Canteen', 'Outdoor', 'Library', ''] },
    { x: 735, drawers: ['Classrooms', 'Corridors', 'Sports Complex', ''] }
  ];

  function buildCabinet(room, spec, ci) {
    var w = 215, h = 532, d = 280, z = BACK + d / 2 + 5;
    var g = el('div', 'obj cabinet', room);
    g.id = 'cabinet-' + (ci + 1);

    box(g, {
      w: w, h: h, d: d, x: spec.x, y: FLOOR, z: z,
      mat: 'm-olive', skip: ['front', 'back', 'bottom'], cls: 'cabinet-shell'
    });
    // The dark cavity you glimpse in the gaps between drawers
    plane(g, w - 4, h - 4, { x: spec.x, y: FLOOR - h / 2, z: z + d / 2 - 3 }, 'f f--front cab-cavity');
    // Recessed kick plate
    plane(g, w - 10, 16, { x: spec.x, y: FLOOR - 8, z: z + d / 2 - 6 }, 'f f--front m-olive kick');

    var dh = 124, gap = 4, top = FLOOR - h + 8;
    spec.drawers.forEach(function (label, k) {
      var drawer = box(g, {
        w: w - 10, h: dh, d: d - 18, x: spec.x,
        // front face sits 2px proud of the shell
        y: top + dh * (k + 1) + gap * k, z: z + d / 2 + 2 - (d - 18) / 2,
        mat: 'm-olive', skip: ['back', 'bottom'], cls: 'drawer'
      });
      drawer.dataset.category = label ? label.toLowerCase().replace(/\s+/g, '-') : 'empty';
      var front = drawer.faces.front;
      front.classList.add('drawer-front');
      var holder = el('div', 'label-holder', front);
      el('span', 'label-card', holder, label || '');
      el('span', 'drawer-pull', front);
    });

    if (ci === 0) el('span', 'cab-lock', g.firstChild.faces.top);
    groundShadow(g, spec.x, FLOOR, z + 10, w + 60, d + 70, 0.95);
    return g;
  }

  /* -------------------------------------------------- the lamp's desk */

  function buildDesk(room) {
    var cx = -85, cz = -330, w = 690, d = 330;
    var top = box(room, {
      w: w, h: 24, d: d, x: cx, y: DESK_TOP + 24, z: cz,
      mat: 'm-wood', skip: ['back'], cls: 'desk-top'
    });
    top.faces.bottom.classList.add('f--under');
    top.id = 'desk';

    // Steel legs
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      box(room, {
        w: 26, h: FLOOR - DESK_TOP - 24, d: 26,
        x: cx + c[0] * (w / 2 - 22), y: FLOOR, z: cz + c[1] * (d / 2 - 22), mat: 'm-dark-steel'
      });
    });
    // Drawer hung under the left of the top
    var drawer = box(room, { w: 250, h: 90, d: 300, x: cx - 210, y: DESK_TOP + 24 + 90, z: cz, mat: 'm-wood', cls: 'desk-drawer' });
    el('span', 'desk-pull', drawer.faces.front);

    groundShadow(room, cx, FLOOR, cz, w + 120, d + 140, 0.75);

    // Paperwork, and the light pool the lamp throws once it is on
    var surface = top.faces.top;
    el('div', 'lamp-pool', surface);
    var p1 = el('div', 'paper paper--a', surface);
    el('div', 'paper paper--b', surface);
    el('span', 'paper-lines', p1);
    el('div', 'drop-zone', surface).id = 'file-drop'; // where files will land next build

    return top;
  }

  /* ------------------------------------------------------------ the lamp */

  function buildLamp(room) {
    var g = el('div', 'obj lamp', room);
    g.id = 'lamp';
    g.style.transform = transform({ x: 160, y: DESK_TOP, z: -400 });
    groundShadow(g, 0, 0, 6, 190, 70, 0.9);

    // The lamp is a single upright plane (a "billboard") facing the camera,
    // built from layered photographic brass + glass. See .lamp-art in CSS.
    var art = el('div', 'lamp-art', g);
    el('div', 'lamp-cone', art);
    el('div', 'lamp-base-side brass', art);
    el('div', 'lamp-base-top brass', art);
    el('div', 'lamp-stem brass', art);
    el('div', 'lamp-knuckle brass', art);

    var shade = el('div', 'lamp-shade', art);
    el('div', 'shade-off', shade);
    el('div', 'shade-lit', shade);
    el('div', 'shade-spec', shade);
    el('div', 'shade-rim brass', shade);
    el('div', 'lamp-mouth', art);

    var chain = el('div', 'chain', art);
    var cord = el('div', 'chain-cord', chain);
    var pull = el('div', 'chain-pull', chain);
    var cue = el('div', 'pull-cue', chain);
    cue.setAttribute('aria-hidden', 'true');
    cue.innerHTML =
      '<svg viewBox="0 0 16 22" width="14" height="19"><path d="M8 1v16M2.5 12L8 18.5 13.5 12" ' +
      'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // Generous invisible hit area: the visible chain is far too thin to grab.
    var hit = el('button', 'chain-hit', art);
    hit.type = 'button';
    hit.setAttribute('aria-label', 'Pull the lamp chain to switch on the light');

    return { root: g, art: art, shade: shade, chain: chain, cord: cord, pull: pull, cue: cue, hit: hit };
  }

  /* ------------------------------------------------------- wall details */

  function buildWallDetails(room, shell) {
    // Clock above the cabinets
    var clock = plane(room, 128, 128, { x: 620, y: -90, z: BACK + 4 }, 'f f--front clock');
    var dial = el('div', 'clock-dial', clock);
    for (var h = 0; h < 12; h++) {
      var tick = el('span', 'clock-tick' + (h % 3 === 0 ? ' clock-tick--major' : ''), dial);
      tick.style.transform = 'rotate(' + h * 30 + 'deg)';
    }
    el('span', 'clock-brand', dial, 'SEKONDA');
    el('span', 'clock-hand clock-hand--h', dial).id = 'hand-h';
    el('span', 'clock-hand clock-hand--m', dial).id = 'hand-m';
    el('span', 'clock-hand clock-hand--s', dial).id = 'hand-s';
    el('span', 'clock-pin', dial);

    // Wall calendar: September, shoot days ringed in marker
    var cal = plane(room, 150, 206, { x: 985, y: 10, z: BACK + 3 }, 'f f--front calendar');
    el('div', 'cal-photo', cal);
    el('div', 'cal-month', cal, 'September');
    var grid = el('div', 'cal-grid', cal);
    'SMTWTFS'.split('').forEach(function (c) { el('span', 'cal-dow', grid, c); });
    // September 1996 began on a Sunday - it is a 1990s control room after all.
    for (var dday = 1; dday <= 30; dday++) {
      var cell = el('span', 'cal-day', grid, String(dday));
      if (dday >= 22 && dday <= 24) cell.classList.add('cal-day--ringed');
    }

    // Steel door on the right wall, with corridor light leaking under it
    var doorZ = -700, doorW = 330, doorH = 820;
    plane(room, doorW + 36, doorH + 18, { x: HALF_W - 2, y: FLOOR - (doorH + 18) / 2, z: doorZ, ry: -90 }, 'f f--left m-frame door-frame');
    var door = plane(room, doorW, doorH, { x: HALF_W - 4, y: FLOOR - doorH / 2 - 4, z: doorZ, ry: -90 }, 'f f--left m-door door');
    el('span', 'door-plate', door);
    el('span', 'door-handle', door);
    el('span', 'door-sign', door, 'Monitoring - Authorised staff only');
    plane(room, 90, doorW, { x: HALF_W - 45, y: FLOOR - 1, z: doorZ, rx: 90 }, 'door-spill');
    plane(room, doorW - 10, 5, { x: HALF_W - 5, y: FLOOR - 2.5, z: doorZ, ry: -90 }, 'door-gap');

    // Fluorescent tube fixture on the ceiling
    var fixture = box(room, {
      w: 560, h: 16, d: 110, x: -300, y: CEIL + 22, z: -620,
      mat: 'm-steel-light', skip: ['back', 'top'], cls: 'fixture'
    });
    fixture.faces.bottom.classList.add('fixture-diffuser');
    fixture.faces.bottom.classList.add('f--under');

    // A few binders and a box file on top of the cabinets
    var binderColors = ['#6d2a22', '#23344d', '#3b3b36', '#6b5a2a', '#23344d', '#51261f'];
    binderColors.forEach(function (c, k) {
      var b = box(room, { w: 26, h: 118 - (k % 3) * 6, d: 110, x: 437 + k * 29, y: FLOOR - 532, z: -900, mat: 'm-binder' });
      b.style.setProperty('--tint', c);
      el('span', 'binder-label', b.faces.front);
    });
    box(room, { w: 170, h: 70, d: 150, x: 735, y: FLOOR - 532, z: -890, mat: 'm-cardboard', cls: 'archive-box' });
    groundShadow(room, 515, FLOOR - 532, -900, 210, 150, 0.8);
    groundShadow(room, 735, FLOOR - 532, -890, 210, 180, 0.8);

    // Coffee mug on the counter (a billboard - it is round)
    var mug = el('div', 'obj', room);
    mug.style.transform = transform({ x: -655, y: COUNTER_TOP, z: -730 });
    groundShadow(mug, 0, 0, 0, 60, 40, 0.8);
    el('div', 'mug', mug);
  }

  /* --------------------------------------------------------------- build */

  RH.buildRoom = function (room) {
    var shell = buildShell(room);
    buildWindow(room);
    var counter = buildCounter(room);
    var monitors = SLOTS.map(function (slot, i) { return buildMonitor(room, counter, slot, i); });
    buildChair(room, -905, -545, -14);
    buildChair(room, -430, -585, 9);
    buildChair(room, -60, -590, -6);
    var cabinets = CABINETS.map(function (spec, i) { return buildCabinet(room, spec, i); });
    var desk = buildDesk(room);
    buildWallDetails(room, shell);
    var lamp = buildLamp(room);

    // Rug under the monitor chairs' path
    var rug = plane(room, 1000, 300, { x: -430, y: FLOOR - 1, z: -560, rx: 90 }, 'f f--floor m-carpet rug');
    rug.style.setProperty('--bx', '-120px');

    return { monitors: monitors, cabinets: cabinets, desk: desk, lamp: lamp };
  };

  RH.world = { FLOOR: FLOOR, CEIL: CEIL, BACK: BACK, FRONT: FRONT, HALF_W: HALF_W };
})();
