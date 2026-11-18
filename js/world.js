// 3D 世界：天空、海、遠山、島嶼與地標、橋、日夜光影
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, rng, loopNoise, mat, Builder, GEO, glowTexture, C } from './kit.js?v=20261118w';
import { makeScenery } from './scenery.js?v=20261118w';

export const H = 1.75;               // 島頂草地高度
const SEG = 72;                      // 海岸線分段（6 的倍數，六角轉角落在頂點上）

// 群島配置（示意配置，非實際比例）；+z 朝向預設鏡頭
export const LAYOUT = {
  center:  { x: 0,   z: 0,   R: 10.0, seed: 3.1 },
  food:    { x: -12, z: -22, R: 6.6,  seed: 1.2 },
  craft:   { x: 12,  z: -22, R: 6.6,  seed: 5.7 },
  puzzle:  { x: -24, z: 4,   R: 6.6,  seed: 8.3 },
  sport:   { x: 24,  z: 4,   R: 6.6,  seed: 2.9 },
  recycle: { x: 0,   z: 25,  R: 6.6,  seed: 6.4 },
};
// 每座島的配色（3 層以上色階）
const PAL = {
  center:  { grass: ['#8fc96b', '#7dbb5b', '#a6d681'], path: ['#e7dcc6', '#d8cbb1'] },
  food:    { grass: ['#9fcf6c', '#8cc25d', '#b2db82'], path: ['#f1d9b8', '#e4c79e'], main: '#e8762b', soft: '#f7b170', deep: '#b9541a' },
  craft:   { grass: ['#93c978', '#81bb67', '#a9d58f'], path: ['#e6dcef', '#d4c6e2'], main: '#8a5cd0', soft: '#c1a6ec', deep: '#5e3b9c' },
  puzzle:  { grass: ['#8cc777', '#79b965', '#a2d48d'], path: ['#dbe7f3', '#c6d7ea'], main: '#2f7fd1', soft: '#8dbcec', deep: '#1d5596' },
  sport:   { grass: ['#97ca6e', '#86bd5d', '#acd685'], path: ['#f2d8d3', '#e5c1ba'], main: '#dc4848', soft: '#f19a92', deep: '#9c2b2b' },
  recycle: { grass: ['#86c56f', '#73b65d', '#9dd286'], path: ['#dcebd8', '#c7dcc1'], main: '#3e9b4f', soft: '#93d09c', deep: '#286b34' },
};
const SAND = ['#f3dfb2', '#e8cf98', '#dcc084'], ROCK = ['#b3a48f', '#9c8d79', '#c4b7a3', '#877a68'];
const WOOD = '#b98352', WOOD2 = '#8d5d35', WOOD3 = '#d4a571', WHITE = '#fbf7ee';

// 六角形加噪聲的海岸線（不是正六角柱）
export function shapeR(theta, seed) {
  const k = ((theta % (TAU / 6)) + TAU / 6) % (TAU / 6) - TAU / 12;
  const hex = Math.cos(TAU / 12) / Math.cos(k);
  return lerp(hex, 1, .16) * (1 + .045 * loopNoise(theta, seed));
}

// ------------------------------------------------------------------ 島的地形（沙灘 → 岩壁 → 草地）
function terrain(L, pal) {
  const { R, seed } = L;
  const rand = rng(Math.floor(seed * 1000));
  const rings = [ // [半徑倍率, 高度, 色階]
    [1.24, -1.4, SAND[2]], [1.22, .12, SAND[1]], [1.16, .36, SAND[0]], [1.08, .58, SAND[0]],
    [1.035, .66, ROCK[3]], [1.02, 1.05, ROCK[1]], [1.005, 1.42, ROCK[0]], [.995, 1.62, ROCK[2]], [.975, H, pal.grass[1]],
  ];
  const pos = [], col = [];
  const P = (ri, a) => {
    const th = a / SEG * TAU, r = shapeR(th, seed) * R * rings[ri][0];
    const jitter = ri >= 4 && ri <= 7 ? (rand() - .5) * .18 : 0;
    return [Math.cos(th) * (r + jitter), rings[ri][1] + (ri >= 4 && ri <= 7 ? (rand() - .5) * .12 : 0), Math.sin(th) * (r + jitter)];
  };
  const grid = rings.map((_, ri) => Array.from({ length: SEG }, (_, a) => P(ri, a)));
  const push = (a, b, c, hex, k = 1) => { const cc = C(hex).multiplyScalar(k); pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(cc.r, cc.g, cc.b); };
  for (let ri = 0; ri < rings.length - 1; ri++) for (let a = 0; a < SEG; a++) {
    const a1 = (a + 1) % SEG, p00 = grid[ri][a], p01 = grid[ri][a1], p10 = grid[ri + 1][a], p11 = grid[ri + 1][a1];
    const hex = rings[ri + 1][2], k = .93 + rand() * .12;
    push(p00, p10, p01, hex, k); push(p01, p10, p11, hex, k * .97);
  }
  // 草地頂面：同心環，三種草色
  const TR = 6, top = [];
  for (let j = 0; j <= TR; j++) top.push(Array.from({ length: SEG }, (_, a) => {
    const t = 1 - j / TR, th = a / SEG * TAU, r = shapeR(th, seed) * R * .975 * t;
    return [Math.cos(th) * r, H + (j > 0 && j < TR ? (rand() - .5) * .07 : 0), Math.sin(th) * r];
  }));
  for (let j = 0; j < TR; j++) for (let a = 0; a < SEG; a++) {
    const a1 = (a + 1) % SEG, p00 = top[j][a], p01 = top[j][a1], p10 = top[j + 1][a], p11 = top[j + 1][a1];
    const g = pal.grass[(Math.floor(rand() * 7) + j) % 3], k = .96 + rand() * .07;
    push(p00, p10, p01, g, k);
    if (j < TR - 1) push(p01, p10, p11, g, k * .98);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .92 }));
  m.receiveShadow = true; m.castShadow = true;
  return m;
}

