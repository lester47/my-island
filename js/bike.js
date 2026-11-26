// 🚲 腳踏車：服務台旁的借車點＋服務台島的環島自行車道（接到五座橋的橋頭）。
// 借車後在漫遊裡騎：速度比走路快，上下橋雙向都能騎；不能騎上船、熱氣球、鴨子船（要先下車）。
// 車子掛在人物身上（人物的座標系：腳底 y=0、頭在 1.16，最後整個人縮放 0.66）。
import * as THREE from 'three';
import { TAU } from './kit.js?v=20261126p';
import { H } from './world.js?v=20261126p';

export const BIKE_SPEED = 2.1;                 // 騎車速度是走路的幾倍
const LIFT = .2;                               // 坐上車座：人物抬高（人物座標）
const COLORS = ['#e4532c', '#2f7fd1', '#3e9b4f', '#f0b429', '#8a5cd0'];

const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, flatShading: true, ...o });
const DARK = m('#2a2a2a'), METAL = m('#9aa4ad', { metalness: .5, roughness: .4 }), SEAT = m('#3a2a22');
// 一台腳踏車（人物座標：前輪在 +z）
export function makeBike(color) {
  const g = new THREE.Group(), frame = m(color);
  const bar = (mat, a, b, r = .035) => { const d = b.clone().sub(a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat); o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); o.castShadow = true; g.add(o); return o; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const wheels = [];
  for (const z of [-.48, .48]) {
    const w = new THREE.Group(); w.position.set(0, .3, z); g.add(w);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(.27, .045, 6, 16), DARK); tire.rotation.y = Math.PI / 2; tire.castShadow = true; w.add(tire);
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.015, .5, .015), METAL); s.rotation.x = k / 3 * Math.PI; w.add(s); }
    wheels.push(w);
  }
  const BB = V(0, .3, -.05), SEATP = V(0, .64, -.2), HEAD = V(0, .72, .36);
  bar(frame, V(0, .3, -.48), BB); bar(frame, BB, SEATP); bar(frame, SEATP, HEAD); bar(frame, BB, HEAD, .04); bar(frame, HEAD, V(0, .3, .48)); bar(frame, V(0, .3, -.48), SEATP, .025);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.16, .05, .24), SEAT); seat.position.copy(SEATP).add(V(0, .04, 0)); g.add(seat);
  bar(METAL, HEAD, V(0, .86, .3)); bar(DARK, V(-.24, .88, .3), V(.24, .88, .3), .03);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(.3, .18, .22), m('#d9b27a')); basket.position.set(0, .82, .52); basket.castShadow = true; g.add(basket);
  // 踏板：繞著五通轉
  const crank = new THREE.Group(); crank.position.copy(BB); g.add(crank);
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(.03, .16, .03), METAL); a.position.set(s * .08, s * .08, 0); crank.add(a); const p = new THREE.Mesh(new THREE.BoxGeometry(.1, .025, .07), DARK); p.position.set(s * .12, s * .16, 0); crank.add(p); }
  return { g, wheels, crank, spin: 0 };
}
// 騎車姿勢：坐上車座、手扶龍頭、腳跟著踏板轉
export function poseRider(P, bike, t, rolling) {
  const a = bike.spin;
  P.legs[0].rotation.x = -.95 + Math.sin(a) * .45; P.legs[1].rotation.x = -.95 - Math.sin(a) * .45;
  P.arms[0].rotation.set(-1.15, 0, .12); P.arms[1].rotation.set(-1.15, 0, -.12);
}
export const BIKE_LIFT = LIFT;

