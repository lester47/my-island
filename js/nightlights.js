// 🏮 夜市燈火：天黑後整個市集燈火通明（白天看起來和原本一樣）
// - 每座島上空拉幾條紅燈籠串（避開熱氣球起降場和高的東西）
// - 每個攤位前面一盞暖黃燈泡＋地上一圈暖光
// - 每座島邊緣一圈小燈
// - 島面整片暖光（像被燈照亮）
// 全部用發光材質和加亮的透明圓片，沒有真的光源：手機也跑得動。
import * as THREE from 'three';
import { TAU } from './kit.js?v=20261126n';
import { H } from './world.js?v=20261126n';

export function createNightMarket(W, opts = {}) {
  const { scene } = W, low = !!opts.low;
  const root = new THREE.Group(); scene.add(root);
  const avoid = opts.avoid || [];                     // [{ x, z, r }]：燈籠串不要經過的地方（熱氣球起降場）
  const glowMats = [];                                // { m, max }：天黑時 emissiveIntensity
  const pools = [];                                   // 加亮的地面光：{ m, max }
  // 有實例顏色的燈籠／小燈：發光顏色＝自己的顏色
  const glowVC = (m) => { m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'); }; m.customProgramCacheKey = () => 'glowVC-night'; return m; };
  // 柔和的圓形光暈（中間亮、外圈透明）
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const pool = (x, z, r, color, max, y = H + .035) => {
    const m = new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.renderOrder = 2; o.visible = false; root.add(o);
    pools.push({ o, m, max }); return o;
  };
  const isles = Object.values(W.islands);
  // 這個點在不在步道／車道上（各島環路、通往橋頭和碼頭的支線）
  const corrOf = (I) => [...(I.bridgeAngles || []), ...(I.entryAngles || [])];
  const pathHalf = (I) => (I.R > 8 ? .75 : .6);
  function onPath(x, z) {
    for (const I of isles) {
      const dx = x - I.pos.x, dz = z - I.pos.z, r = Math.hypot(dx, dz); if (r > I.R * 1.1) continue;
      if (Math.abs(r - I.ring) < pathHalf(I) + .15) return true;
      for (const a of corrOf(I)) { const u = dx * Math.cos(a) + dz * Math.sin(a), v = -dx * Math.sin(a) + dz * Math.cos(a); if (u > I.ring && u < I.R * 1.1 && Math.abs(v) < .8) return true; }
    }
    return false;
  }

  // ---------------- 1. 島面整片暖光＋每座主題島一盞大暖燈（跟服務台一樣亮）
  for (const I of isles) pool(I.pos.x, I.pos.z, I.R * 1.05, '#ffcf8a', low ? .4 : .3);
  const lights = [];
  if (!low) for (const I of isles) { if (I.R > 8) continue; const l = new THREE.PointLight('#ffcf73', 0, 17, 1.5); l.position.set(I.pos.x, H + 3.4, I.pos.z); scene.add(l); lights.push(l); }
  for (const x of opts.glow || []) glowMats.push(x);   // 其他模組的夜燈材質（熱氣球停機坪的邊燈）

  // ---------------- 2. 紅燈籠串：每座島上空拉幾條（弦），燈籠每 0.9 公尺一顆
  const LANT = ['#ff3b2a', '#ff6a2a', '#ffb020', '#ff3b2a', '#ff4f7a'];
  const lanterns = [];                                 // { x, y, z, c }
  const strings = [];
  const segAvoid = (a, b) => avoid.some((q) => { const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz; let t = ((q.x - a.x) * dx + (q.z - a.z) * dz) / (L2 || 1); t = Math.max(0, Math.min(1, t)); return Math.hypot(a.x + dx * t - q.x, a.z + dz * t - q.z) < q.r; });
  for (const I of isles) {
    const isC = I.R > 8, n = isC ? 4 : 3, off = isC ? .5 : .32, yS = H + (isC ? 3.9 : 3.5);
    for (let k = 0; k < n; k++) {
      const ang = k / n * Math.PI + .35 + I.R;           // 每條弦的方向
      const nx = Math.cos(ang + Math.PI / 2), nz = Math.sin(ang + Math.PI / 2), d = (k % 2 ? 1 : -1) * I.R * off * (isC ? 1 : .6);
      const cx = I.pos.x + nx * d, cz = I.pos.z + nz * d, ux = Math.cos(ang), uz = Math.sin(ang);
      // 弦的兩端：從中點往兩邊走到島邊（top 半徑的 0.85）
      const half = Math.sqrt(Math.max(1, (I.R * .82) ** 2 - d * d));
      const a = { x: cx - ux * half, z: cz - uz * half }, b = { x: cx + ux * half, z: cz + uz * half };
      // 竹竿不能立在步道上：端點落在步道上就沿著弦往內縮
      for (const [e, sg] of [[a, 1], [b, -1]]) for (let k = 0; k < 12 && onPath(e.x, e.z); k++) { e.x += ux * sg * .3; e.z += uz * sg * .3; }
      if (segAvoid(a, b)) continue;
      const len = Math.hypot(b.x - a.x, b.z - a.z), cnt = Math.max(3, Math.floor(len / .9));
      const pts = [];
      for (let i = 0; i <= cnt; i++) { const t = i / cnt, sag = Math.sin(t * Math.PI) * .45; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, yS - sag, a.z + (b.z - a.z) * t)); }
      strings.push(pts);
      for (let i = 1; i < cnt; i++) lanterns.push({ x: pts[i].x, y: pts[i].y - .22, z: pts[i].z, c: LANT[(i + k) % LANT.length] });
      // 兩端的竹竿
      for (const e of [a, b]) { const g = W.ground(e.x, e.z); if (g == null) continue; const p = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, yS - g + .1, 6), new THREE.MeshStandardMaterial({ color: '#9a7a4a', roughness: .8 })); p.position.set(e.x, (yS + g) / 2, e.z); p.castShadow = !low; root.add(p); }
    }
  }
  // 繩子
  { const pos = []; for (const pts of strings) for (let i = 0; i < pts.length - 1; i++) pos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#3a2a1a' }))); }
  // 燈籠：圓胖的燈籠身＋上下的金色蓋子（燈籠身會發光）
  const lantM = glowVC(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0, roughness: .6 })); glowMats.push({ m: lantM, max: 1.6 });
  const lantGeo = new THREE.SphereGeometry(.15, 10, 8); lantGeo.scale(1, 1.15, 1);
  const lant = new THREE.InstancedMesh(lantGeo, lantM, lanterns.length);
  const capM = new THREE.MeshStandardMaterial({ color: '#d9a52a', roughness: .4, metalness: .4 });
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .09, .05, 8), capM, lanterns.length * 2);
  const M4 = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  lanterns.forEach((l, i) => {
    lant.setMatrixAt(i, M4.compose(V.set(l.x, l.y, l.z), Q, ONE)); lant.setColorAt(i, col.set(l.c));
    caps.setMatrixAt(i * 2, M4.compose(V.set(l.x, l.y + .17, l.z), Q, ONE)); caps.setMatrixAt(i * 2 + 1, M4.compose(V.set(l.x, l.y - .17, l.z), Q, ONE));
  });
  root.add(lant, caps);

  // ---------------- 3. 每個攤位：攤子前面一盞暖黃燈泡＋地上一圈暖光
  const bulbs = [];
  for (const s of opts.signs || []) {
    const g = s.g, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion).setY(0).normalize(), sc = g.scale.x || 1;
    const bp = g.position.clone().addScaledVector(fwd, 1.05 * sc).setY(H + 2.25 * sc);
    bulbs.push(bp);
    pool(g.position.x + fwd.x * 1.1, g.position.z + fwd.z * 1.1, 2.4, '#ffd27a', .7, H + .045);
  }
  const bulbM = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd27a', emissiveIntensity: 0, roughness: .3 }); glowMats.push({ m: bulbM, max: 3 });
  const bulbI = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 10, 8), bulbM, bulbs.length);
  bulbs.forEach((p, i) => bulbI.setMatrixAt(i, M4.compose(p, Q, ONE))); root.add(bulbI);
  const wireI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.01, .01, .35, 4), new THREE.MeshStandardMaterial({ color: '#333' }), bulbs.length);
  bulbs.forEach((p, i) => wireI.setMatrixAt(i, M4.compose(V.copy(p).setY(p.y + .22), Q, ONE))); root.add(wireI);
  // 燈泡周圍的光暈（面向鏡頭的光點）
  const haloM = new THREE.SpriteMaterial({ map: glowTex, color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const halos = bulbs.map((p) => { const sp = new THREE.Sprite(haloM); sp.position.copy(p); sp.scale.set(.9, .9, 1); sp.visible = false; root.add(sp); return sp; });

  // ---------------- 4. 每座島邊緣一圈小燈（暖白、金色交錯）
  const edge = [];
  for (const I of isles) {
    const per = TAU * I.R, n = Math.floor(per / (low ? 1.3 : .85));
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, r = I.top(a) * .965, x = I.pos.x + Math.cos(a) * r, z = I.pos.z + Math.sin(a) * r;
      const g = W.ground(x, z); if (g == null) continue;
      edge.push({ x, y: g + .14, z, c: k % 2 ? '#fff1c4' : '#ffc24a' });
    }
  }
  const edgeM = glowVC(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0, roughness: .4 })); glowMats.push({ m: edgeM, max: 2.2 });
  const edgeI = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 8, 6), edgeM, edge.length);
  edge.forEach((e, i) => { edgeI.setMatrixAt(i, M4.compose(V.set(e.x, e.y, e.z), Q, ONE)); edgeI.setColorAt(i, col.set(e.c)); }); root.add(edgeI);

  // ---------------- 5. 路面照明：步道兩側一排地燈＋路面上一圈圈暖光（像路燈照在地上）
  const studs = [], roadPools = [], lampPools = [];
  const addRow = (x0, z0, x1, z1, side, step, poolStep) => {   // 一段直線：兩側地燈、中間光圈
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < .3) return; const ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = -uz, nz = ux;
    for (let d = step / 2; d < L; d += step) for (const sg of [-1, 1]) { const x = x0 + ux * d + nx * side * sg, z = z0 + uz * d + nz * side * sg; const g = W.ground(x, z); if (g != null) studs.push({ x, y: g + .02, z }); }
    for (let d = poolStep / 2; d < L; d += poolStep) { const x = x0 + ux * d, z = z0 + uz * d; const g = W.ground(x, z); if (g != null) roadPools.push({ x, y: g + .05, z, r: 1.7 }); }
  };
  const STEP = low ? 1.6 : 1.15, PSTEP = low ? 3.4 : 2.6;
  for (const I of isles) {
    const half = pathHalf(I), per = TAU * I.ring, n = Math.max(12, Math.round(per / STEP));
    for (let k = 0; k < n; k++) { const a = k / n * TAU; for (const r of [I.ring - half, I.ring + half]) { const x = I.pos.x + Math.cos(a) * r, z = I.pos.z + Math.sin(a) * r; const g = W.ground(x, z); if (g != null) studs.push({ x, y: g + .02, z }); } }
    const np = Math.max(6, Math.round(per / PSTEP)); for (let k = 0; k < np; k++) { const a = (k + .5) / np * TAU, x = I.pos.x + Math.cos(a) * I.ring, z = I.pos.z + Math.sin(a) * I.ring; const g = W.ground(x, z); if (g != null) roadPools.push({ x, y: g + .05, z, r: 1.8 }); }
    for (const a of corrOf(I)) { const r0 = I.ring + half, r1 = I.top(a) * .97; addRow(I.pos.x + Math.cos(a) * r0, I.pos.z + Math.sin(a) * r0, I.pos.x + Math.cos(a) * r1, I.pos.z + Math.sin(a) * r1, half, STEP, PSTEP); }
  }
  for (const s of opts.paths || []) addRow(s.a.x, s.a.z, s.b.x, s.b.z, s.w ?? .7, STEP, PSTEP);   // 棧道、碼頭
  // 路燈、燈柱底下：比較亮、比較大的一圈光
  for (const q of opts.lampSpots || []) { const g = W.ground(q.x, q.z); lampPools.push({ x: q.x, y: (g ?? H) + .06, z: q.z, r: q.r || 3 }); }
  const studM = glowVC(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0, roughness: .4 })); glowMats.push({ m: studM, max: 2.6 });
  const studI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .07, .04, 8), studM, studs.length);
  studs.forEach((q, i) => { studI.setMatrixAt(i, M4.compose(V.set(q.x, q.y, q.z), Q, ONE)); studI.setColorAt(i, col.set(i % 3 ? '#ffe2a0' : '#fff6dc')); }); root.add(studI);
  // 光圈：一個 InstancedMesh（平放的圓形漸層），透明度跟著天黑程度
  const QF = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), SC = new THREE.Vector3();
  const poolSet = (list, color, max) => {
    const m = new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), m, Math.max(1, list.length)); im.count = list.length; im.renderOrder = 2; im.visible = false;
    list.forEach((q, i) => im.setMatrixAt(i, M4.compose(V.set(q.x, q.y, q.z), QF, SC.set(q.r, q.r, 1)))); root.add(im);
    pools.push({ o: im, m, max });
  };
  poolSet(roadPools, '#ffd58a', low ? .5 : .42);
  poolSet(lampPools, '#ffcf7a', low ? .75 : .65);

  // ---------------- 每一格：跟著天黑程度亮起來；燈籠微微閃爍
  let lastN = -1;
  function update(n, t) {
    const on = n > .04;
    if (Math.abs(n - lastN) > .01) {
      lastN = n;
      for (const g of glowMats) g.m.emissiveIntensity = (g.min || 0) + g.max * n;
      for (const l of lights) l.intensity = n * 30;
      for (const p of pools) { p.o.visible = on; p.m.opacity = p.max * n; }
      for (const h of halos) h.visible = on;
      haloM.opacity = .75 * n;
    }
    if (on && t != null) lantM.emissiveIntensity = 1.6 * n * (.93 + .07 * Math.sin(t * 7.3));   // 燈籠裡的燭光微微跳動
  }
  return { root, update, counts: { studs: studs.length, roadPools: roadPools.length, lampPools: lampPools.length, lanterns: lanterns.length, stalls: bulbs.length, edge: edge.length, strings: strings.length } };
}
