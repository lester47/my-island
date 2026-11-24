// 🎢 鯉魚雲霄飛車（第一版）：軌道繞一圈，經過五座主題島的外緣上空。
// 車站在「趣味遊戲島」外側海上的木平台；出站後爬坡（最高不超過 10 公尺，避開在上空繞島的熱氣球），
// 大俯衝、海面波浪段，再依序飛過循環挖寶島、手作體驗二島、美食補給島、手作體驗一島，回到車站。
// 時程用「網路時間」排班（所有裝置看到同一班車）：停站 25 秒 → 跑一圈 → 回站。
import * as THREE from 'three';
import { TAU, clamp } from './kit.js?v=20261124r';
import { H } from './world.js?v=20261124r';

export const COASTER_CAP = 8;                 // 4 節車廂 × 每節 2 人
const DOCK = 25;                              // 停站秒數
const CARS = 4, CAR_GAP = 1.75;               // 車廂數、車廂間距（沿軌道）
const SEAT_X = .3;                            // 座位左右位置
const ORDER = ['sport', 'recycle', 'puzzle', 'food', 'craft'];   // 逆時針經過的順序（車站在 sport）

export function createCoaster(W, opts) {
  const { scene } = W, now = opts.now || (() => Date.now()), low = !!opts.low;
  const root = new THREE.Group(); scene.add(root);
  const I = (id) => W.islands[id];
  const UP = new THREE.Vector3(0, 1, 0);
  const uOf = (C) => new THREE.Vector3(C.x, 0, C.z).normalize();
  const tOf = (u) => new THREE.Vector3(-u.z, 0, u.x);
  const at = (C, u, t, du, dt, y) => C.clone().addScaledVector(u, du).addScaledVector(t, dt).setY(y);
  const polar = (deg, r, y) => new THREE.Vector3(Math.cos(deg * Math.PI / 180) * r, y, Math.sin(deg * Math.PI / 180) * r);
  const angOf = (id) => Math.atan2(I(id).pos.z, I(id).pos.x) * 180 / Math.PI;

  // ------------------------------------------------ 路線（控制點：x, 高度 y, z）
  const S = I('sport'), Cs = S.pos.clone().setY(0), us = uOf(Cs), ts = tOf(us);
  const STY = H + .2, STD = 9, SH = -6;                         // 車站軌道高度、車站離島中心多遠、往旁邊挪（讓出島上原本的小碼頭和小船）
  const isle = (id, y = H + 4.5, du = 3.4) => { const C = I(id).pos.clone().setY(0), u = uOf(C), t = tOf(u); return [at(C, u, t, du, -5, y), at(C, u, t, du + .5, 0, y + .35), at(C, u, t, du, 5, y)]; };
  const a = Object.fromEntries(ORDER.map((id) => [id, (angOf(id) + 360) % 360]));
  const mid = (a1, a2, f) => { let d = a2 - a1; if (d < 0) d += 360; return a1 + d * f; };
  const pts = [
    at(Cs, us, ts, STD, SH - 2, STY), at(Cs, us, ts, STD, SH + 4, STY),           // 車站（起點）
    at(Cs, us, ts, STD + .3, SH + 10, STY + 1.6),                                  // 開始爬坡（從小碼頭上方經過）
    polar(mid(a.sport, a.recycle, .45), 33, 9.6),                                  // 坡頂（10 公尺以下）
    polar(mid(a.sport, a.recycle, .7), 31, 3.4),                                   // 大俯衝到海面
    ...isle('recycle'),
    polar(mid(a.recycle, a.puzzle, .28), 31, 5.6),                                 // 海灣上空（高過鴨子船）
    polar(mid(a.recycle, a.puzzle, .5), 33, 8.4),                                  // 駝峰
    polar(mid(a.recycle, a.puzzle, .74), 30.5, 5.6),
    ...isle('puzzle', H + 5.3, 1.6),                                              // 手作體驗二島：往島中心靠、拉高，離西側鯉魚號碼頭遠一點
    polar(mid(a.puzzle, a.food, .3), 31, 4.2),
    polar(mid(a.puzzle, a.food, .52), 33, 7.6),
    polar(mid(a.puzzle, a.food, .76), 30.5, 4.4),
    ...isle('food'),
    polar(mid(a.food, a.craft, .3), 31.5, 4.8),
    polar(mid(a.food, a.craft, .55), 32.5, 3.4),                                   // 貼著海面
    polar(mid(a.food, a.craft, .78), 31, 5.2),
    ...isle('craft'),
    polar(mid(a.craft, a.sport, .3), 32.5, 7.2),
    polar(mid(a.craft, a.sport, .6), 34, 4.6),
    at(Cs, us, ts, STD + .4, SH - 11, STY + 1.2),                                  // 減速進站
    at(Cs, us, ts, STD, SH - 6.5, STY),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', .5);
  const L = curve.getLength();
  const N = Math.ceil(L / .35);
  // 每一小段的位置、切線、右手方向（不側傾，第一版沒有迴圈）
  const P = [], T = [], RX = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1).normalize();
    P.push(p); T.push(t); RX.push(new THREE.Vector3().crossVectors(UP, t).normalize());
  }
  const sample = (s) => { s = ((s % L) + L) % L; const f = s / L * N, i = Math.floor(f), k = f - i, j = Math.min(N, i + 1); return { p: P[i].clone().lerp(P[j], k), t: T[i].clone().lerp(T[j], k).normalize(), r: RX[i].clone().lerp(RX[j], k).normalize() }; };

  // ------------------------------------------------ 時刻表：用能量守恆算速度（爬坡用鏈條、進站煞車），先算好整趟的「時間 → 位置」
  const yAt = (s) => sample(s).p.y;
  let topS = 0, topY = -1; for (let s = 0; s < L * .3; s += .5) { const y = yAt(s); if (y > topY) { topY = y; topS = s; } }
  const G = 9.8 * .6, LIFT = 2.4, BRAKE_S = L - 14, MINV = 3.2;
  const times = [0], dist = [0];
  { let s = 0, v = 0, t = 0; const dt = .02;
    while (s < L) {
      let want;
      if (s < 3) want = Math.min(LIFT, v + 1.5 * dt);                       // 出站
      else if (s < topS) want = LIFT;                                       // 鏈條爬坡：喀啦喀啦
      else if (s < BRAKE_S) want = Math.max(MINV, Math.sqrt(LIFT * LIFT + 2 * G * Math.max(0, topY - yAt(s))) * .97);
      else want = Math.max(.9, Math.min(v, 1.2 + (L - s) * .45));            // 煞車進站
      v = want; s += v * dt; t += dt; times.push(t); dist.push(Math.min(s, L));
    } }
  const RIDE = times[times.length - 1], CYCLE = DOCK + RIDE;
  const sAtTime = (tr) => { if (tr <= 0) return 0; if (tr >= RIDE) return L; let lo = 0, hi = times.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] < tr) lo = m; else hi = m; } const k = (tr - times[lo]) / Math.max(1e-6, times[hi] - times[lo]); return dist[lo] + (dist[hi] - dist[lo]) * k; };

  // ------------------------------------------------ 軌道：兩條紅色鋼軌、白色枕木、中間的支撐管、白色支柱
  const railM = new THREE.MeshStandardMaterial({ color: '#e4532c', roughness: .45, metalness: .3 });
  const spineM = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: .5, metalness: .2 });
  const tieM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .7 });
  const postM = new THREE.MeshStandardMaterial({ color: '#f3f0e6', roughness: .7 });
  const offCurve = (dx, dy) => new THREE.CatmullRomCurve3(P.slice(0, N).map((p, i) => p.clone().addScaledVector(RX[i], dx).add(new THREE.Vector3(0, dy, 0))), true);
  const segs = Math.min(1400, N);
  for (const dx of [-.36, .36]) { const m = new THREE.Mesh(new THREE.TubeGeometry(offCurve(dx, 0), segs, .055, 6, true), railM); m.castShadow = !low; root.add(m); }
  { const m = new THREE.Mesh(new THREE.TubeGeometry(offCurve(0, -.22), segs, .1, 6, true), spineM); m.castShadow = !low; root.add(m); }
  const step = low ? 1.2 : .7, nTies = Math.floor(L / step);
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(.95, .06, .14), tieM, nTies);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V1 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  const basis = (t, r) => { const y = new THREE.Vector3().crossVectors(t, r); return new THREE.Matrix4().makeBasis(r, y, t); };
  for (let k = 0; k < nTies; k++) { const sp = sample(k * step); Q.setFromRotationMatrix(basis(sp.t, sp.r)); V1.copy(sp.p).y -= .08; ties.setMatrixAt(k, M4.compose(V1, Q, ONE)); }
  ties.receiveShadow = true; root.add(ties);
  // 支柱：每 5 公尺一根，落在島上或海裡；車站和島上擋路的地方不放
  const posts = [];
  const stationC = at(Cs, us, ts, STD, SH, 0);
  for (let s = 2.5; s < L; s += low ? 7 : 5) {
    const p = sample(s).p; if (p.y < 1.6) continue;
    if (Math.hypot(p.x - stationC.x, p.z - stationC.z) < 8.5) continue;
    const g = W.ground(p.x, p.z);
    let base = 0;
    if (g != null) { const isl = Object.values(W.islands).find((q) => Math.hypot(p.x - q.pos.x, p.z - q.pos.z) < q.R * 1.05); if (isl && isl.walk && isl.walk.clear && isl.walk.clear(p.x - isl.pos.x, p.z - isl.pos.z) < .45) continue; base = g; }
    posts.push({ x: p.x, z: p.z, y0: base - (g == null ? .3 : 0), y1: p.y - .3 });
  }
  const postGeo = new THREE.CylinderGeometry(.09, .12, 1, 8);
  const pm = new THREE.InstancedMesh(postGeo, postM, posts.length);
  posts.forEach((q, k) => { const h = q.y1 - q.y0; pm.setMatrixAt(k, M4.compose(V1.set(q.x, q.y0 + h / 2, q.z), Q.identity(), new THREE.Vector3(1, h, 1))); });
  pm.castShadow = !low; root.add(pm);

  // ------------------------------------------------ 車站：海上的木平台（和島面一樣高）＋屋頂＋招牌＋燈號
  const wood = new THREE.MeshStandardMaterial({ color: '#c98a4a', roughness: .85, flatShading: true });
  const st = new THREE.Group(); st.position.copy(stationC); st.rotation.y = Math.atan2(ts.x, ts.z); root.add(st);
  // 站內座標：+z 沿著軌道（行進方向）、-x 往島（平台在島和軌道之間）
  const box = (mat, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = !low; o.receiveShadow = true; st.add(o); return o; };
  const sideSign = Math.sign(new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, st.rotation.y).dot(us)) || 1;   // 站內 +x 指向島外還是島內
  const inX = -sideSign;                                                                                    // 往島的方向（站內 x）
  const PW = 2.6, PLEN = 13;
  box(wood, PW, .16, PLEN, inX * (PW / 2 + .62), H - .08, 0);
  const WK = 3.8;                                                   // 平台接回島上的木棧道
  box(wood, WK, .16, 2, inX * (PW + .62 + WK / 2), H - .1, 0);
  for (const z of [-.9, .9]) box(wood, .14, H + .3, .14, inX * (PW + .62 + WK * .5), (H - .3) / 2, z);
  for (const z of [-6, -2, 2, 6]) for (const x of [inX * .7, inX * (PW + .55)]) box(wood, .16, H + .4, .16, x, (H - .4) / 2, z);
  const roofM = new THREE.MeshStandardMaterial({ color: '#2f7fd1', roughness: .7 });
  for (const z of [-5.5, 5.5]) for (const x of [inX * (PW + .5), -inX * .95]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.6, 8), postM); p.position.set(x, H + 1.3, z); st.add(p); }
  box(roofM, PW + 2.2, .12, PLEN - 1, inX * (PW / 2 - .1), H + 2.65, 0);
  const tex = (() => { const c = document.createElement('canvas'); c.width = 400; c.height = 100; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const paint = () => { x.fillStyle = '#e4532c'; x.beginPath(); x.roundRect(4, 4, 392, 92, 22); x.fill(); x.fillStyle = '#fff'; x.font = "900 44px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🎢 雲霄飛車站', 200, 54); t.needsUpdate = true; };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint); return t; })();
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); sign.scale.set(2.6, .65, 1); sign.position.set(inX * (PW / 2), H + 3.25, 0); st.add(sign);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#4caf50', emissive: '#2e9e3a', emissiveIntensity: 1.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), lampMat); lamp.position.set(inX * (PW + .5), H + 2.3, 5.5); st.add(lamp);
  // 平台踩得到（站內座標換算）
  const inv = new THREE.Matrix4(); st.updateMatrixWorld(true); inv.copy(st.matrixWorld).invert();
  const lp = new THREE.Vector3();
  W.surfaces.push((x, z) => { lp.set(x, 0, z).applyMatrix4(inv); const xi = lp.x * inX; return (xi > .58 && xi < PW + .7 && Math.abs(lp.z) < PLEN / 2) || (xi >= PW + .6 && xi < PW + .62 + WK && Math.abs(lp.z) < 1) ? H : null; });   // 平台＋木棧道接到島上
  const exitSpot = st.localToWorld(new THREE.Vector3(inX * (PW * .55 + .6), 0, 0)).setY(H);

  // ------------------------------------------------ 列車：4 節彩色車廂，第一節是鯉魚頭
  const carCols = ['#e4532c', '#f0b429', '#2f7fd1', '#3e9b4f'];
  const cars = [];
  for (let k = 0; k < CARS; k++) {
    const g = new THREE.Group(); root.add(g);
    const bm = new THREE.MeshStandardMaterial({ color: carCols[k], roughness: .5, metalness: .15, flatShading: true });
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = !low; g.add(o); return o; };
    const B = new THREE.BoxGeometry(1, 1, 1);
    add(B, bm, 0, .22, 0, 1.0, .24, 1.45);                       // 底盤
    add(B, bm, 0, .42, -.62, 1.0, .5, .12);                      // 後背
    add(B, bm, -.48, .42, 0, .06, .3, 1.35); add(B, bm, .48, .42, 0, .06, .3, 1.35);   // 兩側
    add(B, bm, 0, .4, .66, 1.0, .36, .12);                       // 前擋
    add(B, new THREE.MeshStandardMaterial({ color: '#222' }), 0, .36, -.15, .86, .06, .7);   // 座墊
    add(B, new THREE.MeshStandardMaterial({ color: '#cfd6dd', metalness: .6, roughness: .3 }), 0, .66, .5, .8, .05, .05);   // 安全扶手
    for (const z of [-.5, .5]) for (const x of [-.36, .36]) add(new THREE.CylinderGeometry(.09, .09, .1, 10), new THREE.MeshStandardMaterial({ color: '#333' }), x, .08, z).rotation.z = Math.PI / 2;
    if (k === 0) {                                               // 鯉魚頭：紅白鯉魚的臉、鬍鬚
      const w = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .6 });
      add(new THREE.SphereGeometry(.5, 12, 8), w, 0, .42, 1.0, 1, .7, 1.1);
      add(new THREE.SphereGeometry(.5, 12, 8), bm, 0, .62, .92, .8, .45, .8);
      for (const s of [-1, 1]) { add(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshStandardMaterial({ color: '#111' }), s * .32, .55, 1.2); add(new THREE.CylinderGeometry(.015, .015, .4, 4), bm, s * .28, .3, 1.5).rotation.set(1.2, 0, s * .6); }
    }
    cars.push(g);
  }
  // ------------------------------------------------ 狀態
  let cur = { phase: 'dock', s: 0, left: DOCK, eta: 0 }, lastS = 0;
  function timeline(sec) {
    const tc = ((sec % CYCLE) + CYCLE) % CYCLE;
    if (tc < DOCK) return { phase: 'dock', s: 0, left: DOCK - tc, eta: 0 };
    const tr = tc - DOCK, s = sAtTime(tr);
    return { phase: s < topS ? 'lift' : s < BRAKE_S ? 'ride' : 'brake', s, left: 0, eta: RIDE - tr };
  }
  const carQ = [], carP = [];
  function placeCars() {
    for (let k = 0; k < CARS; k++) {
      const sp = sample(cur.s - k * CAR_GAP);
      const q = new THREE.Quaternion().setFromRotationMatrix(basis(sp.t, sp.r));
      cars[k].position.copy(sp.p); cars[k].quaternion.copy(q);
      carQ[k] = q; carP[k] = sp.p;
    }
  }
  placeCars();
  function update() {
    lastS = cur.s;
    cur = timeline(now() / 1000);
    placeCars();
    const c = cur.phase !== 'dock' ? '#e8473f' : cur.left < 6 ? '#ffc23a' : '#4caf50';
    if (lamp.userData.c !== c) { lamp.userData.c = c; lampMat.color.set(c); lampMat.emissive.set(c); }
  }
  // 座位：第 i 位 → 第 floor(i/2) 節、左右
  function seatPose(i) {
    const k = Math.floor(i / 2) % CARS, x = (i % 2 ? 1 : -1) * SEAT_X;
    const pos = cars[k].localToWorld(new THREE.Vector3(x, .14, -.12));
    return { pos, q: cars[k].quaternion.clone(), car: k };
  }
  const hashSeat = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % COASTER_CAP; };
  // 其他登入者在車上：網路位置有延遲，直接排到座位上
  function riderSpot(p, id) {
    if (!p) return null;
    const i = hashSeat(id), sp = seatPose(i);
    const d = Math.hypot(p.x - sp.pos.x, p.z - sp.pos.z), dy = Math.abs((p.y ?? 0) - sp.pos.y);
    // 停站時要剛好坐在座位上；開車後只要在列車附近（網路位置落後）就排進座位
    let near = false; if (cur.phase === 'dock') near = d < .5 && dy < .5; else for (const cp of carP) if (Math.hypot(p.x - cp.x, p.z - cp.z) < 7 && Math.abs((p.y ?? 0) - cp.y) < 4) near = true;
    return near ? { ...sp, seat: i } : null;
  }
  return {
    root, cars, cap: COASTER_CAP, length: L, cycle: CYCLE, ride: RIDE, topY,
    station: { pos: stationC, exit: exitSpot, u: us, t: ts },
    update, seatPose, riderSpot, hashSeat,
    docked: () => cur.phase === 'dock',
    boardOpen: () => cur.phase === 'dock' && cur.left > 3,
    thrill: () => cur.phase === 'ride' && (cur.s - lastS) > 0 && sample(cur.s).t.y < -.25,   // 正在往下衝
    status: () => ({ phase: cur.phase, docked: cur.phase === 'dock', left: Math.ceil(cur.left), eta: Math.ceil(cur.eta), s: cur.s }),
    anchor: () => cars[0].position,
    pick: (ray) => ray.intersectObjects([...cars, st], true).length > 0,
    avoid: [stationC.clone(), exitSpot.clone(), ...posts.filter((q) => q.y0 > 0).map((q) => new THREE.Vector3(q.x, H, q.z))],
    // 測試用：路線上每一點
    debugPts: () => P,
  };
}