// 借車點＋自行車道
export function createBikes(W, opts) {
  const { scene } = W, I = W.islands.center, low = !!opts.low;
  const root = new THREE.Group(); scene.add(root);
  // ---- 環島自行車道：沿著服務台島原本的石板環路鋪一圈柏油，五條支線接到每座橋的橋頭
  const LANE = 1.25, Y = H + .075, ring = I.ring;
  const road = m('#5f6b78', { roughness: .95 }), edgeM = m('#f3f0e6', { roughness: .9 }), dash = m('#ffffff', { roughness: .9 }), green = m('#3fa66a', { roughness: .9 });
  const ringM = new THREE.Mesh(new THREE.RingGeometry(ring - LANE / 2, ring + LANE / 2, 64), road); ringM.rotation.x = -Math.PI / 2; ringM.position.set(I.pos.x, Y, I.pos.z); ringM.receiveShadow = true; root.add(ringM);
  for (const r of [ring - LANE / 2, ring + LANE / 2]) { const e = new THREE.Mesh(new THREE.RingGeometry(r - .04, r + .04, 64), edgeM); e.rotation.x = -Math.PI / 2; e.position.set(I.pos.x, Y + .002, I.pos.z); root.add(e); }
  for (let k = 0; k < 28; k++) { const a = k / 28 * TAU, d = new THREE.Mesh(new THREE.PlaneGeometry(.08, .42), dash); d.rotation.set(-Math.PI / 2, 0, -a); d.position.set(I.pos.x + Math.cos(a) * ring, Y + .003, I.pos.z + Math.sin(a) * ring); root.add(d); }
  const spokes = [];
  for (const b of W.bridges) {
    const a = b.a, r1 = I.top(a) * .985, len = r1 - ring;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(LANE, len), road); s.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2); s.position.set(I.pos.x + Math.cos(a) * (ring + len / 2), Y + .001, I.pos.z + Math.sin(a) * (ring + len / 2)); s.receiveShadow = true; root.add(s);
    for (let r = ring + LANE / 2 + .3; r < r1 - .2; r += .7) { const d = new THREE.Mesh(new THREE.PlaneGeometry(.08, .38), dash); d.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2); d.position.set(I.pos.x + Math.cos(a) * r, Y + .004, I.pos.z + Math.sin(a) * r); root.add(d); }
    // 腳踏車圖示：畫在每條支線上
    const ic = new THREE.Mesh(new THREE.CircleGeometry(.36, 20), green); ic.rotation.x = -Math.PI / 2; ic.position.set(I.pos.x + Math.cos(a) * (ring + len * .55), Y + .005, I.pos.z + Math.sin(a) * (ring + len * .55)); root.add(ic);
    spokes.push({ a, r1, bridge: b });
  }
  // ---- 路牌：每個橋頭一面藍色圓牌（🚲 自行車道）＋箭頭指向那座島
  const signTex = (text, sub) => { const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const paint = () => { x.clearRect(0, 0, 256, 160); x.fillStyle = '#1f6fc4'; x.beginPath(); x.roundRect(4, 4, 248, 152, 22); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.roundRect(10, 10, 236, 140, 18); x.stroke();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = "900 44px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.fillText(text, 128, 58); x.font = "800 30px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.fillText(sub, 128, 112); t.needsUpdate = true; };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; };
  const wood = m('#6b4423');
  for (const sp of spokes) {
    const isl = opts.islandName ? opts.islandName(sp.bridge.to) : sp.bridge.to;
    const r = sp.r1 - .5, side = sp.a + Math.PI / 2, ox = Math.cos(side) * (LANE / 2 + .35), oz = Math.sin(side) * (LANE / 2 + .35);
    const px = I.pos.x + Math.cos(sp.a) * r + ox, pz = I.pos.z + Math.sin(sp.a) * r + oz;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.5, 6), wood); post.position.set(px, H + .75, pz); post.castShadow = true; root.add(post);
    const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex('🚲 自行車道', `往 ${isl} ➜`) })); sg.scale.set(1.15, .72, 1); sg.position.set(px, H + 1.72, pz); root.add(sg);
  }
  // ---- 借車點：服務台旁的車架，停 4 台腳踏車＋招牌
  const spot = opts.spot || { x: 3, z: 6.5, face: 0 };
  const rack = new THREE.Group(); rack.position.set(spot.x, H, spot.z); rack.rotation.y = spot.face || 0; root.add(rack);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, .06, 1.3), m('#c9b48a')); base.position.y = .03; base.receiveShadow = true; rack.add(base);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, .06, .06), METAL); rail.position.set(0, .42, -.2); rack.add(rail);
  for (const x of [-1.15, 1.15]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .42, .06), METAL); l.position.set(x, .21, -.2); rack.add(l); }
  const parked = [];
  for (let k = 0; k < 4; k++) { const B = makeBike(COLORS[k]); B.g.scale.setScalar(.66); B.g.position.set(-.9 + k * .6, 0, .05); rack.add(B.g); parked.push(B); }
  const tex = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 96; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const paint = () => { x.fillStyle = '#3e9b4f'; x.beginPath(); x.roundRect(4, 4, 312, 88, 20); x.fill(); x.fillStyle = '#fff'; x.font = "900 42px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🚲 借車點', 160, 52); t.needsUpdate = true; };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; })();
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); sign.scale.set(1.5, .45, 1); sign.position.set(0, 1.75, -.35); rack.add(sign);
  for (const x of [-.6, .6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.5, 6), wood); p.position.set(x, .75, -.4); rack.add(p); }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 1.6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1; rack.add(hit);
  if (low) root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const rackPos = new THREE.Vector3(spot.x, H, spot.z);
  // 從車架出發的位置：車架前方 1.6 公尺，面向車架外側
  const fwd = new THREE.Vector3(Math.sin(spot.face || 0), 0, Math.cos(spot.face || 0));
  return {
    rackPos,
    // 從車架側邊出發、面向側邊：第三人稱鏡頭不會被車架和招牌擋住
    startSpot: () => ({ pos: rackPos.clone().addScaledVector(fwd, 1.8), yaw: (spot.face || 0) + Math.PI / 2 }),
    near: (v, r = 4) => Math.hypot(v.x - rackPos.x, v.z - rackPos.z) < r,
    pick: (ray) => ray.intersectObject(hit, false).length > 0,
    setParked: (n) => parked.forEach((B, i) => { B.g.visible = i < n; }),
    avoid: [rackPos.clone(), rackPos.clone().addScaledVector(fwd, 1.2)],
    colors: COLORS,
  };
}
