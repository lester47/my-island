// 登入者：自己的人物＋頭上名牌；之後接上連線服務時，其他人也用同一套顯示（upsert / remove）
import * as THREE from 'three';
import { rng } from './kit.js?v=20261118l';
import { makePerson } from './life.js?v=20261118l';
import { ROLES, HATS } from './roles.js?v=20261118l';
const SPAWN = { x: 0, z: 7.4, yaw: Math.PI };

const seedOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 登入者上衣胸前的小鯉魚 Logo（和網站左上角同一張圖）
let LOGO_MAT = null;
function withLogo(P) {
  if (!LOGO_MAT) { const tx = new THREE.TextureLoader().load('assets/brand/koi-logo.png?v=20261118l'); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; LOGO_MAT = new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .4, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.17, .17), LOGO_MAT);
  m.position.set(0, .76, .232); m.rotation.x = -.1;          // 上衣是上窄下寬的圓柱，貼片稍微往後仰才貼合
  P.g.add(m); P.logo = m; return P;
}
// 帽子：前面都有一個小鯉魚 Logo（帽色跟衣服同色系，草帽、鯉魚帽固定色）
const HG = { cyl: new THREE.CylinderGeometry(.5, .5, 1, 16), sph: new THREE.SphereGeometry(.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cone: new THREE.ConeGeometry(.5, 1, 14), box: new THREE.BoxGeometry(1, 1, 1) };
const HM = new Map(); const hmat = (c) => { if (!HM.has(c)) HM.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: .75 })); return HM.get(c); };
function hatPart(g, geo, c, x, y, z, sx, sy, sz, rx = 0) { const m = new THREE.Mesh(geo, hmat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; }
function withHat(P, kind, shirt) {
  if (P.hat) { P.head.remove(P.hat); P.hat = null; }
  if (!kind || kind === 'none' || !HATS[kind]) return P;
  const g = new THREE.Group(), c = shirt || '#2f7fd1';
  let ly = .12, lz = .245, ls = .1;                                          // Logo 位置
  if (kind === 'cap') { hatPart(g, HG.sph, c, 0, .05, 0, .54, .46, .54); hatPart(g, HG.cyl, c, 0, .06, .2, .36, .02, .28); hatPart(g, HG.sph, '#ffffff', 0, .28, 0, .06, .06, .06); }
  else if (kind === 'bucket') { hatPart(g, HG.cyl, '#f3ead2', 0, .15, 0, .48, .2, .48); hatPart(g, HG.cyl, '#f3ead2', 0, .06, 0, .74, .02, .74); hatPart(g, HG.cyl, c, 0, .08, 0, .5, .05, .5); ly = .17; lz = .245; }
  else if (kind === 'beanie') { hatPart(g, HG.sph, c, 0, .04, 0, .55, .58, .55); hatPart(g, HG.cyl, '#ffffff', 0, .06, 0, .56, .07, .56); hatPart(g, HG.sph, '#ffffff', 0, .33, 0, .14, .22, .14); ly = .15; lz = .26; }
  else if (kind === 'straw') { hatPart(g, HG.cyl, '#e8c86a', 0, .16, 0, .46, .2, .46); hatPart(g, HG.cyl, '#e8c86a', 0, .07, 0, .86, .02, .86); hatPart(g, HG.cyl, '#d0453a', 0, .1, 0, .475, .05, .475); ly = .18; lz = .235; }
  else if (kind === 'koi') { hatPart(g, HG.sph, '#ff8a3d', 0, .05, 0, .54, .5, .54); hatPart(g, HG.cone, '#ff8a3d', 0, .1, -.32, .2, .3, .1, -1.7); hatPart(g, HG.sph, '#ffffff', -.1, .2, .17, .07, .07, .07); hatPart(g, HG.sph, '#ffffff', .1, .2, .17, .07, .07, .07); hatPart(g, HG.sph, '#222222', -.1, .2, .2, .035, .035, .035); hatPart(g, HG.sph, '#222222', .1, .2, .2, .035, .035, .035); ly = .08; lz = .26; ls = .09; }
  const L = new THREE.Mesh(new THREE.PlaneGeometry(ls, ls), LOGO_MAT); L.position.set(0, ly, lz); L.rotation.x = -.35; g.add(L);
  P.head.add(g); P.hat = g; return P;
}
const dress = (P, info) => withHat(withLogo(P), info.hat, info.shirt);
export function createPlayers(W, H) {
  const { scene, camera } = W;
  const layer = document.createElement('div'); layer.className = 'nametags'; layer.setAttribute('aria-hidden', 'true');
  document.getElementById('stage').append(layer);
  const all = new Map();   // id → player
  let meId = null;

  function build(id, info) {
    const P = dress(makePerson(rng(seedOf(id)), false, { shirt: info.shirt, hat: false }), info);
    scene.add(P.g);
    const tag = document.createElement('div'); tag.className = 'ntag';
    layer.append(tag);
    const p = { id, info: {}, P, tag, pos: new THREE.Vector3(SPAWN.x, H, SPAWN.z), yaw: SPAWN.yaw, target: null, moving: 0, phase: Math.random() * 6 };
    all.set(id, p); setInfo(p, info); return p;
  }
  function setInfo(p, info) {
    const old = p.info; p.info = { ...info };
    if (old.shirt && old.shirt !== info.shirt) { const keep = { pos: p.pos.clone(), yaw: p.yaw }; scene.remove(p.P.g); p.P = dress(makePerson(rng(seedOf(p.id)), false, { shirt: info.shirt, hat: false }), info); scene.add(p.P.g); p.pos.copy(keep.pos); p.yaw = keep.yaw; p.baseS = null; }
    else if (old.name && (old.hat || 'none') !== (info.hat || 'none')) withHat(p.P, info.hat, info.shirt);
    const R = ROLES[info.role] || ROLES.visitor;
    p.tag.style.setProperty('--rc', R.color);
    p.tag.classList.toggle('me', p.id === meId);
    p.tag.innerHTML = `<span class="r">${R.icon} ${R.label}</span><b>${escH(info.name)}</b>${p.id === meId ? '<i>我</i>' : ''}${p.badge ? `<em class="bd">${escH(p.badge)}</em>` : ''}`;
  }
  function remove(id) { const p = all.get(id); if (!p) return; scene.remove(p.P.g); p.tag.remove(); all.delete(id); }

  // 自己
  function setMe(profile) {
    if (meId && (!profile || profile.id !== meId)) { remove(meId); meId = null; }
    if (!profile) return;
    meId = profile.id;
    const p = all.get(meId) || build(meId, profile); setInfo(p, profile);
  }
  const me = () => (meId ? all.get(meId) : null);

  // 其他人（連線版用）：位置平滑移動過去
  function upsert(id, info, pos) {
    if (id === meId) return;
    const p = all.get(id) || build(id, info);
    if (info.name !== p.info.name || info.role !== p.info.role || info.shirt !== p.info.shirt || (info.hat || 'none') !== (p.info.hat || 'none')) setInfo(p, info);
    if (pos) { if (!p.target) { p.pos.set(pos.x, pos.y ?? H, pos.z); p.yaw = pos.yaw || 0; } p.target = pos; }
  }

  const _v = new THREE.Vector3();
  // 姿勢：走路擺手腳；坐著（在鯉魚號上）時腿往前伸、身體放低，跟船上的小朋友一樣
  const SIT_DROP = .2;
  function pose(P, t, walking, sitting) {
    if (sitting) {
      for (const l of P.legs) l.rotation.x = -Math.PI / 2 + .25;
      P.arms[0].rotation.set(0, 0, -.15); P.arms[1].rotation.set(0, 0, .15);
      return;
    }
    const s = walking ? Math.sin(t * 9) : 0;
    P.legs[0].rotation.x = s * .55; P.legs[1].rotation.x = -s * .55;
    P.arms[0].rotation.set(-s * .5, 0, 0); P.arms[1].rotation.set(s * .5, 0, 0);
  }
  const onBoat = (p) => !!(W.onBoat && W.onBoat(p.x, p.z));
  // walk：鏡頭漫遊狀態（自己的位置）；firstPerson 時藏起自己的人物
  function update(dt, t, walk, walking, firstPerson, w, h) {
    const m = me();
    if (m && walking) {
      // 只有真的按了前進／後退／側移才算走路；站在船上被船載著移動不算
      const k = walk.keys, pd = walk.pad;
      const input = !!(k.KeyW || k.KeyS || k.KeyA || k.KeyD || k.ArrowUp || k.ArrowDown || pd.up || pd.down);
      m.moving = input ? .15 : Math.max(0, m.moving - dt);
      m.pos.copy(walk.pos); m.yaw = walk.yaw;
      // 跳起來時人物往上；蹲下時把高度記成「地面往下 0.3」，其他人的畫面就知道你蹲著（不用改資料格式）
      if (walk.jumpY > 0) m.pos.y += walk.jumpY; else if (walk.ck > .5) m.pos.y -= .3;
    } else if (m) m.moving = 0;
    for (const p of all.values()) {
      if (p.target && p.id !== meId) {
        const k = Math.min(1, dt * 6), dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z;
        p.moving = Math.hypot(dx, dz) > .05 ? .25 : Math.max(0, p.moving - dt);
        p.pos.x += dx * k; p.pos.z += dz * k; p.pos.y += ((p.target.y ?? H) - p.pos.y) * k;
        let dy = (p.target.yaw || 0) - p.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; p.yaw += dy * k;
      }
      // 其他登入者若位置在水面上（不是陸地、橋、碼頭，也不在鯉魚號上），先不顯示——舊版網頁可能還在送海上的位置
      const offLand = p.id !== meId && W.ground(p.pos.x, p.pos.z) == null && !onBoat(p.pos);
      const hide = (p.id === meId && walking && firstPerson) || offLand;
      const tagOff = hiddenTags.has(p.id);
      p.P.g.visible = !hide;
      // 在船上：自己沒按方向鍵就坐好；其他人在船上一律坐著（位置變動是船在動）
      const sit = onBoat(p.pos) && (p.id === meId ? !(p.moving > 0) : true);
      const gy = W.ground(p.pos.x, p.pos.z), crouch = !sit && gy != null && p.pos.y < gy - .15;
      p.P.g.position.copy(p.pos); if (crouch) p.P.g.position.y = gy; if (sit) p.P.g.position.y -= SIT_DROP; p.P.g.rotation.y = p.yaw;
      if (p.baseS == null) p.baseS = p.P.g.scale.y;
      p.P.g.scale.y += ((crouch ? p.baseS * .66 : p.baseS) - p.P.g.scale.y) * Math.min(1, dt * 12);   // 蹲下：身體縮矮
      pose(p.P, t + p.phase, p.moving > 0 && !sit, sit);
      if (crouch) for (const l of p.P.legs) l.rotation.x = -.9;
      // 名牌：投影到畫面上，在頭頂上方
      _v.set(p.pos.x, p.pos.y + 1.02, p.pos.z).project(camera);
      const dist = camera.position.distanceTo(p.pos);
      const off = hide || tagOff || _v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1 || (dist > 70 && p.id !== meId);
      p.tag.hidden = off;
      if (!off) {
        p.tag.style.transform = `translate(${((_v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - _v.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
        p.tag.style.zIndex = String(1000 - Math.round(dist));
        p.tag.classList.toggle('far', dist > 30);
      }
    }
  }
  // 給連線版：自己目前的位置
  function myPos() { const m = me(); return m ? { x: +m.pos.x.toFixed(2), y: +m.pos.y.toFixed(2), z: +m.pos.z.toFixed(2), yaw: +m.yaw.toFixed(2) } : null; }
  function spawnFor() { const m = me(); return m ? { pos: m.pos.clone(), yaw: m.yaw } : null; }
  // 鯉魚號上的登入者人數（不含自己；在海上而不顯示的人不算）
  // 多人小遊戲用：名牌加一個小標籤（例如「👹 鬼」）、或整個藏起名牌
  function setBadge(id, text) { const p = all.get(id); if (!p || p.badge === text) return; p.badge = text || ''; setInfo(p, p.info); }
  const hiddenTags = new Set();
  function hideTag(id, on) { if (on) hiddenTags.add(id); else hiddenTags.delete(id); }
  function posOf(id) { const p = all.get(id); return p ? p.pos : null; }
  function onBoatCount() { let n = 0; for (const p of all.values()) if (p.id !== meId && onBoat(p.pos)) n++; return n; }
  return { setMe, me, upsert, remove, update, myPos, spawnFor, onBoatCount, setBadge, hideTag, posOf, count: () => all.size, layer };
}
