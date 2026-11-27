// 遠景：鯉魚山（左後）、低山鞍部（中後）、瀑布山谷（右後）、最遠層淡藍灰山脊
// 地形以「沿稜線取樣」的環形網格建出：每個方位角有自己的稜線高度與稜線半徑，
// 由湖岸往稜線上升，再往後緩降；地表顏色依高度與坡度決定。
// 鯉魚山為示意地形（未取得實景稜線資料）。所有隨機都用固定種子，每次載入構圖相同。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, clamp, lerp, rng, glowTexture } from './kit.js?v=20261127m';

const D2R = Math.PI / 180;
export const SHORE = 210;            // 湖岸半徑（鏡頭水平距離永遠小於這個值）
const R_END = SHORE + 112;           // 近山環外緣
const FAR_R0 = 372, FAR_R1 = 430;    // 最遠層山脊
const PHI_V = 24 * D2R;              // 瀑布所在方位（右後方）

const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const bump = (x, w) => { const u = Math.abs(x) / w; return u >= 1 ? 0 : Math.pow(Math.cos(u * Math.PI / 2), 1.25); };
// 角度上連續、半徑上平滑的雜訊（固定）
const nz = (phi, r, s) => Math.sin(phi * 7 + s) * .5 + Math.sin(phi * 13 + r * .045 + s * 2.3) * .3 + Math.sin(phi * 23 - r * .09 + s * 4.1) * .2;
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// φ：從鏡頭預設方向看過去，正後方為 0，右為正（x>0），左為負
const phiOf = (x, z) => Math.atan2(x, -z);

// 稜線高度：鯉魚山寬厚主峰 → 往右緩降到鞍部 → 瀑布兩側山肩 → 兩側與前方為起伏低山
const HS = .74;                      // 整體山高比例（讓島群仍是第一視覺焦點）
function ridgeH(phi) { return HS * ridgeH0(phi); }
function ridgeH0(phi) {
  const a = phi / D2R;
  let h = 20 + nz(phi, 0, 1.3) * 6;                                // 一般低山
  if (Math.abs(a) > 120) h = 17 + nz(phi, 0, 2.1) * 5;             // 鏡頭背後較低
  // 鯉魚山：主峰在 -47°，左側較陡、右側（往鞍部）緩降，頂部圓肩
  const dm = a + 27;
  const carp = dm < 0 ? 68 * bump(dm, 24) : 68 * bump(dm, 30) + 8 * bump(dm - 18, 10);
  // 鞍部：-6°～14° 壓低，露出天空與水面
  const saddle = 1 - .65 * bump(a - 5, 9);
  // 瀑布山谷兩側山肩：低肩 26°、高肩 46°
  const sh = 44 * bump(a - 15.5, 7) + 54 * bump(a - 33, 11);
  h = Math.max(h * saddle, carp, sh * (1 - .55 * bump(a - 24, 4)));
  return h;
}
function ridgeR(phi) { return SHORE + 52 + nz(phi, 0, 5.2) * 9 + 8 * bump(phi / D2R + 27, 30); }

