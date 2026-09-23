/* =============================================================================
   Rush Hour - pull-chain lamp
   -----------------------------------------------------------------------------
   The chain hanging off the banker's lamp is the only thing in the dark room
   that responds. It accepts a plain click/tap OR a drag downwards:

   - A drag must carry the chain past PULL_THRESHOLD to register.
   - A press whose pointer never moved more than TAP_SLOP counts as a click,
     so a small accidental wobble on a trackpad or finger still switches the
     light on instead of being thrown away as a failed drag.
   - The chain can never travel past MAX_TRAVEL, and springs back on release.

   Once the pull registers the chain is yanked to full travel, and the light
   flips on CHAIN_TRAVEL_MS later so the mechanical snap reads before the room
   responds. Visual ramps (bulb, room) are CSS transitions keyed off the
   .is-pulling / .is-lit classes this module puts on the app root.
============================================================================= */
(function () {
  'use strict';

  var RH = (window.RushHour = window.RushHour || {});

  /* All lengths are in the lamp's own CSS px unless marked "screen px". */
  var CHAIN_LENGTH = 84;
  /** Hard stop so the chain cannot be dragged into the desk. */
  var MAX_TRAVEL = 60;
  /** How far the chain must travel before a drag counts as a pull. */
  var PULL_THRESHOLD = MAX_TRAVEL * (0.065 / 0.15);
  /** Screen px of pointer travel that takes the chain to MAX_TRAVEL (~78px). */
  var DRAG_FOR_MAX = 78;
  /** Pointer travel under this (screen px) is a click, not a drag. */
  var TAP_SLOP = 6;
  /** Delay between the pull registering and the light actually coming on. */
  var CHAIN_TRAVEL_MS = 260;
  /** Damping rate the chain uses to chase its target position. */
  var FOLLOW = 14;

  /* Pendulum for the chain's swing, in degrees. */
  var SWING_STIFFNESS = 38;
  var SWING_DAMPING = 2.6;
  var IDLE_SWAY_DEG = 0.7;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  /** Frame-rate independent exponential approach (same maths as MathUtils.damp). */
  function damp(from, to, lambda, dt) { return from + (to - from) * (1 - Math.exp(-lambda * dt)); }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.app      root that receives the state classes
   * @param {object}      opts.parts    { chain, cord, pull, hit } from buildRoom
   * @param {function}    opts.motionOn returns false under reduced motion
   * @param {function}   [opts.onPull]  fired once when the pull registers
   * @param {function}   [opts.onLit]   fired once when the light comes on
   */
  RH.createLamp = function (opts) {
    var app = opts.app;
    var parts = opts.parts;

    var state = { lampOn: false, pulling: false };
    var drag = { active: false, id: null, startX: 0, startY: 0, moved: 0 };

    var offset = 0; // current chain travel
    var target = 0; // where a drag wants the chain
    var angle = 0; // swing, degrees
    var angVel = 0;
    var last = 0;
    var clock = 0;

    function interactive() { return !state.lampOn && !state.pulling; }

    /* ------------------------------------------------------------ the pull */

    function pullLamp() {
      // Guard re-entrancy: the light only ever turns on once.
      if (state.lampOn || state.pulling) return;
      state.pulling = true;
      app.classList.add('is-pulling');
      app.classList.remove('is-chain-hover'); // a disabled button never gets pointerleave
      parts.hit.disabled = true;
      if (opts.onPull) opts.onPull();

      var travel = opts.motionOn() ? CHAIN_TRAVEL_MS : 0;
      window.setTimeout(function () {
        state.lampOn = true;
        state.pulling = false;
        app.classList.remove('is-dark', 'is-pulling');
        app.classList.add('is-lit');
        parts.hit.setAttribute('aria-label', 'The lamp is on');
        angVel += 55; // the chain swings as it is released
        if (opts.onLit) opts.onLit();
      }, travel);
    }

    /* ------------------------------------------------------ pointer input */

    function onDown(e) {
      if (!interactive()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      drag.active = true;
      drag.id = e.pointerId;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.moved = 0;
      try { parts.hit.setPointerCapture(e.pointerId); } catch (_) { /* old Safari */ }
      app.classList.add('is-grabbing');
    }

    function onMove(e) {
      if (!drag.active || e.pointerId !== drag.id) return;
      var dy = e.clientY - drag.startY;
      var travelled = Math.max(Math.abs(dy), Math.abs(e.clientX - drag.startX));
      drag.moved = Math.max(drag.moved, travelled);
      target = clamp(dy * (MAX_TRAVEL / DRAG_FOR_MAX), 0, MAX_TRAVEL);
    }

    function endDrag(e, cancelled) {
      if (!drag.active || (e && e.pointerId !== drag.id)) return;
      drag.active = false;
      app.classList.remove('is-grabbing');
      try { parts.hit.releasePointerCapture(drag.id); } catch (_) { /* already released */ }

      // Either condition turns the light on: a real pull, or a real click.
      var pulledFarEnough = Math.max(offset, target) > PULL_THRESHOLD;
      var wasTap = drag.moved < TAP_SLOP;

      target = 0;
      if (pulledFarEnough || (wasTap && !cancelled)) {
        pullLamp();
      } else {
        angVel += offset * 0.6; // let go early: it just swings back
      }
    }

    parts.hit.addEventListener('pointerdown', onDown);
    parts.hit.addEventListener('pointermove', onMove);
    parts.hit.addEventListener('pointerup', function (e) { endDrag(e, false); });
    parts.hit.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    parts.hit.addEventListener('lostpointercapture', function (e) { if (drag.active) endDrag(e, true); });

    // Keyboard: Enter / Space on the focused chain fires a synthetic click
    // with detail 0. Pointer clicks are already handled on pointerup above.
    parts.hit.addEventListener('click', function (e) {
      if (e.detail === 0) pullLamp();
    });

    parts.hit.addEventListener('pointerenter', function () {
      if (interactive()) app.classList.add('is-chain-hover');
    });
    parts.hit.addEventListener('pointerleave', function () {
      app.classList.remove('is-chain-hover');
    });

    /* ----------------------------------------------------------- animation */

    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      clock += dt;

      var motion = opts.motionOn();
      // While the lamp is firing, yank the chain to full travel so the pull
      // reads as a mechanical action rather than a state flip.
      var resting = state.pulling ? MAX_TRAVEL : target;

      if (motion) {
        offset = damp(offset, resting, FOLLOW, dt);

        // Slow idle sway so the chain never looks frozen, plus a slight lean
        // as it is pulled. Pendulum dynamics give it a natural settle.
        var sway = drag.active ? 0 : Math.sin(clock * 1.1) * IDLE_SWAY_DEG;
        var rest = sway + (offset / MAX_TRAVEL) * 1.2;
        angVel += (-SWING_STIFFNESS * (angle - rest) - SWING_DAMPING * angVel) * dt;
        angle += angVel * dt;
      } else {
        offset = resting;
        angle = 0;
        angVel = 0;
      }

      parts.cord.style.height = CHAIN_LENGTH + offset + 'px';
      parts.pull.style.transform = 'translate3d(0,' + offset.toFixed(2) + 'px,0)';
      parts.chain.style.transform = 'rotate(' + angle.toFixed(3) + 'deg)';

      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);

    return {
      get lampOn() { return state.lampOn; },
      pull: pullLamp
    };
  };

  RH.lampConfig = { CHAIN_LENGTH: CHAIN_LENGTH, MAX_TRAVEL: MAX_TRAVEL, PULL_THRESHOLD: PULL_THRESHOLD, TAP_SLOP: TAP_SLOP };
})();
