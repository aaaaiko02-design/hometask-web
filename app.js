'use strict';

// ===== ストレージキー =====
const TASKS_KEY   = 'hometask_tasks_v1';
const ARRIVED_KEY = 'hometask_arrived_v1';
const DONE_KEY    = 'hometask_done_v1';

// ===== UUID生成（iOS 15.4未満の互換対応） =====
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function today() {
  return new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).replace(/\//g, '-');
}

// ===== ストレージ =====
function loadTasks() {
  try { const r = localStorage.getItem(TASKS_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveTasks(t) { localStorage.setItem(TASKS_KEY, JSON.stringify(t)); }

function loadArrived() {
  try {
    const r = localStorage.getItem(ARRIVED_KEY);
    if (!r) return false;
    const d = JSON.parse(r);
    return d.date === today() ? d.arrived : false;
  } catch { return false; }
}
function saveArrived(v) {
  localStorage.setItem(ARRIVED_KEY, JSON.stringify({ date: today(), arrived: v }));
}

function loadDone() {
  try {
    const r = localStorage.getItem(DONE_KEY);
    if (!r) return {};
    const d = JSON.parse(r);
    return d.date === today() ? (d.done ?? {}) : {};
  } catch { return {}; }
}
function saveDone(d) {
  localStorage.setItem(DONE_KEY, JSON.stringify({ date: today(), done: d }));
}

// ===== 状態 =====
let tasks      = loadTasks() ?? [];
let hasArrived = loadArrived();
let doneMap    = loadDone();

// ===== DOM =====
const calendarLoading = document.getElementById('calendar-loading');
const eventList       = document.getElementById('event-list');
const arriveBanner    = document.getElementById('arrive-banner');
const taskList        = document.getElementById('task-list');
const taskEmpty       = document.getElementById('task-empty');
const arriveBtn       = document.getElementById('arrive-btn');
const addTaskBtn      = document.getElementById('add-task-btn');
const addSheet        = document.getElementById('add-sheet');
const newTaskInput    = document.getElementById('new-task-input');
const sheetCancel     = document.getElementById('sheet-cancel');
const sheetSave       = document.getElementById('sheet-save');

// ===== 初期化 =====
renderTasks();
updateArriveBtn();
if (hasArrived) showBanner();
checkCalendar();

// ===== カレンダー確認（今日の予定を表示） =====
async function checkCalendar() {
  try {
    const base = location.hostname === 'localhost' || location.hostname.match(/^192\./)
      ? ''
      : 'https://aaaaiko02-design.github.io/hometask-web';
    const res = await fetch(base + '/dayshift-cache.json?_=' + Date.now());
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.date !== today()) { calendarLoading.textContent = 'まだ今日のデータがありません'; return; }

    calendarLoading.hidden = true;
    renderEvents(data.events || []);
  } catch {
    calendarLoading.textContent = '予定の取得に失敗しました';
  }
}

function renderEvents(events) {
  eventList.innerHTML = '';
  if (events.length === 0) {
    const li = document.createElement('li');
    li.className = 'event-item';
    li.innerHTML = '<span>予定なし</span>';
    eventList.appendChild(li);
    return;
  }
  events.forEach(ev => {
    const li = document.createElement('li');
    li.className = 'event-item';
    li.innerHTML = `<span class="event-time">${escHtml(ev.time || '')}</span><span>${escHtml(ev.title)}</span>`;
    eventList.appendChild(li);
  });
}

// ===== 帰宅ボタン =====
arriveBtn.addEventListener('click', () => {
  if (hasArrived) return;
  hasArrived = true;
  saveArrived(true);
  showBanner();
  updateArriveBtn();
  renderTasks();
  requestAndNotify(tasks);
});

function updateArriveBtn() {
  if (hasArrived) {
    arriveBtn.classList.add('arrived');
    arriveBtn.querySelector('.arrive-text').textContent = '帰宅済み';
    arriveBtn.querySelector('.arrive-icon').textContent = '✅';
  } else {
    arriveBtn.classList.remove('arrived');
    arriveBtn.querySelector('.arrive-text').textContent = '帰宅した！';
    arriveBtn.querySelector('.arrive-icon').textContent = '🏠';
  }
}

function showBanner() { arriveBanner.hidden = false; }

// ===== タスク描画 =====
function renderTasks() {
  taskList.innerHTML = '';
  if (tasks.length === 0) { taskEmpty.hidden = false; return; }
  taskEmpty.hidden = true;

  tasks.forEach(task => {
    const isDone = hasArrived && doneMap[task.id];
    const li = document.createElement('li');
    li.className = 'task-item' + (hasArrived ? ' arrived' : '') + (isDone ? ' done' : '');

    if (hasArrived) {
      li.innerHTML = `
        <button class="task-check ${isDone ? 'done-check' : ''}">${isDone ? '✓' : ''}</button>
        <span class="task-name" style="${isDone ? 'text-decoration:line-through' : ''}">${escHtml(task.title)}</span>
        <button class="task-delete">×</button>`;
      li.querySelector('.task-check').addEventListener('click', () => toggleDone(task.id));
    } else {
      li.innerHTML = `
        <span class="task-name">${escHtml(task.title)}</span>
        <button class="task-delete">×</button>`;
    }
    li.querySelector('.task-delete').addEventListener('click', () => deleteTask(task.id));
    taskList.appendChild(li);
  });
}

function toggleDone(id) {
  doneMap[id] = !doneMap[id]; saveDone(doneMap); renderTasks();
}
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  delete doneMap[id];
  saveTasks(tasks); saveDone(doneMap); renderTasks();
}

// ===== タスク追加 =====
addTaskBtn.addEventListener('click', openAddSheet);
sheetCancel.addEventListener('click', closeAddSheet);
addSheet.addEventListener('click', e => { if (e.target === addSheet) closeAddSheet(); });
sheetSave.addEventListener('click', addTask);
newTaskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

function addTask() {
  const title = newTaskInput.value.trim();
  if (!title) return;
  tasks.push({ id: generateId(), title });
  saveTasks(tasks); renderTasks(); closeAddSheet();
}
function openAddSheet() {
  addSheet.hidden = false; newTaskInput.value = '';
  setTimeout(() => newTaskInput.focus(), 100);
}
function closeAddSheet() { addSheet.hidden = true; newTaskInput.blur(); }

// ===== ユーティリティ =====
function showToast(msg) {
  const e = document.querySelector('.toast');
  if (e) e.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

async function requestAndNotify(allTasks) {
  if (!('Notification' in window) || allTasks.length === 0) return;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return;
  allTasks.forEach((task, i) => {
    setTimeout(() => new Notification('🏠 帰宅タスク', {
      body: task.title, icon: 'icon-192.png', tag: `hometask-${task.id}`
    }), i * 800);
  });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
