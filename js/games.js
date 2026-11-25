// 小遊戲：🎣 釣魚（三個釣魚區）與 🙈 躲貓貓（找出 5 個躲起來的小朋友）
import * as THREE from 'three';

const TAU = Math.PI * 2;
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const M = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o })); };
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(.5, .5, 1, 10), sph: new THREE.SphereGeometry(.5, 12, 10), cone: new THREE.ConeGeometry(.5, 1, 10) };
const add = (p, geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; p.add(m); return m; };
function label(text, bg, w = 360) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = 100;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => { const g = cv.getContext('2d'); g.clearRect(0, 0, w, 100); g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, 92, 24); g.fill(); g.fillStyle = '#fff'; g.font = `900 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 54); tex.needsUpdate = true; };
  paint(); if (document.fonts) document.fonts.ready.then(paint);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); s.scale.set(w / 100 * .42, .42, 1); return s;
}

// 釣得到的東西（weight 越大越常見）
export const FISH = [
  { id: 'tilapia', name: '吳郭魚', icon: '🐟', w: 30, size: [18, 30] },
  { id: 'zacco', name: '溪哥', icon: '🐠', w: 24, size: [8, 14] },
  { id: 'carp', name: '鯉魚', icon: '🐟', w: 18, size: [30, 55], img: 3 },
  { id: 'kohaku', name: '紅白錦鯉', icon: '🎏', w: 12, size: [25, 45], img: 1 },
  { id: 'ogon', name: '黃金錦鯉（稀有）', icon: '✨', w: 5, size: [30, 50], img: 2 },
  { id: 'bottle', name: '寶特瓶（垃圾）', icon: '🧴', w: 11, trash: true },
];

export function createGames(W, content, H, api) {
  const { scene, islands } = W;
  const root = new THREE.Group(); scene.add(root);
  const picks = [], anim = [];
  const R = Math.random;

  // ================================================================ 🎣 釣魚
  const spots = [];
  function fishingSpot(pos, dir, name) {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = Math.atan2(dir.x, dir.z); root.add(g);
    add(g, G.box, '#a8743f', 0, .03, 0, 1.3, .06, 1.0);                                   // 小木平台
    add(g, G.cyl, '#7a4a22', -.5, .2, -.2, .3, .3, .3);                                   // 小板凳
    add(g, G.cyl, '#2f7fd1', .45, .16, -.25, .38, .26, .38);                              // 水桶
    add(g, G.cyl, '#1d5aa0', .45, .3, -.25, .4, .03, .4);
    const rodHold = add(g, G.cyl, '#5a3a1a', -.45, .35, .35, .06, .5, .06);                // 竿架
    const rackRod = add(g, G.cyl, '#3a2a1a', -.45, .95, .75, .03, 1.5, .03, .75);         // 立著的釣竿（釣魚時拿起來）
    const sp = label('🎣 釣魚區', '#2f7fd1'); sp.position.set(0, 1.9, 0); g.add(sp);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1; g.add(hit);
    // 浮標：釣魚時出現在前方水面
    const bob = new THREE.Group(); bob.visible = false; root.add(bob);
    add(bob, G.sph, '#ffffff', 0, 0, 0, .18, .18, .18); add(bob, G.sph, '#e8473f', 0, .08, 0, .19, .1, .19); add(bob, G.cyl, '#222', 0, .18, 0, .02, .16, .02);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; root.add(ring);
    const water = pos.clone().addScaledVector(dir, 3.2); water.y = .05;
    // 手上的釣竿：握把在人的右前方，往前倒是 rotation.x 變大
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const rod = new THREE.Group(); rod.position.copy(pos).addScaledVector(dir, .45).addScaledVector(side, -.38); rod.position.y = pos.y + .6; rod.rotation.y = Math.atan2(dir.x, dir.z); rod.visible = false; root.add(rod);
    const tilt = new THREE.Group(); rod.add(tilt);
    add(tilt, G.cyl, '#2a2a2a', 0, .15, 0, .05, .3, .05); add(tilt, G.cyl, '#8b5a2b', 0, 1.25, 0, .028, 1.9, .028);   // 握把＋竿身
    add(tilt, G.cyl, '#c0c0c0', .05, .32, 0, .1, .06, .1, 0, 0, Math.PI / 2);                                       // 捲線器
    const tip = new THREE.Object3D(); tip.position.y = 2.2; tilt.add(tip);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#f4f4f4' })); line.frustumCulled = false; line.visible = false; root.add(line);
    const s = { g, pos, dir, name, bob, ring, water, rod, tilt, tip, line, rackRod, stand: pos.clone().addScaledVector(dir, -.1) };
    spots.push(s); picks.push({ obj: hit, act: () => goFish(s) }); picks.push({ obj: sp, act: () => goFish(s) });
    anim.push((t) => { sp.position.y = 1.9 + Math.sin(t * 2 + spots.length) * .05; });
  }
  // ① 鯉魚號碼頭的棧道盡頭（棧道旁）
  if (W.pier) {
    const P = W.pier, pos = P.E.clone().addScaledVector(P.d, P.ST1 + 1.4).addScaledVector(P.s, -(P.PW - .55));
    const g0 = W.ground(pos.x, pos.z); if (g0 != null) { pos.y = g0; fishingSpot(pos, P.s.clone().negate(), '碼頭釣魚區'); }
  }
  // ②③ 美食補給島、循環挖寶島的外側岸邊
  for (const id of ['food', 'recycle']) {
    const I = islands[id]; if (!I) continue;
    const out = Math.atan2(I.pos.z, I.pos.x);
    for (const da of [.6, -.6, .9, -.9, .4, -.4, 1.2, -1.2]) {   // 不放正外側：那裡是島名牌的位置，會擋住釣魚區招牌
      const a = out + da, r = I.top(a) * .8, x = I.pos.x + Math.cos(a) * r, z = I.pos.z + Math.sin(a) * r;
      if (W.ground(x, z) == null || api.nearBooth(x, z, 2.2)) continue;
      fishingSpot(new THREE.Vector3(x, H, z), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), (content.islands.find((q) => q.id === id) || {}).name + '岸邊釣魚區');
      break;
    }
  }

  // 釣魚面板（畫面下方）
  const ui = document.getElementById('fishUI');
  const uiTxt = ui.querySelector('.ft'), uiBtn = ui.querySelector('.fb'), uiLog = ui.querySelector('.fl');
  const logGet = () => api.store.get('fishlog', {}) || {};
  function refreshLog() { const L = logGet(), n = FISH.filter((f) => L[f.id]).length; uiLog.textContent = `📖 圖鑑 ${n}/${FISH.length}`; }
  let fish = null;   // { s, state: 'idle'|'wait'|'bite'|'done', t, biteAt }
  function goFish(s) {
    const stand = s.pos.clone(); const h = W.ground(stand.x, stand.z); if (h != null) stand.y = h;
    api.enterWalk({ pos: stand, yaw: Math.atan2(s.dir.x, s.dir.z) });
    api.toast(`🎣 來到${s.name}！按「拋竿」開始釣魚`);
  }
  function setState(st, txt, btn) { fish.state = st; uiTxt.textContent = txt; uiBtn.textContent = btn; uiBtn.dataset.state = st; }
  uiBtn.addEventListener('click', () => {
    if (!fish) return;
    const st = fish.state;
    if (st === 'idle' || st === 'done') cast();
    else if (st === 'wait') { reel(); setState('idle', '太早收竿了，魚還沒咬鉤！再拋一次吧', '🎣 拋竿'); }
    else if (st === 'bite') { reel(); catchFish(); }
  });
  ui.querySelector('.fl').addEventListener('click', () => api.openFishLog());
  ui.querySelector('.frules').addEventListener('click', () => api.openRules('fish'));
  // ---- 拋竿動畫：竿子往後舉 → 往前甩 → 浮標畫弧線飛出去落水；收竿：竿子往上提、浮標拉回來
  // 等待 1～5 分鐘才會知道有沒有魚上鉤（約 4 次有 1 次沒有魚）
  const FAST = /fishfast/.test(location.search);              // 測試用：?fishfast 縮短等待
  const WAIT_MIN = FAST ? 3 : 60, WAIT_MAX = FAST ? 6 : 300, BITE_WIN = 3;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function cast() {
    const s = fish.s; fish.t = 0; fish.anim = { kind: 'cast', t: 0 }; fish.lastSec = -1;
    fish.biteAt = WAIT_MIN + R() * (WAIT_MAX - WAIT_MIN); fish.none = R() < .25; fish.nibbles = [];
    for (let k = 8 + R() * 12; k < fish.biteAt - 4; k += 10 + R() * 25) fish.nibbles.push(k);     // 偶爾小魚啄一下
    s.rackRod.visible = false; s.rod.visible = true; s.line.visible = true; s.bob.visible = true;
    setState('cast', '揮竿！浮標飛出去了…', '🎣 拋竿中…');
  }
  function reel() { const s = fish.s; fish.anim = { kind: 'reel', t: 0, from: s.bob.position.clone() }; s.ring.material.opacity = 0; }
  function rodDone(s) { s.rod.visible = false; s.line.visible = false; s.bob.visible = false; s.rackRod.visible = true; s.ring.material.opacity = 0; }
  const _tip = new THREE.Vector3();
  function rodAnim(dt) {
    const s = fish.s, A = fish.anim; if (!A) return;
    A.t += dt; const k = A.t;
    s.tip.getWorldPosition(_tip);
    if (A.kind === 'cast') {
      // 0～0.4 秒往後舉，0.4～0.7 秒往前甩，0.55 秒浮標出手，1.4 秒落水
      s.tilt.rotation.x = k < .4 ? .3 - (k / .4) * .9 : k < .7 ? -.6 + ((k - .4) / .3) * 1.9 : 1.3 - Math.min(1, (k - .7) / .5) * .1;
      if (k < .55) s.bob.position.copy(_tip).y -= .25;
      else { const u = Math.min(1, (k - .55) / .85); if (!A.from) A.from = _tip.clone(); s.bob.position.lerpVectors(A.from, s.water, u); s.bob.position.y = A.from.y + (s.water.y - A.from.y) * u + Math.sin(u * Math.PI) * 1.6; }
      if (k >= 1.4) {
        s.bob.position.copy(s.water); fish.anim = null; s.ring.position.set(s.water.x, .06, s.water.z); fish.splash = 0;
        setState('wait', '浮標下水了…耐心等魚上鉤（1～5 分鐘），浮標往下沉、冒出水波就快按「收竿」！', '⏳ 等待中…（按了會收竿）');
      }
    } else if (A.kind === 'reel') {
      const u = Math.min(1, k / .6);
      s.tilt.rotation.x = 1.2 - u * 1.4;
      s.bob.position.lerpVectors(A.from, _tip, u); s.bob.position.y += Math.sin(u * Math.PI) * .6;
      if (k >= .7) { fish.anim = null; rodDone(s); s.tilt.rotation.x = .3; }
    }
  }
  function pickFish() { const tot = FISH.reduce((a, f) => a + f.w, 0); let r = R() * tot; for (const f of FISH) { r -= f.w; if (r <= 0) return f; } return FISH[0]; }
  function catchFish() {
    const f = pickFish(), L = logGet(), first = !L[f.id];
    const cm = f.size ? Math.round(f.size[0] + R() * (f.size[1] - f.size[0])) : 0;
    const rec = L[f.id] || { n: 0, best: 0 }; rec.n++; if (cm > rec.best) rec.best = cm; L[f.id] = rec; api.store.set('fishlog', L);
    jump(fish.s, f);
    let msg = f.trash ? `${f.icon} 釣到${f.name}！撿起來丟回收桶，湖水更乾淨了 👍` : `${f.icon} 釣到${f.name}！${cm} 公分`;
    if (first) { msg += '　📖 新的圖鑑！'; api.reward('shell', 1); msg += ' 送你一個貝殼🐚'; }
    const done = FISH.every((q) => L[q.id]);
    if (done && !api.store.get('fishAll', false)) { api.store.set('fishAll', true); api.reward('postcard', 1); msg = `🏆 圖鑑全部收集完成！送你島主的明信片 💌`; }
    setState('done', msg, '🎣 再釣一次'); refreshLog(); api.toast(msg);
  }
  // 釣到時，魚從浮標的位置跳出水面
  function jump(s, f) {
    let m;
    if (f.img) { const tx = new THREE.TextureLoader().load(`assets/koi/koi-${f.img}.png`); tx.colorSpace = THREE.SRGBColorSpace; m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx })); m.scale.set(1.2, .43, 1); }
    else if (f.trash) { m = new THREE.Group(); add(m, G.cyl, '#9fd3f5', 0, 0, 0, .18, .45, .18, 0, 0, 1.2); add(m, G.cyl, '#2f7fd1', -.22, .12, 0, .1, .08, .1, 0, 0, 1.2); }
    else { m = new THREE.Group(); add(m, new THREE.OctahedronGeometry(.5, 0), f.id === 'zacco' ? '#7fb3d5' : '#8a9a7a', 0, 0, 0, .22, .16, .55); add(m, G.cone, '#6a7a5a', 0, 0, -.32, .22, .2, .05, Math.PI / 2); }
    root.add(m); const p0 = s.water.clone(); const t0 = performance.now();
    anim.push(() => { const k = (performance.now() - t0) / 1100; if (k >= 1) { root.remove(m); return true; } m.position.set(p0.x - s.dir.x * k * 2.2, .1 + Math.sin(k * Math.PI) * 2.2, p0.z - s.dir.z * k * 2.2); if (m.isGroup) m.rotation.z = k * 6; });
  }
  function fishUpdate(t, dt, walkPos) {
    const near = walkPos ? spots.find((s) => Math.hypot(s.pos.x - walkPos.x, s.pos.z - walkPos.z) < 1.8) : null;
    if (near && (!fish || fish.s !== near)) { if (fish) rodDone(fish.s); fish = { s: near }; setState('idle', `${near.name}：按「拋竿」，看到浮標往下沉就按「收竿」！`, '🎣 拋竿'); refreshLog(); }
    if (!near && fish) { rodDone(fish.s); fish = null; }
    ui.hidden = !fish;
    if (!fish) return;
    const s = fish.s;
    rodAnim(dt);
    if (s.line.visible) { s.tip.getWorldPosition(_tip); const a = s.line.geometry.attributes.position; a.setXYZ(0, _tip.x, _tip.y, _tip.z); a.setXYZ(1, s.bob.position.x, s.bob.position.y + .18, s.bob.position.z); a.needsUpdate = true; }
    if (fish.splash != null) { fish.splash += dt; s.ring.scale.setScalar(1 + fish.splash * 5); s.ring.material.opacity = Math.max(0, .9 - fish.splash * 1.2); if (fish.splash > .8) fish.splash = null; }
    if (fish.state === 'wait' || fish.state === 'bite') {
      fish.t += dt;
      if (fish.state === 'wait') {
        const nb = fish.nibbles.find((k) => fish.t > k && fish.t < k + .6);          // 小魚啄一下：浮標輕輕抖
        s.bob.position.y = .05 + Math.sin(t * 3) * .03 - (nb != null ? Math.abs(Math.sin(t * 25)) * .05 : 0);
        if (!fish.anim) s.tilt.rotation.x = 1.2 + Math.sin(t * 1.5) * .02;
        const sec = Math.floor(fish.t); if (sec !== fish.lastSec) { fish.lastSec = sec; uiTxt.textContent = `⏳ 已經等了 ${mmss(fish.t)}（1～5 分鐘才知道有沒有魚）${nb != null ? '　…浮標動了一下，還不是喔' : ''}　浮標往下沉、冒出水波就快按「收竿」！`; }
        if (fish.t > fish.biteAt) {
          if (fish.none) { reel(); setState('idle', `等了 ${mmss(fish.t)}，這次沒有魚上鉤…換個時間再拋一次吧！`, '🎣 拋竿'); }
          else { setState('bite', '❗ 魚咬鉤了！快按「收竿」！（3 秒內）', '🐟 收竿！'); fish.biteT = 0; }
        }
      } else {
        fish.biteT += dt; s.bob.position.y = -.12 + Math.sin(t * 22) * .06; s.tilt.rotation.x = 1.1 + Math.sin(t * 18) * .06;
        s.ring.position.set(s.water.x, .06, s.water.z); s.ring.scale.setScalar(1 + (fish.biteT % .5) * 4); s.ring.material.opacity = .8 - (fish.biteT % .5) * 1.6;
        if (fish.biteT > BITE_WIN) { reel(); setState('idle', '哎呀，魚跑掉了！下次看到浮標下沉要快一點', '🎣 拋竿'); }
      }
    } else if (fish.splash == null) s.ring.material.opacity = 0;
  }

  // ================================================================ 🙈 躲貓貓
  const HUI = document.getElementById('hideUI');
  const hTxt = HUI.querySelector('.ht'), hMeter = HUI.querySelector('.hm');
  let hide = null, hideSign = null;   // { list: [{ g, P, found, pos }], t0, limit }
  // 開始牌子：放在服務台
  {
    // 服務台上找一塊空地；空地不夠時退而求其次，放在步道外側最近的可走位置
    let s = api.freeSpot('center');
    if (!s) { const C0 = islands.center; for (const a of [2.2, 2.8, 1.6, 3.4, 1.0, 4.0]) { const r = C0.walk.radAt(a) + .9, x = C0.pos.x + Math.cos(a) * r, z = C0.pos.z + Math.sin(a) * r; if (W.ground(x, z) != null && !api.nearBooth(x, z, 1.5)) { s = { x, z }; break; } } }
    if (s) {
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); root.add(g);
      add(g, G.cyl, '#7a4a22', 0, .7, 0, .07, 1.4, .07);
      const sp = label('🙈 躲貓貓', '#8a5cd0'); sp.position.y = 1.65; g.add(sp); hideSign = g;
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1; g.add(hit);
      picks.push({ obj: hit, act: () => (hide ? startHide() : api.openHideMenu(startHide)) }); picks.push({ obj: sp, act: () => (hide ? startHide() : api.openHideMenu(startHide)) });
      anim.push((t) => { sp.position.y = 1.65 + Math.sin(t * 2.4) * .06; });
    }
  }
  // ---------------- 躲貓貓掩體：每座島 3～4 個（灌木叢、稻草堆、木箱堆、大木桶、遊戲隧道、紙箱屋），蹲下就藏得住
  const covers = [];
  const COVER = {
    bush(g) { for (const [x, z, s] of [[0, 0, 1], [.45, .15, .8], [-.4, .2, .85], [.1, -.35, .75]]) add(g, new THREE.IcosahedronGeometry(.5, 0), ['#4e9a3d', '#5fae49', '#3f8a35'][Math.floor(Math.abs(x * 10)) % 3], x, .45 * s, z, 1.0 * s, .95 * s, 1.0 * s); return .8; },
    hay(g) { add(g, G.cyl, '#e8c25a', 0, .45, 0, 1.3, .9, 1.3); add(g, G.cyl, '#d4a83f', 0, .91, 0, 1.25, .04, 1.25); for (const y of [.25, .65]) add(g, G.cyl, '#b8862f', 0, y, 0, 1.32, .04, 1.32); add(g, G.box, '#e8c25a', .75, .3, .2, .7, .6, .5, 0, .4); return .85; },
    crates(g) { add(g, G.box, '#b5803f', -.3, .35, 0, .7, .7, .7); add(g, G.box, '#a8743f', .4, .35, .1, .7, .7, .7, 0, .3); add(g, G.box, '#c48a4f', 0, 1.0, .05, .65, .6, .65, 0, -.2); for (const [x, y] of [[-.3, .35], [.4, .35]]) add(g, G.box, '#7a4a22', x, y, .36, .72, .08, .02); return .8; },
    barrels(g) { for (const [x, z] of [[-.35, 0], [.35, 0], [0, .5]]) { add(g, G.cyl, '#8b5a2b', x, .5, z, .62, 1.0, .62); for (const y of [.2, .8]) add(g, G.cyl, '#3a3a3a', x, y, z, .64, .05, .64); } return .8; },
    tube(g) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, 1.8, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#e8473f', side: THREE.DoubleSide, roughness: .6 })); m.rotation.z = Math.PI / 2; m.position.y = .62; m.castShadow = true; g.add(m); for (const x of [-.9, .9]) add(g, new THREE.TorusGeometry(.62, .06, 6, 16), '#ffd23a', x, .62, 0, 1, 1, 1, 0, Math.PI / 2); return .9; },
    box(g) { add(g, G.box, '#c9a06a', 0, .55, 0, 1.2, 1.1, 1.0); add(g, G.cone, '#b5803f', 0, 1.35, 0, 1.2, .5, 1.0, 0, Math.PI / 4); add(g, G.box, '#3a2a1a', 0, .4, .51, .4, .6, .02); add(g, G.box, '#ffffff', .35, .8, .51, .22, .18, .02); return .75; },
  };
  const coverKinds = Object.keys(COVER);
  // 掩體放在步道外側的草地：避開橋頭、攤子、樹和彼此
  function coverSpot(id) {
    const I = islands[id], bA = [...(I.bridgeAngles || []), ...(I.entryAngles || [])];   // 橋頭、碼頭和棧道入口都要讓開
    for (let i = 0; i < 600; i++) {
      const th = R() * TAU; if (bA.some((b) => Math.abs(Math.atan2(Math.sin(th - b), Math.cos(th - b))) < .45)) continue;
      const lo = I.walk.radAt(th) + .9, hi = I.top(th) * .9; if (hi < lo) continue;
      const r = lo + R() * (hi - lo), x = I.pos.x + Math.cos(th) * r, z = I.pos.z + Math.sin(th) * r;
      if (W.ground(x, z) == null || I.walk.clear(x - I.pos.x, z - I.pos.z) < .75 - i / 1200) continue;
      if (api.nearBooth(x, z, i < 200 ? 2.2 : 1.7) || covers.some((c) => Math.hypot(c.x - x, c.z - z) < 2.8)) continue;
      if ((I.trees || []).some((tr) => tr.visible && Math.hypot(tr.position.x + I.pos.x - x, tr.position.z + I.pos.z - z) < 1.1)) continue;
      return { x, z };
    }
    return null;
  }
  for (const id of Object.keys(islands)) {
    for (let k = 0; k < (id === 'center' ? 3 : 4); k++) {
      const s = coverSpot(id); if (!s) continue;
      const kind = coverKinds[covers.length % coverKinds.length];
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); g.rotation.y = R() * TAU; root.add(g);
      const r = COVER[kind](g); W.blockers.push({ x: s.x, z: s.z, r: r * .85 });
      covers.push({ x: s.x, z: s.z, id, kind, r, g });
    }
  }
  const COVER_NAME = { bush: '灌木叢後面', hay: '稻草堆後面', crates: '木箱堆後面', barrels: '大木桶後面', tube: '遊戲隧道旁', box: '紙箱屋後面' };
  // 可以躲的地方：樹的後面、攤子的後面、掩體的後面
  function hidingSpots() {
    const out = [];
    for (const c of covers) { const I = islands[c.id]; const a = Math.atan2(c.z - I.pos.z, c.x - I.pos.x) + (R() - .5); out.push({ x: c.x + Math.cos(a) * (c.r + .45), z: c.z + Math.sin(a) * (c.r + .45), id: c.id, where: COVER_NAME[c.kind] }); }
    for (const [id, I] of Object.entries(islands)) {
      for (const tr of I.trees || []) { if (!tr.visible) continue; const w = tr.position.clone().add(I.pos); const a = Math.atan2(tr.position.z, tr.position.x); out.push({ x: w.x + Math.cos(a) * .7, z: w.z + Math.sin(a) * .7, id, where: '樹後面' }); }
    }
    for (const b of api.booths()) { const fx = Math.sin(b.rotation.y), fz = Math.cos(b.rotation.y); out.push({ x: b.position.x - fx * .95, z: b.position.z - fz * .95, id: b.userData.island, where: '攤子後面' }); }
    return out.filter((p) => W.ground(p.x, p.z) != null);
  }
  function makeHider(p, i) {
    const g = new THREE.Group(); g.position.set(p.x, H, p.z); g.rotation.y = R() * TAU; root.add(g);
    const P = api.makePerson(i, ['#ff8a3d', '#2f7fd1', '#ffd23a', '#e8473f', '#5ec26a'][i % 5]); g.add(P.g);
    P.g.scale.set(.85, .62, .85);                                                    // 蹲著
    for (const l of P.legs) l.rotation.x = -1.2;
    add(P.head, G.cone, '#ff8a3d', 0, .42, 0, .32, .4, .32); add(P.head, G.sph, '#ffffff', 0, .66, 0, .1, .1, .1);   // 橘色鯉魚帽
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.8, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .6; g.add(hit);
    const h = { g, P, hit, found: false, pos: new THREE.Vector3(p.x, H, p.z), where: p.where, id: p.id };
    picks.push({ obj: hit, act: () => tryFind(h, true) });
    return h;
  }
  function startHide() {
    if (hide) { api.toast('🙈 躲貓貓已經在進行中！'); return; }
    const all = hidingSpots(); if (all.length < 5) { api.toast('這次找不到足夠的躲藏地點，請稍後再試'); return; }
    // 盡量分散在不同的島
    const pool = all.sort(() => R() - .5), chosen = [], used = new Set();
    for (const p of pool) { if (chosen.length >= 5) break; if (used.has(p.id) && pool.some((q) => !used.has(q.id) && !chosen.includes(q))) continue; if (chosen.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 4)) continue; chosen.push(p); used.add(p.id); }
    for (const p of pool) { if (chosen.length >= 5) break; if (!chosen.includes(p) && !chosen.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 3)) chosen.push(p); }
    hide = { list: chosen.map(makeHider), t0: performance.now(), limit: 180 };
    HUI.hidden = false;
    if (!api.isWalking()) api.enterWalk(null);
    api.toast('🙈 5 個戴橘色鯉魚帽的小朋友躲起來了！3 分鐘內走過去找到他們（越靠近，溫度計越熱🔥）');
  }
  function tryFind(h, clicked) {
    if (!hide || h.found) return;
    const wp = api.walkPos(); if (!wp) { api.toast('要用「🚶 漫遊」走過去才能找到喔'); return; }
    const d = Math.hypot(wp.x - h.pos.x, wp.z - h.pos.z);
    if (d > (clicked ? 4 : 1.4)) { if (clicked) api.toast('再走近一點才抓得到！'); return; }
    h.found = true; h.P.g.scale.set(.85, .85, .85); for (const l of h.P.legs) l.rotation.x = 0; h.P.arms[1].rotation.z = 2.6;
    const n = hide.list.filter((x) => x.found).length;
    api.toast(n < 5 ? `🎉 找到了！躲在${h.where}（${n}/5）` : '');
    if (n >= 5) endHide(true);
  }
  function endHide(win) {
    if (!hide) return;
    const sec = Math.round((performance.now() - hide.t0) / 1000);
    if (win) {
      const best = api.store.get('hideBest', 0);
      const nb = !best || sec < best; if (nb) api.store.set('hideBest', sec);
      api.reward('cookie', 1);
      api.toast(`🏆 5 個都找到了！花了 ${Math.floor(sec / 60)} 分 ${sec % 60} 秒${nb ? '，新紀錄！' : `（最佳 ${best} 秒）`} 送你一塊餅乾🍪`);
    } else {
      const left = hide.list.filter((x) => !x.found);
      api.toast(`⏰ 時間到！還有 ${left.length} 個沒找到，他們躲在：${[...new Set(left.map((x) => x.where))].join('、')}`);
    }
    const L = hide.list; hide = null; HUI.hidden = true;
    setTimeout(() => { for (const h of L) { root.remove(h.g); const i = picks.findIndex((p) => p.obj === h.hit); if (i >= 0) picks.splice(i, 1); } }, win ? 4000 : 8000);
    if (!win) for (const h of L) if (!h.found) { const s = label('我在這裡！', '#e8473f', 300); s.position.y = 1.4; h.g.add(s); }
  }
  HUI.querySelector('.hr').addEventListener('click', () => api.openRules('hide'));
  HUI.querySelector('.hq').addEventListener('click', () => { if (hide) { api.toast('已結束躲貓貓'); endHide(false); } });
  function hideUpdate(t, dt, walkPos) {
    if (!hide) return;
    const left = Math.max(0, hide.limit - (performance.now() - hide.t0) / 1000);
    const found = hide.list.filter((x) => x.found).length;
    let near = Infinity;
    for (const h of hide.list) {
      if (h.found) { h.P.arms[1].rotation.z = 2.4 + Math.sin(t * 10) * .4; continue; }
      h.P.head.rotation.y = Math.sin(t * 1.3 + h.pos.x) * .6;           // 偷偷東張西望
      if (walkPos) { near = Math.min(near, Math.hypot(walkPos.x - h.pos.x, walkPos.z - h.pos.z)); tryFind(h, false); }
    }
    if (!hide) return;
    const temp = !walkPos ? ['🚶', '按「漫遊」走過去找'] : near < 3 ? ['🔥', '熱燙燙！就在旁邊'] : near < 7 ? ['🌤️', '溫溫的，很接近了'] : near < 14 ? ['❄️', '有點涼'] : ['🧊', '冰冰的，往別的島找找'];
    hTxt.textContent = `🙈 躲貓貓　找到 ${found}/5　⏱ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    hMeter.textContent = `${temp[0]} ${temp[1]}`;
    if (left <= 0) endHide(false);
  }

  // ================================================================ 每格更新與點擊
  function update(t, dt, moving, walkPos) {
    fishUpdate(t, dt, walkPos);
    hideUpdate(t, dt, walkPos);
    if (!moving) return;
    for (let i = anim.length - 1; i >= 0; i--) if (anim[i](t, dt) === true) anim.splice(i, 1);
  }
  function pick(ray) {
    const hit = ray.intersectObjects(picks.map((p) => p.obj), false)[0];
    if (!hit) return false;
    picks.find((p) => p.obj === hit.object).act(); return true;
  }
  return { update, pick, startHide, spots, covers, hideSign: () => hideSign, onExitWalk: () => { if (hide) { api.toast('離開漫遊，躲貓貓結束'); endHide(false); } } };
}