// 浪花圈
function foamRing(L) {
  const pos = [], idx = [];
  for (let a = 0; a <= SEG; a++) {
    const th = a / SEG * TAU, r = shapeR(th, L.seed) * L.R;
    for (const [k, y] of [[1.2, .16], [1.36, .1]]) pos.push(Math.cos(th) * r * k, y, Math.sin(th) * r * k);
  }
  for (let a = 0; a < SEG; a++) { const i = a * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 1; return m;
}

// ------------------------------------------------------------------ 小物件（全部用程式幾何原創）
const NIGHT = { windows: [], lamps: [], glows: [] };
const winMat = new THREE.MeshStandardMaterial({ color: '#3d4660', emissive: '#ffcf73', emissiveIntensity: 0, flatShading: true, roughness: .4 });
const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#ffcf73', emissiveIntensity: .1, flatShading: true, roughness: .3 });
const MAT_FOR = (key) => key === 'win' ? winMat : key === 'lamp' ? lampMat : mat(key);

function house(B, roof, wall = '#fbf3e3', s = 1) {
  B.push(0, 0, 0, 0, s);
  B.add(GEO.box, WOOD2, 0, .08, 0, 0, 0, 0, 2.3, .16, 2.0);
  B.add(GEO.box, wall, 0, 1.0, 0, 0, 0, 0, 2.1, 1.75, 1.8);
  B.add(GEO.cone4, roof, 0, 2.45, 0, 0, Math.PI / 4, 0, 3.3, 1.25, 2.9);
  B.add(GEO.box, WOOD2, 0, .78, .91, 0, 0, 0, .62, 1.2, .06);          // 門
  B.add(GEO.box, 'win', -.62, 1.15, .91, 0, 0, 0, .5, .48, .05);       // 窗（夜晚亮）
  B.add(GEO.box, 'win', .62, 1.15, .91, 0, 0, 0, .5, .48, .05);
  B.add(GEO.box, 'win', 1.06, 1.15, 0, 0, Math.PI / 2, 0, .5, .48, .05);
  B.add(GEO.box, WOOD3, -.62, .86, .98, 0, 0, 0, .6, .07, .16);         // 窗台花箱
  B.add(GEO.box, WOOD3, .62, .86, .98, 0, 0, 0, .6, .07, .16);
  for (const x of [-.78, -.5, .5, .78]) B.add(GEO.ball0, ['#ff8fa3', '#ffd25a'][Math.abs(x) > .6 ? 0 : 1], x * .9, .96, .99, 0, 0, 0, .14);
  B.add(GEO.box, '#a3502f', .7, 2.75, -.3, 0, 0, 0, .28, .7, .28);        // 煙囪
  B.pop();
}
function treeRound(B, s = 1, tone = 0) {
  const greens = [['#5fae49', '#78c25c', '#4e9a3d'], ['#6cb84f', '#8bcc68', '#559f41']][tone % 2];
  B.push(0, 0, 0, 0, s);
  B.add(GEO.cyl6, WOOD2, 0, .7, 0, 0, 0, 0, .26, 1.4, .26);
  B.add(GEO.ball1, greens[0], 0, 1.95, 0, 0, 0, 0, 1.55, 1.35, 1.55);
  B.add(GEO.ball1, greens[1], .38, 2.35, .15, 0, 0, 0, 1.0);
  B.add(GEO.ball1, greens[2], -.35, 2.2, -.2, 0, 0, 0, 1.05);
  B.pop();
}
function treePine(B, s = 1) {
  B.push(0, 0, 0, 0, s);
  B.add(GEO.cyl6, WOOD2, 0, .45, 0, 0, 0, 0, .24, .9, .24);
  B.add(GEO.cone8, '#3f8f4a', 0, 1.35, 0, 0, 0, 0, 1.55, 1.4, 1.55);
  B.add(GEO.cone8, '#4f9f55', 0, 2.05, 0, 0, .3, 0, 1.2, 1.2, 1.2);
  B.add(GEO.cone8, '#62b267', 0, 2.65, 0, 0, .6, 0, .8, 1.0, .8);
  B.pop();
}
function bush(B, s = 1) { B.push(0, 0, 0, 0, s); B.add(GEO.ball1, '#6fb752', 0, .32, 0, 0, 0, 0, .9, .65, .9); B.add(GEO.ball1, '#86c766', .3, .42, .1, 0, 0, 0, .55); B.pop(); }
function flowerBed(B, w = 2.2, d = 1.0, colors = ['#ff8fa3', '#ffd25a', '#ffffff', '#b18cf0']) {
  B.add(GEO.box, '#9a6a3f', 0, .12, 0, 0, 0, 0, w + .2, .24, d + .2);
  B.add(GEO.box, '#6b4a2d', 0, .25, 0, 0, 0, 0, w, .04, d);
  let i = 0;
  for (let x = -w / 2 + .2; x < w / 2; x += .32) for (let z = -d / 2 + .2; z < d / 2; z += .32, i++) {
    B.add(GEO.cyl6, '#4f9a3c', x, .38, z, 0, 0, 0, .04, .26, .04);
    B.add(GEO.ball0, colors[i % colors.length], x, .55, z, 0, 0, 0, .2);
  }
}
function fence(B, len = 3) {
  for (let x = -len / 2; x <= len / 2 + .01; x += .5) B.add(GEO.box, WOOD3, x, .35, 0, 0, 0, 0, .1, .7, .1);
  B.add(GEO.box, WOOD3, 0, .5, 0, 0, 0, 0, len, .08, .06); B.add(GEO.box, WOOD3, 0, .26, 0, 0, 0, 0, len, .08, .06);
}
function bench(B) {
  B.add(GEO.box, WOOD, 0, .42, 0, 0, 0, 0, 1.3, .08, .42); B.add(GEO.box, WOOD, 0, .72, -.2, -.15, 0, 0, 1.3, .3, .06);
  for (const x of [-.55, .55]) B.add(GEO.box, '#5b5f66', x, .2, 0, 0, 0, 0, .08, .42, .38);
}
function crate(B, s = 1) {
  B.push(0, 0, 0, 0, s);
  B.add(GEO.box, WOOD3, 0, .32, 0, 0, 0, 0, .64, .64, .64);
  for (const y of [.12, .52]) B.add(GEO.box, WOOD2, 0, y, .33, 0, 0, 0, .66, .08, .02);
  B.pop();
}
function signBoard(B, color) {
  B.add(GEO.box, WOOD2, 0, .6, 0, 0, 0, 0, .1, 1.2, .1);
  B.add(GEO.box, WOOD3, 0, 1.15, .06, 0, 0, 0, .9, .55, .08);
  B.add(GEO.box, color, 0, 1.15, .11, 0, 0, 0, .72, .38, .02);
}
function well(B) {
  B.add(GEO.cyl12, ROCK[0], 0, .35, 0, 0, 0, 0, 1.1, .7, 1.1);
  B.add(GEO.cyl12, '#3c6f8f', 0, .71, 0, 0, 0, 0, .86, .02, .86);
  for (const x of [-.48, .48]) B.add(GEO.box, WOOD2, x, 1.05, 0, 0, 0, 0, .09, 1.4, .09);
  B.add(GEO.cone4, '#c4553a', 0, 1.9, 0, 0, Math.PI / 4, 0, 1.5, .6, 1.2);
}
function lampPost(B, world, groupWorldPos) {
  B.add(GEO.cyl6, '#4a4f58', 0, 1.1, 0, 0, 0, 0, .1, 2.2, .1);
  B.add(GEO.box, '#4a4f58', 0, 2.25, 0, 0, 0, 0, .36, .08, .36);
  B.add(GEO.box, 'lamp', 0, 2.05, 0, 0, 0, 0, .28, .34, .28);
  NIGHT.glows.push(new THREE.Vector3(0, 2.05, 0).applyMatrix4(B.m));
}
function rocks(B, rand, n, rMin, rMax, seed, R) {
  for (let i = 0; i < n; i++) {
    const th = rand() * TAU, r = (rMin + rand() * (rMax - rMin)) * shapeR(th, seed) * R;
    B.add(GEO.dode, ROCK[i % 3], Math.cos(th) * r, H + .05, Math.sin(th) * r, rand(), rand() * 3, 0, .35 + rand() * .45, .25 + rand() * .3, .35 + rand() * .4);
  }
}
function edgeGreens(B, rand, L, skipAngles) {
  // 邊緣草叢與小石頭
  for (let i = 0; i < 46; i++) {
    const th = i / 46 * TAU + rand() * .06;
    if (skipAngles.some((a) => Math.abs(Math.atan2(Math.sin(th - a), Math.cos(th - a))) < .22)) continue;
    const r = shapeR(th, L.seed) * L.R * (.9 + rand() * .05), x = Math.cos(th) * r, z = Math.sin(th) * r;
    const q = rand();
    if (q < .55) for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + rand(); B.add(GEO.cone4, k % 2 ? '#5ea844' : '#7cc25c', x + Math.cos(a) * .1, H + .22, z + Math.sin(a) * .1, Math.sin(a) * .35, rand(), -Math.cos(a) * .35, .12, .5 + rand() * .3, .12); }
    else if (q < .8) B.add(GEO.dode, ROCK[Math.floor(rand() * 3)], x, H + .06, z, rand(), rand(), 0, .22 + rand() * .2, .14, .22 + rand() * .15);
    else { B.add(GEO.ball0, ['#ffffff', '#ffd25a', '#ff9fb2'][Math.floor(rand() * 3)], x, H + .22, z, 0, 0, 0, .18); B.add(GEO.cyl6, '#4f9a3c', x, H + .1, z, 0, 0, 0, .03, .2, .03); }
  }
}
function stonePath(B, pal, rRing, rand, spokeAngles, R, seed, width = .95) {
  const n = Math.round(rRing * TAU / .78);
  for (let i = 0; i < n; i++) {
    const th = i / n * TAU, x = Math.cos(th) * rRing, z = Math.sin(th) * rRing;
    B.add(GEO.cyl6, pal.path[i % 2], x, H + .03, z, 0, th + rand() * .4, 0, width * .78, .07, width * .66);
  }
  for (const a of spokeAngles) {
    const end = shapeR(a, seed) * R * .97;
    for (let r = rRing + .7; r < end; r += .72) B.add(GEO.cyl6, pal.path[Math.round(r) % 2], Math.cos(a) * r, H + .03, Math.sin(a) * r, 0, a + rand(), 0, .7, .07, .6);
  }
}
function dock(B, L, ang) {
  // 碼頭與小船：放在沙灘外側
  const r0 = shapeR(ang, L.seed) * L.R * 1.06;
  B.push(Math.cos(ang) * r0, 0, Math.sin(ang) * r0, -ang + Math.PI / 2);
  for (let i = 0; i < 6; i++) B.add(GEO.box, i % 2 ? WOOD : WOOD3, 0, .62, i * .5 + .2, 0, 0, 0, 1.3, .1, .45);
  for (const x of [-.6, .6]) for (const z of [.3, 1.4, 2.6]) B.add(GEO.cyl6, WOOD2, x, .2, z, 0, 0, 0, .14, 1.2, .14);
  B.pop();
  return { x: Math.cos(ang) * (r0 + 2.4) + 1.2 * Math.cos(ang + Math.PI / 2), z: Math.sin(ang) * (r0 + 2.4) + 1.2 * Math.sin(ang + Math.PI / 2), ry: -ang };
}
function rowBoat(color) {
  const B = new Builder();
  B.add(GEO.box, color, 0, .25, 0, 0, 0, 0, .9, .3, 1.9);
  B.add(GEO.cone4, color, 0, .25, 1.15, Math.PI / 2, Math.PI / 4, 0, .63, .5, .3);
  B.add(GEO.box, WOOD3, 0, .38, 0, 0, 0, 0, .8, .06, .3);
  return B.build(MAT_FOR);
}

