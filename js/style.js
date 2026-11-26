// 👕 服飾店、💃 閃身步、🐾 寵物：
// - 配件（皇冠、蝴蝶結、墨鏡、兔耳朵、披風、花圈）：掛在人物身上（人物座標：腳底 0、頭中心 1.16）
// - 閃身步：雙腳輪流往外踢、身體左右滑、手臂擺動，跳 4 秒
// - 寵物：小狗、小兔、小雞，走在主人旁邊，走路時一跳一跳
import * as THREE from 'three';
import { TAU } from './kit.js?v=20261126u';
import { H } from './world.js?v=20261126u';

const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, flatShading: true, ...o });
const part = (g, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
const G = { box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(.5, 12, 8), cone: new THREE.ConeGeometry(.5, 1, 8), cyl: new THREE.CylinderGeometry(.5, .5, 1, 10), tor: new THREE.TorusGeometry(.5, .12, 6, 16) };

// ------------------------------------------------ 配件
export const ACCS = {
  crown: { name: '皇冠', icon: '👑', price: 20 },
  bow: { name: '蝴蝶結', icon: '🎀', price: 10 },
  shades: { name: '墨鏡', icon: '🕶️', price: 15 },
  bunny: { name: '兔耳朵', icon: '🐰', price: 15 },
  cape: { name: '披風', icon: '🦸', price: 25 },
  flower: { name: '花圈', icon: '🌸', price: 10 },
};
export function makeAcc(kind) {
  const g = new THREE.Group(); g.userData.kind = kind;
  if (kind === 'crown') {
    const gold = m('#f2c230', { metalness: .4, roughness: .35 });
    part(g, G.cyl, gold, 0, 1.43, 0, .42, .1, .42);
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; part(g, G.cone, gold, Math.cos(a) * .17, 1.53, Math.sin(a) * .17, .1, .16, .1); }
    part(g, G.sph, m('#e4532c'), 0, 1.44, .21, .07, .07, .05);
  } else if (kind === 'bow') {
    const pink = m('#ff6fa5');
    part(g, G.cone, pink, -.1, 1.42, -.05, .16, .16, .1, 0, 0, Math.PI / 2); part(g, G.cone, pink, .1, 1.42, -.05, .16, .16, .1, 0, 0, -Math.PI / 2); part(g, G.sph, pink, 0, 1.42, -.05, .07, .07, .07);
    g.position.set(.12, 0, 0);
  } else if (kind === 'shades') {
    const blk = m('#1a1a1a', { roughness: .3, metalness: .3 });
    part(g, G.box, blk, -.09, 1.19, .24, .13, .08, .02); part(g, G.box, blk, .09, 1.19, .24, .13, .08, .02); part(g, G.box, blk, 0, 1.21, .24, .32, .02, .02);
  } else if (kind === 'bunny') {
    const w = m('#ffffff'), p = m('#ffb3c7');
    for (const s of [-1, 1]) { part(g, G.sph, w, s * .1, 1.56, 0, .1, .34, .06, 0, 0, s * -.15); part(g, G.sph, p, s * .1, 1.56, .025, .05, .24, .02, 0, 0, s * -.15); }
  } else if (kind === 'cape') {
    const red = m('#d23b3b', { side: THREE.DoubleSide });
    const c = part(g, new THREE.PlaneGeometry(.44, .55), red, 0, .66, -.24, 1, 1, 1, .12); c.userData.cape = true;
    part(g, G.box, m('#f2c230'), 0, .93, -.2, .3, .04, .04);
  } else if (kind === 'flower') {
    const cols = ['#ff6fa5', '#ffd23a', '#ffffff', '#ff8a3d', '#b07cff'];
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; part(g, G.sph, m(cols[k % cols.length]), Math.cos(a) * .2, 1.36, Math.sin(a) * .2, .09, .07, .09); }
  }
  return g;
}

