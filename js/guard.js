// 🛡️ 擋掉「按右鍵」和「F12／開發者工具快速鍵」：讓玩家不容易打開程式碼亂改
// 注意：這只能擋住一般人順手亂按。瀏覽器的開發者工具沒辦法真的被網頁關掉（從瀏覽器選單一樣打得開），
// 真正擋作弊的是伺服器上的錢包規則（Firebase 規則）。
// 網址加 ?debug 時不擋（老師、開發者測試用）。
export function installGuard({ toast } = {}) {
  if (/[?&]debug\b/.test(location.search)) return;
  let warned = 0;
  const warn = () => { const now = Date.now(); if (toast && now - warned > 4000) { warned = now; toast('🛡️ 這個網站不能按右鍵或打開開發者工具喔'); } };
  const editable = (el) => el instanceof Element && !!el.closest('input, textarea, [contenteditable="true"]');

  // 右鍵選單：輸入框裡保留（才能貼上文字），其他地方都擋
  document.addEventListener('contextmenu', (e) => { if (editable(e.target)) return; e.preventDefault(); warn(); }, { capture: true });

  // 鍵盤：F12、Ctrl/⌘＋Shift＋I／J／C（開發者工具）、Ctrl/⌘＋U（看原始碼）、⌘＋Option＋I／J／C（Mac）
  document.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
    const dev = e.key === 'F12'
      || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k))
      || (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(k))
      || (mod && !e.shiftKey && k === 'u');
    if (dev) { e.preventDefault(); e.stopPropagation(); warn(); }
  }, { capture: true });

  // 圖片拖曳到別的分頁也擋（不然可以拖出去看）；照片要存請用「💾 存下來」按鈕
  document.addEventListener('dragstart', (e) => { if (e.target instanceof HTMLImageElement) e.preventDefault(); }, { capture: true });
}
