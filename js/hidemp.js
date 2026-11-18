// 🙈 多人躲貓貓（Firebase）：登入的人一起玩，1 人當鬼，其他人躲
// 資料在 market/hide：{ host, createdAt, startAt, seeker, players: { uid: { name, role, caught } } }
// 階段由時間決定（每台裝置算出來都一樣）：大廳 → 躲藏 60 秒 → 找人 180 秒 → 結束
const MAX = 8, HIDE_S = 60, SEEK_S = 180, CATCH_R = 1.5;

export function createHideMP(NET, api) {
  const { ref, set, update, remove, onValue } = NET.fb, db = NET.db;
  const R = ref(db, 'market/hide');
  let round = null, joinedId = null, lastPhase = '', ended = false;
  const now = () => NET.now();
  const me = () => NET.uid();

  function phase(r = round) {
    if (!r) return 'none';
    if (!r.startAt) return now() - (r.createdAt || 0) > 10 * 60e3 ? 'stale' : 'lobby';
    const t = (now() - r.startAt) / 1000, ps = Object.values(r.players || {});
    const hiders = ps.filter((p, i) => Object.keys(r.players)[i] !== r.seeker);
    if (t < HIDE_S) return 'hiding';
    if (hiders.length && hiders.every((h) => h.caught)) return 'over';
    if (t < HIDE_S + SEEK_S) return 'seeking';
    return t > HIDE_S + SEEK_S + 60 ? 'stale' : 'over';
  }
  const players = () => Object.entries((round && round.players) || {});
  const inRound = () => !!(round && round.players && round.players[me()]);
  const isSeeker = () => !!(round && round.seeker === me());

  onValue(R, (s) => { round = s.val(); api.onLobby && api.onLobby(); tick(); }, (e) => console.warn('躲貓貓連線錯誤', e.code));

  // ---------------- 大廳
  async function open() {
    const prof = api.profile(); if (!prof) { api.toast('多人躲貓貓要先按右下角「👤 加入」取暱稱'); return false; }
    const ph = phase();
    if (ph === 'none' || ph === 'stale') await set(R, { host: me(), createdAt: now(), startAt: 0, seeker: '', players: { [me()]: { name: prof.name, role: prof.role, caught: false } } }).catch(err);
    else if (ph === 'lobby' && !inRound()) {
      if (players().length >= MAX) { api.toast(`這一局已經 ${MAX} 人了，等下一局吧`); return false; }
      await set(ref(db, `market/hide/players/${me()}`), { name: prof.name, role: prof.role, caught: false }).catch(err);
    } else if (ph !== 'lobby' && !inRound()) { api.toast('有一局正在進行中，等這局結束再加入（大約 4 分鐘）'); return false; }
    return true;
  }
  const err = (e) => { console.warn(e); api.toast('連線失敗：請確認已經在 Firebase 貼上新的規則'); };
  function leave() { if (!round || !inRound()) return; if (phase() === 'lobby') { if (players().length <= 1) remove(R).catch(err); else remove(ref(db, `market/hide/players/${me()}`)).catch(err); } }
  function start() {
    if (!round || phase() !== 'lobby') return;
    const ids = players().map(([k]) => k); if (ids.length < 2) { api.toast('至少要 2 個人才能開始'); return; }
    update(R, { startAt: now(), seeker: ids[Math.floor(Math.random() * ids.length)] }).catch(err);
  }
  function lobbyHTML(esc) {
    const ph = phase(), ps = players();
    if (ph === 'none' || ph === 'stale') return '<p>現在沒有人開局。按「開一局」當主持人，等朋友加入。</p>';
    const list = `<ul class="mp-list">${ps.map(([k, p]) => `<li>${k === round.seeker ? '👹 ' : ''}${esc(p.name)}${k === me() ? '（我）' : ''}${p.caught ? '・被抓到' : ''}${k === round.host ? ' <small>主持人</small>' : ''}</li>`).join('')}</ul>`;
    if (ph === 'lobby') return `<p>等待中：${ps.length}／${MAX} 人（至少 2 人）</p>${list}`;
    return `<p>這一局正在進行中（${ph === 'hiding' ? '躲藏中' : ph === 'seeking' ? '找人中' : '已結束'}）</p>${list}`;
  }

  // ---------------- 遊戲中（每格呼叫）
  let lastCatchTry = 0;
  function tick() {
    const ph = phase();
    if (ph !== lastPhase) { onPhase(ph, lastPhase); lastPhase = ph; }
    // 躲貓貓進行中：所有參加者頭上的名字都藏起來（每台裝置都一樣，包括沒參加、在旁邊看的人）；只看得到自己的
    const playing = ph === 'hiding' || ph === 'seeking';
    for (const [k] of players()) api.hideTag(k, playing && k !== me());
    if (!inRound() || !['hiding', 'seeking', 'over'].includes(ph)) { api.hud(null); return; }
    const t = (now() - round.startAt) / 1000;
    const hiders = players().filter(([k]) => k !== round.seeker), left = hiders.filter(([, p]) => !p.caught);
    const sname = (round.players[round.seeker] || {}).name || '鬼';
    // 鬼的畫面：躲的人名牌都藏起來；鬼頭上掛「👹 鬼」
    for (const [k] of players()) api.badge(k, k === round.seeker ? '👹 鬼' : (round.players[k].caught ? '被抓到' : ''));
    if (ph === 'hiding') {
      const s = Math.ceil(HIDE_S - t);
      api.hud(isSeeker() ? [`👹 你是鬼！閉上眼睛數到 60…`, `還有 ${s} 秒開始找人`] : [`🙈 快躲起來！${sname} 是鬼`, `${s} 秒後開始找人（樹、攤子、灌木叢、稻草堆、木箱、木桶後面都能躲，按 Shift 蹲下更難被發現）`]);
      api.freeze(isSeeker());
    } else if (ph === 'seeking') {
      api.freeze(false);
      const s = Math.ceil(HIDE_S + SEEK_S - t), mm = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (isSeeker()) {
        const wp = api.walkPos(); let near = Infinity;
        for (const [k, p] of left) { const q = api.posOf(k); if (!q || !wp) continue; const d = Math.hypot(q.x - wp.x, q.z - wp.z); near = Math.min(near, d); if (d < CATCH_R && performance.now() - lastCatchTry > 600) { lastCatchTry = performance.now(); update(ref(db, `market/hide/players/${k}`), { caught: true }).then(() => api.toast(`👹 抓到 ${p.name} 了！`)).catch(err); } }
        const temp = !isFinite(near) ? '🧊 冰冰的' : near < 3 ? '🔥 熱燙燙！' : near < 7 ? '🌤️ 溫溫的' : near < 14 ? '❄️ 有點涼' : '🧊 冰冰的';
        api.hud([`👹 找人中　抓到 ${hiders.length - left.length}/${hiders.length}　⏱ ${mm}`, `${temp}　還沒抓到：${left.map(([, p]) => p.name).join('、') || '—'}`]);
      } else {
        const mine = round.players[me()];
        api.hud([`🙈 ${mine.caught ? '你被抓到了，幫忙看看大家躲哪裡吧' : '別被鬼抓到！'}　⏱ ${mm}`, `還沒被抓到：${left.length}/${hiders.length} 人`]);
      }
    } else if (ph === 'over') {
      api.freeze(false);
      const win = left.length === 0 ? 'seeker' : 'hiders';
      api.hud([win === 'seeker' ? `👹 ${sname}（鬼）贏了！全部抓到` : `🙈 躲的人贏了！還有 ${left.length} 人沒被抓到`, '這一局結束，大約 1 分鐘後可以再開新的一局']);
      if (!ended) { ended = true; const iWon = (win === 'seeker') === isSeeker(); api.toast(iWon ? '🏆 你們贏了！送你一塊餅乾🍪' : '下一局再加油！'); if (iWon) api.reward('cookie', 1); }
    }
  }
  function onPhase(ph, prev) {
    if (ph === 'hiding' && inRound()) { ended = false; api.enterWalk(); api.toast(isSeeker() ? '👹 你當鬼！先閉眼 60 秒，之後去找大家' : `🙈 開始！${(round.players[round.seeker] || {}).name} 是鬼，60 秒內快躲起來`); }
    if ((ph === 'none' || ph === 'stale' || ph === 'lobby') && prev && prev !== 'lobby') { api.freeze(false); api.hud(null); for (const [k] of players()) { api.badge(k, ''); api.hideTag(k, false); } }
    if (ph === 'stale' && round && round.host === me()) remove(R).catch(() => {});
  }
  setInterval(tick, 500);
  return { open, leave, start, lobbyHTML, phase, inRound, isHost: () => !!(round && round.host === me()), count: () => players().length, tick };
}