// ------------------------------------------------ 寵物
export const PETS = {
  dog: { name: '小狗', icon: '🐶' },
  bunny: { name: '小兔', icon: '🐰' },
  chick: { name: '小雞', icon: '🐥' },
};
export function makePet(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  let tail = null;
  if (kind === 'dog') {
    const fur = m('#c98a4a'), dark = m('#6b4423'), w = m('#fff3e0');
    part(body, G.sph, fur, 0, .2, 0, .26, .22, .4);
    part(body, G.sph, fur, 0, .36, .2, .24, .22, .22); part(body, G.sph, w, 0, .32, .3, .12, .09, .1); part(body, G.sph, m('#1a1a1a'), 0, .35, .36, .05, .04, .04);
    for (const s of [-1, 1]) { part(body, G.sph, dark, s * .1, .45, .17, .07, .14, .05, 0, 0, s * .4); part(body, G.sph, m('#1a1a1a'), s * .06, .4, .3, .03, .04, .02); }
    for (const [x, z] of [[-.08, .12], [.08, .12], [-.08, -.12], [.08, -.12]]) part(body, G.cyl, fur, x, .07, z, .06, .14, .06);
    tail = part(body, G.cone, fur, 0, .28, -.2, .05, .16, .05, -.8);
  } else if (kind === 'bunny') {
    const w = m('#f7f3ee'), p = m('#ffb3c7');
    part(body, G.sph, w, 0, .16, 0, .26, .24, .32);
    part(body, G.sph, w, 0, .3, .14, .2, .19, .19);
    for (const s of [-1, 1]) { part(body, G.sph, w, s * .05, .46, .12, .05, .18, .04, 0, 0, s * .15); part(body, G.sph, p, s * .05, .46, .135, .025, .12, .01, 0, 0, s * .15); part(body, G.sph, m('#1a1a1a'), s * .06, .33, .23, .03, .03, .02); }
    tail = part(body, G.sph, w, 0, .2, -.16, .1, .1, .1);
  } else {
    const y = m('#ffd23a'), o = m('#ff8a2a');
    part(body, G.sph, y, 0, .14, 0, .24, .24, .26);
    part(body, G.sph, y, 0, .3, .05, .18, .18, .18);
    part(body, G.cone, o, 0, .29, .16, .06, .08, .06, Math.PI / 2);
    for (const s of [-1, 1]) { part(body, G.sph, m('#1a1a1a'), s * .05, .33, .12, .025, .03, .02); part(body, G.sph, y, s * .12, .16, -.02, .05, .12, .14, 0, 0, s * .4); part(body, G.cyl, o, s * .05, .03, 0, .02, .06, .02); }
    tail = part(body, G.cone, y, 0, .2, -.13, .06, .1, .06, -1.2);
  }
  g.scale.setScalar(1.1);
  return { g, body, tail, pos: new THREE.Vector3(), yaw: 0, hop: 0 };
}
// 寵物跟著主人：走在主人左後方，主人在走就跟著一跳一跳
export function stepPet(pet, owner, ownerYaw, t, dt, groundAt) {
  const side = ownerYaw + Math.PI * .75, want = new THREE.Vector3(owner.x + Math.sin(side) * .75, owner.y, owner.z + Math.cos(side) * .75);
  if (!pet.ready) { pet.pos.copy(want); pet.ready = true; }
  const d = want.clone().sub(pet.pos); d.y = 0; const dist = d.length();
  if (dist > 8) { pet.pos.copy(want); }                               // 太遠（例如主人坐船、瞬間移動）直接跳過去
  else if (dist > .12) { const sp = Math.min(dist, dt * Math.max(2.5, dist * 3.2)); pet.pos.addScaledVector(d.normalize(), sp); pet.yaw = Math.atan2(d.x, d.z); }
  const gy = groundAt ? groundAt(pet.pos.x, pet.pos.z) : null;
  pet.pos.y = gy != null ? gy : owner.y;
  const moving = dist > .2;
  pet.hop = moving ? Math.abs(Math.sin(t * 11)) * .1 : Math.max(0, pet.hop - dt);
  pet.g.position.set(pet.pos.x, pet.pos.y + pet.hop, pet.pos.z);
  let dy = pet.yaw - pet.g.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; pet.g.rotation.y += dy * Math.min(1, dt * 8);
  if (pet.tail) pet.tail.rotation.z = Math.sin(t * (moving ? 14 : 6)) * .5;
}

// ------------------------------------------------ 閃身步：4 秒的舞步
export const DANCE_SEC = 4;
export function poseDance(P, k) {
  // k：跳了幾秒。兩拍一組：右腳往外踢＋身體往左滑，再換邊
  const w = k * 9, s = Math.sin(w), c = Math.cos(w * .5);
  P.legs[0].rotation.set(Math.max(0, s) * -.9, 0, Math.max(0, s) * .35);
  P.legs[1].rotation.set(Math.max(0, -s) * -.9, 0, Math.max(0, -s) * -.35);
  P.arms[0].rotation.set(-1.2 + s * .6, 0, .3); P.arms[1].rotation.set(-1.2 - s * .6, 0, -.3);
  return { slide: c * .14, bounce: Math.abs(s) * .05, twist: Math.sin(w * .5) * .35 };
}

// ------------------------------------------------ 服飾店：服務台島的小攤子
export function createShop(W, opts) {
  const spot = opts.spot || { x: -4, z: 6, face: 0 };
  const g = new THREE.Group(); g.position.set(spot.x, H, spot.z); g.rotation.y = spot.face || 0; W.scene.add(g);
  const wood = m('#c98a4a'), awn = m('#ff6fa5'), wht = m('#ffffff');
  part(g, G.box, wood, 0, .4, 0, 1.6, .8, .6);
  part(g, G.box, wht, 0, .82, 0, 1.7, .06, .7);
  for (const x of [-.8, .8]) part(g, G.cyl, wood, x, 1.2, -.25, .06, 2.4, .06);
  for (let k = 0; k < 6; k++) part(g, G.box, k % 2 ? wht : awn, -.75 + k * .3, 2.42, .05, .3, .05, 1.0, .25);
  // 衣架和小衣服
  part(g, G.cyl, m('#888888', { metalness: .5 }), 0, 1.6, -.25, .03, 1.5, .03, 0, 0, Math.PI / 2);
  const cols = ['#e4532c', '#2f7fd1', '#ffd23a', '#3e9b4f', '#8a5cd0'];
  cols.forEach((c, k) => { part(g, G.box, m(c), -.6 + k * .3, 1.35, -.25, .22, .36, .05); });
  // 檯面上：皇冠和花圈
  const cr = makeAcc('crown'); cr.position.set(-.4, -.55, .05); cr.scale.setScalar(.8); g.add(cr);
  const fl = makeAcc('flower'); fl.position.set(.4, -.55, 0); fl.scale.setScalar(.8); g.add(fl);
  const tex = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 96; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const paint = () => { x.fillStyle = '#d23d7a'; x.beginPath(); x.roundRect(4, 4, 312, 88, 20); x.fill(); x.fillStyle = '#fff'; x.font = "900 42px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('👕 服飾店', 160, 52); t.needsUpdate = true; };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; })();
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); sign.scale.set(1.5, .45, 1); sign.position.set(0, 2.85, 0); g.add(sign);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3, 1.2), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.4; g.add(hit);
  if (opts.low) g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const pos = new THREE.Vector3(spot.x, H, spot.z);
  return { pos, pick: (ray) => ray.intersectObject(hit, false).length > 0, avoid: [pos.clone()] };
}
