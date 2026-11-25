// 🦆 鴨子船（腳踏船）：原本浮在海上的大黃色小鴨，改成可以搭乘的腳踏船——
// 停在手作體驗二島（puzzle）南側的木棧道旁，像鯉魚號一樣：停靠時從棧道走進船艙，時間到就出發，
// 繞手作體驗二島（puzzle）外側的海面一圈，再倒退回棧道。坐在椅子上的人會用腳踩踏板，船兩側的水車跟著轉。
// 時程用「網路時間」排班（所有裝置看到的鴨子船都在同一個位置），一起搭的人在同一艘船上。
import * as THREE from 'three';
import { TAU, clamp } from './kit.js?v=20261125g';
import { H } from './world.js?v=20261125g';

export const DUCK_CAP = 4;                       // 船上最多 4 位登入者（前後兩排，每排兩人）
const DOCK = 30, DEP = 6, PIV = 5, BACK = 7, SPEED = 1.5;   // 停靠秒數、出港、掉頭、倒退入泊、腳踏速度（公尺／秒）
const JET_L = 5.2, JET_W = 1.7;                  // 木棧道長、寬
const IX = 1.42, IZ0 = -1.45, IZ1 = 1.2;         // 船艙內可走範圍（船的座標：x 半寬、z 從船尾到船頭）
const DOOR_Z0 = -.75, DOOR_Z1 = .35;             // 船艙 -x 側（靠棧道那一側）的門口
const SEATS = [[-.45, .3], [.45, .3], [-.45, -.8], [.45, -.8]];   // 四個座位（x, z）；面向船頭

