// 可以互動的地標：跨橋迎賓、果汁杯泡泡、貼紙牆、彈珠滾進終點、舊物翻牌、陀螺擂台示範、
// 風車水面倒影、橋下小魚群、鯉魚號靠岸儀式、五島合照點
import * as THREE from 'three';

const TAU = Math.PI * 2;
const M = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o })); };
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(.5, .5, 1, 12), sph: new THREE.SphereGeometry(.5, 12, 10), cone: new THREE.ConeGeometry(.5, 1, 8) };
const add = (p, geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; p.add(m); return m; };
const ease = (k) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

// 文字貼圖（倒數、翻牌小點子）
function textTexture(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const paint = (...a) => { const g = cv.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, ...a); tex.needsUpdate = true; };
  return { tex, paint };
}
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

export function createInteract(W, content, H, api) {
  const { scene, islands } = W;
  const root = new THREE.Group(); scene.add(root);
  const picks = [];            // { obj, act }
  const anim = [];
  const wp = (I, x, y, z) => I.extras.lm.localToWorld(new THREE.Vector3(x, y, z));

  // ------------------------------------------------ ② 巨型果汁杯：走近冒泡、吸管晃動；點杯子看美食攤位
  const F = islands.food;
  if (F && F.extras.cup) {
    const cup = F.extras.cup, straw = cup.children[3];
    const bubMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', transparent: true, opacity: .75, roughness: .2 });
    const bubs = []; for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(G.sph, bubMat); m.visible = false; cup.add(m); bubs.push({ m, t: i / 7 * 2.2, x: (Math.random() - .5) * .5, z: (Math.random() - .5) * .5, s: .1 + Math.random() * .08 }); }
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(.75, .6, 1.8, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .2; cup.add(hit);
    picks.push({ obj: hit, act: () => { api.toast('🧃 果汁杯：美食補給島有 5 攤點心和飲料，帶你去看！'); api.openStalls('food'); } });
    anim.push((t, dt, ctx) => {
      const cw = new THREE.Vector3(); cup.getWorldPosition(cw);
      const near = ctx.walkPos ? ctx.walkPos.distanceTo(cw) < 7 : ctx.camera.position.distanceTo(cw) < 13;
      if (straw) straw.rotation.z = .25 + (near ? Math.sin(t * 3) * .15 : 0);
      for (const b of bubs) {
        b.t = (b.t + dt) % 2.2; b.m.visible = near;
        b.m.position.set(b.x * (1 + b.t * .2), .7 + b.t * .55, b.z * (1 + b.t * .2)); b.m.scale.setScalar(b.s * Math.min(1, b.t * 3));
      }
    });
  }

  // ------------------------------------------------ ③ 立體貼紙牆：第 6 攤旁，點牆就貼上一張鯉魚貼紙
  const s6 = api.stallPos(6);
  if (s6) {
    const g = new THREE.Group(); g.position.copy(s6.g.position); g.rotation.y = s6.g.rotation.y; root.add(g);
    const wall = new THREE.Group(); wall.position.set(1.25, 0, -.1); g.add(wall);
    add(wall, G.box, '#7a4a22', -.55, .75, 0, .07, 1.5, .07); add(wall, G.box, '#7a4a22', .55, .75, 0, .07, 1.5, .07);
    add(wall, G.box, '#fffaf0', 0, 1.0, 0, 1.12, .9, .05); add(wall, G.box, '#8a5cd0', 0, 1.5, 0, 1.18, .1, .07);
    const shapes = [['#ff6b6b', G.sph], ['#ffd25a', G.box], ['#4aa3e8', G.cone], ['#5ec26a', G.cyl]];
    shapes.forEach(([c, geo], i) => add(wall, geo, c, -.36 + i * .24, .45, .12, .14, .14, .06));
    const kt = [1, 2, 3, 4, 5].map((n) => { const t = new THREE.TextureLoader().load(`assets/koi/koi-${n}.png`); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .5 }); });
    const slots = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) slots.push([-.33 + c * .33, 1.27 - r * .25]);
    const placed = []; let n = 0;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, .4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, .9, 0); wall.add(hit);
    picks.push({ obj: hit, act: () => {
      if (placed.length >= slots.length) { for (const m of placed) wall.remove(m); placed.length = 0; }
      const [x, y] = slots[placed.length], m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3 / 2.8), kt[n++ % 5]); m.position.set(x, y, .035); m.rotation.z = (Math.random() - .5) * .3; m.scale.setScalar(.01); wall.add(m); placed.push(m);
      const t0 = performance.now(); anim.push(function grow() { const k = Math.min(1, (performance.now() - t0) / 350); m.scale.setScalar(.01 + k * 1.2 - Math.max(0, k - .8) * 1); return k >= 1; });
      api.toast(`🎨 貼上一張鯉魚貼紙！（${placed.length}/9）第 06 攤可以自己畫貼紙喔`);
    } });
  }

  // ------------------------------------------------ ④ 彈珠迷宮：迷宮旁一支「▶ 看彈珠怎麼走」小牌子，點一下播放一趟，播完就停在終點
  const Pz = islands.puzzle;
  if (Pz && Pz.extras.marble) {
    const marble = Pz.extras.marble, lm = Pz.extras.lm;
    Pz.extras.marbleHold = true;                       // 平常彈珠停在起點，不再亂繞
    const path = [[-1.35, 1.0], [-.35, 1.0], [-.35, -.05], [.45, -.05], [.45, .9], [1.35, .9], [1.35, -.2], [1.2, -.8]].map(([x, z]) => new THREE.Vector3(.3 + x, H + .62, .3 + z));
    const toW = (v) => lm.localToWorld(v.clone());
    marble.position.copy(path[0]);
    // 起點綠旗、終點已經有紅圈
    add(lm, G.cyl, '#ffffff', path[0].x - .15, H + .9, path[0].z + .2, .03, .6, .03); add(lm, G.box, '#3ed16a', path[0].x - .02, H + 1.1, path[0].z + .2, .24, .16, .02);
    // 路線提示：播放時沿路亮起小點
    const dots = []; for (let i = 1; i < path.length; i++) for (let k = 0; k < 3; k++) { const v = path[i - 1].clone().lerp(path[i], (k + .5) / 3); const d = add(lm, G.sph, '#ffd23a', v.x, H + .45, v.z, .09, .03, .09); d.visible = false; dots.push(d); }
    // 播放牌子
    const lbl = textTexture(320, 96, (g) => { g.fillStyle = '#2f7fd1'; g.beginPath(); g.roundRect(4, 4, 312, 88, 22); g.fill(); g.fillStyle = '#fff'; g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('▶ 看彈珠怎麼走', 160, 52); });
    lbl.paint();
    const sign = new THREE.Group(); sign.position.set(.3 - 2.0, H, .3 + 1.6); lm.add(sign);
    add(sign, G.cyl, '#7a4a22', 0, .55, 0, .06, 1.1, .06);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lbl.tex })); sp.scale.set(1.5, .45, 1); sp.position.y = 1.3; sign.add(sp);
    let run = null;
    const start = () => {
      if (run) return; run = { t: 0 }; marble.position.copy(path[0]); dots.forEach((d) => (d.visible = false));
      api.toast('🔵 彈珠從綠旗出發，沿著木軌道走到紅色終點就過關（第 11 攤玩法）');
    };
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 2.8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(.3, H + .45, .3); lm.add(hit);
    picks.push({ obj: sp, act: start }); picks.push({ obj: hit, act: start });
    const lens = []; let total = 0; for (let i = 1; i < path.length; i++) { const L = path[i].distanceTo(path[i - 1]); lens.push(L); total += L; }
    anim.push((t, dt) => {
      sp.position.y = 1.3 + Math.sin(t * 2.2) * .06;
      if (!run) return;
      run.t += dt * 1.4; let d = run.t;
      if (d >= total) {
        marble.position.copy(path[path.length - 1]); marble.position.y += Math.abs(Math.sin(run.t * 8)) * .1 * Math.max(0, 1 - (run.t - total));
        if (run.t > total + 1.0 && !run.done) { run.done = true; api.toast('🎯 進洞了！這就是過關。到現場第 11 攤試試看吧'); }
        if (run.t > total + 4) { run = null; marble.position.copy(path[0]); dots.forEach((q) => (q.visible = false)); }   // 播完就停，幾秒後彈珠回到起點
        return;
      }
      let i = 0; while (d > lens[i]) { d -= lens[i]; i++; }
      marble.position.lerpVectors(path[i], path[i + 1], d / lens[i]); marble.rotation.x += dt * 8;
      const shown = Math.floor((i + d / lens[i]) * 3); dots.forEach((q, k) => (q.visible = k < shown));
    });
  }

  // ------------------------------------------------ ⑤ 舊物翻牌：點書櫃，翻出一張「這件舊物還可以怎麼用」的小卡
  const Rc = islands.recycle;
  if (Rc && Rc.extras.shelf) {
    const sh = Rc.extras.shelf, lm = Rc.extras.lm;
    const IDEAS = [['📚 舊繪本', '剪下喜歡的圖，做成書籤或卡片'], ['🧸 舊玩偶', '洗乾淨，送到二手攤找新主人'], ['📦 紙盒', '變成收納盒，或做成彈珠迷宮'], ['🧦 單隻襪子', '塞棉花縫成小玩偶'], ['🥫 鐵罐', '貼上貼紙當筆筒'], ['👕 小件衣服', '剪成抹布，或交換給弟弟妹妹'], ['🧩 缺片拼圖', '拼成相框邊框'], ['🍼 寶特瓶', '做成小花盆或存錢筒']];
    const card = textTexture(512, 300, (g, a, b) => {
      g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(6, 6, 500, 288, 28); g.fill(); g.lineWidth = 10; g.strokeStyle = '#3e9b4f'; g.stroke();
      g.fillStyle = '#286b34'; g.font = `900 30px ${FONT}`; g.textAlign = 'center'; g.fillText('這件舊物還可以怎麼用？', 256, 62);
      g.fillStyle = '#2a1d12'; g.font = `900 56px ${FONT}`; g.fillText(a, 256, 145);
      g.font = `700 34px ${FONT}`; g.fillText(b, 256, 222);
    });
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .88), new THREE.MeshStandardMaterial({ map: card.tex, transparent: true, emissive: '#ffffff', emissiveMap: card.tex, emissiveIntensity: .2, side: THREE.DoubleSide }));
    const holder = new THREE.Group(); holder.position.set(sh.x, H + 2.25, sh.z); holder.rotation.y = sh.ry; holder.visible = false; holder.add(cm); lm.add(holder);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, .8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(sh.x, H + .85, sh.z); hit.rotation.y = sh.ry; lm.add(hit);
    let k = 0, flip = null;
    picks.push({ obj: hit, act: () => { const [a, b] = IDEAS[k++ % IDEAS.length]; card.paint(a, b); holder.visible = true; flip = { t: 0 }; } });
    anim.push((t, dt, ctx) => {
      if (!flip) return; flip.t += dt;
      cm.rotation.y = flip.t < .5 ? Math.PI * (1 - flip.t / .5) : 0;   // 翻過來
      const cw = new THREE.Vector3(); holder.getWorldPosition(cw); holder.lookAt(ctx.camera.position.x, cw.y, ctx.camera.position.z); holder.rotation.x = 0; holder.rotation.z = 0;
      if (flip.t > 6) { holder.visible = false; flip = null; }
    });
  }

  // ------------------------------------------------ ⑥ 陀螺擂台示範：3、2、1 倒數 → 兩顆陀螺旋轉碰撞 → 一顆慢慢倒下
  const Sp = islands.sport;
  if (Sp && Sp.extras.tops && Sp.extras.tops.length >= 2) {
    Sp.extras.topsHold = true;
    const [A, B] = Sp.extras.tops, lm = Sp.extras.lm, cx = 1.6, cz = -1.4, y0 = H + .42;
    const cd = textTexture(256, 256, (g, s) => { g.fillStyle = s === 'GO!' ? '#3e9b4f' : '#dc4848'; g.beginPath(); g.arc(128, 128, 118, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = `900 ${s.length > 1 ? 92 : 150}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 128, 138); });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: cd.tex, transparent: true })); spr.scale.set(1.1, 1.1, 1); spr.position.set(cx, H + 2.4, cz); lm.add(spr);
    let T = 0, shown = '';
    anim.push((t, dt) => {
      T = (T + dt) % 14;
      const label = T < 1 ? '3' : T < 2 ? '2' : T < 3 ? '1' : T < 3.8 ? 'GO!' : '';
      if (label !== shown) { shown = label; spr.visible = !!label; if (label) cd.paint(label); }
      if (T < 3) { // 準備：兩顆停在擂台兩邊
        A.position.set(cx - .8, y0, cz); B.position.set(cx + .8, y0, cz); A.rotation.set(0, 0, 0); B.rotation.set(0, 0, 0);
        return;
      }
      const k = T - 3;
      let ra = .8 * Math.max(.25, 1 - k / 4), rb = ra, ang = k * 2.2;
      // 碰撞：每轉半圈相撞一次，往外彈一下
      const hitK = Math.max(0, Math.sin(k * 4.4)) ** 8 * .25;
      A.position.set(cx + Math.cos(ang + Math.PI) * (ra + hitK), y0, cz + Math.sin(ang + Math.PI) * (ra + hitK));
      A.rotation.y += dt * 30; A.rotation.z = Math.sin(t * 9) * .05;
      if (k < 6.5) { B.position.set(cx + Math.cos(ang) * (rb + hitK), y0, cz + Math.sin(ang) * (rb + hitK)); B.rotation.y += dt * 30 * Math.max(.2, 1 - k / 7); B.rotation.z = Math.sin(t * 6) * (.05 + k * .04); }
      else { const f = Math.min(1, (k - 6.5) / 1.2); B.rotation.z = ease(f) * 1.35; B.rotation.y += dt * 3 * (1 - f); }   // 慢慢倒下
      if (k > 6.5 && k < 6.6) api.toastNear(Sp, '🌀 紅色陀螺轉得比較久，紅色獲勝！');
    });
  }

  // ------------------------------------------------ ⑦ 風車的水面倒影：葉片和鯉魚輪廓跟著轉，加一點波紋晃動
  const C0 = islands.center;
  if (C0 && C0.extras.blades) {
    const bl = C0.extras.blades, wm = C0.extras.windmill;
    const a = Math.atan2(wm.z, wm.x), edge = C0.top(a) * 1.0 + 2.2;
    const base = new THREE.Vector3(Math.cos(a) * edge, 0, Math.sin(a) * edge);
    // 倒影平躺在水面上，從島邊往外延伸（像水面映出的風車），略壓扁並微微晃動
    const ref = new THREE.Group(); ref.position.set(base.x, .06, base.z); ref.rotation.set(Math.PI / 2, 0, 0); ref.rotation.order = 'YXZ'; ref.rotation.y = -a + Math.PI / 2; ref.scale.set(1, .8, .02); root.add(ref);
    const fade = (m) => { const c = m.clone(); c.transparent = true; c.opacity = .38; c.depthWrite = false; return c; };
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(.55, 1.0, 4, 8), fade(mat('#f4efe4'))); tower.position.y = 2; ref.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(.75, 1.1, 8), fade(mat('#c4553a'))); roof.position.y = 4.55; ref.add(roof);
    const blades = bl.clone(true); blades.traverse((o) => { if (o.isMesh) { o.material = fade(o.material); o.castShadow = false; } });
    blades.position.set(Math.sin(.5) * .95, 3.9, Math.cos(.5) * .95); ref.add(blades);
    ref.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 2; } });
    anim.push((t) => { blades.rotation.z = bl.rotation.z; ref.position.x = base.x + Math.sin(t * 1.7) * .06; ref.scale.x = 1 + Math.sin(t * 2.3) * .04; });
  }

  // ------------------------------------------------ ⑧ 橋下小魚群：服務台到美食補給島的橋下，人走過橋時散開，再慢慢聚回來
  const fb = W.bridges.find((b) => b.to === 'food') || W.bridges[0];
  if (fb) {
    const mid = fb.p0.clone().lerp(fb.p1, .5); mid.y = 0;
    const fish = [];
    const cols = ['#ff7a3d', '#ffffff', '#ffd23a', '#e8473f', '#2f7fd1', '#ff9ec4', '#ff7a3d', '#ffd23a'];
    for (let i = 0; i < 8; i++) {
      const f = new THREE.Group(); root.add(f);
      add(f, new THREE.OctahedronGeometry(.5, 0), cols[i], 0, 0, 0, .16, .1, .34);
      add(f, G.cone, cols[(i + 3) % cols.length], 0, 0, -.22, .14, .14, .04, Math.PI / 2);
      add(f, G.cone, cols[i], 0, .08, 0, .03, .1, .1);
      fish.push({ f, a: i / 8 * TAU, r: .5 + (i % 3) * .3, sp: .9 + (i % 4) * .15, scat: 0 });
    }
    anim.push((t, dt, ctx) => {
      const near = ctx.walkPos && ctx.walkPos.distanceTo(new THREE.Vector3(mid.x, ctx.walkPos.y, mid.z)) < 3.2;
      for (const q of fish) {
        q.scat = near ? Math.min(1, q.scat + dt * 3) : Math.max(0, q.scat - dt * .4);
        q.a += dt * q.sp * (1 + q.scat * 2);
        const r = q.r + q.scat * 2.4, x = mid.x + Math.cos(q.a) * r, z = mid.z + Math.sin(q.a) * r * .7;
        const px = q.f.position.x, pz = q.f.position.z; q.f.position.set(x, -.02 + Math.sin(t * 3 + q.a) * .03, z);
        q.f.rotation.y = Math.atan2(x - px, z - pz);
      }
    });
  }

  // ------------------------------------------------ ⑨ 鯉魚號靠岸儀式：碼頭旗子升起、燈號黃轉綠，再放下跳板
  if (W.pier && api.carp) {
    const P = W.pier, entry = P.E.clone().addScaledVector(P.d, P.ST1 + .3).addScaledVector(P.s, -(P.PW + .35));
    const pole = add(root, G.cyl, '#d8d2c4', entry.x, .8 + 1.4, entry.z, .06, 2.8, .06);
    const flag = new THREE.Group(); flag.position.set(entry.x, .8 + .3, entry.z); root.add(flag);
    add(flag, G.box, '#e8473f', .32, 0, 0, .6, .36, .02); add(flag, G.box, '#ffffff', .32, 0, .012, .36, .1, .01);
    { const tx = new THREE.TextureLoader().load('assets/brand/koi-logo.png?v=20261124h'); tx.colorSpace = THREE.SRGBColorSpace; const lm = new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .4, polygonOffset: true, polygonOffsetFactor: -2 }); for (const sd of [1, -1]) { const L = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), lm); L.position.set(.32, 0, sd * .022); if (sd < 0) L.rotation.y = Math.PI; flag.add(L); } }   // 碼頭旗子上的鯉魚 Logo
    const lampMat = new THREE.MeshStandardMaterial({ color: '#444', emissive: '#000000', roughness: .4 });
    const lampPos = P.E.clone().addScaledVector(P.d, P.P1 - .2).addScaledVector(P.s, P.PW + .1);
    add(root, G.cyl, '#5a3a1a', lampPos.x, .8 + .45, lampPos.z, .08, .9, .08);
    add(root, G.box, '#222', lampPos.x, .8 + 1.0, lampPos.z, .26, .26, .26); add(root, G.sph, lampMat, lampPos.x, .8 + 1.0, lampPos.z, .24, .24, .24);
    let fy = 0, lastDock = false;
    anim.push((t, dt) => {
      const s = api.carp.status();
      const target = s.docked ? 2.3 : .3; fy += (target - fy) * Math.min(1, dt * 1.2);
      flag.position.y = .8 + fy; flag.rotation.y = Math.sin(t * 2) * .2;
      const col = s.docked ? (s.gang ? '#3ed16a' : '#ffc83d') : '#555555';
      lampMat.color.set(col); lampMat.emissive.set(s.docked ? col : '#000000'); lampMat.emissiveIntensity = s.docked ? 1.2 : 0;
      if (s.docked && !lastDock) api.toastIf('⚓ 鯉魚號靠岸了！碼頭旗子升起，燈號轉綠就能上下船');
      lastDock = s.docked;
    });
  }

  let photoPosV = null;
  // ------------------------------------------------ ⑩ 五島合照點：服務台的地面腳印，點一下鏡頭轉到能拍進風車、木橋與鯉魚號航道的角度
  if (C0) {
    const spot = api.freeSpot ? api.freeSpot('center') : null;
    const pos = spot ? new THREE.Vector3(spot.x, H, spot.z) : new THREE.Vector3(2.5, H, 6.2);
    photoPosV = pos;
    const g = new THREE.Group(); g.position.copy(pos); root.add(g);
    add(g, G.cyl, '#ffd23a', 0, .02, 0, 1.1, .03, 1.1);
    for (const [x, z, r] of [[-.16, -.12, .2], [.16, .12, -.2]]) { add(g, G.sph, '#7a3d00', x, .045, z, .16, .02, .26, 0, r); add(g, G.sph, '#7a3d00', x, .045, z + .2, .1, .02, .08); }
    const camSign = textTexture(256, 96, (q) => { q.fillStyle = '#e8762b'; q.beginPath(); q.roundRect(4, 4, 248, 88, 20); q.fill(); q.fillStyle = '#fff'; q.font = `900 40px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('📸 合照點', 128, 52); });
    camSign.paint();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: camSign.tex })); sp.scale.set(1.2, .45, 1); sp.position.y = 1.4; g.add(sp);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 1.6, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .8; g.add(hit);
    picks.push({ obj: hit, act: () => api.photoSpot() });
    picks.push({ obj: sp, act: () => api.photoSpot() });
    // 漫遊走到腳印上：只提示「點牌子拍合照」，不自動跳出漫遊
    // （以前會自動跳回鳥瞰；已加入市集的人再按漫遊會回到腳印上又被踢出去，卡在原地進退不得）
    anim.push((t, dt, ctx) => {
      sp.position.y = 1.4 + Math.sin(t * 2) * .08;
      if (!ctx.walkPos) return;
      const d = Math.hypot(ctx.walkPos.x - pos.x, ctx.walkPos.z - pos.z);
      if (d < .6 && !ctx.photoLock) { ctx.photoLock = true; api.toast('📸 站上合照點了！點上面的「📸 合照點」牌子，鏡頭會轉到最佳合照角度'); }
      else if (d > 1.2) ctx.photoLock = false;
    });
  }

  // ------------------------------------------------ 每格更新與點擊
  const ctx = { camera: W.camera, walkPos: null, photoLock: false };
  function update(t, dt, moving, walkPos) {
    ctx.walkPos = walkPos || null;
    if (!moving) return;
    for (let i = anim.length - 1; i >= 0; i--) if (anim[i](t, dt, ctx) === true) anim.splice(i, 1);
  }
  function pick(ray) {
    const hit = ray.intersectObjects(picks.map((p) => p.obj), false)[0];
    if (!hit) return false;
    picks.find((p) => p.obj === hit.object).act(); return true;
  }
  return { update, pick, photoPos: () => (photoPosV ? photoPosV.clone() : null) };
}
