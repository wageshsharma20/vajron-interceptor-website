// =====================================================================
// VAJRON high-speed autonomous flight demonstrator: procedural model
// 7-inch quadrotor with an aerodynamic body, modelled after the aircraft
// photograph: blunt nose with two openings, matte black upper shell with a
// hatch seam and latch, carbon-fibre rear section, dorsal and ventral fins,
// four airfoil arms, bullet motor pods and three-blade smoke-grey props.
// Units: metres. Axes: +X forward, +Y up, +Z right.
// =====================================================================

export const LAYOUT = {
  XN: 0.262, XT: -0.205,            // nose tip, tail end
  W: 0.074, H: 0.06,                // body half-width, half-height
  propR: 0.089,                     // 7-inch propellers
  motors: [                         // FR, FL, RR, RL
    [0.02, 0.0, 0.205], [0.02, 0.0, -0.205], [-0.19, 0.0, 0.19], [-0.19, 0.0, -0.19],
  ],
  bottomY: -0.1,                    // lowest point (ventral fin tip)
};

export function buildInterceptor(THREE) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const root = new THREE.Group(); root.name = 'VAJRON-DEMONSTRATOR';
  const M = makeMaterials(THREE);
  const parts = { rotors: [] };
  const mesh = (g, m, name) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; if (name) o.name = name; return o; };
  const { XN, XT, W, H } = LAYOUT;

  // ---------------------------------------------------------------
  // fuselage: lofted superellipse sections, UV mapped for the shell texture
  // ---------------------------------------------------------------
  const prof = (x) => {
    let w = W, h = H, yc = 0;
    const tN = (x - 0.12) / (XN - 0.12);                 // nose region
    if (tN > 0) { const k = Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, tN), 2.3))); w = W * k; h = H * (0.18 + 0.82 * k); yc = 0.012 * tN; }
    const tT = (-0.07 - x) / (-0.07 - XT);               // tail taper
    if (tT > 0) { const k = Math.min(1, tT); w = W * (1 - 0.2 * k); h = H * (1 - 0.3 * k); yc = -0.004 * k; }
    return { w: Math.max(w, 0.0015), h: Math.max(h, 0.002), yc };
  };
  {
    const NS = 64, NT = 48, n = 3.1, pos = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const s = i / NS, x = XT + (XN - XT) * (1 - Math.pow(1 - s, 1.0));
      const xx = Math.min(x, XN - 0.0008);
      const { w, h, yc } = prof(xx);
      for (let j = 0; j <= NT; j++) {
        const th = -Math.PI / 2 + (j / NT) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        pos.push(xx, yc + h * Math.sign(sn) * Math.abs(sn) ** (2 / n), w * Math.sign(c) * Math.abs(c) ** (2 / n));
        uv.push((xx - XT) / (XN - XT), j / NT);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) {
      const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    // nose cap
    const tip = pos.length / 3; pos.push(XN, prof(XN - 0.001).yc, 0); uv.push(1, 0.5);
    for (let j = 0; j < NT; j++) idx.push(NS * (NT + 1) + j, NS * (NT + 1) + j + 1, tip);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    root.add(mesh(g, M.shell, 'fuselage'));
    // flat tail plate with a small port
    const tp = prof(XT);
    const shape = new THREE.Shape();
    const N2 = 40;
    for (let j = 0; j <= N2; j++) {
      const th = (j / N2) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const zz = tp.w * Math.sign(c) * Math.abs(c) ** (2 / 3.1), yy = tp.yc + tp.h * Math.sign(sn) * Math.abs(sn) ** (2 / 3.1);
      j ? shape.lineTo(zz, yy) : shape.moveTo(zz, yy);
    }
    const cap = mesh(new THREE.ShapeGeometry(shape), M.carbonDark);
    cap.rotation.y = -Math.PI / 2; cap.position.x = XT - 0.0005;
    root.add(cap);
    const port = mesh(new THREE.BoxGeometry(0.002, 0.012, 0.03), M.hole);
    port.position.set(XT - 0.001, 0.012, 0.01); root.add(port);
  }

  // two openings in the nose (shown as dark recesses; function not published)
  [-1, 1].forEach((s) => {
    const x = XN - 0.024, p = prof(x);
    const nrm = V(0.62, 0.78, 0).normalize();
    const rim = mesh(new THREE.TorusGeometry(0.0115, 0.0024, 10, 28), M.black);
    const hole = mesh(new THREE.CircleGeometry(0.0115, 28), M.hole);
    const at = V(x, p.yc + p.h * 0.82, s * 0.019);
    [rim, hole].forEach((m) => { m.position.copy(at); m.lookAt(at.clone().add(nrm)); root.add(m); });
    hole.position.addScaledVector(nrm, -0.0015);
  });
  // hatch latch on the upper shell
  {
    const latch = mesh(new THREE.BoxGeometry(0.026, 0.008, 0.012, 1, 1, 1), M.blackGloss, 'latch');
    latch.position.set(0.075, H + 0.004, -0.018); latch.rotation.z = -0.12; root.add(latch);
  }

  // ---------------------------------------------------------------
  // fins
  // ---------------------------------------------------------------
  function fin(points, t) {
    const s = new THREE.Shape(); points.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2 });
    g.translate(0, 0, -t / 2);
    return mesh(g, M.shell);
  }
  root.add(fin([[-0.2, H - 0.012], [-0.03, H - 0.006], [-0.17, H + 0.058], [-0.205, H + 0.058]], 0.004));   // dorsal
  root.add(fin([[-0.2, -H * 0.62], [-0.13, -H * 0.62], [-0.19, LAYOUT.bottomY], [-0.212, LAYOUT.bottomY]], 0.004)); // ventral

  // ---------------------------------------------------------------
  // arms (airfoil struts), motor pods, props
  // ---------------------------------------------------------------
  function airfoil(chord, t, n = 12) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const x = (1 - Math.cos(Math.PI * i / n)) / 2; const y = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4); pts.push([x, y]); }
    const up = pts.slice().reverse(), lo = pts.slice(1, -1).map(([x, y]) => [x, -y]);
    return up.concat(lo).map(([x, y]) => [(x - 0.4) * chord, y * chord]);
  }
  function arm(a, b, c0, c1) {
    const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
    const side = V(-dir.z, 0, dir.x).normalize();          // chord direction (horizontal, across the arm)
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    const N = 10, pos = [], idx = [];
    let P = 0;
    for (let i = 0; i <= N; i++) {
      const k = i / N, c = c0 + (c1 - c0) * k, sec = airfoil(c, 0.14);
      P = sec.length;
      const o = a.clone().addScaledVector(dir, len * k);
      for (const [x, y] of sec) { const p = o.clone().addScaledVector(side, x).addScaledVector(up, y); pos.push(p.x, p.y, p.z); }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < P; j++) { const q = i * P + j, r = i * P + (j + 1) % P, s2 = q + P, t2 = r + P; idx.push(q, s2, r, r, s2, t2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return mesh(g, M.shell);
  }
  function blade(radius, rootR, chord, twR, twT) {
    const prof2 = airfoil(1, 0.08, 10).map(([x, y]) => [x + 0.4, y]), N = 14, P = prof2.length, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, r = rootR + (radius - rootR) * k;
      const ch = chord * (0.75 + 0.9 * k - 1.3 * k * k) + 0.004;
      const tw = (twR + (twT - twR) * k) * Math.PI / 180;
      const cd = V(0, -Math.sin(tw), Math.cos(tw)), td = V(0, Math.cos(tw), Math.sin(tw));
      const o = V(r, 0, -ch * 0.3 * Math.cos(tw));
      for (const [x, y] of prof2) { const p = o.clone().addScaledVector(cd, x * ch).addScaledVector(td, y * ch); pos.push(p.x, p.y, p.z); }
    }
    for (let s = 0; s < N; s++) for (let i = 0; i < P; i++) { const a = s * P + i, b = s * P + (i + 1) % P, c = a + P, d = b + P; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const bladeG = blade(LAYOUT.propR, 0.012, 0.022, 24, 10);
  const bladeGM = bladeG.clone(); bladeGM.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
  { const ix = bladeGM.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } bladeGM.computeVertexNormals(); }
  function blurDisc(r) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(128, 128, 8, 128, 128, 128);
    gr.addColorStop(0, 'rgba(90,94,100,0)'); gr.addColorStop(0.16, 'rgba(90,94,100,.34)');
    gr.addColorStop(0.6, 'rgba(120,124,130,.18)'); gr.addColorStop(0.93, 'rgba(160,164,170,.14)');
    gr.addColorStop(0.97, 'rgba(200,204,210,.3)'); gr.addColorStop(1, 'rgba(200,204,210,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
    return m;
  }

  const roots = [[-0.005, -0.028, 0.066], [-0.005, -0.028, -0.066], [-0.105, -0.026, 0.062], [-0.105, -0.026, -0.062]];
  LAYOUT.motors.forEach(([mx, my, mz], k) => {
    const mp = V(mx, my, mz);
    root.add(arm(V(...roots[k]), mp.clone().add(V(0, -0.006, 0)), 0.05, 0.034));
    // pod: housing, motor bell with bolt ring, prop, bullet spinner
    const housing = mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.03, 32), M.shell); housing.position.copy(mp).add(V(0, -0.008, 0));
    const bell = mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.012, 36), M.motor); bell.position.copy(mp).add(V(0, 0.013, 0));
    const ring = mesh(new THREE.CylinderGeometry(0.0208, 0.0208, 0.002, 36), M.silver); ring.position.copy(mp).add(V(0, 0.0065, 0));
    root.add(housing, bell, ring);
    for (let b = 0; b < 6; b++) { const bolt = mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.003, 8), M.silver); const an = b / 6 * Math.PI * 2; bolt.position.copy(mp).add(V(Math.cos(an) * 0.0205, 0.013, Math.sin(an) * 0.0205)); bolt.rotation.z = Math.PI / 2; bolt.rotation.y = -an; root.add(bolt); }
    const prop = new THREE.Group(); prop.position.copy(mp).add(V(0, 0.022, 0));
    const cw = k === 0 || k === 3;
    for (let b = 0; b < 3; b++) { const bl = mesh(cw ? bladeGM : bladeG, M.blade); bl.rotation.y = b * Math.PI * 2 / 3; bl.castShadow = false; prop.add(bl); }
    const hub = mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.009, 24), M.bladeHub); prop.add(hub);
    const spinner = mesh(new THREE.SphereGeometry(0.0205, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.shell); spinner.scale.y = 1.05; spinner.position.y = 0.004; prop.add(spinner);
    const disc = blurDisc(LAYOUT.propR * 1.01); disc.position.copy(prop.position);
    root.add(prop, disc);
    parts.rotors.push({ prop, disc, blades: prop.children.slice(0, 3), dir: cw ? -1 : 1, angle: k * 0.7, speed: 0 });
  });

  let mode = 'parked';
  const SPIN = 60;
  function setMode(m) { mode = m; }
  function update(dt) {
    const target = mode === 'parked' ? 0 : 1;
    parts.rotors.forEach((r) => {
      r.speed += (target - r.speed) * Math.min(1, dt * 2.4);
      if (r.speed > 0.02) r.angle += r.dir * SPIN * r.speed * dt;
      r.prop.rotation.y = r.angle;
      r.disc.material.opacity = Math.min(1, Math.max(0, (r.speed - 0.25) / 0.5)) * 0.7;
      r.blades.forEach((b) => { b.material = r.speed > 0.6 ? M.bladeFade : M.blade; });
    });
  }
  function snap(m) { mode = m; parts.rotors.forEach((r) => { r.speed = m === 'parked' ? 0 : 1; }); update(0); }
  return { group: root, parts, materials: M, setMode, snap, update, get mode() { return mode; } };
}

