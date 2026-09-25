/* =============================================================================
   Rush Hour - CRT boot screen
   -----------------------------------------------------------------------------
   A beige 1990s terminal that stands in front of the dark room until the
   visitor presses a key (or clicks / taps). It then runs a short, fixed boot
   script - four checks, ACCESS GRANTED, "Starting application" - collapses the
   tube like a set being switched off, and fades away onto the dark room.

   The whole overlay is built here so a visitor without JavaScript is never
   stuck behind it. While it is up the room is `inert`, so Tab cannot reach the
   lamp chain underneath. When it has gone, `rushhour:booted` is dispatched on
   document (js/main.js starts the lamp hint from that).

   Timeline after the key press, in ms (about 3 s end to end):
     0      power-on flash
     280    header
     380    Checking / Validating / Authenticating / Processing, 230 apart
     1400   ACCESS GRANTED
     1850   Starting application...
     2450   tube collapses
     2600   overlay fades (500 ms), then is removed
============================================================================= */
(function () {
  'use strict';

  var RH = (window.RushHour = window.RushHour || {});

  var RIG_W = 520;
  var RIG_H = 510;
  var CHECKS = ['Checking', 'Validating', 'Authenticating', 'Processing'];
  var CHECK_GAP = 230;
  var CHECK_HOLD = 170;

  var app = document.getElementById('app');
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function motionOn() { return !reduceQuery.matches; }

  var boot = RH.boot = { done: false };

  /* -------------------------------------------------------------- build */

  function el(tag, cls, parent) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  }

  var root = el('div', 'boot');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Security terminal start-up');
  root.tabIndex = -1;

  var fitBox = el('div', 'boot-fit', root);
  var rig = el('div', 'boot-rig', fitBox);

  el('div', 'boot-shadow', rig);
  el('div', 'boot-base', rig);
  el('div', 'boot-neck', rig);
  el('div', 'boot-top', rig);

  var bezel = el('div', 'boot-bezel', rig);
  var well = el('div', 'boot-well', bezel);
  var screen = el('div', 'boot-screen', well);
  var crt = el('div', 'boot-crt', screen);
  var term = el('div', 'boot-term', crt);
  term.setAttribute('aria-live', 'polite');
  el('div', 'boot-sweep', crt);
  el('div', 'boot-scan', crt);
  el('div', 'boot-vignette', screen);
  el('div', 'boot-glare', screen);

  el('span', 'boot-badge', bezel).textContent = 'TMV-14';
  var knobs = el('span', 'boot-knobs', bezel);
  el('i', '', knobs);
  el('i', '', knobs);
  el('span', 'boot-led', bezel);

  var help = el('p', 'boot-help', root);
  help.textContent = 'Press any key or click to power on';

  document.body.appendChild(root);
  app.setAttribute('inert', '');
  root.focus({ preventScroll: true });

  /* ---------------------------------------------------------------- fit */

  function fit() {
    var s = Math.min(1, (window.innerWidth - 32) / RIG_W, (window.innerHeight - 96) / RIG_H);
    root.style.setProperty('--boot-s', Math.max(0.3, s).toFixed(4));
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);

  /* ----------------------------------------------------------- terminal */

  function line(text, cls, parent) {
    var node = el('div', 'boot-line' + (cls ? ' ' + cls : ''), parent || term);
    if (text) node.textContent = text;
    return node;
  }

  function cursor(parent) {
    el('span', 'boot-cursor', parent).textContent = '█';
  }

  function clear() {
    term.innerHTML = '';
    term.classList.remove('is-centered');
  }

  // Standby: the set is on but waiting.
  term.classList.add('is-centered');
  var standby = el('div', '', term);
  line('RUSH HOUR ARCHIVE', 'is-dim', standby);
  line('', '', standby);
  line('SYSTEM STANDBY', 'is-dim', standby);
  line('', '', standby);
  cursor(line('PRESS ANY KEY ', 'is-head', standby));

  /* ------------------------------------------------------------ sequence */

  var state = 'standby'; // standby -> running -> gone
  var timers = [];

  function at(ms, fn) { timers.push(window.setTimeout(fn, ms)); }

  function check(i, start) {
    var name = CHECKS[i];
    var node;
    at(start, function () { node = line(name + '…', 'is-pending'); });
    at(start + CHECK_HOLD, function () {
      node.className = 'boot-line is-done';
      node.innerHTML = '<span class="boot-tick">✓</span> ' + name + ' — done';
    });
  }

  function run() {
    if (state !== 'standby') return;
    state = 'running';
    root.classList.add('is-running');
    clear();

    if (motionOn()) crt.classList.add('is-flash');

    at(280, function () {
      crt.classList.remove('is-flash');
      line('TMV-14 SECURITY ARCHIVE', 'is-head');
      line('', '');
    });

    for (var i = 0; i < CHECKS.length; i++) check(i, 380 + i * CHECK_GAP);

    at(1400, function () {
      line('', '');
      line('ACCESS GRANTED', 'is-granted');
    });

    at(1850, function () {
      var node = line('Starting application', 'is-dim');
      var dots = el('span', '', node);
      var n = 0;
      var tick = window.setInterval(function () {
        n = (n + 1) % 4;
        dots.textContent = new Array(n + 1).join('.');
      }, 150);
      timers.push(tick);
    });

    at(2450, function () {
      if (motionOn()) crt.classList.add('is-off');
      root.classList.add('is-off');
    });

    at(2600, function () { root.classList.add('is-leaving'); });

    at(3100, finish);
  }

  function finish() {
    if (state === 'gone') return;
    state = 'gone';
    timers.forEach(function (t) { window.clearTimeout(t); window.clearInterval(t); });
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
    window.removeEventListener('orientationchange', fit);
    app.removeAttribute('inert');
    if (root.parentNode) root.parentNode.removeChild(root);
    boot.done = true;
    document.dispatchEvent(new CustomEvent('rushhour:booted'));
  }

  /* --------------------------------------------------------------- input */

  // Swallow every key while the overlay is up so nothing reaches the room;
  // any non-modifier key in standby powers the set on.
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts alone
    e.stopPropagation();
    if (e.key === 'Shift' || e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') return;
    e.preventDefault();
    if (!e.repeat) run();
  }
  window.addEventListener('keydown', onKey, true);

  root.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    run();
  });
})();
