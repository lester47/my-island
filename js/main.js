// 115 鯉魚市集｜介面與流程
import * as THREE from 'three';
import { ROLES, OUTFITS, HATS } from './roles.js?v=20261118t';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'isleforge.my-island.';
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* 私密模式等情況：只是不記住 */ } },
};
const Q = new URLSearchParams(location.search);
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const pad2 = (n) => String(n).padStart(2, '0');
const fmtH = (h) => { h = ((h % 24) + 24) % 24; return `${pad2(Math.floor(h))}:${pad2(Math.floor((h % 1) * 60))}`; };

// 介面 Logo：低多邊形鯉魚（橘紅魚背、米白魚腹、魚頭朝右），首頁、怎麼逛、集章完成共用這一張
const LOGO_SRC = 'assets/brand/koi-logo.png?v=20261118t';
const MASCOT = `<img src="${LOGO_SRC}" alt="115 鯉魚市集 Logo：低多邊形小鯉魚" decoding="async">`;

let C = null;            // content.json
let W = null, L = null, CAM = null;
const S = {
  theme: store.get('theme', 'auto'), timeMode: store.get('time', 'auto'), hour: 10, hourShown: 10, autoStart: 0,
  reduced: store.get('reduce', null), quality: store.get('quality', 'high'),
  stamps: store.get('stamps', []), bag: store.get('bag', null), open: null, bubble: null, tour: null, walking: false, intro: false,
};
if (S.reduced == null) S.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!S.bag) S.bag = { shell: 3 };

// ------------------------------------------------------------------ 共用小元件
// 滾輪縮放段數提示（電腦版）：「縮放 4／10」，一秒後淡出
let zoomT = 0;
function showZoom(k, n) {
  let el = $('#zoomPill');
  if (!el) { el = document.createElement('div'); el.id = 'zoomPill'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.append(el); }
  el.innerHTML = `<span>🔍 縮放 ${k}／${n}</span><i aria-hidden="true">${Array.from({ length: n }, (_, i) => `<b class="${i < k ? 'on' : ''}"></b>`).join('')}</i>`;
  el.classList.add('show'); clearTimeout(zoomT); zoomT = setTimeout(() => el.classList.remove('show'), 1100);
}
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
function islandById(id) { return id === 'center' ? C.center : id === 'carp' ? C.carpBoat : C.islands.find((i) => i.id === id); }
const stallsOf = (id) => C.stalls.filter((x) => x.island === id).sort((a, b) => a.no - b.no);   // 攤號是識別碼：攤位跟著自己的資料走
const stallByNo = (no) => C.stalls.find((x) => x.no === +no);
// 攤位連結：新連結帶 roster=20；沒有名冊版本的舊連結（原 26 攤號）依對照表轉到新攤號
function resolveStallLink(no, roster) {
  const R = C.roster, n = +no;
  if (!R || roster === '20' || roster === R.version) return { st: stallByNo(n) };
  const lg = R.legacy || {}, to = lg.map && lg.map[String(n)];
  if (to) return { st: stallByNo(to), msg: to !== n ? `這是舊版攤號連結：原第 ${pad2(n)} 攤現在是第 ${pad2(to)} 攤` : '' };
  if (lg.removed && lg.removed[String(n)]) return { st: null, msg: `原第 ${pad2(n)} 攤「${lg.removed[String(n)]}」在新名冊沒有獨立設攤` };
  return { st: null, msg: '找不到這個攤號' };
}
const nl = (t) => esc(t).replace(/\n/g, '<br>');
function colorOf(id) { return id === 'center' ? '#3f7d3a' : id === 'carp' ? C.carpBoat.color : islandById(id).dark; }   // 介面用加深色，白字對比 ≥ 4.5
function openDlg(id) { const d = $(id); if (!d.open) d.showModal(); return d; }
document.addEventListener('click', (e) => { const b = e.target instanceof Element && e.target.closest('[data-close]'); if (b) b.closest('dialog').close(); });

// ------------------------------------------------------------------ 主題（底色）與晝夜
const THEMES = [['auto', '🌅 自動', null], ['forest', '森林', '#eef3e6'], ['tundra', '苔原', '#dfe8d3'], ['deep', '深林', '#1b2a20']];
const TIMES = [['day', '☀️ 白天'], ['dusk', '🌇 黃昏'], ['night', '🌙 夜晚'], ['auto', '⏱ 自動流動'], ['real', '🕒 現在時間']];
const FIXED_H = { day: 11.5, dusk: 18.1, night: 21.5 };
if (!['day', 'dusk', 'night', 'auto', 'real'].includes(store.get('time', 'auto'))) store.set('time', 'auto');
const PERIOD_THEME = { day: 'forest', dusk: 'tundra', night: 'deep' };
function periodOf(h) { h = ((h % 24) + 24) % 24; return h >= 6 && h < 16 ? 'day' : (h >= 16 && h < 19) || (h >= 5 && h < 6) ? 'dusk' : 'night'; }
const PNAME = { day: '白天', dusk: '黃昏', night: '夜晚' };
function targetHour(now) {
  if (S.timeMode === 'real') { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  if (S.timeMode === 'auto') return (9 + (now - S.autoStart) / 150000 * 24) % 24;          // 約 2.5 分鐘一天
  return FIXED_H[S.timeMode] ?? 11.5;      // 未知的模式一律當白天，不會讓畫面變黑
}
function effectiveTheme() { return S.theme === 'auto' ? PERIOD_THEME[periodOf(S.hourShown)] : S.theme; }
let appliedTheme = null;
function applyTheme() {
  const t = effectiveTheme();
  if (t === appliedTheme) return; appliedTheme = t;
  document.documentElement.dataset.theme = t;
  if (W) W.setTheme(t);
}
function buildSettings() {
  $('#themeSeg').innerHTML = THEMES.map(([k, n, c]) => `<button type="button" role="radio" data-k="${k}">${c ? `<span class="sw" style="background:${c}"></span>` : ''}${n}</button>`).join('');
  $('#timeSeg').innerHTML = TIMES.map(([k, n]) => `<button type="button" role="radio" data-k="${k}">${n}</button>`).join('');
  $('#themeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.theme = b.dataset.k; store.set('theme', S.theme);
    if (S.theme === 'deep') setTime('night');                 // 深色底色預設把光線調成夜晚（之後仍可再切回白天）
    syncSettings(); applyTheme();
  });
  $('#timeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTime(b.dataset.k); });
  $('#motionBtn').addEventListener('click', () => { S.reduced = !S.reduced; store.set('reduce', S.reduced); syncSettings(); if (CAM) CAM.S.reduced = S.reduced; toast(S.reduced ? '已減少動態：動畫暫停' : '動畫已恢復'); });
  $('#qualityBtn').addEventListener('click', () => { setQuality(S.quality === 'low' ? 'high' : 'low'); });
  $('#replayBtn').addEventListener('click', () => { toggleSettings(false); playIntro(true); });
  $('#shareBtn').addEventListener('click', () => { toggleSettings(false); openShare(); });
  syncSettings();
}
function setTime(k) { S.timeMode = k; store.set('time', k); if (k === 'auto') S.autoStart = performance.now() - ((S.hourShown - 9 + 24) % 24) / 24 * 150000; syncSettings(); }
function syncSettings() {
  for (const b of document.querySelectorAll('#themeSeg button')) b.setAttribute('aria-checked', String(b.dataset.k === S.theme));
  for (const b of document.querySelectorAll('#timeSeg button')) b.setAttribute('aria-checked', String(b.dataset.k === S.timeMode));
  $('#motionBtn').setAttribute('aria-pressed', String(S.reduced));
  $('#qualityBtn').setAttribute('aria-pressed', String(S.quality === 'low'));
  $('#qualityBtn').textContent = `🖥️ 目前畫質：${S.quality === 'low' ? '低' : '高'}${S.qualityAuto ? '（自動調整）' : ''}・點一下切換`;
}
function toggleSettings(on) {
  const p = $('#settings'); on = on == null ? p.hidden : on; p.hidden = !on; $('#setBtn').setAttribute('aria-expanded', String(on));
  if (on) p.querySelector('button[aria-checked="true"]')?.focus();
}
$('#setBtn').addEventListener('click', () => toggleSettings());
$('#clock').addEventListener('click', () => toggleSettings(true));
document.addEventListener('pointerdown', (e) => { if (!$('#settings').hidden && !e.target.closest('#settings,#setBtn,#clock')) toggleSettings(false); });
// 活動當天依現場時間顯示提示（content.json 的 center.event.live）；網址加 ?now=2026-12-12T11:20 可預覽
const NOW_OVERRIDE = (() => { const v = new URLSearchParams(location.search).get('now'); const d = v ? new Date(v) : null; return d && !isNaN(d) ? d.getTime() - Date.now() : 0; })();
const nowDate = () => new Date(Date.now() + NOW_OVERRIDE);
function liveNotice() {
  const L = C.center.event && C.center.event.live; if (!L || !L.notices) return null;
  const d = nowDate(), day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (day !== L.day) return null;
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const n = L.notices.find((x) => hm < x.until); if (!n) return null;
  return { ...n, blockNext: n.level === 'warn' || n.level === 'end' };
}
function updateLive() {
  const el = $('#liveNote'); if (!el) return;
  const n = liveNotice();
  if (!n) { el.hidden = true; return; }
  el.hidden = false; el.dataset.level = n.level;
  if (el.textContent !== n.text) el.textContent = n.text;
}
function updateClock() {
  const d = nowDate();
  $('#clockNow').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  $('#clockSky').textContent = `島上時間 ${fmtH(S.hourShown)}・${PNAME[periodOf(S.hourShown)]}`;
  updateLive();
}

// ------------------------------------------------------------------ 集章與背包
const STAMP_IDS = ['center', 'food', 'craft', 'puzzle', 'sport', 'recycle'];
function stamp(id) {
  if (S.stamps.includes(id)) return;
  S.stamps.push(id); store.set('stamps', S.stamps); renderHud();
  toast(`🏮 蓋章！${islandById(id).name}（${S.stamps.length}/6）`);
  $('#stampBtn').classList.remove('bump'); void $('#stampBtn').offsetWidth; $('#stampBtn').classList.add('bump');
  if (S.stamps.length === 6 && !store.get('doneShown', false)) { store.set('doneShown', true); setTimeout(showDone, 900); }
}
function showDone() {
  $('#doneBody').innerHTML = `<div style="display:flex;gap:14px;align-items:center"><span class="mascot" style="width:84px;height:84px">${MASCOT}</span><p style="margin:0;line-height:1.7;font-weight:700">太厲害了！你已走訪服務台和五座主題島，集滿六枚章！<br>小鯉魚幫你把護照收好了，記得也到現場逛逛喔！</p></div><p class="foot">集章紀錄只存在這台裝置的瀏覽器裡。</p><button type="button" class="btn" data-close>好耶！</button>`;
  openDlg('#doneDlg');
}
function renderHud() {
  const n = Object.values(S.bag).reduce((a, b) => a + b, 0);
  $('#bagCount').textContent = n; $('#stampCount').textContent = `${S.stamps.length}/6`;
  for (const id of STAMP_IDS) { const t = tags[id]; if (t) t.querySelector('.st').textContent = S.stamps.includes(id) ? '🏮' : ''; }
}
function saveBag() { store.set('bag', S.bag); renderHud(); $('#bagBtn').classList.remove('bump'); void $('#bagBtn').offsetWidth; $('#bagBtn').classList.add('bump'); }
function openBag() {
  const items = Object.entries(S.bag).filter(([, v]) => v > 0);
  $('#bagBody').innerHTML = `<ul class="items">${items.length ? items.map(([k, v]) => `<li><span class="ic" aria-hidden="true">${C.items[k].icon}</span>${C.items[k].name} × ${v}</li>`).join('') : '<li>背包是空的</li>'}</ul>
    <p class="foot">玩法：撿沙灘上的 🐚 貝殼（每座島一顆，撿完 20 秒會再出現），點島上的居民跟他交換，一路換到最稀有的「💌 島主的明信片」。<br>${esc(C.tradeNote)}</p>
    <h3 style="margin:10px 0 6px;font-size:15px">交換路線</h3>
    <ol class="foot" style="margin:0 0 12px;padding-left:20px">${C.trades.filter((t) => t.id !== 't0').map((t) => { const r = C.residents.find((x) => x.trade === t.id); return `<li>${esc(r.name)}（${esc(islandById(r.island).name)}）：${C.items[t.give].icon}${esc(C.items[t.give].name)} → ${C.items[t.get].icon}${esc(C.items[t.get].name)}</li>`; }).join('')}</ol>
    <button type="button" class="btn ghost" id="bagReset">清空背包（回到 3 個貝殼）</button>`;
  $('#bagReset').onclick = () => { S.bag = { shell: 3 }; saveBag(); openBag(); toast('背包已清空'); };
  openDlg('#bagDlg');
}
function openStamps() {
  $('#stampBody').innerHTML = `<p style="margin:0 0 12px">逛過一座島（打開它的介紹）就能蓋一枚章。目前 <b>${S.stamps.length}/6</b>。</p>
    <div class="stampgrid">${STAMP_IDS.map((id) => { const i = islandById(id); const got = S.stamps.includes(id); return `<div class="stamp ${got ? 'got' : ''}" style="--c:${colorOf(id)}">${got ? '🏮<br>' : ''}${esc(i.name)}${got ? '' : '<br>未蓋章'}</div>`; }).join('')}</div>
    ${gameStampsHTML()}<p class="foot">集章紀錄存在這台裝置的瀏覽器裡。</p><button type="button" class="btn ghost" id="stampReset">重置集章</button>`;
  $('#stampReset').onclick = () => { S.stamps = []; store.set('stamps', []); store.set('doneShown', false); renderHud(); openStamps(); toast('集章已重置'); };
  openDlg('#stampDlg');
}

// ------------------------------------------------------------------ 我的闖關護照（首版：本機自我登記）
// 與六枚逛島章分開：逛島章＝看過島；闖關紀錄＝玩家完成攤位活動後自己按「登記完成」。
// 獨立且含活動識別的 localStorage 鍵；讀到空值或壞資料時從空護照開始，不影響其他功能。
const PKEY = 'liyu115.passport.v1';
const PP = { data: null, pendingNo: null, view: 'main', confirmClear: false, confirmUndo: null, confirmMis: null };
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function ppRead() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(PKEY)); } catch (e) { d = null; }
  if (!d || typeof d !== 'object' || !Array.isArray(d.profiles)) d = { activeProfileId: null, profiles: [] };
  const seen = new Set();
  d.profiles = d.profiles.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && !seen.has(p.id) && seen.add(p.id)).map((p) => {
    const recs = [], nos = new Set();
    for (const r of Array.isArray(p.records) ? p.records : []) {
      if (!r || !Number.isInteger(r.stallNo) || nos.has(r.stallNo) || typeof r.completedAt !== 'string') continue;
      nos.add(r.stallNo); recs.push({ stallNo: r.stallNo, completedAt: r.completedAt, method: 'self' });
    }
    const mis = [], mids = new Set();
    for (const r of Array.isArray(p.missions) ? p.missions : []) {
      if (!r || typeof r.missionId !== 'string' || mids.has(r.missionId) || typeof r.completedAt !== 'string') continue;
      mids.add(r.missionId); mis.push({ missionId: r.missionId, completedAt: r.completedAt, method: 'self' });
    }
    const hist = (Array.isArray(p.history) ? p.history : []).filter((r) => r && Number.isInteger(r.oldNo) && typeof r.completedAt === 'string').map((r) => ({ oldNo: r.oldNo, name: String(r.name || '').slice(0, 30), completedAt: r.completedAt, roster: String(r.roster || 'r26'), method: 'self' }));
    return { id: p.id, name: p.name.slice(0, 20), createdAt: typeof p.createdAt === 'string' ? p.createdAt : '', records: recs, missions: mis, history: hist };
  });
  if (!d.profiles.some((p) => p.id === d.activeProfileId)) d.activeProfileId = d.profiles[0] ? d.profiles[0].id : null;
  const out = { roster: typeof d.roster === 'string' ? d.roster : null, activeProfileId: d.activeProfileId, profiles: d.profiles };
  return ppMigrate(out);
}
// 名冊改版：沒有版本標記的護照都是在原 26 攤名冊時建立的（護照 11/15 上線時已是 26 攤），依對照表轉成新攤號。
// 合併攤只算一筆（保留較早的時間）；新名冊沒有的攤（舊 06、14）移到「舊版紀錄」，只顯示、不計進度。只轉換一次。
function ppMigrate(d) {
  const R = C && C.roster; if (!R || d.roster === R.version) return d;
  if (d.roster && d.roster !== (R.legacy && R.legacy.from)) return d;    // 來源不明的版本：不動，避免誤配
  const lg = R.legacy || {}, map = lg.map || {}, rm = lg.removed || {};
  for (const p of d.profiles) {
    const by = new Map();
    for (const r of p.records) {
      const to = map[String(r.stallNo)];
      if (to) { const o = by.get(to); if (!o || r.completedAt < o.completedAt) by.set(to, { stallNo: to, completedAt: r.completedAt, method: 'self' }); }
      else p.history.push({ oldNo: r.stallNo, name: rm[String(r.stallNo)] || '', completedAt: r.completedAt, roster: lg.from || 'r26', method: 'self' });
    }
    p.records = [...by.values()];
  }
  d.roster = R.version;
  if (d.profiles.length) { try { localStorage.setItem(PKEY, JSON.stringify(d)); } catch (e) { /* 存不了就下次再轉，畫面先用轉好的結果 */ } }
  return d;
}
// 存檔：成功才算數；失敗就提示，畫面回到瀏覽器實際保存的狀態
function ppWrite(next) {
  let ok = true;
  try { localStorage.setItem(PKEY, JSON.stringify(next)); } catch (e) { ok = false; }
  PP.data = ppRead();
  if (!ok) toast('紀錄沒有存成功：這個瀏覽器目前無法保存資料（可能是無痕模式或空間不足）');
  return ok;
}
const ppClone = () => JSON.parse(JSON.stringify(PP.data || ppRead()));
const ppActive = () => { if (!PP.data) PP.data = ppRead(); return PP.data.profiles.find((p) => p.id === PP.data.activeProfileId) || null; };
const ppRec = (no) => { const a = ppActive(); return a ? a.records.find((r) => r.stallNo === +no) || null : null; };
const ppDone = (no) => !!ppRec(no);
const chalStalls = () => C.stalls.filter((x) => x.challengeEnabled).sort((a, b) => a.no - b.no);
function fmtDone(iso) { const d = new Date(iso); if (isNaN(d)) return ''; return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function chalInner(no) {
  const a = ppActive(), rec = ppRec(no), lab = C.passport ? C.passport.selfLabel : '已登記・自行回報';
  const who = a ? `<span class="chal-who">護照：${esc(a.name)}</span>` : '';
  if (rec && PP.confirmUndo === +no) return `<p class="chal-h">🎫 闖關登記</p><p class="chal-q">確定要取消「${esc(a.name)}」在第 ${pad2(no)} 攤的登記嗎？</p>
    <div class="chal-btns"><button type="button" class="btn" data-chal-undo-yes="${no}">確定取消</button><button type="button" class="btn ghost" data-chal-undo-no="${no}">保留登記</button></div>`;
  if (rec) return `<p class="chal-h">🎫 闖關登記 ${who}</p><p class="chal-ok">✓ ${esc(lab)}</p><p class="chal-meta">第 ${pad2(no)} 攤・完成時間 ${fmtDone(rec.completedAt)}</p>
    <div class="chal-btns"><button type="button" class="btn ghost" data-chal-undo="${no}">取消登記</button><button type="button" class="btn ghost" data-pass-open>看我的護照</button></div>`;
  return `<p class="chal-h">🎫 闖關登記 ${who}</p><p class="chal-meta">完成這攤的活動後，按下面的按鈕記到${a ? '你的' : ''}闖關護照（自行回報）。</p>
    <div class="chal-btns"><button type="button" class="btn" data-chal-do="${no}">🎫 記入闖關護照</button>${a ? '<button type="button" class="btn ghost" data-pass-open>看我的護照</button>' : ''}</div>`;
}
function refreshChal(focusSel) {
  document.querySelectorAll('[data-mis]').forEach((el) => { el.innerHTML = misInner(el.dataset.mis); });
  document.querySelectorAll('[data-chal]').forEach((el) => { el.innerHTML = chalInner(+el.dataset.chal); });
  document.querySelectorAll('[data-chk]').forEach((el) => { el.textContent = ppDone(+el.dataset.chk) ? '✓ 已登記' : ''; });
  if ($('#passDlg').open) renderPass();
  if (focusSel) { const f = document.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
}
let ppBusy = false;
function chalRegister(no) {
  if (ppBusy) return;                                    // 連點只記一次
  const a = ppActive();
  if (!a) { PP.pendingNo = +no; PP.view = 'create'; openPass(); return; }
  if (ppDone(no)) { refreshChal(); return; }
  ppBusy = true;
  const next = ppClone(), p = next.profiles.find((x) => x.id === next.activeProfileId);
  p.records.push({ stallNo: +no, completedAt: new Date().toISOString(), method: 'self' });
  const ok = ppWrite(next);
  PP.confirmUndo = null;
  refreshChal(ok ? `[data-chal-undo="${no}"]` : `[data-chal-do="${no}"]`);
  if (ok) toast(`✓ 第 ${pad2(no)} 攤已登記（自行回報）・進度 ${ppActive().records.filter((r) => stallByNo(r.stallNo)?.challengeEnabled).length}／${chalStalls().length}`);
  setTimeout(() => { ppBusy = false; }, 350);
}
function chalUndo(no) {
  const next = ppClone(), p = next.profiles.find((x) => x.id === next.activeProfileId);
  if (!p) return;
  p.records = p.records.filter((r) => r.stallNo !== +no);
  const ok = ppWrite(next);
  PP.confirmUndo = null;
  refreshChal(ok ? `[data-chal-do="${no}"]` : `[data-chal-undo="${no}"]`);
  if (ok) toast(`已取消第 ${pad2(no)} 攤的登記`);
}
document.addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target.closest('[data-chal-do],[data-chal-undo],[data-chal-undo-yes],[data-chal-undo-no],[data-pass-open]') : null;
  if (!t) return;
  if (t.hasAttribute('data-chal-do')) chalRegister(t.dataset.chalDo);
  else if (t.hasAttribute('data-chal-undo')) { PP.confirmUndo = +t.dataset.chalUndo; refreshChal(`[data-chal-undo-no="${t.dataset.chalUndo}"]`); }
  else if (t.hasAttribute('data-chal-undo-yes')) chalUndo(t.dataset.chalUndoYes);
  else if (t.hasAttribute('data-chal-undo-no')) { const n = t.dataset.chalUndoNo; PP.confirmUndo = null; refreshChal(`[data-chal-undo="${n}"]`); }
  else if (t.hasAttribute('data-pass-open')) openPass();
});

