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
