// 共用小工具：雜訊、顏色、材質快取、幾何合併器
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// 可重現的亂數
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
const h1 = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
export function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(h1(i), h1(i + 1), u) * 2 - 1; }
export function loopNoise(theta, seed, oct = 3) { // 角度上連續的雜訊（繞一圈接得起來）
  let v = 0, a = 1, n = 0;
  for (let o = 0; o < oct; o++) {
    const k = 3 * (o + 1);
    v += a * (Math.sin(theta * k + seed * (o + 1.7)) * .5 + Math.sin(theta * (k + 2) + seed * 3.1 + o) * .5);
    n += a; a *= .5;
  }
  return v / n;
}

// 材質快取（同顏色共用一份材質）
const MATS = new Map();
export function mat(color, opt = {}) {
  const key = color + JSON.stringify(opt);
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .86, metalness: 0, ...opt }));
  return MATS.get(key);
}
export const sharedMats = MATS;

// 幾何合併器：同材質的靜態小物件合成一個 Mesh，減少 draw call
export class Builder {
  constructor() { this.parts = new Map(); this.stack = [new THREE.Matrix4()]; }
  get m() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) {
    const l = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));
    this.stack.push(this.m.clone().multiply(l)); return this;
  }
  pop() { this.stack.pop(); return this; }
  add(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    const l = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m.clone().multiply(l));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g); return this;
  }
  build(materialFor, shadow = true) {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      const geo = mergeGeometries(list, false); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, materialFor(key));
      mesh.castShadow = shadow; mesh.receiveShadow = true; group.add(mesh);
    }
    return group;
  }
}

// 靜態合併：把 root 底下「不會動」的小網格合成少數幾個，大幅減少 draw call（手機最怕 draw call 太多）
// 純色材質（沒有貼圖、不發光、不透明）把顏色寫進頂點，不同顏色也能合成同一個網格；其他材質依材質分組合併
// skip：要保留原樣的物件（會動、要點擊、會個別隱藏的），連同它們的子孫都不合併
const VC_MATS = new Map();
const plainMat = (m) => m.type === 'MeshStandardMaterial' && !m.map && !m.emissiveMap && !m.alphaMap && !m.normalMap && !m.vertexColors && !m.transparent && m.opacity === 1 && m.visible && m.emissive.r + m.emissive.g + m.emissive.b === 0 && !m.userData.dynamic;
function vcMat(m) {
  const k = [m.roughness, m.metalness, m.flatShading, m.side, m.alphaTest].join('|');
  if (!VC_MATS.has(k)) VC_MATS.set(k, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: m.roughness, metalness: m.metalness, flatShading: m.flatShading, side: m.side }));
  return VC_MATS.get(k);
}
export function batchStatic(root, skip = []) {
  const skipSet = new Set(skip); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map();
  const walk = (o) => {
    for (const c of [...o.children]) {
      if (skipSet.has(c) || c.visible === false) continue;
      if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && !Array.isArray(c.material) && c.material.visible !== false && !c.morphTargetInfluences) {
        const plain = plainMat(c.material), k = (plain ? 'vc' + vcMat(c.material).uuid : c.material.uuid) + (c.castShadow ? 1 : 0) + (c.receiveShadow ? 1 : 0);
        if (!groups.has(k)) groups.set(k, { mat: plain ? vcMat(c.material) : c.material, plain, cast: c.castShadow, recv: c.receiveShadow, list: [] });
        groups.get(k).list.push(c);
      }
      walk(c);
    }
  };
  walk(root);
  const m = new THREE.Matrix4();
  for (const G0 of groups.values()) {
    if (G0.list.length < 2) continue;
    const keepUV = !G0.plain && !!(G0.mat.map || G0.mat.emissiveMap || G0.mat.alphaMap);
    if (keepUV && G0.list.some((c) => !c.geometry.attributes.uv)) continue;
    const geos = G0.list.map((c) => {
      let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && !(keepUV && n === 'uv')) g.deleteAttribute(n);
      if (!g.attributes.normal) g.computeVertexNormals();
      m.multiplyMatrices(inv, c.matrixWorld); g.applyMatrix4(m);
      if (m.determinant() < 0) { for (const n in g.attributes) { const at = g.attributes[n], sz = at.itemSize; for (let i = 0; i < at.count; i += 3) for (let j = 0; j < sz; j++) { const t = at.array[(i + 1) * sz + j]; at.array[(i + 1) * sz + j] = at.array[(i + 2) * sz + j]; at.array[(i + 2) * sz + j] = t; } } }
      if (G0.plain) { const col = c.material.color, n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); }
      return g;
    });
    const geo = mergeGeometries(geos, false); if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, G0.mat); mesh.castShadow = G0.cast; mesh.receiveShadow = G0.recv; mesh.userData.batched = true;
    root.add(mesh);
    for (const c of G0.list) c.parent && c.parent.remove(c);
  }
  return root;
}

// 共用基本幾何（低多邊形）
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: (seg = 8) => new THREE.CylinderGeometry(.5, .5, 1, seg),
  cone: (seg = 8) => new THREE.ConeGeometry(.5, 1, seg),
  ball: (d = 1) => new THREE.IcosahedronGeometry(.5, d),
  sph: (w = 10, h = 7) => new THREE.SphereGeometry(.5, w, h),
};
export const GEO = { box: G.box, cyl6: G.cyl(6), cyl8: G.cyl(8), cyl12: G.cyl(12), cyl16: G.cyl(16), cone4: G.cone(4), cone6: G.cone(6), cone8: G.cone(8), ball0: G.ball(0), ball1: G.ball(1), sph: G.sph(), sphS: G.sph(8, 6), dode: new THREE.DodecahedronGeometry(.5, 0), torus: new THREE.TorusGeometry(.5, .12, 6, 16) };

// 光暈貼圖（夜燈、太陽、月亮、螢火蟲共用）
export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,200,120,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(.35, inner.replace(/[\d.]+\)$/, '.45)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export const C = (h) => new THREE.Color(h);