// ------------------------------------------------------------------ 五島探索路線（任務設定在 content.json 的 route）
// 任務紀錄與闖關紀錄、逛島章各自計算；同樣存在目前這本護照裡（本機、自行回報）。
function routeCheck() {
  const R = C.route || { missions: [] }, errs = [], ok = [], ids = new Set();
  for (const m of R.missions || []) {
    if (!m || !m.id) { errs.push('有一筆任務沒有任務 ID'); continue; }
    if (ids.has(m.id)) { errs.push(`任務 ID「${m.id}」重複`); continue; }
    ids.add(m.id);
    const st = stallByNo(m.stallNo);
    if (!st) { errs.push(`任務「${m.id}」引用的第 ${m.stallNo} 攤不存在`); continue; }
    if (m.island && st.island !== m.island) { errs.push(`任務「${m.id}」設定在 ${m.island}，但第 ${m.stallNo} 攤目前在 ${st.island}（攤號為準，請確認）`); }
    if (!islandById(m.island || st.island)) { errs.push(`任務「${m.id}」的島 ID「${m.island}」不存在`); continue; }
    if (m.enabled === false) continue;
    ok.push({ ...m, island: st.island });
  }
  return { missions: ok, errs };
}
let ROUTE = null;
const route = () => (ROUTE || (ROUTE = routeCheck()));
const missionsAt = (no) => route().missions.filter((m) => m.stallNo === +no);
const misRec = (mid) => { const a = ppActive(); return a ? (a.missions || []).find((r) => r.missionId === mid) || null : null; };
const misDone = (mid) => !!misRec(mid);
const nextMission = () => route().missions.find((m) => !misDone(m.id)) || null;
function misInner(mid) {
  const m = route().missions.find((x) => x.id === mid); if (!m) return '';
  const a = ppActive(), rec = misRec(mid), all = route().missions, n = all.indexOf(m) + 1, I = islandById(m.island);
  const head = `<p class="mis-h"><span class="mis-tag">🧭 ${esc(C.route.title || '五島探索路線')}・第 ${n}／${all.length} 站</span>${m.kind ? `<span class="mis-kind">${esc(m.kind)}任務</span>` : ''}</p><p class="mis-t">${esc(m.text)}</p>`;
  if (rec && PP.confirmMis === mid) return head + `<p class="chal-q">確定要取消「${esc(a.name)}」這一站（${esc(I.name)}）的任務登記嗎？</p>
    <div class="chal-btns"><button type="button" class="btn" data-mis-undo-yes="${esc(mid)}">確定取消</button><button type="button" class="btn ghost" data-mis-undo-no="${esc(mid)}">保留登記</button></div>`;
  if (rec) return head + `<p class="chal-ok">✓ 任務完成・自行回報</p><p class="chal-meta">完成時間 ${fmtDone(rec.completedAt)}${a ? `・護照：${esc(a.name)}` : ''}</p>
    <div class="chal-btns">${nextMission() ? '<button type="button" class="btn" data-mis-next>下一站 →</button>' : '<span class="mis-done">🎉 路線完成</span>'}<button type="button" class="btn ghost" data-mis-undo="${esc(mid)}">取消登記</button></div>`;
  return head + `<div class="chal-btns"><button type="button" class="btn" data-mis-do="${esc(mid)}">🧭 記入五島探索</button>${a ? '<button type="button" class="btn ghost" data-pass-open>看我的路線</button>' : ''}</div>`;
}
function refreshMis(focusSel) {
  document.querySelectorAll('[data-mis]').forEach((el) => { el.innerHTML = misInner(el.dataset.mis); });
  refreshChal(focusSel);
}
let misBusy = false;
function misRegister(mid) {
  if (misBusy) return;
  if (!ppActive()) { PP.pendingNo = (route().missions.find((m) => m.id === mid) || {}).stallNo || null; PP.view = 'create'; openPass(); return; }
  if (misDone(mid)) { refreshMis(); return; }
  misBusy = true;
  const next = ppClone(), p = next.profiles.find((x) => x.id === next.activeProfileId);
  p.missions = p.missions || []; p.missions.push({ missionId: mid, completedAt: new Date().toISOString(), method: 'self' });
  const ok = ppWrite(next); PP.confirmMis = null;
  const done = route().missions.filter((m) => misDone(m.id)).length, total = route().missions.length;
  refreshMis(ok ? (nextMission() ? '[data-mis-next]' : `[data-mis-undo="${mid}"]`) : `[data-mis-do="${mid}"]`);
  if (ok) toast(done >= total ? `🎉 路線完成！${total} 站全部登記` : `🧭 任務完成（自行回報）・路線 ${done}／${total}`);
  setTimeout(() => { misBusy = false; }, 350);
}
function misUndo(mid) {
  const next = ppClone(), p = next.profiles.find((x) => x.id === next.activeProfileId); if (!p) return;
  p.missions = (p.missions || []).filter((r) => r.missionId !== mid);
  const ok = ppWrite(next); PP.confirmMis = null;
  refreshMis(ok ? `[data-mis-do="${mid}"]` : `[data-mis-undo="${mid}"]`);
  if (ok) toast('已取消這一站的任務登記');
}
function goNext() { const lv = liveNotice(); if (lv && lv.blockNext) { toast(`⏰ ${C.center.event.live.nextBlocked}`); return; } const m = nextMission(); if (!m) { toast('🎉 路線完成，五島都走過了！'); return; } if ($('#passDlg').open) $('#passDlg').close(); goStall(m.stallNo, true, `[data-mis="${m.id}"] [data-mis-do]`); }
document.addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target.closest('[data-mis-do],[data-mis-undo],[data-mis-undo-yes],[data-mis-undo-no],[data-mis-next],[data-pp-next]') : null;
  if (!t) return;
  if (t.hasAttribute('data-mis-do')) misRegister(t.dataset.misDo);
  else if (t.hasAttribute('data-mis-undo')) { PP.confirmMis = t.dataset.misUndo; refreshMis(`[data-mis-undo-no="${t.dataset.misUndo}"]`); }
  else if (t.hasAttribute('data-mis-undo-yes')) misUndo(t.dataset.misUndoYes);
  else if (t.hasAttribute('data-mis-undo-no')) { const id = t.dataset.misUndoNo; PP.confirmMis = null; refreshMis(`[data-mis-undo="${id}"]`); }
  else goNext();
});
function routeHTML() {
  const R = route(), list = R.missions, done = list.filter((m) => misDone(m.id)).length, nx = nextMission();
  const err = R.errs.length ? `<div class="mis-err" role="alert"><b>路線設定錯誤</b>（請主辦修正 data/content.json 的 route）<ul>${R.errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  if (!list.length) return `<section class="pp-route"><h3 class="pp-h">🧭 ${esc((C.route && C.route.title) || '五島探索路線')}</h3>${err}<p class="foot">目前沒有啟用的任務。</p></section>`;
  return `<section class="pp-route"><div class="pp-rt-hd"><h3 class="pp-h" style="margin:0">🧭 ${esc(C.route.title || '五島探索路線')}</h3><b class="pp-rt-n">完成 ${done}／${list.length} 島</b></div>
    ${err}
    <div class="bar" aria-hidden="true"><i style="width:${(done / list.length * 100).toFixed(1)}%"></i></div>
    ${nx ? `<button type="button" class="btn pp-next" data-pp-next>下一站：${esc(islandById(nx.island).name)}・${pad2(nx.stallNo)} ${esc(stallByNo(nx.stallNo).name)} →</button>` : '<p class="mis-finish">🎉 路線完成！五島任務全部登記。</p>'}
    <ol class="pp-rt">${list.map((m, i) => { const r = misRec(m.id), st = stallByNo(m.stallNo), I = islandById(m.island);
      return `<li class="${r ? 'ok' : ''} ${nx && nx.id === m.id ? 'now' : ''}" style="--pc:${colorOf(m.island)}"><button type="button" class="pp-link" data-pp-go="${m.stallNo}" data-pp-mis="${esc(m.id)}"><span class="pp-mk" aria-hidden="true">${r ? '✓' : i + 1}</span>${esc(I.name)}・${pad2(m.stallNo)} ${esc(st.name)}</button><span class="pp-st">${r ? '已完成' : nx && nx.id === m.id ? '下一站' : '未完成'}</span><p class="pp-rt-t">${esc(m.text)}</p></li>`; }).join('')}</ol>
    <p class="foot" style="margin:4px 0 0">任務紀錄為自行回報。可以照順序走，也可以點清單自由選站。</p></section>`;
}
function openPass() {
  if (!PP.data) PP.data = ppRead();
  if (!ppActive()) PP.view = 'create';
  PP.confirmClear = false;
  renderPass(); openDlg('#passDlg');
  const f = $('#passBody').querySelector('#ppName') || $('#passBody').querySelector('button'); if (f) f.focus();
}
function renderPass() {
  const body = $('#passBody'), a = ppActive(), note = C.passport ? C.passport.note : '紀錄保存在目前瀏覽器。';
  if (PP.view === 'create' || !a) {
    const back = a ? '<button type="button" class="btn ghost" id="ppBack">返回</button>' : '';
    const pend = PP.pendingNo ? `<p class="pp-pend">建立後會回到第 ${pad2(PP.pendingNo)} 攤 ${esc(stallByNo(PP.pendingNo)?.name || '')}，再按「記入闖關護照」或「記入五島探索」就好。</p>` : '';
    body.innerHTML = `<form id="ppForm" class="pp-form" novalidate>
      <p style="margin:0 0 10px">${PP.data.profiles.length ? '新增一本護照' : '第一次使用，取一個暱稱就能建立護照。'}</p>${pend}
      <label for="ppName" class="pp-lab">暱稱</label>
      <input id="ppName" class="pp-in" type="text" maxlength="20" autocomplete="nickname" placeholder="例如：小鯉魚" required>
      <p class="pp-err" id="ppErr" role="alert" hidden>請輸入暱稱</p>
      <div class="chal-btns"><button type="submit" class="btn">建立護照</button>${back}</div>
      <p class="foot">${esc(note)}只需要暱稱，不需要真實姓名。</p></form>`;
    $('#ppForm').onsubmit = (e) => {
      e.preventDefault();
      const name = $('#ppName').value.trim().slice(0, 20);
      if (!name) { $('#ppErr').hidden = false; $('#ppName').focus(); return; }
      const next = ppClone(), id = uid();
      next.profiles.push({ id, name, createdAt: new Date().toISOString(), records: [], missions: [] }); next.activeProfileId = id;
      if (!ppWrite(next)) { renderPass(); return; }
      PP.view = 'main';
      toast(`🎫 已建立「${name}」的護照`);
      const back2 = PP.pendingNo; PP.pendingNo = null;
      if (back2) { $('#passDlg').close(); goStall(back2, true); } else { renderPass(); $('#passBody').querySelector('button')?.focus(); }
      refreshChal();
    };
    if ($('#ppBack')) $('#ppBack').onclick = () => { PP.view = 'main'; PP.pendingNo = null; renderPass(); };
    return;
  }
  const list = chalStalls(), done = a.records.filter((r) => stallByNo(r.stallNo)?.challengeEnabled), pct = list.length ? done.length / list.length : 0;
  const recent = [...done].sort((x, y) => y.completedAt.localeCompare(x.completedAt)).slice(0, 5);
  const groups = C.islands.map((I) => ({ I, st: list.filter((x) => x.island === I.id) })).filter((g) => g.st.length);
  body.innerHTML = `
    <div class="pp-top"><div><p class="pp-eyebrow">護照主人</p><p class="pp-name">${esc(a.name)}</p></div>
      <div class="pp-sw">${PP.data.profiles.length > 1 ? `<label class="sr-only" for="ppSel">切換護照</label><select id="ppSel" class="pp-in">${PP.data.profiles.map((p) => `<option value="${esc(p.id)}" ${p.id === a.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : ''}
      <button type="button" class="btn ghost" id="ppNew">＋ 新增護照</button></div></div>
    ${routeHTML()}
    <h3 class="pp-h">🎫 攤位闖關</h3>
    <div class="pp-prog"><b>已完成 ${done.length}／${list.length}</b><div class="bar" aria-hidden="true"><i style="width:${(pct * 100).toFixed(1)}%"></i></div></div>
    <p class="foot" style="margin:2px 0 12px">闖關紀錄為自行回報，未經攤主核驗。${esc(note)}<br>六枚逛島章另外計算（看「🏮 集章」）。</p>
    <h3 class="pp-h">最近完成</h3>
    ${recent.length ? `<ol class="pp-recent">${recent.map((r) => `<li><button type="button" class="pp-link" data-pp-go="${r.stallNo}">第 ${pad2(r.stallNo)} 攤 ${esc(stallByNo(r.stallNo).name)}</button><span>${fmtDone(r.completedAt)}・自行回報</span></li>`).join('')}</ol>` : '<p class="foot" style="margin:0 0 10px">還沒有紀錄。到有「闖關登記」的攤位完成活動後按「記入闖關護照」。</p>'}
    <h3 class="pp-h">各島闖關攤位</h3>
    ${groups.map((g) => `<section class="pp-grp" style="--pc:${colorOf(g.I.id)}"><h4>${esc(g.I.name)} <small>${g.st.filter((x) => ppDone(x.no)).length}／${g.st.length}</small></h4>
      <ul>${g.st.map((x) => { const r = ppRec(x.no); return `<li class="${r ? 'ok' : ''}"><button type="button" class="pp-link" data-pp-go="${x.no}"><span class="pp-mk" aria-hidden="true">${r ? '✓' : '○'}</span>${pad2(x.no)} ${esc(x.name)}</button><span class="pp-st">${r ? '已完成' : '未完成'}</span></li>`; }).join('')}</ul></section>`).join('')}
    ${a.history && a.history.length ? `<h3 class="pp-h">舊版紀錄 <small>（原 26 攤名冊，不計入進度）</small></h3><ul class="pp-hist">${a.history.map((r) => `<li>原第 ${pad2(r.oldNo)} 攤${r.name ? ` ${esc(r.name)}` : ''}<span>${fmtDone(r.completedAt)}・新名冊沒有獨立設攤</span></li>`).join('')}</ul>` : ''}
    <div class="pp-clear">${PP.confirmClear ? `<p class="chal-q">確定清除「${esc(a.name)}」的護照和 ${a.records.length} 筆紀錄嗎？清除後無法復原。</p>
      <div class="chal-btns"><button type="button" class="btn danger" id="ppClearYes">確定清除</button><button type="button" class="btn ghost" id="ppClearNo">取消</button></div>`
      : `<button type="button" class="btn ghost" id="ppClear">清除這本護照</button>`}</div>`;
  if ($('#ppSel')) $('#ppSel').onchange = (e) => { const next = ppClone(); next.activeProfileId = e.target.value; if (ppWrite(next)) toast(`已切換到「${ppActive().name}」的護照`); refreshChal('#ppSel'); };
  $('#ppNew').onclick = () => { PP.view = 'create'; renderPass(); $('#ppName').focus(); };
  if ($('#ppClear')) $('#ppClear').onclick = () => { PP.confirmClear = true; renderPass(); $('#ppClearNo').focus(); };
  if ($('#ppClearNo')) $('#ppClearNo').onclick = () => { PP.confirmClear = false; renderPass(); $('#ppClear').focus(); };
  if ($('#ppClearYes')) $('#ppClearYes').onclick = () => {
    const next = ppClone(), name = a.name; next.profiles = next.profiles.filter((p) => p.id !== a.id); next.activeProfileId = next.profiles[0] ? next.profiles[0].id : null;
    PP.confirmClear = false; if (ppWrite(next)) toast(`已清除「${name}」的護照`); refreshChal(); renderPass(); $('#passBody').querySelector('button,input')?.focus();
  };
  body.querySelectorAll('[data-pp-go]').forEach((b) => (b.onclick = () => { $('#passDlg').close(); goStall(+b.dataset.ppGo, true, b.dataset.ppMis ? `[data-mis="${b.dataset.ppMis}"] button` : null); }));
}
// 開啟某一攤：飛到該島、展開該攤，焦點放在登記按鈕或攤位列
function goStall(no, focusChal, focusSel) {
  const st = stallByNo(no); if (!st) return;
  if (S.open === st.island && $('#sd-' + no)) setStall(no, true);       // 已經在這座島：直接展開，不再飛一次
  else openIsland(st.island, { no: st.no });
  if (focusChal) { const t0 = performance.now(); const tick = () => { const b = document.querySelector(focusSel ? `#sd-${no}:not([hidden]) ${focusSel}` : `#sd-${no}:not([hidden]) [data-chal-do], #sd-${no}:not([hidden]) [data-chal-undo]`) || document.querySelector(`#sd-${no}:not([hidden]) [data-chal-do], #sd-${no}:not([hidden]) [data-chal-undo]`); if (b) b.focus({ preventScroll: true }); else if (performance.now() - t0 < 6000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
}
window.__routeErrors = () => route().errs;
$('#passBtn').addEventListener('click', () => { PP.pendingNo = null; PP.view = ppActive() ? 'main' : 'create'; openPass(); });
$('#bagBtn').addEventListener('click', openBag);
$('#stampBtn').addEventListener('click', openStamps);

// ------------------------------------------------------------------ 攤位詳情（點攤位列展開，同時只開一攤）
// 合併攤（parts）：一張詳情卡分兩段，各有自己的圖片與說明
const photoHTML = (o, name) => o.photo ? `<div class="stall-photo"><img src="${esc(o.photo + (C.assetVersion ? `?v=${C.assetVersion}` : ''))}" alt="${esc(o.photoAlt || name)}" loading="lazy" decoding="async" width="1200" height="600"></div>${o.photoCaption ? `<p class="stall-photo-cap">${esc(o.photoCaption)}</p>` : ''}` : '';
function fieldsHTML(o, T, tmpl) {
  const N = C.stallNotes, v = (k) => String(o[k] ?? '').trim(), req = new Set(T.required);
  let h = '';
  if (v('intro')) h += `<p class="sd-intro">${nl(v('intro'))}</p>`;
  else if (tmpl) h += `<p class="sd-intro todo">一句介紹：${esc(N.pendingField)}</p>`;
  const rows = T.fields.map(([k, label]) => v(k) ? `<dt>${esc(label)}</dt><dd>${nl(v(k))}</dd>` : (tmpl && req.has(k) ? `<dt>${esc(label)}</dt><dd class="todo">${esc(N.pendingField)}</dd>` : '')).join('');
  if (rows) h += `<dl class="sd-fields">${rows}</dl>`;
  return h;
}
const stallTexts = (st) => [st, ...(st.parts || [])].flatMap((o) => [o.name, o.short, o.intro, o.desc, o.items, o.takeaway, o.rules]).filter(Boolean);
function stallDetailHTML(st) {
  const N = C.stallNotes, I = islandById(st.island), T = C.stallTypes[st.type || I.stallType];
  const keys = ['intro', ...T.fields.map((f) => f[0])];
  const any = [st, ...(st.parts || [])].some((o) => keys.some((k) => String(o[k] ?? '').trim()) || o.photo);
  if (st.namePending) return photoHTML(st, st.name) + `<p class="sd-empty">${esc(N.pendingName)}</p>`;
  let h = S.legacyNote && S.legacyNote.no === st.no ? `<p class="sd-legacy" role="status">ℹ️ ${esc(S.legacyNote.msg)}</p>` : '';
  h += `<p class="sd-tags"><span class="badge type">${esc(st.category || T.label)}</span>${st.sample ? `<span class="badge">${esc(N.sample)}</span>` : ''}${favBtnHTML(st.no)}</p>`;
  if (st.parts) h += photoHTML(st, st.name) + st.parts.map((pt) => `<section class="sd-part"><h4>${esc(pt.name)}</h4>${photoHTML(pt, pt.name)}${fieldsHTML(pt, T, st.template)}</section>`).join('');
  else h += photoHTML(st, st.name) + fieldsHTML(st, T, st.template);
  if (!any && !st.template) h += `<p class="sd-empty">${esc(N.pendingIntro)}</p>`;
  for (const m of missionsAt(st.no)) h += `<div class="mis" data-mis="${esc(m.id)}">${misInner(m.id)}</div>`;
  h += gameHTML(st);
  if (st.challengeEnabled) h += `<div class="chal" data-chal="${st.no}">${chalInner(st.no)}</div>`;
  return h + `<p class="sd-foot">攤位內容與價格以現場為準。</p>`;
}
// ------------------------------------------------------------------ 🎮 攤位線上小遊戲：市集是入口，遊戲放在 games/stall-XX/，用全螢幕視窗打開
// 遊戲過關時用 postMessage 通知市集（{ liyu:1, type:'clear', score }），市集蓋「線上通關章」；和現場蓋的章分開記
const gameClears = () => store.get('gameClears', {}) || {};
const gameStalls = () => C.stalls.filter((s) => s.game && s.game.ready && s.game.stamp !== false).sort((a, b) => a.no - b.no);
function gameInner(no) {
  const st = stallByNo(no), g = st.game, c = gameClears()[no];
  if (!g.ready) return `<button type="button" class="btn" disabled>🚧 線上版製作中</button>`;
  const art = g.stamp === false;                                         // 創作類小工具（畫貼紙、鑽石畫、聖誕樹）：沒有輸贏、不算通關章
  return `<button type="button" class="btn gm-play" data-game="${no}">${art ? '🎨 線上創作' : '🎮 玩線上版'}${g.beta ? '（試玩版）' : ''}</button>${c ? `<span class="gm-done">${art ? '✅ 已完成作品' : `✅ 已線上通關${c.best != null ? `・最佳 ${c.best}` : ''}`}</span>` : `<span class="gm-hint">${esc(g.hint || '在網站上先練習，現場再挑戰！')}</span>`}`;
}
function gameHTML(st) { return st.game ? `<div class="gm-box" data-gm="${st.no}">${gameInner(st.no)}</div>` : ''; }
let gameNo = null;
function openGame(no) {
  const st = stallByNo(+no); if (!st || !st.game || !st.game.ready) return;
  gameNo = st.no;
  $('#gameTitle').textContent = `第 ${pad2(st.no)} 攤・${st.game.title}`;
  $('#gameLoad').hidden = false;
  const u = st.game.url; $('#gameFrame').src = `${u}${u.includes('?') ? '&' : '?'}embed=1&v=${C.assetVersion || ''}`;
  openDlg('#gameDlg');
  setTimeout(() => { try { $('#gameFrame').focus(); } catch { /* 沒關係 */ } }, 300);
}
function closeGame() { const d = $('#gameDlg'); if (d.open) d.close(); }
$('#gameDlg').addEventListener('close', () => {
  $('#gameFrame').src = 'about:blank';
  if (gameNo != null) document.querySelectorAll(`[data-gm="${gameNo}"]`).forEach((b) => (b.innerHTML = gameInner(gameNo)));
  gameNo = null;
});
$('#gameBack').addEventListener('click', closeGame);
document.addEventListener('click', (e) => { const b = e.target instanceof Element && e.target.closest('[data-game]'); if (b) openGame(b.dataset.game); });
addEventListener('message', (e) => {
  const m = e.data;
  if (e.origin !== location.origin || !m || m.liyu !== 1 || e.source !== $('#gameFrame').contentWindow || gameNo == null) return;
  if (m.type === 'ready') $('#gameLoad').hidden = true;
  else if (m.type === 'close') closeGame();
  else if (m.type === 'clear') onGameClear(gameNo, m.score);
});
function onGameClear(no, score) {
  const all = gameClears(), first = !all[no], rec = all[no] || {};
  if (typeof score === 'number' && isFinite(score) && (rec.best == null || score > rec.best)) rec.best = Math.round(score);
  if (!rec.at) rec.at = new Date().toISOString();
  all[no] = rec; store.set('gameClears', all);
  if (!first) return;
  if (stallByNo(no).game.stamp === false) { toast('🎨 作品完成了！圖片已存到你的裝置'); return; }
  const list = gameStalls(), n = list.filter((s) => all[s.no]).length;
  S.bag.shell = (S.bag.shell || 0) + 1; saveBag();
  toast(`✅ 線上通關章！第 ${pad2(no)} 攤（${n}/${list.length}）送你一個貝殼🐚`);
  if (n === list.length && !store.get('gameAll', false)) { store.set('gameAll', true); S.bag.postcard = (S.bag.postcard || 0) + 1; saveBag(); setTimeout(() => toast('🏆 線上通關章全部集滿！送你島主的明信片 💌'), 2600); }
}
function gameStampsHTML() {
  const list = gameStalls(); if (!list.length) return '';
  const all = gameClears(), n = list.filter((s) => all[s.no]).length;
  return `<h3 style="margin:18px 0 8px">🎮 線上通關章 ${n}/${list.length}</h3><p class="foot" style="margin:0 0 10px">在攤位介紹按「玩線上版」，過關就蓋一枚。這是網站上的章，不能換現場獎品。</p>
    <div class="stampgrid gm-grid">${list.map((s) => `<button type="button" class="stamp ${all[s.no] ? 'got' : ''}" style="--c:#e8762b" data-game="${s.no}">${all[s.no] ? '✅<br>' : ''}${pad2(s.no)} ${esc(s.game.short || s.short || s.name)}${all[s.no] ? '' : '<br>未通關'}</button>`).join('')}</div>`;
}
function stallListHTML(id) {
  return `<ol class="stalls">${stallsOf(id).map((st) => `<li data-no="${st.no}"><button type="button" class="stall-row" id="sr-${st.no}" aria-expanded="false" aria-controls="sd-${st.no}"><span class="num" aria-hidden="true">${pad2(st.no)}</span><span class="nm ${st.namePending ? 'pending' : ''}"><span class="sr-only">攤號 ${st.no}，</span>${esc(st.name)}${st.short ? `<small class="short">｜${esc(st.short)}</small>` : ''}</span>${st.challengeEnabled ? `<span class="chk" data-chk="${st.no}">${ppDone(st.no) ? '✓ 已登記' : ''}</span>` : ''}<span class="chev" aria-hidden="true"></span></button><div class="stall-detail stall-detail-body" id="sd-${st.no}" role="region" aria-labelledby="sr-${st.no}" hidden>${stallDetailHTML(st)}</div></li>`).join('')}</ol>`;
}
function setStall(no, open, scroll = true) {
  const p = $('#panel');
  for (const b of p.querySelectorAll('.stall-row')) {
    const on = open && b.id === `sr-${no}`;
    b.setAttribute('aria-expanded', String(on)); b.closest('li').classList.toggle('open', on);
    $('#' + b.getAttribute('aria-controls')).hidden = !on;
  }
  if (open && scroll) { const li = p.querySelector(`li[data-no="${no}"]`); if (li) li.scrollIntoView({ block: 'nearest', behavior: S.reduced ? 'auto' : 'smooth' }); }
}
$('#panel').addEventListener('click', (e) => {
  const b = e.target.closest('.stall-row'); if (!b) return;
  setStall(b.closest('li').dataset.no, b.getAttribute('aria-expanded') !== 'true');
});

// ------------------------------------------------------------------ 島嶼面板
function panelHTML(id) {
  const I = islandById(id), c = colorOf(id), got = S.stamps.includes(id);
  const res = C.residents.filter((r) => r.island === id && (id !== 'center' || r.id === 'merchant'));
  const resHTML = `<div class="p-sec"><h3>島上的人 <span class="badge">示意</span></h3><div class="residents">${res.map((r) => `<div class="res"><b>${esc(r.name)}</b>・${esc(r.job)}<br>「${esc(r.lines[0])}」</div>`).join('')}</div><p class="foot" style="margin-top:6px">${esc(C.residentsNote)}</p></div>`;
  if (id === 'center') {
    return `<div class="p-hd" style="--pc:${c};--ptint:#e9f4e4;--pink:#234a20"><p class="eyebrow">★ ${esc(I.role)}</p><h2 id="panelTitle">${esc(I.name)}</h2><button type="button" class="x" data-panel-close aria-label="關閉">✕</button></div>
      ${liveCardHTML()}
      <div class="p-sec"><h3>活動總覽</h3><p class="intro-line">${esc(I.intro)}</p><p style="margin-top:6px">${esc(I.overview)}</p></div>
      <div class="p-sec"><h3>活動資訊</h3>${eventHTML()}</div>
      ${guideHTML()}
      <div class="p-sec"><h3>展區地圖</h3><div class="mapgrid">${C.islands.map((x) => `<button type="button" data-go="${x.id}" style="--c:${x.color}">${x.order}　${esc(x.name)}<br><small>${esc(x.group)}・${stallsOf(x.id).length} 攤</small></button>`).join('')}</div></div>
      <div class="p-sec"><h3>集章進度</h3><div class="stamp-row">🏮 已集 ${S.stamps.length}/6 枚 <button type="button" class="btn ghost" data-stamps>看護照</button></div></div>
      ${resHTML}`;
  }
  return `<div class="p-hd" style="--pc:${c};--ptint:${I.tint};--pink:${I.ink}"><p class="eyebrow">第 ${I.order} 島・${esc(I.group)}</p><h2 id="panelTitle">${esc(I.name)}</h2><button type="button" class="x" data-panel-close aria-label="關閉">✕</button></div>
    <div class="p-sec" style="--pc:${c}"><h3>展區介紹</h3><p class="intro-line">${esc(I.intro)}</p></div>
    <div class="p-sec" style="--pc:${c}"><h3>攤位清單（${stallsOf(id).length} 攤，依攤號排序）</h3>
      <p class="foot" style="margin:0 0 8px">點攤位可以展開介紹，再點一次收合。</p>
      ${stallListHTML(id)}</div>
    <div class="p-sec"><h3>島上地標</h3><p>${esc(I.landmark)}</p></div>
    ${resHTML}
    <div class="p-sec"><h3>資料下載</h3><a class="dl" href="${esc(I.download)}" download>📄 下載攤位清單（txt）</a></div>
    <div class="p-sec"><div class="stamp-row">${got ? '🏮 這座島已蓋章' : '打開介紹就會蓋章'}・目前 ${S.stamps.length}/6 <button type="button" class="btn ghost" data-stamps>看護照</button></div></div>`;
}
// 服務台：玩家推薦玩法（內容在 content.json 的 center.guide）
function guideHTML() {
  const G = C.center.guide; if (!G) return '';
  const sec = G.sections.map((x, i) => {
    const tag = x.ordered ? 'ol' : 'ul';
    const acts = (x.actions || []).map(([k, label]) => `<button type="button" class="btn ghost" data-gact="${esc(k)}">${esc(label)}</button>`).join('');
    return `<details class="gd" ${i === 0 ? 'open' : ''}><summary>${esc(x.h)}</summary><${tag}>${x.items.map((t) => `<li>${esc(t)}</li>`).join('')}</${tag}>${acts ? `<div class="chal-btns">${acts}</div>` : ''}</details>`;
  }).join('');
  return `<div class="p-sec guide"><h3>${esc(G.title)}</h3><p class="intro-line">${esc(G.intro)}</p>${sec}<p class="foot" style="margin-top:8px">${esc(G.note)}</p></div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('[data-gact]') : null; if (!b) return;
  const k = b.dataset.gact;
  if (k === 'tour') { closePanel(false); startTour(); }
  else if (k === 'pass') { PP.pendingNo = null; PP.view = ppActive() ? 'main' : 'create'; openPass(); }
  else if (k === 'next') { if (!ppActive()) { PP.view = 'create'; openPass(); } else goNext(); }
  else if (k === 'search') { renderList(); openDlg('#listDlg'); $('#searchInput').focus(); }
});
// 服務台最上面的「現場活動資訊」卡：日期地點時間一眼看到，並說明三種紀錄各記到哪裡
function liveCardHTML() {
  const K = C.center.event && C.center.event.card; if (!K) return '';
  return `<div class="p-sec live-card"><h3>📍 ${esc(K.title)}</h3><p class="lc-line">${esc(K.line)}</p><p class="lc-sub">${esc(K.sub)}</p>
    <dl class="lc-sys">${K.systems.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div>`;
}
function eventHTML() {
  const E = C.center.event, P = E.pending;
  const sched = E.schedule && E.schedule.length ? `<ol class="sched">${E.schedule.map((x) => `<li><b>${esc(x.time)}</b> ${esc(x.title)}</li>`).join('')}</ol>` : esc(P);
  return `<dl class="sd-fields ev"><dt>日期</dt><dd>${esc(E.date || P)}</dd><dt>地點</dt><dd>${esc(E.place || P)}</dd><dt>時程</dt><dd>${sched}</dd>
    ${E.rules && E.rules.length ? `<dt>鯉魚幣</dt><dd><ul class="ev-rules">${E.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd>` : ''}
    <dt>集章方式</dt><dd>${esc(E.stampWeb)}<br>現場集章：${esc(E.stampOnsite || P)}</dd></dl>`;
}
function showPanel(id, highlightNo) {
  stamp(id);                                   // 先蓋章，面板、右下角與通知才會是同一個數字
  const p = $('#panel'); p.innerHTML = panelHTML(id); p.hidden = false; S.open = id;
  p.querySelector('[data-panel-close]').onclick = () => closePanel(true);
  p.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => openIsland(b.dataset.go)));
  p.querySelectorAll('[data-stamps]').forEach((b) => (b.onclick = openStamps));
  for (const k in tags) tags[k].setAttribute('aria-expanded', String(k === id));
  if (highlightNo != null && p.querySelector(`li[data-no="${highlightNo}"]`)) {
    p.querySelector(`li[data-no="${highlightNo}"]`).classList.add('hit');
    setStall(highlightNo, true); $('#sr-' + highlightNo).focus({ preventScroll: true });
    p.querySelector(`li[data-no="${highlightNo}"]`).scrollIntoView({ block: 'start' });
  } else p.focus({ preventScroll: true });
}
let panelOpener = null;
function closePanel(goHome) {
  if (!S.open) return;
  const p = $('#panel'); p.hidden = true; S.open = null;
  for (const k in tags) tags[k].setAttribute('aria-expanded', 'false');
  if (CAM) CAM.S.follow = null;
  if (goHome && CAM && !S.tour && !S.walking) CAM.home();
  if (S.tour && S.tourPanel) { S.tourPanel = false; pauseTour(false); }   // 從導覽卡打開的面板：關掉後回到原站繼續導覽
  if (panelOpener && document.contains(panelOpener)) panelOpener.focus({ preventScroll: true });
}
function openIsland(id, opts = {}) {
  if (id === 'carp') { openBoat(opts); return; }
  closeBubble(); toggleSettings(false);
  if (S.walking) exitWalk(true);
  if (S.tour) endTour(false);
  panelOpener = opts.opener || tags[id] || null;
  if (!W) { showPanel(id, opts.no); return; }
  $('#panel').hidden = true;
  CAM.flyToIsland(W.islands[id], () => showPanel(id, opts.no));       // 運鏡結束後才打開面板
}

// ------------------------------------------------------------------ 鯉魚號：像島一樣可以點選、鏡頭跟著船、登船漫遊
function boatStatus() {
  const s = L.carp.status();
  if (s.docked) return { short: s.gang ? '停靠中・可上船' : '靠港中', long: s.gang ? `⚓ 停在手作體驗二島西側的鯉魚號碼頭，跳板已放下，現在可以上下船。約 ${s.leave} 秒後出航。` : '⚓ 正在靠港，跳板快放下了。', s };
  return { short: '航行中', long: `⛵ 繞五島航行中，約 ${s.eta} 秒後回到碼頭。`, s };
}
function boatPanelHTML() {
  const B = C.carpBoat, c = B.color, st = boatStatus();
  return `<div class="p-hd" style="--pc:${c};--ptint:#fde8e1;--pink:#7a2412"><p class="eyebrow">⛵ ${esc(B.role)}</p><h2 id="panelTitle">${esc(B.name)}</h2><button type="button" class="x" data-panel-close aria-label="關閉">✕</button></div>
    <div class="p-sec" style="--pc:${c}"><h3>現在在哪裡</h3><p class="boat-stat" id="boatStat" aria-live="polite">${esc(st.long)}</p><p class="foot" id="boatPax">船上 ${st.s.seated} 位小朋友（示意角色）・登入者 ${boatRiders()}／${BOAT_CAP} 人（最多 ${BOAT_CAP} 人，靠港放下跳板才能上船）</p>
      <div class="chal-btns"><button type="button" class="btn" data-boat="board">🚶 登船（漫遊）</button><button type="button" class="btn ghost" data-boat="pier">⚓ 前往手作體驗二島碼頭</button></div></div>
    <div class="p-sec" style="--pc:${c}"><h3>介紹</h3><p class="intro-line">${esc(B.intro)}</p></div>
    <div class="p-sec"><h3>怎麼玩</h3><ul class="boat-how">${B.how.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="foot" style="margin-top:8px">${esc(B.note)}</p></div>`;
}
let boatT = 0;
function refreshBoatPanel(now) {
  if (S.open !== 'carp' || now - boatT < 500) return; boatT = now;
  const st = boatStatus(), a = $('#boatStat'), b = $('#boatPax');
  if (a && a.textContent !== st.long) a.textContent = st.long;
  if (b) b.textContent = `船上 ${st.s.seated} 位小朋友（示意角色）・登入者 ${boatRiders()}／${BOAT_CAP} 人（最多 ${BOAT_CAP} 人，靠港放下跳板才能上船）`;
}
// 前往鯉魚號碼頭：鏡頭飛到手作體驗二島西側的木棧道（從湖面這側斜看棧道和停靠的船）
// 五島合照點：鏡頭轉到同時拍得到幾何鯉魚風車、木橋與鯉魚號航道的角度
function photoSpot() {
  if (S.walking) exitWalk(true);
  closePanel(false);
  const wm = W.islands.center.extras.windmill, br = W.bridges.find((b) => b.to === 'puzzle') || W.bridges[0];
  const T = new THREE.Vector3((wm.x + br.p1.x) / 2, 3.2, (wm.z + br.p1.z) / 2);
  const side = new THREE.Vector3(-(br.p1.z - wm.z), 0, br.p1.x - wm.x).normalize();
  if (side.dot(T) < 0) side.negate();                        // 從島外往內拍，背景是湖和鯉魚號航道
  const cam = T.clone().addScaledVector(side, 15).setY(8.5);
  CAM.flight({ t: T, p: cam }, 1800, 2, () => toast('📸 合照角度到了！幾何鯉魚風車、木橋和鯉魚號航道都在畫面裡，按「⚙️ 設定 → 📤 分享卡片」存一張市集合照'));
}
function goPier() {
  closePanel(false);
  const P = W.pier, T = P.E.clone().addScaledVector(P.d, (P.ST1 + P.P1) / 2).setY(.8);
  const cam = T.clone().addScaledVector(P.s, 11).addScaledVector(P.d, -4).setY(9);
  CAM.flight({ t: T, p: cam }, 1600, 2, () => toast('⚓ 這裡是手作體驗二島西側的鯉魚號碼頭，木棧道從島上的階梯走下來'));
}
function showBoatPanel() {
  const p = $('#panel'); p.innerHTML = boatPanelHTML(); p.hidden = false; S.open = 'carp';
  p.querySelector('[data-panel-close]').onclick = () => closePanel(true);
  p.querySelector('[data-boat="board"]').onclick = boardBoat;
  p.querySelector('[data-boat="pier"]').onclick = goPier;
  for (const k in tags) tags[k].setAttribute('aria-expanded', String(k === 'carp'));
  p.focus({ preventScroll: true });
}
function openBoat(opts = {}) {
  if (!W || !L) { toast('鯉魚號只在 3D 畫面裡出現'); return; }
  closeBubble(); toggleSettings(false);
  if (S.walking) exitWalk(true);
  if (S.tour) endTour(false);
  panelOpener = opts.opener || tags.carp || null;
  $('#panel').hidden = true;
  CAM.flyToBoat(L.carp.anchor, showBoatPanel);
}
// 鯉魚號最多 8 位登入者同時在船上；只有靠港、跳板放下時才能上船
const BOAT_CAP = 8;
const boatRiders = () => (PL ? PL.onBoatCount() : 0) + (S.walking && W.onBoat(CAM.walk.pos.x, CAM.walk.pos.z) ? 1 : 0);
function boardCheck() {
  const s = L.carp.status();
  if (!s.docked || !s.gang) return s.docked ? '鯉魚號正在靠港，等跳板放下就能上船' : `鯉魚號正在航行，約 ${s.eta} 秒後回到碼頭，靠港放下跳板才能上船`;
  if (boatRiders() >= BOAT_CAP) return `鯉魚號已經坐滿 ${BOAT_CAP} 人了，請等下一班`;
  return '';
}
let lastBlockToast = 0;
function canBoardWalk() {
  const why = boardCheck(); if (!why) return true;
  if (performance.now() - lastBlockToast > 3000) { lastBlockToast = performance.now(); toast('⛔ ' + why); }
  return false;
}
function boardBoat() {
  if (!W || !L) return;
  const why = boardCheck();
  if (why) { toast('⛔ ' + why); return; }
  const bs = L.carp.boardSpot(); bs.yaw += Math.PI * .62;   // 一上船先朝向船的右舷（湖景那一側），不是看乘客的背影和桅杆
  enterWalk(bs); CAM.walk.pitch = -.32; S.disHint = false;
  const s = L.carp.status();
  toast(s.docked ? '⛵ 登上鯉魚號！待會兒就出航，想下船就從船尾左側走上跳板' : '⛵ 登上鯉魚號！船靠港放下跳板後，就能走上碼頭');
}

// ------------------------------------------------------------------ 地點清單與搜尋
let filter = '全部';
function cardHTML(id) {
  const I = islandById(id), c = colorOf(id);
  const res = C.residents.filter((r) => r.island === id);
  const resList = `<details><summary>島上的人與對話（示意角色）</summary>${res.map((r) => `<div class="res" style="margin:6px 0"><b>${esc(r.name)}</b>・${esc(r.job)}<ul style="margin:4px 0 0;padding-left:18px">${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}</details>`;
  if (id === 'center') return `<article class="card" style="--c:${c}"><h3>★ ${esc(I.name)} <span class="grp">${esc(I.role)}</span></h3><p>${esc(I.intro)}</p><p>${esc(I.overview)}</p>${eventHTML()}${resList}<div class="acts"><button type="button" data-open="center">在地圖上看</button></div></article>`;
  return `<article class="card" style="--c:${c}"><h3><span class="tag" style="position:static;box-shadow:none;--tc:${c};min-height:auto;padding:0;background:none"><span class="no">${I.order}</span></span>${esc(I.name)} <span class="grp">${esc(I.group)}・${stallsOf(id).length} 攤</span>${S.stamps.includes(id) ? ' 🏮' : ''}</h3>
    <p>${esc(I.intro)}</p><ol class="stalls" style="--pc:${c}">${stallsOf(id).map((st) => `<li><button type="button" class="stall-row" data-open="${id}" data-no="${st.no}"><span class="num" aria-hidden="true">${pad2(st.no)}</span><span class="nm ${st.namePending ? 'pending' : ''}"><span class="sr-only">攤號 ${st.no}，</span>${esc(st.name)}</span><span class="go" aria-hidden="true">看介紹 ›</span></button></li>`).join('')}</ol>
    <p style="margin-top:8px"><b>地標：</b>${esc(I.landmark)}</p>${resList}
    <div class="acts"><button type="button" data-open="${id}">在地圖上看</button><a href="${esc(I.download)}" download>📄 下載攤位清單</a></div></article>`;
}
function renderList() {
  const groups = ['全部', ...C.islands.map((i) => i.group), '服務台'];
  $('#filters').innerHTML = groups.map((g) => `<button type="button" aria-pressed="${g === filter}" data-f="${g}">${g}</button>`).join('');
  const ids = ['center', ...C.islands.map((i) => i.id)].filter((id) => filter === '全部' || (id === 'center' ? filter === '服務台' : islandById(id).group === filter));
  const boat = W && L && filter === '全部' ? `<article class="card" style="--c:${C.carpBoat.color}"><h3>⛵ ${esc(C.carpBoat.name)} <span class="grp">${esc(C.carpBoat.role)}</span></h3><p>${esc(C.carpBoat.intro)}</p><p class="foot">${esc(C.carpBoat.note)}</p><div class="acts"><button type="button" data-open="carp">在地圖上看</button></div></article>` : '';
  $('#listBody').innerHTML = ids.map(cardHTML).join('') + boat + `<p class="foot">作者：${esc(C.site.author)}｜${esc(C.site.layoutNote)}｜${esc(C.residentsNote)}吉祥物造型為示意。攤位清單資料來自主辦提供的檔案，可在各島下載。</p>`;
}
$('#filters').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { filter = b.dataset.f; renderList(); } });
$('#listBody').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) { $('#listDlg').close(); openIsland(b.dataset.open, { opener: $('#listBtn'), no: b.dataset.no != null ? +b.dataset.no : undefined }); } });
function search(q) {
  q = q.trim().toLowerCase(); const out = $('#searchResults');
  if (!q) { out.innerHTML = ''; return; }
  const hits = [];
  const test = (s) => String(s).toLowerCase().includes(q);
  if ([C.center.name, C.center.role, C.center.intro, C.center.overview].some(test)) hits.push({ id: 'center', text: `★ ${C.center.name}・${C.center.role}` });
  // 攤號或攤名完全相同的排最前面，按 Enter 就直接開啟並展開那一攤
  for (const st of C.stalls) {
    const exact = String(st.no) === q || pad2(st.no) === q || st.name.toLowerCase() === q;
    if (exact || stallTexts(st).some(test)) hits.push({ id: st.island, no: st.no, exact, nameHit: [st.name, ...(st.parts || []).map((x) => x.name)].some(test), text: `${pad2(st.no)} ${st.name}（${islandById(st.island).name}）` });
  }
  for (const I of C.islands) if ([I.name, I.group, I.intro, I.landmark].some(test)) hits.push({ id: I.id, text: `${I.name}・${I.group}` });
  if (W && L && [C.carpBoat.name, C.carpBoat.role, '船', '帆船', '碼頭', 'boat'].some(test)) hits.push({ id: 'carp', exact: test(C.carpBoat.name), text: `⛵ ${C.carpBoat.name}・${C.carpBoat.role}` });
  hits.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || (b.nameHit ? 1 : 0) - (a.nameHit ? 1 : 0));
  for (const r of C.residents) if (test(r.name) || test(r.job)) hits.push({ id: r.island, text: `${r.name}・${r.job}（${islandById(r.island).name}）` });
  out.innerHTML = hits.length ? hits.slice(0, 20).map((h, i) => `<button type="button" data-id="${h.id}" ${h.no != null ? `data-no="${h.no}"` : ''} style="--c:${colorOf(h.id)}">${esc(h.text)}${i === 0 && h.no != null ? '<small class="enter">按 Enter 直接開啟</small>' : ''}</button>`).join('') : `<p class="none">找不到「${esc(q)}」，換個關鍵字試試，例如「餅乾」「迷宮」或攤號「11」。</p>`;
}
$('#searchInput').addEventListener('input', (e) => search(e.target.value));
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#searchResults button')?.click(); } });
$('#searchResults').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $('#listDlg').close(); openIsland(b.dataset.id, { no: b.dataset.no != null ? +b.dataset.no : undefined, opener: $('#searchBtn') }); });
$('#listBtn').addEventListener('click', () => { renderList(); openDlg('#listDlg'); });
$('#searchBtn').addEventListener('click', () => { renderList(); openDlg('#listDlg'); $('#searchInput').focus(); });