function makeMaterials(THREE) {
  // shell texture: matte black upper shell, carbon rear section, seams and vents
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024;
  const c = cv.getContext('2d');
  const U = (u) => u * 2048, Vv = (v) => v * 1024;
  c.fillStyle = '#121315'; c.fillRect(0, 0, 2048, 1024);
  // carbon weave on the rear 43 %
  for (let y = 0; y < 1024; y += 12) for (let x = 0; x < U(0.43); x += 12) {
    c.fillStyle = ((x + y) / 12) % 2 ? '#1c1d21' : '#131417'; c.fillRect(x, y, 12, 12);
    c.fillStyle = 'rgba(255,255,255,.025)'; c.fillRect(x + 1, y + 1, 10, 2);
  }
  // section seam
  c.fillStyle = '#0c0c0e'; c.fillRect(U(0.43) - 3, 0, 6, 1024);
  c.strokeStyle = '#0d0d0f'; c.lineWidth = 5; c.lineCap = 'round';
  // hatch outline on the top front
  c.beginPath(); c.moveTo(U(0.97), Vv(0.455)); c.bezierCurveTo(U(0.86), Vv(0.44), U(0.7), Vv(0.43), U(0.6), Vv(0.45));
  c.bezierCurveTo(U(0.52), Vv(0.47), U(0.5), Vv(0.54), U(0.47), Vv(0.6)); c.stroke();
  c.beginPath(); c.moveTo(U(0.47), Vv(0.6)); c.lineTo(U(0.47), Vv(0.72)); c.stroke();
  // nose panel line
  c.beginPath(); c.moveTo(U(0.9), Vv(0.53)); c.lineTo(U(0.9), Vv(0.62)); c.lineTo(U(0.99), Vv(0.63)); c.stroke();
  // three vent slots on the right upper side
  c.fillStyle = '#060607';
  for (let i = 0; i < 3; i++) { const x = U(0.455 + i * 0.022); c.beginPath(); c.roundRect(x, Vv(0.35), 22, Vv(0.07), 10); c.fill(); }
  // two small screws at the seam
  c.fillStyle = '#8c9096'; [[0.435, 0.32], [0.435, 0.68]].forEach(([u, v]) => { c.beginPath(); c.arc(U(u), Vv(v), 7, 0, Math.PI * 2); c.fill(); });
  const shellTex = new THREE.CanvasTexture(cv); shellTex.colorSpace = THREE.SRGBColorSpace; shellTex.anisotropy = 8;
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: shellTex, roughness: 0.66, metalness: 0.04, clearcoat: 0.18, clearcoatRoughness: 0.55, envMapIntensity: 0.75 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x141517, roughness: 0.55, metalness: 0.05 });
  const blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x101113, roughness: 0.25, clearcoat: 0.8 });
  const carbonDark = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.6, side: THREE.DoubleSide });
  const hole = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.4 });
  const motor = new THREE.MeshPhysicalMaterial({ color: 0x0f1012, roughness: 0.3, metalness: 0.6, clearcoat: 0.6 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 1 });
  const blade = new THREE.MeshPhysicalMaterial({ color: 0x6f747a, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.86, clearcoat: 0.6, side: THREE.DoubleSide });
  const bladeFade = blade.clone(); bladeFade.opacity = 0.12; bladeFade.depthWrite = false;
  const bladeHub = new THREE.MeshPhysicalMaterial({ color: 0x55595f, roughness: 0.35, transparent: true, opacity: 0.9 });
  return { shell, black, blackGloss, carbonDark, hole, motor, silver, blade, bladeFade, bladeHub };
}