// ------------------------------------------------------------------ 各島地標
const ANIM = [];   // 會動的小機關（減少動態時停止）
// 女童軍愛心義賣：小小的紫白條紋爆米花攤（放在島外圈原本放木箱的位置）
function popcornStand(B) {
  B.add(GEO.box, '#fbf7ee', 0, .45, 0, 0, 0, 0, .9, .9, .55);
  B.add(GEO.box, '#e0463a', 0, .55, .28, 0, 0, 0, .22, .2, .02);
  for (let i = 0; i < 5; i++) B.add(GEO.box, i % 2 ? WHITE : '#8e5cc9', -.36 + i * .18, 1.62, 0, -.2, 0, 0, .18, .05, .8);
  for (const x of [-.4, .4]) B.add(GEO.box, WOOD2, x, 1.25, -.2, 0, 0, 0, .06, .8, .06);
  B.add(GEO.box, '#cfe8ff', 0, 1.12, -.05, 0, 0, 0, .42, .36, .36);
  for (let i = 0; i < 7; i++) B.add(GEO.ball0, '#fff3c4', -.12 + (i % 4) * .08, 1.0 + Math.floor(i / 4) * .07, -.05 + (i % 2) * .08, 0, 0, 0, .09);
}
function landmarkFood(B, g, P, extras = {}) {
  // 條紋點心攤＋巨型果汁招牌
  B.push(0, H, -.3);
  for (const [x, z] of [[-1.6, -.7], [1.6, -.7], [-1.6, .7], [1.6, .7]]) B.add(GEO.box, WOOD2, x, 1.25, z, 0, 0, 0, .14, 2.5, .14);
  B.add(GEO.box, WOOD, 0, .55, 0, 0, 0, 0, 3.3, 1.1, 1.3);
  for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) B.add(GEO.box, (i + j) % 2 ? WHITE : P.soft, -1.48 + i * .33, 1.13, -.5 + j * .33, 0, 0, 0, .33, .04, .33);
  for (let i = 0; i < 9; i++) B.add(GEO.box, i % 2 ? WHITE : P.main, -1.6 + i * .4, 2.62, 0, -.22, 0, 0, .4, .07, 1.9);
  for (let i = 0; i < 9; i++) B.add(GEO.cyl8, i % 2 ? WHITE : P.main, -1.6 + i * .4, 2.32, 1.0, Math.PI / 2, 0, 0, .4, .1, .4);
  for (let i = 0; i < 4; i++) B.add(GEO.cyl8, '#ffffff', -1.1 + i * .3, 1.27, .25, 0, 0, 0, .22, .3, .22);
  B.add(GEO.cyl12, '#ffd34a', .8, 1.42, -.15, 0, 0, 0, .7, .6, .7);
  B.add(GEO.cyl12, '#fff6d8', .8, 1.76, -.15, 0, 0, 0, .64, .08, .64);
  B.add(GEO.cyl12, WHITE, 1.25, 1.17, .35, 0, 0, 0, .9, .05, .9);
  for (let i = 0; i < 5; i++) B.add(GEO.cyl8, '#c98a47', 1.25 + Math.cos(i * 1.26) * .22, 1.24, .35 + Math.sin(i * 1.26) * .22, 0, 0, 0, .26, .06, .26);
  B.pop();
  // 招牌柱上的巨型果汁杯（慢慢轉）
  B.add(GEO.cyl6, WOOD2, -2.2, H + 1.6, .7, 0, 0, 0, .14, 3.2, .14);
  const cup = new THREE.Group(); cup.position.set(-2.2, H + 3.5, .7);
  const m = (geo, c, y, sx, sy, sz, rz = 0) => { const o = new THREE.Mesh(geo, mat(c)); o.position.y = y; o.scale.set(sx, sy, sz); o.rotation.z = rz; o.castShadow = true; cup.add(o); };
  m(new THREE.CylinderGeometry(.5, .38, 1, 12), '#fff6d8', 0, 1.1, 1.2, 1.1);
  m(new THREE.CylinderGeometry(.5, .38, 1, 12), '#ff9e2c', -.08, 1.0, .95, 1.0);
  m(GEO.sph, '#fff6d8', .62, 1.15, .4, 1.15);
  m(GEO.cyl6, '#ff5a5a', 1.15, .1, 1.1, .1, .25);
  g.add(cup); extras.cup = cup; extras.lm = g; ANIM.push((t) => { cup.rotation.y = t * .5; });
}
function landmarkCraft(B, g, P) {
  // 紫色手作帳篷（條紋圓錐頂）＋巨型剪刀＋調色盤
  B.push(0, H, -.4);
  B.add(GEO.cyl12, '#f6f0ff', 0, .9, 0, 0, 0, 0, 3.2, 1.8, 3.2);
  for (let i = 0; i < 12; i++) B.add(GEO.cone4, i % 2 ? WHITE : P.main, Math.cos(i / 12 * TAU) * .02, 2.6, Math.sin(i / 12 * TAU) * .02, 0, i / 12 * TAU, 0, 3.7, 1.7, .2 + 0);
  B.add(GEO.cone8, P.main, 0, 2.6, 0, 0, 0, 0, 3.6, 1.6, 3.6);
  B.add(GEO.cyl6, WOOD2, 0, 3.7, 0, 0, 0, 0, .06, .7, .06);
  B.add(GEO.cone4, '#ffd25a', .22, 3.9, 0, 0, 0, -Math.PI / 2, .3, .45, .05);
  B.add(GEO.box, '#3d2a5c', 0, .75, 1.58, 0, 0, 0, 1.1, 1.5, .05);       // 帳篷門
  B.add(GEO.box, WOOD, 1.0, .45, 2.0, 0, 0, 0, 1.4, .1, .7);
  for (let i = 0; i < 3; i++) B.add(GEO.cyl8, ['#ff6b6b', '#ffd25a', '#4aa3e8'][i], .5 + i * .23, .62, 2.0, 0, 0, 0, .16, .26, .16);
  for (const [x, z] of [[.5, 1.7], [1.5, 1.7], [.5, 2.3], [1.5, 2.3]]) B.add(GEO.box, WOOD2, x, .2, z, 0, 0, 0, .07, .4, .07);
  // 抽抽樂的抽籤箱（紅箱、黃星、投口）
  B.add(GEO.box, '#e0463a', 1.38, .75, 2.0, 0, 0, 0, .5, .5, .5);
  B.add(GEO.box, '#5a1a14', 1.38, 1.005, 2.0, 0, 0, 0, .26, .02, .08);
  B.add(GEO.cone4, '#ffd25a', 1.38, .78, 2.26, Math.PI / 2, 0, 0, .14, .04, .14);
  // 接球桶：桶裡裝滿彩色球
  B.add(GEO.cyl12, '#3c8dea', 2.02, .25, 2.0, 0, 0, 0, .5, .5, .5);
  for (const [x, z, c] of [[-.1, -.08, '#ff6b6b'], [.1, .06, '#ffd25a'], [-.04, .12, '#5ec26a'], [.12, -.12, '#ffffff']]) B.add(GEO.ball0, c, 2.02 + x, .54, 2.0 + z, 0, 0, 0, .2);
  B.pop();
  // 巨型剪刀
  B.push(2.6, H, .3, -.5);                          // 放在空曠的一側，不擋房子旁的小路
  B.add(GEO.box, '#7d8794', 0, .2, 0, 0, 0, 0, 1.2, .4, .8);
  for (const s of [-1, 1]) {
    B.add(GEO.torus, s < 0 ? '#ff8fc0' : P.main, s * .35, 1.0, 0, 0, 0, 0, 1.1, 1.1, 1.6);
    B.add(GEO.box, '#d6dde6', -s * .2, 2.1, 0, 0, 0, s * .3, .16, 1.9, .07);
  }
  B.add(GEO.ball0, '#6b7380', 0, 1.45, .06, 0, 0, 0, .2);
  B.pop();
  // 調色盤
  B.push(-2.3, H + .05, .9, .4);                    // 調色盤是平的，可以踩過去
  B.add(GEO.cyl16, '#e9c48f', 0, .06, 0, 0, 0, 0, 1.6, .1, 1.2);
  for (let i = 0; i < 6; i++) B.add(GEO.ball0, ['#ff6b6b', '#ffd25a', '#4aa3e8', '#5ec26a', '#b18cf0', '#ff9a3d'][i], Math.cos(i * 1.05) * .45, .16, Math.sin(i * 1.05) * .33, 0, 0, 0, .22, .1, .22);
  B.pop();
}
function landmarkPuzzle(B, g, P, extras = {}) {
  // 木製彈珠迷宮
  B.push(.3, H, .3);
  B.add(GEO.box, '#e0b47a', 0, .2, 0, 0, 0, 0, 3.4, .4, 2.6);
  const walls = [[0, -1.25, 3.4, .12], [0, 1.25, 3.4, .12], [-1.65, 0, .12, 2.6], [1.65, 0, .12, 2.6], [-.8, -.3, .12, 1.6], [0, .4, 1.6, .12], [.8, -.5, .12, 1.3], [.35, -.75, .9, .12], [-1.15, .75, .8, .12]];
  for (const [x, z, w, d] of walls) B.add(GEO.box, '#f3d3a2', x, .55, z, 0, 0, 0, w, .3, d);
  for (const [x, z, c] of [[-1.2, -.8, '#3c8dea'], [.4, .8, '#55c9a8'], [1.2, .15, '#3c8dea'], [-.3, -.9, '#7ad0ff']]) B.add(GEO.sph, c, x, .58, z, 0, 0, 0, .3);
  B.add(GEO.torus, '#e0463a', 1.2, .42, -.8, 0, 0, 0, .6, .6, .9);
  B.pop();
  // 記憶卡：鋪在草地上的翻牌（很薄，可以走過去）
  B.push(-2.3, H + .02, 1.3, .35);
  B.add(GEO.box, '#2f6db3', 0, .02, 0, 0, 0, 0, 1.5, .04, 1.1);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const up = (i * 3 + j) % 5 === 1; B.add(GEO.box, up ? ['#ff6b6b', '#ffd25a', '#5ec26a'][(i + j) % 3] : '#fbf7ee', -.5 + i * .33, .06, -.3 + j * .3, 0, 0, 0, .26, .03, .22); }
  B.pop();
  // 拼圖拱門
  B.push(0, H, -2.2);
  for (const s of [-1, 1]) { B.add(GEO.box, s < 0 ? P.main : '#ffcf3a', s * 1.3, 1.2, 0, 0, 0, 0, .8, 2.4, .5); B.add(GEO.cyl12, s < 0 ? P.main : '#ffcf3a', s * 1.3 + s * -.5, 1.4, 0, 0, 0, Math.PI / 2, .44, .3, .44); }
  B.add(GEO.box, P.soft, 0, 2.75, 0, 0, 0, 0, 3.4, .75, .5);
  B.add(GEO.cyl12, P.soft, 0, 3.15, 0, Math.PI / 2, 0, 0, .5, .5, .5);
  B.add(GEO.cyl12, '#5ec26a', -.75, 2.75, .2, Math.PI / 2, 0, 0, .36, .2, .36);
  B.pop();
  const marble = new THREE.Mesh(GEO.sph, mat('#ff5a8a', { roughness: .2 })); marble.scale.setScalar(.32); marble.castShadow = true; g.add(marble);
  extras.marble = marble; extras.lm = g;
  ANIM.push((t) => { if (extras.marbleHold) return; const a = t * .8; marble.position.set(.3 + Math.cos(a) * 1.2, H + .6, .3 + Math.sin(a * 2) * .5); });
}
function landmarkSport(B, g, P, extras = {}) {
  // 沙包投擲洞洞板（往中間挪，讓出房子旁的環狀小路）
  B.push(-.7, H, -.35, .25);
  B.add(GEO.box, '#e7c48c', 0, 1.1, 0, -.5, 0, 0, 2.4, 2.6, .16);
  B.add(GEO.box, WOOD2, 0, 1.1, -.04, -.5, 0, 0, 2.55, 2.75, .1);
  const tilt = -.5;
  for (const [x, y, c] of [[-.55, .55, '#ffcf3a'], [.55, .55, '#3c8dea'], [-.55, -.5, '#5ec26a'], [.55, -.5, P.main]]) {
    B.add(GEO.torus, c, x, 1.1 + y * Math.cos(tilt), -y * Math.sin(tilt) * -1 * -1 + .1, Math.PI / 2 + tilt, 0, 0, .7, .7, .7);
  }
  for (const x of [-1, 1]) B.add(GEO.box, WOOD2, x, .9, -1.0, .55, 0, 0, .1, 2.0, .1);
  B.pop();
  B.push(1.0, H, 1.6);
  B.add(GEO.cyl12, '#c8955a', 0, .3, 0, 0, 0, 0, 1.1, .6, 1.1);
  for (const [x, z, c] of [[-.2, 0, P.main], [.15, .15, '#3c8dea'], [.1, -.2, '#ffcf3a']]) B.add(GEO.box, c, x, .66, z, 0, x * 3, 0, .34, .14, .3);
  B.pop();
  // 陀螺擂台（陀螺會轉）
  B.push(1.6, H, -1.4);
  B.add(GEO.cyl16, '#5b6474', 0, .2, 0, 0, 0, 0, 2.4, .4, 2.4);
  B.add(GEO.cyl16, '#d9e2ec', 0, .41, 0, 0, 0, 0, 2.1, .04, 2.1);
  B.pop();
  for (const [i, c] of [[0, P.main], [1, '#3c8dea']]) {
    const top = new THREE.Group();
    const a = new THREE.Mesh(new THREE.ConeGeometry(.28, .4, 8), mat(c)); a.rotation.x = Math.PI; a.position.y = .25; top.add(a);
    const b = new THREE.Mesh(GEO.cyl8, mat('#fbf7ee')); b.scale.set(.6, .1, .6); b.position.y = .45; top.add(b);
    top.traverse((o) => { o.castShadow = true; }); g.add(top); (extras.tops = extras.tops || []).push(top); extras.lm = g;
    ANIM.push((t) => { if (extras.topsHold) return; const q = t * 1.3 + i * Math.PI; top.position.set(1.6 + Math.cos(q) * .55, H + .42, -1.4 + Math.sin(q) * .55); top.rotation.y = t * 14; top.rotation.z = Math.sin(t * 3 + i) * .08; });
  }
}
function landmarkRecycle(B, g, P, extras = {}) {
  // 交換小屋（開放式前廊）＋書櫃＋循環標誌
  B.push(-.4, H, -1.0);
  B.add(GEO.box, '#f1ead8', 0, 1.0, -.2, 0, 0, 0, 3.0, 2.0, 1.6);
  B.add(GEO.box, P.main, 0, 2.15, .15, -.18, 0, 0, 3.4, .14, 2.4);
  B.add(GEO.box, WOOD, 0, .4, .8, 0, 0, 0, 2.8, .8, .5);
  for (let i = 0; i < 6; i++) B.add(GEO.box, ['#e0463a', '#3c8dea', '#ffcf3a', '#5ec26a', '#b18cf0', '#ff9a3d'][i], -1.1 + i * .42, .95, .78, 0, 0, (i % 3 - 1) * .08, .28, .28, .35);
  B.add(GEO.box, 'win', -.9, 1.35, .61, 0, 0, 0, .6, .5, .04);
  B.add(GEO.box, 'win', .9, 1.35, .61, 0, 0, 0, .6, .5, .04);
  B.pop();
  extras.lm = g; extras.shelf = { x: 2.2, z: .3, ry: -.6 };
  B.push(2.2, H, .3, -.6);  // 書櫃
  B.add(GEO.box, WOOD, 0, .8, 0, 0, 0, 0, 1.2, 1.6, .5);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) B.add(GEO.box, ['#e0463a', '#3c8dea', '#ffcf3a', '#5ec26a', '#ff9a3d'][(i + r) % 5], -.42 + i * .2, .32 + r * .5, .08, 0, 0, 0, .16, .38, .32);
  B.pop();
  B.push(-2.3, H, 1.2, .4); crate(B, 1.1);
  // 聖誕 DIY：木箱上的小聖誕樹
  B.add(GEO.cone8, '#2f8a47', 0, .98, 0, 0, 0, 0, .62, .5, .62); B.add(GEO.cone8, '#3aa356', 0, 1.26, 0, 0, 0, 0, .46, .42, .46);
  B.add(GEO.cone4, '#ffd25a', 0, 1.5, 0, 0, 0, 0, .14, .14, .05);
  for (const [x, y, z, c] of [[.18, .92, .12, '#e0463a'], [-.15, 1.0, .14, '#ffd25a'], [.1, 1.2, -.12, '#3c8dea']]) B.add(GEO.ball0, c, x, y, z, 0, 0, 0, .08);
  B.pop();
  // 屋簷下掛一排聖誕襪（高過頭，不擋路）
  B.push(-.4, H, -1.0);
  B.add(GEO.box, WOOD2, 0, 1.92, 1.12, 0, 0, 0, 2.6, .03, .03);
  for (let i = 0; i < 4; i++) { const x = -.9 + i * .6; B.add(GEO.box, i % 2 ? '#e0463a' : '#2f8a47', x, 1.72, 1.12, 0, 0, 0, .14, .32, .06); B.add(GEO.box, WHITE, x, 1.88, 1.12, 0, 0, 0, .18, .07, .07); B.add(GEO.box, i % 2 ? '#e0463a' : '#2f8a47', x + .07, 1.58, 1.12, 0, 0, 0, .16, .1, .06); }
  B.pop();
  // 會轉的循環標誌
  B.add(GEO.cyl6, WOOD2, 1.2, H + 1.5, -2.4, 0, 0, 0, .14, 3, .14);
  const sign = new THREE.Group(); sign.position.set(1.2, H + 3.4, -2.4);
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(.55, .13, 6, 14, TAU / 3 - .45), mat(P.main)); arc.rotation.z = i * TAU / 3; sign.add(arc);
    const head = new THREE.Mesh(GEO.cone4, mat(P.main)); const a = i * TAU / 3 + TAU / 3 - .45;
    head.position.set(Math.cos(a) * .55, Math.sin(a) * .55, 0); head.rotation.z = a; head.scale.set(.42, .36, .2); sign.add(head);
  }
  sign.traverse((o) => { o.castShadow = true; }); g.add(sign);
  ANIM.push((t) => { sign.rotation.y = t * .6; });
}
function landmarkCenter(B, g, P, extras) {
  // 活動服務台涼亭
  B.push(0, H, 0);
  B.add(GEO.cyl6, '#e9dcc3', 0, .12, 0, 0, Math.PI / 6, 0, 5.0, .24, 5.0);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; B.add(GEO.cyl6, WHITE, Math.cos(a) * 2.1, 1.35, Math.sin(a) * 2.1, 0, 0, 0, .2, 2.5, .2); }
  B.add(GEO.cone6, '#e3a33b', 0, 3.25, 0, 0, Math.PI / 6, 0, 5.4, 1.5, 5.4);
  B.add(GEO.cone6, '#3f7d3a', 0, 3.98, 0, 0, Math.PI / 6, 0, 2.0, .6, 2.0);
  B.add(GEO.box, WOOD, 0, .7, .4, 0, 0, 0, 2.6, .9, .7);
  B.add(GEO.box, '#3f7d3a', 0, .9, .76, 0, 0, 0, 2.2, .35, .04);
  for (let i = 0; i < 4; i++) B.add(GEO.cyl8, ['#e8762b', '#8a5cd0', '#2f7fd1', '#dc4848'][i], -.8 + i * .5, 1.24, .35, 0, 0, 0, .3, .1, .3);
  B.pop();
  // 鯉魚旗竿（三尾隨風飄）
  B.add(GEO.cyl6, '#d8d2c4', 3.6, H + 3.2, -2.6, 0, 0, 0, .14, 6.4, .14);
  B.add(GEO.ball0, '#e3a33b', 3.6, H + 6.5, -2.6, 0, 0, 0, .35);
  const koiCols = [['#e8473f', '#ffffff'], ['#2f7fd1', '#ffffff'], ['#e8762b', '#fff1e2']];
  koiCols.forEach(([c1, c2], i) => {
    const koi = new THREE.Group(); koi.position.set(3.6, H + 5.9 - i * 1.15, -2.6);
    const len = 2.2 - i * .3;
    for (let k = 0; k < 5; k++) {
      const seg = new THREE.Mesh(GEO.cyl12, mat(k % 2 ? c2 : c1)); seg.rotation.z = Math.PI / 2; seg.position.x = .1 + k * len / 5 + len / 10;
      const r = .55 - k * .07; seg.scale.set(r, len / 5, r); seg.castShadow = true; koi.add(seg);
    }
    const eye = new THREE.Mesh(GEO.sph, mat('#ffffff')); eye.position.set(.25, .12, .26); eye.scale.setScalar(.2); koi.add(eye);
    const pupil = new THREE.Mesh(GEO.sph, mat('#222222')); pupil.position.set(.27, .12, .33); pupil.scale.setScalar(.1); koi.add(pupil);
    const tail = new THREE.Mesh(GEO.cone4, mat(c1)); tail.position.x = .2 + len + .2; tail.rotation.z = -Math.PI / 2; tail.scale.set(.6, .5, .1); koi.add(tail);
    g.add(koi);
    ANIM.push((t) => { koi.rotation.y = -.9 + Math.sin(t * .9 + i) * .25; koi.rotation.z = Math.sin(t * 2.1 + i * 1.3) * .08; koi.children.forEach((s, k) => { if (k < 5) s.position.y = Math.sin(t * 4 + k * .8 + i) * .06 * k; }); });
  });
  // 風車（點綴）
  const wm = new THREE.Vector3(-6.3, 0, -4.2);
  B.push(wm.x, H, wm.z, .5);
  B.add(new THREE.CylinderGeometry(.55, 1.0, 1, 8), WHITE, 0, 2.0, 0, 0, 0, 0, 1, 4.0, 1);
  B.add(GEO.cone8, '#c4553a', 0, 4.5, 0, 0, 0, 0, 1.5, 1.1, 1.5);
  B.add(GEO.box, WOOD2, 0, .7, .8, 0, 0, 0, .55, 1.1, .1);
  B.add(GEO.box, 'win', 0, 2.6, .66, 0, 0, 0, .38, .4, .05);
  B.pop();
  const blades = new THREE.Group(); blades.position.set(wm.x + Math.sin(.5) * .95, H + 3.9, wm.z + Math.cos(.5) * .95); blades.rotation.y = .5;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = i * TAU / 4;
    const bar = new THREE.Mesh(GEO.box, mat(WOOD2)); bar.scale.set(.12, 2.3, .06); bar.position.y = 1.15; arm.add(bar);
    const sail = new THREE.Mesh(GEO.box, mat('#fbf3e3')); sail.scale.set(.6, 1.6, .03); sail.position.set(.34, 1.35, 0); arm.add(sail);
    blades.add(arm);
  }
  const hub = new THREE.Mesh(GEO.sph, mat(WOOD2)); hub.scale.setScalar(.35); blades.add(hub);
  // 鯉魚造型裝飾（照參考圖的低多邊形錦鯉：紅白、黃金、藍橘、三色、紅黑）
  // 每片風車葉前後各貼一尾，塔身前後各一尾大的
  const koiTex = [1, 2, 3, 4, 5].map((n) => { const tx = new THREE.TextureLoader().load(`assets/koi/koi-${n}.png`); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; });
  const koiMat = koiTex.map((tx) => new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .5, roughness: .8 }));
  const KOI_AR = 512 / 182;
  const koiPlane = (n, w) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / KOI_AR), koiMat[n]); m.castShadow = true; return m; };
  blades.children.forEach((arm, i) => {
    if (!arm.isGroup) return;
    // 四片共用同一條規則：魚頭朝軸心、魚尾朝外（圖片的魚頭在左邊，轉 90° 後朝向葉片根部）
    // 魚放在葉布正中央，比葉布小一圈，四周留米白邊
    for (const [z, ry] of [[.022, 0], [-.022, Math.PI]]) {
      const k = koiPlane(i % 5, 1.35); k.position.set(.34, 1.35, z); k.rotation.set(0, ry, Math.PI / 2); arm.add(k);
    }
  });
  // 塔身：前後各一尾立體的錦鯉雕塑——照參考圖最上面那尾紅白錦鯉做成低多邊形（切面）立體造型
  // 魚頭朝 -x、側面朝 +z（朝外）；身體用一圈圈橢圓斷面接起來，每個面依位置上色（紅白花紋），再加背鰭、胸鰭、燕尾形尾鰭
  const cyl8 = new THREE.CylinderGeometry(1, 1, 1, 8), FM = new Map();
  const part = (p, geo, c, x, y, z, sx, sy, sz, rx = 0) => { if (!FM.has(c)) FM.set(c, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .6 })); const m = new THREE.Mesh(geo, FM.get(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; m.castShadow = true; p.add(m); return m; };
  const RED = ['#e2452c', '#d63c25', '#ea5236'], CRM = ['#f0dcc2', '#e8d0b2', '#f6e6d0'];
  function koiSculpture(seed) {
    let sd = seed; const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
    const pos = [], col = [], C = new THREE.Color();
    const tri = (a, b, c, pal) => { pos.push(...a, ...b, ...c); C.set(pal[Math.floor(rnd() * pal.length)]); for (let i = 0; i < 3; i++) col.push(C.r, C.g, C.b); };
    // 花紋：t＝從魚嘴到尾柄的位置（0～1），yn＝上下（1 背、-1 肚）
    const paint = (t, yn) => {                                            // 照參考圖：臉白、眼後到前背紅、腹側白；中段斜斜一大塊白斑（上後下前）、斑下一塊紅；後背紅；尾柄白
      if (t < .14) return CRM;
      if (Math.abs(t - (.41 + .1 * yn)) < .075 && t < .56) return CRM;   // 斜的白斑
      if (t < .56) return yn > -.3 || t > .42 ? RED : CRM;
      if (t < .74) return yn > -.4 ? RED : CRM;
      if (t < .86) return yn > .5 ? RED : CRM;
      return CRM;
    };
    const PROF = [[0, -.02, .035, .03], [.05, 0, .1, .085], [.12, .01, .155, .12], [.2, .02, .19, .14], [.3, .025, .205, .145], [.4, .025, .205, .145], [.5, .02, .19, .135], [.6, .01, .16, .12], [.7, 0, .12, .09], [.79, 0, .08, .06], [.88, 0, .05, .04]];
    const SEC = [PROF[0]];                                               // 斷面加密，花紋邊界才會是斜的、不會變成直條紋
    for (let i = 1; i < PROF.length; i++) { const p0 = PROF[i - 1], p1 = PROF[i], n = i === 1 ? 1 : 3; for (let k = 1; k <= n; k++) SEC.push(p0.map((v, j) => v + (p1[j] - v) * k / n)); }
    const N = 10, rings = SEC.map(([x, cy, h, w]) => { const r = []; for (let i = 0; i < N; i++) { const a = i / N * TAU + Math.PI / N, sn = Math.sin(a); r.push([x, cy + h * sn * (sn < 0 ? .85 : 1), w * Math.cos(a)]); } return r; });
    const tipP = [-.03, -.025, 0];
    for (let i = 0; i < N; i++) { const a = rings[0][i], b = rings[0][(i + 1) % N]; tri(tipP, b, a, CRM); }   // 嘴尖
    for (let s = 0; s < SEC.length - 1; s++) for (let i = 0; i < N; i++) {
      const a = rings[s][i], b = rings[s][(i + 1) % N], c = rings[s + 1][(i + 1) % N], d = rings[s + 1][i];
      const tm = (SEC[s][0] + SEC[s + 1][0]) / 2 / .88, yn = Math.sin((i + 1) / N * TAU), pal = paint(tm, yn);
      tri(a, b, c, pal); tri(a, c, d, pal);
    }
    // 燕尾形尾鰭：上葉外側紅、內側白；下葉同樣
    const A = [.86, .045, 0], B = [.86, -.045, 0], Nn = [1.04, 0, 0], U = [1.3, .3, .015], L = [1.28, -.27, -.015], M1 = [1.06, .14, .025], M2 = [1.05, -.13, -.025];
    tri(A, Nn, B, CRM); tri(A, M1, Nn, CRM); tri(M1, U, Nn, RED); tri(A, U, M1, RED); tri(B, Nn, M2, CRM); tri(M2, Nn, L, RED); tri(B, M2, L, RED);
    // 背鰭（米白、三角切面）
    const D0 = [.3, .2, 0], D1 = [.4, .37, .01], D2 = [.47, .22, 0], D3 = [.6, .29, -.01], D4 = [.58, .19, 0];
    tri(D0, D1, D2, CRM); tri(D2, D1, D3, CRM); tri(D2, D3, D4, CRM);
    // 胸鰭（左右各一，往後下方張開）
    for (const z of [1, -1]) { const P0 = [.2, -.12, z * .12], P1 = [.34, -.15, z * .16], P2 = [.31, -.27, z * .2], P3 = [.22, -.22, z * .15]; tri(P0, P1, P2, CRM); tri(P0, P2, P3, CRM); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: .6 }));
    body.castShadow = true; body.position.x = -.6;
    const k = new THREE.Group(); k.add(body);
    for (const z of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(.028, 0), new THREE.MeshStandardMaterial({ color: '#1a1414', flatShading: true, roughness: .3 })); eye.position.set(.11 - .6, .045, z * .115); k.add(eye);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.007, .004, .09, 4), new THREE.MeshStandardMaterial({ color: '#e8d0b2' })); bar.position.set(.03 - .6, -.08, z * .03); bar.rotation.z = -.25; k.add(bar);   // 鬍鬚
    }
    return k;
  }
  const sculptures = [];
  for (const [y, a, n] of [[1.5, .5, 0], [2.7, .5 + Math.PI, 1]]) {
    const r = 1.0 - (y / 4) * .45;
    const holder = new THREE.Group(); holder.position.set(wm.x + Math.sin(a) * r, H + y, wm.z + Math.cos(a) * r); holder.rotation.y = a; g.add(holder);
    part(holder, cyl8, '#8a7a66', 0, 0, .14, .045, .3, .045, Math.PI / 2);              // 支架
    part(holder, cyl8, '#8a7a66', 0, 0, .02, .16, .04, .16, Math.PI / 2);               // 固定在牆上的圓座
    const k = koiSculpture(7 + n * 13); k.position.z = .36; k.scale.set(1.75, 1.3, 1.3); k.rotation.z = .06; holder.add(k);
    sculptures.push({ k, ph: n * 1.7 });
  }
  ANIM.push((t) => { for (const s of sculptures) s.k.rotation.y = Math.sin(t * .8 + s.ph) * .06; });
  const mpole = new THREE.Mesh(GEO.cyl6, mat('#d8d2c4')); mpole.scale.set(.06, 1.6, .06); mpole.position.set(wm.x, H + 5.6, wm.z); g.add(mpole);
  const mini = [['#2f7fd1', '#ffffff'], ['#e8473f', '#ffffff']].map(([c1, c2], i) => {
    const koi = new THREE.Group(); koi.position.set(wm.x, H + 6.2 - i * .5, wm.z);
    for (let k = 0; k < 4; k++) { const seg = new THREE.Mesh(GEO.cyl12, mat(k % 2 ? c2 : c1)); seg.rotation.z = Math.PI / 2; seg.position.x = .08 + k * .2 + .1; seg.scale.set(.2 - k * .03, .2, .2 - k * .03); koi.add(seg); }
    const tl = new THREE.Mesh(GEO.cone4, mat(c1)); tl.position.x = .95; tl.rotation.z = -Math.PI / 2; tl.scale.set(.25, .2, .05); koi.add(tl);
    g.add(koi); return koi;
  });
  blades.traverse((o) => { o.castShadow = true; }); g.add(blades);
  extras.blades = blades; extras.lm = g;
  ANIM.push((t) => { blades.rotation.z = -t * 1.1; mini.forEach((k, i) => { k.rotation.y = -.9 + Math.sin(t * .9 + i) * .25; k.rotation.z = Math.sin(t * 2.1 + i) * .1; }); });
  extras.windmill = wm;
  // 花田（點綴）：一大片彩色花田
  const cols = ['#ff7aa2', '#ffd25a', '#ffffff', '#b18cf0', '#ff9a3d'];
  B.push(7.0, H, 4.3, -.55);
  for (let r = 0; r < 5; r++) {
    B.add(GEO.box, '#7a5a3a', 0, .06, r * .62 - 1.2, 0, 0, 0, 3.6, .1, .34);
    for (let i = 0; i < 9; i++) { B.add(GEO.cyl6, '#4f9a3c', -1.6 + i * .4, .25, r * .62 - 1.2, 0, 0, 0, .04, .34, .04); B.add(GEO.ball0, cols[(r + i) % 5], -1.6 + i * .4, .46, r * .62 - 1.2, 0, 0, 0, .26); }
  }
  B.pop();
  extras.flowerField = new THREE.Vector3(7.0, H, 4.3);
  // 市集攤位＋燈串
  const stallCols = ['#e8762b', '#2f7fd1', '#dc4848'];
  stallCols.forEach((c, i) => {
    const a = -.75 + i * .3, r = 6.6;                 // 三攤並排在工作島橋與運動島橋之間，讓出兩座橋的通道
    B.push(Math.cos(a) * r, H, Math.sin(a) * r, -a - Math.PI / 2);
    for (const [x, z] of [[-.9, -.5], [.9, -.5], [-.9, .5], [.9, .5]]) B.add(GEO.box, WOOD2, x, 1.05, z, 0, 0, 0, .1, 2.1, .1);
    B.add(GEO.box, WOOD, 0, .45, 0, 0, 0, 0, 1.9, .9, 1.0);
    for (let k = 0; k < 5; k++) B.add(GEO.box, k % 2 ? WHITE : c, -.8 + k * .4, 2.15, 0, -.2, 0, 0, .4, .06, 1.4);
    for (let k = 0; k < 3; k++) B.add(GEO.ball0, ['#ffd25a', '#ff7aa2', '#7fd06a'][k], -.5 + k * .5, 1.0, -.1, 0, 0, 0, .3);
    B.add(GEO.box, 'lamp', -.95, 1.95, .55, 0, 0, 0, .14, .14, .14); B.add(GEO.box, 'lamp', .95, 1.95, .55, 0, 0, 0, .14, .14, .14);
    NIGHT.glows.push(new THREE.Vector3(-.95, 1.95, .55).applyMatrix4(B.m), new THREE.Vector3(.95, 1.95, .55).applyMatrix4(B.m));
    B.pop();
  });
  extras.market = new THREE.Vector3(Math.cos(-.45) * 5.3, H, Math.sin(-.45) * 5.3);
}