// 瀑布山谷的剖面（沿半徑）：湖岸 → 下段岩壁 → 岩棚 → 上段岩壁 → 溪溝
function valleyH(r) { return HS * valleyH0(r); }
function valleyH0(r) {
  const q = r - SHORE;
  if (q < 5.5) return lerp(-1.6, -1.1, q / 5.5);                // 落點水潭（在湖面下）
  if (q < 12) return lerp(-1.1, 17, sm(5.5, 12, q));              // 下段岩壁
  if (q < 20) return lerp(17, 18.5, (q - 12) / 8);            // 岩棚
  if (q < 28) return lerp(18.5, 36, sm(20, 28, q));           // 上段岩壁
  return lerp(36, 42, sm(28, 65, q)) - (q > 65 ? (q - 65) * .25 : 0); // 溪溝
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z), phi = phiOf(x, z);
  const H = ridgeH(phi), rr = ridgeR(phi);
  let s;
  if (r < rr) s = Math.pow(sm(SHORE - 2, rr, r), .85);
  else s = 1 - .45 * sm(rr, R_END, r);
  let h = -1.5 + (H + 1.5) * s;
  // 山坡起伏（越高越粗獷），山腳一圈淺灘
  h += nz(phi * 1.7, r, 7.7) * Math.min(6, H * .07) * sm(SHORE + 6, SHORE + 30, r);
  // 湖岸：一條緩緩露出水面的淺灘，再接上山坡（不做成堤岸）
  const beach = lerp(-1.5, 1.0, sm(SHORE - 2, SHORE + 6, r));
  h = lerp(beach, Math.max(h, beach), sm(SHORE + 3, SHORE + 14, r));
  // 瀑布山谷：|Δφ| < 1.6° 完全照剖面，4.6° 以外回到一般山坡
  const dv = Math.abs(wrap(phi - PHI_V)) / D2R;
  const w = 1 - sm(1.6, 4.6, dv);
  if (w > 0) h = lerp(h, valleyH(r), w);
  return h;
}

// 顏色：緩坡橄欖綠／林綠，陡坡暖灰岩，山腳水岸淺石色，高處略淡
const COL = {
  olive: new THREE.Color('#86a05a'), forest: new THREE.Color('#4a7444'), deep: new THREE.Color('#3a5f3e'),
  high: new THREE.Color('#79936a'), rock: new THREE.Color('#9b8f7f'), rockD: new THREE.Color('#7c7368'),
  shore: new THREE.Color('#d6cbb0'), wet: new THREE.Color('#7fa39a'),
};
function colorAt(x, z, h, slope, out) {
  const phi = phiOf(x, z), r = Math.hypot(x, z);
  const k = clamp(.5 + nz(phi * 2.3, r * 1.3, 3.3) * .7, 0, 1);
  out.copy(COL.olive).lerp(COL.forest, k);
  if (h > 34) out.lerp(COL.high, sm(34, 80, h) * .7);
  if (r > 200 && h < 30) out.lerp(COL.deep, .25);
  const rock = sm(.42, .62, slope);
  if (rock > 0) out.lerp(k > .5 ? COL.rockD : COL.rock, rock);
  if (h < 2.2) out.lerp(COL.shore, sm(2.2, .9, h));
  if (h < .2) out.lerp(COL.wet, sm(.2, -1.2, h));
  return out;
}
function slopeAt(x, z) {
  const e = .9, hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
  const n = new THREE.Vector3(-hx, 2 * e, -hz).normalize();
  return 1 - n.y;
}

// 依方位與半徑的取樣表（瀑布附近與湖岸加密）
function angles(lowQ) {
  const out = [], base = (lowQ ? 2 : 1) * D2R, fine = (lowQ ? .6 : .3) * D2R;
  for (let a = -Math.PI; a < Math.PI - 1e-6;) {
    out.push(a);
    const nearV = Math.abs(wrap(a - PHI_V)) < 9 * D2R;
    a += nearV ? fine : base;
  }
  return out;
}
function radii(lowQ) {
  const out = [];
  for (let r = SHORE - 4; r < SHORE + 36; r += lowQ ? 2 : 1) out.push(r);
  for (let r = SHORE + 36; r <= R_END; r += lowQ ? 5 : 2.5) out.push(r);
  return out;
}

