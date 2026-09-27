// =====================================================================
// Live 3D viewer for the page (flight-mode module).
// Horizontal drag turns the aircraft; vertical swipes still scroll the
// page (touch-action: pan-y), so it behaves on iPad. Renders only while
// on screen and the page is visible; the static render stays if WebGL is
// unavailable.
// Modes: parked (props still), hover (rotors spinning, gentle bob),
// cruise (rotors spinning, nose pitched down as in fast forward flight).
// =====================================================================
import * as THREE from 'three';
import { createStage } from './stage.js';
import { buildInterceptor, LAYOUT } from './icpt.js';

export function mountViewer(canvas, opt = {}) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let S;
  try {
    S = createStage(canvas, { alpha: true, shadows: false, envIntensity: opt.env ?? 0.72, pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      groundY: LAYOUT.bottomY - 0.06, contactW: 0.95, contactD: 0.8 });
  } catch (e) { return null; }
  if (!S.renderer.getContext()) return null;
  S.contact.material.opacity = opt.contact ?? 0.5;

  const D = buildInterceptor(THREE);
  const pivot = new THREE.Group(), tilt = new THREE.Group();
  D.group.position.x = 0.03;                 // visual centre onto the pivot
  tilt.add(D.group); pivot.add(tilt);
  S.scene.add(pivot);
  let mode = opt.mode || 'parked';
  D.snap(mode === 'parked' ? 'parked' : 'flight');

  let yaw = opt.yaw ?? -0.7, vel = 0, dragging = false, lastX = 0, lastT = 0, idle = 0, moved = false;
  const elev = opt.elev ?? 0.32, fov = opt.fov ?? 26, fit = opt.fit ?? 1.3;
  let visible = false, raf = 0, clock = performance.now(), bob = 0, pitch = mode === 'cruise' ? -0.42 : 0;

  function frameCamera() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    S.resize(w, h);
    S.camera.fov = fov;
    const vf = fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (w / h));
    const d = Math.max(0.36 / Math.tan(hf / 2), 0.2 / Math.tan(vf / 2)) * fit;
    S.camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev));
    S.camera.lookAt(0, opt.lookY ?? -0.01, 0);
    S.camera.updateProjectionMatrix();
  }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - clock) / 1000); clock = now;
    if (!dragging) {
      if (Math.abs(vel) > 0.0005) { yaw += vel * dt; vel *= Math.pow(0.04, dt); }
      else if (!reduce && opt.autoRotate !== false) { idle += dt; if (idle > 2.2) yaw += 0.16 * dt; }
    }
    pivot.rotation.y = yaw;
    const tp = mode === 'cruise' ? -0.42 : 0;
    pitch += (tp - pitch) * Math.min(1, dt * (reduce ? 20 : 2.2));
    tilt.rotation.z = pitch;
    if (!reduce && mode !== 'parked') bob += dt;
    pivot.position.y = mode === 'parked' ? pivot.position.y * 0.9 : Math.sin(bob * 1.3) * 0.006;
    D.update(dt);
    S.render();
    if (!canvas.classList.contains('is-ready')) { canvas.classList.add('is-ready'); opt.onReady && opt.onReady(); }
    if (visible && !document.hidden) raf = requestAnimationFrame(tick);
  }
  const start = () => { if (!raf && visible && !document.hidden) { clock = performance.now(); raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; lastX = e.clientX; lastT = performance.now(); vel = 0; idle = 0;
    canvas.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - lastX, dts = Math.max(0.008, (now - lastT) / 1000);
    if (Math.abs(dx) > 2) moved = true;
    const d = dx * 0.0085;
    yaw += d; vel = d / dts; lastX = e.clientX; lastT = now;
    if (moved && opt.onInteract) opt.onInteract();
  }, { passive: true });
  const end = () => { if (!dragging) return; dragging = false; idle = 0; canvas.classList.remove('is-dragging'); };
  window.addEventListener('pointerup', end, { passive: true });
  window.addEventListener('pointercancel', end, { passive: true });

  const ro = new ResizeObserver(() => { frameCamera(); if (!raf) S.render(); });
  ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.02 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  frameCamera();

  return {
    setMode(m) { mode = m; D.setMode(m === 'parked' ? 'parked' : 'flight'); idle = 0; start(); },
    get mode() { return mode; },
  };
}