// 每座島外圈要放的東西（角度相對於連往中央島的橋）；'none' 是拿掉的房子，保留位置讓其他物件角度不變
const OUTER = {
  food:    ['none', 'treeR', 'bed', 'bench', 'treeP', 'lamp', 'crate', 'treeR', 'sign', 'bush'],
  craft:   ['none', 'treeP', 'bed', 'lamp', 'treeR', 'bench', 'well', 'treeR', 'sign', 'fence'],
  puzzle:  ['none', 'treeR', 'fence', 'bench', 'treeP', 'lamp', 'none', 'bed', 'treeR', 'sign'],
  sport:   ['none', 'treeP', 'bench', 'bed', 'lamp', 'treeR', 'crate', 'treeP', 'sign', 'bush'],
  recycle: ['none', 'treeR', 'bed', 'well', 'treeP', 'lamp', 'bench', 'treeR', 'sign', 'fence'],
  center:  ['none', 'treeR', 'lamp', 'bench', 'treeP', 'none', 'lamp', 'treeR', 'bench', 'treeP', 'lamp', 'bed', 'crate', 'treeR', 'lamp', 'sign'],
};

// ------------------------------------------------------------------ 可走範圍（依實際模型算出來，不再用手畫的圓）
// 把島上所有模型在「身體高度」（離地 0.2～1.15）的部分投影到 0.2 格的地圖上，當作障礙；
// 再算出每一格離最近障礙或島緣有多遠。漫遊的玩家、居民、動物、送貨員都用同一張地圖。
const CELL = .2, BAND0 = .42, BAND1 = 1.15;     // 腳踝高度以下（小石頭、草）可以跨過去
function walkGrid(info, group, skip) {
  const half = info.R * 1.2, N = Math.ceil(half * 2 / CELL), occ = new Uint8Array(N * N);   // 0 島外 1 可走 2 障礙
  const idx = (x, z) => { const i = Math.floor((x + half) / CELL), j = Math.floor((z + half) / CELL); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -half + (i + .5) * CELL, z = -half + (j + .5) * CELL;
    if (Math.hypot(x, z) < info.top(Math.atan2(z, x)) * .985) occ[j * N + i] = 1;
  }
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), m = new THREE.Matrix4();
  const skipSet = new Set(); for (const s of skip) s && s.traverse((o) => skipSet.add(o));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  const y0 = H + BAND0, y1 = H + BAND1;
  group.traverse((o) => {
    if (!o.isMesh || skipSet.has(o) || !o.visible) return;
    const pos = o.geometry.attributes.position, ix = o.geometry.index; if (!pos) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const n = ix ? ix.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const i0 = ix ? ix.getX(t) : t, i1 = ix ? ix.getX(t + 1) : t + 1, i2 = ix ? ix.getX(t + 2) : t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m); b.fromBufferAttribute(pos, i1).applyMatrix4(m); c.fromBufferAttribute(pos, i2).applyMatrix4(m);
      if (Math.max(a.y, b.y, c.y) < y0 || Math.min(a.y, b.y, c.y) > y1) continue;
      const k = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / (CELL * .45)));
      for (let u = 0; u <= k; u++) for (let v = 0; v <= k - u; v++) {
        p.copy(a).addScaledVector(b.clone().sub(a), u / k).addScaledVector(c.clone().sub(a), v / k);
        if (p.y < y0 || p.y > y1) continue;
        const q = idx(p.x, p.z); if (q >= 0 && occ[q]) occ[q] = 2;
      }
    }
  });
  // 牆與牆中間被圍起來的格子（例如房子內部）也算障礙：從島緣與可走大區塊往內灌水，灌不到的就是封閉的
  const reach = new Uint8Array(N * N), q = [];
  // 種子：島上離中心最近的一塊開放格（橋頭方向的外圈）
  for (const ang of info.bridgeAngles) { const r0 = info.top(ang) * .9, s = idx(Math.cos(ang) * r0, Math.sin(ang) * r0); if (s >= 0 && occ[s] === 1 && !reach[s]) { reach[s] = 1; q.push(s); } }
  while (q.length) { const s = q.pop(), i = s % N, j = (s / N) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const t = jj * N + ii; if (!reach[t] && occ[t] === 1) { reach[t] = 1; q.push(t); } } }
  for (let s = 0; s < N * N; s++) if (occ[s] === 1 && !reach[s]) occ[s] = 3;           // 3 = 封閉區（走不進去的地方）
  // 距離場：每一格離最近「不可走格」的距離（公尺）
  const dist = new Float32Array(N * N).fill(1e9);
  const open = (s) => occ[s] === 1;
  for (let s = 0; s < N * N; s++) if (!open(s)) dist[s] = 0;
  const D1 = CELL, D2 = CELL * Math.SQRT2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const s = j * N + i; if (!dist[s]) continue; let d = dist[s];
    if (i > 0) d = Math.min(d, dist[s - 1] + D1); if (j > 0) d = Math.min(d, dist[s - N] + D1); if (i > 0 && j > 0) d = Math.min(d, dist[s - N - 1] + D2); if (i < N - 1 && j > 0) d = Math.min(d, dist[s - N + 1] + D2);
    if (i === 0 || j === 0 || i === N - 1 || j === N - 1) d = Math.min(d, CELL * .5); dist[s] = d; }
  for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) { const s = j * N + i; if (!dist[s]) continue; let d = dist[s];
    if (i < N - 1) d = Math.min(d, dist[s + 1] + D1); if (j < N - 1) d = Math.min(d, dist[s + N] + D1); if (i < N - 1 && j < N - 1) d = Math.min(d, dist[s + N + 1] + D2); if (i > 0 && j < N - 1) d = Math.min(d, dist[s + N - 1] + D2); dist[s] = d; }
  const clear = (x, z) => { const s = idx(x, z); return s < 0 ? 0 : dist[s]; };
  // 居民與動物的散步路線：沿著原本的環狀小路，遇到障礙就往內或往外找最近的空地，保證每一段都走得通
  const NL = 144, loopR = new Float32Array(NL);
  const want = info.ring, minR = 1.0;
  for (let k = 0; k < NL; k++) {
    const th = k / NL * TAU, maxR = info.top(th) * .9;
    let best = -1, bestCost = 1e9, wide = want, wideCl = -1;
    for (let rr = minR; rr <= maxR; rr += .1) {
      const cl = clear(Math.cos(th) * rr, Math.sin(th) * rr);
      if (cl > wideCl) { wideCl = cl; wide = rr; }
      if (cl < .55) continue;
      const cost = Math.abs(rr - want) - Math.min(cl, .9) * .3; if (cost < bestCost) { bestCost = cost; best = rr; }
    }
    loopR[k] = best >= 0 ? best : wide;                 // 空間不夠寬時，走最寬的那一條縫
  }
  for (let it = 0; it < 3; it++) { const cp = loopR.slice(); for (let k = 0; k < NL; k++) { const v = (cp[(k + NL - 1) % NL] + cp[k] * 2 + cp[(k + 1) % NL]) / 4; const th = k / NL * TAU; if (clear(Math.cos(th) * v, Math.sin(th) * v) >= Math.min(.5, clear(Math.cos(th) * loopR[k], Math.sin(th) * loopR[k]))) loopR[k] = v; } }
  const radAt = (th) => { const f = (((th % TAU) + TAU) % TAU) / TAU * NL, k0 = Math.floor(f) % NL, k1 = (k0 + 1) % NL, t = f - Math.floor(f); return loopR[k0] * (1 - t) + loopR[k1] * t; };
  return { N, half, cell: CELL, occ, dist, clear, radAt, idx };
}

