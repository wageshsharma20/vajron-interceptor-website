// =====================================================================
// VAJRON high-speed autonomous flight demonstrator: procedural model
// A dart layout, modelled after the aircraft photograph: a long
// aerodynamic body with the nose forward, and all four wings at the
// tail in an X. Each wing carries a motor pod whose propeller faces the
// nose, so the aircraft stands on its tail for vertical take-off and
// pitches over to fly nose-first at speed.
// Body details: blunt nose with two openings, matte black front shell with
// a hatch seam and latch, three side vents, carbon-fibre rear half, a
// dorsal fin and a small ventral fin at the tail.
// Units: metres. Body axes: +X nose, +Y dorsal (fin side), +Z right.
// =====================================================================

export const LAYOUT = {
  XN: 0.25, XT: -0.26,              // nose face (lower edge), tail end
  W: 0.06, H: 0.057,                // body half-width, half-height
  propR: 0.089,                     // 7-inch propellers
  podR: 0.18,                       // pod axis distance from the body axis
  propX: -0.152,                    // propeller plane
  wingPhi: [45, 135, 225, 315],     // wing angles around the body, from +Y toward +Z (deg)
  tailY: -0.272,                    // lowest point when standing on the tail (fin tip)
};

export function buildInterceptor(THREE) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const root = new THREE.Group(); root.name = 'VAJRON-DEMONSTRATOR';
  const M = makeMaterials(THREE);
  const parts = { rotors: [] };
  const mesh = (g, m, name) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; if (name) o.name = name; return o; };
  const { XN, XT, W, H } = LAYOUT;
  const deg = (d) => d * Math.PI / 180;

  // ---------------------------------------------------------------
  // body: lofted superellipse sections, UV mapped for the shell texture
  // ---------------------------------------------------------------
  const prof = (x) => {
    let w = W, h = H, yc = 0;
    if (x > -0.002) { const s = Math.min(1, (x + 0.002) / 0.004); w *= 1 + 0.035 * s; h *= 1 + 0.035 * s; }   // front shell sits proud of the carbon section
    const tN = (x - 0.03) / (XN - 0.03);                 // long ogive over the front shell, ending in the sloped nose face
    if (tN > 0) { const k = Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, tN), 2.0) * 0.8)); w *= k; h *= k; yc = 0.004 * tN; }
    const tT = (-0.12 - x) / (-0.12 - XT);               // gentle taper to the tail
    if (tT > 0) { const k = Math.min(1, tT); w = W * (1 - 0.12 * k); h = H * (1 - 0.14 * k); }
    return { w: Math.max(w, 0.002), h: Math.max(h, 0.002), yc };
  };
  const n = 3.2;
  const SLOPE = 0.032;                                   // how far the top of the nose face recedes
  const surf = (x, th) => { const { w, h, yc } = prof(x), c = Math.cos(th), s = Math.sin(th);
    const yn = Math.sign(s) * Math.abs(s) ** (2 / n), k = Math.max(0, (x - (XN - 0.05)) / 0.05);   // bend the last 5 cm into the slope
    return V(x - SLOPE * k * (1 + yn) / 2, yc + h * yn, w * Math.sign(c) * Math.abs(c) ** (2 / n)); };
  {
    const NS = 80, NT = 56, pos = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const s = i / NS, x = Math.min(XT + (XN - XT) * s, XN - 0.0006);
      for (let j = 0; j <= NT; j++) { const th = -Math.PI / 2 + (j / NT) * Math.PI * 2, p = surf(x, th); pos.push(p.x, p.y, p.z); uv.push((x - XT) / (XN - XT), j / NT); }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const tip = pos.length / 3; pos.push(XN - SLOPE / 2, prof(XN).yc, 0); uv.push(1, 0.5);
    for (let j = 0; j < NT; j++) idx.push(NS * (NT + 1) + j, NS * (NT + 1) + j + 1, tip);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    root.add(mesh(g, M.shell, 'body'));
    // flat tail with a small port
    const shape = new THREE.Shape();
    for (let j = 0; j <= 48; j++) { const p = surf(XT, (j / 48) * Math.PI * 2); j ? shape.lineTo(p.z, p.y) : shape.moveTo(p.z, p.y); }
    const cap = mesh(new THREE.ShapeGeometry(shape), M.carbonDark); cap.rotation.y = -Math.PI / 2; cap.position.x = XT - 0.0004; root.add(cap);
    const port = mesh(new THREE.BoxGeometry(0.004, 0.014, 0.026), M.hole); port.position.set(XT - 0.001, 0.02, 0.012); root.add(port);
  }

  // two openings in the nose, angled toward the dorsal side (function not published)
  {
    const hN = prof(XN).h, nrm = V(2 * hN, SLOPE, 0).normalize();
    [-1, 1].forEach((s) => {
      const yy = prof(XN).yc + hN * 0.25, base = V(XN - SLOPE * (1 + 0.25) / 2 - 0.004, yy, s * 0.016);
      const tube = mesh(new THREE.CylinderGeometry(0.0118, 0.0118, 0.016, 28, 1, true), M.black);
      tube.position.copy(base); tube.quaternion.setFromUnitVectors(V(0, 1, 0), nrm); root.add(tube);
      const hole = mesh(new THREE.CircleGeometry(0.0112, 28), M.hole);
      hole.position.copy(base).addScaledVector(nrm, 0.003); hole.lookAt(hole.position.clone().add(nrm)); root.add(hole);
      const rim = mesh(new THREE.TorusGeometry(0.0118, 0.0018, 8, 28), M.black);
      rim.position.copy(base).addScaledVector(nrm, 0.0085); rim.lookAt(rim.position.clone().add(nrm)); root.add(rim);
    });
  }
  // hatch latch on the dorsal front shell
  { const latch = mesh(new THREE.BoxGeometry(0.03, 0.009, 0.011), M.blackGloss, 'latch'); latch.position.set(0.075, H + 0.0035, -0.02); latch.rotation.x = 0.1; root.add(latch); }

  // ---------------------------------------------------------------
  // fins: a long dorsal fin over the rear half, a small ventral fin at the tail
  // ---------------------------------------------------------------
  function fin(points, t, flip) {
    const s = new THREE.Shape(); points.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2 });
    g.translate(0, 0, -t / 2); if (flip) g.scale(1, -1, 1);
    return mesh(g, M.shell);
  }
  root.add(fin([[-0.005, H * 0.86 - 0.004], [-0.238, H * 0.86 + 0.07], [-0.262, H * 0.86 + 0.07], [-0.262, H * 0.86 - 0.006]], 0.005));
  root.add(fin([[-0.19, H * 0.82 - 0.004], [-0.248, H * 0.82 + 0.03], [-0.272, H * 0.82 + 0.03], [-0.262, H * 0.82 - 0.004]], 0.004, true));

  // ---------------------------------------------------------------
  // four rear wings in an X, each carrying a motor pod
  // ---------------------------------------------------------------
  function airfoil(chord, t, nn = 12) {
    const pts = [];
    for (let i = 0; i <= nn; i++) { const x = (1 - Math.cos(Math.PI * i / nn)) / 2; const y = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4); pts.push([x, y]); }
    const up = pts.slice().reverse(), lo = pts.slice(1, -1).map(([x, y]) => [x, -y]);
    return up.concat(lo).map(([x, y]) => [x * chord, y * chord]);        // x from 0 (LE) to chord (TE)
  }
  function wing(phi) {
    const e = V(0, Math.cos(phi), Math.sin(phi)), nrm = V(0, -Math.sin(phi), Math.cos(phi));
    const r0 = 0.045, r1 = LAYOUT.podR - 0.016;                      // root buried in the body, tip into the pod
    const N = 12, pos = [], idx = []; let P = 0;
    for (let i = 0; i <= N; i++) {
      const k = i / N, r = r0 + (r1 - r0) * k;
      const le = -0.07 - 0.098 * k + 0.02 * Math.pow(1 - k, 6), te = -0.15 - 0.058 * k;   // strut-like wing, root fillet
      const chord = le - te, t = 0.2 - 0.04 * k, sec = airfoil(chord, t);
      P = sec.length;
      for (const [cx, cy] of sec) { const p = V(le - cx, 0, 0).addScaledVector(e, r).addScaledVector(nrm, cy * 1); pos.push(p.x, p.y, p.z); }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < P; j++) { const q = i * P + j, rr = i * P + (j + 1) % P, s2 = q + P, t2 = rr + P; idx.push(q, rr, s2, rr, t2, s2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return mesh(g, M.shell);
  }
  function blade(radius, rootR, chord, twR, twT) {
    const prof2 = airfoil(1, 0.08, 10).map(([x, y]) => [x, y]), N = 14, P = prof2.length, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, r = rootR + (radius - rootR) * k;
      const ch = chord * (0.8 + 0.9 * k - 1.35 * k * k) + 0.004;
      const tw = (twR + (twT - twR) * k) * Math.PI / 180;
      const cd = V(0, -Math.sin(tw), Math.cos(tw)), td = V(0, Math.cos(tw), Math.sin(tw));
      const o = V(r, 0, -ch * 0.35 * Math.cos(tw));
      for (const [x, y] of prof2) { const p = o.clone().addScaledVector(cd, x * ch).addScaledVector(td, y * ch); pos.push(p.x, p.y, p.z); }
    }
    for (let s = 0; s < N; s++) for (let i = 0; i < P; i++) { const a = s * P + i, b = s * P + (i + 1) % P, c = a + P, d = b + P; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const bladeG = blade(LAYOUT.propR, 0.012, 0.031, 15, 6);
  const bladeGM = bladeG.clone(); bladeGM.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
  { const ix = bladeGM.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } bladeGM.computeVertexNormals(); }
  function blurDisc(r) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(128, 128, 8, 128, 128, 128);
    gr.addColorStop(0, 'rgba(90,94,100,0)'); gr.addColorStop(0.2, 'rgba(90,94,100,.34)');
    gr.addColorStop(0.6, 'rgba(120,124,130,.18)'); gr.addColorStop(0.93, 'rgba(160,164,170,.14)');
    gr.addColorStop(0.97, 'rgba(200,204,210,.3)'); gr.addColorStop(1, 'rgba(200,204,210,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
    return m;
  }

  LAYOUT.wingPhi.forEach((pd, k) => {
    const phi = deg(pd), e = V(0, Math.cos(phi), Math.sin(phi));
    root.add(wing(phi));
    const c = e.clone().multiplyScalar(LAYOUT.podR);               // pod axis, parallel to the body
    const along = (x0, x1, r0, r1, mat, seg = 32) => {
      const m = mesh(new THREE.CylinderGeometry(r1, r0, x1 - x0, seg), mat);
      m.rotation.z = -Math.PI / 2; m.position.copy(c).setX((x0 + x1) / 2); return m;
    };
    root.add(along(-0.21, -0.166, 0.013, 0.0175, M.shell));           // housing, tapering aft
    root.add(along(-0.166, -0.160, 0.0195, 0.0195, M.silver));        // bolt ring
    root.add(along(-0.160, -0.147, 0.0205, 0.0205, M.motor));         // motor bell
    for (let b = 0; b < 6; b++) {
      const an = b / 6 * Math.PI * 2, u = V(0, Math.cos(an), Math.sin(an));
      const bolt = mesh(new THREE.SphereGeometry(0.0017, 8, 6), M.silver); bolt.position.copy(c).addScaledVector(u, 0.0195).setX(-0.163); root.add(bolt);
    }
    // propeller: mount turns the prop axis onto +X, the inner group spins
    const mount = new THREE.Group(); mount.position.copy(c).setX(LAYOUT.propX + 0.006); mount.rotation.z = -Math.PI / 2;
    const prop = new THREE.Group(); mount.add(prop);
    const cw = k % 2 === 0;
    for (let b = 0; b < 3; b++) { const bl = mesh(cw ? bladeGM : bladeG, M.blade); bl.rotation.y = b * Math.PI * 2 / 3; bl.castShadow = false; prop.add(bl); }
    const hub = mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.008, 24), M.bladeHub); prop.add(hub);
    const spinner = mesh(new THREE.SphereGeometry(0.019, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.shell); spinner.scale.y = 1.15; spinner.position.y = 0.003; prop.add(spinner);
    const disc = blurDisc(LAYOUT.propR * 1.01); mount.add(disc);
    root.add(mount);
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
  // shell texture (u: tail 0 -> nose 1, v: around, 0.5 = dorsal): matte black front
  // shell, carbon rear half, hatch seam, vents and screws
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024;
  const c = cv.getContext('2d');
  const U = (u) => u * 2048, Vv = (v) => v * 1024;
  c.fillStyle = '#121315'; c.fillRect(0, 0, 2048, 1024);
  for (let y = 0; y < 1024; y += 12) for (let x = 0; x < U(0.49); x += 12) {
    c.fillStyle = ((x + y) / 12) % 2 ? '#1c1d21' : '#131417'; c.fillRect(x, y, 12, 12);
    c.fillStyle = 'rgba(255,255,255,.025)'; c.fillRect(x + 1, y + 1, 10, 2);
  }
  c.fillStyle = '#0a0a0c'; c.fillRect(U(0.49) - 3, 0, 6, 1024);
  c.strokeStyle = '#0b0b0d'; c.lineWidth = 5; c.lineCap = 'round';
  // hatch outline across the dorsal front shell
  c.beginPath(); c.moveTo(U(0.965), Vv(0.43)); c.bezierCurveTo(U(0.88), Vv(0.40), U(0.72), Vv(0.40), U(0.64), Vv(0.44));
  c.bezierCurveTo(U(0.58), Vv(0.47), U(0.56), Vv(0.53), U(0.535), Vv(0.6)); c.lineTo(U(0.535), Vv(0.74)); c.stroke();
  c.save(); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 3; c.translate(0, 5);
  c.beginPath(); c.moveTo(U(0.965), Vv(0.43)); c.bezierCurveTo(U(0.88), Vv(0.40), U(0.72), Vv(0.40), U(0.64), Vv(0.44));
  c.bezierCurveTo(U(0.58), Vv(0.47), U(0.56), Vv(0.53), U(0.535), Vv(0.6)); c.lineTo(U(0.535), Vv(0.74)); c.stroke(); c.restore();
  c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(U(0.49) + 3, 0, 3, 1024);
  // nose panel
  c.beginPath(); c.moveTo(U(0.93), Vv(0.56)); c.lineTo(U(0.93), Vv(0.64)); c.lineTo(U(0.995), Vv(0.645)); c.stroke();
  // three vent slots on the right side, just ahead of the carbon section
  c.fillStyle = '#050506';
  for (let i = 0; i < 3; i++) { const x = U(0.505 + i * 0.02); c.beginPath(); c.roundRect(x, Vv(0.34), 20, Vv(0.065), 9); c.fill(); }
  c.fillStyle = '#8c9096'; [[0.492, 0.33], [0.492, 0.67]].forEach(([u, v]) => { c.beginPath(); c.arc(U(u), Vv(v), 7, 0, Math.PI * 2); c.fill(); });
  const shellTex = new THREE.CanvasTexture(cv); shellTex.colorSpace = THREE.SRGBColorSpace; shellTex.anisotropy = 8;
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: shellTex, roughness: 0.66, metalness: 0.04, clearcoat: 0.18, clearcoatRoughness: 0.55, envMapIntensity: 0.75, side: THREE.DoubleSide });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x141517, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
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
