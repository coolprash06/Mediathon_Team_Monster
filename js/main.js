/* =============================================================================
   Rush Hour - boot
   -----------------------------------------------------------------------------
   Builds the room, fits the 1600x900 stage to the window, wires the lamp, and
   runs the small ambient loops (parallax, wall clock, CCTV timestamps).
============================================================================= */
(function () {
  'use strict';

  var RH = window.RushHour;
  var STAGE_W = 1600;
  var STAGE_H = 900;
  /* The eye point inside the stage (matches .room's position in CSS). */
  var EYE_X = 800;
  var EYE_Y = 360;
  /** In portrait, never show less than this fraction of the stage width. */
  var MIN_PORTRAIT_SPAN = 0.4;

  var app = document.getElementById('app');
  var stage = document.getElementById('stage');
  var camera = document.getElementById('camera');
  var room = document.getElementById('room');
  var fx = document.getElementById('fx');
  var hint = document.getElementById('hint');

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function motionOn() { return !reduceQuery.matches; }

  var scene = RH.buildRoom(room);

  /* ------------------------------------------------------------ fitting */

  var fit = { s: 1, focusX: STAGE_W / 2 };

  /** Where the lamp shade sits in stage px (used for bloom + portrait focus).
   *  Measured against the stage's *rendered* scale, which differs from fit.s
   *  while a pan transition is still running. */
  function lampInStage() {
    var sr = stage.getBoundingClientRect();
    var lr = scene.lamp.shade.getBoundingClientRect();
    var rendered = sr.width / STAGE_W;
    return {
      x: (lr.left + lr.width / 2 - sr.left) / rendered,
      y: (lr.top + lr.height * 0.9 - sr.top) / rendered
    };
  }

  function layout() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // Cover the window, but on tall screens stop zooming once 40% of the
    // width is showing - the pull chain must stay in frame and tappable.
    var s = Math.max(vw / STAGE_W, Math.min(vh / STAGE_H, vw / (STAGE_W * MIN_PORTRAIT_SPAN)));
    fit.s = s;

    var w = STAGE_W * s;
    var h = STAGE_H * s;
    // Horizontally, centre on the focus point but never expose past the edges.
    var tx = vw / 2 - fit.focusX * s;
    tx = w > vw ? Math.min(0, Math.max(vw - w, tx)) : (vw - w) / 2;
    fit.focusX = (vw / 2 - tx) / s; // keep focus in sync with the clamp
    fit.pannable = w - vw > 8;
    var ty = (vh - h) / 2;

    stage.style.setProperty('--s', s.toFixed(4));
    stage.style.setProperty('--tx', tx.toFixed(1) + 'px');
    stage.style.setProperty('--ty', ty.toFixed(1) + 'px');
  }

  function placeBloom() {
    var p = lampInStage();
    fx.style.setProperty('--lamp-x', p.x.toFixed(1) + 'px');
    fx.style.setProperty('--lamp-y', p.y.toFixed(1) + 'px');
    return p;
  }

  function refit() {
    layout();
    var p = placeBloom();
    // Before the light is on, frame the lamp on narrow screens.
    if (!app.classList.contains('is-lit')) {
      fit.focusX = p.x;
      layout();
    }
  }

  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);

  /* ------------------------------------------------ swipe to look around */

  // On narrow screens the lit room is wider than the window: drag anywhere
  // (except the chain) to pan along it.
  var pan = null;

  document.getElementById('viewport').addEventListener('pointerdown', function (e) {
    if (!fit.pannable || !app.classList.contains('is-lit') || app.classList.contains('is-zoomed') ||
      e.target.closest('.chain-hit')) return;
    pan = { id: e.pointerId, x: e.clientX, focus: fit.focusX };
    app.classList.add('is-panning');
  });

  window.addEventListener('pointermove', function (e) {
    if (!pan || e.pointerId !== pan.id) return;
    fit.focusX = pan.focus - (e.clientX - pan.x) / fit.s;
    layout();
  });

  function endPan(e) {
    if (!pan || e.pointerId !== pan.id) return;
    pan = null;
    app.classList.remove('is-panning');
  }
  window.addEventListener('pointerup', endPan);
  window.addEventListener('pointercancel', endPan);

  /* ---------------------------------------------------------- parallax */

  // Shifting the perspective origin moves the eye sideways: near things slide
  // against far things, which sells the depth of the CSS-3D room.
  var look = { x: 0, y: 0, tx: 0, ty: 0 };

  window.addEventListener('pointermove', function (e) {
    if (app.classList.contains('is-grabbing')) return;
    look.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    look.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function tick() {
    // While zoomed into a close-up the eye holds still, so the framing that
    // js/explore.js measured stays lined up with the close-up it cuts to.
    var held = app.classList.contains('is-zoomed');
    if (motionOn() && !held) {
      look.x += (look.tx - look.x) * 0.06;
      look.y += (look.ty - look.y) * 0.06;
    } else if (!held) {
      look.x = look.y = 0;
    }
    camera.style.perspectiveOrigin =
      (EYE_X - look.x * 26).toFixed(2) + 'px ' + (EYE_Y - look.y * 14).toFixed(2) + 'px';
    window.requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------- clock + CCTV */

  var handH = document.getElementById('hand-h');
  var handM = document.getElementById('hand-m');
  var handS = document.getElementById('hand-s');
  var stamps = Array.prototype.slice.call(document.querySelectorAll('.osd-time'));
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function updateTime() {
    var d = new Date();
    var sec = d.getSeconds();
    var min = d.getMinutes() + sec / 60;
    var hr = (d.getHours() % 12) + min / 60;
    handH.style.transform = 'rotate(' + hr * 30 + 'deg)';
    handM.style.transform = 'rotate(' + min * 6 + 'deg)';
    handS.style.transform = 'rotate(' + sec * 6 + 'deg)';

    // Real time of day, VHS-era date stamp.
    var stamp = pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-1996 ' + DAYS[d.getDay()] +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(sec);
    stamps.forEach(function (s) { s.textContent = stamp; });
  }

  /* ------------------------------------------------------------- sound */

  // Tiny synthesised effects (Web Audio, no files). Only ever started from
  // the visitor's own pull, so no autoplay surprises.
  var audio = null;

  function ctx() {
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
    return audio;
  }

  function noiseBurst(ac, when, dur, freq, gain) {
    var len = Math.max(1, Math.floor(ac.sampleRate * dur));
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    var src = ac.createBufferSource();
    src.buffer = buf;
    var bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.4;
    var g = ac.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(when);
  }

  function ping(ac, when, freq, dur, gain) {
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(ac.destination);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  var sound = {
    pull: function () {
      var ac = ctx();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();
      var t = ac.currentTime + 0.01;
      noiseBurst(ac, t, 0.035, 3200, 0.5); // chain rattle
      noiseBurst(ac, t + 0.23, 0.02, 1800, 0.9); // switch clack
      ping(ac, t + 0.23, 140, 0.08, 0.25);
    },
    tubes: function () {
      var ac = ctx();
      if (!ac || !motionOn()) return;
      var t = ac.currentTime + 0.15;
      // fluorescent starter tinks, timed to the .fx-flicker keyframes
      [0, 0.12, 0.3].forEach(function (dt) { ping(ac, t + dt, 2400 + dt * 900, 0.05, 0.05); });
    }
  };

  /* -------------------------------------------------------------- lamp */

  var hintTimer = window.setTimeout(function () { app.classList.add('show-hint'); }, 2600);

  RH.lamp = RH.createLamp({
    app: app,
    parts: scene.lamp,
    motionOn: motionOn,
    onPull: function () {
      window.clearTimeout(hintTimer);
      app.classList.remove('show-hint');
      sound.pull();
    },
    onLit: function () {
      sound.tubes();
      // Ease the frame from the lamp back to the whole room.
      fit.focusX = STAGE_W / 2;
      layout();
      hint.textContent = fit.pannable ? 'Swipe to look around the room.' : '';
      if (fit.pannable) {
        window.setTimeout(function () { app.classList.add('show-hint'); }, 2600);
        window.setTimeout(function () { app.classList.remove('show-hint'); }, 7600);
      }
      document.dispatchEvent(new CustomEvent('rushhour:lit'));
    }
  });

  /* ------------------------------------------------------------- start */

  refit();
  // Only animate re-framing after the first fit, never on load.
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () { app.classList.add('is-fitted'); });
  });
  updateTime();
  window.setInterval(updateTime, 1000);
  window.requestAnimationFrame(tick);

  // Textures decode lazily; fade the room in once the first ones are ready so
  // the visitor never sees grey placeholder planes.
  var probe = new Image();
  probe.onload = probe.onerror = function () { app.classList.add('is-ready'); };
  probe.src = 'assets/textures/wall.jpg';
  window.setTimeout(function () { app.classList.add('is-ready'); }, 2500);
})();
