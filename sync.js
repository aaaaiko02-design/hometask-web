// ===== 端末間クラウド同期（Firebase Firestore） =====
//
// 「同期コード（合言葉）」を両方の端末で同じにすると、そのコードの
// データを Firestore 経由でリアルタイム共有します。バックエンド不要で
// GitHub Pages のまま動きます。設定は firebase-config.js を参照。

import { firebaseConfig, isConfigured } from './firebase-config.js';

const FB_APP = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
const FB_FS  = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CODE_KEY = 'hometask_sync_code_v1';

// Firestore の関数群（Firebase 読み込み後に格納される）
let doc, onSnapshot, setDoc, serverTimestamp;

// ---- DOM ----
const statusEl   = document.getElementById('sync-status');
const openBtn    = document.getElementById('sync-open-btn');
const sheet      = document.getElementById('sync-sheet');
const codeInput  = document.getElementById('sync-code-input');
const genBtn     = document.getElementById('sync-gen-btn');
const cancelBtn  = document.getElementById('sync-cancel');
const saveBtn    = document.getElementById('sync-save');
const offBtn     = document.getElementById('sync-off');

// ---- 状態 ----
let db          = null;
let unsubscribe = null;   // 現在の onSnapshot 解除関数
let currentCode = localStorage.getItem(CODE_KEY) || '';
let pushTimer   = null;
let lastPushed  = '';     // 直近に自分が送った内容（エコー抑制の補助）

// ================= 初期化 =================
if (!isConfigured()) {
  setStatus('未設定', '同期を使うには firebase-config.js の設定が必要です');
  openBtn && (openBtn.disabled = true);
} else {
  initFirebase();
}

async function initFirebase() {
  try {
    setStatus('読み込み中…', 'Firebaseを読み込んでいます');
    const [{ initializeApp }, fs] = await Promise.all([
      import(FB_APP),
      import(FB_FS)
    ]);
    ({ doc, onSnapshot, setDoc, serverTimestamp } = fs);
    const app = initializeApp(firebaseConfig);
    db = fs.getFirestore(app);
    if (currentCode) startSync(currentCode);
    else setStatus('オフ', 'コードを設定すると他の端末と同期できます');
  } catch (e) {
    setStatus('エラー', 'Firebaseの読み込みに失敗しました（オフラインの可能性）');
    console.error('[sync] init failed', e);
  }
}

// ローカルの変更を検知したらリモートへ送る（デバウンス）
window.addEventListener('hometask:changed', () => {
  if (!db || !currentCode) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushState, 400);
});

// ================= 同期の開始 / 停止 =================
function startSync(code) {
  currentCode = code;
  localStorage.setItem(CODE_KEY, code);
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  setStatus('接続中…', `コード: ${code}`);
  const ref = doc(db, 'rooms', code);

  unsubscribe = onSnapshot(ref,
    snap => {
      setStatus('同期中', `コード: ${code}`);
      // 自分の書き込みが返ってきた分（未確定）は無視してループを防ぐ
      if (snap.metadata.hasPendingWrites) return;
      if (!snap.exists()) { pushState(); return; } // 部屋が空なら現在の状態で作成
      applyRemote(snap.data());
    },
    err => {
      setStatus('エラー', '同期に失敗しました（設定/ルールを確認）');
      console.error('[sync] snapshot error', err);
    }
  );
}

function stopSync() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentCode = '';
  localStorage.removeItem(CODE_KEY);
  setStatus('オフ', 'コードを設定すると他の端末と同期できます');
}

// ================= リモート → ローカル =================
function applyRemote(data) {
  if (!data || !data.state || !window.HomeTask) return;
  const remote = data.state;
  const local  = window.HomeTask.getSyncState();
  // 同じ内容なら何もしない
  if (JSON.stringify(remote) === JSON.stringify(local)) return;
  window.HomeTask.applySyncState(remote);
}

// ================= ローカル → リモート =================
async function pushState() {
  if (!db || !currentCode || !window.HomeTask) return;
  const state = window.HomeTask.getSyncState();
  const json  = JSON.stringify(state);
  if (json === lastPushed) return;
  lastPushed = json;
  try {
    await setDoc(doc(db, 'rooms', currentCode), {
      state,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    setStatus('エラー', '送信に失敗しました');
    console.error('[sync] push failed', e);
  }
}

// ================= UI =================
function setStatus(label, hint) {
  if (!statusEl) return;
  statusEl.textContent = label;
  statusEl.dataset.state = label;
  if (hint) statusEl.title = hint;
}

function randomCode() {
  // 紛らわしい文字を除いた6桁（大文字＋数字）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function normalize(v) {
  return (v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
}

openBtn && openBtn.addEventListener('click', () => {
  if (!sheet) return;
  codeInput.value = currentCode;
  offBtn.hidden = !currentCode;
  sheet.hidden = false;
  setTimeout(() => codeInput.focus(), 100);
});

genBtn && genBtn.addEventListener('click', () => { codeInput.value = randomCode(); });

cancelBtn && cancelBtn.addEventListener('click', () => { sheet.hidden = true; });
sheet && sheet.addEventListener('click', e => { if (e.target === sheet) sheet.hidden = true; });

saveBtn && saveBtn.addEventListener('click', () => {
  const code = normalize(codeInput.value);
  if (!code) return;
  sheet.hidden = true;
  startSync(code);
  pushState(); // 設定直後に現在の状態を送っておく
});

offBtn && offBtn.addEventListener('click', () => {
  sheet.hidden = true;
  stopSync();
});