// ------------------------------------------------------------------ 建造一座島
function buildIsland(id, scene, quality) {
  const L = LAYOUT[id], P = PAL[id] || PAL.center, isC = id === 'center';
  const group = new THREE.Group(); group.position.set(L.x, 0, L.z); scene.add(group);
  const rand = rng(Math.floor(L.seed * 7777));
  const terr = terrain(L, P); group.add(terr);
  const foam = foamRing(L); group.add(foam);
  const B = new Builder();
  const info = { id, R: L.R, seed: L.seed, pos: new THREE.Vector3(L.x, 0, L.z), group, colliders: [], ring: isC ? L.R * .52 : L.R * .56, extras: {}, pick: [terr] };
  // 橋的方向（往中央島）；中央島則是五條放射路
  const bridgeAngles = isC ? ['food', 'craft', 'puzzle', 'sport', 'recycle'].map((k) => Math.atan2(LAYOUT[k].z, LAYOUT[k].x)) : [Math.atan2(-L.z, -L.x)];
  info.bridgeAngles = bridgeAngles;
  const lmGroup = new THREE.Group(); group.add(lmGroup);
  ({ food: landmarkFood, craft: landmarkCraft, puzzle: landmarkPuzzle, sport: landmarkSport, recycle: landmarkRecycle, center: landmarkCenter })[id](B, lmGroup, P, info.extras);
  info.colliders.push({ x: 0, z: isC ? 0 : -.3, r: isC ? 3.0 : 2.6 });
  if (isC) { info.colliders.push({ x: info.extras.windmill.x, z: info.extras.windmill.z, r: 1.2 }, { x: 7.0, z: 4.3, r: 2.0 }, { x: 3.6, z: -2.6, r: .4 }); }
  // 手作體驗二島西側是「鯉魚號碼頭」：石板小路、物件與草叢都要讓出通往碼頭的路
  const pierA = id === 'puzzle' ? bridgeAngles[0] + Math.PI : null; info.pierA = pierA;
  const corridorA = pierA == null ? bridgeAngles : [...bridgeAngles, pierA];
  stonePath(B, P, info.ring, rand, corridorA, L.R, L.seed, isC ? 1.1 : .95);
  // 外圈物件：避開橋的方向與正面標籤區
  const items = OUTER[id];
  const startA = bridgeAngles[0];
  const occupied = [];
  items.forEach((it, i) => {
    let a = startA + .55 + i / items.length * (TAU - 1.1);
    if (isC) a = startA + .38 + i / items.length * TAU;
    if (corridorA.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < .3)) a += .32;
    const edge = shapeR(a, L.seed) * L.R;
    const r = it.startsWith('house') ? edge * .76 : it === 'fence' || it === 'bed' ? edge * .8 : edge * .82;
    if (isC && Math.hypot(Math.cos(a) * r - 7.0, Math.sin(a) * r - 4.3) < 2.6) return;            // 讓出花田
    if (isC && Math.hypot(Math.cos(a) * r - info.extras.windmill.x, Math.sin(a) * r - info.extras.windmill.z) < 2.2) return;
    if (isC && Math.hypot(Math.cos(a) * r - Math.cos(-.45) * 6.6, Math.sin(a) * r - Math.sin(-.45) * 6.6) < 3.0) return; // 讓出市集
    // 讓出每座橋的通道：物件外緣離橋的中線至少 1.1（玩家肩寬＋一點餘裕），不夠就往旁邊挪，挪不開就不放
    const [kind, arg] = it.split(':');
    if (kind === 'none') return;                      // 原本的房子與爆米花攤已拿掉：攤位改由實體攤子呈現，讓出步道
    const rad = { popcorn: .75, house: 1.7, treeR: 1.0, treeP: .95, bed: 1.25, fence: 1.45, bench: .75, crate: .75, sign: .45, well: .95, lamp: .35, bush: .65 }[kind] || .8;
    const blocksBridge = (aa) => corridorA.some((b) => { const d = Math.atan2(Math.sin(aa - b), Math.cos(aa - b)); return Math.cos(d) > 0 && Math.abs(Math.sin(d)) * r < rad + 1.1; });
    if (blocksBridge(a)) { let ok = false; for (let k = 1; k <= 12 && !ok; k++) for (const sg of [1, -1]) { if (!blocksBridge(a + sg * k * .05)) { a += sg * k * .05; ok = true; break; } } if (!ok) return; }
    const x = Math.cos(a) * r, z = Math.sin(a) * r, face = -a - Math.PI / 2;
    B.push(x, H, z, face);
    if (kind === 'house') { house(B, arg, '#fbf3e3', .92); info.colliders.push({ x, z, r: 1.55 }); info.extras.house = info.extras.house || new THREE.Vector3(x, H, z); }
    else if (kind === 'treeR' || kind === 'treeP') {
      // 每棵樹是獨立的小模型，之後攤子擋到招牌時可以把樹移開
      const TB = new Builder(); if (kind === 'treeR') treeRound(TB, .85 + rand() * .3, i); else treePine(TB, .9 + rand() * .3);
      const tm = TB.build(MAT_FOR, true); tm.position.set(x, H, z); tm.rotation.y = face; group.add(tm);
      (info.trees = info.trees || []).push(tm); info.colliders.push({ x, z, r: .45 });
    }
    else if (kind === 'bed') { flowerBed(B, 2.0, .9); info.colliders.push({ x, z, r: 1.1 }); }
    else if (kind === 'fence') { fence(B, 2.6); bush(B, .8); info.colliders.push({ x, z, r: 1.2 }); }
    else if (kind === 'bench') { bench(B); info.colliders.push({ x, z, r: .6 }); }
    else if (kind === 'popcorn') { popcornStand(B); info.colliders.push({ x, z, r: .6 }); }
    else if (kind === 'crate') { crate(B, 1); B.push(.6, 0, .2, .4); crate(B, .7); B.pop(); info.colliders.push({ x, z, r: .6 }); }
    else if (kind === 'sign') { signBoard(B, P.main || '#3f7d3a'); info.colliders.push({ x, z, r: .3 }); }
    else if (kind === 'well') { well(B); info.colliders.push({ x, z, r: .8 }); }
    else if (kind === 'lamp') { lampPost(B); info.colliders.push({ x, z, r: .2 }); }
    else if (kind === 'bush') { bush(B, 1.1); info.colliders.push({ x, z, r: .5 }); }
    B.pop(); occupied.push(a);
  });
  // 草地上的小石頭與邊緣草叢
  rocks(B, rand, isC ? 8 : 5, .66, .74, L.seed, L.R);
  edgeGreens(B, rand, L, corridorA);
  // 碼頭與小船（背向中央島的一側）
  const dockA = bridgeAngles[0] + (isC ? Math.PI / 5 : Math.PI) + (pierA != null ? -1.3 : 0);   // 益智島的小船挪到旁邊，讓出鯉魚號碼頭
  const boatAt = dock(B, L, dockA);
  const statics = B.build(MAT_FOR, true); group.add(statics); info.pick.push(...statics.children);
  const boat = rowBoat(isC ? '#2f7fd1' : (P.main || '#2f7fd1')); boat.position.set(boatAt.x, .05, boatAt.z); boat.rotation.y = boatAt.ry; group.add(boat);
  info.boat = boat;
  // 撿貝殼的位置（沙灘上）
  const sa = dockA + 1.0, sr = shapeR(sa, L.seed) * L.R * 1.12;
  info.shellSpot = new THREE.Vector3(L.x + Math.cos(sa) * sr, .44, L.z + Math.sin(sa) * sr);
  info.foam = foam;
  info.top = (th) => shapeR(th, L.seed) * L.R * .95;
  info.walk = walkGrid(info, group, [terr, foam, boat]);
  return info;
}

