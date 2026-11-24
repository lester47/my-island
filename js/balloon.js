// 彩虹熱氣球：停在服務台北側廣場的起降場，像鯉魚號一樣可以搭乘——
// 停靠時從籃子前面的門走進去，時間到就升空，繞五座島飛一圈再降落回起降場。
// 時程用「網路時間」排班（所有裝置看到的熱氣球都在同一個位置），一起搭的人會在同一個籃子裡。
import * as THREE from 'three';
import { TAU, clamp, batchStatic } from './kit.js?v=20261124k';
import { H } from './world.js?v=20261124k';

export const BALLOON_CAP = 4;                    // 籃子最多 4 位登入者
const DOCK = 30, ASC = 10, DESC = 12, ALT = 13, SPEED = 3.2;   // 停靠秒數、升空、降落、飛行高度、巡航速度
const IN = .6, FLOOR = .1, HALF = .82;           // 籃子內可走範圍（半寬）、地板高度、籃子外框半寬

export function createBalloon(W, opts) {
  const { scene } = W, now = opts.now || (() => Date.now());
  const pad = new THREE.Vector3(opts.pad.x, H, opts.pad.z), top = pad.clone().setY(H + ALT);

  // ------------------------------------------------ 航線：從起降場上空往外飛到湖面上，繞五座島一圈，再回到起降場上空
  const a0 = Math.atan2(pad.z, pad.x), RAD = 23;
  const ring = (a, r, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  const pts = [top.clone(), ring(a0 - .25, 12, H + ALT + .6)];
  for (let i = 0; i <= 12; i++) pts.push(ring(a0 + i / 12 * TAU, RAD, H + ALT + 1.4 + Math.sin(i * 1.7) * 1.6));
  pts.push(ring(a0 + .25, 12, H + ALT + .6), top.clone());
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), CRUISE = Math.round(curve.getLength() / SPEED);   // 取整數秒，整趟時間也是整數
  const CYCLE = DOCK + ASC + CRUISE + DESC;

  // ------------------------------------------------ 模型
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true, ...o });
  const box = (p, mat, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  const g = new THREE.Group(); g.position.copy(pad); scene.add(g);
  const wick = m('#b8803f'), trim = m('#6b4423'), rope = m('#5a3a1a');
  // 籃子：地板＋四面矮牆（前面 +z 留一個門），牆頂到腰，站在裡面往下看得到島
  box(g, trim, HALF * 2, .12, HALF * 2, 0, .04, 0);
  const WH = .6, WT = .08, wy = .1 + WH / 2, doorW = .72, sideW = (HALF * 2 - doorW) / 2;
  box(g, wick, HALF * 2, WH, WT, 0, wy, -HALF);
  box(g, wick, WT, WH, HALF * 2, -HALF, wy, 0);
  box(g, wick, WT, WH, HALF * 2, HALF, wy, 0);
  box(g, wick, sideW, WH, WT, -HALF + sideW / 2, wy, HALF);
  box(g, wick, sideW, WH, WT, HALF - sideW / 2, wy, HALF);
  for (const [x, z, w, d] of [[0, -HALF, HALF * 2 + .1, .14], [-HALF, 0, .14, HALF * 2 + .1], [HALF, 0, .14, HALF * 2 + .1], [-HALF + sideW / 2, HALF, sideW, .14], [HALF - sideW / 2, HALF, sideW, .14]]) box(g, trim, w, .08, d, x, .1 + WH, z);
  // 沙包：掛在籃子外側
  const sand = m('#d8c28a');
  for (const [x, z] of [[-HALF - .1, -.4], [-HALF - .1, .4], [HALF + .1, -.4], [HALF + .1, .4], [-.4, -HALF - .1], [.4, -HALF - .1]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), sand); s.scale.y = 1.25; s.position.set(x, .42, z); s.castShadow = true; g.add(s); }
  // 繩子：籃子四角拉到燃燒器框
  const BY = 2.05, line = (a, b) => { const d = b.clone().sub(a), o = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, d.length(), 4), rope); o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(o); };
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) line(new THREE.Vector3(x * HALF, .74, z * HALF), new THREE.Vector3(x * .42, BY, z * .42));
  box(g, m('#3a3a3a', { metalness: .4, roughness: .5 }), .9, .06, .9, 0, BY, 0);
  box(g, m('#555555', { metalness: .5, roughness: .4 }), .22, .22, .22, 0, BY + .12, 0);
  // 火焰：飛行時亮、閃動
  const flameMat = new THREE.MeshStandardMaterial({ color: '#ffb23a', emissive: '#ff7a1a', emissiveIntensity: 2.2, transparent: true, opacity: .9, depthWrite: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.16, .55, 8), flameMat); flame.position.set(0, BY + .5, 0); g.add(flame);
  // 球皮：彩虹 12 片，底下接一圈裙邊
  const env = new THREE.Group(); env.position.y = 5.0; g.add(env);
  const RAINBOW = ['#ff4d6d', '#ff8a3d', '#ffd23a', '#5ed37a', '#3fa7ff', '#7a6cff'];
  for (let k = 0; k < 12; k++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(.5, 6, 12, k / 12 * TAU, TAU / 12), m(RAINBOW[k % 6], { roughness: .7 }));
    seg.scale.set(4.8, 5.3, 4.8); seg.castShadow = true; env.add(seg);
  }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.15, .5, .7, 12, 1, true), m('#ffd23a', { side: THREE.DoubleSide })); skirt.position.y = 2.45 - 5.0 + 0.05; env.add(skirt);
  box(env, m('#ffffff'), .5, .14, .5, 0, 2.62, 0);   // 頂部的白色排氣蓋
  // 起降場：圓形木台＋外圈黃色描邊＋燈號（綠：可以上；黃：快出發；紅：飛行中）
  const padG = new THREE.Group(); padG.position.copy(pad); scene.add(padG);
  const ringM = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.8, .05, 24), m('#e3a33b')); ringM.position.y = .02; ringM.receiveShadow = true; padG.add(ringM);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, .06, 24), m('#efe6cf')); disc.position.y = .035; disc.receiveShadow = true; padG.add(disc);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; box(padG, m('#c9b48a'), .5, .02, .08, Math.cos(a) * 1.2, .07, Math.sin(a) * 1.2).rotation.y = -a; }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 1.3, 6), trim); post.position.set(1.55, .65, 1.25); post.castShadow = true; padG.add(post);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#4caf50', emissive: '#2e9e3a', emissiveIntensity: 1.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), lampMat); lamp.position.set(1.55, 1.38, 1.25); padG.add(lamp);
  // 籃子的門：停靠時往外打開，起飛前關上（鉸鏈在門口左邊）
  const door = new THREE.Group(); door.position.set(-doorW / 2, 0, HALF); g.add(door);
  box(door, wick, doorW - .04, WH - .04, WT, doorW / 2, wy, 0);
  box(door, trim, doorW - .04, .07, .12, doorW / 2, .1 + WH - .02, 0);
  box(door, trim, .07, WH - .1, .1, doorW - .08, wy, .02);   // 門把那一側的框
  const DOOR_OPEN = -1.75; door.rotation.y = DOOR_OPEN;
  batchStatic(g, [flame, env, door]); batchStatic(door, []); batchStatic(env, []); batchStatic(padG, [lamp]);
  if (opts.low) for (const c of env.children) c.castShadow = false;

  // ------------------------------------------------ 時程
  const ease = (k) => k * k * (3 - 2 * k);
  // 巡航：起步和收尾各 8% 加減速，中間等速
  const R = .08, ramp = (u) => (u < R ? u * u / (2 * R * (1 - R)) : u > 1 - R ? 1 - (1 - u) ** 2 / (2 * R * (1 - R)) : (u - R / 2) / (1 - R));
  function at(sec) {
    const tc = ((sec % CYCLE) + CYCLE) % CYCLE;
    if (tc < DOCK) return { phase: 'dock', pos: pad.clone(), left: DOCK - tc, eta: 0 };
    if (tc < DOCK + ASC) { const k = (tc - DOCK) / ASC; return { phase: 'up', pos: pad.clone().lerp(top, ease(k)), left: 0, eta: CYCLE - tc }; }
    if (tc < DOCK + ASC + CRUISE) { const u = (tc - DOCK - ASC) / CRUISE; return { phase: 'fly', pos: curve.getPointAt(clamp(ramp(u), 0, 1)), left: 0, eta: CYCLE - tc, u }; }
    const k = (tc - DOCK - ASC - CRUISE) / DESC; return { phase: 'down', pos: top.clone().lerp(pad, ease(k)), left: 0, eta: CYCLE - tc };
  }
  let cur = at(now() / 1000);
  const prev = g.position.clone();
  function update(t, dt, moving) {
    prev.copy(g.position);
    cur = at(now() / 1000);
    g.position.copy(cur.pos);
    if (cur.phase === 'fly' && moving) g.position.y += Math.sin(t * .7) * .12;
    // 球皮微微擺動（籃子不轉，站在裡面不會晃）
    env.rotation.z = moving && cur.phase !== 'dock' ? Math.sin(t * .6) * .03 : 0; env.rotation.x = moving && cur.phase !== 'dock' ? Math.sin(t * .45 + 1) * .025 : 0;
    const burn = cur.phase === 'up' || (cur.phase === 'fly' && Math.sin(t * .8) > .3);
    flame.visible = cur.phase !== 'dock';
    // 門：停靠中而且還有 2 秒以上才起飛 → 打開；其他時間關上（起飛前 2 秒開始關）
    const want = cur.phase === 'dock' && cur.left > 2 ? DOOR_OPEN : 0;
    door.rotation.y += (want - door.rotation.y) * Math.min(1, dt * (moving ? 5 : 60));
    const f = burn ? 1 + (moving ? Math.sin(t * 31) * .18 : 0) : .45; flame.scale.set(f * .9, f, f * .9);
    const c = cur.phase !== 'dock' ? '#e8473f' : cur.left < 6 ? '#ffc23a' : '#4caf50';
    if (lamp.userData.c !== c) { lamp.userData.c = c; lampMat.color.set(c); lampMat.emissive.set(c); }
    g.updateMatrixWorld(true);
    W.balloonMove = { from: prev.clone(), d: g.position.clone().sub(prev) };
  }

  // ------------------------------------------------ 給漫遊用：籃子地板、是否在籃子裡
  function floorAt(x, z, p = g.position) { return Math.abs(x - p.x) < IN && Math.abs(z - p.z) < IN ? p.y + FLOOR : null; }
  function inBasket(v, p = g.position) { const f = floorAt(v.x, v.z, p); return f != null && Math.abs(v.y - f) < .9; }
  const docked = () => cur.phase === 'dock';
  const doorOpen = () => cur.phase === 'dock' && cur.left > 2;   // 門開著才能進出籃子
  // 停靠時籃子地板誰都能踩；飛起來以後只有在籃子裡的人（自己）才踩得到，不會影響地上的人
  (W.over = W.over || []).push((x, z) => { const f = floorAt(x, z); return f != null && (docked() || W.balloonRiding) ? f : null; });
  // 其他登入者在籃子裡：網路位置有延遲，直接排在籃子裡的四個位置（依 id 固定）
  // 位置高在半空（地面上沒有那麼高的地方）一定是搭熱氣球的人：網路位置舊了也一律排進籃子，不會飄在天上
  function riderSpot(p, id) {
    if (!p) return null;
    const c = g.position, fy = c.y + FLOOR, inAir = (p.y ?? 0) > H + 2.5;
    if (docked() && !inAir) return null;
    if (!inAir && (Math.hypot(p.x - c.x, p.z - c.z) > 2.2 || Math.abs((p.y ?? 0) - fy) > 2.5)) return null;
    let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const k = h % 4; return new THREE.Vector3(c.x + (k & 1 ? .32 : -.32), fy, c.z + (k & 2 ? .32 : -.32));
  }
  return {
    g, pad, floorAt, inBasket, riderSpot, docked, cap: BALLOON_CAP, door, doorOpen,
    anchor: () => g.position,
    // 站進籃子：面向外側（湖和群島那一邊）
    boardSpot: () => ({ pos: new THREE.Vector3(g.position.x, g.position.y + FLOOR, g.position.z - .1), yaw: Math.PI }),
    // 下了熱氣球（或飛行中離開漫遊）放回起降場門口
    landSpot: () => ({ x: pad.x, y: H, z: pad.z + 2.1 }),
    avoid: [pad, pad.clone().add(new THREE.Vector3(1.6, 0, 0)), pad.clone().add(new THREE.Vector3(-1.6, 0, 0)), pad.clone().add(new THREE.Vector3(0, 0, 1.6)), pad.clone().add(new THREE.Vector3(0, 0, -1.6))],
    status: () => ({ phase: cur.phase, docked: docked(), left: Math.ceil(cur.left), eta: Math.ceil(cur.eta), cycle: Math.round(CYCLE) }),
    update,
  };
}
