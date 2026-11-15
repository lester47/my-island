// 生活感：居民、送貨員、商人、路人、動物、雲、鳥群、帆船、螢火蟲、貝殼
import * as THREE from 'three';
import { TAU, clamp, lerp, rng, mat, GEO, glowTexture, C } from './kit.js?v=20261115j';
import { H } from './world.js?v=20261115j';

const SKIN = ['#ffd9b8', '#f2c49b', '#e0ad84', '#ffe3c8'];
const SHIRT = ['#e8762b', '#8a5cd0', '#2f7fd1', '#dc4848', '#3e9b4f', '#e3a33b', '#f2f2f2', '#4fb3b0'];
const PANTS = ['#2c3767', '#5b4636', '#3d5a80', '#4a4a4a'];
const HAIR = ['#2b2220', '#4a3326', '#1d1d24', '#6b4a2a'];
const HAT = ['#e3a33b', '#3f7d3a', '#dc4848', '#2f7fd1'];
const PERSON_SCALE = .66;

// ------------------------------------------------------------------ Q 版小人
function makePerson(r, carry = false, look = {}) {
  const g = new THREE.Group();
  const skin = mat(look.skin || SKIN[Math.floor(r() * SKIN.length)]), shirt = mat(look.shirt || SHIRT[Math.floor(r() * SHIRT.length)]);
  const pants = mat(PANTS[Math.floor(r() * PANTS.length)]), hair = mat(HAIR[Math.floor(r() * HAIR.length)]);
  const add = (geo, m, x, y, z, sx, sy, sz, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * .1, .46, 0); g.add(p); add(GEO.box, pants, 0, -.2, 0, .15, .42, .17, p); add(GEO.box, mat('#3a3f4a'), 0, -.42, .04, .16, .08, .24, p); return p; });
  add(new THREE.CylinderGeometry(.2, .25, 1, 8), shirt, 0, .7, 0, 1, .5, 1);
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * .27, .9, 0); g.add(p); add(GEO.box, shirt, 0, -.08, 0, .12, .18, .12, p); add(GEO.box, skin, 0, -.27, 0, .1, .22, .1, p); return p; });
  const head = new THREE.Group(); head.position.y = 1.16; g.add(head);
  add(GEO.sph, skin, 0, 0, 0, .5, .48, .48, head);
  if (look.hat !== false && r() < .5) { add(GEO.cyl12, mat(HAT[Math.floor(r() * HAT.length)]), 0, .2, 0, .42, .14, .42, head); add(GEO.cyl12, mat(HAT[Math.floor(r() * HAT.length)]), 0, .13, .06, .56, .03, .56, head); }
  else { add(GEO.sph, hair, 0, .07, -.03, .53, .4, .52, head); add(GEO.sph, hair, 0, .02, -.08, .5, .44, .44, head); }
  for (const s of [-1, 1]) { add(GEO.sph, mat('#2a1d18'), s * .09, .01, .22, .07, .09, .04, head); add(GEO.sph, mat('#ff9e9e'), s * .15, -.07, .2, .07, .04, .03, head); }
  add(GEO.sph, mat('#9c3b35'), 0, -.09, .225, .08, .035, .03, head);
  let box = null;
  if (carry) { box = add(GEO.box, mat('#d4a571'), 0, 1.55, 0, .5, .36, .4); add(GEO.box, mat('#8d5d35'), 0, 1.55, .205, .52, .06, .02); }
  // 點擊判定用的透明大球
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.85, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .8; g.add(hit);
  g.scale.setScalar(PERSON_SCALE);
  return { g, legs, arms, head, box, hit };
}