// ------------------------------------------------------------------ 說明
function renderHelp() {
  $('#helpBody').innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start"><span class="mascot" style="width:72px;height:72px">${MASCOT}</span><div><p style="margin:0 0 6px;font-weight:900">嗨！我是小鯉魚，帶你逛 115 鯉魚市集。</p><ul style="margin:0;padding-left:18px;line-height:1.8">${C.help.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div></div>
    <p class="foot">小提醒：右上角「⚙️ 設定」可以換底色、白天黑夜、減少動態與低畫質。<br>島嶼配置為示意，非實際場地比例；島上居民、動物與交換小遊戲都是網站上的示意內容。<br>作者：${esc(C.site.author)}</p>`;
}
$('#helpBtn').addEventListener('click', () => { renderHelp(); openDlg('#helpDlg'); });

// ------------------------------------------------------------------ 分享卡片
function openShare() {
  const url = location.origin + location.pathname + (S.open ? `?island=${S.open}` : '');
  let img = '';
  try {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630; const x = cv.getContext('2d');
    if (W) { W.renderer.render(W.scene, W.camera); const g = W.renderer.domElement; const s = Math.max(1200 / g.width, 630 / g.height); x.drawImage(g, (1200 - g.width * s) / 2, (630 - g.height * s) / 2, g.width * s, g.height * s); }
    else { x.fillStyle = '#eef3e6'; x.fillRect(0, 0, 1200, 630); }
    const gr = x.createLinearGradient(0, 380, 0, 630); gr.addColorStop(0, 'rgba(20,40,25,0)'); gr.addColorStop(1, 'rgba(20,40,25,.82)'); x.fillStyle = gr; x.fillRect(0, 300, 1200, 330);
    x.fillStyle = '#fff'; x.font = '900 64px "Noto Sans TC", sans-serif'; x.fillText('115 鯉魚市集', 50, 520);
    x.font = '700 26px "Noto Sans TC", sans-serif'; x.fillText(C.site.tagline, 52, 566);
    x.font = '700 22px "Noto Sans TC", sans-serif'; x.fillStyle = '#ffe2a8'; x.fillText(`我已經集了 ${S.stamps.length}/6 枚章${S.open ? `・正在逛 ${islandById(S.open).name}` : ''}`, 52, 604);
    img = cv.toDataURL('image/png');
  } catch (e) { img = ''; }
  $('#shareBody').innerHTML = `${img ? `<img class="share-img" src="${img}" alt="115 鯉魚市集分享卡片預覽">` : '<p>這台裝置無法產生截圖，可以直接分享連結。</p>'}
    <p style="margin:0 0 10px;word-break:break-all;font-size:14px">${esc(url)}</p>
    <div class="row">${img ? `<a class="btn" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;flex:1" href="${img}" download="115鯉魚市集.png">⬇ 下載圖片</a>` : ''}<button type="button" class="btn ghost" id="copyLink" style="flex:1">🔗 複製連結</button>${navigator.share ? '<button type="button" class="btn ghost" id="nativeShare" style="flex:1">📤 分享</button>' : ''}</div>`;
  $('#copyLink').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('連結已複製'); } catch (e) { toast('無法自動複製，請手動選取上面的網址'); } };
  if ($('#nativeShare')) $('#nativeShare').onclick = () => navigator.share({ title: '115 鯉魚市集', text: C.site.tagline, url }).catch(() => {});
  openDlg('#shareDlg');
}

// ------------------------------------------------------------------ 3D 標籤（島名＋攤數，避免重疊）
const tags = {};
function buildTags() {
  const box = $('#labels');
  for (const id of STAMP_IDS) {
    const I = islandById(id), c = colorOf(id);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tag' + (id === 'center' ? ' center' : '');
    b.style.setProperty('--tc', c); if (I.tint) { b.style.setProperty('--ttint', I.tint); b.style.setProperty('--tink', I.ink); }
    b.setAttribute('aria-label', id === 'center' ? `${I.name}，${I.role}` : `第 ${I.order} 島 ${I.name}，${stallsOf(id).length} 攤`);
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'panel');
    b.innerHTML = id === 'center' ? `<span>★ ${esc(I.name)}</span><span class="ct">活動資訊</span><span class="st"></span>` : `<span class="no">${I.order}</span><span>${esc(I.name)}</span><span class="ct">${stallsOf(id).length} 攤</span><span class="st"></span>`;
    b.addEventListener('click', () => openIsland(id, { opener: b }));
    box.append(b); tags[id] = b;
  }
  if (L && L.carp) {
    const B = C.carpBoat, b = document.createElement('button'); b.type = 'button'; b.className = 'tag boat';
    b.style.setProperty('--tc', B.color); b.style.setProperty('--ttint', '#fde8e1'); b.style.setProperty('--tink', '#7a2412');
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'panel');
    b.innerHTML = `<span class="no" aria-hidden="true">⛵</span><span>${esc(B.name)}</span><span class="ct"></span><span class="dir" aria-hidden="true">➜</span>`;
    b.addEventListener('click', () => openBoat({ opener: b }));
    box.append(b); tags.carp = b;
  }
}
const _v = new THREE.Vector3();
function placeTags() {
  const w = innerWidth, h = innerHeight, rects = [];
  for (const id of STAMP_IDS) {
    const I = W.islands[id], t = tags[id];
    // 小島的名牌放在島的外緣（離中央島最遠的那一邊），不會擋住服務台、風車和橋；服務台維持在島的前緣
    if (id !== 'center') { const a = Math.atan2(I.pos.z, I.pos.x), r = I.top(a) * 1.05; _v.set(I.pos.x + Math.cos(a) * r, .6, I.pos.z + Math.sin(a) * r).project(W.camera); }
    else _v.set(I.pos.x, .6, I.pos.z + I.R * 1.12).project(W.camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
    t.style.visibility = vis ? 'visible' : 'hidden';
    // 鏡頭拉近看某座島時，其他島的名牌變淡、縮小，不擋住眼前的風車和攤子
    const camD = W.camera.position.distanceTo(CAM.controls.target), focusD = Math.hypot(I.pos.x - CAM.controls.target.x, I.pos.z - CAM.controls.target.z);
    t.classList.toggle('far', !S.tour && camD < 18 && focusD > I.R * 1.1);
    const tw = t.offsetWidth || 160, th = t.offsetHeight || 44;
    rects.push({ t, x: (_v.x + 1) / 2 * w - tw / 2, y: (1 - _v.y) / 2 * h - th / 2, w: tw, h: th, vis });
  }
  if (tags.carp) {
    const t = tags.carp, g = L.carp.g, st = boatStatus();
    _v.set(g.position.x, 9.2, g.position.z).project(W.camera);
    if (_v.z > 1) { _v.x = -_v.x * 9; _v.y = -_v.y * 9; }                 // 在鏡頭後方：反向推到邊緣
    const tw = t.offsetWidth || 140, th = t.offsetHeight || 44;
    let x = (_v.x + 1) / 2 * w - tw / 2, y = (1 - _v.y) / 2 * h - th;
    // 船開到畫面外時，標籤停在畫面邊緣、箭頭指向船，隨時點得到
    const top = 76, bot = h - th - 90, cx = Math.max(4, Math.min(w - tw - 4, x)), cy = Math.max(top, Math.min(bot, y));
    const edge = cx !== x || cy !== y; t.classList.toggle('edge', edge);
    if (edge) { const ang = Math.atan2(y - cy, x - cx); t.querySelector('.dir').style.transform = `rotate(${ang}rad)`; }
    t.style.visibility = 'visible';
    const ct = t.querySelector('.ct'); if (ct.textContent !== st.short) { ct.textContent = st.short; t.setAttribute('aria-label', `鯉魚號，虛擬遊船，${st.short}`); }
    S.boatRect = { t, x: cx, y: cy, w: tw, h: th };
  }
  rects.sort((a, b) => a.y - b.y);
  for (let i = 0; i < rects.length; i++) for (let j = 0; j < i; j++) {
    const a = rects[j], b = rects[i];
    if (!a.vis || !b.vis) continue;
    if (b.x < a.x + a.w + 4 && b.x + b.w + 4 > a.x && b.y < a.y + a.h + 4) b.y = a.y + a.h + 4;   // 往下推開，不互相重疊
  }
  // 鯉魚號標籤讓位給島名：島名位置不變，船的標籤往上（或往下）避開
  const B = tags.carp && S.boatRect;
  if (B) {
    const hit = (y) => rects.find((a) => a.vis && B.x < a.x + a.w + 4 && B.x + B.w + 4 > a.x && y < a.y + a.h + 4 && y + B.h + 4 > a.y);
    let y = B.y, r, n = 0;
    while ((r = hit(y)) && n++ < 8) y = r.y - B.h - 4;
    if (y < 70) { y = B.y; n = 0; while ((r = hit(y)) && n++ < 8) y = r.y + r.h + 4; }
    rects.push({ t: B.t, x: B.x, y, w: B.w, h: B.h });
  }
  // 名牌不要壓到下方固定的介面（比例說明、時鐘、背包；手機還有底部工具列）
  const maxY = h - (isMobile() ? 196 : 96);
  for (const r of rects) r.t.style.transform = `translate(${Math.round(Math.max(4, Math.min(w - r.w - 4, r.x)))}px,${Math.round(Math.min(r.y, maxY - r.h))}px)`;
}

// ------------------------------------------------------------------ 對話泡泡（居民、動物）
function openBubble(o) {
  closeBubble();
  S.bubble = { o, line: 0 };
  if (o.agent) o.agent.talking = true; if (o.animal) o.animal.talking = true;
  $('#labels').classList.add('dim');
  renderBubble(); $('#bubble').hidden = false;
  $('#bubble').querySelector('button')?.focus({ preventScroll: true });
}
function renderBubble(msg) {
  const B = S.bubble; if (!B) return; const o = B.o, el = $('#bubble');
  if (o.animal) {
    const a = o.animal.data;
    el.innerHTML = `<p class="who">${a.icon} ${esc(a.name)}</p><p class="where">${esc(islandById(o.animal.island.id).name)}</p><p class="say">${esc(a.line)}</p><div class="acts"><button type="button" data-b="x">✕ 關閉</button></div>`;
  } else {
    const r = o.agent.data, trade = r.trade ? C.trades.find((t) => t.id === r.trade) : null;
    const have = trade ? (S.bag[trade.give] || 0) : 0, can = trade && have >= trade.giveQty;
    el.innerHTML = `<p class="who">${esc(r.name)}<span class="sample">（示意角色）</span></p><p class="where">${esc(r.job)}・${esc(islandById(r.island).name)}</p>
      <p class="say">${esc(msg || r.lines[B.line % r.lines.length])}</p>
      <div class="acts"><button type="button" data-b="more">💬 再聊聊</button>${trade ? `<button type="button" class="pri" data-b="trade" ${can ? '' : 'disabled'} aria-describedby="tradeHint">🔁 交易 ${C.items[trade.give].icon}×${trade.giveQty}→${C.items[trade.get].icon}</button>` : ''}<button type="button" data-b="x" aria-label="關閉對話">✕</button></div>
      ${trade ? `<p class="hint" id="tradeHint">${can ? `用 ${trade.giveQty} 個${esc(C.items[trade.give].name)}換一個${esc(C.items[trade.get].name)}。` : `你的${esc(C.items[trade.give].name)}不夠（${have}/${trade.giveQty}）。提示：${esc(trade.hint)}。`}</p>` : ''}`;
  }
  el.querySelectorAll('[data-b]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation(); const k = b.dataset.b;
    if (k === 'x') closeBubble();
    else if (k === 'more') { B.line++; renderBubble(); el.querySelector('[data-b="more"]')?.focus(); }
    else if (k === 'trade') doTrade();
  }));
}
function doTrade() {
  const r = S.bubble.o.agent.data, t = C.trades.find((x) => x.id === r.trade);
  if ((S.bag[t.give] || 0) < t.giveQty) return;
  S.bag[t.give] -= t.giveQty; S.bag[t.get] = (S.bag[t.get] || 0) + 1; saveBag();
  toast(`🔁 換到 ${C.items[t.get].icon} ${C.items[t.get].name}！`);
  renderBubble(`謝謝你！這個${C.items[t.get].name}給你，好好收著喔！`);
  if (t.get === 'postcard') setTimeout(() => toast('💌 你換到最稀有的「島主的明信片」了！'), 1600);
}
function closeBubble() {
  if (!S.bubble) return;
  const o = S.bubble.o; if (o.agent) o.agent.talking = false; if (o.animal) o.animal.talking = false;
  S.bubble = null; $('#bubble').hidden = true; $('#labels').classList.remove('dim');
}
function placeBubble() {
  if (!S.bubble) return;
  const p = L.headOf(S.bubble.o).project(W.camera), el = $('#bubble');
  const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
  const w = el.offsetWidth, half = w / 2;
  el.style.transform = `translate(${Math.round(Math.max(half + 8, Math.min(innerWidth - half - 8, x)) - half)}px, ${Math.round(Math.max(el.offsetHeight + 70, y) - el.offsetHeight - 14)}px)`;
}

// ------------------------------------------------------------------ 點擊 3D 畫面
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
function onCanvasDown(e) { down = { x: e.clientX, y: e.clientY }; $('#gl').classList.add('drag'); if (S.tour && !S.tour.paused) pauseTour(true); }
function onCanvasUp(e) {
  $('#gl').classList.remove('drag');
  if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (moved > 7 || S.intro) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  // 氣球彩蛋：點氣球就刺破（漫遊時也可以）；熱氣球刺不破
  ray.setFromCamera(ndc, W.camera);
  if (FX) { const bh = ray.intersectObjects(FX.balloons(), false)[0]; if (bh && FX.pop(bh.object)) { balloonPopped(); return; } }
  if (GM && GM.pick(ray)) return;                 // 釣魚區、躲貓貓
  if (IA && IA.pick(ray)) return;                 // 可以互動的地標（果汁杯、貼紙牆、彈珠、書櫃、合照點）
  // 漫遊時點攤位招牌或攤子：留在地面，右邊直接打開那一攤的介紹（不飛回鳥瞰）
  if (S.walking && SG) {
    const sw = ray.intersectObjects(SG.pickables.map((p) => p.obj), false)[0];
    if (sw && sw.distance < 25) { const sg = SG.pickables.find((p) => p.obj === sw.object).sign; closeBubble(); panelOpener = null; showPanel(sg.island, sg.st.no); return; }
  }
  if (S.walking || (CAM.S.busy && !CAM.S.busy.custom)) return;
  ray.setFromCamera(ndc, W.camera);
  const life = ray.intersectObjects(L.pickables.filter((p) => p.obj.parent && p.obj.parent.visible).map((p) => p.obj), false)[0];
  let pick = life ? L.pickables.find((p) => p.obj === life.object) : null;
  if (!pick && (e.pointerType === 'touch' || isMobile())) {   // 手機：用螢幕距離找最近的居民或動物
    let best = null, bd = 46;
    for (const p of L.pickables) {
      if (p.shell || !p.obj.parent.visible) continue;
      const s = L.headOf(p).project(W.camera); if (s.z > 1) continue;
      const d = Math.hypot((s.x + 1) / 2 * innerWidth - e.clientX, (1 - s.y) / 2 * innerHeight - e.clientY - 24);
      if (d < bd) { bd = d; best = p; }
    }
    pick = best;
  }
  if (pick && pick.shell) { if (performance.now() >= pick.shell.hiddenUntil) { pick.shell.hiddenUntil = performance.now() + 20000; S.bag.shell = (S.bag.shell || 0) + 1; saveBag(); toast('🐚 撿到一個貝殼！+1'); } return; }
  if (pick) { openBubble(pick); return; }
  // 攤位立牌：點牌子直接打開那一攤的攤位卡
  const sh = SG && ray.intersectObjects(SG.pickables.map((p) => p.obj), false)[0];
  if (sh) { const sg = SG.pickables.find((p) => p.obj === sh.object).sign; closeBubble(); openIsland(sg.island, { no: sg.st.no }); return; }
  if (S.bubble) { closeBubble(); return; }
  let best = null;
  for (const id of STAMP_IDS) {
    const hit = ray.intersectObjects(W.islands[id].pick, false)[0];
    if (hit && (!best || hit.distance < best.d)) best = { id, d: hit.distance };
  }
  const bh = L.carp && ray.intersectObject(L.carp.g, true)[0];
  if (bh && (!best || bh.distance < best.d)) { openBoat({ opener: tags.carp }); return; }
  if (best) openIsland(best.id, { opener: tags[best.id] });
}

// ------------------------------------------------------------------ 自動導覽路線
let TOUR = ['center', 'food', 'craft', 'puzzle', 'recycle', 'sport'];   // 開機後依 content.json 的島嶼順序重設
const DWELL = () => (S.reduced ? 8000 : 5000);
function startTour() {
  if (!W) return; closeBubble(); closePanel(false); if (S.walking) exitWalk(true);
  S.tour = { i: 0, paused: false, left: DWELL(), flying: false, last: performance.now() };
  $('#tour').hidden = false; $('#tourBtn').classList.add('on'); goStation(0);
}
function goStation(i) {
  const T = S.tour; T.i = (i + TOUR.length) % TOUR.length; T.left = DWELL(); T.flying = true;
  const id = TOUR[T.i], I = islandById(id);
  $('#tourStep').textContent = `第 ${T.i + 1} 站／共 ${TOUR.length} 站`;
  $('#tourName').textContent = id === 'center' ? `★ ${I.name}` : `${I.order}　${I.name}`;
  $('#tourText').textContent = id === 'center' ? `${I.intro}` : `${I.intro}　共 ${stallsOf(id).length} 攤：${stallsOf(id).map((s) => pad2(s.no)).join('、')}`;
  $('#tourMore').textContent = id === 'center' ? '🕘 看活動時程' : '📋 看本島攤位';
  $('#tourBar').style.width = '0%';
  CAM.flight(CAM.islandView(W.islands[id]), 1800, 10, () => { if (S.tour) { S.tour.flying = false; S.tour.last = performance.now(); } });
}
function pauseTour(on) { const T = S.tour; if (!T) return; T.paused = on; $('#tourPause').textContent = on ? '▶ 繼續' : '⏸ 暫停'; $('#tourPause').setAttribute('aria-label', on ? '繼續' : '暫停'); T.last = performance.now(); }
function stepTour(now) {
  const T = S.tour; if (!T || T.flying) return;
  const dt = now - T.last; T.last = now; if (T.paused) return;
  T.left -= dt; $('#tourBar').style.width = `${Math.min(100, (1 - T.left / DWELL()) * 100)}%`;
  if (T.left <= 0) { if (T.i === TOUR.length - 1) endTour(true); else goStation(T.i + 1); }
}
function endTour(goHome) { if (!S.tour) return; S.tour = null; $('#tour').hidden = true; $('#tourBtn').classList.remove('on'); if (goHome) CAM.home(); }
$('#tourBtn').addEventListener('click', () => (S.tour ? endTour(true) : startTour()));
$('#tourPrev').addEventListener('click', () => goStation(S.tour.i - 1));
$('#tourNext').addEventListener('click', () => { if (S.tour.i === TOUR.length - 1) endTour(true); else goStation(S.tour.i + 1); });
$('#tourPause').addEventListener('click', () => pauseTour(!S.tour.paused));
// 導覽卡上的「看本島攤位／看活動時程」：暫停導覽、打開這一站的面板，關掉面板後接著導覽
$('#tourMore').addEventListener('click', () => { if (!S.tour) return; const id = TOUR[S.tour.i]; pauseTour(true); S.tourPanel = true; showPanel(id); });
$('#tourEnd').addEventListener('click', () => endTour(true));

// ------------------------------------------------------------------ 地面漫遊
let hintT = 0;
function enterWalk(at) {
  if (!W) return; closeBubble(); closePanel(false); if (S.tour) endTour(false);
  S.walking = true; document.body.classList.add('walking'); $('#walkui').hidden = false; $('#walkBtn').classList.add('on');
  // 已加入市集：從自己的人物所在位置出發，預設第三人稱看得到自己
  let mine = PL && PL.me() ? PL.spawnFor() : null;
  if (mine && W.ground(mine.pos.x, mine.pos.z) == null) { const g = W.nearestGround(mine.pos.x, mine.pos.z, 6); mine = g ? { pos: new THREE.Vector3(g.x, g.y, g.z), yaw: mine.yaw } : startSpot(); }   // 人物在海上（例如船開走了）就回到陸地
  CAM.walk.third = !!mine && store.get('view', 'third') === 'third'; $('#walkView').hidden = !mine; syncViewBtn();
  CAM.enterWalk(at && at.pos ? at : mine || startSpot()); const h = $('#walkHint'); h.classList.remove('fade'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.add('fade'), 4500);
  $('#walkExit').focus({ preventScroll: true });
}
// 漫遊起點：站在服務台往第 1 島的橋頭前一小段，面向路口，一進來就看到橋、路牌和島名
function startSpot() {
  const b = W.bridges.find((x) => x.to === C.islands[0].id) || W.bridges[0];
  const dx = Math.cos(b.a), dz = Math.sin(b.a);
  for (const back of [5.2, 4.6, 4.0, 3.4, 2.8]) {
    const x = b.p0.x - dx * back, z = b.p0.z - dz * back, h = W.ground(x, z);
    if (h != null) return { pos: new THREE.Vector3(x, h, z), yaw: Math.atan2(dx, dz) };
  }
  return null;
}
function exitWalk(instant) {
  if (!S.walking) return; S.walking = false; document.body.classList.remove('walking'); $('#walkui').hidden = true; $('#walkBtn').classList.remove('on');
  for (const k in CAM.walk.keys) CAM.walk.keys[k] = false; for (const k in CAM.walk.pad) CAM.walk.pad[k] = false;
  if (GM) GM.onExitWalk(); $('#fishUI').hidden = true;
  CAM.exitWalk(); if (instant) { CAM.setHome(true); CAM.S.busy = null; CAM.controls.enabled = true; }
  // 離開漫遊時人物若站在鯉魚號上或水面，放回最近的陸地（船開走後才不會留在海上）
  const m = PL && PL.me();
  if (m && (W.onBoat(m.pos.x, m.pos.z) || W.ground(m.pos.x, m.pos.z) == null)) {
    const P = W.pier, land = P ? P.E.clone().addScaledVector(P.d, P.ST0 - .4) : null;
    const g = land && W.ground(land.x, land.z) != null ? { x: land.x, y: W.ground(land.x, land.z), z: land.z } : W.nearestGround(m.pos.x, m.pos.z);
    if (g) m.pos.set(g.x, g.y, g.z);
  }
}
$('#walkBtn').addEventListener('click', () => (S.walking ? exitWalk() : enterWalk()));
$('#walkExit').addEventListener('click', () => exitWalk());
function syncViewBtn() { $('#walkView').textContent = CAM && CAM.walk.third ? '👁 切換成第一人稱' : '🧍 切換成看得到自己'; }
$('#walkView').addEventListener('click', () => { CAM.walk.third = !CAM.walk.third; store.set('view', CAM.walk.third ? 'third' : 'first'); syncViewBtn(); });

// ------------------------------------------------------------------ 用暱稱加入市集（目前只在這台裝置；之後接連線服務會看到其他人）
let PL = null;
const BAD_WORDS = ['幹', '靠北', '靠杯', '白痴', '白癡', '智障', '垃圾', '去死', '屌', '機掰', '雞掰', '王八', '賤', 'fuck', 'shit', 'bitch', 'damn', 'sex'];
function cleanName(s) { return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim(); }
function nameProblem(n) {
  if (!n) return '請輸入暱稱';
  if ([...n].length > 10) return '暱稱最多 10 個字';
  const low = n.toLowerCase().replace(/[\s._\-*]/g, '');
  if (BAD_WORDS.some((w) => low.includes(w))) return '這個暱稱不太適合，換一個吧';
  return '';
}
const meProfile = () => store.get('me', null);
function renderMe() {
  const p = meProfile(), R = p && ROLES[p.role];
  $('#meName').textContent = p ? p.name : '加入';
  $('#meBtn').setAttribute('aria-label', p ? `我的暱稱：${p.name}（${R ? R.label : ''}），點一下修改或離開` : '用暱稱加入市集');
  $('#meBtn').classList.toggle('on', !!p);
  if (PL) PL.setMe(p);
  if (NET) NET.setMe(p);
  if (S.walking) { $('#walkView').hidden = !p; if (!p) CAM.walk.third = false; syncViewBtn(); }
}
function openMe() {
  const p = meProfile() || {}, role = p.role || 'student', shirt = p.shirt || OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
  const pass = ppActive && ppActive();
  $('#meBody').innerHTML = `<form id="meForm" class="pp-form" novalidate>
    <p style="margin:0 0 10px">${p.name ? '可以修改暱稱、身分、衣服顏色和帽子。' : '取一個暱稱、選身分、衣服顏色和帽子，你的小人物就會出現在島上，頭上有你的名牌。'}</p>
    <label for="meNick" class="pp-lab">暱稱（最多 10 個字）</label>
    <input id="meNick" class="pp-in" type="text" maxlength="12" autocomplete="nickname" placeholder="例如：小鯉魚" value="${esc(p.name || (pass ? pass.name : ''))}" required>
    <p class="pp-err" id="meErr" role="alert" hidden></p>
    <fieldset class="me-set"><legend class="pp-lab">身分</legend><div class="me-roles">${Object.entries(ROLES).map(([k, r]) => `<label class="me-role" style="--rc:${r.color}"><input type="radio" name="role" value="${k}" ${k === role ? 'checked' : ''}><span>${r.icon} ${r.label}</span></label>`).join('')}</div></fieldset>
    <fieldset class="me-set"><legend class="pp-lab">衣服顏色</legend><div class="me-colors">${OUTFITS.map((c, i) => `<label class="me-color" style="--c:${c}"><input type="radio" name="shirt" value="${c}" ${c === shirt ? 'checked' : ''} aria-label="顏色 ${i + 1}"><span></span></label>`).join('')}</div></fieldset>
    <fieldset class="me-set"><legend class="pp-lab">帽子（每頂都有小鯉魚 Logo）</legend><div class="me-roles me-hats">${Object.entries(HATS).map(([k, h]) => `<label class="me-role" style="--rc:#e8762b"><input type="radio" name="hat" value="${k}" ${k === (p.hat || 'none') ? 'checked' : ''}><span>${h.icon} ${h.label}</span></label>`).join('')}</div></fieldset>
    <div class="chal-btns"><button type="submit" class="btn">${p.name ? '儲存' : '加入市集'}</button>${p.name ? '<button type="button" class="btn ghost" id="meLeave">離開市集</button>' : ''}</div>
    <p class="foot">請用暱稱，不要用真實姓名。暱稱和人物目前只存在這台裝置。</p></form>`;
  openDlg('#meDlg'); $('#meNick').focus();
  $('#meForm').onsubmit = (e) => {
    e.preventDefault();
    const name = cleanName($('#meNick').value), bad = nameProblem(name);
    if (bad) { const er = $('#meErr'); er.textContent = bad; er.hidden = false; $('#meNick').focus(); return; }
    const f = new FormData(e.target);
    const next = { id: p.id || `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name, role: f.get('role') || 'student', shirt: f.get('shirt') || shirt, hat: f.get('hat') || 'none', joinedAt: p.joinedAt || new Date().toISOString() };
    store.set('me', next); $('#meDlg').close(); renderMe();
    toast(p.name ? '已更新你的名牌' : `👋 歡迎 ${name}！按「🚶 漫遊」就能帶著自己的人物逛島`);
  };
  if ($('#meLeave')) $('#meLeave').onclick = () => { store.set('me', null); $('#meDlg').close(); renderMe(); toast('已離開市集，你的人物從島上收起來了'); };
}
$('#meBtn').addEventListener('click', openMe);
// 小遊戲規則（content.json 的 games）；躲貓貓開始前先看規則，按「開始」才開始
function openRules(kind, onStart) {
  const R = (C.games || {})[kind]; if (!R) return;
  $('#rulesTitle').textContent = R.title;
  $('#rulesBody').innerHTML = `<ol class="rules-list">${R.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    <div class="chal-btns">${onStart ? '<button type="button" class="btn" id="rulesGo">▶ 我看懂了，開始！</button>' : ''}<button type="button" class="btn ghost" id="rulesOk">${onStart ? '先不要' : '知道了'}</button></div>`;
  openDlg('#rulesDlg');
  $('#rulesOk').onclick = () => $('#rulesDlg').close();
  if (onStart) $('#rulesGo').onclick = () => { $('#rulesDlg').close(); onStart(); };
}
// 躲貓貓選單：規則＋單人玩＋多人玩（登入且連上線才有多人）
let HM = null, hideSolo = null;
function openHideMenu(solo) { hideSolo = solo; renderHideMenu(); openDlg('#hideDlg'); }
function renderHideMenu() {
  const R = (C.games || {}).hide, MR = (C.games || {}).hideMP;
  const ph = HM ? HM.phase() : 'none', inR = HM && HM.inRound();
  let mp;
  if (!meProfile()) mp = '<p class="foot">多人版要先按右下角「👤 加入」取暱稱。</p>';
  else if (!HM) mp = '<p class="foot">多人版需要連上網路，現在還沒連上。</p>';
  else {
    const btns = [];
    if (ph === 'none' || ph === 'stale') btns.push('<button type="button" class="btn" data-mp="open">👥 開一局</button>');
    else if (ph === 'lobby' && !inR) btns.push('<button type="button" class="btn" data-mp="open">🙋 加入這一局</button>');
    if (ph === 'lobby' && inR && HM.isHost()) btns.push(`<button type="button" class="btn" data-mp="start" ${HM.count() < 2 ? 'disabled' : ''}>▶ 開始（${HM.count()} 人）</button>`);
    if (ph === 'lobby' && inR) btns.push('<button type="button" class="btn ghost" data-mp="leave">離開</button>');
    mp = `${HM.lobbyHTML(esc)}<div class="chal-btns">${btns.join('')}</div>${ph === 'lobby' && inR && !HM.isHost() ? '<p class="foot">等主持人按「開始」…</p>' : ''}`;
  }
  $('#hideBody').innerHTML = `<div class="p-sec"><h3>👥 多人玩（最多 8 人）</h3>${mp}
      <details class="rules-more"><summary>📜 多人規則</summary><ol class="rules-list">${(MR ? MR.rules : []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details></div>
    <div class="p-sec"><h3>🙋 單人玩</h3><p class="foot" style="margin:0 0 6px">3 分鐘找出 5 個戴鯉魚帽的小朋友。</p>
      <div class="chal-btns"><button type="button" class="btn ghost" data-mp="solo">▶ 單人開始</button></div>
      <details class="rules-more"><summary>📜 單人規則</summary><ol class="rules-list">${R.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details></div>`;
}
$('#hideBody').addEventListener('click', async (e) => {
  const b = e.target instanceof Element && e.target.closest('[data-mp]'); if (!b) return;
  const k = b.dataset.mp;
  if (k === 'solo') { $('#hideDlg').close(); hideSolo && hideSolo(); return; }
  if (!HM) return;
  if (k === 'open') { await HM.open(); }
  if (k === 'start') { HM.start(); $('#hideDlg').close(); return; }
  if (k === 'leave') { HM.leave(); }
  setTimeout(renderHideMenu, 300);
});
// 釣魚圖鑑
function openFishLog() {
  const L = store.get('fishlog', {}) || {};
  $('#fishBody').innerHTML = `<ul class="fish-log">${FISHES.map((f) => { const r = L[f.id]; return `<li class="${r ? 'got' : ''}"><span class="fi">${r ? f.icon : '❔'}</span><b>${r ? esc(f.name) : '？？？'}</b><small>${r ? `釣到 ${r.n} 次${r.best ? `・最大 ${r.best} 公分` : ''}` : '還沒釣到'}</small></li>`; }).join('')}</ul>
    <p class="foot">釣魚區在：鯉魚號碼頭的棧道、美食補給島和循環挖寶島的岸邊。第一次釣到新的種類送一個貝殼，全部收集完成送島主的明信片。</p>`;
  openDlg('#fishDlg');
}