// ------------------------------------------------------------------ 鯉魚號碼頭（手作體驗二島西側）：階梯從島頂走下去，木棧道伸進湖裡
export const PIER_Y = .8, GANG = 1.65;           // 棧道高度、跳板長度
function buildPier(scene, I) {
  const A = I.pierA, d = new THREE.Vector3(Math.cos(A), 0, Math.sin(A)), s = new THREE.Vector3(Math.sin(A), 0, -Math.cos(A));
  const rTop = I.top(A), E = I.pos.clone().addScaledVector(d, rTop);
  const ST0 = -.5, ST1 = 2.4, P1 = 10.5, PW = .9;               // 沿 d 的距離：階梯 ST0→ST1，棧道 ST1→P1，半寬 PW
  const B = new Builder();
  B.push(E.x, 0, E.z, Math.atan2(d.x, d.z));                    // 區域座標：+z 沿碼頭往外，+x 朝 s（停船那一側）
  // 階梯（10 階）＋兩側扶手
  const nSt = 10;
  for (let i = 0; i < nSt; i++) { const t = (i + .5) / nSt, z = ST0 + (ST1 - ST0) * t, y = H + (PIER_Y - H) * t; B.add(GEO.box, i % 2 ? WOOD : WOOD3, 0, y - .06, z, 0, 0, 0, 1.5, .12, (ST1 - ST0) / nSt + .02); B.add(GEO.box, WOOD2, 0, (y + PIER_Y) / 2 - .3, z, 0, 0, 0, 1.3, Math.max(.1, y - PIER_Y + .3), .2); }
  for (const x of [-.78, .78]) { for (let i = 0; i <= 2; i++) { const t = i / 2, z = ST0 + (ST1 - ST0) * t, y = H + (PIER_Y - H) * t; B.add(GEO.box, WOOD2, x, y + .35, z, 0, 0, 0, .1, .7, .1); }
    const len = Math.hypot(ST1 - ST0, H - PIER_Y); B.add(GEO.box, WOOD, x, (H + PIER_Y) / 2 + .68, (ST0 + ST1) / 2, Math.atan2(H - PIER_Y, ST1 - ST0), 0, 0, .08, .08, len); }
  // 木棧道
  const n = Math.round((P1 - ST1) / .42);
  for (let i = 0; i < n; i++) B.add(GEO.box, i % 2 ? WOOD : WOOD3, 0, PIER_Y - .06, ST1 + (i + .5) * (P1 - ST1) / n, 0, 0, 0, PW * 2, .12, (P1 - ST1) / n - .03);
  for (let z = ST1 + .3; z <= P1; z += 1.6) for (const x of [-PW + .1, PW - .1]) B.add(GEO.cyl6, WOOD2, x, PIER_Y / 2 - .4, z, 0, 0, 0, .18, PIER_Y + .9, .18);
  // 欄杆：只有北側與末端（南側要停船）
  for (let z = ST1; z <= P1; z += 1.2) B.add(GEO.box, WOOD2, -PW + .05, PIER_Y + .35, z, 0, 0, 0, .08, .7, .08);
  B.add(GEO.box, WOOD, -PW + .05, PIER_Y + .68, (ST1 + P1) / 2, 0, 0, 0, .07, .07, P1 - ST1);
  for (const x of [-.6, 0, .6]) B.add(GEO.box, WOOD2, x, PIER_Y + .35, P1 - .05, 0, 0, 0, .08, .7, .08);
  B.add(GEO.box, WOOD, 0, PIER_Y + .68, P1 - .05, 0, 0, 0, PW * 2, .07, .07);
  // 繫船柱
  for (const z of [ST1 + 1.0, ST1 + 3.2, P1 - .8]) { B.add(GEO.cyl8, '#4a4f57', PW - .2, PIER_Y + .18, z, 0, 0, 0, .22, .36, .22); B.add(GEO.cyl8, '#4a4f57', PW - .2, PIER_Y + .38, z, 0, 0, 0, .3, .06, .3); }
  // 碼頭燈
  B.add(GEO.cyl6, '#3b3f46', -PW + .1, PIER_Y + 1.1, ST1 + .2, 0, 0, 0, .08, 2.2, .08); B.add(GEO.box, 'lamp', -PW + .1, PIER_Y + 2.25, ST1 + .2, 0, 0, 0, .22, .22, .22);
  NIGHT.glows.push(new THREE.Vector3(-PW + .1, PIER_Y + 2.25, ST1 + .2).applyMatrix4(B.m));
  B.pop();
  const g = B.build(MAT_FOR, true); scene.add(g);
  // 招牌「鯉魚號碼頭」
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => { const x = cv.getContext('2d'); x.fillStyle = '#fbf3e6'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#c73a1f'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 118);
    x.fillStyle = '#c73a1f'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = "900 70px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans CJK TC', sans-serif"; x.fillText('鯉魚號碼頭', 256, 68); tex.needsUpdate = true; };
  draw(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  const sign = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .55), new THREE.MeshStandardMaterial({ map: tex, roughness: .8 })); board.position.y = 2.3; sign.add(board);
  const back = board.clone(); back.rotation.y = Math.PI; sign.add(back);
  for (const x of [-1.0, 1.0]) { const post = new THREE.Mesh(GEO.cyl6, mat(WOOD2)); post.scale.set(.1, 2.6, .1); post.position.set(x, 1.3, 0); sign.add(post); }
  sign.position.copy(E).addScaledVector(d, ST1 + .1).setY(PIER_Y); sign.rotation.y = Math.atan2(s.x, s.z) + Math.PI / 2; sign.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(sign);
  // 跳板：一端鉸在棧道南緣，停船時放下
  const SLIP = ST1 + 4.6 - 2.6, gangPivot = E.clone().addScaledVector(d, SLIP).addScaledVector(s, PW).setY(PIER_Y);
  const gang = new THREE.Group(); gang.position.copy(gangPivot); gang.rotation.y = Math.atan2(d.x, d.z);
  const plank = new THREE.Group(); gang.add(plank);
  { const pb = new Builder(); pb.add(GEO.box, WOOD3, GANG / 2, .02, 0, 0, 0, 0, GANG, .08, .9); for (let k = 0; k < 4; k++) pb.add(GEO.box, WOOD2, .2 + k * .42, .08, 0, 0, 0, 0, .06, .04, .9); for (const z of [-.45, .45]) pb.add(GEO.box, WOOD, GANG / 2, .4, z, 0, 0, 0, GANG, .05, .05); plank.add(pb.build(MAT_FOR, true)); }
  scene.add(gang);
  // 停船位置：船中心在棧道南側，船頭朝外（d）
  const berth = { pos: E.clone().addScaledVector(d, ST1 + 4.6).addScaledVector(s, PW + .85 + 2.05), yaw: Math.atan2(d.x, d.z) };   // 胸鰭也不碰到棧道
  // 等船的位置（島頂、階梯上方）
  const queue = [-.75, 0, .75].map((k) => { const q = E.clone().addScaledVector(d, -1.4).addScaledVector(s, k); q.y = H;
    for (let i = 0; i < 12 && I.walk.clear(q.x - I.pos.x, q.z - I.pos.z) < .3; i++) q.addScaledVector(d, -.25); return q; });
  // 可走面：階梯（由島頂斜下到棧道）、棧道
  const along = (x, z) => { const dx = x - E.x, dz = z - E.z; return { a: dx * d.x + dz * d.z, l: dx * s.x + dz * s.z }; };
  const surfaces = [
    (x, z) => { const { a, l } = along(x, z); if (a < ST0 - .1 || a > ST1 || Math.abs(l) > .6) return null; return H + (PIER_Y - H) * clamp((a - ST0) / (ST1 - ST0), 0, 1); },
    (x, z) => { const { a, l } = along(x, z); if (a < ST1 - .05 || a > P1 - .3 || Math.abs(l) > PW - .25) return null; return PIER_Y; },
  ];
  return { E, d, s, ST0, ST1, P1, PW, SLIP, GANG, gang, plank, berth, queue, surfaces, along };
}