// ------------------------------------------------------------------ 動物（原創低多邊形）
function makeAnimal(kind) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const add = (geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, parent = body) => { const o = new THREE.Mesh(geo, mat(c)); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.castShadow = true; parent.add(o); return o; };
  let wings = null;
  if (kind === 'squirrel') {
    add(GEO.sph, '#b5703a', 0, .28, 0, .34, .36, .44); add(GEO.sph, '#b5703a', 0, .52, .18, .28, .28, .28);
    add(GEO.sph, '#f3d7b2', 0, .26, .14, .2, .24, .2);
    for (const s of [-1, 1]) { add(GEO.cone4, '#9a5b2c', s * .08, .7, .16, .07, .14, .07); add(GEO.sph, '#1d1410', s * .07, .55, .31, .045, .05, .03); }
    add(GEO.sph, '#c98345', 0, .58, -.3, .3, .62, .26, -.5); add(GEO.sph, '#c98345', 0, .86, -.24, .26, .3, .24);
  } else if (kind === 'rabbit') {
    add(GEO.sph, '#f6f2ea', 0, .26, 0, .38, .34, .48); add(GEO.sph, '#f6f2ea', 0, .48, .22, .3, .28, .3);
    for (const s of [-1, 1]) { add(GEO.sph, '#f6f2ea', s * .07, .76, .18, .08, .32, .06, -.15, 0, s * .12); add(GEO.sph, '#ffb7c5', s * .07, .76, .2, .04, .22, .02, -.15, 0, s * .12); add(GEO.sph, '#1d1410', s * .08, .5, .36, .045, .05, .03); }
    add(GEO.sph, '#ff9fb2', 0, .46, .37, .04, .03, .03); add(GEO.sph, '#ffffff', 0, .3, -.26, .16, .16, .16);
  } else if (kind === 'duck') {
    add(GEO.sph, '#fbfaf3', 0, .22, 0, .36, .3, .5); add(GEO.sph, '#fbfaf3', 0, .45, .16, .24, .26, .24);
    add(GEO.box, '#ff9d2e', 0, .42, .32, .12, .05, .14); for (const s of [-1, 1]) add(GEO.sph, '#1d1410', s * .07, .5, .26, .035, .04, .03);
    add(GEO.cone4, '#fbfaf3', 0, .3, -.28, .2, .2, .1, -1.2);
  } else if (kind === 'butterfly') {
    add(GEO.sph, '#3a2a24', 0, 0, 0, .06, .06, .28);
    wings = [-1, 1].map((s) => { const p = new THREE.Group(); body.add(p); const w = new THREE.Mesh(new THREE.CircleGeometry(.22, 6), mat(s < 0 ? '#ff9a3d' : '#ffb85a', { side: THREE.DoubleSide })); w.position.x = s * .2; w.rotation.x = -Math.PI / 2; w.scale.set(1, 1.3, 1); p.add(w); const w2 = new THREE.Mesh(new THREE.CircleGeometry(.14, 6), mat('#ffd25a', { side: THREE.DoubleSide })); w2.position.set(s * .16, .005, -.16); w2.rotation.x = -Math.PI / 2; p.add(w2); return p; });
  }
  const hit = new THREE.Mesh(new THREE.SphereGeometry(kind === 'butterfly' ? .7 : .75, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .3; g.add(hit);
  g.scale.setScalar(kind === 'butterfly' ? 1 : .9);
  return { g, body, wings, hit };
}

// ------------------------------------------------------------------ 主程式
export function createLife(W, content, opts) {
  const { scene, islands, bridges } = W;
  const r = rng(115);
  const low = !!opts.halfPeople, lowA = opts.quality === 'low';
  const agents = [], pickables = [];
  const ringPos = (I, ang, rad = I.ring) => new THREE.Vector3(I.pos.x + Math.cos(ang) * rad, H, I.pos.z + Math.sin(ang) * rad);

  // 島民：每座島 2 位，沿石板環狀小路散步
  const resById = Object.fromEntries(content.residents.map((x) => [x.id, x]));
  const islandIds = ['food', 'craft', 'puzzle', 'sport', 'recycle'];
  islandIds.forEach((id, k) => {
    ['a', 'b'].forEach((ab, j) => {
      if (low && j === 1) return;
      const data = resById[`r-${id}-${ab}`];
      const P = makePerson(r, false, { shirt: content.islands[k].color });
      scene.add(P.g);
      const a = { kind: 'resident', data, island: islands[id], P, ang: r() * TAU, dir: r() < .5 ? 1 : -1, mode: 'idle', timer: 1 + r() * 2, nightHide: j === 1, line: 0, wave: 0 };
      agents.push(a); pickables.push({ obj: P.hit, agent: a });
    });
  });
  // 中央島：商人＋路人
  const C0 = islands.center;
  {
    const P = makePerson(r, false, { shirt: '#3f7d3a', hat: false }); scene.add(P.g);
    const m = C0.extras.market.clone(); m.y = H;
    const a = { kind: 'merchant', data: resById.merchant, island: C0, P, fixed: m, mode: 'stand', line: 0, wave: 0, look: 0 };
    agents.push(a); pickables.push({ obj: P.hit, agent: a });
  }
  ['walker-1', 'walker-2'].forEach((id, j) => {
    if (low && j === 1) return;
    const P = makePerson(r); scene.add(P.g);
    const a = { kind: 'resident', data: resById[id], island: C0, P, ang: r() * TAU, dir: j ? -1 : 1, mode: 'walk', timer: 2, nightHide: j === 1, line: 0, wave: 0 };
    agents.push(a); pickables.push({ obj: P.hit, agent: a });
  });
  // 送貨員：從中央市集扛貨箱走橋到各島，交貨後空手回來
  function routeTo(islandId) {
    const b = bridges.find((x) => x.to === islandId), I = islands[islandId];
    const pts = [];
    const m = C0.extras.market; const ma = Math.atan2(m.z, m.x);
    // 中央島：市集 → 沿環走到橋的方向 → 走到橋頭
    const ba = b.a; let d = Math.atan2(Math.sin(ba - ma), Math.cos(ba - ma));
    for (let i = 0; i <= 8; i++) pts.push(ringPos(C0, ma + d * i / 8));
    for (let rr = C0.ring + .8; rr < C0.top(ba) * .95; rr += .8) pts.push(new THREE.Vector3(Math.cos(ba) * rr, H, Math.sin(ba) * rr));
    for (let i = 0; i <= 14; i++) { const t = i / 14; const p = b.p0.clone().lerp(b.p1, t); p.y = H + Math.sin(t * Math.PI) * .9 + .06; pts.push(p); }
    const ia = ba + Math.PI;
    for (let rr = I.top(ia) * .92; rr > I.ring; rr -= .8) pts.push(new THREE.Vector3(I.pos.x + Math.cos(ia) * rr, H, I.pos.z + Math.sin(ia) * rr));
    pts.push(ringPos(I, ia));
    return pts;
  }
  const couriers = low ? 2 : 3;
  for (let c = 0; c < couriers; c++) {
    const P = makePerson(r, true, { shirt: '#e3a33b' }); scene.add(P.g);
    const target = islandIds[(c * 2) % 5];
    const a = { kind: 'courier', data: resById[`courier-${c + 1}`], island: C0, P, route: routeTo(target), target, seg: 0, segT: 0, back: false, carrying: true, mode: 'walk', timer: 0, line: 0, wave: 0, nightHide: c === 2, delay: c * 6 };
    agents.push(a); pickables.push({ obj: P.hit, agent: a });
  }

  // 動物
  const animalLines = Object.fromEntries(content.animals.map((x) => [x.id, x]));
  const animals = [];
  const animalPlan = [['rabbit', 'food'], ['rabbit', 'sport'], ['squirrel', 'craft'], ['squirrel', 'recycle'], ['duck', 'puzzle'], ['duck', 'puzzle'], ['duck', 'puzzle'], ['butterfly', 'center'], ['butterfly', 'food'], ['butterfly', 'craft']];
  animalPlan.forEach(([kind, id], i) => {
    if (lowA && animals.some((a) => a.kind === kind)) return;     // 低畫質：每種只留 1 隻
    const A = makeAnimal(kind); scene.add(A.g);
    const I = islands[id];
    const a = { kind, island: I, A, ang: r() * TAU + i * .4, dir: i % 2 ? 1 : -1, mode: 'walk', timer: 2 + r() * 3, hop: 0, data: animalLines[kind], idx: i };
    if (kind === 'duck') { a.ang = 2.2 + i * .28; a.dir = 1; }
    if (kind === 'butterfly') { a.center = id === 'center' ? I.extras.flowerField.clone() : I.pos.clone().add(new THREE.Vector3(2.4, 0, 1.6)); }
    animals.push(a); pickables.push({ obj: A.hit, animal: a });
  });

  // 雲：繞外圈飄、不擋鏡頭
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: .25 });
  const clouds = [];
  const nClouds = low ? 8 : 11;
  for (let i = 0; i < nClouds; i++) {
    const g = new THREE.Group(), n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(GEO.ball1, cloudMat); s.position.set((k - n / 2) * 3.2 + r() * 1.5, r() * 1.6, r() * 2); s.scale.setScalar(5 + r() * 4); g.add(s); }
    const c = { g, a: i / nClouds * TAU, rad: 105 + r() * 35, y: 24 + r() * 12, sp: .006 + r() * .006 };
    scene.add(g); clouds.push(c);
  }
  // 開場用的雲層（鏡頭會穿過，開場後淡出）
  const deck = new THREE.Group(); const deckMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: .35, transparent: true, opacity: 1 });
  for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(GEO.ball1, deckMat); const a = r() * TAU, d = r() * 70; s.position.set(Math.cos(a) * d - 40, 70 + r() * 8, Math.sin(a) * d - 60); s.scale.set(16 + r() * 14, 6 + r() * 4, 14 + r() * 12); deck.add(s); }
  scene.add(deck); deck.visible = false; deckMat.opacity = 0;

  // 鳥群：V 字隊形
  const flocks = [];
  for (let f = 0; f < (low ? 2 : 3); f++) {
    const g = new THREE.Group(), birds = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group(); const side = i % 2 ? 1 : -1, row = Math.ceil(i / 2);
      b.position.set(side * row * 1.4, 0, -row * 1.3);
      const body = new THREE.Mesh(GEO.cone4, mat('#f4f1ea')); body.rotation.x = Math.PI / 2; body.scale.set(.25, .9, .25); b.add(body);
      const wings = [-1, 1].map((s) => { const p = new THREE.Group(); b.add(p); const w = new THREE.Mesh(GEO.box, mat('#e9e4da')); w.scale.set(.9, .04, .32); w.position.x = s * .45; p.add(w); return p; });
      g.add(b); birds.push({ b, wings, ph: r() * 3 });
    }
    scene.add(g); flocks.push({ g, birds, a: f * 2.1, rad: 44 + f * 9, y: 15 + f * 3, sp: .1 + f * .02 });
  }
  // 帆船
  const boats = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(GEO.box, mat(i ? '#dc4848' : '#2f7fd1')); hull.scale.set(1.3, .5, 3.4); hull.position.y = .3; g.add(hull);
    const bow = new THREE.Mesh(GEO.cone4, mat(i ? '#dc4848' : '#2f7fd1')); bow.rotation.set(Math.PI / 2, Math.PI / 4, 0); bow.scale.set(.92, 1.2, .5); bow.position.set(0, .3, 2.2); g.add(bow);
    const mast = new THREE.Mesh(GEO.cyl6, mat('#8d5d35')); mast.scale.set(.1, 4, .1); mast.position.y = 2.4; g.add(mast);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0, 3.4); shape.lineTo(2.2, .2); shape.lineTo(0, 0);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat('#fbf7ee', { side: THREE.DoubleSide })); sail.position.set(.06, .8, -.2); sail.rotation.y = -Math.PI / 2; g.add(sail);
    const flag = new THREE.Mesh(GEO.box, mat('#e3a33b')); flag.scale.set(.03, .3, .5); flag.position.set(0, 4.35, -.25); g.add(flag);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g); boats.push({ g, a: i * Math.PI + .6, rad: 56 + i * 10, sp: .022 - i * .006 });
  }
  // 鯉魚帆船：船身是一條紅白錦鯉，背鰭當帆，尾鰭在船尾翹起
  {
    const g = new THREE.Group(), red = mat('#e4532c'), white = mat('#fbf3e6'), gold = mat('#f2b33d'), dark = mat('#2a211c');
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), red); body.scale.set(1.15, .72, 2.5); body.position.y = .35; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, TAU, Math.PI * .55, Math.PI * .45), white); belly.scale.set(1.17, .74, 2.52); belly.position.y = .35; g.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), white); head.scale.set(.95, .66, .95); head.position.set(0, .5, 1.95); g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI * .5), red); cap.scale.set(.6, .45, .55); cap.position.set(0, .72, 1.7); g.add(cap);   // 頭頂紅斑（丹頂）
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), white); eye.scale.setScalar(.2); eye.position.set(sx * .72, .66, 2.25); g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), dark); pupil.scale.setScalar(.11); pupil.position.set(sx * .84, .68, 2.31); g.add(pupil);
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(.03, .02, 1, 5), gold); wh.scale.y = .9; wh.position.set(sx * .4, .3, 2.95); wh.rotation.set(Math.PI / 2.6, 0, sx * .5); g.add(wh);   // 鬚
      const fin = new THREE.Mesh(new THREE.ConeGeometry(.5, 1, 4), red); fin.scale.set(.5, 1.1, .12); fin.position.set(sx * 1.1, .2, 1.1); fin.rotation.set(.6, 0, sx * 1.9); g.add(fin);   // 胸鰭
      for (let k = 0; k < 3; k++) { const sc = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI), gold); sc.scale.set(.28, .2, .05); sc.position.set(sx * 1.08, .55, .7 - k * .7); sc.rotation.y = sx * Math.PI / 2; g.add(sc); }   // 金色鱗片
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.2, .07, 6, 12), red); mouth.position.set(0, .45, 2.9); g.add(mouth);
    // 尾鰭：兩片扇形，向上翹
    const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.quadraticCurveTo(.9, .5, 1.5, 1.3); tail.quadraticCurveTo(1.0, .9, .6, .95); tail.quadraticCurveTo(.4, .5, 0, 0);
    for (const sy of [1, -.55]) { const t = new THREE.Mesh(new THREE.ShapeGeometry(tail), mat('#e86a3c', { side: THREE.DoubleSide })); t.rotation.y = Math.PI / 2; t.scale.set(1, sy, 1); t.position.set(0, .62, -2.2); g.add(t); }
    // 桅杆與背鰭帆（前緣高、後緣成波浪狀）
    const mast = new THREE.Mesh(GEO.cyl6, mat('#8d5d35')); mast.scale.set(.1, 4.2, .1); mast.position.set(0, 2.6, .55); g.add(mast);
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0, 3.6); fin.quadraticCurveTo(.9, 3.3, 1.5, 2.6);
    for (let k = 0; k < 4; k++) { const y0 = 2.6 - k * .62; fin.quadraticCurveTo(1.95 - k * .05, y0 - .2, 1.6 - k * .05, y0 - .62); }
    fin.lineTo(0, 0);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(fin), mat('#fbf3e6', { side: THREE.DoubleSide })); sail.rotation.y = -Math.PI / 2; sail.position.set(.04, .95, .45); g.add(sail);
    const band = new THREE.Mesh(new THREE.ShapeGeometry(fin), mat('#e4532c', { side: THREE.DoubleSide })); band.rotation.y = -Math.PI / 2; band.scale.set(.42, .42, 1); band.position.set(.06, 2.3, .45); g.add(band);   // 帆上的紅色鰭紋
    const flag = new THREE.Mesh(GEO.box, gold); flag.scale.set(.03, .32, .55); flag.position.set(0, 4.85, .25); g.add(flag);
    g.scale.setScalar(1.15);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g); boats.push({ g, a: 3.95, rad: 44, sp: .018, carp: true });
  }
  // 螢火蟲
  const nFly = low ? 40 : 90, flyPos = new Float32Array(nFly * 3), flyBase = [];
  const ids = Object.keys(islands);
  for (let i = 0; i < nFly; i++) { const I = islands[ids[i % ids.length]]; const a = r() * TAU, d = r() * I.R * .85; flyBase.push([I.pos.x + Math.cos(a) * d, H + .5 + r() * 2.2, I.pos.z + Math.sin(a) * d, r() * 10]); }
  const flyGeo = new THREE.BufferGeometry(); flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: glowTexture('rgba(230,255,150,1)', 'rgba(200,255,100,0)'), size: .9, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: '#e6ff9a' }));
  scene.add(flies);
  // 貝殼：每座島沙灘上一顆，撿了 20 秒後重生
  const shells = [];
  for (const id of ids) {
    const I = islands[id], g = new THREE.Group();
    for (let k = 0; k < 5; k++) { const rib = new THREE.Mesh(GEO.cone4, mat(k % 2 ? '#ffd6c9' : '#fff1ea')); rib.scale.set(.18, .5, .06); rib.rotation.set(-Math.PI / 2 + .25, 0, (k - 2) * .32); rib.position.set((k - 2) * .07, .06, .1); g.add(rib); }
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
    g.position.copy(I.spot = I.shellSpot); g.scale.setScalar(1.6); scene.add(g);
    const s = { id, g, hit, hiddenUntil: 0 }; shells.push(s); pickables.push({ obj: hit, shell: s });
  }

  // ------------------------------------------------------------ 每幀更新
  const camPos = new THREE.Vector3();
  function poseWalk(P, t, speed = 1) {
    const s = Math.sin(t * 9 * speed);
    P.legs[0].rotation.x = s * .55; P.legs[1].rotation.x = -s * .55;
    P.arms[0].rotation.x = -s * .5; P.arms[1].rotation.x = s * .5; P.arms[0].rotation.z = 0; P.arms[1].rotation.z = 0;
    P.g.children[2].position.y = .7 + Math.abs(s) * .03;
  }
  function poseIdle(P) { for (const l of P.legs) l.rotation.x = 0; for (const a of P.arms) { a.rotation.x = 0; a.rotation.z = 0; } }
  function poseWave(P, t) { poseIdle(P); P.arms[1].rotation.z = 2.5 + Math.sin(t * 10) * .35; }
  function poseCarry(P) { P.arms[0].rotation.z = -2.9; P.arms[1].rotation.z = 2.9; }
  function faceTo(g, from, to) { g.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); }

  let lastNight = 0;
  function update(t, dt, moving, night, camera) {
    dt = Math.min(dt, .05);
    camera.getWorldPosition(camPos);
    const isNight = night > .7;
    // 居民
    for (const a of agents) {
      const P = a.P;
      const hide = isNight && a.nightHide;
      P.g.visible = !hide;
      if (hide) continue;
      if (a.talking) { faceTo(P.g, P.g.position, camPos); poseWave(P, t); continue; }
      if (!moving) { poseIdle(P); if (a.kind === 'courier' && a.carrying) poseCarry(P); if (P.box) P.box.visible = a.carrying; placeStatic(a); continue; }
      if (a.kind === 'merchant') {
        P.g.position.copy(a.fixed); P.g.rotation.y = Math.atan2(-a.fixed.x, -a.fixed.z) + Math.sin(t * .7) * .6; poseIdle(P);
        P.head.rotation.y = Math.sin(t * 1.3) * .5; continue;
      }
      if (a.kind === 'resident') {
        const I = a.island;
        if (isNight && I.extras.house) { // 夜晚：走回房子附近
          const ha = Math.atan2(I.extras.house.z, I.extras.house.x);
          const d = Math.atan2(Math.sin(ha - a.ang), Math.cos(ha - a.ang));
          if (Math.abs(d) > .08) { a.ang += Math.sign(d) * dt * .9 / I.ring; poseWalk(P, t); } else poseIdle(P);
        } else if (a.mode === 'walk') {
          a.ang += a.dir * dt * .9 / I.ring; a.timer -= dt; poseWalk(P, t);
          if (a.timer < 0) { a.mode = r() < .3 ? 'wave' : 'idle'; a.timer = 1 + r() * 3; }
        } else {
          a.timer -= dt; if (a.mode === 'wave') poseWave(P, t); else poseIdle(P);
          if (a.timer < 0) { a.mode = 'walk'; a.timer = 3 + r() * 5; if (r() < .35) a.dir *= -1; }
        }
        const p = ringPos(I, a.ang); P.g.position.copy(p);
        P.g.rotation.y = Math.atan2(-Math.sin(a.ang) * a.dir * -1, Math.cos(a.ang) * a.dir) ;
        P.g.rotation.y = Math.atan2(-Math.sin(a.ang) * a.dir, Math.cos(a.ang) * a.dir) + (a.dir > 0 ? 0 : 0);
        { const tx = -Math.sin(a.ang) * a.dir, tz = Math.cos(a.ang) * a.dir; P.g.rotation.y = Math.atan2(tx, tz); }
        continue;
      }
      if (a.kind === 'courier') {
        if (a.delay > 0) { a.delay -= dt; placeStatic(a); poseIdle(P); if (P.box) P.box.visible = true; poseCarry(P); continue; }
        if (a.mode === 'wave') { a.timer -= dt; poseWave(P, t); if (P.box) P.box.visible = false; if (a.timer < 0) { a.mode = 'walk'; a.back = !a.back; a.carrying = !a.back; if (!a.back) { a.target = islandIds[(islandIds.indexOf(a.target) + 2) % 5]; a.route = routeTo(a.target); } a.seg = 0; a.segT = 0; } continue; }
        const route = a.back ? [...a.route].reverse() : a.route;
        const p0 = route[a.seg], p1 = route[a.seg + 1];
        if (!p1) { a.mode = 'wave'; a.timer = 2.2; if (!a.back) waveNearestResident(a.target, t); continue; }
        const len = p0.distanceTo(p1) || .01; a.segT += dt * 1.25 / len;
        if (a.segT >= 1) { a.seg++; a.segT = 0; }
        P.g.position.lerpVectors(p0, p1, Math.min(1, a.segT)); faceTo(P.g, p0, p1); poseWalk(P, t);
        if (P.box) P.box.visible = a.carrying; if (a.carrying) poseCarry(P);
      }
    }
    // 動物
    for (const a of animals) {
      const I = a.island, A = a.A, g = A.g;
      if (a.kind === 'butterfly') {
        g.visible = !isNight; if (isNight) continue;
        const tt = moving ? t : 0, rr = 1.6 + Math.sin(tt * .5 + a.idx) * .6;
        if (a.talking) { A.body.position.y = Math.abs(Math.sin(t * 6)) * .2; }
        else { g.position.set(a.center.x + Math.cos(tt * .6 + a.idx) * rr, H + 1.3 + Math.sin(tt * 1.7 + a.idx) * .35, a.center.z + Math.sin(tt * .6 + a.idx) * rr); g.rotation.y = -tt * .6 - a.idx; }
        const f = moving ? Math.sin(t * 16 + a.idx) * .9 : .4; A.wings[0].rotation.z = f; A.wings[1].rotation.z = -f;
        continue;
      }
      const shore = a.kind === 'duck';
      const rad = shore ? I.top(a.ang) * 1.13 : I.ring + .9;
      const asleep = isNight;
      if (!a.talking && moving && !asleep) {
        if (a.mode === 'walk') { a.ang += a.dir * dt * (shore ? .5 : .7) / rad; a.timer -= dt; if (a.timer < 0 && !shore) { a.mode = 'look'; a.timer = 1 + r() * 2.5; } }
        else { a.timer -= dt; if (a.timer < 0) { a.mode = 'walk'; a.timer = 2 + r() * 4; if (r() < .3) a.dir *= -1; } }
      }
      const y = shore ? .42 : H;
      g.position.set(I.pos.x + Math.cos(a.ang) * rad, y, I.pos.z + Math.sin(a.ang) * rad);
      if (a.talking) { faceTo(g, g.position, camPos); A.body.position.y = Math.abs(Math.sin(t * 7)) * .25; }
      else {
        const tx = -Math.sin(a.ang) * a.dir, tz = Math.cos(a.ang) * a.dir; g.rotation.y = Math.atan2(tx, tz);
        const walking = moving && !asleep && a.mode === 'walk';
        A.body.position.y = walking ? Math.abs(Math.sin(t * (a.kind === 'rabbit' ? 7 : 9) + a.idx)) * (a.kind === 'rabbit' ? .16 : .05) : 0;
        A.body.rotation.y = !walking && moving && !asleep ? Math.sin(t * 2 + a.idx) * .6 : 0;     // 東張西望
        A.body.scale.y = asleep ? .75 : 1;                                                       // 夜晚趴著睡
      }
    }
    // 雲、鳥、帆船、螢火蟲
    for (const c of clouds) { if (moving) c.a += c.sp * dt; c.g.position.set(Math.cos(c.a) * c.rad, c.y, Math.sin(c.a) * c.rad); c.g.rotation.y = -c.a; }
    cloudMat.color.setScalar(1 - night * .55); cloudMat.emissiveIntensity = .25 - night * .2;
    for (const f of flocks) {
      f.g.visible = !isNight;
      if (moving) f.a += f.sp * dt;
      f.g.position.set(Math.cos(f.a) * f.rad, f.y + Math.sin(t * .5 + f.rad) * 1.2, Math.sin(f.a) * f.rad);
      f.g.rotation.y = -f.a + Math.PI;
      for (const b of f.birds) { const w = moving ? Math.sin(t * 8 + b.ph) * .6 : .1; b.wings[0].rotation.z = w; b.wings[1].rotation.z = -w; }
    }
    for (const b of boats) {
      if (moving) b.a += b.sp * dt;
      b.g.position.set(Math.cos(b.a) * b.rad, moving ? Math.sin(t * 1.2 + b.rad) * .12 : 0, Math.sin(b.a) * b.rad);
      b.g.rotation.set(0, -b.a, moving ? Math.sin(t * .9 + b.rad) * .07 : 0);
    }
    flies.material.opacity = night * .95; flies.visible = night > .05;
    if (flies.visible) { for (let i = 0; i < nFly; i++) { const [x, y, z, p] = flyBase[i]; const tt = moving ? t : 0; flyPos[i * 3] = x + Math.sin(tt * .5 + p) * .8; flyPos[i * 3 + 1] = y + Math.sin(tt * .9 + p * 2) * .35; flyPos[i * 3 + 2] = z + Math.cos(tt * .4 + p) * .8; } flyGeo.attributes.position.needsUpdate = true; }
    // 貝殼重生
    const now = performance.now();
    for (const s of shells) { s.g.visible = now >= s.hiddenUntil; if (s.g.visible) s.g.rotation.y = moving ? t * .6 : 0; }
    lastNight = night;
  }
  function placeStatic(a) {
    if (a.kind === 'resident') { a.P.g.position.copy(ringPos(a.island, a.ang)); }
    else if (a.kind === 'merchant') a.P.g.position.copy(a.fixed);
    else if (a.kind === 'courier') { const route = a.back ? [...a.route].reverse() : a.route; const p0 = route[a.seg] || route[0]; a.P.g.position.copy(p0); }
  }
  function waveNearestResident(islandId) {
    const res = agents.find((x) => x.kind === 'resident' && x.island === islands[islandId] && !x.talking);
    if (res) { res.mode = 'wave'; res.timer = 2.2; }
  }

  return {
    agents, animals, shells, pickables, deck, deckMat, update,
    setDeck(op) { deckMat.opacity = op; deck.visible = op > .01; },
    headOf(o) { // 對話泡泡的位置
      if (o.agent) return o.agent.P.g.position.clone().add(new THREE.Vector3(0, 1.5 * PERSON_SCALE + .55, 0));
      if (o.animal) return o.animal.A.g.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      return o.shell.g.position.clone();
    },
  };
}