// ------------------------------------------------------------------ 我的必逛清單＋鯉魚幣預算＋10 枚幣挑戰（存在這台裝置）
const PLAN_KEY = 'plan';
const planGet = () => { const p = store.get(PLAN_KEY, null); return p && p.items ? p : { items: [] }; };   // items: [{ no, n }]
const planSet = (p) => { store.set(PLAN_KEY, p); renderPlanChip(); refreshFavBtns(); };
const isFav = (no) => planGet().items.some((x) => x.no === no);
const coinOf = (st) => (st.no === 20 ? null : 1);   // 第 20 攤付款方式待確認
function favBtnHTML(no) { const on = isFav(no); return `<button type="button" class="fav-btn${on ? ' on' : ''}" data-fav="${no}" aria-pressed="${on}">${on ? '★ 已加入必逛' : '☆ 加入必逛'}</button>`; }
function refreshFavBtns() { document.querySelectorAll('[data-fav]').forEach((b) => { const on = isFav(+b.dataset.fav); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★ 已加入必逛' : '☆ 加入必逛'; }); }
function toggleFav(no) {
  const p = planGet(), i = p.items.findIndex((x) => x.no === no);
  if (i >= 0) { p.items.splice(i, 1); toast(`已從必逛移除第 ${pad2(no)} 攤`); }
  else { p.items.push({ no, n: 1 }); toast(`⭐ 第 ${pad2(no)} 攤加入必逛（共 ${p.items.length} 攤）`); }
  planSet(p);
}
document.addEventListener('click', (e) => { const b = e.target instanceof Element && e.target.closest('[data-fav]'); if (!b) return; e.stopPropagation(); toggleFav(+b.dataset.fav); });
function renderPlanChip() { const n = planGet().items.length; const el = $('#planCount'); if (el) el.textContent = n; }
const COINS = 10;
function planHTML() {
  const p = planGet(), rows = p.items.map((x) => ({ ...x, st: stallByNo(x.no) })).filter((x) => x.st);
  const spend = rows.reduce((s, x) => s + (coinOf(x.st) == null ? 0 : x.n * coinOf(x.st)), 0), left = COINS - spend;
  const types = new Set(rows.map((x) => x.st.type));
  const ch = [['food', '🍪 一樣美食'], ['craft', '✂️ 一次手作'], ['game', '🎯 一個遊戲']].map(([k, l]) => `<li class="${types.has(k) ? 'ok' : ''}">${types.has(k) ? '✓' : '○'} ${l}</li>`).join('');
  const done = ['food', 'craft', 'game'].every((k) => types.has(k)) && left >= 0;
  const list = rows.length ? `<ol class="plan-list">${rows.map((x) => { const I = islandById(x.st.island), c = coinOf(x.st);
    return `<li style="--pc:${colorOf(x.st.island)}"><button type="button" class="plan-go" data-plan-go="${x.st.no}"><b>${pad2(x.st.no)}</b> ${esc(x.st.name)}<small>${esc(I.name)}${x.st.short ? `・${esc(x.st.short)}` : ''}</small></button>
      <span class="plan-n">${c == null ? '<small>費用待確認</small>' : `<button type="button" data-plan-n="${x.st.no}" data-d="-1" aria-label="少一次">−</button><b>${x.n}</b><button type="button" data-plan-n="${x.st.no}" data-d="1" aria-label="多一次">＋</button>`}</span>
      <button type="button" class="plan-x" data-fav="${x.st.no}" aria-label="移除">✕</button></li>`; }).join('')}</ol>`
    : '<p class="foot">還沒有必逛攤位。打開任一攤的介紹，按「☆ 加入必逛」。建議先挑三攤！</p>';
  return `<div class="plan-budget ${left < 0 ? 'over' : ''}"><b>預計花 ${spend} 枚，還有 ${left} 枚</b><div class="coins" aria-hidden="true">${Array.from({ length: COINS }, (_, i) => `<i class="${i < spend ? 'used' : ''}"></i>`).join('')}</div>
      <p class="foot" style="margin:4px 0 0">${left < 0 ? '⚠ 超過 10 枚了，刪掉一些吧' : left > 0 ? `留 ${left} 枚給現場臨時發現的好物也不錯` : '剛好用完 10 枚'}</p></div>
    ${list}
    <div class="plan-ch"><h3>🪙 10 枚幣挑戰</h3><p class="foot" style="margin:0 0 4px">用 10 枚幣安排一趟市集，要包含：</p><ul>${ch}</ul>${done ? '<p class="plan-done">🎉 挑戰成功！你的安排有吃、有做、也有玩</p>' : ''}</div>
    <div class="chal-btns"><button type="button" class="btn" id="planCopy">📋 複製我的安排（跟同學比比看）</button><button type="button" class="btn ghost" id="planPrint">🖨️ 紙本小導覽</button></div>
    <p class="foot">清單只存在這台裝置。每個遊戲或物品 1 枚鯉魚幣，以現場為準。</p>`;
}
function openPlan() { $('#planBody').innerHTML = planHTML(); openDlg('#planDlg'); }
$('#planBtn').addEventListener('click', openPlan);
$('#planBody').addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  const nb = t.closest('[data-plan-n]');
  if (nb) { const p = planGet(), it = p.items.find((x) => x.no === +nb.dataset.planN); if (it) { it.n = Math.max(1, Math.min(10, it.n + +nb.dataset.d)); planSet(p); } $('#planBody').innerHTML = planHTML(); return; }
  if (t.closest('[data-fav]')) { setTimeout(() => ($('#planBody').innerHTML = planHTML())); return; }
  const go = t.closest('[data-plan-go]'); if (go) { $('#planDlg').close(); const st = stallByNo(+go.dataset.planGo); if (S.walking) exitWalk(true); openIsland(st.island, { no: st.no }); return; }
  if (t.closest('#planPrint')) { window.open('print.html', '_blank'); return; }
  if (t.closest('#planCopy')) {
    const p = planGet(), rows = p.items.map((x) => stallByNo(x.no)).filter(Boolean);
    const spend = p.items.reduce((s, x) => s + (x.no === 20 ? 0 : x.n), 0);
    const txt = `我的 115 鯉魚市集安排（預計花 ${spend} 枚，還有 ${COINS - spend} 枚）\n` + p.items.map((x) => { const st = stallByNo(x.no); return `・${pad2(x.no)} ${st.name}（${islandById(st.island).name}）× ${x.n}`; }).join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('📋 已複製，可以貼給同學比比看'), () => toast('這台裝置不能自動複製，請截圖分享'));
  }
});