function ringGeometry(A, Rs, fnH, fnC) {
  const nA = A.length, nR = Rs.length;
  const pos = new Float32Array(nA * nR * 3), col = new Float32Array(nA * nR * 3), c = new THREE.Color();
  for (let i = 0; i < nA; i++) for (let j = 0; j < nR; j++) {
    const phi = A[i], r = Rs[j], x = Math.sin(phi) * r, z = -Math.cos(phi) * r, h = fnH(x, z, r, phi);
    const k = (i * nR + j) * 3; pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
    fnC(x, z, h, r, phi, c); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  const idx = [];
  for (let i = 0; i < nA; i++) {
    const i2 = (i + 1) % nA;
    for (let j = 0; j < nR - 1; j++) {
      const a = i * nR + j, b = i2 * nR + j, cc = i2 * nR + j + 1, d = i * nR + j + 1;
      idx.push(a, b, d, b, cc, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

// 三種樹冠：圓冠闊葉、疏鬆分枝、多層錐冠（樹幹深褐、樹冠白，乘上每棵樹的顏色）
function paint(g, color) { const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; }
function treeGeos() {
  const trunk = () => paint(new THREE.CylinderGeometry(.16, .24, 1.6, 4, 1, true).translate(0, .8, 0), '#5a4330');
  const T = (g, x, y, z, sx, sy, sz) => g.scale(sx, sy, sz).translate(x, y, z);
  const round = mergeGeometries([trunk(), paint(T(new THREE.IcosahedronGeometry(1, 0), 0, 2.5, 0, 1.35, 1.2, 1.35), '#ffffff')]);
  const sparse = mergeGeometries([trunk(),
    paint(T(new THREE.OctahedronGeometry(1, 0), -.45, 2.3, .1, .8, .6, .8), '#ffffff'),
    paint(T(new THREE.OctahedronGeometry(1, 0), .5, 2.9, -.2, .7, .55, .7), '#ffffff'),
    paint(T(new THREE.OctahedronGeometry(1, 0), 0, 3.5, .25, .55, .45, .55), '#ffffff')]);
  const conifer = mergeGeometries([trunk(),
    paint(T(new THREE.ConeGeometry(1, 1, 6, 1, true), 0, 1.9, 0, 1.25, 1.4, 1.25), '#ffffff'),
    paint(T(new THREE.ConeGeometry(1, 1, 6, 1, true), 0, 2.9, 0, .95, 1.25, .95), '#ffffff'),
    paint(T(new THREE.ConeGeometry(1, 1, 6, 1, true), 0, 3.8, 0, .62, 1.05, .62), '#ffffff')]);
  return [round, sparse, conifer];
}

function fallTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d'), r = rng(808);
  for (let i = 0; i < 64; i++) {
    const edge = Math.min(i, 63 - i) / 31;                 // 0 邊緣 → 1 中心
    const a = Math.pow(edge, .7);
    const g = x.createLinearGradient(0, 0, 0, 256);
    for (let k = 0; k <= 8; k++) { const v = .62 + r() * .38; g.addColorStop(k / 8, `rgba(${Math.round(225 + 30 * v)},${Math.round(240 + 15 * v)},255,${(a * (.45 + .55 * v)).toFixed(3)})`); }
    x.fillStyle = g; x.fillRect(i, 0, 1, 256);
  }
  // 往下的水紋
  x.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 70; k++) { x.fillStyle = `rgba(255,255,255,${.08 + r() * .14})`; x.fillRect(8 + r() * 48, r() * 256, 1 + r() * 2, 10 + r() * 40); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 貼合地形的水帶：沿 φv 由 r0 往 r1 取樣，寬 w，稍微浮在岩壁前
function ribbon(r0, r1, w, steps, lift) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const r = lerp(r0, r1, i / steps);
    for (let s = 0; s < 2; s++) {
      const dphi = (s ? 1 : -1) * (w / 2) / r, phi = PHI_V + dphi;
      const x = Math.sin(phi) * (r - lift), z = -Math.cos(phi) * (r - lift);
      pos.push(x, heightAt(Math.sin(phi) * r, -Math.cos(phi) * r) + .25, z); uv.push(s, i / steps * (Math.abs(r1 - r0) / 9));
    }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function makeScenery(scene, { quality, mobile }) {
  const lowQ = quality === 'low' || mobile;
  const group = new THREE.Group(); group.name = 'scenery';

  // 近山環（含鯉魚山、鞍部、瀑布山谷）
  const A = angles(lowQ), Rs = radii(lowQ);
  const geo = ringGeometry(A, Rs, (x, z) => heightAt(x, z), (x, z, h, r, phi, c) => colorAt(x, z, h, slopeAt(x, z), c));
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0 });
  const terrain = new THREE.Mesh(geo, terrainMat); group.add(terrain);

  // 最遠層：淡藍灰山脊，低細節、低對比，向霧色過渡
  const FA = []; for (let a = -Math.PI; a < Math.PI - 1e-6; a += (lowQ ? 3 : 1.5) * D2R) FA.push(a);
  const FR = []; for (let r = FAR_R0; r <= FAR_R1; r += lowQ ? 18 : 9) FR.push(r);
  const farH = (x, z, r, phi) => {
    const a = phi / D2R;
    let top = 54 + Math.sin(phi * 3 + 1.1) * 11 + Math.sin(phi * 7 + .4) * 8 + Math.sin(phi * 17 + 2) * 3;
    top += 22 * bump(a + 8, 30) + 18 * bump(a - 45, 30) + 14 * bump(a - 6, 12);          // 主山後方較高，稜線與前層錯開
    if (Math.abs(a) > 110) top *= .7;
    return -6 + (top + 6) * Math.sin(clamp((r - FAR_R0) / (FAR_R1 - FAR_R0), 0, 1) * Math.PI * .5 + .06);
  };
  const farC = new THREE.Color('#6d86a2'), farC2 = new THREE.Color('#5a738f');
  const farGeo = ringGeometry(FA, FR, (x, z, r, phi) => farH(x, z, r, phi), (x, z, h, r, phi, c) => c.copy(farC2).lerp(farC, clamp(h / 90, 0, 1)));
  const far = new THREE.Mesh(farGeo, new THREE.MeshLambertMaterial({ vertexColors: true })); group.add(far);

  // 樹群：固定種子，沿緩坡、溪谷、山腳成群分布；陡壁留給露岩
  const geos = treeGeos();
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 });
  const MAX = lowQ ? 750 : 2000;
  const pts = [[], [], []];
  const r = rng(2026);
  const tints = ['#4f7f45', '#3d6a3f', '#6b9150', '#2f5a3a', '#7a9a55', '#557a4c'].map((h) => new THREE.Color(h));
  let tries = 0, made = 0;
  const nClusters = lowQ ? 95 : 190;
  for (let cI = 0; cI < nClusters && made < MAX && tries < 6000; tries++) {
    // 叢中心：偏好山腳與溪谷，其次一般山坡
    const pick = r();
    let phi, rad;
    if (pick < .2) { phi = PHI_V + (r() - .5) * 18 * D2R; rad = SHORE + 8 + r() * 45; }          // 溪谷兩側
    else if (pick < .55) { phi = (r() * 2 - 1) * Math.PI; rad = SHORE + 6 + r() * 22; }          // 山腳
    else { phi = (r() * 2 - 1) * Math.PI; rad = SHORE + 20 + r() * 70; }                          // 山坡
    const cx = Math.sin(phi) * rad, cz = -Math.cos(phi) * rad, ch = heightAt(cx, cz);
    if (ch < 1.5 || slopeAt(cx, cz) > .4) continue;
    cI++;
    const n = 6 + Math.floor(r() * 12), spread = 4 + r() * 8, kind0 = Math.floor(r() * 3);
    const tint = tints[Math.floor(r() * tints.length)];
    for (let k = 0; k < n && made < MAX; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * spread, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const h = heightAt(x, z); if (h < 1.2) continue;
      const sl = slopeAt(x, z); if (sl > .5) continue;
      if (h > ridgeH(phiOf(x, z)) * .93 && r() < .55) continue;     // 稜線上間斷出現樹冠
      if (Math.abs(wrap(phiOf(x, z) - PHI_V)) < 1.4 * D2R && Math.hypot(x, z) < SHORE + 40) continue; // 水流上不種樹
      const kind = r() < .55 ? kind0 : Math.floor(r() * 3);
      const s = (1.15 + r() * 1.25) * (kind === 2 ? 1.15 : 1);
      const c = tint.clone().offsetHSL((r() - .5) * .03, (r() - .5) * .08, (r() - .5) * .1);
      pts[kind].push({ x, y: h - .7, z, s, ry: r() * TAU, c });
      made++;
    }
  }
  const dummy = new THREE.Object3D();
  const trees = pts.map((list, i) => {
    const m = new THREE.InstancedMesh(geos[i], treeMat, Math.max(1, list.length));
    list.forEach((p, k) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.ry, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); m.setColorAt(k, p.c); });
    m.count = list.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere(); group.add(m); return m;
  });

  // 瀑布：上段（溪溝 → 岩棚）、下段（岩棚 → 湖面），中間一小段岩棚溪流
  const tex = fallTexture();
  const fallMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const upper = new THREE.Mesh(ribbon(SHORE + 33, SHORE + 19, 4.4, 22, .55), fallMat);
  const ledge = new THREE.Mesh(ribbon(SHORE + 19.5, SHORE + 11.5, 3.0, 6, .25), fallMat);
  const lower = new THREE.Mesh(ribbon(SHORE + 12.5, SHORE + 4.5, 5.6, 20, .55), fallMat);
  for (const m of [upper, ledge, lower]) { m.renderOrder = 2; group.add(m); }
  // 落點：低對比水霧與窄圈漣漪
  const foot = new THREE.Vector3(Math.sin(PHI_V) * (SHORE + 4), .35, -Math.cos(PHI_V) * (SHORE + 4));
  const ledgeP = new THREE.Vector3(Math.sin(PHI_V) * (SHORE + 12.5), valleyH(SHORE + 16) + .4, -Math.cos(PHI_V) * (SHORE + 12.5));
  const mistMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,.9)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, opacity: .26 });
  const mists = [];
  const nMist = lowQ ? 3 : 6;
  for (let i = 0; i < nMist; i++) {
    const s = new THREE.Sprite(mistMat), base = i < nMist - 1 ? foot : ledgeP;
    const off = new THREE.Vector3((r() - .5) * 5, 1 + r() * 2.5, (r() - .5) * 5);
    s.position.copy(base).add(off); const sc = 7 + r() * 5; s.scale.setScalar(sc); group.add(s); mists.push({ s, base: s.position.clone(), sc, ph: r() * TAU });
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: '#eaf6fb', transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide });
  const ripples = [0, 1].map((i) => { const m = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.0, 28), ringMat.clone()); m.rotation.x = -Math.PI / 2; m.position.copy(foot).setY(.12); group.add(m); return { m, ph: i * .5 }; });

  // 遠景不參與選島射線、不投影
  group.traverse((o) => { o.raycast = () => {}; o.castShadow = false; o.receiveShadow = false; });
  scene.add(group);

  function update(t, moving) {
    if (moving) tex.offset.y = -t * .55;                      // 水紋往下流（減少動態時停住）
    mists.forEach((m) => { const k = moving ? Math.sin(t * .6 + m.ph) : 0; m.s.scale.setScalar(m.sc * (1 + k * .08)); m.s.position.y = m.base.y + (moving ? k * .4 : 0); });
    ripples.forEach((p) => { const k = moving ? (t * .45 + p.ph) % 1 : .45 + p.ph * .3; p.m.scale.setScalar(1 + k * 1.8); p.m.material.opacity = .45 * (1 - k); });
  }
  function setNight(n) { mistMat.opacity = .26 * (1 - n * .6); fallMat.color.setScalar(1 - n * .55); }
  return { group, terrain, far, trees, update, setNight, foot, heightAt };
}