// ------------------------------------------------------------------ 橋
function buildBridge(scene, from, to) {
  const a = Math.atan2(to.pos.z - from.pos.z, to.pos.x - from.pos.x);
  const p0 = from.pos.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(from.top(a) * .985));
  const b = a + Math.PI;
  const p1 = to.pos.clone().add(new THREE.Vector3(Math.cos(b), 0, Math.sin(b)).multiplyScalar(to.top(b) * .985));
  const len = p0.distanceTo(p1), B = new Builder();
  B.push(p0.x, 0, p0.z, -a + Math.PI / 2);
  const n = Math.ceil(len / .42);
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = H + Math.sin(t * Math.PI) * .9;
    B.add(GEO.box, i % 2 ? WOOD : WOOD3, 0, y, t * len, 0, 0, 0, 1.7, .12, .38);
    if (i % 3 === 0) for (const x of [-.85, .85]) B.add(GEO.box, WOOD2, x, y + .38, t * len, 0, 0, 0, .1, .8, .1);
  }
  for (const x of [-.85, .85]) for (let i = 0; i < n; i += 3) {
    const t0 = i / n, t1 = Math.min(1, (i + 3) / n), y0 = H + Math.sin(t0 * Math.PI) * .9 + .72, y1 = H + Math.sin(t1 * Math.PI) * .9 + .72;
    const dz = (t1 - t0) * len; B.add(GEO.box, WOOD3, x, (y0 + y1) / 2, (t0 + t1) / 2 * len, -Math.atan2(y1 - y0, dz), 0, 0, .08, .08, Math.hypot(dz, y1 - y0));
  }
  for (const t of [.25, .5, .75]) for (const x of [-.7, .7]) B.add(GEO.cyl6, WOOD2, x, (H + Math.sin(t * Math.PI) * .9) / 2 - .3, t * len, 0, 0, 0, .2, H + Math.sin(t * Math.PI) * .9 + .6, .2);
  B.pop();
  const m = B.build(MAT_FOR, true); scene.add(m);
  return { p0, p1, len, a, to: to.id };
}