// ------------------------------------------------------------------ 現場市集公告（content.json 的 center.notices，最新一則顯示在首頁）
function renderNotice() {
  const list = (C.center.notices || []).filter((n) => n && n.text);
  const el = $('#noticeBar'); if (!list.length) { el.hidden = true; return; }
  const n = list[list.length - 1];
  if (store.get('noticeSeen', '') === n.time + n.text) { el.hidden = true; return; }
  el.hidden = false; el.querySelector('.nt').textContent = n.text; el.querySelector('.nw').textContent = `更新 ${n.time}`;
  el.querySelector('.nx').onclick = () => { store.set('noticeSeen', n.time + n.text); el.hidden = true; };
}
// 首頁的「12/12 市集資訊」：不用先找服務台，直接看日期、地點、時程和鯉魚幣規則
$('#infoBtn').addEventListener('click', () => {
  if (!C) return;
  const ns = (C.center.notices || []).filter((n) => n && n.text).slice().reverse();
  $('#infoBody').innerHTML = `${ns.length ? `<div class="p-sec"><h3>📢 市集公告</h3><ul class="nt-list">${ns.map((n) => `<li><small>${esc(n.time)}</small> ${esc(n.text)}</li>`).join('')}</ul></div>` : ''}${liveCardHTML()}<div class="p-sec"><h3>時程與規則</h3>${eventHTML()}</div>
    <div class="chal-btns"><button type="button" class="btn ghost" id="infoGo">★ 到服務台看更多</button></div>`;
  openDlg('#infoDlg');
  $('#infoGo').onclick = () => { $('#infoDlg').close(); openIsland('center'); };
});

