// 115 鯉魚市集｜介面與流程
import * as THREE from 'three';
import { ROLES, OUTFITS, HATS } from './roles.js?v=20261124v';
import { createMeowBox } from './meow.js?v=20261124v';
import { REACTIONS, REACTION_IDS, playReaction } from './cats.js?v=20261124v';
import { createCatNet, SEATS, REST, CALL, pad } from './catnet.js?v=20261124v';
import { createWallet } from './wallet.js?v=20261124v';
import { createJobs } from './jobs.js?v=20261124v';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'isleforge.my-island.';
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* 私密模式等情況：只是不記住 */ } },
};
const Q = new URLSearchParams(location.search);
const isMobile = () => matchMedia('(max-width: 760px)').matches;
// 效能用的判斷：手機和平板（iPad 螢幕比 760px 寬，但顯示晶片和記憶體跟手機同一級，不能用電腦規格跑）
const isLite = () => isMobile() || matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
const pad2 = (n) => String(n).padStart(2, '0');
const fmtH = (h) => { h = ((h % 24) + 24) % 24; return `${pad2(Math.floor(h))}:${pad2(Math.floor((h % 1) * 60))}`; };

// 介面 Logo：低多邊形鯉魚（橘紅魚背、米白魚腹、魚頭朝右），首頁、怎麼逛、集章完成共用這一張
const LOGO_SRC = 'assets/brand/koi-logo.png?v=20261124v';
const MASCOT = `<img src="${LOGO_SRC}" alt="115 鯉魚市集 Logo：低多邊形小鯉魚" decoding="async">`;