// ------------------------------------------------------------------ 天空、海、遠山
function makeSky(scene) {
  const geo = new THREE.SphereGeometry(520, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C('#5fb3f0') }, hor: { value: C('#cfeafc') }, bot: { value: C('#9fd3ea') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0),0.55)) : mix(hor, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor=vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(geo, m); sky.renderOrder = -10; scene.add(sky);
  // 星星
  const n = 900, pos = new Float32Array(n * 3), r = rng(91);
  for (let i = 0; i < n; i++) { const th = r() * TAU, y = .12 + r() * .88, s = Math.sqrt(1 - y * y); pos.set([Math.cos(th) * s * 480, y * 480, Math.sin(th) * s * 480], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,244,214,1)', 'rgba(255,210,140,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  sun.scale.setScalar(90); scene.add(sun);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(235,242,255,1)', 'rgba(170,190,255,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0 }));
  moon.scale.setScalar(55); scene.add(moon);
  return { sky, m, stars, sun, moon };
}
function makeSea(scene, quality) {
  const seg = quality === 'low' ? 70 : 140;
  const geo = new THREE.PlaneGeometry(900, 900, seg, seg); geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color: '#3fa6c9', flatShading: true, roughness: .38, metalness: .04, transparent: true, opacity: .96 });
  const uni = { uTime: { value: 0 }, uAmp: { value: 1 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime; sh.uniforms.uAmp = uni.uAmp;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = sin(position.x*.16+uTime*.9)*.22 + cos(position.z*.13+uTime*.7)*.2 + sin((position.x+position.z)*.31+uTime*1.6)*.07;
        transformed.y += w*uAmp;`);
  };
  const sea = new THREE.Mesh(geo, m); sea.receiveShadow = true; sea.position.y = -.05; scene.add(sea);
  return { sea, m, uni };
}

// ------------------------------------------------------------------ 時段（白天／黃昏／夜晚）
const KEYS = [
  { h: 0,    top: '#0b1736', hor: '#283a63', sun: '#9fb4ff', si: .55, hs: '#5a6d9c', hg: '#1c2433', hi: .55, fog: '#1d2b47', sea: '#1b4466', exp: .95 },
  { h: 4.6,  top: '#0f1d42', hor: '#33406e', sun: '#9fb4ff', si: .5,  hs: '#5a6d9c', hg: '#1c2433', hi: .55, fog: '#26355a', sea: '#1b4466', exp: .95 },
  { h: 5.8,  top: '#3b5a96', hor: '#f3a77e', sun: '#ffb27a', si: 1.0, hs: '#c9a7b5', hg: '#5a4a4a', hi: .75, fog: '#e2b39f', sea: '#3a7393', exp: 1.0 },
  { h: 7.5,  top: '#4fb0f0', hor: '#d3edfd', sun: '#fff1d6', si: 2.7, hs: '#e3f2ff', hg: '#cdb991', hi: 1.05, fog: '#cfe8f7', sea: '#3fa6c9', exp: 1.0 },
  { h: 16,   top: '#4aa9ec', hor: '#d9eefc', sun: '#fff0d0', si: 2.5, hs: '#e3f2ff', hg: '#cdb991', hi: 1.0, fog: '#d3e9f6', sea: '#3fa3c6', exp: 1.0 },
  { h: 18.1, top: '#4d65a6', hor: '#ffad6b', sun: '#ffa564', si: 1.7, hs: '#e9c3c8', hg: '#4a5a72', hi: .85, fog: '#e9b49a', sea: '#3f78b0', exp: 1.04 },
  { h: 19.6, top: '#16234d', hor: '#4a4877', sun: '#9fb4ff', si: .55, hs: '#5b6aa0', hg: '#1c2433', hi: .55, fog: '#2b3858', sea: '#1d4669', exp: .96 },
  { h: 24,   top: '#0b1736', hor: '#283a63', sun: '#9fb4ff', si: .55, hs: '#5a6d9c', hg: '#1c2433', hi: .55, fog: '#1d2b47', sea: '#1b4466', exp: .95 },
];
export function periodOf(h) { return h >= 6 && h < 16 ? 'day' : (h >= 16 && h < 19) || (h >= 5 && h < 6) ? 'dusk' : 'night'; }
export const PERIOD_NAME = { day: '白天', dusk: '黃昏', night: '夜晚' };
function sample(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0; while (i < KEYS.length - 1 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[Math.min(i + 1, KEYS.length - 1)], t = b.h === a.h ? 0 : smooth((h - a.h) / (b.h - a.h));
  const o = {};
  for (const k of Object.keys(a)) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : C(a[k]).lerp(C(b[k]), t);
  return o;
}
export function nightFactor(h) {
  h = ((h % 24) + 24) % 24;
  if (h >= 19.4 || h < 4.8) return 1;
  if (h >= 17.8) return smooth((h - 17.8) / 1.6);
  if (h < 6.4) return 1 - smooth((h - 4.8) / 1.6);
  return 0;
}
const THEME_TINT = { forest: null, tundra: { c: '#d8e4cf', k: .08 }, deep: { c: '#14261b', k: .42 } };

// ------------------------------------------------------------------ 建立世界
export function createWorld(canvas, opts) {
  const quality = opts.quality;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cfe8f7', 200, 760);
  const camera = new THREE.PerspectiveCamera(46, 1, .3, 1400);
  const hemi = new THREE.HemisphereLight('#e3f2ff', '#cdb991', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6); sun.castShadow = true;
  const sm = opts.mobile ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 10, far: 220 });
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .04; scene.add(sun); scene.add(sun.target);
  const skyO = makeSky(scene), seaO = makeSea(scene, quality), scenery = makeScenery(scene, { quality, mobile: !!opts.mobile });

  NIGHT.glows.length = 0; ANIM.length = 0;
  const ids = ['center', 'food', 'craft', 'puzzle', 'sport', 'recycle'];
  const islands = {}; for (const id of ids) islands[id] = buildIsland(id, scene, quality);
  const bridges = ['food', 'craft', 'puzzle', 'sport', 'recycle'].map((id) => buildBridge(scene, islands.center, islands[id]));
  const pier = buildPier(scene, islands.puzzle);
  // 夜燈光暈（加法混合 Sprite）＋最多 2 盞 PointLight
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  const glows = new THREE.Group(); scene.add(glows);
  scene.updateMatrixWorld(true);
  return finishWorld({ renderer, scene, camera, hemi, sun, skyO, seaO, scenery, islands, bridges, pier, surfaces: [...pier.surfaces], glowMat, glows, quality, opts });
}

function finishWorld(W) {
  const { scene, islands, glowMat, glows } = W;
  // 把 lamp 材質的每個小方塊當作燈泡位置：依頂點群組計算中心
  scene.traverse((o) => {
    if (!o.isMesh || o.material !== lampMat) return;
    const p = o.geometry.attributes.position, n = p.count;
    for (let i = 0; i < n; i += 36) {      // 每個方塊 36 個頂點（非索引）
      const c = new THREE.Vector3(); for (let k = 0; k < 36; k++) c.add(new THREE.Vector3().fromBufferAttribute(p, i + k)); c.multiplyScalar(1 / 36);
      o.localToWorld(c);
      const s = new THREE.Sprite(glowMat); s.position.copy(c); s.scale.setScalar(2.4); glows.add(s);
    }
  });
  const pl1 = new THREE.PointLight('#ffcf73', 0, 22, 1.6); pl1.position.set(0, H + 3, 1.5); scene.add(pl1);
  const pl2 = new THREE.PointLight('#ffcf73', 0, 16, 1.6); pl2.position.copy(islands.center.extras.market).add(new THREE.Vector3(0, 2.5, 0)); scene.add(pl2);

  const state = { hour: 12, n: 0, theme: 'forest', themeK: 0 };
  W.state = state;
  W.anim = ANIM;
  W.setHour = (h) => { state.hour = h; applyTime(); };
  W.setTheme = (name) => { state.theme = name; applyTime(); };
  function applyTime() {
    const s = sample(state.hour), n = nightFactor(state.hour); state.n = n;
    const tint = THEME_TINT[state.theme];
    const mix = (c) => (tint ? c.clone().lerp(C(tint.c), tint.k) : c);
    W.skyO.m.uniforms.top.value.copy(mix(s.top)); W.skyO.m.uniforms.hor.value.copy(mix(s.hor)); W.skyO.m.uniforms.bot.value.copy(mix(s.sea));
    scene.fog.color.copy(mix(s.fog));
    W.seaO.m.color.copy(mix(s.sea));
    W.hemi.color.copy(s.hs); W.hemi.groundColor.copy(s.hg); W.hemi.intensity = s.hi;
    W.sun.color.copy(s.sun); W.sun.intensity = s.si;
    W.renderer.toneMappingExposure = s.exp;
    // 太陽方向：白天由東往西，夜晚改用月光
    const h = ((state.hour % 24) + 24) % 24, dayArc = (h - 6) / 12 * Math.PI;
    const up = Math.sin(dayArc);
    const dir = up > .05 ? new THREE.Vector3(-Math.cos(dayArc) * .8, Math.max(.3, up), .55) : new THREE.Vector3(Math.cos(dayArc) * .6, .75, .45);
    dir.normalize();
    W.sun.position.copy(dir).multiplyScalar(90); W.sun.target.position.set(0, 0, 0);
    W.skyO.sun.position.copy(new THREE.Vector3(-Math.cos(dayArc), Math.sin(dayArc), .45).normalize().multiplyScalar(430));
    W.skyO.sun.material.opacity = clamp(Math.sin(dayArc) * 3 + .2, 0, 1);
    W.skyO.moon.position.copy(new THREE.Vector3(Math.cos(dayArc) * .7, .62, -.5).normalize().multiplyScalar(430));
    W.skyO.moon.material.opacity = n;
    W.skyO.stars.material.opacity = n * .9;
    winMat.emissiveIntensity = n * 1.5; lampMat.emissiveIntensity = .1 + n * 2.2;
    glowMat.opacity = n * .9;
    pl1.intensity = n * 30; pl2.intensity = n * 22;
    W.scenery.setNight(n);
  }
  applyTime();

  W.resize = (w, h) => { W.renderer.setSize(w, h, false); W.camera.aspect = w / h; W.camera.updateProjectionMatrix(); };
  W.update = (t, moving) => {
    W.seaO.uni.uTime.value = t; W.seaO.uni.uAmp.value = moving ? 1 : 0;
    W.scenery.update(t, moving);
    for (const id in islands) {
      const I = islands[id];
      I.foam.material.opacity = moving ? .42 + Math.sin(t * 1.4 + I.seed) * .14 : .5;
      const s = moving ? 1 + Math.sin(t * 1.4 + I.seed) * .012 : 1; I.foam.scale.set(s, 1, s);
      if (I.boat) { I.boat.position.y = moving ? .05 + Math.sin(t * 1.3 + I.seed) * .06 : .05; I.boat.rotation.z = moving ? Math.sin(t * 1.1 + I.seed) * .05 : 0; }
    }
    if (moving) for (const f of ANIM) f(t);
  };
  // 地面高度（漫遊用）：島頂、橋面；不可走則回傳 null
  W.BODY = .24;                                   // 玩家身體半徑
  W.blockers = [];                                // 後來加上去、擋路的東西（躲貓貓的掩體）：{ x, z, r }
  W.ground = (x, z) => {
    for (const b of W.blockers) if (Math.hypot(x - b.x, z - b.z) < b.r + W.BODY) return null;
    for (const id in islands) {
      const I = islands[id], dx = x - I.pos.x, dz = z - I.pos.z, r = Math.hypot(dx, dz);
      if (r < I.top(Math.atan2(dz, dx)) * .97 && I.walk.clear(dx, dz) >= W.BODY) return H;
    }
    for (const b of W.bridges) {
      const ax = b.p1.x - b.p0.x, az = b.p1.z - b.p0.z, L2 = ax * ax + az * az;
      const t = ((x - b.p0.x) * ax + (z - b.p0.z) * az) / L2;
      if (t < -.08 || t > 1.08) continue;          // 橋頭和島邊緣重疊一小段，接縫不會卡住
      const px = b.p0.x + ax * t, pz = b.p0.z + az * t;
      if (Math.hypot(x - px, z - pz) < .72) return H + Math.sin(clamp(t, 0, 1) * Math.PI) * .9 + .06;
    }
    for (const f of W.surfaces) { const h = f(x, z); if (h != null) return h; }   // 碼頭、階梯、跳板、船尾甲板
    return null;
  };
  // 最近的可走位置：從 (x, z) 往外一圈一圈找（找不到回傳 null）
  W.nearestGround = (x, z, maxR = 40) => {
    if (W.ground(x, z) != null) return { x, z, y: W.ground(x, z) };
    for (let r = .3; r <= maxR; r += .3) {
      const n = Math.max(8, Math.round(r * 8));
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = W.ground(px, pz); if (h != null) return { x: px, z: pz, y: h }; }
    }
    return null;
  };
  return W;
}