// ------------------------------------------------------------------ 多人連線與即時人數（content.json 的 multiplayer）
let NET = null, COUNT = null, SG = null, FX = null, FA = null, IA = null, GM = null, FISHES = [], KIT = null;
// 刺破氣球的彩蛋：每一顆都有一句話；第 5、10、20、50 顆有特別獎勵
const POP_LINES = ['啵！氣球破掉了 🎈', '砰！嚇了小鯉魚一跳', '啵～裡面飄出一張小紙條：「祝你逛得開心！」', '砰！五彩紙片飛滿天', '啵！攤主說：「再來一顆？」', '砰！小心別嚇到旁邊的蝴蝶', '啵～聽說刺破很多顆會有驚喜…'];
function balloonPopped() {
  const n = (store.get('pops', 0) || 0) + 1; store.set('pops', n);
  const prize = { 5: ['🐚', 'shell', '🎉 彩蛋！刺破第 5 顆氣球，送你一個貝殼！'], 10: ['🐚', 'shell', '🎉 第 10 顆！再送一個貝殼，拿去跟島民交換吧'], 20: ['🍪', 'cookie', '🏆 第 20 顆！小鯉魚送你一塊餅乾 🍪'], 50: ['💌', 'postcard', '👑 第 50 顆！你是氣球大師，送你島主的明信片 💌'] }[n];
  if (prize) { S.bag[prize[1]] = (S.bag[prize[1]] || 0) + 1; saveBag(); toast(prize[2]); }
  else toast(`${POP_LINES[(n - 1) % POP_LINES.length]}（已刺破 ${n} 顆）`);
}
function startNet() {
  const M = C.multiplayer; if (!M || !M.enabled || !M.firebase || !PL) return;
  import('./net.js?v=20261118t').then(({ createNet }) => {
    NET = createNet(M.firebase, {
      myPos: () => PL.myPos(), upsert: (id, info, pos) => PL.upsert(id, info, pos), remove: (id) => PL.remove(id),
      onCount: (c) => { COUNT = c; const el = $('#onlineChip'); el.hidden = false; $('#onlineCount').textContent = c.players; el.setAttribute('aria-label', `市集島上 ${c.players} 人，開著網站 ${c.viewers} 人，點一下看各身分人數`); },
      onStatus: (s, msg) => { $('#onlineChip').classList.toggle('off', s !== 'online'); if (s === 'error') console.warn('連線錯誤', msg); },
    });
    NET.setMe(meProfile());
    import('./hidemp.js?v=20261118t').then(({ createHideMP }) => {
      HM = createHideMP(NET, {
        toast, profile: meProfile, enterWalk: () => { if (!S.walking) enterWalk(); },
        walkPos: () => (S.walking ? CAM.walk.pos : null), posOf: (id) => PL.posOf(id),
        badge: (id, txt) => PL.setBadge(id, txt), hideTag: (id, on) => PL.hideTag(id, on),
        reward: (k, n) => { S.bag[k] = (S.bag[k] || 0) + n; saveBag(); },
        freeze: (on) => { if (CAM) CAM.walk.frozen = on; $('#blindfold').hidden = !on; },
        hud: (lines) => { const el = $('#mpUI'); if (!lines) { el.hidden = true; return; } el.hidden = false; el.querySelector('.ht').textContent = lines[0]; el.querySelector('.hm').textContent = lines[1]; },
        onLobby: () => { if ($('#hideDlg').open) renderHideMenu(); },
      });
    }).catch((e) => console.warn('多人躲貓貓載入失敗', e));
  }).catch((e) => console.warn('多人連線載入失敗', e));
}
$('#onlineChip').addEventListener('click', () => {
  if (!COUNT) return;
  const r = COUNT.byRole;
  toast(`島上 ${COUNT.players} 人（學生 ${r.student}、家長 ${r.parent}、老師 ${r.teacher}、訪客 ${r.visitor}）・開著網站 ${COUNT.viewers} 人`);
});
document.querySelectorAll('.dpad button').forEach((b) => {
  const on = (v) => (e) => { e.preventDefault(); CAM.walk.pad[b.dataset.d] = v; };
  b.addEventListener('pointerdown', on(true)); b.addEventListener('pointerup', on(false)); b.addEventListener('pointerleave', on(false)); b.addEventListener('pointercancel', on(false));
});
addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea')) return;
  if (S.walking && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { CAM.walk.keys[e.code] = true; e.preventDefault(); }
  if (S.walking && (e.key === 'Shift')) CAM.walk.crouch = true;                                   // 按住 Shift 蹲下
  if (S.walking && e.code === 'Space' && !(e.target.matches && e.target.matches('button,select,summary,a'))) { e.preventDefault(); doJump(); }   // 空白鍵跳躍
});
addEventListener('keyup', (e) => { if (CAM) { CAM.walk.keys[e.code] = false; if (e.key === 'Shift') CAM.walk.crouch = false; } });
addEventListener('blur', () => { if (CAM) CAM.walk.crouch = false; });
function doJump() { const w = CAM.walk; if (w.frozen || w.jumpY > 0 || w.vy) return; w.crouch = false; w.vy = 4.6; }
// 手機：漫遊畫面的「跳」「蹲」按鈕（蹲是按住才蹲）
$('#actJump').addEventListener('pointerdown', (e) => { e.preventDefault(); if (S.walking) doJump(); });
const crouchBtn = $('#actCrouch');
crouchBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (S.walking) { CAM.walk.crouch = true; crouchBtn.classList.add('on'); } });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) crouchBtn.addEventListener(ev, () => { if (CAM) CAM.walk.crouch = false; crouchBtn.classList.remove('on'); });

