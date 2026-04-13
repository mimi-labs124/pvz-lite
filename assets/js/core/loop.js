/**
 * core/loop.js — Game lifecycle & requestAnimationFrame control
 *
 * Encapsulates:
 * - rAF scheduling
 * - pause/resume state
 * - delta-time calculation with capping
 * - frame callback dispatch
 */

const MAX_DT = 0.033; // cap at ~30fps minimum step

export function createLoop(onTick) {
  let loopId = null;
  let lastTime = 0;
  let paused = false;

  function frame(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    if (!paused) onTick(dt);
    loopId = requestAnimationFrame(frame);
  }

  return {
    start() {
      this.stop();
      lastTime = 0;
      paused = false;
      loopId = requestAnimationFrame(frame);
    },
    stop() {
      if (loopId != null) cancelAnimationFrame(loopId);
      loopId = null;
    },
    get paused() { return paused; },
    set paused(v) { paused = v; },
    resetTime() { lastTime = 0; },
  };
}
