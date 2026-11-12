/**
 * teacher.js — Màn hình giáo viên (mục 7): tạo phòng, xem danh sách, Bắt đầu,
 * chiếu bảng xếp hạng sống, kết thúc khi có người về đích hoặc hết giờ, bảng tổng kết.
 *
 * teacher.html             tạo phòng mới
 * teacher.html?room=1234   mở lại phòng đã tạo (tải lại trang không mất phòng)
 */
import { getBackend, randomRoomCode, SERVER_NOW } from './net.js';
import { loadConfig, mergeSettings, fmtTime, el, playersOf } from './ui.js';
import { rankPlayers } from './rank.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const local = qs.has('local');
const defaults = await loadConfig();
const backend = await getBackend();
let code = qs.get('room');
let room = null;
let settings = mergeSettings(defaults);

if (backend.kind === 'local') {
  $('banner').textContent = 'Chế độ thử cục bộ: chưa cấu hình Firebase, học sinh phải mở tab trên CÙNG trình duyệt này. Xem README để bật Firebase.';
  $('banner').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Tạo phòng
// ---------------------------------------------------------------------------

function fillSetup() {
  const d = defaults;
  $('sLevels').value = d.levels;
  $('sTime').value = d.timeLimitMinutes;
  $('sLives').value = d.lives;
  $('sEndFirst').checked = d.endOnFirstFinish;
  $('mSpeed').value = d.monster.speedPerSecond;
  $('mJump').value = d.monster.jumpOnWrong;
  $('mPush').value = d.monster.pushBackOnRespawn;
  $('mStart').value = d.monster.startDistance;
  $('mGainA').value = d.monster.gainOnLineCorrect;
  $('mGainLv').value = d.monster.gainOnLevelComplete;
}

$('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const num = (id, lo, hi) => Math.min(hi, Math.max(lo, Number($(id).value)));
  const s = {
    levels: Math.round(num('sLevels', 1, 20)),
    timeLimitMinutes: num('sTime', 1, 60),
    lives: Math.round(num('sLives', 1, 5)),
    endOnFirstFinish: $('sEndFirst').checked,
    monster: {
      ...defaults.monster,
      speedPerSecond: num('mSpeed', 0, 20),
      jumpOnWrong: num('mJump', 0, 200),
      pushBackOnRespawn: num('mPush', 1, 500),
      startDistance: num('mStart', 1, 500),
      gainOnLineCorrect: num('mGainA', 0, 200),
      gainOnLevelComplete: num('mGainLv', 0, 200),
    },
  };
  s.monster.maxDistance = Math.max(s.monster.maxDistance, s.monster.startDistance);
  $('setupErr').textContent = 'Đang tạo phòng…';
  try {
    let c = randomRoomCode();
    for (let i = 0; i < 20 && (await backend.roomExists(c)); i++) c = randomRoomCode();
    await backend.createRoom(c, s);
    location.href = `teacher.html?room=${c}${local ? '&local=1' : ''}`;
  } catch (ex) {
    $('setupErr').textContent = 'Không tạo được phòng: ' + ex.message;
  }
});

// ---------------------------------------------------------------------------
// Phòng
// ---------------------------------------------------------------------------

$('btnStart').addEventListener('click', async () => {
  // Đếm ngược 3 giây theo giờ máy chủ để cả lớp xuất phát cùng lúc.
  await backend.updateRoom(code, { status: 'running', startAt: backend.serverNow() + 3000 });
});
$('btnEnd').addEventListener('click', async () => {
  if (!confirm('Kết thúc ván ngay bây giờ?')) return;
  await backend.updateRoom(code, { status: 'ended', endedAt: SERVER_NOW, endReason: 'teacher' });
});
$('btnNew').addEventListener('click', () => { location.href = 'teacher.html' + (local ? '?local=1' : ''); });

function lvBar(p, total) {
  const bar = el('div', 'lvbar');
  for (let i = 0; i < total; i++) {
    const cls = i < (p.levelsPassed || 0) ? 'done' : i === (p.levelsPassed || 0) && p.stage === 'z' ? 'half' : '';
    bar.append(el('span', cls));
  }
  return bar;
}

function statusLabel(p) {
  return { finished: '🏁', eliminated: '✖', timeout: '⏰' }[p.status] || '';
}

