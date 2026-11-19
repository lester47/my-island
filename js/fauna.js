// 島上的小生命：蝴蝶 30 隻、五色鳥 5 隻，另外四種昆蟲各 6 隻（蜻蜓、蜜蜂、瓢蟲、獨角仙）
import * as THREE from 'three';
import { batchStatic } from './kit.js?v=20261119d';

const TAU = Math.PI * 2;
const M = {};
const mat = (c, side) => M[c + (side || '')] || (M[c + (side || '')] = new THREE.MeshStandardMaterial({ color: c, roughness: .6, side: side ? THREE.DoubleSide : THREE.FrontSide }));
const G = { sph: new THREE.SphereGeometry(.5, 10, 8), cyl: new THREE.CylinderGeometry(.5, .5, 1, 8), cone: new THREE.ConeGeometry(.5, 1, 8), wing: new THREE.CircleGeometry(.5, 10), plane: new THREE.PlaneGeometry(1, 1) };
const add = (p, geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, side) => { const m = new THREE.Mesh(geo, mat(c, side)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); p.add(m); return m; };

// 蝴蝶：身體＋上下兩對翅膀，翅膀會拍
const BF = [['#ff9a3d', '#ffd25a'], ['#5aa8ff', '#bfe3ff'], ['#ffffff', '#ffe08a'], ['#ff6aa8', '#ffc2dc'], ['#ffd23a', '#2a2a2a'], ['#8a5cd0', '#e0c8ff'], ['#3ec27a', '#c8f0d8']];
function butterfly(c) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  add(body, G.sph, '#3a2a24', 0, 0, 0, .05, .05, .26);
  const wings = [-1, 1].map((s) => { const p = new THREE.Group(); body.add(p); add(p, G.wing, c[0], s * .17, 0, .04, .36, .44, 1, -Math.PI / 2, 0, 0, true); add(p, G.wing, c[1], s * .13, .002, -.12, .24, .26, 1, -Math.PI / 2, 0, 0, true); return p; });
  g.scale.setScalar(.75);
  return { g, wings };
}
// 五色鳥：綠色身體、藍色臉、黃色喉嚨、紅色額頭與胸前小紅點
function barbet() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  add(body, G.sph, '#3fa34d', 0, 0, 0, .34, .3, .48);
  add(body, G.sph, '#2f8fd8', 0, .12, .24, .28, .26, .26);
  add(body, G.sph, '#ffd23a', 0, .02, .32, .16, .1, .1);
  add(body, G.sph, '#e0302a', 0, .24, .26, .16, .08, .14);
  add(body, G.sph, '#e0302a', 0, -.06, .36, .06, .05, .04);
  add(body, G.cone, '#d8c9a0', 0, .1, .44, .07, .16, .07, Math.PI / 2);
  for (const s of [-1, 1]) add(body, G.sph, '#111111', s * .1, .17, .36, .04, .04, .03);
  add(body, G.plane, '#2e8a3c', 0, -.02, -.34, .14, .3, 1, -1.2, 0, 0, true);
  const wings = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * .14, .06, 0); body.add(p); add(p, G.plane, '#33923f', s * .2, 0, -.02, .42, .3, 1, -Math.PI / 2, 0, 0, true); return p; });
  return { g, wings, body };
}
// 蜻蜓：細長身體、兩對透明翅膀
function dragonfly(i) {
  const g = new THREE.Group(), c = ['#e0302a', '#2f8fd8', '#3ec27a'][i % 3];
  add(g, G.cyl, c, 0, 0, -.14, .035, .42, .035, Math.PI / 2); add(g, G.sph, c, 0, 0, .1, .1, .09, .12);
  for (const s of [-1, 1]) add(g, G.sph, '#222222', s * .04, .03, .14, .05, .05, .05);
  const wm = new THREE.MeshStandardMaterial({ color: '#e8f6ff', transparent: true, opacity: .5, side: THREE.DoubleSide });
  const wings = []; for (const z of [.04, -.04]) for (const s of [-1, 1]) { const w = new THREE.Mesh(G.plane, wm); w.position.set(s * .2, .02, z); w.scale.set(.36, .07, 1); w.rotation.x = -Math.PI / 2; g.add(w); wings.push({ w, s }); }
  return { g, wings };
}
// 蜜蜂：黃黑條紋、小翅膀
function bee() {
  const g = new THREE.Group();
  add(g, G.sph, '#ffcc1a', 0, 0, 0, .14, .12, .2); add(g, G.cyl, '#222222', 0, 0, .02, .13, .03, .13, Math.PI / 2); add(g, G.cyl, '#222222', 0, 0, -.05, .12, .03, .12, Math.PI / 2);
  add(g, G.sph, '#222222', 0, .01, .11, .09, .09, .08);
  const wm = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .6, side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => { const w = new THREE.Mesh(G.wing, wm); w.position.set(s * .08, .07, 0); w.scale.set(.12, .08, 1); w.rotation.x = -Math.PI / 2; g.add(w); return { w, s }; });
  return { g, wings };
}
// 瓢蟲：紅殼黑點
function ladybug() {
  const g = new THREE.Group();
  add(g, G.sph, '#e0302a', 0, .05, 0, .16, .1, .2); add(g, G.sph, '#111111', 0, .04, .1, .09, .07, .07);
  for (const [x, z] of [[-.04, .02], [.04, .02], [-.04, -.05], [.04, -.05], [0, -.08]]) add(g, G.sph, '#111111', x, .095, z, .035, .02, .035);
  add(g, G.cyl, '#111111', 0, .1, -.01, .005, .005, .18, Math.PI / 2);
  g.scale.setScalar(.9); return { g };
}
// 獨角仙：深褐色亮殼、頭上一根大角
function beetle() {
  const g = new THREE.Group();
  add(g, G.sph, '#4a2a14', 0, .07, -.03, .22, .13, .3); add(g, G.sph, '#3a200e', 0, .07, .13, .14, .1, .1);
  add(g, G.cyl, '#2a160a', 0, .12, .22, .03, .16, .03, -.6); add(g, G.cyl, '#2a160a', 0, .17, .29, .04, .03, .08);
  for (const z of [-.08, 0, .08]) for (const s of [-1, 1]) add(g, G.cyl, '#2a160a', s * .12, .03, z, .015, .1, .015, 0, 0, s * 1.1);
  return { g };
}