// ------------------------------------------------------------------ 開場運鏡
function playIntro(force) {
  if (!W) return;
  if (S.reduced || (!force && store.get('introSeen', false)) || Q.has('nointro')) { CAM.setHome(true); return Promise.resolve(); }
  return new Promise((res) => {
    S.intro = true; const ov = $('#intro'); ov.hidden = false; $('.intro-title').classList.remove('show');
    L.setDeck(1); $('#labels').classList.add('off');
    const skip = () => CAM.finishIntro();
    ov.onclick = skip; S.introSkip = skip;
    CAM.intro(() => {
      S.intro = false; ov.hidden = true; L.setDeck(0); $('#labels').classList.remove('off'); store.set('introSeen', true); S.introSkip = null; res();
    });
  });
}

// ------------------------------------------------------------------ 全域按鍵
addEventListener('keydown', (e) => {
  if (S.intro) { e.preventDefault(); S.introSkip && S.introSkip(); return; }    // 任何按鍵都能跳過開場
  if (e.key !== 'Escape') return;
  if (document.querySelector('dialog[open]')) return;                          // 對話框自己處理 Esc
  if (S.bubble) { closeBubble(); return; }
  if (S.walking && S.open) { closePanel(false); return; }        // 漫遊中先關攤位介紹，再按一次才回鳥瞰
  if (S.walking) { exitWalk(); return; }
  if (S.tour) { endTour(true); return; }
  if (!$('#settings').hidden) { toggleSettings(false); $('#setBtn').focus(); return; }
  if (S.open) closePanel(true);
});
$('#homeBtn').addEventListener('click', () => { closeBubble(); closePanel(false); if (S.tour) endTour(false); if (S.walking) exitWalk(); else CAM && CAM.home(); });

