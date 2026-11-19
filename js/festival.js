// 園遊會氣氛：氣球、拱門、彩旗、燈籠、踩高蹺、小丑、舞獅、吉祥物、熱氣球、風箏、煙火……
// 所有東西都放在橋上、天空、海面，或島上步道外側的空地（避開攤子），不擋步道
import * as THREE from 'three';
import { batchStatic } from './kit.js?v=20261119b';

const TAU = Math.PI * 2;
const M = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o })); };
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(.5, .5, 1, 10), sph: new THREE.SphereGeometry(.5, 12, 10),
  cone: new THREE.ConeGeometry(.5, 1, 10), torus: new THREE.TorusGeometry(.5, .12, 6, 16), tri: new THREE.ConeGeometry(.5, 1, 3),
};
const BAL = ['#ff4d6d', '#ffd23a', '#3fa7ff', '#5ed37a', '#b06bff', '#ff8a3d', '#ff7ac8', '#ffffff'];
const add = (parent, geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c, o) : c); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
const line = (parent, a, b, c = '#e8e8e8', w = .012) => { const d = b.clone().sub(a); const m = new THREE.Mesh(G.cyl, mat(c)); m.position.copy(a).add(b).multiplyScalar(.5); m.scale.set(w, d.length(), w); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(m); return m; };

// 可以刺破的氣球：每顆氣球的球體記錄自己屬於哪一組，點擊用的透明大球比氣球大一點（手機比較好點）
const HIT_GEO = new THREE.SphereGeometry(.5, 8, 6), HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
let BALLOONS = [];
function markBalloon(mesh, group, color) {
  const hit = new THREE.Mesh(HIT_GEO, HIT_MAT); hit.position.copy(mesh.position); hit.scale.copy(mesh.scale).multiplyScalar(1.6); mesh.parent.add(hit);
  hit.userData.balloon = { group, color }; BALLOONS.push(hit);
}
// 一顆氣球（橢圓球＋小結）
// 鯉魚 Logo 貼片（旗子用）
const LOGO_GEO = new THREE.PlaneGeometry(1, 1); let LOGO_M = null;
function logoMat() { if (!LOGO_M) { const tx = new THREE.TextureLoader().load('assets/brand/koi-logo.png?v=20261119b'); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; LOGO_M = new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .4, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }); } return LOGO_M; }
function balloon(parent, c, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const b = add(g, G.sph, mat(c, { roughness: .35, metalness: .05 }), 0, 0, 0, .34 * s, .42 * s, .34 * s);
  add(g, G.cone, c, 0, -.22 * s, 0, .07 * s, .07 * s, .07 * s, Math.PI);
  markBalloon(b, g, c);
  return g;
}