export function createDuckBoat(W, opts) {
  const { scene } = W, now = opts.now || (() => Date.now());
  const I = W.islands[opts.island || 'puzzle'];
  const ang = opts.angle ?? 70 * Math.PI / 180;                // 從島中心往外的方向（往南偏東，避開西側的鯉魚號碼頭和南側的小船塢）
  const d = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
  const side = new THREE.Vector3(d.z, 0, -d.x);                // 從島往外看的左手邊（船停在這一側，船的左舷貼著棧道）
  const edge = I.top(ang);
  const j0 = I.pos.clone().addScaledVector(d, edge - .9).setY(H), j1 = j0.clone().addScaledVector(d, JET_L + .9);
  const YAW = Math.atan2(d.x, d.z);
  // 停泊位置：船在棧道旁、跟棧道平行，船頭朝外；船艙 -x 側的門口貼著棧道
  const berth = j0.clone().lerp(j1, .78).addScaledVector(side, JET_W / 2 + IX + .12).setY(0);
  const R = berth.clone().addScaledVector(d, 7);                // 出港後的轉彎點

  // ------------------------------------------------ 航線：在手作體驗二島、服務台島和循環挖寶島之間的海灣繞一圈
  //   （不經過島西側的鯉魚號碼頭和鯉魚號航道，也不從橋下過）。點用「島中心＋距離／角度」表示，換島時跟著移動。
  const P0 = I.pos, polar = (deg, r) => new THREE.Vector3(P0.x + Math.cos(deg * Math.PI / 180) * r, 0, P0.z + Math.sin(deg * Math.PI / 180) * r);
  const pts = [R.clone(), polar(53, 23.4), polar(76, 25.8), polar(92, 24.6), polar(103, 19.8), polar(95, 15.6), polar(77, 16.2), R.clone()];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), LOOP = Math.round(curve.getLength() / SPEED);
  const CYCLE = DOCK + DEP + LOOP + PIV + BACK;

  // ------------------------------------------------ 模型（船的座標：+z 船頭、+x 右舷；地板在 y = H）
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .75, flatShading: true, ...o });
  const yel = m('#ffd23a'), yel2 = m('#f5bf22'), org = m('#ff8a2a'), wood = m('#c98a4a'), dark = m('#1a1a1a'), white = m('#ffffff'), blue = m('#3f9ae0'), red = m('#e4532c');
  const box = (p, mat, w, h, dd, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  const g = new THREE.Group(); scene.add(g);
  const FY = H;                                              // 船艙地板高度（和棧道一樣高，走得進去）
  // 船身：下半顆橢圓球（像小鴨的肚子），浮在水上
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, TAU, Math.PI / 2, Math.PI / 2), yel); hull.scale.set(1.75, FY + .15, 2.45); hull.position.y = FY + .15; hull.castShadow = true; g.add(hull);
  const deckM = box(g, wood, IX * 2 + .1, .08, IZ1 - IZ0 + .1, 0, FY - .04, (IZ0 + IZ1) / 2);
  deckM.castShadow = false;
  // 船舷：圍一圈矮牆（靠棧道的 -x 那一側留門口）
  const WH = .42, WT = .12, wy = FY + WH / 2;
  box(g, yel2, IX * 2 + .3, WH, WT, 0, wy, IZ0 - .1);                                          // 船尾
  box(g, yel2, WT, WH, IZ1 - IZ0 + .3, IX + .1, wy, (IZ0 + IZ1) / 2);                           // 右舷
  box(g, yel2, WT, WH, DOOR_Z0 - IZ0 + .2, -IX - .1, wy, (IZ0 - .1 + DOOR_Z0) / 2);             // 左舷（門口後段）
  box(g, yel2, WT, WH, IZ1 + .2 - DOOR_Z1, -IX - .1, wy, (DOOR_Z1 + IZ1 + .2) / 2);             // 左舷（門口前段）
  // 鴨子的脖子和頭：在船頭，往前上方看
  box(g, yel, 1.3, .9, .7, 0, FY + .4, IZ1 + .45);
  const head = new THREE.Group(); head.position.set(0, FY + 1.35, IZ1 + .75); g.add(head);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(.78, 14, 10), yel); hd.castShadow = true; head.add(hd);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.5, .62, .9, 12), yel); neck.position.y = -.55; neck.castShadow = true; head.add(neck);
  box(head, org, .62, .2, .62, 0, -.08, .72);                                                  // 嘴巴
  box(head, org, .5, .1, .44, 0, -.22, .66);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), dark); e.position.set(s * .34, .2, .62); head.add(e); const w = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 4), white); w.position.set(s * .36, .25, .72); head.add(w); }
  // 尾巴：船尾往上翹
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.3, .55, 8), yel); tail.position.set(0, FY + .05, IZ0 - .45); tail.rotation.x = -1.2; tail.castShadow = true; g.add(tail);
  // 遮陽頂棚：四根柱子撐一片藍白條紋棚子
  for (const [x, z] of [[-1.2, -1.3], [1.2, -1.3], [-1.2, .95], [1.2, .95]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.55, 6), white); p.position.set(x, FY + .78, z); g.add(p); }
  // 坐在船上時頂棚變半透明，第三人稱看得到自己坐著踩踏板
  const roofW = m('#ffffff', { transparent: true }), roofB = m('#3f9ae0', { transparent: true });
  for (let i = 0; i < 6; i++) box(g, i % 2 ? roofW : roofB, .44, .06, 2.55, -1.1 + i * .44, FY + 1.58, -.18).castShadow = !opts.low;
  // 座位：前後兩張長椅（坐兩個人），每個位子前面有一組踏板
  const cranks = [];
  for (const z of [SEATS[0][1], SEATS[2][1]]) {
    // 腳踏船的椅子很低（跟島上的小人物坐下來的高度一樣），腳往前伸剛好踩到踏板
    box(g, red, 2.1, .1, .4, 0, FY + .11, z - .1);                                             // 座墊
    box(g, red, 2.1, .3, .08, 0, FY + .3, z - .32);                                            // 椅背
    box(g, m('#7a8899', { metalness: .4 }), 2.0, .08, .08, 0, FY + .08, z + .62);             // 踏板支架
    for (const [sx] of SEATS.filter((s) => s[1] === z)) {
      const ck = new THREE.Group(); ck.position.set(sx, FY + .2, z + .55); g.add(ck);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .4, 6), m('#555555', { metalness: .5 })); axle.rotation.z = Math.PI / 2; ck.add(axle);
      for (const s of [-1, 1]) {
        const arm = box(ck, m('#555555', { metalness: .5 }), .04, .2, .05, s * .16, 0, 0); arm.position.y = s * .08;
        box(ck, dark, .14, .04, .1, s * .2, s * .17, 0);                                       // 踏板
      }
      cranks.push(ck);
    }
  }
  // 兩側水車：踩踏板時轉動，把船往前推
  const wheels = [];
  for (const s of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.set(s * 1.5, .5, -.35); g.add(wg);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .22, 8), org); hub.rotation.z = Math.PI / 2; wg.add(hub);
    for (let k = 0; k < 6; k++) { const b = box(wg, white, .18, .78, .14, 0, 0, 0); b.rotation.x = k / 6 * Math.PI; }
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .26, 14, 1, true, 0, Math.PI), yel2); cover.rotation.z = Math.PI / 2; cover.rotation.y = Math.PI / 2; cover.position.y = .02; wg.add(cover);
    wheels.push(wg);
  }
  // 水花：船尾後面幾顆白色泡泡，走得越快越明顯
  const foam = []; const foamM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .75, roughness: 1 });
  for (let k = 0; k < 8; k++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 0), foamM); f.userData.k = k; g.add(f); foam.push(f); }
  // 船名牌：掛在右舷外側
  const tex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const paint = () => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#e4532c'; x.font = "900 38px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🦆 鴨子船', 128, 34); t.needsUpdate = true; };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; })();
  for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: tex })); pl.position.set(s * (IX + .17), FY + .2, .35); pl.rotation.y = s * Math.PI / 2; g.add(pl); }
  if (opts.low) for (const o of foam) o.visible = false;

  // ------------------------------------------------ 木棧道：從手作體驗二島（puzzle）南岸伸到海上（和島面一樣高），尾端有燈號
  const jg = new THREE.Group(); scene.add(jg);
  const jMid = j0.clone().lerp(j1, .5), jLen = j0.distanceTo(j1);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(JET_W, .14, jLen), wood); deck.position.copy(jMid).setY(H - .07); deck.rotation.y = YAW; deck.receiveShadow = true; deck.castShadow = true; jg.add(deck);
  for (let k = 1; k < 7; k++) { const p = j0.clone().lerp(j1, k / 6.2); for (const s of [-1, 1]) { const q = new THREE.Mesh(new THREE.CylinderGeometry(.09, .1, H + .5, 6), m('#8a5a2e')); q.position.copy(p).addScaledVector(side, s * (JET_W / 2 - .08)).setY((H - .5) / 2); q.castShadow = true; jg.add(q); } }
  // 棧道左側欄杆（右側是上下船的地方，不加欄杆）
  for (let k = 0; k < 6; k++) { const p = j0.clone().lerp(j1, (k + .5) / 6.2).addScaledVector(side, -(JET_W / 2 - .06)); const q = new THREE.Mesh(new THREE.BoxGeometry(.06, .5, .06), m('#8a5a2e')); q.position.copy(p).setY(H + .25); jg.add(q); }
  { const rl = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, jLen * .95), m('#8a5a2e')); rl.position.copy(jMid).addScaledVector(side, -(JET_W / 2 - .06)).setY(H + .5); rl.rotation.y = YAW; jg.add(rl); }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 1.3, 6), m('#6b4423')); post.position.copy(j1).addScaledVector(d, -.3).addScaledVector(side, -(JET_W / 2 - .15)).setY(H + .65); jg.add(post);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#4caf50', emissive: '#2e9e3a', emissiveIntensity: 1.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), lampMat); lamp.position.copy(post.position).setY(H + 1.38); jg.add(lamp);
  // 棧道入口的小招牌
  const sTex = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 96; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const paint = () => { x.fillStyle = '#ffd23a'; x.beginPath(); x.roundRect(4, 4, 312, 88, 22); x.fill(); x.fillStyle = '#7a4a00'; x.font = "900 40px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🦆 鴨子船碼頭', 160, 52); t.needsUpdate = true; };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; })();
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: sTex })); sign.scale.set(1.8, .54, 1); sign.position.copy(j0).addScaledVector(d, .4).addScaledVector(side, -(JET_W / 2 + .2)).setY(H + 1.6); jg.add(sign);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.4, 6), m('#6b4423')); sp.position.copy(sign.position).setY(H + .7); jg.add(sp);
  // 漫遊時棧道踩得到
  const tmp = new THREE.Vector3();
  W.surfaces.push((x, z) => { tmp.set(x - jMid.x, 0, z - jMid.z); const a = tmp.dot(d), l = tmp.dot(side); return Math.abs(a) < jLen / 2 && Math.abs(l) < JET_W / 2 + .02 ? H : null; });
  // 上下船的跳板：停靠時從棧道接到船艙門口（給漫遊踩的範圍在 floorAt 裡）

  // ------------------------------------------------ 時程（網路時間）
  const ease = (k) => k * k * (3 - 2 * k);
  const RMP = .06, ramp = (u) => (u < RMP ? u * u / (2 * RMP * (1 - RMP)) : u > 1 - RMP ? 1 - (1 - u) ** 2 / (2 * RMP * (1 - RMP)) : (u - RMP / 2) / (1 - RMP));
  const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const tEnd = curve.getTangentAt(1), yawEnd = Math.atan2(tEnd.x, tEnd.z);
  function at(sec) {
    const tc = ((sec % CYCLE) + CYCLE) % CYCLE;
    if (tc < DOCK) return { phase: 'dock', pos: berth.clone(), yaw: YAW, left: DOCK - tc, eta: 0, v: 0 };
    let t = tc - DOCK;
    if (t < DEP) { const k = t / DEP; return { phase: 'out', pos: berth.clone().lerp(R, k * k), yaw: YAW, left: 0, eta: CYCLE - tc, v: k }; }
    t -= DEP;
    if (t < LOOP) { const u = clamp(ramp(t / LOOP), 0, 1), tg = curve.getTangentAt(u); return { phase: 'loop', pos: curve.getPointAt(u), yaw: Math.atan2(tg.x, tg.z), left: 0, eta: CYCLE - tc, v: 1 }; }
    t -= LOOP;
    if (t < PIV) { const k = ease(t / PIV); return { phase: 'turn', pos: R.clone(), yaw: yawEnd + wrap(YAW - yawEnd) * k, left: 0, eta: CYCLE - tc, v: .5 }; }
    t -= PIV;
    const k = t / BACK; return { phase: 'back', pos: R.clone().lerp(berth, 1 - (1 - k) ** 2), yaw: YAW, left: 0, eta: CYCLE - tc, v: -(1 - k) };
  }
  let cur = at(now() / 1000), spin = 0;
  const prevM = new THREE.Matrix4();
  function place(t, moving) {
    const bob = moving ? Math.sin(t * 1.4 + 7) * (cur.phase === 'dock' ? .02 : .05) : 0;
    g.position.set(cur.pos.x, bob, cur.pos.z);
    g.rotation.set(0, cur.yaw, moving && cur.phase !== 'dock' ? Math.sin(t * 1.1) * .025 : 0);
    g.updateMatrixWorld(true);
  }
  place(0, false);
  function update(t, dt, moving) {
    prevM.copy(g.matrixWorld);
    cur = at(now() / 1000);
    place(t, moving);
    // 踩踏板：船在動的時候踏板和水車一起轉（倒退時反轉）
    if (moving) spin += dt * 5.5 * cur.v;
    for (const c of cranks) c.rotation.x = spin;
    for (const w of wheels) w.rotation.x = spin * .55;
    for (const f of foam) { const k = f.userData.k, ph = (t * 1.6 + k / 8) % 1, s = Math.abs(cur.v) * (1 - ph); f.visible = !opts.low && s > .05; f.position.set((k % 2 ? 1 : -1) * (1.8 + ph * .3), .05, -.35 - ph * 2.2); f.scale.setScalar(.4 + s * 1.2); }
    const op = W.duckRiding ? .22 : 1; if (roofW.opacity !== op) { roofW.opacity = roofB.opacity = op; roofW.depthWrite = roofB.depthWrite = op === 1; }
    head.rotation.y = moving ? Math.sin(t * .7) * .12 : 0; head.rotation.x = moving ? Math.sin(t * 1.3) * .05 : 0;
    const c = cur.phase !== 'dock' ? '#e8473f' : cur.left < 6 ? '#ffc23a' : '#4caf50';
    if (lamp.userData.c !== c) { lamp.userData.c = c; lampMat.color.set(c); lampMat.emissive.set(c); }
    W.duckMove = { from: prevM.clone(), to: g.matrixWorld.clone() };
  }

  // ------------------------------------------------ 給漫遊用：船艙地板、門口、是否在船上
  const inv = new THREE.Matrix4(), lv = new THREE.Vector3();
  const toLocal = (x, z, M = g.matrixWorld) => { inv.copy(M).invert(); return lv.set(x, g.position.y, z).applyMatrix4(inv); };
  const inCabin = (p) => Math.abs(p.x) < IX && p.z > IZ0 && p.z < IZ1;
  const inDoor = (p) => cur.phase === 'dock' && p.x <= -IX + .02 && p.x > -IX - .45 && p.z > DOOR_Z0 && p.z < DOOR_Z1;   // 停靠時門口和棧道之間的跳板
  function floorAt(x, z) { const p = toLocal(x, z); return inCabin(p) || inDoor(p) ? FY : null; }
  function inBoat(v, M) { const p = toLocal(v.x, v.z, M); return inCabin(p) && Math.abs((v.y ?? FY) - FY) < 1.2; }
  const docked = () => cur.phase === 'dock';
  const doorOpen = () => cur.phase === 'dock' && cur.left > 2;
  // 停靠時誰都能踩到船艙；開出去以後只有在船上的人（自己）才踩得到
  (W.over = W.over || []).push((x, z) => { const f = floorAt(x, z); return f != null && (docked() || W.duckRiding) ? f : null; });
  const seatWorld = (i) => g.localToWorld(new THREE.Vector3(SEATS[i][0], FY, SEATS[i][1] - .12));
  // 其他登入者在鴨子船上：網路位置有延遲，直接排到四個座位（依 id 固定）
  function riderSpot(p, id) {
    if (!p) return null;
    const lp = toLocal(p.x, p.z), onWater = W.ground(p.x, p.z) == null;
    const near = Math.hypot(p.x - g.position.x, p.z - g.position.z) < 4.2;
    if (!(inCabin(lp) || (!docked() && near && (onWater || Math.abs((p.y ?? H) - FY) < .6)))) return null;
    let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return seatWorld(h % 4);
  }
  // 自己沒在走路時：坐到最近的座位上踩踏板
  function nearestSeat(v) { let best = null, bd = 1e9; for (let i = 0; i < 4; i++) { const s = seatWorld(i), dd = s.distanceToSquared(v); if (dd < bd) { bd = dd; best = s; } } return best; }
  return {
    g, berth, floorAt, inBoat, riderSpot, nearestSeat, docked, doorOpen, cap: DUCK_CAP,
    anchor: () => g.position,
    yaw: () => g.rotation.y,
    pedaling: () => cur.phase !== 'dock',
    jetty: { j0, j1, d, side },
    // 走進船艙：站在門口內側，面向船頭
    boardSpot: () => ({ pos: g.localToWorld(new THREE.Vector3(-.4, FY, -.2)).setY(FY), yaw: g.rotation.y }),
    // 下了船（或航行中離開漫遊）放回棧道靠島那一端
    landSpot: () => { const p = j0.clone().addScaledVector(d, .6); return { x: p.x, y: H, z: p.z }; },
    avoid: [j0, j0.clone().addScaledVector(side, 1.2), j0.clone().addScaledVector(side, -1.2), j0.clone().addScaledVector(d, -1)],
    status: () => ({ phase: cur.phase, docked: docked(), left: Math.ceil(cur.left), eta: Math.ceil(cur.eta), cycle: Math.round(CYCLE) }),
    route: () => curve,
    update,
  };
}
