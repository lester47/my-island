// 登入者：自己的人物＋頭上名牌；之後接上連線服務時，其他人也用同一套顯示（upsert / remove）
import * as THREE from 'three';
import { rng } from './kit.js?v=20261117h';
import { makePerson } from './life.js?v=20261117h';
import { ROLES } from './roles.js?v=20261117h';
const SPAWN = { x: 0, z: 7.4, yaw: Math.PI };

const seedOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createPlayers(W, H) {
  const { scene, camera } = W;
  const layer = document.createElement('div'); layer.className = 'nametags'; layer.setAttribute('aria-hidden', 'true');
  document.getElementById('stage').append(layer);
  const all = new Map();   // id → player
  let meId = null;

  function build(id, info) {
    const P = makePerson(rng(seedOf(id)), false, { shirt: info.shirt, hat: false });
    scene.add(P.g);
    const tag = document.createElement('div'); tag.className = 'ntag';
    layer.append(tag);
    const p = { id, info: {}, P, tag, pos: new THREE.Vector3(SPAWN.x, H, SPAWN.z), yaw: SPAWN.yaw, target: null, moving: 0, phase: Math.random() * 6 };
    all.set(id, p); setInfo(p, info); return p;
  }
  function setInfo(p, info) {
    const old = p.info; p.info = { ...info };
    if (old.shirt && old.shirt !== info.shirt) { const keep = { pos: p.pos.clone(), yaw: p.yaw }; scene.remove(p.P.g); p.P = makePerson(rng(seedOf(p.id)), false, { shirt: info.shirt, hat: false }); scene.add(p.P.g); p.pos.copy(keep.pos); p.yaw = keep.yaw; }
    const R = ROLES[info.role] || ROLES.visitor;
    p.tag.style.setProperty('--rc', R.color);
    p.tag.classList.toggle('me', p.id === meId);
    p.tag.innerHTML = `<span class="r">${R.icon} ${R.label}</span><b>${escH(info.name)}</b>${p.id === meId ? '<i>我</i>' : ''}`;
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
    if (info.name !== p.info.name || info.role !== p.info.role || info.shirt !== p.info.shirt) setInfo(p, info);
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
    } else if (m) m.moving = 0;
    for (const p of all.values()) {
      if (p.target && p.id !== meId) {
        const k = Math.min(1, dt * 6), dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z;
        p.moving = Math.hypot(dx, dz) > .05 ? .25 : Math.max(0, p.moving - dt);
        p.pos.x += dx * k; p.pos.z += dz * k; p.pos.y += ((p.target.y ?? H) - p.pos.y) * k;
        let dy = (p.target.yaw || 0) - p.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; p.yaw += dy * k;
      }
      const hide = p.id === meId && walking && firstPerson;
      p.P.g.visible = !hide;
      // 在船上：自己沒按方向鍵就坐好；其他人在船上一律坐著（位置變動是船在動）
      const sit = onBoat(p.pos) && (p.id === meId ? !(p.moving > 0) : true);
      p.P.g.position.copy(p.pos); if (sit) p.P.g.position.y -= SIT_DROP; p.P.g.rotation.y = p.yaw;
      pose(p.P, t + p.phase, p.moving > 0 && !sit, sit);
      // 名牌：投影到畫面上，在頭頂上方
      _v.set(p.pos.x, p.pos.y + 1.02, p.pos.z).project(camera);
      const dist = camera.position.distanceTo(p.pos);
      const off = hide || _v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1 || (dist > 70 && p.id !== meId);
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
  return { setMe, me, upsert, remove, update, myPos, spawnFor, count: () => all.size, layer };
}