export function createFestival(W, content, H, opts = {}) {
  const { scene, islands, bridges } = W;
  const low = !!opts.low, makePerson = opts.makePerson, rng = opts.rng;
  const R = rng ? rng(2026) : Math.random;
  const root = new THREE.Group(); scene.add(root);
  // 不會動的裝飾先放進 stat，最後合併成少數幾個網格（手機減輕負擔）；statics 是整組都不會動的小群組
  const stat = new THREE.Group(); root.add(stat); const statics = [];
  BALLOONS = [];
  const anim = [];          // 每格要更新的東西
  const nightGlow = [];     // 晚上會亮的材質
  const kinds = new Set();  // 記錄放了幾種裝飾

  // ------------------------------------------------ 找空地：步道外側、離攤子和橋夠遠
  const taken = (opts.avoid || []).map((p) => ({ x: p.x, z: p.z, r: 2.0 }));   // 攤子和樹的周圍留空，不擋招牌
  function freeSpot(id, need = .6, rad = .8) {
    const I = islands[id]; if (!I || !I.walk) return null;
    const bAngs = I.bridgeAngles || [];
    for (let tries = 0; tries < 500; tries++) {
      const th = R() * TAU;
      if (bAngs.some((b) => Math.abs(Math.atan2(Math.sin(th - b), Math.cos(th - b))) < .5)) continue;
      const r = Math.min(I.walk.radAt(th) + .8 + R() * .7, I.top(th) * .88);
      const x = I.pos.x + Math.cos(th) * r, z = I.pos.z + Math.sin(th) * r;
      if (I.walk.clear(x - I.pos.x, z - I.pos.z) < need) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + rad)) continue;
      taken.push({ x, z, r: rad });
      return { x, z, th, face: Math.atan2(-Math.cos(th), -Math.sin(th)) };
    }
    return null;
  }
  const IDS = ['center', 'food', 'craft', 'puzzle', 'sport', 'recycle'];
  // 在幾座島裡依序找空地，空間不夠就放寬一點
  function spotAny(ids, need, rad) {
    for (const n of [need, need * .8, need * .6, .3, .22]) for (const id of [...ids, ...IDS]) { const s = freeSpot(id, n, rad); if (s) return s; }
    return null;
  }
  const bridgeY = (t) => H + Math.sin(t * Math.PI) * .9;
  const onBridge = (b, t, side) => { const dx = Math.cos(b.a), dz = Math.sin(b.a); return new THREE.Vector3(b.p0.x + (b.p1.x - b.p0.x) * t - dz * side, bridgeY(t), b.p0.z + (b.p1.z - b.p0.z) * t + dx * side); };

  // ① 橋上三角彩旗：兩側欄杆上方各拉一條
  for (const b of bridges) for (const side of [-.85, .85]) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t0 = (i + .5) / n, p = onBridge(b, t0, side); p.y += 1.15 + Math.sin(i * 1.3) * .03;
      const f = add(stat, G.tri, BAL[i % 6], p.x, p.y - .12, p.z, .16, .24, .03, Math.PI, 0, 0); f.rotation.y = -b.a + Math.PI / 2;
    }
    const a = onBridge(b, .02, side), c = onBridge(b, .98, side); a.y += 1.18; c.y += 1.18;
    for (let i = 0; i < 6; i++) line(stat, onBridge(b, i / 6, side).add(new THREE.Vector3(0, 1.18, 0)), onBridge(b, (i + 1) / 6, side).add(new THREE.Vector3(0, 1.18, 0)), '#8a5a2e', .01);
  }
  kinds.add('橋上三角彩旗');

  // ② 橋上燈籠串：每座橋用自己那座島的顏色；晚上會亮。走過橋時從腳下往前依序亮起（跨橋迎賓）
  const bridgeLights = [];
  for (const b of bridges) {
    const I0 = (content.islands || []).find((x) => x.id === b.to) || {};
    const items = [];
    for (let i = 1; i < 6; i++) {
      const p = onBridge(b, i / 6, 0); p.y += 1.55;
      const m = new THREE.MeshStandardMaterial({ color: I0.color || '#ff5a3c', emissive: I0.color || '#ff6a2a', emissiveIntensity: 0, roughness: .6 });
      add(root, G.sph, m, p.x, p.y, p.z, .26, .32, .26); add(stat, G.cyl, '#2a2a2a', p.x, p.y + .17, p.z, .14, .04, .14); add(stat, G.cyl, '#ffd23a', p.x, p.y - .2, p.z, .04, .1, .04);
      items.push({ m, t: i / 6, lit: 0 });
    }
    bridgeLights.push({ b, items, name: I0.name, order: I0.order });
  }
  kinds.add('橋上燈籠串');

  // ③ 氣球拱門：每座橋靠小島那一端
  for (const b of bridges) {
    const g = new THREE.Group(); const e = onBridge(b, .94, 0); g.position.set(e.x, H - .05, e.z); g.rotation.y = -b.a + Math.PI / 2; root.add(g);
    const n = low ? 14 : 22;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI; const bg = new THREE.Group(); bg.position.set(Math.cos(a) * 1.15, Math.sin(a) * 2.0 + .1, 0); g.add(bg); const m = add(bg, G.sph, mat(BAL[i % 6], { roughness: .35 }), 0, 0, 0, .34, .34, .34); markBalloon(m, bg, BAL[i % 6]); }
    kinds.add('氣球拱門');
  }

  // ④ 羽毛旗：每座橋靠中央島那一端兩側
  for (const b of bridges) for (const side of [-1.25, 1.25]) {
    const p = onBridge(b, .03, side); const g = new THREE.Group(); g.position.set(p.x, H, p.z); g.rotation.y = -b.a; root.add(g);
    add(g, G.cyl, '#dddddd', 0, 1.0, 0, .04, 2.0, .04);
    const f = add(g, G.box, BAL[(b.a * 10 | 0) % 6 + 0] || '#ff4d6d', .22, 1.3, 0, .42, 1.2, .02); f.material = mat(['#ff4d6d', '#3fa7ff', '#5ed37a', '#ffd23a', '#b06bff'][bridges.indexOf(b)]);
    add(g, G.box, '#ffffff', .22, 1.3, .015, .08, .9, .01);
    const LG = new THREE.Group(); LG.position.set(.22, 1.3, 0); g.add(LG);   // 旗面兩邊都有鯉魚 Logo（跟著旗子擺）
    for (const sd of [1, -1]) { const L = new THREE.Mesh(LOGO_GEO, logoMat()); L.position.set(0, .3, sd * .026); L.scale.setScalar(.34); if (sd < 0) L.rotation.y = Math.PI; LG.add(L); }
    anim.push((t) => { f.rotation.y = LG.rotation.y = Math.sin(t * 2 + side) * .25; });
  }
  kinds.add('羽毛旗');

  // ⑤ 氣球束：每座島 2 束，綁在地上的小木樁，會輕輕搖
  for (const id of IDS) for (let k = 0; k < (low ? 1 : 2); k++) {
    const s = freeSpot(id, .45, .5); if (!s) continue;
    const g = new THREE.Group(); g.position.set(s.x, H, s.z); root.add(g);
    add(g, G.cyl, '#7a4a22', 0, .2, 0, .06, .4, .06);
    const top = new THREE.Group(); top.position.y = .4; g.add(top);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, bx = Math.cos(a) * .32, bz = Math.sin(a) * .32, by = 1.7 + (i % 3) * .2; const bg = balloon(top, BAL[(i + k) % BAL.length], bx, by, bz); line(bg, new THREE.Vector3(-bx, -by, -bz), new THREE.Vector3(0, -.3, 0)); /* 線綁在氣球上：破掉時一起消失 */ }
    const ph = R() * 6; anim.push((t) => { top.rotation.z = Math.sin(t * .9 + ph) * .05; top.rotation.x = Math.cos(t * .7 + ph) * .05; });
  }
  kinds.add('氣球束');

  // ⑥ 飄上天的氣球：從各島慢慢升空，飛遠了再從別的島重新出發
  const floaters = [];
  for (let i = 0; i < (low ? 6 : 14); i++) {
    const g = balloon(root, BAL[i % BAL.length], 0, 0, 0, 1.1); line(g, new THREE.Vector3(0, -.25, 0), new THREE.Vector3(0, -.9, 0));
    const f = { g, t: R() * 30 }; floaters.push(f);
    const reset = () => { const I = islands[IDS[(R() * IDS.length) | 0]]; const a = R() * TAU, r = R() * 4; f.x = I.pos.x + Math.cos(a) * r; f.z = I.pos.z + Math.sin(a) * r; f.t = 0; f.sp = .5 + R() * .4; f.dx = (R() - .5) * .4; f.dz = (R() - .5) * .4; };
    reset(); f.t = R() * 30; f.reset = reset;
  }
  anim.push((t, dt) => { for (const f of floaters) { f.t += dt; const y = H + 1 + f.t * f.sp; f.g.position.set(f.x + f.dx * f.t + Math.sin(f.t + f.x) * .3, y, f.z + f.dz * f.t); if (y > 30) f.reset(); } });
  kinds.add('飄上天的氣球');

  // ⑦ 熱氣球：天空慢慢繞圈
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); root.add(g);
    const cols = [['#ff4d6d', '#ffd23a'], ['#3fa7ff', '#ffffff'], ['#5ed37a', '#ff8a3d']][i];
    for (let k = 0; k < 8; k++) { const seg = add(g, G.sph, cols[k % 2], 0, 0, 0, 2.6, 3.0, 2.6); seg.geometry = new THREE.SphereGeometry(.5, 12, 10, k / 8 * TAU, TAU / 8); }
    add(g, G.cone, cols[0], 0, -1.75, 0, 1.1, .8, 1.1, Math.PI);
    add(g, G.box, '#8b5a2b', 0, -2.7, 0, .7, .5, .7);
    for (const [x, z] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) line(g, new THREE.Vector3(x, -2.45, z), new THREE.Vector3(x * 2, -1.9, z * 2), '#5a3a1a', .02);
    const rad = 34 + i * 7, h = 16 + i * 3, ph = i * 2.1, sp = .018 + i * .004;
    anim.push((t) => { const a = ph + t * sp; g.position.set(Math.cos(a) * rad, h + Math.sin(t * .3 + i) * .8, Math.sin(a) * rad); });
  }
  kinds.add('熱氣球');

  // ⑧ 風箏：和服務台的三尾鯉魚旗吹同一陣風——都飄向同一邊（鯉魚旗的方向），線拉回中央島
  // 鯉魚旗在世界座標的方向：rotation.y = -0.9 ± 0.25 擺動，旗尾指向 (cos θ, -sin θ)
  const windAt = (t, i) => { const th = -.9 + Math.sin(t * .9 + i) * .25 * .7; return new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)); };
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); root.add(g);
    const k = add(g, G.box, ['#ff4d6d', '#3fa7ff', '#ffd23a'][i], 0, 0, 0, 1.0, 1.0, .03, 0, 0, Math.PI / 4);
    const tail = []; for (let j = 0; j < 5; j++) tail.push(add(g, G.tri, BAL[(j + i) % 6], 0, -.8 - j * .3, 0, .14, .2, .02, Math.PI));
    // 放風箏的地方：中央島上三個點，排成一列（垂直於風向），風箏一起往下風處飄
    const side = new THREE.Vector3(-.78, 0, .62);   // 和風向垂直
    const anchor = new THREE.Vector3(1.5, H + .5, 1.0).addScaledVector(side, (i - 1) * 2.6);
    const str = new THREE.Mesh(G.cyl, mat('#f0f0f0')); root.add(str);
    const dist = 16 + i * 4, height = 11 + i * 2.5;
    anim.push((t) => {
      const w = windAt(t, i);
      g.position.copy(anchor).addScaledVector(w, dist).addScaledVector(side, Math.sin(t * .6 + i) * .8); g.position.y = height + Math.sin(t * .9 + i * 2) * .7;
      g.lookAt(anchor); k.rotation.z = Math.PI / 4 + Math.sin(t * 1.3 + i) * .12;
      tail.forEach((q, j) => { q.position.x = Math.sin(t * 3 + j * .8 + i) * .08 * j; });
      const d = g.position.clone().sub(anchor); str.position.copy(anchor).add(g.position).multiplyScalar(.5); str.scale.set(.012, d.length(), .012); str.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    });
  }
  kinds.add('風箏');

  // ⑨ 大黃色小鴨：浮在海上
  {
    const g = new THREE.Group(); g.position.set(-26, 0, 18); g.rotation.y = 1.2; root.add(g);
    add(g, G.sph, '#ffd23a', 0, .9, 0, 3.2, 2.2, 4.2); add(g, G.sph, '#ffd23a', 0, 2.6, 1.3, 2.0, 2.0, 2.0);
    add(g, G.box, '#ff8a2a', 0, 2.4, 2.4, .9, .35, .9); for (const s of [-1, 1]) add(g, G.sph, '#1a1a1a', s * .5, 2.9, 2.15, .22, .26, .14);
    add(g, G.cone, '#ffd23a', 0, 1.5, -2.0, 1.2, 1.2, .9, -1.1);
    anim.push((t) => { g.position.y = Math.sin(t * .8) * .12; g.rotation.z = Math.sin(t * .6) * .04; });
    kinds.add('大黃色小鴨');
  }

  // ⑩ 小風車玩具：插在島上空地，會轉
  for (const id of IDS) for (let k = 0; k < (low ? 1 : 3); k++) {
    const s = freeSpot(id, .35, .3); if (!s) continue;
    const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = s.face; root.add(g);
    add(g, G.cyl, '#ffffff', 0, .4, 0, .03, .8, .03);
    const w = new THREE.Group(); w.position.set(0, .82, .05); g.add(w);
    for (let i = 0; i < 4; i++) { const p = add(w, G.tri, BAL[(i + k) % 6], 0, 0, 0, .14, .32, .02, 0, 0, i * Math.PI / 2); p.position.set(Math.sin(i * Math.PI / 2) * -.14, Math.cos(i * Math.PI / 2) * .14, 0); }
    const sp = 2 + R() * 2; anim.push((t) => { w.rotation.z = t * sp; });
  }
  kinds.add('彩色小風車');

  // ⑪ 遮陽傘休息桌
  for (const id of IDS) {
    const s = freeSpot(id, .75, 1.0); if (!s) continue;
    const g = new THREE.Group(); g.position.set(s.x, H, s.z); root.add(g); statics.push(g);
    add(g, G.cyl, '#ffffff', 0, .4, 0, .7, .05, .7); add(g, G.cyl, '#cccccc', 0, .2, 0, .06, .4, .06);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; add(g, G.cyl, BAL[i + 1], Math.cos(a) * .55, .22, Math.sin(a) * .55, .26, .04, .26); add(g, G.cyl, '#cccccc', Math.cos(a) * .55, .1, Math.sin(a) * .55, .04, .2, .04); }
    add(g, G.cyl, '#eeeeee', 0, .9, 0, .03, 1.1, .03);
    for (let i = 0; i < 8; i++) { const p = add(g, G.cone, i % 2 ? '#ffffff' : '#ff4d6d', 0, 1.5, 0, 1.3, .4, 1.3); p.geometry = new THREE.ConeGeometry(.5, 1, 8, 1, false, i / 8 * TAU, TAU / 8); }
  }
  kinds.add('遮陽傘休息桌');

  // ⑫ 分類垃圾桶（一般、回收、廚餘）
  for (const id of IDS) {
    const s = freeSpot(id, .5, .6); if (!s) continue;
    const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = s.face; root.add(g); statics.push(g);
    ['#5a5f66', '#2f7fd1', '#3e9b4f'].forEach((c, i) => { add(g, G.box, c, (i - 1) * .3, .3, 0, .26, .6, .26); add(g, G.box, '#ffffff', (i - 1) * .3, .45, .135, .14, .08, .01); });
  }
  kinds.add('分類垃圾桶');

  // ⑬ 拍照框立牌（中央島）
  {
    const s = spotAny(['center', 'food', 'recycle'], .7, 1.0);
    if (s) {
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = s.face; root.add(g); statics.push(g);
      const frameC = '#e8762b';
      add(g, G.box, frameC, -.75, .9, 0, .14, 1.8, .1); add(g, G.box, frameC, .75, .9, 0, .14, 1.8, .1); add(g, G.box, frameC, 0, 1.8, 0, 1.64, .26, .1); add(g, G.box, frameC, 0, .05, 0, 1.64, .1, .1);
      for (let i = 0; i < 7; i++) add(g, G.sph, BAL[i % 6], -.75 + i * .25, 2.0, 0, .2, .2, .2);
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const paint = () => { const c = cv.getContext('2d'); c.fillStyle = '#e8762b'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#fff'; c.font = '900 56px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('115 鯉魚市集', 256, 52); tex.needsUpdate = true; };
      paint(); if (document.fonts) document.fonts.ready.then(paint);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .26), new THREE.MeshStandardMaterial({ map: tex })); lbl.position.set(0, 1.8, .06); g.add(lbl);
      const lbl2 = lbl.clone(); lbl2.position.z = -.06; lbl2.rotation.y = Math.PI; g.add(lbl2);
      kinds.add('拍照框立牌');
    }
  }

  // ⑭ 棉花糖車（中央島）
  {
    const s = spotAny(['center', 'food', 'sport'], .7, 1.0);
    if (s) {
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = s.face; root.add(g); statics.push(g);
      add(g, G.box, '#ff9ed2', 0, .45, 0, 1.0, .5, .55); for (const x of [-.35, .35]) add(g, G.cyl, '#2a2a2a', x, .16, .3, .3, .06, .3, Math.PI / 2);
      add(g, G.cyl, '#dff3ff', 0, .85, 0, .5, .3, .5);
      for (let i = 0; i < 3; i++) { add(g, G.cyl, '#ffffff', -.3 + i * .3, 1.05, -.2, .02, .4, .02); add(g, G.sph, ['#ffb3d9', '#b3e0ff', '#fff0b3'][i], -.3 + i * .3, 1.32, -.2, .3, .26, .3); }
      for (let i = 0; i < 5; i++) add(g, G.cone, i % 2 ? '#ffffff' : '#ff4d9a', -.4 + i * .2, 1.75, 0, .2, .18, .4, Math.PI);
      for (const x of [-.48, .48]) add(g, G.cyl, '#ffffff', x, 1.25, 0, .03, 1.0, .03);
      add(g, G.box, '#ffffff', 0, 1.82, 0, 1.06, .04, .6);
      kinds.add('棉花糖車');
    }
  }

  // ⑮ 泡泡機：吹出一串串透明泡泡往上飄
  {
    const s = spotAny(['center', 'craft', 'puzzle'], .5, .6);
    if (s) {
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); root.add(g);
      add(g, G.box, '#3fa7ff', 0, .2, 0, .4, .4, .4); add(g, G.cyl, '#ffd23a', 0, .45, .15, .14, .14, .14, Math.PI / 2);
      const bubMat = new THREE.MeshStandardMaterial({ color: '#e8f8ff', transparent: true, opacity: .35, roughness: .05, metalness: .3 });
      const bubs = []; for (let i = 0; i < (low ? 8 : 18); i++) { const m = new THREE.Mesh(G.sph, bubMat); m.castShadow = false; g.add(m); bubs.push({ m, t: i * .4, s: .1 + R() * .14, dx: (R() - .5) * .6, dz: .3 + R() * .5 }); }
      anim.push((t, dt) => { for (const b of bubs) { b.t = (b.t + dt) % 7; const k = b.t; b.m.position.set(b.dx * k + Math.sin(k * 2 + b.s * 40) * .15, .5 + k * .45, b.dz * k); b.m.scale.setScalar(b.s * (k < .2 ? k * 5 : 1)); } });
      kinds.add('泡泡機');
    }
  }

  // ⑯ 夜晚煙火：天黑後在海面上空綻放
  const fw = []; const fwGeo = new THREE.SphereGeometry(.12, 6, 4);
  for (let i = 0; i < (low ? 2 : 4); i++) {
    const g = new THREE.Group(); g.visible = false; root.add(g); const parts = [];
    const m = new THREE.MeshBasicMaterial({ color: BAL[i % 6], transparent: true, opacity: 1 });
    for (let k = 0; k < 28; k++) { const p = new THREE.Mesh(fwGeo, m); const v = new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize().multiplyScalar(3 + R() * 1.5); g.add(p); parts.push({ p, v }); }
    fw.push({ g, parts, m, t: i * 1.7 });
  }
  let night = 0;
  anim.push((t, dt) => {
    for (const f of fw) {
      if (night < .5) { f.g.visible = false; continue; }
      f.t += dt; const k = f.t % 4.2;
      if (k < dt * 1.5) { const a = R() * TAU, r = 26 + R() * 12; f.g.position.set(Math.cos(a) * r, 18 + R() * 8, Math.sin(a) * r); f.m.color.set(BAL[(R() * 6) | 0]); }
      f.g.visible = k < 2.2; const e = Math.min(1, k / 1.2);
      for (const q of f.parts) q.p.position.copy(q.v).multiplyScalar(e * (1 - (1 - e) * (1 - e)) * 1.0).add(new THREE.Vector3(0, -k * k * .25, 0));
      f.m.opacity = Math.max(0, 1 - k / 2.2);
    }
  });
  kinds.add('夜晚煙火');

  // ------------------------------------------------ 會走動的表演者（沿各島步道外圈走）
  const walkers = [];
  function ringWalker(id, build, speed, dir = 1) {
    const I = islands[id]; if (!I || !I.walk) return;
    const g = new THREE.Group(); root.add(g); const parts = build(g);
    const w = { I, g, ang: R() * TAU, speed, dir, parts }; walkers.push(w); return w;
  }
  function person(g, shirt, y0 = 0) {
    if (!makePerson) return null;
    const P = makePerson(rng ? rng(4000 + walkers.length) : Math.random, false, { shirt }); P.g.remove(P.hit); P.g.position.y = y0; g.add(P.g); return P;
  }

  // ⑰ 踩高蹺的人：穿長條紋褲，比大家高一截
  const stiltIds = low ? ['center'] : ['center', 'food', 'sport'];
  stiltIds.forEach((id, i) => ringWalker(id, (g) => {
    const P = person(g, ['#ff4d6d', '#3fa7ff', '#5ed37a'][i], .95);
    const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * .07, 1.25, 0); g.add(p); for (let k = 0; k < 6; k++) add(p, G.cyl, k % 2 ? '#ffffff' : ['#ff4d6d', '#3fa7ff', '#5ed37a'][i], 0, -.1 - k * .2, 0, .09, .2, .09); add(p, G.cyl, '#7a4a22', 0, -1.25, 0, .05, .1, .05); return p; });
    if (P) { P.legs.forEach((l) => (l.visible = false)); add(P.head, G.cone, '#ffd23a', 0, .45, 0, .3, .45, .3); add(P.head, G.sph, '#ff4d6d', 0, .7, 0, .1, .1, .1); }
    return { P, legs, stilt: true };
  }, .35, i % 2 ? 1 : -1));
  kinds.add('踩高蹺的人');

  // ⑱ 賣氣球的人：手上一大把氣球
  ringWalker(low ? 'center' : 'craft', (g) => {
    const P = person(g, '#ffd23a');
    const bunch = new THREE.Group(); bunch.position.set(.25, .6, .1); g.add(bunch);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, x = Math.cos(a) * .35, z = Math.sin(a) * .35, y = 1.5 + (i % 3) * .25; const bg = balloon(bunch, BAL[i % BAL.length], x, y, z, .9); line(bg, new THREE.Vector3(-x, -y, -z), new THREE.Vector3(0, -.3, 0)); }
    if (P) P.arms[1].rotation.z = 2.6;
    return { P, bunch };
  }, .45, 1);
  kinds.add('賣氣球的人');

  // ⑲ 鯉魚吉祥物：大大的橘白鯉魚布偶裝
  ringWalker('center', (g) => {
    const body = new THREE.Group(); g.add(body);
    add(body, G.sph, '#ff8a3d', 0, 1.1, 0, .9, 1.3, .8); add(body, G.sph, '#ffffff', 0, 1.0, .25, .6, .8, .4);
    for (const s of [-1, 1]) { add(body, G.sph, '#ffffff', s * .22, 1.45, .3, .22, .22, .12); add(body, G.sph, '#1a1a1a', s * .22, 1.45, .36, .1, .1, .06); add(body, G.sph, '#ff8a3d', s * .5, 1.0, 0, .2, .4, .2, 0, 0, s * .6); }
    add(body, G.torus, '#ff4d6d', 0, 1.2, .38, .16, .16, .16, 0, 0, 0);
    add(body, G.cone, '#ff8a3d', 0, 1.0, -.55, .5, .5, .2, -1.4); add(body, G.cone, '#ff8a3d', 0, 1.9, -.05, .3, .3, .15, -.3);
    const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * .18, .45, 0); g.add(p); add(p, G.cyl, '#ff8a3d', 0, -.2, 0, .18, .45, .18); return p; });
    return { body, legs };
  }, .3, -1);
  kinds.add('鯉魚吉祥物');

  // ⑳ 舞獅：獅頭＋身體，兩個人在下面走
  ringWalker(low ? 'center' : 'recycle', (g) => {
    const head = new THREE.Group(); head.position.set(0, .95, .45); g.add(head);
    add(head, G.box, '#dc2f2f', 0, 0, 0, .7, .6, .6); add(head, G.box, '#ffd23a', 0, .32, .1, .74, .1, .5);
    for (const s of [-1, 1]) { add(head, G.sph, '#ffffff', s * .18, .12, .3, .16, .16, .1); add(head, G.sph, '#1a1a1a', s * .18, .12, .35, .07, .07, .05); }
    add(head, G.box, '#ffffff', 0, -.18, .31, .4, .08, .02); add(head, G.sph, '#ffd23a', 0, .45, 0, .2, .2, .2);
    const back = add(g, G.box, '#dc2f2f', 0, .85, -.35, .62, .4, 1.0); add(g, G.box, '#ffd23a', 0, 1.06, -.35, .64, .04, 1.0);
    const legs = []; for (const z of [.35, -.6]) for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * .14, .5, z); g.add(p); add(p, G.cyl, '#f2f2f2', 0, -.22, 0, .12, .45, .12); legs.push(p); }
    return { head, legs, lion: true };
  }, .4, 1);
  kinds.add('舞獅');

  // ㉑ 小丑拋球：站在中央島空地，三顆球輪流拋
  {
    const s = spotAny(['center', 'sport', 'craft'], .6, .8);
    if (s && makePerson) {
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = s.face; root.add(g);
      const P = person(g, '#b06bff');
      if (P) { add(P.head, G.sph, '#ff2a2a', 0, -.02, .25, .1, .1, .1); add(P.head, G.cone, '#5ed37a', 0, .42, 0, .3, .4, .3); add(P.head, G.sph, '#ffd23a', 0, .65, 0, .1, .1, .1); P.arms[0].rotation.x = -1.2; P.arms[1].rotation.x = -1.2; }
      const balls = [0, 1, 2].map((i) => add(g, G.sph, ['#ff4d6d', '#ffd23a', '#3fa7ff'][i], 0, 0, 0, .14, .14, .14));
      anim.push((t) => { balls.forEach((b, i) => { const k = (t * 1.4 + i / 3) % 1, x = Math.cos(k * Math.PI) * .22; b.position.set(x, .8 + Math.sin(k * Math.PI) * .7, .35); }); });
      kinds.add('小丑拋球');
    }
  }

  // ㉒ 打鼓表演：鼓手站在大鼓後面敲
  {
    const s = spotAny(['center', 'food', 'recycle'], .6, .8);
    if (s && makePerson) {
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = s.face; root.add(g);
      const P = person(g, '#dc4848'); if (P) P.g.position.z = -.35;
      add(g, G.cyl, '#c0392b', 0, .45, .15, .7, .5, .7, Math.PI / 2); add(g, G.cyl, '#f5e6c8', 0, .45, .41, .66, .02, .66, Math.PI / 2); add(g, G.box, '#7a4a22', 0, .15, .15, .5, .3, .2);
      const sticks = [-1, 1].map((sd) => add(g, G.cyl, '#8b5a2b', sd * .15, .75, .2, .03, .4, .03));
      anim.push((t) => { sticks.forEach((st, i) => { st.rotation.x = -.6 - Math.max(0, Math.sin(t * 8 + i * Math.PI)) * .8; }); if (P) { P.arms[0].rotation.x = -.9 - Math.max(0, Math.sin(t * 8)) * .6; P.arms[1].rotation.x = -.9 - Math.max(0, Math.sin(t * 8 + Math.PI)) * .6; } });
      kinds.add('打鼓表演');
    }
  }

  // ㉓ 彩色燈泡串：中央島的燈柱之間拉一圈，晚上會亮
  {
    const I = islands.center, n = 28, rr = I.walk.radAt(0) + .3;
    const bulbMats = BAL.slice(0, 6).map((c) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0 }); nightGlow.push(m); return m; });
    for (let i = 0; i < n; i++) { const a = i / n * TAU, r = I.walk.radAt(a) + .3; const sag = Math.abs(Math.sin(i / 4 * Math.PI)) * .25; add(root, G.sph, bulbMats[i % 6], I.pos.x + Math.cos(a) * r, H + 2.5 - sag, I.pos.z + Math.sin(a) * r, .12, .16, .12); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = I.walk.radAt(a) + .3; add(root, G.cyl, '#5a3a1a', I.pos.x + Math.cos(a) * r, H + 1.3, I.pos.z + Math.sin(a) * r, .05, 2.6, .05); }
    kinds.add('彩色燈泡串');
  }

  // ------------------------------------------------ 每格更新
  function update(t, dt, moving, nightK) {
    night = nightK || 0;
    for (const m of nightGlow) m.emissiveIntensity = night * 1.4;
    for (const bl of bridgeLights) for (const it of bl.items) { it.lit = Math.max(0, it.lit - dt * .35); it.m.emissiveIntensity = Math.max(night * 1.4, it.lit * 1.6); }
    if (!moving) return;
    for (const f of anim) f(t, dt);
    for (const w of walkers) {
      const I = w.I; w.ang += w.dir * dt * w.speed / Math.max(1, I.walk.radAt(w.ang));
      const r = I.walk.radAt(w.ang) + .05, x = I.pos.x + Math.cos(w.ang) * r, z = I.pos.z + Math.sin(w.ang) * r;
      w.g.position.set(x, H, z);
      w.g.rotation.y = Math.atan2(-Math.sin(w.ang) * w.dir, Math.cos(w.ang) * w.dir);
      const s = Math.sin(t * 6 + w.ang * 3), p = w.parts || {};
      if (p.legs) p.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? -s : s) * (p.stilt ? .25 : .5); });
      if (p.P && !p.stilt) { p.P.legs[0].rotation.x = s * .5; p.P.legs[1].rotation.x = -s * .5; }
      if (p.P && p.stilt) { p.P.arms[0].rotation.z = -.4 - Math.sin(t * 3) * .3; p.P.arms[1].rotation.z = .4 + Math.sin(t * 3) * .3; }
      if (p.body) p.body.rotation.z = Math.sin(t * 6) * .06;
      if (p.head) { p.head.rotation.y = Math.sin(t * 2.2) * .4; p.head.position.y = .95 + Math.abs(Math.sin(t * 4)) * .12; }
      if (p.bunch) p.bunch.rotation.z = Math.sin(t * 1.4) * .06;
    }
  }
  // ㉔ 橋頭路牌：服務台這一端的每座橋頭，立一支「島號＋島名＋箭頭」的路牌（島色），漫遊時看得出橋通往哪一島
  for (const b of bridges) {
    const I0 = (content.islands || []).find((x) => x.id === b.to); if (!I0) continue;
    const dir = new THREE.Vector3(Math.cos(b.a), 0, Math.sin(b.a)), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const pos = b.p0.clone().addScaledVector(dir, -.9).addScaledVector(side, 1.35);
    const g = new THREE.Group(); g.position.set(pos.x, H, pos.z); root.add(g); statics.push(g);
    add(g, G.cyl, '#7a4a22', 0, .8, 0, .08, 1.6, .08);
    // 正面箭頭在右、背面箭頭在左：從兩邊看，箭頭都指向橋
    const makeTex = (rev) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const paint = () => { const c = cv.getContext('2d'); c.clearRect(0, 0, 512, 160); c.save(); if (rev) { c.translate(512, 0); c.scale(-1, 1); }
        c.fillStyle = I0.dark || I0.color; c.beginPath(); c.moveTo(8, 12); c.lineTo(430, 12); c.lineTo(504, 80); c.lineTo(430, 148); c.lineTo(8, 148); c.closePath(); c.fill(); c.restore();
        const cx = rev ? 442 : 70, tx = rev ? 384 : 128;
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, 80, 46, 0, TAU); c.fill(); c.fillStyle = I0.dark || I0.color; c.font = '900 60px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(I0.order), cx, 84);
        c.fillStyle = '#ffffff'; c.textAlign = rev ? 'right' : 'left'; let s = 58; c.font = `900 ${s}px "Noto Sans TC", sans-serif`; while (c.measureText(I0.name).width > 300 && s > 30) { s -= 2; c.font = `900 ${s}px "Noto Sans TC", sans-serif`; } c.fillText(I0.name, tx, 84);
        c.textAlign = 'center'; c.font = '900 50px sans-serif'; c.fillText(rev ? '⬅' : '➜', rev ? 40 : 470, 82); tex.needsUpdate = true; };
      paint(); if (document.fonts) document.fonts.ready.then(paint);
      return tex;
    };
    const bw = 1.6, bh = bw * 160 / 512;
    const brd = new THREE.Group(); brd.position.y = 1.45; brd.rotation.y = -b.a + .7; g.add(brd);   // 斜 40° 面向走過來的人，箭頭仍指向橋
    for (const [z, rev] of [[.03, false], [-.03, true]]) {
      const tex = makeTex(rev);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: .4, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .25 }));
      m.position.set(bw / 2 - .1, 0, z); if (rev) m.rotation.y = Math.PI;
      brd.add(m);
    }
  }
  kinds.add('橋頭路牌');

  // ㉕ 鯉魚號碼頭的低亮度燈：棧道入口、棧道盡頭、船尾兩側（晚上亮，看得出可以走的地方）
  if (W.pier) {
    const P = W.pier, lampMat = new THREE.MeshStandardMaterial({ color: '#fff2c4', emissive: '#ffd27a', emissiveIntensity: 0 }); nightGlow.push(lampMat);
    const post = (p, y0) => { add(root, G.cyl, '#5a3a1a', p.x, y0 + .4, p.z, .06, .8, .06); add(root, G.sph, lampMat, p.x, y0 + .86, p.z, .18, .18, .18); };
    for (const a of [P.ST0 - .2, P.ST1 + .2, P.P1 - .4]) for (const sd of [-1, 1]) { const p = P.E.clone().addScaledVector(P.d, a).addScaledVector(P.s, sd * (P.PW + .05)); post(p, a <= P.ST0 ? H : .8); }
    if (opts.carp && opts.carp.g) {
      // 船舷兩側的小燈＋一盞只在晚上亮的暖光，照亮船尾甲板和跳板那一側
      for (const [x, z] of [[-1.15, -1.3], [1.1, -1.3], [-1.0, -2.6]]) { const m = add(opts.carp.g, G.sph, lampMat, x, 1.0, z, .1, .1, .1); m.castShadow = false; }
      const pl = new THREE.PointLight('#ffd9a0', 0, 7, 1.6); pl.position.set(0, 1.6, -1.9); opts.carp.g.add(pl);
      anim.push(() => { pl.intensity = night * 2.2; });
    }
    kinds.add('碼頭夜燈');
  }

  // ------------------------------------------------ 刺破氣球（熱氣球不在名單裡，刺不破）
  const bursts = [];
  const BURST_GEO = new THREE.BoxGeometry(.07, .07, .015);
  function pop(hit) {
    const info = hit.userData.balloon; if (!info || info.group.userData.popped) return false;
    const grp = info.group; grp.userData.popped = true; grp.visible = false;
    const p = new THREE.Vector3(); hit.getWorldPosition(p);
    const g = new THREE.Group(); g.position.copy(p); root.add(g);
    const parts = [];
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(BURST_GEO, new THREE.MeshBasicMaterial({ color: i % 3 ? info.color : BAL[(i * 7) % BAL.length], transparent: true })); g.add(m); parts.push({ m, v: new THREE.Vector3(R() - .5, R() * .8, R() - .5).normalize().multiplyScalar(1.5 + R() * 1.5), r: R() * 10 }); }
    bursts.push({ g, parts, t: 0 });
    setTimeout(() => { grp.visible = true; grp.userData.popped = false; }, 25000);   // 25 秒後再長回來
    return true;
  }
  anim.push((t, dt) => {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += dt;
      for (const q of b.parts) { q.m.position.addScaledVector(q.v, dt); q.v.y -= dt * 3; q.m.rotation.x += dt * q.r; q.m.rotation.y += dt * q.r; q.m.material.opacity = Math.max(0, 1 - b.t / 1.2); }
      if (b.t > 1.2) { root.remove(b.g); bursts.splice(i, 1); }
    }
  });
  // 跨橋迎賓：傳入走路的人的位置，回傳正在走的那座橋與走到哪裡（0＝服務台端，1＝小島端）
  function walkerAt(x, z) {
    for (const bl of bridgeLights) {
      const b = bl.b, ax = b.p1.x - b.p0.x, az = b.p1.z - b.p0.z, L2 = ax * ax + az * az;
      const tt = ((x - b.p0.x) * ax + (z - b.p0.z) * az) / L2; if (tt < 0 || tt > 1) continue;
      const lx = b.p0.x + ax * tt - x, lz = b.p0.z + az * tt - z; if (Math.hypot(lx, lz) > 1.1) continue;
      for (const it of bl.items) if (it.t <= tt + .12) it.lit = Math.min(1.6, it.lit + .25);   // 腳下和前面一盞依序亮起
      return { bl, t: tt };
    }
    return null;
  }
  batchStatic(stat); for (const g of statics) batchStatic(g);
  return { root, update, walkerAt, bridgeLights, freeSpot: (id, n, r) => spotAny([id], n, r), kinds: [...kinds], balloons: () => BALLOONS.filter((h) => !h.userData.balloon.group.userData.popped && h.parent && isVisible(h)), pop };
}
function isVisible(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true;
}