// ------------------------------------------------------------------ 畫質
function setQuality(q, auto) {
  S.quality = q; S.qualityAuto = !!auto; store.set('quality', q); syncSettings();
  if (!W) return;
  W.renderer.shadowMap.enabled = q !== 'low';
  W.scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); } });
  for (const a of L.agents) a.lowHidden = q === 'low' && a.nightHide;
  W.renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 1 : (isMobile() ? 1.5 : 2)));
  toast(auto ? '畫面有點卡，已自動切換成低畫質' : q === 'low' ? '已切換成低畫質（關閉陰影、減少人物）' : '已切換成高畫質');
}

// ------------------------------------------------------------------ 文字清單版（沒有 WebGL）
function textOnly(reason) {
  document.documentElement.classList.add('nogl'); document.body.classList.add('nogl');
  const m = document.createElement('main'); m.className = 'fallback'; m.style.cssText = 'position:relative;z-index:16;max-width:860px;margin:0 auto;padding:96px 16px 120px';
  const ids = ['center', ...C.islands.map((i) => i.id)];
  m.innerHTML = `<p class="fallback-msg">${esc(reason)}，已改用文字清單版，所有島嶼與攤位內容都在下面。</p>` + ids.map(cardHTML).join('') +
    `<p class="foot">作者：${esc(C.site.author)}｜${esc(C.site.layoutNote)}｜${esc(C.residentsNote)}</p>`;
  document.body.append(m);
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) { panelOpener = b; showPanel(b.dataset.open, b.dataset.no != null ? +b.dataset.no : undefined); } });
  const dst = Q.get('stall') && stallByNo(Q.get('stall')); if (dst) showPanel(dst.island, dst.no);
}
function webglOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

// ------------------------------------------------------------------ 啟動
async function boot() {
  $('#brandMascot').innerHTML = MASCOT;
  C = await fetch('data/content.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  TOUR = ['center', ...C.islands.map((i) => i.id)]; PP.data = ppRead();   // 讀護照時順便完成名冊改版轉換
  buildSettings(); renderHud();
  if (route().errs.length) { console.warn('路線設定錯誤', route().errs); setTimeout(() => toast(`⚠ 路線設定錯誤 ${route().errs.length} 項：${route().errs[0]}（詳見護照頁）`), 1200); }
  S.autoStart = performance.now();
  S.hour = S.hourShown = targetHour(performance.now());
  renderMe(); renderPlanChip(); renderNotice();
  if (Q.has('nogl') || !webglOK()) { textOnly(Q.has('nogl') ? '已切換為文字清單版' : '這台裝置無法顯示 3D 畫面'); applyTheme(); updateClock(); setInterval(updateClock, 10000); window.__ready = true; return; }
  let mods;
  try {
    mods = await Promise.all([import('./world.js?v=20261118t'), import('./life.js?v=20261118t'), import('./cam.js?v=20261118t'), import('./players.js?v=20261118t'), import('./signs.js?v=20261118t'), import('./festival.js?v=20261118t'), import('./fauna.js?v=20261118t'), import('./interact.js?v=20261118t'), import('./games.js?v=20261118t')]);
    const [{ createWorld, H: GROUND_H }, { createLife, makePerson }, { createCam }, { createPlayers }, { createSigns }, { createFestival }, { createFauna }, { createInteract }, { createGames, FISH }] = mods;
    const mobile = isMobile();
    W = createWorld($('#gl'), { quality: S.quality, mobile });
    W.renderer.setPixelRatio(Math.min(devicePixelRatio, S.quality === 'low' ? 1 : (mobile ? 1.5 : 2)));
    L = createLife(W, C, { halfPeople: mobile || S.quality === 'low', quality: S.quality });
    CAM = createCam(W, $('#gl'), { onZoom: showZoom, onIntro: (k) => { L.setDeck(k < .3 ? 1 : Math.max(0, 1 - (k - .3) / .25)); if (k > .55) $('.intro-title').classList.add('show'); } });
    CAM.S.reduced = S.reduced; CAM.S.mobile = mobile;
    PL = createPlayers(W, GROUND_H); renderMe(); startNet();
    W.canBoard = canBoardWalk;
    // 搭船中：只有靠港、跳板放下時才能走出船艙
    W.canLeave = () => { const s = L.carp.status(); if (s.docked && s.gang) return true; if (performance.now() - lastBlockToast > 3000) { lastBlockToast = performance.now(); toast('⛔ 航行中請待在船上，靠港放下跳板後再下船'); } return false; };
    KIT = await import('./kit.js?v=20261118t');
    SG = createSigns(W, C, GROUND_H, { makePerson, rng: (await import('./kit.js?v=20261118t')).rng, low: mobile || S.quality === 'low' });
    FX = createFestival(W, C, GROUND_H, { makePerson, rng: (await import('./kit.js?v=20261118t')).rng, low: mobile || S.quality === 'low', avoid: [...SG.signs.map((s) => s.g.position), ...Object.values(W.islands).flatMap((I) => (I.trees || []).filter((tr) => tr.visible).map((tr) => tr.position.clone().add(I.pos)))], carp: L.carp });
    FA = createFauna(W, { H: GROUND_H, rng: (await import('./kit.js?v=20261118t')).rng });
    IA = createInteract(W, C, GROUND_H, {
      toast, carp: L.carp,
      toastIf: (m) => { if (!S.intro) toast(m); },
      toastNear: (I, m) => { if (W.camera.position.distanceTo(I.pos) < 22) toast(m); },
      openStalls: (id) => openIsland(id),
      openStall: (no) => { const st = stallByNo(no); if (st) { if (S.walking) exitWalk(true); openIsland(st.island, { no }); } },
      stallPos: (no) => SG.signs.find((s) => s.st.no === no),
      photoSpot, freeSpot: (id) => FX.freeSpot(id, .7, 1.0),
    });
    FISHES = FISH;
    GM = createGames(W, C, GROUND_H, {
      toast, store, enterWalk: (at) => enterWalk(at || startSpot()), isWalking: () => S.walking,
      walkPos: () => (S.walking ? CAM.walk.pos : null),
      freeSpot: (id) => FX.freeSpot(id, .6, .9),
      booths: () => SG.signs.map((s) => s.g),
      nearBooth: (x, z, d) => SG.signs.some((s) => Math.hypot(s.g.position.x - x, s.g.position.z - z) < d),
      makePerson: (seed, shirt) => { const P = makePerson(KIT.rng(9000 + seed), false, { shirt }); P.g.remove(P.hit); return P; },
      reward: (k, n) => { S.bag[k] = (S.bag[k] || 0) + n; saveBag(); },
      openFishLog, openRules, openHideMenu,
    });
  } catch (err) { console.warn(err); textOnly('3D 畫面載入失敗'); window.__ready = true; return; }
  if (S.quality === 'low') setQuality('low');
  buildTags();
  const resize = () => { W.resize(innerWidth, innerHeight); CAM.S.mobile = isMobile(); CAM.limits(); if (!S.open && !S.tour && !S.walking && !CAM.S.busy) CAM.setHome(true); };
  addEventListener('resize', resize); resize();
  W.setHour(S.hourShown); applyTheme(); updateClock(); setInterval(updateClock, 10000);
  const cv = $('#gl');
  cv.addEventListener('pointerdown', onCanvasDown); cv.addEventListener('pointerup', onCanvasUp);
  cv.addEventListener('wheel', () => { if (S.tour && !S.tour.paused) pauseTour(true); }, { passive: true });
  // 在島名標籤上滾動滑鼠，也能縮放 3D 畫面
  $('#labels').addEventListener('wheel', (e) => { e.preventDefault(); cv.dispatchEvent(new WheelEvent('wheel', e)); }, { passive: false });
  CAM.controls.addEventListener('start', () => { if (S.tour && !S.tour.paused) pauseTour(true); });
  if (Q.has('h')) { S.timeMode = 'fixed'; FIXED_H.fixed = +Q.get('h'); S.hour = S.hourShown = +Q.get('h'); W.setHour(S.hourShown); applyTheme(); }

  // 動畫迴圈：分頁看不到時瀏覽器會自動暫停
  const clock = new THREE.Clock(); let clkN = 0, fpsT = 0, fpsN = 0, slow = 0; const keepQ = Q.has('keepq');
  function frame(now) {
    const dt = clock.getDelta(), t = clock.elapsedTime, moving = !S.reduced;
    // 時段：平滑過渡（減少動態時直接切換）
    const target = targetHour(now);
    let d = target - S.hourShown; if (d > 12) d -= 24; if (d < -12) d += 24;
    S.hourShown = S.reduced || Math.abs(d) < .01 ? target : (S.hourShown + d * Math.min(1, dt * 1.6) + 24) % 24;
    W.setHour(S.hourShown); applyTheme();
    if ((clkN = (clkN + 1) % 30) === 0) updateClock();
    CAM.update(dt);
    W.update(t, moving);
    L.update(t, dt, moving, W.state.n, W.camera);
    for (const a of L.agents) if (a.lowHidden) a.P.g.visible = false;
    stepTour(now);
    PL.update(dt, t, CAM.walk, S.walking, !CAM.walk.third, innerWidth, innerHeight);
    if (NET) NET.tick(now);
    // 在船上、船靠港放下跳板時提醒可以下船（每次靠港提醒一次）
    if (S.walking && L.carp && W.onBoat(CAM.walk.pos.x, CAM.walk.pos.z)) { const cs = L.carp.status(); if (cs.gang && !S.disHint) { S.disHint = true; toast('⚓ 靠岸了！可下船，從船尾左側走上跳板'); } else if (!cs.docked) S.disHint = false; }
    SG.update(t, moving);
    FX.update(t, dt, moving, W.state.n);
    FA.update(t, dt, moving, W.state.n);
    IA.update(t, dt, moving, S.walking ? CAM.walk.pos : null);
    GM.update(t, dt, moving, S.walking ? CAM.walk.pos : null);
    // 跨橋迎賓：走在橋上時燈籠依序亮起，走到橋尾才顯示島名
    if (S.walking && FX.walkerAt) {
      const r = FX.walkerAt(CAM.walk.pos.x, CAM.walk.pos.z);
      if (r) { if (r.t > .86 && S.welcomed !== r.bl) { S.welcomed = r.bl; toast(`🏮 歡迎來到第 ${r.bl.order} 島・${r.bl.name}！`); } if (r.t < .1 && S.welcomed === r.bl) S.welcomed = null; }
    }
    W.renderer.render(W.scene, W.camera);
    if (!S.walking) placeTags();
    refreshBoatPanel(now);
    placeBubble();
    // 效能：FPS 連續偏低就自動降級
    fpsN++; fpsT += dt;
    if (fpsT > 3) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (!keepQ && S.quality !== 'low' && t > 8) { slow = fps < 24 ? slow + 1 : 0; if (slow >= 2) setQuality('low', true); } }
    if (!window.__ready && t > .2) window.__ready = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__isle = { W, L, CAM, S, THREE, get PL() { return PL; }, get NET() { return NET; }, get SG() { return SG; }, get FX() { return FX; }, get FA() { return FA; }, get IA() { return IA; }, get GM() { return GM; } };   // 給自動測試讀取狀態用
  await playIntro(false);
  const deep = Q.get('island') || location.hash.slice(1), lk = Q.get('stall') ? resolveStallLink(Q.get('stall'), Q.get('roster')) : null, dst = lk && lk.st;
  if (lk && lk.msg && dst) S.legacyNote = { no: dst.no, msg: lk.msg };   // 舊攤號連結：說明寫在攤位卡上（蓋章提示不會蓋掉它）
  else if (lk && lk.msg) toast(lk.msg);
  if (dst) openIsland(dst.island, { no: dst.no });
  else if (deep && islandById(deep)) openIsland(deep);
}
boot().catch((err) => { console.error(err); $('#toast').textContent = '網站資料載入失敗，請重新整理頁面。'; $('#toast').classList.add('show'); window.__ready = true; });