let C = null;            // content.json
let GH = 1.75;   // 島頂草地高度（開機後換成 world.js 的 H）
let W = null, L = null, CAM = null, BAL = null, DUCK = null, BK = null, SHOP = null, STY = null, MY = null, PH = null, PHM = null, COA = null, K = null;   // COA：雲霄飛車   // PH：遊戲電話   // MY：市長任務（路燈）   // SHOP：服飾店；STY：配件、寵物、舞步   // BK：借車點與自行車道   // K：島上的貓
let WAL = null, JOBS = null;   // 線上鯉魚幣錢包、打工
const SND = createMeowBox();
const CR = createCatNet({
  onChange(why) {
    if (K) for (const c of K.cats) c.held = CR.busy(c.data.id);
    const cn = () => (catData(CR.myCat) || {}).name || '貓';
    if (why === 'called') { SND.unlock(); SND.chime(); toast(`🔔 叫號 ${pad(CR.myTicket)}！輪到你擼${cn()}了，請在 ${CALL} 秒內按「✋ 報到」`); $('#ticketChip').classList.remove('ring'); void $('#ticketChip').offsetWidth; $('#ticketChip').classList.add('ring'); }
    if (why === 'missed') { const r = WAL ? WAL.refund(C.economy.refund.catMissed, '擼貓過號退一半') : 0; toast(`😢 過號了！沒有在時間內報到${r ? `，退你 ${r} 枚` : ''}，可以再抽一張號碼牌。`); setCatSay('過號了……沒關係，再抽一張號碼牌就好。'); }
    if (why === 'giveup-wait' && WAL) { const r = WAL.refund(C.economy.refund.catGiveupWait, '還沒叫號就放棄，全額退回'); if (r) toast(`↩️ 還沒輪到就放棄，${r} 枚退給你`); }
    if (why === 'turn') { toast('⏰ 時間到，換下一號擼貓囉！謝謝你的溫柔～想再擼可以再抽號。'); setCatSay('時間到囉，換下一號！想再擼可以再抽一張號碼牌。'); }
    if (why === 'idle') { toast('💤 你好一陣子沒摸貓，位置讓給下一號了。'); setCatSay('你好一陣子沒摸，位置先讓給下一號囉。'); }
    renderTicketChip();
    if (S.bubble && S.bubble.o.cat) updateCatBubble();
  },
  onRemotePet(catId, r, who) {
    const c = K && K.byId(catId); if (!c) return;
    const watching = !!(S.bubble && S.bubble.o.cat === c);
    K.remote(c, r, watching ? SND : null);
    if (watching) setCatSay(r === 'leave' ? `${who}摸得太急，${c.data.name}跑去休息了……` : `${who}：${REACTIONS[r].text.replace('{n}', c.data.name)}`);
  },
});
const S = {
  theme: store.get('theme', 'auto'), timeMode: store.get('time', 'auto'), hour: 10, hourShown: 10, autoStart: 0,
  reduced: store.get('reduce', null), quality: store.get('quality', 'high'),
  stamps: store.get('stamps', []), petted: store.get('cats', []), muted: store.get('mute', false), bag: store.get('bag', null), open: null, bubble: null, tour: null, walking: false, intro: false,
};
if (S.reduced == null) S.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!S.bag) S.bag = { shell: 3 };
SND.setMuted(S.muted);

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
// 彩虹熱氣球的文字：可以在 data/content.json 的 "balloon" 改，沒有就用這裡的預設
const BALLOON_DEF = {
  name: '彩虹熱氣球', role: '空中遊覽', color: '#b4367a',
  intro: '一顆彩虹條紋的熱氣球，停在服務台北側的起降場。燈號亮綠燈時走進籃子，時間到就升空，繞五座主題島飛一圈，再降落回起降場。',
  how: ['按「搭熱氣球」會站進籃子裡，跟著熱氣球一起升空；可以用方向鍵或滑鼠轉頭看風景。', '起降場燈號：綠燈可以上下、黃燈快起飛了、紅燈在天上。', '降落後從籃子前面的門走出來就下來了；飛行中不能出籃子。', '籃子最多 4 位登入者一起搭，大家看到的是同一顆熱氣球。'],
  note: '熱氣球只在網站裡，市集現場沒有熱氣球。',
};
const balloonDef = () => Object.assign({}, BALLOON_DEF, C.balloon || {});
// 🦆 鴨子船的文字：可以在 data/content.json 的 "duckBoat" 改
const DUCK_DEF = {
  name: '鴨子船', role: '腳踏遊船', color: '#b07a00',
  intro: '原本浮在海上的大黃色小鴨，變成可以坐的腳踏船！停在手作體驗二島南側的木棧道旁，燈號亮綠燈時從棧道走進船艙，時間到就出發，大家一起踩踏板，在手作體驗二島南邊的海灣繞一圈再倒退回棧道。',
  how: ['按「坐鴨子船」會走進船艙；停下來就會坐到椅子上，腳開始踩踏板，兩側的水車跟著轉。', '棧道燈號：綠燈可以上下船、黃燈快出發了、紅燈在海上。', '回到棧道停好後，從船艙靠棧道那一側的門口走回棧道就下船了；開船時不能下船。', '船上最多 4 位登入者（前後兩排），大家看到的是同一艘鴨子船。'],
  note: '鴨子船只在網站裡，市集現場沒有鴨子船。',
};
const duckDef = () => Object.assign({}, DUCK_DEF, C.duckBoat || {});
// 🎢 雲霄飛車的文字：可以在 data/content.json 的 "coaster" 改
const COASTER_DEF = {
  name: '鯉魚雲霄飛車', role: '刺激遊樂設施', color: '#c23a1c',
  intro: '軌道繞一大圈，從五座主題島的上空飛過去！車站在趣味遊戲島外側的海上平台，第一節車廂是鯉魚頭。出站後喀啦喀啦爬上坡頂，一口氣俯衝下來（軌道旁的照相機會拍下你的俯衝照），翻過 360 度大迴圈，經過循環挖寶島、手作體驗二島、美食補給島，再從大鯉魚張開的嘴巴鑽進牠的肚子、從尾巴鑽出來，經過手作體驗一島回到車站。',
  how: ['停站亮綠燈時按「🎢 坐雲霄飛車」，會坐進車廂裡；可以拖曳畫面轉頭看風景。', '開車後不能下車；回到車站停好會自動下車，站在車站平台上。', '往下衝的時候大家會把手舉高！大迴圈會倒過來，怕暈的話可以按「切換視角」從車外看。', '衝下坡時會自動拍「📸 俯衝照」，回到車站後可以按「💾 存下來」。', '一班車最多 8 位登入者（4 節車廂 × 2 人），大家看到的是同一班車。'],
  note: '雲霄飛車只在網站裡，市集現場沒有雲霄飛車。',
};
const coasterDef = () => Object.assign({}, COASTER_DEF, C.coaster || {});
function islandById(id) { return id === 'center' ? C.center : id === 'carp' ? C.carpBoat : id === 'balloon' ? balloonDef() : id === 'duck' ? duckDef() : id === 'coaster' ? coasterDef() : C.islands.find((i) => i.id === id); }
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
function colorOf(id) { return id === 'center' ? '#3f7d3a' : id === 'carp' ? C.carpBoat.color : id === 'balloon' ? balloonDef().color : id === 'duck' ? duckDef().color : id === 'coaster' ? coasterDef().color : islandById(id).dark; }   // 介面用加深色，白字對比 ≥ 4.5
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
  $('#muteBtn').addEventListener('click', () => setMuted(!S.muted));
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
  $('#muteBtn').setAttribute('aria-pressed', String(S.muted));
  $('#qualityBtn').textContent = `🖥️ 目前畫質：${S.quality === 'low' ? '低' : '高'}${S.qualityAuto ? '（自動調整）' : ''}・點一下切換`;
}
function setMuted(v) { S.muted = v; store.set('mute', v); SND.setMuted(v); syncSettings(); if (S.bubble && S.bubble.o.cat) updateCatBubble(); toast(v ? '🔇 貓咪聲音已關閉' : '🔊 貓咪聲音已打開'); if (!v) { SND.unlock(); SND.meow(1, { len: .4 }); } }
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
  if (S.stamps.length === 6 && WAL) { const g = WAL.bonusOnce('stamps', C.economy.bonus.stamps, '集滿六枚章'); if (g) setTimeout(() => toast(`🎁 集章獎勵 ${g} 枚${coinName()}！`), 2200); }
  if (S.stamps.length === 6 && !store.get('doneShown', false)) { store.set('doneShown', true); setTimeout(showDone, 900); }
}
function showDone() {
  $('#doneTitle').textContent = '🎉 集章完成！';
  $('#doneBody').innerHTML = `<div style="display:flex;gap:14px;align-items:center"><span class="mascot" style="width:84px;height:84px">${MASCOT}</span><p style="margin:0;line-height:1.7;font-weight:700">太厲害了！你已走訪服務台和五座主題島，集滿六枚章！<br>小鯉魚幫你把護照收好了，記得也到現場逛逛喔！</p></div><p class="foot">集章紀錄只存在這台裝置的瀏覽器裡。</p><button type="button" class="btn" data-close>好耶！</button>`;
  openDlg('#doneDlg');
}
function renderHud() {
  const n = Object.values(S.bag).reduce((a, b) => a + b, 0);
  $('#bagCount').textContent = n; $('#stampCount').textContent = `${S.stamps.length}/6`; $('#catCount').textContent = `${S.petted.length}/${(C.cats || []).length}`;
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
$('#catBtn').addEventListener('click', openCats);

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
  if (WAL && st.game.stamp !== false) {                  // 線上小遊戲每局付錢（創作小工具免費）
    const E = C.economy, key = 'game:' + st.no, why = WAL.canPay(E.prices.game, key, E.limits.game);
    if (why) { toast('🪙 ' + why); return; }
    WAL.pay(E.prices.game, 'game', `玩第 ${pad2(st.no)} 攤線上遊戲`, key); toast(`🪙 付 ${E.prices.game} 枚，剩 ${WAL.bal()} 枚`);
  }
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
  if (open && JOBS) JOBS.onStall(no);   // 打工：送貨員
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
      ${catSecHTML('center')}
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
    ${catSecHTML(id)}
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
  closePhotoBar();
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
  closePhotoBar();
  if (id === 'carp') { openBoat(opts); return; }
  if (id === 'balloon') { openBalloon(opts); return; }
  if (id === 'duck') { openDuck(opts); return; }
  if (id === 'coaster') { openCoaster(opts); return; }
  closeBubble(); toggleSettings(false);
  if (S.walking && !exitWalk(true)) return;
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
// 五島合照點：遠景／中景／近景三種角度，都拍得到幾何鯉魚風車與通往手作體驗二島的木橋
//   遠景：高一點、退遠一點，五座島和鯉魚號航道一起入鏡
//   中景：原本的角度，風車＋木橋＋湖面
//   近景：站在合照腳印旁，人物在前、風車在後
const PHOTO_VIEWS = { far: '🏞️ 遠景', mid: '🌳 中景', near: '🧍 近景' };
let photoView = null;
function photoFrame(view) {
  const wm = W.islands.center.extras.windmill, br = W.bridges.find((b) => b.to === 'puzzle') || W.bridges[0];
  const T = new THREE.Vector3((wm.x + br.p1.x) / 2, 3.2, (wm.z + br.p1.z) / 2);
  const side = new THREE.Vector3(-(br.p1.z - wm.z), 0, br.p1.x - wm.x).normalize();
  if (side.dot(T) < 0) side.negate();                        // 從島外往內拍，背景是湖和鯉魚號航道
  if (view === 'far') {
    const t = T.clone().lerp(new THREE.Vector3(0, 1.5, 0), .5).setY(1.5);
    return { t, p: t.clone().addScaledVector(side, 30).setY(19) };
  }
  if (view === 'near') {
    const foot = IA && IA.photoPos ? IA.photoPos() : null;
    const wmV = new THREE.Vector3(wm.x, foot ? foot.y : GH, wm.z);
    const at = foot || wmV.clone().addScaledVector(side, 4);
    const back = at.clone().sub(wmV).setY(0); if (back.lengthSq() < .01) back.copy(side); back.normalize();   // 從腳印往風車的反方向退，讓風車當背景
    const t = at.clone().lerp(wmV, .35); t.y = at.y + 1.6;
    return { t, p: at.clone().addScaledVector(back, 5.5).setY(at.y + 2.4) };
  }
  return { t: T, p: T.clone().addScaledVector(side, 15).setY(8.5) };
}
function renderPhotoBar() {
  const bar = $('#photoBar'); if (!bar) return;
  bar.hidden = !photoView;
  bar.querySelectorAll('[data-view]').forEach((b) => { const on = b.dataset.view === photoView; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function closePhotoBar() { if (!photoView) return; photoView = null; renderPhotoBar(); }
function photoSpot(view = 'mid') {
  if (coasterLocked()) return;
  if (S.walking && !exitWalk(true)) return;
  closePanel(false);
  const first = !photoView;
  photoView = PHOTO_VIEWS[view] ? view : 'mid'; renderPhotoBar();
  const f = photoFrame(photoView);
  CAM.flight(f, first ? 1800 : 1100, 2, () => {
    if (first) toast('📸 合照角度到了！下方可以切換「遠景／中景／近景」，按「📤 分享卡片」存一張市集合照');
    else toast(`📸 ${PHOTO_VIEWS[photoView]}`);
  });
}
function bindPhotoBar() {
  const bar = $('#photoBar'); if (!bar) return;
  bar.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => photoSpot(b.dataset.view); });
  bar.querySelector('[data-photo-share]').onclick = () => openShare();
  bar.querySelector('[data-photo-close]').onclick = () => closePhotoBar();
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
  if (S.walking && !exitWalk(true)) return;
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
  return rideCheck('boat');
}
let lastBlockToast = 0;
function canBoardWalk() {
  const why = boardCheck(); if (!why) return true;
  if (performance.now() - lastBlockToast > 3000) { lastBlockToast = performance.now(); toast('⛔ ' + why); }
  return false;
}
function boardBoat() {
  if (coasterLocked()) return;
  if (!W || !L) return;
  const why = boardCheck();
  if (why) { toast('⛔ ' + why); return; }
  const bs = L.carp.boardSpot(); bs.yaw += Math.PI * .62;   // 一上船先朝向船的右舷（湖景那一側），不是看乘客的背影和桅杆
  enterWalk(bs); CAM.walk.pitch = -.32; S.disHint = false;
  const s = L.carp.status();
  toast(s.docked ? '⛵ 登上鯉魚號！待會兒就出航，想下船就從船尾左側走上跳板' : '⛵ 登上鯉魚號！船靠港放下跳板後，就能走上碼頭');
}

// ------------------------------------------------------------------ 彩虹熱氣球：和鯉魚號一樣可以點選、鏡頭跟著、搭乘漫遊
function balloonStatus() {
  const s = BAL.status();
  if (s.docked) return { short: s.left <= 6 ? '快起飛了' : '停靠中・可搭乘', long: `🟢 停在服務台北側的起降場，現在可以走進籃子。約 ${s.left} 秒後起飛。`, s };
  return { short: s.phase === 'down' ? '降落中' : '飛行中', long: s.phase === 'up' ? `🎈 正在升空，約 ${s.eta} 秒後回到起降場。` : s.phase === 'down' ? `🎈 正在降落，約 ${s.eta} 秒後可以上下。` : `🎈 繞五島飛行中，約 ${s.eta} 秒後降落回起降場。`, s };
}
const balloonRiders = () => (PL ? PL.inBalloonCount() : 0) + (S.walking && BAL && BAL.inBasket(CAM.walk.pos) ? 1 : 0);
const balloonPax = () => `籃子裡 ${balloonRiders()}／${BAL.cap} 位登入者（停靠、亮綠燈或黃燈時才能進出籃子）`;
function balloonPanelHTML() {
  const B = balloonDef(), c = B.color, st = balloonStatus();
  return `<div class="p-hd" style="--pc:${c};--ptint:#fbe4f0;--pink:#5e1640"><p class="eyebrow">🎈 ${esc(B.role)}</p><h2 id="panelTitle">${esc(B.name)}</h2><button type="button" class="x" data-panel-close aria-label="關閉">✕</button></div>
    <div class="p-sec" style="--pc:${c}"><h3>現在在哪裡</h3><p class="boat-stat" id="balStat" aria-live="polite">${esc(st.long)}</p><p class="foot" id="balPax">${esc(balloonPax())}</p>
      <div class="chal-btns"><button type="button" class="btn" data-bal="board">🎈 搭熱氣球（漫遊）</button><button type="button" class="btn ghost" data-bal="pad">📍 前往起降場</button></div></div>
    <div class="p-sec" style="--pc:${c}"><h3>介紹</h3><p class="intro-line">${esc(B.intro)}</p></div>
    <div class="p-sec"><h3>怎麼玩</h3><ul class="boat-how">${B.how.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="foot" style="margin-top:8px">${esc(B.note)}</p></div>`;
}
let balT = 0;
function refreshBalloonPanel(now) {
  if (S.open !== 'balloon' || now - balT < 500) return; balT = now;
  const st = balloonStatus(), a = $('#balStat'), b = $('#balPax');
  if (a && a.textContent !== st.long) a.textContent = st.long;
  if (b) b.textContent = balloonPax();
}
function showBalloonPanel() {
  const p = $('#panel'); p.innerHTML = balloonPanelHTML(); p.hidden = false; S.open = 'balloon';
  p.querySelector('[data-panel-close]').onclick = () => closePanel(true);
  p.querySelector('[data-bal="board"]').onclick = boardBalloon;
  p.querySelector('[data-bal="pad"]').onclick = goPad;
  for (const k in tags) tags[k].setAttribute('aria-expanded', String(k === 'balloon'));
  p.focus({ preventScroll: true });
}
function openBalloon(opts = {}) {
  if (!W || !BAL) { toast('熱氣球只在 3D 畫面裡出現'); return; }
  closeBubble(); toggleSettings(false);
  if (S.walking && !exitWalk(true)) return;
  if (S.tour) endTour(false);
  panelOpener = opts.opener || tags.balloon || null;
  $('#panel').hidden = true;
  CAM.flyToBalloon(BAL.anchor, showBalloonPanel);
}
function goPad() {
  closePanel(false);
  const T = BAL.pad.clone().setY(BAL.pad.y + 1.5), cam = T.clone().add(new THREE.Vector3(5, 7, 10));
  CAM.flight({ t: T, p: cam }, 1600, 2, () => toast('📍 這裡是彩虹熱氣球的起降場，在服務台北側；亮綠燈時走進籃子就能搭'));
}
function balloonCheck() {
  const s = BAL.status();
  if (!s.docked) return `熱氣球在天上，約 ${s.eta} 秒後降落回起降場，亮綠燈才能搭`;
  if (!BAL.doorOpen()) return '門關上了，熱氣球要起飛囉，請等下一趟';
  if (balloonRiders() >= BAL.cap) return `籃子已經有 ${BAL.cap} 個人了，請等下一趟`;
  return rideCheck('balloon');
}
function blockToast(why) { if (performance.now() - lastBlockToast > 3000) { lastBlockToast = performance.now(); toast('⛔ ' + why); } }
// 漫遊時走進／走出籃子的規則：停靠時才能進出，飛行中不能走出籃子
function balloonGate(from, x, z) {
  if (!BAL) return true;
  const wasIn = BAL.inBasket(from), goIn = BAL.floorAt(x, z) != null, docked = BAL.docked(), open = BAL.doorOpen();
  if (!wasIn && goIn && docked) { const why = open ? balloonCheck() : '門關上了，熱氣球要起飛囉，請等下一趟'; if (why) { blockToast(why); return false; } }
  if (wasIn && !goIn && !open) { blockToast(docked ? '門關上了，熱氣球要起飛囉！' : '飛行中請待在籃子裡，降落開門後再走出來'); return false; }
  return true;
}
function boardBalloon() {
  if (coasterLocked()) return;
  if (!W || !BAL) return;
  if (S.bike) dismountBike();
  const why = balloonCheck();
  if (why) { toast('⛔ ' + why); return; }
  closePanel(false);
  const bs = BAL.boardSpot();
  enterWalk(bs); CAM.walk.pitch = -.18; S.balHint = 'dock';
  toast(`🎈 站進熱氣球的籃子了！約 ${BAL.status().left} 秒後起飛，想下來就從前面的門走出去`);
}
// 搭乘中的提醒：起飛、降落
function balloonHints() {
  if (!S.walking || !BAL || !BAL.inBasket(CAM.walk.pos)) { S.balHint = null; return; }
  const ph = BAL.status().phase;
  if (ph === S.balHint) return;
  if (ph === 'up') toast('🔥 起飛囉！熱氣球慢慢升空，轉頭看看五座島');
  else if (ph === 'down') toast('🎈 準備降落，抓好籃子邊緣');
  else if (ph === 'dock' && S.balHint && S.balHint !== 'dock') toast('🟢 降落了！可以從籃子前面的門走出來');
  S.balHint = ph;
}

// ------------------------------------------------------------------ 🦆 鴨子船：和鯉魚號一樣可以點選、鏡頭跟著、走上船搭乘；坐好會自己踩踏板
function duckStatus() {
  const s = DUCK.status();
  if (s.docked) return { short: s.left <= 6 ? '快出發了' : '停靠中・可上船', long: `🟢 停在手作體驗二島南側的棧道旁，現在可以從棧道走進船艙。約 ${s.left} 秒後出發。`, s };
  return { short: s.phase === 'back' ? '回棧道中' : '踩踏中', long: s.phase === 'out' ? `🦆 出發囉！約 ${s.eta} 秒後回到棧道。` : s.phase === 'back' || s.phase === 'turn' ? `🦆 準備靠岸，倒退回棧道中，約 ${s.eta} 秒後可以上下船。` : `🦆 大家一起踩踏板，在手作體驗二島南邊的海灣繞圈，約 ${s.eta} 秒後回到棧道。`, s };
}
const duckRiders = () => (PL ? PL.inDuckCount() : 0) + (S.walking && DUCK && DUCK.inBoat(CAM.walk.pos) ? 1 : 0);
const duckPax = () => `船上 ${duckRiders()}／${DUCK.cap} 位登入者（停靠、亮綠燈或黃燈時才能上下船）`;
function duckPanelHTML() {
  const B = duckDef(), c = B.color, st = duckStatus();
  return `<div class="p-hd" style="--pc:${c};--ptint:#fff4cc;--pink:#5a3d00"><p class="eyebrow">🦆 ${esc(B.role)}</p><h2 id="panelTitle">${esc(B.name)}</h2><button type="button" class="x" data-panel-close aria-label="關閉">✕</button></div>
    <div class="p-sec" style="--pc:${c}"><h3>現在在哪裡</h3><p class="boat-stat" id="duckStat" aria-live="polite">${esc(st.long)}</p><p class="foot" id="duckPax">${esc(duckPax())}</p>
      <div class="chal-btns"><button type="button" class="btn" data-duck="board">🦆 坐鴨子船（漫遊）</button><button type="button" class="btn ghost" data-duck="dock">📍 前往鴨子船碼頭</button></div></div>
    <div class="p-sec" style="--pc:${c}"><h3>介紹</h3><p class="intro-line">${esc(B.intro)}</p></div>
    <div class="p-sec"><h3>怎麼玩</h3><ol class="boat-how">${B.how.map((t) => `<li>${esc(t)}</li>`).join('')}</ol><p class="foot" style="margin-top:8px">${WAL ? `🪙 一趟 ${ECO().prices.duck} 枚，每天最多 ${ECO().limits.duck} 趟。` : ''}${esc(B.note)}</p></div>`;
}
let duckT = 0;
function refreshDuckPanel(now) {
  if (S.open !== 'duck' || now - duckT < 500) return; duckT = now;
  const st = duckStatus(), a = $('#duckStat'), b = $('#duckPax');
  if (a && a.textContent !== st.long) a.textContent = st.long;
  if (b) b.textContent = duckPax();
}
function showDuckPanel() {
  const p = $('#panel'); p.innerHTML = duckPanelHTML(); p.hidden = false; S.open = 'duck';
  p.querySelector('[data-panel-close]').onclick = () => closePanel(true);
  p.querySelector('[data-duck="board"]').onclick = boardDuck;
  p.querySelector('[data-duck="dock"]').onclick = goDuckDock;
  for (const k in tags) tags[k].setAttribute('aria-expanded', String(k === 'duck'));
  p.focus({ preventScroll: true });
}
function openDuck(opts = {}) {
  if (!W || !DUCK) { toast('鴨子船只在 3D 畫面裡出現'); return; }
  closeBubble(); toggleSettings(false);
  if (S.walking && !exitWalk(true)) return;
  if (S.tour) endTour(false);
  panelOpener = opts.opener || tags.duck || null;
  $('#panel').hidden = true;
  CAM.flyToBoat(DUCK.anchor, showDuckPanel);   // 跟鯉魚號一樣：鏡頭飛過去、跟著船
}
function goDuckDock() {
  closePanel(false);
  const J = DUCK.jetty, T = J.j0.clone().lerp(J.j1, .6).setY(GH + .8);
  const cam = T.clone().addScaledVector(J.side, -9).addScaledVector(J.d, 5).setY(GH + 6.5);
  CAM.flight({ t: T, p: cam }, 1600, 2, () => toast('📍 這裡是鴨子船碼頭，在手作體驗二島南側；亮綠燈時從棧道走進船艙就能坐'));
}
function duckCheck() {
  const s = DUCK.status();
  if (!s.docked) return `鴨子船在海上，約 ${s.eta} 秒後回到棧道，亮綠燈才能上船`;
  if (!DUCK.doorOpen()) return '鴨子船要出發囉，請等下一趟';
  if (duckRiders() >= DUCK.cap) return `鴨子船已經坐滿 ${DUCK.cap} 個人了，請等下一趟`;
  return rideCheck('duck');
}
// 漫遊時走上／走下鴨子船：停靠時才能上下，開船時不能離開船艙
function duckGate(from, x, z) {
  if (!DUCK) return true;
  const wasIn = DUCK.inBoat(from), goIn = DUCK.floorAt(x, z) != null && DUCK.inBoat({ x, z, y: from.y }), open = DUCK.doorOpen();
  if (!wasIn && goIn) { const why = open ? duckCheck() : DUCK.docked() ? '鴨子船要出發囉，請等下一趟' : '鴨子船在海上，請等它回到棧道'; if (why) { blockToast(why); return false; } }
  if (wasIn && !goIn && !open) { blockToast(DUCK.docked() ? '鴨子船要出發囉！' : '開船中請待在船上，回到棧道停好後再下船'); return false; }
  return true;
}
function boardDuck() {
  if (coasterLocked()) return;
  if (!W || !DUCK) return;
  if (S.bike) dismountBike();
  const why = duckCheck();
  if (why) { toast('⛔ ' + why); return; }
  closePanel(false);
  enterWalk(DUCK.boardSpot()); CAM.walk.pitch = -.12; S.duckHint = 'dock';
  toast(`🦆 走進鴨子船了！約 ${DUCK.status().left} 秒後出發，站著不動就會坐下來踩踏板`);
}
// 搭乘中的提醒：出發、靠岸
function duckHints() {
  if (!S.walking || !DUCK || !DUCK.inBoat(CAM.walk.pos)) { S.duckHint = null; return; }
  const ph = DUCK.status().phase;
  if (ph === S.duckHint) return;
  if (ph === 'out') toast('🦶 出發囉！坐好一起踩踏板，鴨子船往海上前進');
  else if (ph === 'turn') toast('🦆 要回去了，鴨子船掉頭、倒退回棧道');
  else if (ph === 'dock' && S.duckHint && S.duckHint !== 'dock') toast('🟢 回到棧道了！可以從船艙靠棧道那一側的門口走回棧道');
  S.duckHint = ph;
}

// ------------------------------------------------------------------ 🎢 雲霄飛車：停站時坐進車廂，跟著列車跑一圈，回站自動下車
function coasterStatus() {
  const s = COA.status();
  if (s.docked) return { short: s.left <= 6 ? '快開車了' : '停站中・可搭乘', long: `🟢 停在趣味遊戲島外側的雲霄飛車站，現在可以上車。約 ${s.left} 秒後開車。`, s };
  return { short: s.phase === 'lift' ? '爬坡中' : s.phase === 'brake' ? '進站中' : '飛馳中', long: s.phase === 'lift' ? `🎢 喀啦喀啦爬坡中，約 ${s.eta} 秒後回到車站。` : s.phase === 'brake' ? `🎢 準備進站，約 ${s.eta} 秒後可以上下車。` : `🎢 繞五座島飛馳中，約 ${s.eta} 秒後回到車站。`, s };
}
const coasterRiders = () => { let n = S.coaster ? 1 : 0; if (PL) for (const id of ONLINE.keys()) if (W.coaster && W.coaster.riderSpot(PL.posOf(id), id)) n++; return n; };
const coasterPax = () => `車上 ${coasterRiders()}／${COA.cap} 位登入者（停站亮綠燈或黃燈時才能上車）`;
function coasterPanelHTML() {
  const B = coasterDef(), c = B.color, st = coasterStatus();
  return `<div class="p-hd" style="--pc:${c};--ptint:#fde6df;--pink:#5e1a0a"><p class="eyebrow">🎢 ${esc(B.role)}</p><h2 id="panelTitle">${esc(B.name)}</h2><button type="button" class="x" data-panel-close aria-label="關閉">✕</button></div>
    <div class="p-sec" style="--pc:${c}"><h3>現在在哪裡</h3><p class="boat-stat" id="coaStat" aria-live="polite">${esc(st.long)}</p><p class="foot" id="coaPax">${esc(coasterPax())}</p>
      <div class="chal-btns"><button type="button" class="btn" data-coa="board">🎢 坐雲霄飛車</button><button type="button" class="btn ghost" data-coa="station">📍 前往車站</button></div></div>
    <div class="p-sec" style="--pc:${c}"><h3>介紹</h3><p class="intro-line">${esc(B.intro)}</p></div>
    <div class="p-sec"><h3>怎麼玩</h3><ol class="boat-how">${B.how.map((t) => `<li>${esc(t)}</li>`).join('')}</ol><p class="foot" style="margin-top:8px">${WAL ? `🪙 一趟 ${ECO().prices.coaster} 枚，鯉魚幣夠就可以一直坐。` : ''}${esc(B.note)}</p></div>`;
}
let coaT = 0;
function refreshCoasterPanel(now) {
  if (S.open !== 'coaster' || now - coaT < 500) return; coaT = now;
  const st = coasterStatus(), a = $('#coaStat'), b = $('#coaPax');
  if (a && a.textContent !== st.long) a.textContent = st.long;
  if (b) b.textContent = coasterPax();
}
function showCoasterPanel() {
  const p = $('#panel'); p.innerHTML = coasterPanelHTML(); p.hidden = false; S.open = 'coaster';
  p.querySelector('[data-panel-close]').onclick = () => closePanel(true);
  p.querySelector('[data-coa="board"]').onclick = boardCoaster;
  p.querySelector('[data-coa="station"]').onclick = goCoasterStation;
  for (const k in tags) tags[k].setAttribute('aria-expanded', String(k === 'coaster'));
  p.focus({ preventScroll: true });
}
function openCoaster(opts = {}) {
  if (!W || !COA) { toast('雲霄飛車只在 3D 畫面裡出現'); return; }
  closeBubble(); toggleSettings(false);
  if (S.walking && !exitWalk(true)) return;
  if (S.tour) endTour(false);
  panelOpener = opts.opener || tags.coaster || null;
  $('#panel').hidden = true;
  CAM.flyToBoat(COA.anchor, showCoasterPanel);
}
function goCoasterStation() {
  closePanel(false);
  const st = COA.station, T = st.pos.clone().setY(GH + 1);
  CAM.flight({ t: T, p: T.clone().addScaledVector(st.u, 10).addScaledVector(st.t, -6).setY(GH + 7) }, 1600, 2, () => toast('📍 這裡是雲霄飛車站，在趣味遊戲島外側的海上平台'));
}
function coasterCheck() {
  const s = COA.status();
  if (!s.docked) return `雲霄飛車正在跑，約 ${s.eta} 秒後回到車站，亮綠燈才能上車`;
  if (!COA.boardOpen()) return '雲霄飛車要開車囉，請等下一班';
  if (coasterRiders() >= COA.cap) return `這班車已經坐滿 ${COA.cap} 個人了，請等下一班`;
  return WAL ? WAL.canPay(ECO().prices.coaster, 'coaster', 0) : '';   // 不限次數：鯉魚幣夠就能坐
}
function boardCoaster() {
  if (!W || !COA) return;
  if (S.coaster) { toast('🎢 你已經在車上了'); return; }
  const why = coasterCheck(); if (why) { toast('⛔ ' + why); return; }
  if (WAL) { const bad = WAL.pay(ECO().prices.coaster, 'coaster', '坐雲霄飛車', 'coaster'); if (bad) { toast('⛔ ' + bad); return; } }
  if (S.bike) dismountBike(true);
  closePanel(false);
  // 座位：先用自己的編號算座位，被別人坐了就往後找空位
  const taken = new Set(); for (const id of ONLINE.keys()) { const r = COA.riderSpot(PL.posOf(id), id); if (r) taken.add(r.seat); }
  const me = (NET && NET.uid()) || (meProfile() || {}).id || 'me';
  let seat = COA.hashSeat(me); for (let k = 0; k < COA.cap && taken.has(seat); k++) seat = (seat + 1) % COA.cap;
  const sp = COA.seatPose(seat), f = new THREE.Vector3(0, 0, 1).applyQuaternion(sp.q);
  const yaw0 = Math.atan2(f.x, f.z);
  if (!S.walking) enterWalk({ pos: sp.pos.clone(), yaw: yaw0 }); else { CAM.walk.pos.copy(sp.pos); CAM.walk.yaw = yaw0; }   // 先進漫遊再坐上車（enterWalk 會讓停站中的乘客先下車）
  S.coaster = { seat, yaw: yaw0, pitch: Math.asin(Math.max(-1, Math.min(1, f.y))), was: 'dock', paid: true };
  CAM.walk.frozen = true; CAM.walk.seatDrop = .26; CAM.walk.yaw = 0; CAM.walk.pitch = -.08; CAM.walk.ride = { q: sp.q, seat: sp.pos }; W.coasterRiding = true;   // yaw／pitch 改成「相對車頭」
  if (S.reduced) { CAM.walk.third = true; syncViewBtn(); }
  $('#coasterBtn').hidden = false;
  toast(`🎢 坐好了${WAL ? `（付 ${ECO().prices.coaster} 枚）` : ''}！約 ${COA.status().left} 秒後開車，抓好扶手～`);
}
function leaveCoaster(quiet) {
  if (!S.coaster) return;
  const photo = S.coaster.photo;
  S.coaster = null; W.coasterRiding = false;
  if (CAM) { CAM.walk.frozen = false; CAM.walk.seatDrop = 0; CAM.walk.ride = null; const e = COA.station.exit; CAM.walk.pos.set(e.x, GH, e.z); const s0 = COA.station; CAM.walk.yaw = Math.atan2(-s0.u.x, -s0.u.z); CAM.walk.pitch = -.05; }   // 下車後面向島
  $('#coasterBtn').hidden = true;
  if (!quiet) { toast('🎉 好刺激！回到車站了，從平台走回趣味遊戲島'); if (photo) showCoasterPhoto(photo); }
}
// 📸 俯衝照：從軌道旁的照相機拍一張（只拍畫面，不含網頁上的名牌），加上相框和文字
let photoCam = null;
function takeCoasterPhoto() {
  if (!S.coaster || !W) return;
  S.coaster.wantShot = false;
  const cv = W.renderer.domElement, aspect = cv.width / cv.height;
  if (!photoCam) photoCam = new THREE.PerspectiveCamera(44, aspect, W.camera.near, W.camera.far);   // 看得和主鏡頭一樣遠（天空才拍得到）
  photoCam.aspect = aspect; photoCam.updateProjectionMatrix();
  photoCam.position.copy(COA.photo.cam); photoCam.lookAt(COA.photo.target);
  try {
    W.renderer.render(W.scene, photoCam);
    const out = document.createElement('canvas'); out.width = 800; out.height = 640; const x = out.getContext('2d');
    const sw = Math.min(cv.width, cv.height * 4 / 3), sh = sw * 3 / 4;
    x.fillStyle = '#fff7ee'; x.fillRect(0, 0, 800, 640);
    x.drawImage(cv, (cv.width - sw) / 2, (cv.height - sh) / 2, sw, sh, 24, 24, 752, 520);   // 剛畫好的這一格
    x.fillStyle = '#c23a1c'; x.font = "900 34px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; x.textBaseline = 'middle';
    x.fillText('🎢 鯉魚雲霄飛車・俯衝照', 28, 584);
    x.fillStyle = '#5a4a3a'; x.font = "700 22px 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";
    const nm = (meProfile() && meProfile().name) || '我'; const d = new Date(NET ? NET.now() : Date.now());
    x.fillText(`115 鯉魚市集　${nm}　${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, 30, 620);
    S.coaster.photo = out.toDataURL('image/jpeg', .88);
    const fl = $('#camFlash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    toast('📸 喀擦！拍到俯衝照了，下車後可以存下來');
  } catch (e) { console.warn('俯衝照沒拍成', e); }
  W.renderer.render(W.scene, W.camera);   // 馬上畫回自己的畫面
}
function showCoasterPhoto(url) {
  $('#coaPhotoImg').src = url;
  const a = $('#coaPhotoSave'); a.href = url; a.download = `鯉魚雲霄飛車俯衝照-${Date.now().toString(36)}.jpg`;
  openDlg('#coaPhotoDlg');
}
// 雲霄飛車開車後鎖住：不能中途跳車、離開漫遊、切換到其他地方（導覽、合照、坐船、騎車、釣魚…）；停站時才可以
function coasterLocked() {
  if (!S.coaster || !COA || COA.docked()) return false;
  blockToast(`🎢 雲霄飛車還在跑，不能中途下車喔！約 ${COA.status().eta} 秒後回到車站`);
  return true;
}
$('#coasterBtn').addEventListener('click', () => {
  if (!S.coaster) return;
  if (!COA.docked()) { toast('🎢 開車中不能下車，回到車站就會自動下車'); return; }
  leaveCoaster(true); toast('🎢 下車了');
});
// 每一格：讓自己跟著座位走；頭跟著車廂轉（自己拖曳轉頭的角度保留）
function coasterTick() {
  if (!S.coaster || !COA || !S.walking) return;
  const st = COA.status(), sp = COA.seatPose(S.coaster.seat);
  CAM.walk.ride = { q: sp.q, seat: sp.pos };       // 鏡頭跟著車廂（迴圈會倒過來）
  CAM.walk.pos.copy(sp.pos);
  const car = Math.floor(S.coaster.seat / 2), myS = COA.frontS() - car * 1.75;
  if (!S.coaster.shot && COA.frontS() >= 0 && myS >= COA.photo.s) { S.coaster.shot = true; S.coaster.wantShot = true; }   // 📸 衝到照相機前面：這一格畫完就拍
  const cave = COA.inCave(car);
  if (cave && !S.coaster.cave) toast('🐟 被大鯉魚吞進肚子囉！');
  S.coaster.cave = cave;
  // 提醒：開車、爬坡、俯衝、進站
  if (st.phase !== S.coaster.was) {
    if (st.phase === 'lift') toast('⛓️ 喀啦喀啦…爬坡中，抓好扶手！');
    else if (st.phase === 'ride') toast('🎢 衝啊～～！手舉高！前面有大迴圈！');
    else if (st.phase === 'brake') toast('🎢 準備進站囉');
    else if (st.phase === 'dock' && S.coaster.was !== 'dock') { leaveCoaster(); return; }
    S.coaster.was = st.phase;
  }
}

// ------------------------------------------------------------------ 🚲 腳踏車：服務台旁的借車點借車，在漫遊裡騎；按「下車還車」或離開漫遊就自動還車
let BIKE_MOD = null;
const myPlayerId = () => (PL && PL.me() ? PL.me().id : null);
function bikeCheck() {
  if (!WAL) return '';
  const E = ECO(); return WAL.canPay(E.prices.bike, 'bike', E.limits.bike);
}
function rentBike() {
  if (coasterLocked()) return;
  if (!W || !BK) return;
  if (S.bike) { toast('🚲 你已經在騎車了，按「下車還車」就能還車'); return; }
  if (S.walking && !BK.near(CAM.walk.pos)) { toast('🚲 走到服務台旁的「借車點」再點車架借車'); return; }
  if (S.walking && (BAL && BAL.inBasket(CAM.walk.pos) || DUCK && DUCK.inBoat(CAM.walk.pos) || W.onBoat && W.onBoat(CAM.walk.pos.x, CAM.walk.pos.z))) return;
  const why = bikeCheck(); if (why) { toast('⛔ ' + why); return; }
  if (WAL) { const E = ECO(); const bad = WAL.pay(E.prices.bike, 'bike', '借腳踏車', 'bike'); if (bad) { toast('⛔ ' + bad); return; } }
  if (!S.walking) enterWalk(BK.startSpot());
  const colors = BK.colors, color = colors[Math.floor(Math.random() * colors.length)];
  mountBike(color);
  toast(`🚲 借到腳踏車了${WAL ? `（付 ${ECO().prices.bike} 枚）` : ''}！沿著藍色「自行車道」路牌騎，可以騎上五座橋；按「🚲 下車還車」就還車`);
}
function mountBike(color) {
  S.bike = color; CAM.walk.speedMul = BIKE_MOD ? BIKE_MOD.BIKE_SPEED : 2;
  const id = myPlayerId(); if (id) PL.setRide(id, color);
  if (NET && NET.setFx) NET.setFx({ ride: color });
  $('#bikeBtn').hidden = false;
}
function dismountBike(quiet) {
  if (!S.bike) return;
  S.bike = null; if (CAM) CAM.walk.speedMul = 1;
  const id = myPlayerId(); if (id && PL) PL.setRide(id, null);
  if (NET && NET.setFx) NET.setFx({ ride: '' });
  $('#bikeBtn').hidden = true;
  if (!quiet) toast('🚲 下車了，腳踏車自動騎回借車點');
}
$('#bikeBtn').addEventListener('click', () => dismountBike());
// 騎車不能上船、熱氣球、鴨子船：要先下車
function bikeGate(from, x, z) {
  if (!S.bike) return true;
  const ride = (W.onBoat && W.onBoat(x, z) && !(W.onBoat(from.x, from.z))) || (DUCK && DUCK.floorAt(x, z) != null && !DUCK.inBoat(from)) || (BAL && BAL.floorAt(x, z) != null && !BAL.inBasket(from));
  if (ride) { blockToast('🚲 腳踏車不能騎上船或熱氣球，請先按「下車還車」'); return false; }
  return true;
}
// 其他登入者的車（market/fx）
let fxRiders = new Set();
function applyFx(all, myUid) {
  if (!PL) return;
  const now = new Set();
  for (const [id, v] of Object.entries(all || {})) {
    if (id === myUid || !v) continue;
    if (typeof v.ride === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.ride)) { PL.setRide(id, v.ride); now.add(id); }
    if (STY) PL.setLook(id, { acc: STY.ACCS[v.acc] ? v.acc : null, pet: STY.PETS[v.pet] ? v.pet : null, dance: typeof v.dance === 'string' ? v.dance.slice(0, 20) : null });
  }
  for (const id of fxRiders) if (!now.has(id)) PL.setRide(id, null);
  fxRiders = now;
}

// ------------------------------------------------------------------ 👕 服飾店、💃 閃身步、🐾 寵物
// 買過的配件記在這台裝置（closet）；穿什麼、帶哪隻寵物會同步給其他人（market/fx）
const closet = () => Object.assign({ own: [], acc: null, pet: null }, store.get('closet', {}));
function applyLook() {
  const c = closet(), id = myPlayerId();
  if (id && PL) PL.setLook(id, { acc: c.acc, pet: c.pet });
  if (NET && NET.setFx) NET.setFx({ acc: c.acc || '', pet: c.pet || '' });
}
function shopHTML() {
  const c = closet(), A = STY.ACCS, P = STY.PETS, joined = !!meProfile();
  const accRows = Object.entries(A).map(([k, a], i) => {
    const own = c.own.includes(k), wearing = c.acc === k;
    const btn = !own ? `<button type="button" class="btn" data-buy="${k}">買（${a.price} 枚）</button>` : wearing ? `<button type="button" class="btn ghost" data-wear="">脫下</button>` : `<button type="button" class="btn" data-wear="${k}">穿上</button>`;
    return `<li class="ag-job"><span class="ag-no">${i + 1}</span><span class="ic" aria-hidden="true">${a.icon}</span><div class="ag-main"><b>${esc(a.name)}</b><small>${own ? (wearing ? '✅ 穿在身上' : '已經買了，隨時可以換') : `${a.price} 枚線上鯉魚幣，買了就是你的`}</small></div><div class="ag-side">${btn}</div></li>`;
  }).join('');
  const petRows = Object.entries(P).map(([k, a], i) => {
    const on = c.pet === k;
    return `<li class="ag-job"><span class="ag-no">${i + 1}</span><span class="ic" aria-hidden="true">${a.icon}</span><div class="ag-main"><b>${esc(a.name)}</b><small>${on ? '✅ 正跟著你散步' : '免費試玩：帶出去散步，會走在你旁邊'}</small></div><div class="ag-side"><button type="button" class="btn ${on ? 'ghost' : ''}" data-pet="${on ? '' : k}">${on ? '帶回家' : '帶出門'}</button></div></li>`;
  }).join('');
  return `${joined ? '' : '<p class="job-msg bad">要先按右下角「👤 加入」才有自己的人物，才能換裝、帶寵物、跳舞喔！</p>'}
    <h3 class="wl-h">1. 👑 配件（用線上鯉魚幣買）</h3><ol class="ag-list">${accRows}</ol>
    <p class="foot">一次戴一個配件。買過的配件記在這台裝置上；上衣顏色和帽子在「👤 加入」裡換。</p>
    <h3 class="wl-h">2. 🐾 寵物（免費試玩）</h3><ol class="ag-list">${petRows}</ol>
    <p class="foot">寵物會跟著你走；坐船、坐熱氣球的時候牠會先回家等你。寵物還在試玩，玩過之後告訴老師你喜歡怎麼玩！</p>
    <h3 class="wl-h">3. 💃 閃身步</h3>
    <ol class="ag-rules"><li>漫遊時按右下角「💃」（電腦按 G 鍵），人物會跳 4 秒的閃身步，旁邊的人也看得到。</li><li>騎車、坐船時不能跳。</li></ol>
    <div class="chal-btns"><button type="button" class="btn" data-dance="1">💃 現在試跳一次</button></div>`;
}
function openShop() {
  if (!STY) return;
  closePanel(false);
  $('#shopBody').innerHTML = shopHTML();
  const b = $('#shopBody');
  b.querySelectorAll('[data-buy]').forEach((x) => (x.onclick = () => {
    const k = x.dataset.buy, a = STY.ACCS[k], c = closet();
    if (!meProfile()) { toast('先按「👤 加入」才有自己的人物'); return; }
    if (WAL) { const bad = WAL.pay(a.price, 'shop', `服飾店：${a.name}`); if (bad) { toast('⛔ ' + bad); return; } }
    c.own = [...new Set([...c.own, k])]; c.acc = k; store.set('closet', c); applyLook();
    toast(`${a.icon} 買了${a.name}，已經戴上了！`); openShop();
  }));
  b.querySelectorAll('[data-wear]').forEach((x) => (x.onclick = () => { const c = closet(); c.acc = x.dataset.wear || null; store.set('closet', c); applyLook(); openShop(); }));
  b.querySelectorAll('[data-pet]').forEach((x) => (x.onclick = () => {
    if (!meProfile()) { toast('先按「👤 加入」才有自己的人物'); return; }
    const c = closet(); c.pet = x.dataset.pet || null; store.set('closet', c); applyLook();
    if (c.pet) toast(`${STY.PETS[c.pet].icon} ${STY.PETS[c.pet].name}跟著你了！按「🚶 漫遊」帶牠去散步`);
    openShop();
  }));
  const d = b.querySelector('[data-dance]'); if (d) d.onclick = () => { $('#shopDlg').close(); doDance(); };
  if (!$('#shopDlg').open) openDlg('#shopDlg');
}
let danceN = 0;
function doDance() {
  if (coasterLocked()) return;
  const id = myPlayerId();
  if (!id) { toast('先按「👤 加入」才有自己的人物，才能跳舞'); return; }
  if (S.bike) { toast('🚲 騎車時不能跳舞，先下車'); return; }
  const p = PL.me(); if (p && W && ((W.onBoat && W.onBoat(p.pos.x, p.pos.z)) || (DUCK && DUCK.inBoat(p.pos)) || (BAL && BAL.inBasket(p.pos)))) { toast('坐船、坐熱氣球時不能跳舞'); return; }
  const key = `${Date.now().toString(36)}${++danceN}`;
  PL.setLook(id, { ...closet(), dance: key });
  if (NET && NET.setFx) NET.setFx({ dance: key });
}
$('#actDance').addEventListener('click', (e) => { e.preventDefault(); doDance(); });

// ------------------------------------------------------------------ 🏛️ 市長任務：幫市集加路燈（每人每天 1 盞，大家都看得到，晚上會亮）
let lampsRemote = {}, lampsOnline = false;
const lampsLocal = () => store.get('lampsLocal', {});
const todayKey = () => new Date(NET ? NET.now() : Date.now()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
function lampState() { return lampsOnline ? lampsRemote : { ...lampsLocal(), ...lampsRemote }; }
function refreshLamps() { if (MY) MY.setLamps(lampState()); if ($('#mayorDlg').open) openMayor(); }
function watchLamps() {
  if (!NET || !NET.fb) return;
  const sub = () => { if (!NET.uid()) { setTimeout(sub, 400); return; } NET.fb.onValue(NET.fb.ref(NET.db, 'market/lamps'), (snap) => { lampsRemote = snap.val() || {}; lampsOnline = true; refreshLamps(); }, () => { lampsOnline = false; }); };
  sub();
}
function mayorHTML() {
  const st = lampState(), n = MY.spots.length, lit = MY.spots.filter((x) => st[x.id]).length;
  const doneToday = store.get('mayorDay', '') === todayKey(), admin = !!(WAL && WAL.admin);
  const list = MY.spots.map((x) => { const v = st[x.id]; return `<li class="${v ? 'on' : ''}"><b>💡 ${x.no} 號</b>${v ? `：${esc(String(v.by || '市民').slice(0, 16))} 的路燈${admin ? ` <button type="button" class="btn ghost sm" data-unlamp="${x.id}">移除</button>` : ''}` : '：還沒有路燈'}</li>`; }).join('');
  return `<ol class="ag-rules">
      <li><b>任務：</b>市長想讓服務台島晚上更亮。沿著環島自行車道有 ${n} 個發亮的號碼，請你選一個位置，蓋一盞路燈。</li>
      <li><b>規則：</b>每人每天可以蓋 1 盞；已經有路燈的位置不能再選。蓋好的路燈大家都看得到，天黑會亮起來。</li>
      <li><b>獎勵：</b>完成任務得 ${ECO().mayorReward || 10} 枚線上鯉魚幣。</li>
    </ol>
    <div class="ag-sum"><div><b>${lit}</b><small>已經點亮</small></div><div><b>${n - lit}</b><small>還能蓋</small></div><div><b>${doneToday ? '✅' : '1'}</b><small>${doneToday ? '你今天蓋過了' : '你今天可以蓋'}</small></div></div>
    <div class="chal-btns"><button type="button" class="btn" data-mayor="pick" ${doneToday || lit >= n ? 'disabled' : ''}>📍 去選位置</button></div>
    <h3 class="wl-h">💡 路燈清單</h3><ol class="mayor-list">${list}</ol>
    ${lampsOnline ? '' : '<p class="foot">（還沒連上市集伺服器：你蓋的路燈先只有這台裝置看得到）</p>'}`;
}
function openMayor() {
  if (!MY) return;
  closePanel(false);
  $('#mayorBody').innerHTML = mayorHTML();
  const b = $('#mayorBody');
  const pk = b.querySelector('[data-mayor="pick"]'); if (pk) pk.onclick = () => { $('#mayorDlg').close(); startMayorPick(); };
  b.querySelectorAll('[data-unlamp]').forEach((x) => (x.onclick = () => {
    const id = x.dataset.unlamp;
    NET.fb.remove(NET.fb.ref(NET.db, `market/lamps/${id}`)).then(() => toast('已移除這盞路燈')).catch(() => toast('沒有成功：請確認 Firebase 規則已更新'));
  }));
  if (!$('#mayorDlg').open) openDlg('#mayorDlg');
}
function startMayorPick() {
  if (coasterLocked()) return;
  if (S.walking && !exitWalk(true)) return;
  closePanel(false); closePhotoBar();
  S.mayorPick = true; MY.showMarkers(true); $('#mayorBar').hidden = false;
  const I = W.islands.center, T = I.pos.clone().setY(GH);
  CAM.flight({ t: T, p: T.clone().add(new THREE.Vector3(0, isMobile() ? 24 : 17, isMobile() ? 9 : 12)) }, 1400, 2, () => toast('💡 點一個發亮的號碼，選路燈的位置'));
}
function endMayorPick() { S.mayorPick = false; if (MY) MY.showMarkers(false); $('#mayorBar').hidden = true; }
$('#mayorCancel').addEventListener('click', () => endMayorPick());
function chooseLamp(sp) {
  const st = lampState();
  if (st[sp.id]) { toast(`💡 ${sp.no} 號已經有路燈了，換一個位置`); return; }
  if (store.get('mayorDay', '') === todayKey()) { toast('你今天已經蓋過路燈了，明天再來'); endMayorPick(); return; }
  $('#mayorBody').innerHTML = `<p class="job-q">要在 <b>💡 ${sp.no} 號</b>蓋一盞路燈嗎？</p><p class="foot">蓋好之後大家都看得到，今天就不能再蓋了。</p>
    <div class="chal-btns"><button type="button" class="btn" data-ok>✅ 蓋在這裡</button><button type="button" class="btn ghost" data-no>換一個位置</button></div>`;
  $('#mayorBody').querySelector('[data-no]').onclick = () => $('#mayorDlg').close();
  $('#mayorBody').querySelector('[data-ok]').onclick = () => { $('#mayorDlg').close(); buildLamp(sp); };
  openDlg('#mayorDlg');
}
function buildLamp(sp) {
  const name = (meProfile() && meProfile().name) || '市民';
  const v = { by: String(name).slice(0, 16), t: NET ? NET.now() : Date.now() };
  const done = () => {
    store.set('mayorDay', todayKey()); endMayorPick();
    const got = WAL ? WAL.earn(ECO().mayorReward || 10, 'mayor', '市長任務：加路燈') : 0;
    toast(`💡 ${sp.no} 號的路燈蓋好了！天黑會亮起來${got ? `，得到 ${got} 枚` : ''}`);
    refreshLamps();
  };
  if (NET && NET.fb && NET.uid()) {
    NET.fb.set(NET.fb.ref(NET.db, `market/lamps/${sp.id}`), { ...v, uid: NET.uid() }).then(done).catch(() => { const L0 = lampsLocal(); L0[sp.id] = v; store.set('lampsLocal', L0); lampsOnline = false; done(); });
  } else { const L0 = lampsLocal(); L0[sp.id] = v; store.set('lampsLocal', L0); done(); }
}

// ------------------------------------------------------------------ 📞 遊戲電話：打給同時在線上的同學，只能用預設短句和表情
function whereAmI() {
  const p = S.walking && CAM ? CAM.walk.pos : PL && PL.me() ? PL.me().pos : null;
  if (!p || !W) return '市集';
  if (DUCK && DUCK.inBoat(p)) return '鴨子船上'; if (BAL && BAL.inBasket(p)) return '熱氣球上'; if (W.onBoat && W.onBoat(p.x, p.z)) return '鯉魚號上';
  let best = null, bd = 1e9; for (const id of STAMP_IDS) { const I = W.islands[id], d = Math.hypot(p.x - I.pos.x, p.z - I.pos.z) - I.R; if (d < bd) { bd = d; best = id; } }
  return best ? (islandById(best) || {}).name || '市集' : '市集';
}
const FAKE_AS = /[?&]fakedb\b/.test(location.search) ? new URLSearchParams(location.search).get('as') : null;   // 測試：每個分頁一個身分
function phoneDb() {
  if (/[?&]fakedb\b/.test(location.search) && PHM) return PHM.fakeDb(FAKE_AS || (meProfile() || {}).id || `t${Math.random().toString(36).slice(2, 7)}`);
  if (!NET || !NET.fb) return null;
  const F = NET.fb, R = (p) => F.ref(NET.db, p);
  return {
    uid: () => NET.uid(), now: () => NET.now(),
    set: (p, v) => F.set(R(p), v), update: (p, v) => F.update(R(p), v), remove: (p) => F.remove(R(p)).catch(() => {}),
    on: (p, cb) => F.onValue(R(p), (snap) => cb(snap.val()), () => cb(null)),
    onDisconnectRemove: (p) => { F.onDisconnect(R(p)).remove().catch(() => {}); },
  };
}
async function startPhone() {
  if (PH) return;
  try { PHM = await import('./phone.js?v=20261124v'); } catch (e) { console.warn('遊戲電話載入失敗', e); return; }
  const db = phoneDb(); if (!db) return;
  PH = PHM.createPhone(db, {
    name: () => FAKE_AS || (meProfile() || {}).name || '', where: whereAmI, toast,
    chime: (soft) => { try { if (SND) soft ? SND.chirp && SND.chirp() : SND.chime && SND.chime(); } catch (e) { /* 沒聲音也沒關係 */ } },
    canUse: () => { if (!meProfile()) { toast('📞 先按「👤 加入」取暱稱，才能打電話'); return false; } return true; },
    render: renderPhone,
  });
  PH.setDnd(store.get('phoneDnd', false));
  PH.start();
  $('#phoneBtn').hidden = false;
}
function renderPhone(st) {
  // 通話卡（右下角浮動）：響鈴、通話中
  const card = $('#callCard'), c = st.call;
  const key = c ? [c.role, c.st, c.peer, c.heard && c.heard.t, c.said && c.said.t].join('|') : '';
  if (c && key === card.dataset.key) { const sec = card.querySelector('.cc-sec'); if (sec) sec.textContent = c.left; }
  else if (!c) { card.hidden = true; card.innerHTML = ''; card.dataset.key = ''; } else {
    card.hidden = false; card.dataset.key = key;
    const heard = c.heard ? `<p class="cc-heard"><b>${esc(c.peerName)}：</b>${esc(PH.phrase(c.heard.k, c.heard.where))}</p>` : '';
    const said = c.said ? `<p class="cc-said"><b>我：</b>${esc(PH.phrase(c.said.k, c.said.where))}</p>` : '';
    if (c.st === 'ring' && c.role === 'in') card.innerHTML = `<p class="cc-t">📞 <b>${esc(c.peerName)}</b> 打電話給你（<span class="cc-sec">${c.left}</span> 秒）</p><div class="cc-btns"><button type="button" class="btn" data-cc="yes">✅ 接聽</button><button type="button" class="btn ghost" data-cc="no">❌ 拒絕</button></div>`;
    else if (c.st === 'ring') card.innerHTML = `<p class="cc-t">📞 正在打給 <b>${esc(c.peerName)}</b>…（<span class="cc-sec">${c.left}</span> 秒）</p><div class="cc-btns"><button type="button" class="btn ghost" data-cc="hang">取消</button></div>`;
    else {
      const ph = PHM.PHRASES.map((p, i) => `<button type="button" class="cc-ph" data-say="${i}">${esc(PH.phrase(i, '📍這裡'))}</button>`).join('');
      card.innerHTML = `<p class="cc-t">📞 和 <b>${esc(c.peerName)}</b> 通話中</p>${heard}${said}<div class="cc-phs">${ph}</div><div class="cc-btns"><button type="button" class="btn ghost" data-cc="find">📍 去找他</button><button type="button" class="btn danger" data-cc="hang">掛斷</button></div>`;
    }
    card.querySelectorAll('[data-cc]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.cc;
      if (k === 'yes') PH.answer(true); else if (k === 'no') PH.answer(false); else if (k === 'hang') PH.hangup();
      else if (k === 'find') { const p = PL && PL.posOf(c.peer); if (!p) { toast('📞 現在看不到他的人物（他可能還沒加入或在看網站）'); return; } if (S.walking && !exitWalk(true)) return; closePanel(false); const t = p.clone().setY(p.y + 1); CAM.flight({ t, p: t.clone().add(new THREE.Vector3(5, 7, 9)) }, 1400, 2, () => toast(`📍 ${c.peerName} 在這裡`)); }
    }));
    card.querySelectorAll('[data-say]').forEach((b) => (b.onclick = () => PH.say(+b.dataset.say)));
  }
  if ($('#phoneDlg').open) $('#phoneBody').innerHTML = phoneListHTML(st), bindPhoneList();
}
function phoneListHTML(st) {
  const rows = st.list.length ? st.list.map((p, i) => `<li class="ag-job"><span class="ag-no">${i + 1}</span><span class="ic" aria-hidden="true">🧑</span><div class="ag-main"><b>${esc(p.name)}</b><small>在線上，可以接電話</small></div><div class="ag-side"><button type="button" class="btn" data-dial="${esc(p.id)}" ${st.call ? 'disabled' : ''}>📞 打給他</button></div></li>`).join('') : '<p class="foot">現在沒有其他同學可以接電話。等同學加入市集、打開網站再試試。</p>';
  return `<ol class="ag-rules"><li>電話只能打給<b>現在在線上、有加入市集</b>的同學。</li><li>接通後只能用<b>預設的短句和表情</b>聊天（例如「來服務台找我！」），不能自己打字。</li><li>不想被打擾就打開下面的「🔕 不接電話」。</li></ol>
    <ol class="ag-list">${rows}</ol>
    <label class="ph-dnd"><input type="checkbox" id="phDnd" ${st.dnd ? 'checked' : ''}> 🔕 不接電話（別人在電話簿裡看不到我）</label>`;
}
function bindPhoneList() {
  $('#phoneBody').querySelectorAll('[data-dial]').forEach((b) => (b.onclick = () => { PH.dial(b.dataset.dial); $('#phoneDlg').close(); }));
  const d = $('#phDnd'); if (d) d.onchange = () => { store.set('phoneDnd', d.checked); PH.setDnd(d.checked); };
}
function openPhone() {
  if (!PH) { toast('📞 電話還沒準備好，等一下再試'); return; }
  if (!meProfile()) { toast('📞 先按「👤 加入」取暱稱，才能打電話'); return; }
  PH.refresh();
  $('#phoneBody').innerHTML = phoneListHTML(PH.state()); bindPhoneList();
  if (!$('#phoneDlg').open) openDlg('#phoneDlg');
}
$('#phoneBtn').addEventListener('click', openPhone);
setInterval(() => { if (PH && PH.state().call) renderPhone(PH.state()); }, 1000);   // 響鈴倒數

// ------------------------------------------------------------------ 地點清單與搜尋
let filter = '全部';
function cardHTML(id) {
  const I = islandById(id), c = colorOf(id);
  const res = C.residents.filter((r) => r.island === id);
  const resList = `<details><summary>島上的人與對話（示意角色）</summary>${res.map((r) => `<div class="res" style="margin:6px 0"><b>${esc(r.name)}</b>・${esc(r.job)}<ul style="margin:4px 0 0;padding-left:18px">${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}</details>`;
  if (id === 'center') return `<article class="card" style="--c:${c}"><h3>★ ${esc(I.name)} <span class="grp">${esc(I.role)}</span></h3><p>${esc(I.intro)}</p><p>${esc(I.overview)}</p>${eventHTML()}${catLine(id)}${resList}<div class="acts"><button type="button" data-open="center">在地圖上看</button></div></article>`;
  return `<article class="card" style="--c:${c}"><h3><span class="tag" style="position:static;box-shadow:none;--tc:${c};min-height:auto;padding:0;background:none"><span class="no">${I.order}</span></span>${esc(I.name)} <span class="grp">${esc(I.group)}・${stallsOf(id).length} 攤</span>${S.stamps.includes(id) ? ' 🏮' : ''}</h3>
    <p>${esc(I.intro)}</p><ol class="stalls" style="--pc:${c}">${stallsOf(id).map((st) => `<li><button type="button" class="stall-row" data-open="${id}" data-no="${st.no}"><span class="num" aria-hidden="true">${pad2(st.no)}</span><span class="nm ${st.namePending ? 'pending' : ''}"><span class="sr-only">攤號 ${st.no}，</span>${esc(st.name)}</span><span class="go" aria-hidden="true">看介紹 ›</span></button></li>`).join('')}</ol>
    <p style="margin-top:8px"><b>地標：</b>${esc(I.landmark)}</p>${catLine(id)}${resList}
    <div class="acts"><button type="button" data-open="${id}">在地圖上看</button><a href="${esc(I.download)}" download>📄 下載攤位清單</a></div></article>`;
}
function renderList() {
  const groups = ['全部', ...C.islands.map((i) => i.group), '服務台', '🐾 貓咪'];
  $('#filters').innerHTML = groups.map((g) => `<button type="button" aria-pressed="${g === filter}" data-f="${g}">${g}</button>`).join('');
  if (filter === '🐾 貓咪') { $('#listBody').innerHTML = catsListHTML(); return; }
  const ids = ['center', ...C.islands.map((i) => i.id)].filter((id) => filter === '全部' || (id === 'center' ? filter === '服務台' : islandById(id).group === filter));
  const boat = W && L && filter === '全部' ? `<article class="card" style="--c:${C.carpBoat.color}"><h3>⛵ ${esc(C.carpBoat.name)} <span class="grp">${esc(C.carpBoat.role)}</span></h3><p>${esc(C.carpBoat.intro)}</p><p class="foot">${esc(C.carpBoat.note)}</p><div class="acts"><button type="button" data-open="carp">在地圖上看</button></div></article>` : '';
  const CD = coasterDef(), coa = W && COA && filter === '全部' ? `<article class="card" style="--c:${CD.color}"><h3>🎢 ${esc(CD.name)} <span class="grp">${esc(CD.role)}</span></h3><p>${esc(CD.intro)}</p><p class="foot">${esc(CD.note)}</p><div class="acts"><button type="button" data-open="coaster">在地圖上看</button></div></article>` : '';
  const DD = duckDef(), duck = W && DUCK && filter === '全部' ? `<article class="card" style="--c:${DD.color}"><h3>🦆 ${esc(DD.name)} <span class="grp">${esc(DD.role)}</span></h3><p>${esc(DD.intro)}</p><p class="foot">${esc(DD.note)}</p><div class="acts"><button type="button" data-open="duck">在地圖上看</button></div></article>` : '';
  const BD = balloonDef(), bal = W && BAL && filter === '全部' ? `<article class="card" style="--c:${BD.color}"><h3>🎈 ${esc(BD.name)} <span class="grp">${esc(BD.role)}</span></h3><p>${esc(BD.intro)}</p><p class="foot">${esc(BD.note)}</p><div class="acts"><button type="button" data-open="balloon">在地圖上看</button></div></article>` : '';
  $('#listBody').innerHTML = ids.map(cardHTML).join('') + boat + duck + coa + bal + `<p class="foot">作者：${esc(C.site.author)}｜${esc(C.site.layoutNote)}｜${esc(C.residentsNote)}吉祥物造型為示意。攤位清單資料來自主辦提供的檔案，可在各島下載。</p>`;
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
  if (W && BAL && [balloonDef().name, balloonDef().role, '熱氣球', '氣球', '起降場', '飛', 'balloon'].some(test)) hits.push({ id: 'balloon', exact: test(balloonDef().name), text: `🎈 ${balloonDef().name}・${balloonDef().role}` });
  if (W && COA && [coasterDef().name, coasterDef().role, '雲霄', '飛車', '遊樂', 'coaster'].some(test)) hits.push({ id: 'coaster', exact: test(coasterDef().name), text: `🎢 ${coasterDef().name}・${coasterDef().role}` });
  if (W && DUCK && [duckDef().name, duckDef().role, '鴨', '小鴨', '腳踏船', '踩', 'duck'].some(test)) hits.push({ id: 'duck', exact: test(duckDef().name), text: `🦆 ${duckDef().name}・${duckDef().role}` });
  hits.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || (b.nameHit ? 1 : 0) - (a.nameHit ? 1 : 0));
  for (const d of C.cats || []) if (test(d.name) || test(d.coat) || q.includes('貓')) hits.push({ id: d.island, cat: d.id, text: `🐾 ${d.name}・${d.coat}（${islandById(d.island).name}）` });
  for (const r of C.residents) if (test(r.name) || test(r.job)) hits.push({ id: r.island, text: `${r.name}・${r.job}（${islandById(r.island).name}）` });
  out.innerHTML = hits.length ? hits.slice(0, 20).map((h, i) => `<button type="button" data-id="${h.id}" ${h.no != null ? `data-no="${h.no}"` : ''} ${h.cat ? `data-cat="${h.cat}"` : ''} style="--c:${colorOf(h.id)}">${esc(h.text)}${i === 0 && h.no != null ? '<small class="enter">按 Enter 直接開啟</small>' : ''}</button>`).join('') : `<p class="none">找不到「${esc(q)}」，換個關鍵字試試，例如「餅乾」「迷宮」或攤號「11」。</p>`;
}
$('#searchInput').addEventListener('input', (e) => search(e.target.value));
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#searchResults button')?.click(); } });
$('#searchResults').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.dataset.cat) return; $('#listDlg').close(); openIsland(b.dataset.id, { no: b.dataset.no != null ? +b.dataset.no : undefined, opener: $('#searchBtn') }); });
$('#listBtn').addEventListener('click', () => { renderList(); openDlg('#listDlg'); });
$('#searchBtn').addEventListener('click', () => { renderList(); openDlg('#listDlg'); $('#searchInput').focus(); });

// ------------------------------------------------------------------ 說明
function renderHelp() {
  // 說明分大項目、小項目，都有編號（content.json 的 helpSections；舊版 help 當備用）
  const secs = C.helpSections || [{ icon: '📖', title: '怎麼逛', items: C.help || [] }];
  const toc = `<nav class="help-toc" aria-label="說明目錄">${secs.map((x, i) => `<a href="#help-${i + 1}">${i + 1}. ${x.icon} ${esc(x.title)}</a>`).join('')}</nav>`;
  const body = secs.map((x, i) => `<section class="help-sec" id="help-${i + 1}"><h3><span class="hn">${i + 1}</span>${x.icon} ${esc(x.title)}</h3><ol class="help-list">${x.items.map((t, j) => `<li><span class="sn">${i + 1}-${j + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol></section>`).join('');
  $('#helpBody').innerHTML = `<div class="help-hd"><span class="mascot" style="width:56px;height:56px">${MASCOT}</span><p>嗨！我是小鯉魚。遊戲規則分成 ${secs.length} 大項，點目錄直接跳過去。</p></div>${toc}${body}
    <p class="foot">小提醒：右上角「⚙️ 設定」可以換底色、白天黑夜、減少動態與低畫質。<br>島嶼配置為示意，非實際場地比例；島上居民、動物與交換小遊戲都是網站上的示意內容。<br>作者：${esc(C.site.author)}</p>`;
  $('#helpBody').querySelectorAll('.help-toc a').forEach((a) => (a.onclick = (e) => { e.preventDefault(); $(a.getAttribute('href')).scrollIntoView({ block: 'start', behavior: S.reduced ? 'auto' : 'smooth' }); }));
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
  if (BAL) {
    const B = balloonDef(), b = document.createElement('button'); b.type = 'button'; b.className = 'tag boat';
    b.style.setProperty('--tc', B.color); b.style.setProperty('--ttint', '#fbe4f0'); b.style.setProperty('--tink', '#5e1640');
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'panel');
    b.innerHTML = `<span class="no" aria-hidden="true">🎈</span><span>${esc(B.name)}</span><span class="ct"></span><span class="dir" aria-hidden="true">➜</span>`;
    b.addEventListener('click', () => openBalloon({ opener: b }));
    box.append(b); tags.balloon = b;
  }
  if (COA) {
    const B = coasterDef(), b = document.createElement('button'); b.type = 'button'; b.className = 'tag boat';
    b.style.setProperty('--tc', B.color); b.style.setProperty('--ttint', '#fde6df'); b.style.setProperty('--tink', '#5e1a0a');
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'panel');
    b.innerHTML = `<span class="no" aria-hidden="true">🎢</span><span>${esc(B.name)}</span><span class="ct"></span><span class="dir" aria-hidden="true">➜</span>`;
    b.addEventListener('click', () => openCoaster({ opener: b }));
    box.append(b); tags.coaster = b;
  }
  if (DUCK) {
    const B = duckDef(), b = document.createElement('button'); b.type = 'button'; b.className = 'tag boat';
    b.style.setProperty('--tc', B.color); b.style.setProperty('--ttint', '#fff4cc'); b.style.setProperty('--tink', '#5a3d00');
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'panel');
    b.innerHTML = `<span class="no" aria-hidden="true">🦆</span><span>${esc(B.name)}</span><span class="ct"></span><span class="dir" aria-hidden="true">➜</span>`;
    b.addEventListener('click', () => openDuck({ opener: b }));
    box.append(b); tags.duck = b;
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
  S.balRect = null;
  if (tags.balloon) {
    const t = tags.balloon, g = BAL.g, st = balloonStatus();
    _v.set(g.position.x, g.position.y + 8.4, g.position.z).project(W.camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
    t.style.visibility = vis ? 'visible' : 'hidden';
    const ct = t.querySelector('.ct'); if (ct.textContent !== st.short) { ct.textContent = st.short; t.setAttribute('aria-label', `${balloonDef().name}，${balloonDef().role}，${st.short}`); }
    if (vis) { const tw = t.offsetWidth || 160, th = t.offsetHeight || 44; S.balRect = { t, x: (_v.x + 1) / 2 * w - tw / 2, y: (1 - _v.y) / 2 * h - th, w: tw, h: th }; }
  }
  S.coaRect = null;
  if (tags.coaster) {
    const t = tags.coaster, g = COA.cars[0], st = coasterStatus();
    _v.set(g.position.x, g.position.y + 3.2, g.position.z).project(W.camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
    t.style.visibility = vis ? 'visible' : 'hidden';
    const ct = t.querySelector('.ct'); if (ct.textContent !== st.short) { ct.textContent = st.short; t.setAttribute('aria-label', `${coasterDef().name}，${coasterDef().role}，${st.short}`); }
    if (vis) { const tw = t.offsetWidth || 170, th = t.offsetHeight || 44; S.coaRect = { t, x: (_v.x + 1) / 2 * w - tw / 2, y: (1 - _v.y) / 2 * h - th, w: tw, h: th }; }
  }
  S.duckRect = null;
  if (tags.duck) {
    const t = tags.duck, g = DUCK.g, st = duckStatus();
    _v.set(g.position.x, 5.2, g.position.z).project(W.camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
    t.style.visibility = vis ? 'visible' : 'hidden';
    const ct = t.querySelector('.ct'); if (ct.textContent !== st.short) { ct.textContent = st.short; t.setAttribute('aria-label', `${duckDef().name}，${duckDef().role}，${st.short}`); }
    if (vis) { const tw = t.offsetWidth || 150, th = t.offsetHeight || 44; S.duckRect = { t, x: (_v.x + 1) / 2 * w - tw / 2, y: (1 - _v.y) / 2 * h - th, w: tw, h: th }; }
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
  // 雲霄飛車標籤也讓位
  const CR0 = S.coaRect;
  if (CR0) {
    const hit = (y) => rects.find((a) => a.vis !== false && CR0.x < a.x + a.w + 4 && CR0.x + CR0.w + 4 > a.x && y < a.y + a.h + 4 && y + CR0.h + 4 > a.y);
    let y = CR0.y, r, n = 0;
    while ((r = hit(y)) && n++ < 8) y = r.y - CR0.h - 4;
    if (y < 70) { y = CR0.y; n = 0; while ((r = hit(y)) && n++ < 8) y = r.y + r.h + 4; }
    rects.push({ t: CR0.t, x: CR0.x, y, w: CR0.w, h: CR0.h });
  }
  // 鴨子船標籤也讓位給島名和鯉魚號的標籤
  const DR = S.duckRect;
  if (DR) {
    const hit = (y) => rects.find((a) => a.vis !== false && DR.x < a.x + a.w + 4 && DR.x + DR.w + 4 > a.x && y < a.y + a.h + 4 && y + DR.h + 4 > a.y);
    let y = DR.y, r, n = 0;
    while ((r = hit(y)) && n++ < 8) y = r.y - DR.h - 4;
    if (y < 70) { y = DR.y; n = 0; while ((r = hit(y)) && n++ < 8) y = r.y + r.h + 4; }
    rects.push({ t: DR.t, x: DR.x, y, w: DR.w, h: DR.h });
  }
  // 熱氣球標籤也讓位給島名和船的標籤
  const BR = S.balRect;
  if (BR) {
    const hit = (y) => rects.find((a) => a.vis !== false && BR.x < a.x + a.w + 4 && BR.x + BR.w + 4 > a.x && y < a.y + a.h + 4 && y + BR.h + 4 > a.y);
    let y = BR.y, r, n = 0;
    while ((r = hit(y)) && n++ < 8) y = r.y - BR.h - 4;
    if (y < 70) { y = BR.y; n = 0; while ((r = hit(y)) && n++ < 8) y = r.y + r.h + 4; }
    rects.push({ t: BR.t, x: BR.x, y, w: BR.w, h: BR.h });
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
  if (o.cat) { o.cat.talking = true; S.bubble.msg = o.cat.state === 'sleep' ? `${o.cat.data.name}睡得正香……輕輕摸摸看？` : o.cat.data.lines[Math.floor(Math.random() * o.cat.data.lines.length)]; focusCat(o.cat); }
  $('#labels').classList.add('dim');
  $('#bubble').classList.toggle('catfixed', !!o.cat); if (o.cat) $('#bubble').style.transform = '';   // 擼貓說明固定在畫面上，不跟著貓晃
  renderBubble(); $('#bubble').hidden = false;
  $('#bubble').querySelector('button')?.focus({ preventScroll: true });
}
function renderBubble(msg) {
  const B = S.bubble; if (!B) return; const o = B.o, el = $('#bubble');
  if (o.cat) { renderCatBubble(); return; }
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
  if (o.cat) { o.cat.talking = false; unfocusCat(); }   // 號碼牌留著，可以先去逛別的島
  S.bubble = null; $('#bubble').hidden = true; $('#labels').classList.remove('dim');
}
function placeBubble() {
  if (!S.bubble || S.bubble.o.cat) return;
  const p = headOf(S.bubble.o).project(W.camera), el = $('#bubble');
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
  if (skipUp) { skipUp = false; down = null; return; }
  if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (moved > 7 || S.intro) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  // 氣球彩蛋：點氣球就刺破（漫遊時也可以）；熱氣球刺不破
  ray.setFromCamera(ndc, W.camera);
  if (FX) { const bh = ray.intersectObjects(FX.balloons(), false)[0]; if (bh && FX.pop(bh.object)) { balloonPopped(); return; } }
  if (S.mayorPick && MY) { const sp = MY.pickSpot(ray); if (sp) chooseLamp(sp); else toast('💡 點一個發亮的號碼；不想選了按「✕ 取消」'); return; }   // 市長任務：選路燈位置
  if (MY && MY.pickBoard(ray)) { openMayor(); return; }   // 市長任務看板
  if (BK && BK.pick(ray)) { rentBike(); return; }   // 借車點：點車架借車
  if (SHOP && SHOP.pick(ray)) { openShop(); return; }   // 服飾店
  if (GM && GM.pick(ray)) return;                 // 釣魚區、躲貓貓
  if (IA && IA.pick(ray)) return;                 // 可以互動的地標（果汁杯、貼紙牆、彈珠、書櫃、合照點）
  if (JOBS && JOBS.pick(ray)) return;             // 打工：沙灘清潔員撿垃圾
  // 漫遊時點攤位招牌或攤子：留在地面，右邊直接打開那一攤的介紹（不飛回鳥瞰）
  if (S.walking && SG) {
    const sw = ray.intersectObjects(SG.pickables.map((p) => p.obj), false)[0];
    if (sw && sw.distance < 25) { const sg = SG.pickables.find((p) => p.obj === sw.object).sign; closeBubble(); panelOpener = null; showPanel(sg.island, sg.st.no); return; }
  }
  if (S.walking || (CAM.S.busy && !CAM.S.busy.custom)) return;
  ray.setFromCamera(ndc, W.camera);
  const PK = allPickables();
  const life = ray.intersectObjects(PK.filter((p) => p.obj.parent && p.obj.parent.visible).map((p) => p.obj), false)[0];
  let pick = life ? PK.find((p) => p.obj === life.object) : null;
  if (!pick && (e.pointerType === 'touch' || isMobile())) {   // 手機：用螢幕距離找最近的居民或動物
    let best = null, bd = 46;
    for (const p of PK) {
      if (p.shell || !p.obj.parent.visible) continue;
      const s = headOf(p).project(W.camera); if (s.z > 1) continue;
      const d = Math.hypot((s.x + 1) / 2 * innerWidth - e.clientX, (1 - s.y) / 2 * innerHeight - e.clientY - 24);
      if (d < bd) { bd = d; best = p; }
    }
    pick = best;
  }
  if (pick && pick.shell) { if (performance.now() >= pick.shell.hiddenUntil) { pick.shell.hiddenUntil = performance.now() + 20000; S.bag.shell = (S.bag.shell || 0) + 1; saveBag(); toast('🐚 撿到一個貝殼！+1'); } return; }
  if (pick && pick.cat && S.bubble && S.bubble.o.cat === pick.cat) { petCat(pick.cat); return; }   // 再點一次貓＝摸一下
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
  const balH = BAL && ray.intersectObject(BAL.g, true)[0];
  if (balH && (!best || balH.distance < best.d)) { openBalloon({ opener: tags.balloon }); return; }
  const coH = COA && ray.intersectObjects(COA.cars, true)[0];
  if (coH && (!best || coH.distance < best.d)) { openCoaster({ opener: tags.coaster }); return; }
  const dkH = DUCK && ray.intersectObject(DUCK.g, true)[0];
  if (dkH && (!best || dkH.distance < best.d)) { openDuck({ opener: tags.duck }); return; }
  if (best) openIsland(best.id, { opener: tags[best.id] });
}

// ------------------------------------------------------------------ 自動導覽路線
// ------------------------------------------------------------------ 島上的貓：擼貓、圖鑑
const headOf = (o) => (o.cat ? K.headOf(o) : L.headOf(o));
const allPickables = () => (K ? [...L.pickables, ...K.pickables] : L.pickables);
const catData = (id) => (C.cats || []).find((d) => d.id === id);
// 圖鑑用的小貓臉（依毛色畫）
function catFace(d, px = 64) {
  const L0 = d.look, b = L0.base, cal = L0.pattern === 'calico', bl = L0.belly || '#fff', st = L0.stripe || b;
  let pat = '';
  if (L0.pattern === 'tabby') pat = `<path d="M26 18v7M32 17v8M38 18v7" stroke="${st}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  if (L0.pattern === 'tuft') pat = `<path d="M29 20l3-7 3 7z" fill="${L0.tuft}" stroke="none"/>`;
  if (cal) pat = `<path d="M33 16c8-2 17 4 17 13-6 1-14-3-17-13z" fill="${L0.patchA}" stroke="none"/><path d="M15 32c1-6 6-10 11-10-1 6-5 10-11 10z" fill="${L0.patchB}" stroke="none"/>`;
  if (L0.pattern === 'tuxedo') pat = `<path d="M32 21l-6 16h12z" fill="${bl}" stroke="none"/>`;
  const glasses = L0.extra === 'glasses' ? '<g fill="none" stroke="#3a2d28" stroke-width="1.8"><circle cx="24" cy="33" r="6"/><circle cx="40" cy="33" r="6"/><path d="M30 33h4"/></g>' : '';
  const bow = L0.extra === 'bow' ? `<path d="M40 14l6-4v8zM52 14l-6-4v8z" fill="${L0.collar}" stroke="#5a4038" stroke-width="1.2"/>` : '';
  return `<svg class="catface" viewBox="0 0 64 64" width="${px}" height="${px}" aria-hidden="true"><g stroke="#5a4038" stroke-width="1.6" stroke-linejoin="round">
<path d="M12 30L13 7l16 11z" fill="${cal ? L0.patchB : b}"/><path d="M52 30L51 7 35 18z" fill="${cal ? L0.patchA : b}"/>
<path d="M15 25L15 12l8 6zM49 25V12l-8 6z" fill="#ffb3c1" stroke="none"/>
<ellipse cx="32" cy="34" rx="${L0.chubby ? 24 : 22}" ry="19" fill="${b}"/></g>${pat}
<ellipse cx="32" cy="43" rx="10" ry="6.5" fill="${bl}"/>
<ellipse cx="24" cy="33" rx="3.4" ry="4.2" fill="#231a16"/><ellipse cx="40" cy="33" rx="3.4" ry="4.2" fill="#231a16"/><circle cx="25" cy="31.5" r="1.2" fill="#fff"/><circle cx="41" cy="31.5" r="1.2" fill="#fff"/>
<path d="M30 40h4l-2 2.4z" fill="#ff8fa7"/><path d="M28 44q2 2 4 0q2 2 4 0" fill="none" stroke="#5a4038" stroke-width="1.3" stroke-linecap="round"/>
<circle cx="18" cy="40" r="2.6" fill="#ffa0b4" opacity=".75"/><circle cx="46" cy="40" r="2.6" fill="#ffa0b4" opacity=".75"/>
<path d="M14 42l-8-1M14 45l-8 2M50 42l8-1M50 45l8 2" stroke="#5a4038" stroke-width="1" stroke-linecap="round"/>
${glasses}${bow}<path d="M17 50q15 7 30 0" fill="none" stroke="${L0.collar}" stroke-width="4" stroke-linecap="round"/></svg>`;
}
function catSecHTML(islandId) {
  const d = (C.cats || []).find((x) => x.island === islandId); if (!d) return '';
  const got = S.petted.includes(d.id);
  return `<div class="p-sec"><h3>島上的貓 🐾</h3><div class="catrow">${catFace(d, 56)}<div><b>${esc(d.name)}</b>・${esc(d.coat)}${got ? ' ✅' : ''}<br><small>${esc(d.personality)}</small></div><button type="button" class="btn" data-cat="${d.id}">🖐 擼貓</button></div></div>`;
}
function catLine(islandId) {
  const d = (C.cats || []).find((x) => x.island === islandId); if (!d) return '';
  return `<p class="catline">${catFace(d, 30)}<span><b>島上的貓：${esc(d.name)}</b>（${esc(d.coat)}）${esc(d.personality)}</span><button type="button" data-cat="${d.id}">🖐 擼貓</button></p>`;
}
function catsListHTML() {
  return `<div class="catgrid">${(C.cats || []).map((d) => catCardHTML(d)).join('')}</div><p class="foot">${esc(C.catsNote || '')}</p>`;
}
function catCardHTML(d) {
  const got = S.petted.includes(d.id);
  return `<div class="catcard ${got ? 'got' : ''}" style="--c:${colorOf(d.island)}">${catFace(d, 76)}<h3>${esc(d.name)}${got ? ' <span class="ok">✅ 擼過了</span>' : ''}</h3>
    <p class="cc-meta">${esc(d.coat)}・${esc(islandById(d.island).name)}</p><p>${esc(d.personality)}</p><p class="cc-meta">最愛被摸：${esc(d.favorite)}</p>
    <button type="button" class="btn ${got ? 'ghost' : ''}" data-cat="${d.id}">${got ? '🖐 再去擼一次' : '🔍 去找牠'}</button></div>`;
}
function openCats() {
  const n = S.petted.length, tot = (C.cats || []).length;
  $('#catBody').innerHTML = `<p style="margin:0 0 12px">每座島都住著一隻貓。找到牠、擼擼牠，就能收進圖鑑！目前 <b>${n}/${tot}</b>${n === tot ? '　🎉 全部收集完成！' : ''}</p>
    <div class="catgrid">${(C.cats || []).map(catCardHTML).join('')}</div>
    <h3 style="margin:14px 0 6px;font-size:15px">擼貓會看到的 ${REACTION_IDS.length} 種反應</h3>
    <div class="reacts">${REACTION_IDS.map((k) => `<span>${REACTIONS[k].icon} ${esc(REACTIONS[k].name)}</span>`).join('')}</div>
    <p class="foot">小提醒：一直摸、一直摸，貓會甩尾巴走開，要等牠休息一下喔。輕輕的、看牠開不開心，貓才會喜歡你。<br>${esc(C.catsNote || '')}圖鑑紀錄存在這台裝置的瀏覽器裡。</p>
    <button type="button" class="btn ghost" id="catReset">重置圖鑑</button>`;
  $('#catReset').onclick = () => { S.petted = []; store.set('cats', []); store.set('catsDone', false); renderHud(); openCats(); toast('圖鑑已重置'); };
  openDlg('#catDlg');
}
// 鏡頭靠近貓
function focusCat(c) {
  closePhotoBar();
  if (!CAM || S.walking) return;
  if (S.tour) endTour(false);
  const p = c.M.g.position, t = p.clone().setY(p.y + .55 * (c.data.scale || 1) + (isMobile() ? 2.4 : .7));   // 鏡頭看貓的上方，讓貓落在畫面下半部、不被對話框擋住
  const dir = W.camera.position.clone().sub(t); dir.y = 0; if (dir.lengthSq() < .01) dir.set(0, 0, 1); dir.normalize();
  const dist = isMobile() ? 8.5 : 7.5, el = .5;
  const pos = t.clone().addScaledVector(dir, dist * Math.cos(el)); pos.y = t.y + dist * Math.sin(el);
  CAM.controls.minDistance = 5; S.catZoom = true;
  CAM.flight({ t, p: pos }, 1100, 1.2);
}
function unfocusCat() {
  if (!S.catZoom || !CAM) return; S.catZoom = false;
  const t = CAM.controls.target.clone(), d = W.camera.position.distanceTo(t);
  CAM.limits();
  if (d < CAM.controls.minDistance && !S.walking) CAM.flight({ t, p: t.clone().add(W.camera.position.clone().sub(t).normalize().multiplyScalar(CAM.controls.minDistance + 2)) }, 700, 0);
}
function renderCatBubble() {
  const B = S.bubble, c = B.o.cat, d = c.data, el = $('#bubble');
  el.innerHTML = `<p class="who catwho">${catFace(d, 34)}<span>${esc(d.name)} <span class="sample">${esc(d.coat)}</span></span></p><p class="where">${esc(islandById(d.island).name)}・${esc(d.personality)}</p>
    <p class="say" id="catSay">${esc(B.msg || '')}</p>
    <div class="mood"><span>開心值</span><span class="hearts" id="catMood"></span><span class="moodtip" id="catTip"></span></div>
    <div class="seats" id="catSeats" aria-live="polite"></div>
    <div class="acts"><button type="button" class="pri" data-b="pet" id="petBtn">🖐 擼貓</button><button type="button" data-b="leave" id="leaveBtn" hidden>放棄號碼</button><button type="button" data-b="talk" aria-label="聽牠說話">💬</button><button type="button" data-b="mute" id="catMute"></button><button type="button" data-b="x" aria-label="關閉">✕</button></div>
    <p class="hint">先抽號碼牌，叫到號碼再報到。一次最多 ${SEATS} 人一起擼，輪到你時也可以在貓身上輕輕滑動。要溫柔，不可以欺負牠喔。</p>`;
  el.querySelectorAll('[data-b]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation(); const k = b.dataset.b;
    if (k === 'x') closeBubble();
    else if (k === 'pet') petCat(c);
    else if (k === 'leave') { CR.giveUp(); setCatSay('號碼牌收回了，謝謝你讓給別人！想擼再抽一張就好。'); }
    else if (k === 'talk') { SND.unlock(); B.msg = d.lines[(B.line = (B.line + 1) % d.lines.length)]; $('#catSay').textContent = B.msg; if (c.state !== 'sleep') SND.meow(d.pitch, { len: .42, rise: 1.15, fall: .85 }); }
    else if (k === 'mute') setMuted(!S.muted);
  }));
  updateCatBubble();
}
function updateCatBubble() {
  const B = S.bubble; if (!B || !B.o.cat || !$('#petBtn')) return;
  const c = B.o.cat, cool = K.cooldown(c), m = K.moodOf(c), h = Math.min(5, Math.ceil(m - .05));
  const hearts = cool ? '' : '❤'.repeat(Math.max(0, h)) + '♡'.repeat(5 - Math.max(0, h));
  const mh = $('#catMood'); if (mh.textContent !== hearts) { mh.textContent = hearts; mh.setAttribute('aria-label', `開心值 ${Math.max(0, h)}/5`); }
  const tip = cool ? `${c.data.name}在休息，${cool} 秒後再來` : m > 5.2 ? '快摸夠了，輕輕的就好' : '';
  const tp = $('#catTip'); if (tp.textContent !== tip) tp.textContent = tip;
  const st = CR.status(c.data.id);
  let pt = '🖐 擼貓', dis = false, ring = false;
  if (st.rest) { pt = `😌 冷靜一下 ${st.rest} 秒`; dis = true; }
  else if (st.other) { pt = `🎫 你拿的是${(catData(st.other) || {}).name}的號碼`; dis = true; }
  else if (!st.has) pt = `🎫 抽號碼牌・${C.economy ? C.economy.prices.cat + ' 枚' : pad(st.nextT)}`;
  else if (!st.seated) { pt = `⏳ 等待叫號・前面 ${st.ahead} 位`; dis = true; }
  else if (st.called) { pt = `✋ 報到（${st.callLeft} 秒）`; ring = true; }
  else if (cool) { pt = `😾 貓在休息 ${cool}`; dis = true; }
  const pb = $('#petBtn'); pb.disabled = dis; pb.classList.toggle('ring', ring); if (pb.textContent !== pt) pb.textContent = pt;
  const lb = $('#leaveBtn'); lb.hidden = !st.has;
  renderSeats(st);
  const mb = $('#catMute'); const mt = S.muted ? '🔇' : '🔊'; if (mb.textContent !== mt) { mb.textContent = mt; mb.setAttribute('aria-label', S.muted ? '打開貓咪聲音' : '關閉貓咪聲音'); }
}
function setCatSay(t) { if (S.bubble && S.bubble.o.cat) { S.bubble.msg = t; const el = $('#catSay'); if (el) el.textContent = t; } }
function renderSeats(st) {
  const el = $('#catSeats'); if (!el) return;
  const who = (x) => `${esc(x.name)}${x.isMe ? '（你）' : ''}`;
  const seats = [];
  for (let i = 0; i < SEATS; i++) { const x = st.serving[i]; seats.push(x ? `<span class="seat on${x.isMe ? ' me' : ''}"><b>🎫${pad(x.t)}</b> ${who(x)}${x.ok ? '' : ' 🔔'}</span>` : '<span class="seat">空位</span>'); }
  const wait = st.waitingList.map((x) => `<span class="qp${x.isMe ? ' me' : ''}"><b>${pad(x.t)}</b> ${who(x)}</span>`);
  let mine = '';
  if (st.has) mine = st.called ? `<div class="mine call">🔔 叫號 <b>${pad(st.ticket)}</b>！請在 ${st.callLeft} 秒內報到</div>`
    : st.seated ? `<div class="mine">你的號碼 <b>${pad(st.ticket)}</b>・正在擼貓${st.turnLeft != null ? `・還可以擼 ${st.turnLeft} 秒` : ''}</div>`
    : `<div class="mine">你的號碼牌 <b>${pad(st.ticket)}</b>・前面還有 ${st.ahead} 位</div>`;
  const html = `<div class="board"><span class="lbl">現在叫號</span>${seats.join('')}</div>${wait.length ? `<div class="queue"><span class="lbl">等待中</span>${wait.join('')}</div>` : ''}${mine}`;
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
}
// 角落的號碼牌：去別的島逛也看得到，點一下飛回那隻貓
function renderTicketChip() {
  const el = $('#ticketChip'); if (!el) return;
  if (!CR.myCat) { el.hidden = true; return; }
  const st = CR.status(CR.myCat), d = catData(CR.myCat);
  const txt = st.called ? `🔔 ${d.name} ${pad(st.ticket)} 叫號了！報到 ${st.callLeft}s` : st.seated ? `🐾 正在擼${d.name}・${pad(st.ticket)}` : `🎫 ${d.name} ${pad(st.ticket)}・前面 ${st.ahead} 位`;
  el.hidden = false; el.classList.toggle('called', !!st.called);
  if (el.textContent !== txt) { el.textContent = txt; el.setAttribute('aria-label', `${txt}，點一下回到${d.name}身邊`); }
}
$('#ticketChip').addEventListener('click', () => { if (CR.myCat) goCat(CR.myCat); });
const BURST = 6, BURST_MS = 3000;     // 3 秒內摸 6 下以上＝太用力、在欺負貓
function petCat(c) {
  SND.unlock();
  const id = c.data.id, name = c.data.name;
  const st = CR.status(id);
  if (st.rest) { setCatSay(`先冷靜一下，${st.rest} 秒後才能再抽號碼牌喔。`); return null; }
  if (st.other) { setCatSay(`你手上已經有${(catData(st.other) || {}).name}的號碼牌了。一次只能拿一張，要先放棄那張才能抽這裡的。`); return null; }
  if (!st.has) {
    if (S.taking) return null;
    const E = C.economy, payWhy = WAL ? WAL.canPay(E.prices.cat, 'cat:' + id, E.limits.cat) : '';
    if (payWhy) { setCatSay(`🪙 ${payWhy}`); return null; }
    S.taking = true; setCatSay('🎫 取號中……');
    CR.take(id).then(() => {
      S.taking = false; const s2 = CR.status(id); if (!s2.has) { updateCatBubble(); return; }
      if (WAL) WAL.pay(E.prices.cat, 'cat', `擼${name}的號碼牌`, 'cat:' + id);
    if (s2.seated && s2.ok) setCatSay(`🎫 你抽到 ${pad(s2.ticket)} 號，馬上就輪到你！輕輕摸摸${name}吧。`);
    else if (s2.called) setCatSay(`🎫 你抽到 ${pad(s2.ticket)} 號，現在就輪到你了！按「✋ 報到」開始擼貓。`);
    else { setCatSay(`🎫 你抽到 ${pad(s2.ticket)} 號，前面還有 ${s2.ahead} 位。可以先去逛逛，叫號時會叮咚提醒你！`); toast(`🎫 號碼牌 ${pad(s2.ticket)}・前面 ${s2.ahead} 位`); }
      renderTicketChip(); updateCatBubble();
    }).catch(() => { S.taking = false; });
    return null;
  }
  if (!st.seated) { setCatSay(`還沒叫到你的號碼（${pad(st.ticket)}）喔，前面還有 ${st.ahead} 位。`); return null; }
  if (st.called) { CR.checkIn(); setCatSay(`✋ 報到成功！${pad(st.ticket)} 號，輪到你擼${name}了，要溫柔喔～`); renderTicketChip(); updateCatBubble(); return null; }
  // 不可以欺負貓：太快、太用力
  const now = performance.now();
  S.petTimes = (S.petTimes || []).filter((t) => now - t < BURST_MS); S.petTimes.push(now);
  if (S.petTimes.length >= BURST) {
    S.petTimes = [];
    if (now - (S.strikeAt || 0) < 20000) {
      S.strikeAt = 0;
      K.scare(c, SND); CR.sendPet(id, 'leave'); CR.penalize();
      setCatSay(`${name}被嚇跑了！擼貓要輕輕的，不可以欺負牠。請先休息 ${REST} 秒，把位置讓給排隊的人。`);
      toast('🙅 不可以欺負貓咪！'); updateCatBubble(); return null;
    }
    S.strikeAt = now;
    K.puff('puff', K.headOf({ cat: c }), 1, .2);
    setCatSay(`🙅 太快、太用力了！${name}耳朵往後縮了。輕輕摸，不可以欺負牠喔，再這樣牠會被嚇跑。`);
    toast('🙅 輕一點！不可以欺負貓咪'); return null;
  }
  const res = K.pet(c, SND);
  if (res.kind === 'react') CR.sendPet(id, res.id);
  if (res.kind === 'leave') CR.sendPet(id, 'leave');
  if (S.bubble && S.bubble.o.cat === c) {
    if (res.kind === 'react' || res.kind === 'leave') setCatSay(res.text);
    else if (res.kind === 'cool') setCatSay(`${name}還在休息，再等 ${res.left} 秒喔。`);
    updateCatBubble();
  }
  if (res.kind === 'react') markPetted(c.data);
  return res;
}
function markPetted(d) {
  if (S.petted.includes(d.id)) return;
  S.petted.push(d.id); store.set('cats', S.petted); renderHud();
  const tot = (C.cats || []).length;
  toast(`🐾 ${d.name} 收進貓咪圖鑑了！（${S.petted.length}/${tot}）`);
  $('#catBtn').classList.remove('bump'); void $('#catBtn').offsetWidth; $('#catBtn').classList.add('bump');
  if (S.petted.length === tot && WAL) { const g = WAL.bonusOnce('cats', C.economy.bonus.cats, '六隻貓都擼過'); if (g) setTimeout(() => toast(`🎁 貓咪圖鑑完成獎勵 ${g} 枚！`), 1800); }
  if (S.petted.length === tot && !store.get('catsDone', false)) { store.set('catsDone', true); setTimeout(showCatDone, 2600); }
}
function showCatDone() {
  const go = () => {
    $('#doneTitle').textContent = '🐾 六隻貓都擼過了！';
    $('#doneBody').innerHTML = `<div class="catparade">${(C.cats || []).map((d) => catFace(d, 52)).join('')}</div>
      <p style="margin:10px 0 0;line-height:1.7;font-weight:700">恭喜你成為「鯉魚市集貓咪好朋友」！<br>布丁、彩彩喵、博士、閃電、寶寶和鯉長，都記住你溫柔的手了。</p>
      <p class="foot">${esc(C.catsNote || '')}</p><button type="button" class="btn" data-close>喵～好耶！</button>`.replace('布丁、彩彩喵、博士、閃電、寶寶和鯉長', (C.cats || []).map((d) => d.name).join('、'));
    openDlg('#doneDlg');
  };
  if (!K) { go(); return; }
  closeBubble(); closePanel(false); if (S.walking) exitWalk(); else CAM.home();
  setTimeout(() => { K.celebrate(SND); toast('🎉 所有的貓一起跳起來慶祝！'); }, 1500);
  setTimeout(go, 4400);
}
// 從清單、面板、圖鑑按「擼貓」：飛過去找貓
function goCat(id) {
  if (!K) { petNo3D(id); return; }
  const c = K.byId(id); if (!c) return;
  if (S.walking) exitWalk(true);
  closePanel(false);
  openBubble(c.M.hit && { obj: c.M.hit, cat: c });
}
// 沒有 3D 時：用文字和聲音擼貓
function petNo3D(id) {
  const d = catData(id); if (!d) return;
  SND.unlock();
  const k = REACTION_IDS[Math.floor(Math.random() * REACTION_IDS.length)];
  playReaction(SND, k, d.pitch); toast(`${REACTIONS[k].icon} ${REACTIONS[k].text.replace('{n}', d.name)}`); markPetted(d);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  e.preventDefault(); const dlg = b.closest('dialog'); if (dlg && K) dlg.close();
  goCat(b.dataset.cat);
});
// 在貓身上來回滑動＝擼貓
let stroke = null, skipUp = false;
function strokeDown(e) {
  if (!K || !S.bubble || !S.bubble.o.cat || S.walking || S.intro || e.target !== $('#gl')) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, W.camera);
  const c = S.bubble.o.cat; if (!ray.intersectObject(c.M.hit, false)[0]) return;
  if (!CR.status(c.data.id).ok) return;   // 還沒輪到或還沒報到：照常旋轉鏡頭
  stroke = { id: e.pointerId, x: e.clientX, y: e.clientY, acc: 0, tot: 0, c };
  CAM.controls.enabled = false;
}
function strokeMove(e) {
  if (!stroke || e.pointerId !== stroke.id) return;
  const d = Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y); stroke.x = e.clientX; stroke.y = e.clientY;
  stroke.acc += d; stroke.tot += d;
  if (stroke.acc > 34) { stroke.acc = 0; stroke.n = (stroke.n || 0) + 1; K.puff(stroke.n % 3 ? 'heart' : 'paw', K.headOf({ cat: stroke.c }).add(new THREE.Vector3(0, -.4, 0)), 1, .5); if (stroke.n % 5 === 0) petCat(stroke.c); }
}
function strokeUp(e) {
  if (!stroke || e.pointerId !== stroke.id) return;
  const s = stroke; stroke = null; skipUp = true;
  CAM.controls.enabled = CAM.S.mode === 'orbit' && !CAM.S.busy;
  if (s.tot < 8) petCat(s.c);                       // 點一下也算摸一下
}