export function createFauna(W, opts = {}) {
  const { scene, islands } = W, H = opts.H ?? 1.75;
  const R = opts.rng ? opts.rng(777) : Math.random;
  const ids = ['center', 'food', 'craft', 'puzzle', 'sport', 'recycle'];
  const root = new THREE.Group(); scene.add(root);
  const list = [];
  const pick = () => islands[ids[(R() * ids.length) | 0]];
  const groundAt = (I) => { const a = R() * TAU, r = (I.walk ? I.walk.radAt(a) : 3) + .5 + R() * 1.4; return { x: I.pos.x + Math.cos(a) * Math.min(r, I.top(a) * .9), z: I.pos.z + Math.sin(a) * Math.min(r, I.top(a) * .9) }; };
  const n = (k) => k;   // 數量照指定，手機也一樣

  // 蝴蝶 30 隻：在各島上空低低地飛，忽高忽低
  for (let i = 0; i < n(30); i++) {
    const B = butterfly(BF[i % BF.length]); root.add(B.g);
    const I = pick(), c = { x: I.pos.x, z: I.pos.z };
    list.push({ kind: 'bf', ...B, c, rad: 1.5 + R() * 3.5, h: H + .6 + R() * 1.6, sp: (.25 + R() * .3) * (R() < .5 ? 1 : -1), ph: R() * TAU });
  }
  // 五色鳥 5 隻：在群島之間繞大圈飛，偶爾滑翔
  for (let i = 0; i < n(5); i++) {
    const B = barbet(); root.add(B.g);
    list.push({ kind: 'bird', ...B, c: { x: 0, z: 0 }, rad: 9 + i * 4 + R() * 3, h: H + 4 + R() * 3, sp: (.12 + R() * .06) * (i % 2 ? 1 : -1), ph: R() * TAU });
  }
  // 蜻蜓 6 隻：在島邊和海面上空停停飛飛
  for (let i = 0; i < n(6); i++) {
    const B = dragonfly(i); root.add(B.g);
    const I = pick();
    list.push({ kind: 'dragon', ...B, c: { x: I.pos.x, z: I.pos.z }, rad: (I.top(0) || 6) * .95 + R(), h: H + .5 + R() * .8, sp: .5 + R() * .3, ph: R() * TAU });
  }
  // 蜜蜂 6 隻：在小範圍裡嗡嗡繞圈（像在花圃附近）
  for (let i = 0; i < n(6); i++) {
    const B = bee(); root.add(B.g);
    const p = groundAt(pick());
    list.push({ kind: 'bee', ...B, c: p, rad: .5 + R() * .6, h: H + .45 + R() * .4, sp: 1.6 + R(), ph: R() * TAU });
  }
  // 瓢蟲、獨角仙各 6 隻：在草地上慢慢爬
  for (const [kind, make] of [['lady', ladybug], ['beetle', beetle]]) for (let i = 0; i < n(6); i++) {
    const B = make(); root.add(B.g);
    const p = groundAt(pick());
    list.push({ kind, ...B, c: p, rad: .3 + R() * .5, h: H + .01, sp: (kind === 'lady' ? .18 : .1) * (R() < .5 ? 1 : -1), ph: R() * TAU });
  }

  // 每隻小動物不會動的部分合成一個網格（翅膀照樣拍）：約 400 個零件 → 150 個左右
  for (const a of list) {
    const ws = (a.wings || []).map((w) => (w.isObject3D ? w : w.w));
    for (const w of ws) if (w.isGroup) batchStatic(w);
    batchStatic(a.body || a.g, ws);
  }
  function update(t, dt, moving, night) {
    const dayVis = (night || 0) < .7;   // 晚上蝴蝶、蜜蜂、蜻蜓去休息
    for (const a of list) {
      if (a.kind === 'bf' || a.kind === 'bee' || a.kind === 'dragon') a.g.visible = dayVis;
      if (!moving) continue;
      a.ph += dt * a.sp;
      let x, y, z;
      if (a.kind === 'dragon') { const k = a.ph + Math.sin(a.ph * 3) * .3; x = a.c.x + Math.cos(k) * a.rad; z = a.c.z + Math.sin(k) * a.rad; y = a.h + Math.sin(t * 2 + a.rad) * .2; }
      else if (a.kind === 'bf') { x = a.c.x + Math.cos(a.ph) * a.rad + Math.sin(a.ph * 2.3) * .6; z = a.c.z + Math.sin(a.ph) * a.rad + Math.cos(a.ph * 1.7) * .6; y = a.h + Math.sin(t * 3 + a.rad * 5) * .35; }
      else { x = a.c.x + Math.cos(a.ph) * a.rad; z = a.c.z + Math.sin(a.ph) * a.rad; y = a.h + (a.kind === 'bird' ? Math.sin(t * .8 + a.rad) * .8 : a.kind === 'bee' ? Math.sin(t * 9 + a.rad * 9) * .05 : 0); }
      const px = a.g.position.x, pz = a.g.position.z; a.g.position.set(x, y, z);
      if (Math.hypot(x - px, z - pz) > 1e-4) a.g.rotation.y = Math.atan2(x - px, z - pz);
      if (a.kind === 'bf') { const f = Math.sin(t * 16 + a.rad * 7) * .9; a.wings[0].rotation.z = f; a.wings[1].rotation.z = -f; }
      else if (a.kind === 'bird') { const glide = Math.sin(t * .5 + a.rad) > .4; const f = glide ? .15 : Math.sin(t * 12 + a.rad) * .7; a.wings[0].rotation.z = f; a.wings[1].rotation.z = -f; a.body.rotation.z = -Math.sign(a.sp) * .25; }
      else if (a.kind === 'dragon') { for (const w of a.wings) w.w.rotation.y = Math.sin(t * 40 + w.s) * .3 * w.s; }
      else if (a.kind === 'bee') { for (const w of a.wings) w.w.rotation.y = Math.sin(t * 50) * .5 * w.s; }
    }
  }
  return { root, update, counts: { butterflies: n(30), barbets: n(5), dragonflies: n(6), bees: n(6), ladybugs: n(6), beetles: n(6) } };
}