function renderLive() {
  const total = settings.levels;
  const { ranked, eliminated } = rankPlayers(playersOf(room).filter((p) => p.name));
  const tbody = $('liveBody');
  tbody.replaceChildren();
  const addRow = (p, out) => {
    const tr = el('tr', out ? 'out' : '');
    const name = el('td', '', p.name);
    if (p.online === false) name.append(el('span', 'muted small', ' (mất kết nối)'));
    tr.append(
      el('td', 'rk', out ? '✖' : `${p.rank} ${statusLabel(p)}`),
      name,
      Object.assign(el('td'), {}),
      el('td', '', out ? '—' : '♥'.repeat(Math.max(0, p.lives ?? settings.lives))),
      el('td', '', out || p.status === 'finished' ? '—' : p.monsterDist !== undefined ? `${p.monsterDist} m` : '—'),
      el('td', 'muted', `${p.correctCount || 0}/${p.wrongCount || 0}`),
    );
    tr.children[2].append(lvBar(p, total), el('span', 'muted small', ` ${p.levelsPassed || 0}/${total}`));
    tbody.append(tr);
  };
  ranked.forEach((p) => addRow(p));
  eliminated.forEach((p) => addRow(p, true));

  const podium = $('podium');
  if (room.status === 'ended' && ranked.length) {
    podium.classList.remove('hidden');
    podium.replaceChildren();
    for (const i of [1, 0, 2]) {
      const p = ranked[i];
      if (!p) continue;
      const d = el('div', `p${i + 1}`);
      d.append(el('b', '', ['🥇', '🥈', '🥉'][i]), el('div', '', p.name), el('div', 'muted small', `${p.levelsPassed || 0}/${total} màn`));
      podium.append(d);
    }
  } else {
    podium.classList.add('hidden');
  }
  return { ranked };
}

function renderLobby() {
  const ps = playersOf(room).filter((p) => p.name).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  $('lobbyCount').textContent = String(ps.length);
  $('lobbyNames').replaceChildren(...ps.map((p) => el('span', p.online === false ? 'off' : '', p.name)));
}

function onRoom(data) {
  room = data;
  if (!data) {
    $('roomView').classList.add('hidden');
    $('setup').classList.remove('hidden');
    $('setupErr').textContent = `Không tìm thấy phòng ${code}. Tạo phòng mới nhé.`;
    fillSetup();
    return;
  }
  settings = mergeSettings(defaults, data.settings);
  const st = data.status;
  $('statusText').textContent = { lobby: 'Đang chờ học sinh vào phòng', running: 'Đang chơi', ended: 'Đã kết thúc' }[st];
  $('btnStart').classList.toggle('hidden', st !== 'lobby');
  $('btnEnd').classList.toggle('hidden', st !== 'running');
  $('btnNew').classList.toggle('hidden', st !== 'ended');
  $('lobbyCard').classList.toggle('hidden', st !== 'lobby');
  $('liveCard').classList.toggle('hidden', st === 'lobby');
  if (st === 'lobby') {
    renderLobby();
    $('bigTimer').textContent = fmtTime(settings.timeLimitMinutes * 60000);
  } else {
    const { ranked } = renderLive();
    // Kết thúc khi có người về đích (nếu bật) — máy giáo viên làm trọng tài.
    if (st === 'running' && settings.endOnFirstFinish && ranked.some((p) => p.status === 'finished')) {
      backend.updateRoom(code, { status: 'ended', endedAt: SERVER_NOW, endReason: 'finish' });
    }
  }
}

function tickTimer() {
  if (room?.status === 'running' && room.startAt) {
    const limit = settings.timeLimitMinutes * 60000;
    const left = room.startAt + limit - backend.serverNow();
    $('bigTimer').textContent = left > limit ? `Xuất phát sau ${Math.ceil((left - limit) / 1000)}` : fmtTime(left);
    if (left <= 0) backend.updateRoom(code, { status: 'ended', endedAt: SERVER_NOW, endReason: 'timeout' });
  } else if (room?.status === 'ended') {
    const reason = { finish: 'Đã có người về đích', timeout: 'Hết giờ', teacher: 'Giáo viên kết thúc' }[room.endReason] || '';
    $('bigTimer').textContent = reason;
  }
}
setInterval(tickTimer, 250);

if (!code) {
  $('setup').classList.remove('hidden');
  fillSetup();
} else {
  $('roomView').classList.remove('hidden');
  $('roomCode').textContent = code;
  const joinUrl = new URL('index.html', location.href);
  joinUrl.searchParams.set('room', code);
  if (local) joinUrl.searchParams.set('local', '1');
  $('joinHint').textContent = `Học sinh mở ${joinUrl.href} và nhập tên`;
  backend.subscribeRoom(code, onRoom);
}