// ------------------------------------------------------------------ 🪙 線上鯉魚幣：錢包、打工、請客券、老師後台
const ONLINE = new Map();     // 在線上、有暱稱的人（請客券用）：uid → 暱稱
const ECO = () => C.economy;
const coinName = () => ECO().name || '線上鯉魚幣';
function walletChanged(why) {
  if (!WAL) return;
  const el = $('#coinCount'); if (el) el.textContent = WAL.bal();
  $('#coinBtn')?.classList.toggle('frozen', WAL.frozen);
  if (why === 'admin') { renderMe(); if (NET) NET.setMe(meProfile()); }
  if (why === 'inbox' && WAL.inbox.length && !$('#treatDlg').open) showTreat(WAL.inbox[0]);
  if ($('#walletDlg').open && why !== 'inbox') renderWallet();
}
function fmtT(t) { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function openWallet() { renderWallet(); openDlg('#walletDlg'); }
// 「加入市集」視窗裡的老師入口：還沒登入就帶去錢包的老師登入；已登入就顯示身分
function meTeacherLine() {
  const em = NET && NET.teacher && NET.teacher.email();
  if (em && WAL && WAL.admin) return `<p class="me-tch">🧑‍🏫 已用 ${esc(em)} 登入，可以選「老師」</p>`;
  if (em) return `<p class="me-tch">已用 ${esc(em)} 登入，但不在教師名冊上</p>`;
  return `<p class="me-tch">我是老師 → <button type="button" class="linkish" id="meTeacher">🧑‍🏫 老師登入</button></p>`;
}
function goTeacherLogin() {
  if ($('#meDlg').open) $('#meDlg').close();
  if (!WAL) { toast('老師登入需要連上線'); return; }
  openWallet();
  const box = $('#walletBody .tch-box'); if (!box) return;
  if (box.tagName === 'DETAILS') box.open = true;
  box.scrollIntoView({ block: 'center' });
  setTimeout(() => $('#tchEmail')?.focus(), 200);
}
document.addEventListener('click', (e) => { if (e.target.closest('#meTeacher')) { e.preventDefault(); goTeacherLogin(); } });
function renderWallet() {
  const E = ECO(), w = WAL.state(), P = E.prices;
  const mode = WAL.mode === 'school' ? '' : `<p class="wl-trial">🧪 體驗錢包：還沒連上線（或老師還沒開放），錢只存在這台裝置。</p>`;
  const jobs = JOBS ? JOBS.JOBS.map((j) => { const s = JOBS.status(j.id); return `<li class="wl-job"><span class="ic" aria-hidden="true">${j.icon}</span><div><b>${esc(j.name)}</b>・${esc(j.where)}　<span class="pay">+${j.pay}</span><br><small>${esc(j.desc)}</small>${s.ok ? '' : `<br><small class="why">${esc(s.why)}</small>`}</div><button type="button" class="btn ${s.ok ? '' : 'ghost'}" data-job="${j.id}" ${s.ok || s.doing ? '' : 'disabled'}>${s.doing ? '放棄' : '開始'}</button></li>`; }).join('') : '<li>打工需要 3D 畫面</li>';
  const prices = [['🐾', '擼貓（抽號碼牌）', P.cat, `每隻貓每天 ${E.limits.cat} 次`], ['⛵', '坐鯉魚號', P.boat, `每天 ${E.limits.boat} 次`], ['🦆', '坐鴨子船（腳踏）', P.duck, `每天 ${E.limits.duck} 次`], ['🚲', '借腳踏車', P.bike, `每天 ${E.limits.bike} 次`], ['🎢', '坐雲霄飛車', P.coaster, '不限次數'], ['🎈', '坐彩虹熱氣球', P.balloon, `每天 ${E.limits.balloon} 次`], ['🎮', '攤位線上小遊戲', P.game, `每款每天 ${E.limits.game} 局`]];
  const treatWhy = WAL.canTreat();
  const people = [...ONLINE.entries()].filter(([id]) => id !== WAL.uid);
  $('#walletBody').innerHTML = `${mode}
    <div class="wl-top"><div class="wl-bal"><span aria-hidden="true">🪙</span><b>${w.bal}</b><small>枚${esc(coinName())}</small></div>
      <div class="wl-meta">今天打工 ${w.earned}／${E.dailyJob}　錢包上限 ${E.cap}<br><small>每天固定發 ${E.start} 枚，當天結束歸零，隔天重新發。${WAL.frozen ? '<b class="why">錢包被老師暫停中</b>' : ''}</small></div></div>
    <p class="foot" style="margin:6px 0 10px">${esc(E.note)}</p>
    <h3 class="wl-h">💼 打工賺鯉魚幣</h3><p class="foot" style="margin:0 0 6px">完整打工清單和規則在 <button type="button" class="linkish" id="wlAgency">🏢 服務台・打工仲介</button></p><ul class="wl-jobs">${jobs}</ul>
    <h3 class="wl-h">🧾 價目表</h3><ul class="wl-price">${prices.map(([ic, n, p, lim]) => `<li><span aria-hidden="true">${ic}</span>${esc(n)}<b>${p} 枚</b><small>${esc(lim)}</small></li>`).join('')}<li><span aria-hidden="true">🆓</span>逛島、看攤位、集章、跟居民交換<b>免費</b><small>永遠免費</small></li></ul>
    <h3 class="wl-h">🎟️ 請客券</h3>${treatWhy ? `<p class="foot">${esc(treatWhy)}</p>` : people.length ? `<form id="treatForm" class="wl-treat"><label>請誰？<select id="treatTo">${people.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('')}</select></label><label>幾枚？<select id="treatAmt">${[5, 10, 15].filter((a) => a <= E.treatMax).map((a) => `<option>${a}</option>`).join('')}</select></label><button type="submit" class="btn">送出請客券</button></form><p class="foot">每天可以請 ${E.treatPerDay} 位同學，最多 ${E.treatMax} 枚。對方要按「收下」才算；對方不想要，錢會退回給你。</p>` : '<p class="foot">現在島上沒有其他有暱稱的人可以請客。</p>'}
    <h3 class="wl-h">📒 今天的紀錄</h3><ul class="wl-log">${(w.log || []).slice(0, 15).map((x) => `<li><small>${fmtT(x.t)}</small> ${esc(x.n)}<b class="${x.a < 0 ? 'neg' : 'pos'}">${x.a > 0 ? '+' : ''}${x.a}</b></li>`).join('') || '<li>還沒有紀錄</li>'}</ul>
    <div class="chal-btns"><button type="button" class="btn ghost" id="wlHelp">😟 有人逼我請客或給錢</button>${WAL.admin ? '<button type="button" class="btn" id="wlAdmin">🧑‍🏫 老師後台</button>' : ''}</div>
    ${teacherBoxHTML()}`;
  $('#walletBody').querySelectorAll('[data-job]').forEach((b) => (b.onclick = () => { const id = b.dataset.job; if (JOBS.active === id) JOBS.quit(); else if (JOBS.start(id)) $('#walletDlg').close(); renderWallet(); }));
  const tf = $('#treatForm'); if (tf) tf.onsubmit = async (e) => { e.preventDefault(); const to = $('#treatTo').value, a = +$('#treatAmt').value; const why = await WAL.sendTreat(to, ONLINE.get(to) || '同學', a); toast(why ? '🎟️ ' + why : `🎟️ 請客券送出去了：${a} 枚給 ${ONLINE.get(to)}`); renderWallet(); };
  $('#wlHelp').onclick = () => { if (WAL.report('有人逼我請客或給錢')) toast('已經告訴老師了，老師會來幫你 💪'); else toast('現在沒有連上線，請直接找老師'); };
  $('#wlAgency').onclick = () => goAgency();
  if ($('#wlAdmin')) $('#wlAdmin').onclick = () => { $('#walletDlg').close(); openAdmin(); };
  bindTeacherBox();
}
// 💼 服務台・打工仲介：列出所有打工、在哪裡、做什麼、賺多少、做完休息多久，可以直接接工作
function agencyHTML() {
  const E = ECO(), w = WAL ? WAL.state() : { earned: 0 }, left = Math.max(0, E.dailyJob - (w.earned || 0));
  const all = E.jobs.reduce((a, j) => a + j.pay, 0);
  const rows = E.jobs.map((j, i) => {
    const s = JOBS ? JOBS.status(j.id) : { ok: false, why: '打工需要 3D 畫面' };
    const tag = s.doing ? '<span class="ag-tag doing">做這份中</span>' : s.ok ? '<span class="ag-tag ok">可以接</span>' : `<span class="ag-tag no">${esc(s.why)}</span>`;
    return `<li class="ag-job"><span class="ag-no">${i + 1}</span><span class="ic" aria-hidden="true">${j.icon}</span>
      <div class="ag-main"><b>${esc(j.name)}</b><small>📍 ${esc(j.where)}</small><small>${esc(j.desc)}</small>
        <small class="ag-meta">做完休息 ${Math.round(j.cool / 60)} 分鐘・同時最多 3 人</small>${tag}</div>
      <div class="ag-side"><span class="ag-pay">+${j.pay}<small>枚</small></span>${JOBS ? `<button type="button" class="btn ${s.ok || s.doing ? '' : 'ghost'}" data-ag="${j.id}" ${s.ok || s.doing ? '' : 'disabled'}>${s.doing ? '放棄' : '接這份'}</button>` : ''}</div></li>`;
  }).join('');
  return `<p class="ag-hi">歡迎來到服務台打工仲介！做完工作就能賺${esc(coinName())}，拿去擼貓、坐船、坐熱氣球、玩小遊戲。</p>
    <div class="ag-sum"><div><b>${w.earned || 0}</b><small>今天已賺</small></div><div><b>${left}</b><small>今天還能賺</small></div><div><b>${E.dailyJob}</b><small>每天上限</small></div></div>
    <ol class="ag-list">${rows}</ol>
    <h3 class="wl-h">📋 打工規則</h3>
    <ol class="ag-rules"><li>一次只能做 1 份工作；做到一半可以按「放棄」，但拿不到錢。</li><li>每份工作做完要休息一下（上面寫的分鐘數）才能再接同一份。</li><li>每天打工最多賺 ${E.dailyJob} 枚（${E.jobs.length} 份全做一輪是 ${all} 枚），錢包最多放 ${E.cap} 枚。</li><li>同一份工作同時最多 3 個人做，滿了就先接別的。</li><li>打工賺的錢跟每天發的錢一樣，當天結束歸零。</li></ol>`;
}
function openAgency() {
  if (S.walking && !exitWalk(true)) return;
  closePanel(false); closePhotoBar();
  $('#agencyBody').innerHTML = agencyHTML();
  $('#agencyBody').querySelectorAll('[data-ag]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.ag;
    if (JOBS.active === id) { JOBS.quit(); $('#agencyBody').innerHTML = agencyHTML(); openAgency(); return; }
    if (JOBS.start(id)) $('#agencyDlg').close(); else openAgency();
  }));
  if (!$('#agencyDlg').open) openDlg('#agencyDlg');
}
// 鏡頭飛到服務台的打工仲介櫃台，再打開清單
function goAgency() {
  const P = IA && IA.agencyPos ? IA.agencyPos() : null;
  if (!P) { openAgency(); return; }
  if (S.walking && !exitWalk(true)) return;
  closePanel(false); closePhotoBar();
  if ($('#walletDlg').open) $('#walletDlg').close();
  const t = P.clone().setY(P.y + 1.2), dir = new THREE.Vector3(P.x, 0, P.z); if (dir.lengthSq() < .01) dir.set(0, 0, 1); dir.normalize();
  CAM.flight({ t, p: t.clone().addScaledVector(dir, 7).setY(P.y + 5) }, 1400, 2, () => openAgency());
}
// 收到請客券
function showTreat(item) {
  $('#treatBody').innerHTML = `<p style="margin:0 0 10px;font-size:16px;line-height:1.7"><b>${esc(item.fromName || '同學')}</b> 請你 <b>${item.a}</b> 枚${esc(coinName())}！</p>
    <div class="chal-btns"><button type="button" class="btn" data-t="ok">🙏 收下，謝謝</button><button type="button" class="btn ghost" data-t="no">不用了，退回</button></div>
    <p class="foot">不想要可以退回，不用不好意思。如果有人逼你、或用請客換條件，按這裡：<button type="button" class="linkish" data-t="report">告訴老師</button></p>`;
  openDlg('#treatDlg');
  $('#treatBody').querySelectorAll('[data-t]').forEach((b) => (b.onclick = async () => {
    const how = b.dataset.t; $('#treatDlg').close();
    const got = await WAL.answerTreat(item, how);
    toast(how === 'ok' ? `🎟️ 收下 ${got} 枚，記得跟 ${item.fromName || '同學'} 說謝謝` : how === 'report' ? '已經退回，也告訴老師了' : '已經退回請客券');
    setTimeout(() => { if (WAL.inbox.length && !$('#treatDlg').open) showTreat(WAL.inbox[0]); }, 400);
  }));
}
// 🧑‍🏫 老師登入：只開放「教師名冊」上的 email（寄登入連結到信箱，或用 Google 登入）
function teacherBoxHTML() {
  const T = NET && NET.teacher;
  if (!T) return '<p class="foot">老師登入需要連上線。</p>';
  const em = T.email();
  if (em) return `<div class="tch-box"><p>🧑‍🏫 已用 <b>${esc(em)}</b> 登入${WAL.admin ? '，是老師' : '。這個 email 不在教師名冊上，所以還是參觀者'}。</p><button type="button" class="btn ghost" id="tchOut">登出老師帳號</button></div>`;
  return `<details class="tch-box"><summary>🧑‍🏫 老師登入（只開放教師名冊上的 email）</summary>
    <form id="tchForm" class="wl-treat"><input id="tchEmail" type="email" class="pp-in" placeholder="老師的 email" autocomplete="email" required><button class="btn" type="submit">寄登入連結到信箱</button></form>
    <p class="foot">到信箱點連結，回到網站就登入了（任何 email 都可以）。Gmail 也可以直接 <button type="button" class="linkish" id="tchGoogle">用 Google 登入</button>。</p></details>`;
}
function bindTeacherBox() {
  const T = NET && NET.teacher; if (!T) return;
  if ($('#tchOut')) $('#tchOut').onclick = async () => { await T.logout().catch(() => {}); toast('已登出老師帳號'); setTimeout(() => location.reload(), 500); };
  if ($('#tchForm')) $('#tchForm').onsubmit = async (e) => { e.preventDefault(); const em = $('#tchEmail').value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('email 格式不對'); return; } try { await T.sendLink(em); toast(`📧 登入連結寄到 ${em} 了，請到信箱點連結（可能在垃圾郵件）`); } catch (err) { console.warn(err); toast('寄不出去：請確認 Firebase 已開啟「電子郵件連結」登入'); } };
  if ($('#tchGoogle')) $('#tchGoogle').onclick = async () => { try { await T.google(); toast('登入成功，重新整理中…'); setTimeout(() => location.reload(), 600); } catch (err) { console.warn(err); toast(err && err.code === 'auth/popup-closed-by-user' ? '已取消登入' : '登入失敗：請確認 Firebase 已開啟 Google 登入'); } };
}
// 老師後台：看每個人的錢包，加發、扣回、凍結；授權其他老師；看請客紀錄與求助
let adminOff = [];
function openAdmin() {
  if (!WAL.admin) { toast('只有老師可以打開'); return; }
  adminOff.forEach((f) => f && f()); adminOff = [];
  const D = { wallets: {}, frozen: {}, adminEmails: {}, treatLog: {}, reports: {} };
  const draw = () => renderAdmin(D);
  adminOff.push(WAL.watchAll((v) => { D.wallets = v; draw(); }));
  for (const k of ['frozen', 'adminEmails', 'treatLog', 'reports']) adminOff.push(WAL.watchPath(k, (v) => { D[k] = v; draw(); }));
  openDlg('#adminDlg'); draw();
}
$('#adminDlg').addEventListener('close', () => { adminOff.forEach((f) => f && f()); adminOff = []; });
function renderAdmin(D) {
  const E = ECO(), today = new Date((NET ? NET.now() : Date.now())).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const rows = Object.entries(D.wallets).map(([id, w]) => ({ id, ...w })).sort((a, b) => (b.day === today) - (a.day === today) || String(a.name).localeCompare(String(b.name)));
  const reps = Object.entries(D.reports).flatMap(([id, r]) => Object.values(r || {}).map((x) => ({ id, ...x }))).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 20);
  const tl = Object.values(D.treatLog).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 20);
  const stName = { sent: '待收下', ok: '已收下', no: '退回', report: '退回並告訴老師' };
  const keep = document.activeElement && document.activeElement.id;
  $('#adminBody').innerHTML = `<p class="foot" style="margin:0 0 8px">共 ${rows.length} 個錢包（今天有開的排前面）。「帳」不平代表錢包數字跟紀錄對不上，可能被改過。</p>
    ${reps.length ? `<h3 class="wl-h">😟 求助（${reps.length}）</h3><ul class="wl-log">${reps.map((r) => `<li><small>${r.t ? fmtT(r.t) : ''}</small> <b>${esc(r.name || '（沒暱稱）')}</b>：${esc(r.n)}</li>`).join('')}</ul>` : ''}
    <div class="ad-wrap"><table class="ad-tbl"><thead><tr><th>暱稱</th><th>餘額</th><th>今天打工</th><th>帳</th><th>操作</th></tr></thead><tbody>
    ${rows.map((w) => { const ok = (w.inT || 0) - (w.outT || 0) === w.bal; const fz = !!D.frozen[w.id]; const old = w.day !== today; return `<tr class="${old ? 'old' : ''}"><td>${esc(w.name || '（沒暱稱）')}${fz ? ' ⛔' : ''}<br><small>${old ? `上次 ${esc(w.day || '')}` : esc(w.role || '')}</small></td><td><b>${old ? '—' : w.bal}</b></td><td>${old ? '—' : `${w.earned || 0}/${E.dailyJob}`}</td><td>${old ? '' : ok ? '✓' : '<b class="why">不平</b>'}</td>
      <td class="ad-act"><button type="button" data-a="+10" data-u="${esc(w.id)}">+10</button><button type="button" data-a="-10" data-u="${esc(w.id)}">−10</button><button type="button" data-a="custom" data-u="${esc(w.id)}">…</button><button type="button" data-a="${fz ? 'unfreeze' : 'freeze'}" data-u="${esc(w.id)}">${fz ? '解凍' : '凍結'}</button></td></tr>`; }).join('') || '<tr><td colspan="5">還沒有人開錢包</td></tr>'}
    </tbody></table></div>
    <h3 class="wl-h">🧑‍🏫 教師名冊（${Object.keys(D.adminEmails).length} 位，用 email 登入）</h3>
    <ul class="wl-log">${Object.keys(D.adminEmails).sort().map((k) => `<li>${esc(k.replace(/,/g, '.'))}${WAL.email && k === WAL.email.toLowerCase().replace(/\./g, ',') ? '（你）' : `<button type="button" class="linkish" data-a="unadmin" data-u="${esc(k)}">移除</button>`}</li>`).join('') || '<li>還沒有</li>'}</ul>
    <form id="adForm" class="wl-treat"><textarea id="adEmails" class="pp-in" rows="3" placeholder="新增老師 email，一行一個（可以一次貼很多個）"></textarea><button class="btn" type="submit">加入名冊</button></form>
    <h3 class="wl-h">🎟️ 請客紀錄</h3><ul class="wl-log">${tl.map((x) => `<li><small>${x.t ? fmtT(x.t) : ''}</small> ${esc(x.fromName || '?')} → ${esc(x.toName || '?')}　${x.a} 枚・${esc(stName[x.st] || x.st || '')}</li>`).join('') || '<li>還沒有</li>'}</ul>`;
  $('#adminBody').querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
    const a = b.dataset.a, u = b.dataset.u, nm = (D.wallets[u] || {}).name || '這位';
    try {
      if (a === '+10' || a === '-10') { await WAL.grant(u, +a, a === '+10' ? '表現很棒' : '老師調整'); toast(`已${a === '+10' ? '加發' : '扣回'} 10 枚給 ${nm}`); }
      else if (a === 'custom') { const v = prompt(`給 ${nm} 加發（正數）或扣回（負數）幾枚？`, '5'); if (v == null || !Number.isFinite(+v) || +v === 0) return; const why = prompt('原因（會讓學生看到）', '') || ''; await WAL.grant(u, Math.round(+v), why); toast('已送出'); }
      else if (a === 'freeze' || a === 'unfreeze') { await WAL.freeze(u, a === 'freeze'); toast(a === 'freeze' ? `已凍結 ${nm} 的錢包` : `已解凍 ${nm} 的錢包`); }
      else if (a === 'unadmin') { const em = u.replace(/,/g, '.'); if (confirm(`確定把 ${em} 從教師名冊移除？`)) { await WAL.removeAdmin(u); toast(`已移除 ${em}`); } }
    } catch (e) { toast('沒有成功：請確認 Firebase 規則已更新'); }
  }));
  $('#adForm').onsubmit = async (e) => {
    e.preventDefault();
    const list = $('#adEmails').value.split(/[\s,;，、]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (!list.length) { toast('沒有看到正確的 email'); return; }
    try { for (const em of list) await WAL.addAdmin(em); toast(`已加入 ${list.length} 位老師`); $('#adEmails').value = ''; } catch (err) { toast('沒有成功：請確認 Firebase 規則已更新'); }
  };
  if (keep && $('#' + keep)) $('#' + keep).focus();
}
// 坐船、坐熱氣球：上去的那一刻付錢（同一趟只付一次）
const RIDE = { boat: false, balloon: false, duck: false };   // 腳踏車在借車時付錢（rentBike）
function rideCheck(kind) {
  if (!WAL || RIDE[kind]) return '';
  const E = ECO(); return WAL.canPay(E.prices[kind], kind, E.limits[kind]);
}
function rideTick() {
  if (!WAL || !W) return;
  const inDuck0 = S.walking && DUCK && DUCK.inBoat(CAM.walk.pos);
  const onBoat = !inDuck0 && S.walking && W.onBoat && W.onBoat(CAM.walk.pos.x, CAM.walk.pos.z), inBal = S.walking && BAL && BAL.inBasket(CAM.walk.pos), inDuck = S.walking && DUCK && DUCK.inBoat(CAM.walk.pos);
  for (const [kind, on, label] of [['boat', onBoat, '坐鯉魚號'], ['balloon', inBal, '坐彩虹熱氣球'], ['duck', inDuck, '坐鴨子船']]) {
    if (on && !RIDE[kind]) { RIDE[kind] = true; const E = ECO(); const why = WAL.pay(E.prices[kind], kind, label, kind); if (!why) toast(`🪙 ${label}，付 ${E.prices[kind]} 枚（剩 ${WAL.bal()}）`); }
    if (!on && RIDE[kind] && (kind !== 'duck' || DUCK.docked())) RIDE[kind] = false;   // 鴨子船：靠岸以後才算這一趟結束（船在動時一瞬間判定不在船上也不會再收一次）
  }
}
$('#coinBtn').addEventListener('click', () => { if (WAL) openWallet(); });
let TOUR = ['center', 'food', 'craft', 'puzzle', 'recycle', 'sport'];   // 開機後依 content.json 的島嶼順序重設
const DWELL = () => (S.reduced ? 8000 : 5000);
function startTour() {
  if (coasterLocked()) return;
  closePhotoBar();
  if (!W) return; closeBubble(); closePanel(false); if (S.walking && !exitWalk(true)) return;
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
  if (T.left <= 0) { if (T.i === TOUR.length - 1) { S.tourNatural = true; endTour(true); } else goStation(T.i + 1); }
}
function endTour(goHome) { if (!S.tour) return; const nat = !!S.tourNatural; S.tourNatural = false; if (JOBS) setTimeout(() => JOBS.onTourEnd(nat)); S.tour = null; $('#tour').hidden = true; $('#tourBtn').classList.remove('on'); if (goHome) CAM.home(); }
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
  if (S.coaster) { if (coasterLocked()) return; leaveCoaster(true); }   // 停站中要去別的地方：先下車
  if (!W) return; closePhotoBar(); if (S.mayorPick) endMayorPick(); closeBubble(); closePanel(false); if (S.tour) endTour(false);
  S.walking = true; document.body.classList.add('walking'); $('#walkui').hidden = false; $('#walkBtn').classList.add('on');
  // 已加入市集：從自己的人物所在位置出發，預設第三人稱看得到自己
  let mine = PL && PL.me() ? PL.spawnFor() : null;
  if (mine && W.ground(mine.pos.x, mine.pos.z) == null) { const g = W.nearestGround(mine.pos.x, mine.pos.z, 6); mine = g ? { pos: new THREE.Vector3(g.x, g.y, g.z), yaw: mine.yaw } : startSpot(); }   // 人物在海上（例如船開走了）就回到陸地
  CAM.walk.third = !!mine && store.get('view', 'third') === 'third'; $('#walkView').hidden = !mine; syncViewBtn();
  CAM.enterWalk(at && at.pos ? at : mine || startSpot()); const h = $('#walkHint'); h.classList.remove('fade'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.add('fade'), 4500);
  // 焦點不要停在「✕ 鳥瞰」按鈕上：不然空白鍵會變成按下它、跳回鳥瞰（Esc 一樣可以離開漫遊）
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
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
// 熱氣球在天上、自己在籃子裡：不能離開漫遊（不然人會留在半空中），降落後才可以
function stuckInAir() { return !!(BAL && S.walking && BAL.inBasket(CAM.walk.pos) && !BAL.docked()); }
function exitWalk(instant) {
  if (!S.walking) return true;
  if (coasterLocked()) return false;
  if (stuckInAir()) { const s = BAL.status(); toast(`🎈 熱氣球還在天上，不能下來喔！約 ${s.eta} 秒後降落，再從籃子的門走出來`); return false; }
  dismountBike(true);
  if (S.coaster) { leaveCoaster(true); const m0 = PL && PL.me(), e = COA.station.exit; if (m0) m0.pos.set(e.x, GH, e.z); }
  if (HM && HM.inRound() && ['hiding', 'seeking'].includes(HM.phase())) toast('躲貓貓進行中：鳥瞰看不到其他玩家，要找人或躲藏請回到地面漫遊'); S.walking = false; document.body.classList.remove('walking'); $('#walkui').hidden = true; $('#walkBtn').classList.remove('on');
  for (const k in CAM.walk.keys) CAM.walk.keys[k] = false; for (const k in CAM.walk.pad) CAM.walk.pad[k] = false;
  if (GM) GM.onExitWalk(); $('#fishUI').hidden = true;
  CAM.exitWalk(); if (instant) { CAM.setHome(true); CAM.S.busy = null; CAM.controls.enabled = true; }
  // 離開漫遊時人物若站在鯉魚號上或水面，放回最近的陸地（船開走後才不會留在海上）
  if (W) W.balloonRiding = false;   // 不在漫遊就不算在籃子裡（不然飛在島上空的籃子地板會蓋過島面）
  const m = PL && PL.me();
  // 飛行中離開漫遊：人放回熱氣球起降場門口（不會留在半空中）
  if (m && BAL && BAL.inBasket(m.pos) && !BAL.docked()) { W.balloonRiding = false; const g = BAL.landSpot(); m.pos.set(g.x, g.y, g.z); }
  // 鴨子船開出去時離開漫遊：人放回鴨子船碼頭的棧道
  if (W) W.duckRiding = false;
  if (m && DUCK && DUCK.inBoat(m.pos) && !DUCK.docked()) { const g = DUCK.landSpot(); m.pos.set(g.x, g.y, g.z); }
  if (m && (W.onBoat(m.pos.x, m.pos.z) || W.ground(m.pos.x, m.pos.z) == null)) {
    const P = W.pier, land = P ? P.E.clone().addScaledVector(P.d, P.ST0 - .4) : null;
    const g = land && W.ground(land.x, land.z) != null ? { x: land.x, y: W.ground(land.x, land.z), z: land.z } : W.nearestGround(m.pos.x, m.pos.z);
    if (g) m.pos.set(g.x, g.y, g.z);
  }
  return true;
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
const meProfile = () => { const p = store.get('me', null); return p && p.role === 'teacher' && !(WAL && WAL.admin) ? { ...p, role: 'visitor' } : p; };   // 只有老師名單上的帳號能當老師，其他人都是參觀者
function renderMe() {
  const p = meProfile(), R = p && ROLES[p.role];
  $('#meName').textContent = p ? p.name : '加入';
  $('#meBtn').setAttribute('aria-label', p ? `我的暱稱：${p.name}（${R ? R.label : ''}），點一下修改或離開` : '用暱稱加入市集');
  $('#meBtn').classList.toggle('on', !!p);
  if (PL) PL.setMe(p);
  if (NET) NET.setMe(p);
  if (p && STY) applyLook();
  if (PH) PH.refresh();
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
    <fieldset class="me-set"><legend class="pp-lab">身分</legend><div class="me-roles">${Object.entries(ROLES).filter(([k]) => k !== 'teacher' || (WAL && WAL.admin)).map(([k, r]) => `<label class="me-role" style="--rc:${r.color}"><input type="radio" name="role" value="${k}" ${k === role ? 'checked' : ''}><span>${r.icon} ${r.label}</span></label>`).join('')}</div>${meTeacherLine()}</fieldset>
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
    const next = { id: p.id || `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name, role: (f.get('role') === 'teacher' && !(WAL && WAL.admin) ? 'visitor' : f.get('role')) || 'student', shirt: f.get('shirt') || shirt, hat: f.get('hat') || 'none', joinedAt: p.joinedAt || new Date().toISOString() };
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
  const go = t.closest('[data-plan-go]'); if (go) { $('#planDlg').close(); const st = stallByNo(+go.dataset.planGo); if (S.walking && !exitWalk(true)) return; openIsland(st.island, { no: st.no }); return; }
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
  import('./net.js?v=20261124v').then(({ createNet }) => {
    NET = createNet(M.firebase, {
      myPos: () => PL.myPos(), upsert: (id, info, pos) => { ONLINE.set(id, String(info.name || '').slice(0, 16)); PL.upsert(id, info, pos); }, remove: (id) => { ONLINE.delete(id); PL.remove(id); },
      onCount: (c) => { COUNT = c; const el = $('#onlineChip'); el.hidden = false; $('#onlineCount').textContent = c.players; el.setAttribute('aria-label', `市集島上 ${c.players} 人，開著網站 ${c.viewers} 人，點一下看各身分人數`); },
      onTeacher: (k, code) => { if (k === 'in') { toast('🧑‍🏫 老師登入成功，重新整理中…'); setTimeout(() => location.reload(), 700); } else if (!(NET && NET.teacher && NET.teacher.email())) toast(code === 'auth/invalid-action-code' || code === 'auth/expired-action-code' ? '這個登入連結已經用過或過期了，請在 🪙 錢包的「老師登入」重新寄一次' : `老師登入沒有成功（${code || '未知原因'}），請重新寄一次`); },
      onFx: (all, myUid) => applyFx(all, myUid),
      onStatus: (s, msg) => { if (s === 'online' && PH) PH.refresh(); $('#onlineChip').classList.toggle('off', s !== 'online'); if (s === 'error') console.warn('連線錯誤', msg); },
    });
    NET.setMe(meProfile());
    if (S.bike) NET.setFx({ ride: S.bike });
    if (STY && meProfile()) applyLook();
    CR.attach(NET, meProfile);   // 擼貓號碼牌改用多人連線
    if (WAL) WAL.attach(NET, meProfile);   // 線上鯉魚幣錢包
    if (JOBS) JOBS.attach(NET);
    watchLamps();
    startPhone();
    import('./hidemp.js?v=20261124v').then(({ createHideMP }) => {
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
  if (spaceJumps(e)) { e.preventDefault(); if (!e.repeat) doJump(); }   // 空白鍵跳躍
  if (S.walking && e.code === 'KeyG' && !e.repeat) doDance();          // G：閃身步
});
// 漫遊時空白鍵一律是跳：只有焦點在打開的視窗、面板、設定裡（使用者正在操作那裡）才照一般按鈕的行為
function spaceJumps(e) {
  if (!S.walking || e.code !== 'Space') return false;
  const t = e.target;
  if (t && t.closest && t.closest('dialog[open], #settings, #panel, #bubble, select, summary')) return false;
  return true;
}
addEventListener('keyup', (e) => { if (spaceJumps(e)) e.preventDefault(); if (CAM) { CAM.walk.keys[e.code] = false; if (e.key === 'Shift') CAM.walk.crouch = false; } });
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
  if (S.mayorPick) { endMayorPick(); return; }                              // 市長任務選位置中：Esc 取消
  if (S.bubble) { closeBubble(); return; }
  if (S.walking && S.open) { closePanel(false); return; }        // 漫遊中先關攤位介紹，再按一次才回鳥瞰
  if (S.walking) { exitWalk(); return; }
  if (S.tour) { endTour(true); return; }
  if (!$('#settings').hidden) { toggleSettings(false); $('#setBtn').focus(); return; }
  if (S.open) closePanel(true);
});
$('#homeBtn').addEventListener('click', () => { closeBubble(); closePanel(false); if (S.walking) { exitWalk(); return; } if (S.tour) endTour(false); CAM && CAM.home(); });

// ------------------------------------------------------------------ 畫質
function setQuality(q, auto) {
  S.quality = q; S.qualityAuto = !!auto; store.set('quality', q); syncSettings();
  if (!W) return;
  const R = W.renderer, low = q === 'low';
  if (!low && !R.shadowMap.enabled) {
    // 一開始就是低畫質（沒建陰影），切回高畫質才需要重新編譯材質
    R.shadowMap.enabled = true;
    W.scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); } });
  }
  // 低畫質：不重新編譯材質（以前一次重編全部材質，剛好在手機最吃力時卡死）。
  // 改成只讓島、橋、攤位這些不會動的東西留下影子，影子圖畫一次就凍結，不再每格重畫
  if (R.shadowMap.enabled) {
    if (low) {
      shadowKeep = new Set(); const keepRoots = [...Object.values(W.islands).map((I) => I.group), ...SG.signs.map((s) => s.g)];
      for (const r of keepRoots) r && r.traverse((o) => shadowKeep.add(o));
      for (const k of SG.signs.flatMap((s) => s.g.children)) if (k.isGroup && k.children.some((c) => c.isGroup)) k.traverse((o) => shadowKeep.delete(o));   // 攤主會動
      shadowOff = []; W.scene.traverse((o) => { if (o.isMesh && o.castShadow && !shadowKeep.has(o)) { o.castShadow = false; shadowOff.push(o); } });
      R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = true; shadowHour = S.hourShown;
    } else {
      for (const o of shadowOff) o.castShadow = true; shadowOff = [];
      R.shadowMap.autoUpdate = true;
    }
  }
  if (FA && FA.root) FA.root.visible = !low;                       // 低畫質收起蝴蝶、小鳥和昆蟲
  for (const a of L.agents) a.lowHidden = low && a.nightHide;
  R.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : (isLite() ? 1.5 : 2)));
  toast(auto ? '畫面有點卡，已自動切換成低畫質' : low ? '已切換成低畫質（減少影子、人物和小動物）' : '已切換成高畫質');
}
let shadowOff = [], shadowKeep = null, shadowHour = 0;

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
  if (/[?&]fakedb\b/.test(location.search)) setTimeout(() => startPhone(), 1500);   // 測試：兩個分頁用假資料庫互打電話
  if (/[?&]debug\b/.test(location.search)) window.__dbg = { get W() { return W; }, get CAM() { return CAM; }, get PL() { return PL; }, S, get BK() { return BK; } };   // 測試用（網址加 ?debug 才有）
  bindPhotoBar();
  $('#brandMascot').innerHTML = MASCOT;
  C = await fetch('data/content.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  TOUR = ['center', ...C.islands.map((i) => i.id)]; PP.data = ppRead();
  if (C.economy) { WAL = createWallet({ cfg: C.economy, toast, onChange: walletChanged }); $('#coinBtn').hidden = false; walletChanged(); }   // 讀護照時順便完成名冊改版轉換
  buildSettings(); renderHud();
  if (route().errs.length) { console.warn('路線設定錯誤', route().errs); setTimeout(() => toast(`⚠ 路線設定錯誤 ${route().errs.length} 項：${route().errs[0]}（詳見護照頁）`), 1200); }
  S.autoStart = performance.now();
  S.hour = S.hourShown = targetHour(performance.now());
  renderMe(); renderPlanChip(); renderNotice();
  if (Q.has('nogl') || !webglOK()) { textOnly(Q.has('nogl') ? '已切換為文字清單版' : '這台裝置無法顯示 3D 畫面'); applyTheme(); updateClock(); setInterval(updateClock, 10000); window.__ready = true; return; }
  let mods;
  try {
    mods = await Promise.all([import('./world.js?v=20261124v'), import('./life.js?v=20261124v'), import('./cam.js?v=20261124v'), import('./players.js?v=20261124v'), import('./signs.js?v=20261124v'), import('./festival.js?v=20261124v'), import('./fauna.js?v=20261124v'), import('./interact.js?v=20261124v'), import('./games.js?v=20261124v')]);
    const [{ createWorld, H: GROUND_H }, { createLife, makePerson }, { createCam }, { createPlayers }, { createSigns }, { createFestival }, { createFauna }, { createInteract }, { createGames, FISH }] = mods;
    GH = GROUND_H;
    const mobile = isLite();   // 手機和平板都用輕量版場景
    W = createWorld($('#gl'), { quality: S.quality, mobile });
    W.renderer.setPixelRatio(Math.min(devicePixelRatio, S.quality === 'low' ? 1 : (mobile ? 1.5 : 2)));
    L = createLife(W, C, { halfPeople: mobile || S.quality === 'low', quality: S.quality });
    try { const { createCats } = await import('./cats.js?v=20261124v'); K = createCats(W, C, { reduced: () => S.reduced }); } catch (e) { console.warn('島上的貓載入失敗', e); K = null; }
    CAM = createCam(W, $('#gl'), { onZoom: showZoom, onIntro: (k) => { L.setDeck(k < .3 ? 1 : Math.max(0, 1 - (k - .3) / .25)); if (k > .55) $('.intro-title').classList.add('show'); } });
    CAM.S.reduced = S.reduced; CAM.S.mobile = isMobile();
    PL = createPlayers(W, GROUND_H); renderMe(); startNet();
    W.canBoard = canBoardWalk;
    // 搭船中：只有靠港、跳板放下時才能走出船艙
    W.canLeave = () => { const s = L.carp.status(); if (s.docked && s.gang) return true; if (performance.now() - lastBlockToast > 3000) { lastBlockToast = performance.now(); toast('⛔ 航行中請待在船上，靠港放下跳板後再下船'); } return false; };
    // 彩虹熱氣球：起降場在服務台北側廣場；用網路時間排班，大家看到同一顆
    try {
      const { createBalloon } = await import('./balloon.js?v=20261124v');
      BAL = createBalloon(W, { pad: { x: 1, z: -5 }, now: () => (NET ? NET.now() : Date.now()), low: mobile || S.quality === 'low' });
      W.balloon = BAL; W.gates = [balloonGate];
    } catch (e) { console.warn('熱氣球載入失敗', e); BAL = null; }
    // 🦆 鴨子船：停在益智島南側的棧道；一樣用網路時間排班
    try {
      const { createDuckBoat } = await import('./duckboat.js?v=20261124v');
      DUCK = createDuckBoat(W, { island: 'puzzle', now: () => (NET ? NET.now() : Date.now()), low: mobile || S.quality === 'low' });
      W.duck = DUCK; W.gates = [...(W.gates || []), duckGate];
    } catch (e) { console.warn('鴨子船載入失敗', e); DUCK = null; }
    // 🎢 雲霄飛車：軌道支柱的位置先保留（裝飾不會擺在那裡）
    try {
      const { createCoaster } = await import('./coaster.js?v=20261124v');
      COA = createCoaster(W, { now: () => (NET ? NET.now() : Date.now()), low: mobile || S.quality === 'low' });
      W.coaster = COA; W.coasterMe = () => (S.coaster ? COA.seatPose(S.coaster.seat) : null);
    } catch (e) { console.warn('雲霄飛車載入失敗', e); COA = null; }
    // 🏛️ 市長任務：路燈候選位置先保留（裝飾不會擺在那裡）
    try { const { createMayor } = await import('./mayor.js?v=20261124v'); MY = createMayor(W, { low: mobile || S.quality === 'low' }); } catch (e) { console.warn('市長任務載入失敗', e); MY = null; }
    KIT = await import('./kit.js?v=20261124v');
    SG = createSigns(W, C, GROUND_H, { makePerson, rng: (await import('./kit.js?v=20261124v')).rng, low: mobile || S.quality === 'low' });
    FX = createFestival(W, C, GROUND_H, { makePerson, rng: (await import('./kit.js?v=20261124v')).rng, low: mobile || S.quality === 'low', avoid: [...(BAL ? BAL.avoid : []), ...(DUCK ? DUCK.avoid : []), ...(MY ? MY.avoid : []), ...(COA ? COA.avoid : []), ...SG.signs.map((s) => s.g.position), ...Object.values(W.islands).flatMap((I) => (I.trees || []).filter((tr) => tr.visible).map((tr) => tr.position.clone().add(I.pos)))], carp: L.carp });
    // 🚲 借車點與環島自行車道（車架放在服務台島的空地；車道沿著原本的石板環路）
    try {
      BIKE_MOD = await import('./bike.js?v=20261124v');
      const rs = FX.freeSpot('center', 1.3, 1.7);
      BK = BIKE_MOD.createBikes(W, { spot: rs ? { x: rs.x, z: rs.z, face: rs.face } : null, islandName: (id) => (islandById(id) || {}).name || id, low: mobile || S.quality === 'low' });
      W.gates = [...(W.gates || []), bikeGate];
    } catch (e) { console.warn('腳踏車載入失敗', e); BK = null; }
    if (MY) { const ms = FX.freeSpot('center', .9, 1.2); MY.placeBoard(ms ? { x: ms.x, z: ms.z, face: ms.face } : null); MY.setLamps(lampState()); }
    // 👕 服飾店（服務台島的小攤子）
    try {
      STY = await import('./style.js?v=20261124v');
      const ss = FX.freeSpot('center', 1.1, 1.5);
      SHOP = STY.createShop(W, { spot: ss ? { x: ss.x, z: ss.z, face: ss.face } : null, low: mobile || S.quality === 'low' });
      applyLook();
    } catch (e) { console.warn('服飾店載入失敗', e); SHOP = null; }
    // 貓住在自己島上最空曠的地方，不被攤位和裝飾擋住
    if (K) K.setHomes((id) => {
      const I = W.islands[id]; if (!I || !I.walk) return null;
      const avoid = [...(FX.avoid || []), ...(BAL ? BAL.avoid : []), ...(BK ? BK.avoid : []), ...(SHOP ? SHOP.avoid : []), ...SG.signs.map((s) => s.g.position)];
      let best = null;
      for (let i = 0; i < 500; i++) {
        const th = i * 2.39996, r = (.2 + .65 * ((i * .618) % 1)) * I.top(th), x = Math.cos(th) * r, z = Math.sin(th) * r;
        let cl = I.walk.clear(x, z); if (!(cl > .9)) continue;
        for (const v of avoid) cl = Math.min(cl, Math.hypot(I.pos.x + x - v.x, I.pos.z + z - v.z) - .6);
        if (!best || cl > best.cl) best = { x: I.pos.x + x, z: I.pos.z + z, cl };
      }
      return best;
    });
    FA = createFauna(W, { H: GROUND_H, rng: (await import('./kit.js?v=20261124v')).rng });
    IA = createInteract(W, C, GROUND_H, {
      toast, carp: L.carp,
      toastIf: (m) => { if (!S.intro) toast(m); },
      toastNear: (I, m) => { if (W.camera.position.distanceTo(I.pos) < 22) toast(m); },
      openStalls: (id) => openIsland(id),
      openStall: (no) => { const st = stallByNo(no); if (st) { if (S.walking && !exitWalk(true)) return; openIsland(st.island, { no }); } },
      stallPos: (no) => SG.signs.find((s) => s.st.no === no),
      photoSpot, jobAgency: () => openAgency(), freeSpot: (id) => FX.freeSpot(id, .7, 1.0),
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
    if (WAL) JOBS = createJobs({
      C, W, K, wallet: WAL, toast, esc, THREE, onChange: () => walletChanged(),
      islandName: (id) => (islandById(id) || {}).name || id,
      openIsland: (id) => { if (S.walking && !exitWalk(true)) return; openIsland(id); },
      startTour: () => startTour(),
      flyTo: (p) => { if (S.walking) exitWalk(true); closePanel(false); const t = p.clone().setY(p.y + 1); const d = W.camera.position.clone().sub(t).setY(0).normalize(); CAM.flight({ t, p: t.clone().addScaledVector(d, 14).setY(t.y + 9) }, 1200, 2); },
      catFace, catPurr: (c) => { if (K) K.remote(c, 'purr', SND); },
      agencyPos: () => (IA && IA.agencyPos ? IA.agencyPos() : null),
    });
    if (JOBS && NET) JOBS.attach(NET);
  } catch (err) { console.warn(err); textOnly('3D 畫面載入失敗'); window.__ready = true; return; }
  if (S.quality === 'low') setQuality('low');
  buildTags();
  const resize = () => { W.resize(innerWidth, innerHeight); CAM.S.mobile = isMobile(); CAM.limits(); if (!S.open && !S.tour && !S.walking && !CAM.S.busy) CAM.setHome(true); };
  addEventListener('resize', resize); resize();
  W.setHour(S.hourShown); applyTheme(); updateClock(); setInterval(updateClock, 10000);
  const cv = $('#gl');
  cv.addEventListener('pointerdown', onCanvasDown); cv.addEventListener('pointerup', onCanvasUp);
  $('#stage').addEventListener('pointerdown', strokeDown, true);   // 比鏡頭旋轉先接到：在貓身上滑動＝擼貓
  addEventListener('pointermove', strokeMove); addEventListener('pointerup', strokeUp, true); addEventListener('pointercancel', strokeUp, true);
  cv.addEventListener('wheel', () => { if (S.tour && !S.tour.paused) pauseTour(true); }, { passive: true });
  // 在島名標籤上滾動滑鼠，也能縮放 3D 畫面
  $('#labels').addEventListener('wheel', (e) => { e.preventDefault(); cv.dispatchEvent(new WheelEvent('wheel', e)); }, { passive: false });
  CAM.controls.addEventListener('start', () => { if (S.tour && !S.tour.paused) pauseTour(true); });
  if (Q.has('h')) { S.timeMode = 'fixed'; FIXED_H.fixed = +Q.get('h'); S.hour = S.hourShown = +Q.get('h'); W.setHour(S.hourShown); applyTheme(); }

  // 動畫迴圈：分頁看不到時瀏覽器會自動暫停
  const clock = new THREE.Clock(); let clkN = 0, fpsT = 0, fpsN = 0, slow = 0; const keepQ = Q.has('keepq');
  // 3D 畫面被系統收回（iPad／手機切去別的 App、記憶體不夠時會發生）：等它恢復，太久沒恢復就請使用者重新載入
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); S.glLost = performance.now(); setTimeout(checkGL, 4000); });
  cv.addEventListener('webglcontextrestored', () => { S.glLost = 0; glNote(false); if (W.renderer.shadowMap.enabled) W.renderer.shadowMap.needsUpdate = true; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(checkGL, 1500); });
  function checkGL() {
    let lost = !!S.glLost; try { lost = lost || W.renderer.getContext().isContextLost(); } catch (e) { /* 拿不到就當作還在 */ }
    if (lost) glNote(true);
  }
  function glNote(show) {
    let n = $('#glNote');
    if (!show) { if (n) n.remove(); return; }
    if (n) return;
    n = document.createElement('div'); n.id = 'glNote'; n.setAttribute('role', 'alert');
    n.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;background:#fff;color:#222;padding:18px 20px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);text-align:center;max-width:300px;font-size:15px;line-height:1.5';
    n.innerHTML = '3D 畫面被系統暫時收回了（通常是切換 App 或記憶體不夠）<br><button type="button" style="margin-top:12px;padding:10px 18px;border-radius:999px;border:0;background:#3f7d3a;color:#fff;font-size:15px;font-weight:700">🔄 重新載入</button>';
    n.querySelector('button').addEventListener('click', () => location.reload());
    document.body.append(n);
  }
  let errN = 0, lastErr = '';
  const gameDlg = $('#gameDlg');
  function frame(now) {
    requestAnimationFrame(frame);   // 先排下一格：就算這一格出錯，畫面也不會整個停住
    if (S.glLost) return;
    // 全螢幕小遊戲打開時，後面的島看不到，不用畫（省下一半以上的負擔，特別是 3D 小遊戲）
    if (gameDlg && gameDlg.open) { clock.getDelta(); try { if (NET) NET.tick(now); } catch (e) { /* 連線問題不影響畫面 */ } return; }
    try { frameBody(now); errN = 0; } catch (err) {
      errN++;
      if (String(err) !== lastErr) { lastErr = String(err); console.warn('畫面更新出錯（已略過這一格）', err); }
      if (errN === 120) toast('畫面有點問題，如果一直卡住請重新整理');
    }
  }
  function frameBody(now) {
    const dt = Math.min(clock.getDelta(), .1), t = clock.elapsedTime, moving = !S.reduced;   // dt 上限：切回來時不會一次跳一大段
    // 時段：平滑過渡（減少動態時直接切換）
    const target = targetHour(now);
    let d = target - S.hourShown; if (d > 12) d -= 24; if (d < -12) d += 24;
    S.hourShown = S.reduced || Math.abs(d) < .01 ? target : (S.hourShown + d * Math.min(1, dt * 1.6) + 24) % 24;
    W.setHour(S.hourShown); applyTheme();
    if ((clkN = (clkN + 1) % 30) === 0) updateClock();
    if (BAL) BAL.update(t, dt, moving);
    if (DUCK) DUCK.update(t, dt, moving);
    if (MY) MY.update(t, dt, W.state.n);
    if (COA) { COA.update(); coasterTick(); }
    CAM.update(dt);
    rideTick();                 // 人跟著船／熱氣球移動之後再判斷有沒有在上面
    W.update(t, moving);
    L.update(t, dt, moving, W.state.n, W.camera);
    if (K) K.update(t, dt, moving, W.state.n, W.camera);
    if ((clkN % 10) === 0) { if (S.bubble && S.bubble.o.cat) updateCatBubble(); renderTicketChip(); }
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
    if (S.coaster && S.coaster.wantShot) takeCoasterPhoto();
    if (!S.walking) placeTags();
    refreshBoatPanel(now);
    if (BAL) { refreshBalloonPanel(now); balloonHints(); }
    if (DUCK) { refreshDuckPanel(now); duckHints(); }
    if (COA) refreshCoasterPanel(now);
    placeBubble();
    // 效能：FPS 連續偏低就自動降級
    fpsN++; fpsT += dt;
    if (fpsT > 3) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (!keepQ && S.quality !== 'low' && t > 8) { slow = fps < 24 ? slow + 1 : 0; if (slow >= 2) setQuality('low', true); } }
    if (!window.__ready && t > .2) window.__ready = true;
    // 低畫質時影子圖是凍結的：太陽角度變了才重畫一次
    if (shadowOff.length && Math.abs(S.hourShown - shadowHour) > .1) { shadowHour = S.hourShown; W.renderer.shadowMap.needsUpdate = true; }
  }
  requestAnimationFrame(frame);
  window.__isle = { W, L, CAM, S, THREE, get K() { return K; }, CR, SND, get WAL() { return WAL; }, get JOBS() { return JOBS; }, get PL() { return PL; }, get NET() { return NET; }, get SG() { return SG; }, get FX() { return FX; }, get FA() { return FA; }, get IA() { return IA; }, get GM() { return GM; }, get BAL() { return BAL; } };   // 給自動測試讀取狀態用
  await playIntro(false);
  const deep = Q.get('island') || location.hash.slice(1), lk = Q.get('stall') ? resolveStallLink(Q.get('stall'), Q.get('roster')) : null, dst = lk && lk.st;
  if (lk && lk.msg && dst) S.legacyNote = { no: dst.no, msg: lk.msg };   // 舊攤號連結：說明寫在攤位卡上（蓋章提示不會蓋掉它）
  else if (lk && lk.msg) toast(lk.msg);
  if (dst) openIsland(dst.island, { no: dst.no });
  else if (deep && islandById(deep)) openIsland(deep);
}
boot().catch((err) => { console.error(err); $('#toast').textContent = '網站資料載入失敗，請重新整理頁面。'; $('#toast').classList.add('show'); window.__ready = true; });
