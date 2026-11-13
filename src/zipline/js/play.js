/**
 * play.js — Bộ điều khiển màn chơi của học sinh (chơi một mình hoặc trong phòng).
 *
 *  play.html?mode=solo          luyện tập một mình
 *  play.html?room=1234          chơi trong phòng (tên lấy từ trang chủ)
 *  thêm &local=1                ép dùng chế độ thử cục bộ (không Firebase)
 *
 * Quyết định (mục 8, bước 1–2): sinh đề và chấm đáp án chạy trên máy học sinh.
 * Hạt giống đề = mã phòng + mã người chơi, nên tải lại trang vẫn ra đúng bộ đề cũ.
 */
import { generateRun, hashSeed, formatPoint } from './math.js';
import { PlayerRun } from './game-core.js';
import { Scene } from './scene.js';
import { View3D } from './view3d.js';
import { loadSprites } from './sprites.js';
import { getBackend, getPlayerId, SERVER_NOW } from './net.js';
import { loadConfig, mergeSettings, fmtTime, el, renderBoard, playersOf } from './ui.js';
import { rankPlayers } from './rank.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const roomCode = qs.get('room');
const solo = !roomCode;
const keepLocal = qs.has('local') ? '?local=1' : '';

const paramP = [0, 1, 2].map((i) => document.querySelector(`[data-p="${i}"]`));
const paramD = [0, 1, 2].map((i) => document.querySelector(`[data-d="${i}"]`));
const allParam = paramP.flatMap((p, i) => [p, paramD[i]]); // thứ tự tab: x0, a1, y0, a2, z0, a3

const canonP = [0, 1, 2].map((i) => document.querySelector(`[data-cp="${i}"]`));
const canonD = [0, 1, 2].map((i) => document.querySelector(`[data-cd="${i}"]`));
const allCanon = canonP.flatMap((p, i) => [p, canonD[i]]);

function activeInputs() {
  return run?.level?.eqForm === 'canonical'
    ? { p: canonP, d: canonD, all: allCanon }
    : { p: paramP, d: paramD, all: allParam };
}

const defaults = await loadConfig();
const sprites = await loadSprites();
const scene = new Scene($('scene'), sprites);
const view = new View3D($('view3d'));

let settings = mergeSettings(defaults);
let run = null;
let backend = null;
let pid = null;
let myName = '';
let room = null;
let startAt = null;
let started = false;
let ended = false;
let busy = false;
let shownDist = settings.monster.startDistance;
let lastPublish = 0;
let lastPublishedDist = null;

const now = () => (backend ? backend.serverNow() : Date.now());

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

function overlay(nodes) {
  if (!nodes) { $('overlay').classList.add('hidden'); return; }
  $('overlayBox').replaceChildren(...nodes);
  $('overlay').classList.remove('hidden');
}

function button(text, onClick, cls = 'btn primary big') {
  const b = el('button', cls, text);
  b.addEventListener('click', onClick);
  return b;
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function renderHud() {
  if (!run) return;
  const total = run.totalLevels;
  const lives = $('lives');
  lives.replaceChildren();
  for (let i = 0; i < settings.lives; i++) lives.append(el('span', i < run.lives ? '' : 'lost', '♥'));
  const prog = $('progress');
  if (prog.children.length !== total) prog.replaceChildren(...Array.from({ length: total }, () => el('span')));
  [...prog.children].forEach((s, i) => {
    s.className = i < run.levelsPassed ? 'done' : i === run.levelIndex && run.status === 'playing' ? 'cur' : '';
  });
  const d = Math.max(0, shownDist);
  $('foxDist').textContent = `${Math.round(d)} m`;
  $('foxFill').style.width = `${Math.min(100, (d / settings.monster.maxDistance) * 100)}%`;
  $('foxbar').classList.toggle('danger', d < 30);
}

function renderTimer() {
  if (!startAt) return;
  const limit = settings.timeLimitMinutes * 60000;
  const left = startAt + limit - now();
  $('timer').textContent = fmtTime(Math.min(limit, left));
  $('timer').classList.toggle('low', left < 60000);
  return left;
}

// ---------------------------------------------------------------------------
// Đề
// ---------------------------------------------------------------------------

function setFeedback(text, kind = '') {
  $('feedback').textContent = text;
  $('feedback').className = 'feedback ' + kind;
}

function renderPromptA(lv) {
  const p = $('qPromptA');
  const formText = lv.eqForm === 'canonical' ? 'phương trình chính tắc' : 'phương trình tham số';
  const b = el('b', '', 'a) ');
  if (lv.questionType === 'parallel_line') {
    p.replaceChildren(
      b,
      'Đường thẳng dây d đi qua ',
      el('span', 'pA', `A${formatPoint(lv.A)}`),
      ' và song song với đường thẳng Δ có vectơ chỉ phương ',
      el('span', 'pVec', `u_Δ = ${formatPoint(lv.parallelDir)}`),
      `. Viết ${formText} của đường thẳng d.`,
    );
  } else if (lv.questionType === 'plane_normal') {
    const uTpl = `(${lv.dirTemplate.map((v) => (v === null ? 'm' : v)).join('; ')})`;
    p.replaceChildren(
      b,
      'Đường thẳng dây d đi qua ',
      el('span', 'pA', `A${formatPoint(lv.A)}`),
      ', nằm trong mặt phẳng (P) có vectơ pháp tuyến ',
      el('span', 'pVec', `n = ${formatPoint(lv.planeNormal)}`),
      ' và có vectơ chỉ phương dạng ',
      el('span', 'pVec', `u = ${uTpl}`),
      `. Tìm m rồi viết ${formText} của đường thẳng d.`,
    );
  } else {
    p.replaceChildren(
      b,
      'Cho ',
      el('span', 'pA', `A${formatPoint(lv.A)}`),
      ' và ',
      el('span', 'pB', `B${formatPoint(lv.B)}`),
      `. Viết ${formText} của đường thẳng AB.`,
    );
  }
}

function renderLevel() {
  const lv = run.level;
  const askIdx = lv.askIndex ?? 2;
  const askAxis = lv.askAxis || 'z';
  const askLabel = lv.askLabel || 'cao độ z';
  const isCanon = lv.eqForm === 'canonical';
  $('lvNum').textContent = String(run.levelIndex + 1);
  $('lvTotal').textContent = String(run.totalLevels);
  renderPromptA(lv);
  $('eqParametric').classList.toggle('hidden', isCanon);
  $('eqCanonical').classList.toggle('hidden', !isCanon);
  if ($('qLineName')) $('qLineName').textContent = lv.hideB ? 'd' : 'AB';
  $('qM').textContent = `M${formatPoint(lv.M, askIdx)}`;
  if ($('qAskLabel')) $('qAskLabel').textContent = askLabel;
  if ($('qAskVar')) $('qAskVar').textContent = `${askAxis} =`;
  const { p, d, all } = activeInputs();
  const inZ = run.stage === 'z';
  if (!inZ) {
    allParam.forEach((i) => { i.value = ''; });
    allCanon.forEach((i) => { i.value = ''; });
  } else if (all.every((i) => !i.value)) {
    // Khôi phục sau khi tải lại: điền lại một phương trình đúng.
    lv.A.forEach((v, i) => { p[i].value = String(v); });
    lv.AB.forEach((v, i) => { d[i].value = String(v); });
  }
  $('zIn').value = '';
  lockParts();
  scene.setLevel(lv, { stage: run.stage, isLast: run.levelIndex === run.totalLevels - 1 });
  renderHud();
}

function lockParts() {
  const inZ = run.stage === 'z';
  const playing = run.status === 'playing' && started && !ended;
  const { all } = activeInputs();
  $('partA').classList.toggle('locked', inZ || !playing);
  $('partA').classList.toggle('solved', inZ);
  $('partB').classList.toggle('locked', !inZ || !playing);
  allParam.forEach((i) => { i.disabled = true; });
  allCanon.forEach((i) => { i.disabled = true; });
  all.forEach((i) => { i.disabled = inZ || busy || !playing; });
  $('btnA').disabled = inZ || busy || !playing;
  $('zIn').disabled = !inZ || busy || !playing;
  $('btnB').disabled = !inZ || busy || !playing;
}

// ---------------------------------------------------------------------------
// Nộp bài
// ---------------------------------------------------------------------------

async function withAnimation(fn) {
  busy = true;
  run.setPaused(true);
  lockParts();
  try {
    await fn();
  } finally {
    busy = false;
    if (run.status === 'playing') run.setPaused(false);
    lockParts();
    publish(true);
  }
}

async function handleCatchEvent(ev) {
  if (!ev || (ev.type !== 'caught' && ev.type !== 'eliminated')) return;
  const elim = ev.type === 'eliminated';
  await scene.caught(elim);
  if (elim) {
    showEliminated();
  } else {
    setFeedback(`Hồ ly vồ trúng! Còn ${ev.livesLeft} mạng — hồi sinh ngay tại đoạn dây này.`, 'bad');
  }
}

async function submitA() {
  if (busy || !run || run.stage !== 'line') return;
  const { p, d } = activeInputs();
  const res = run.submitLine({ point: p.map((i) => i.value), dir: d.map((i) => i.value) });
  if (!res) return;
  if (!res.penalized && !res.correct) { setFeedback(res.feedback, 'warn'); return; }
  const lv = run.level;
  const lineName = lv.hideB ? 'd' : 'AB';
  await withAnimation(async () => {
    if (res.correct) {
      setFeedback(res.feedback, 'ok');
      view.show({ A: lv.A, B: lv.B, M: lv.M, askIndex: lv.askIndex ?? 2, showZ: false, hideB: !!lv.hideB });
      $('view3dCap').textContent = `Đường thẳng của em trùng với ${lineName}. Điểm M thuộc ${lineName}, cần tìm ${lv.askLabel || 'cao độ z'}.`;
      await scene.shootRope();
      scene.setStage('z');
      lockParts();
      $('zIn').focus({ preventScroll: true });
    } else {
      setFeedback(res.feedback, 'bad');
      view.show({ A: lv.A, B: lv.B, M: null, wrongLine: { point: res.point, dir: res.dir }, hideB: !!lv.hideB });
      $('view3dCap').textContent = `Nét đỏ là đường thẳng em viết: nó không trùng với dây ${lineName}.`;
      await scene.failLine();
      await handleCatchEvent(res.event);
    }
  });
}

async function submitB() {
  if (busy || !run || run.stage !== 'z') return;
  const res = run.submitZ($('zIn').value);
  if (!res) return;
  if (!res.penalized && !res.correct) { setFeedback(res.feedback, 'warn'); return; }
  const lv = run.level;
  const askIdx = lv.askIndex ?? 2;
  const askAxis = lv.askAxis || 'z';
  const lineName = lv.hideB ? 'd' : 'AB';
  await withAnimation(async () => {
    if (res.correct) {
      setFeedback(res.feedback, 'ok');
      view.show({ A: lv.A, B: lv.B, M: lv.M, askIndex: askIdx, showZ: true, hideB: !!lv.hideB });
      $('view3dCap').textContent = lv.hideB
        ? `M${formatPoint(lv.M)} thuộc đường thẳng d.`
        : `M${formatPoint(lv.M)} thuộc đường thẳng AB (ứng với AM = (${lv.t.n}/${lv.t.d})AB).`;
      await scene.buildPoleAndZip();
      if (run.status === 'finished') {
        onFinished();
      } else {
        renderLevel();
        const nextLine = run.level.hideB ? 'd' : 'AB';
        setFeedback(`Sang đoạn mới! Viết phương trình đường thẳng ${nextLine}.`, '');
        await scene.fadeIn();
        activeInputs().p[0].focus({ preventScroll: true });
      }
    } else {
      setFeedback(res.feedback, 'bad');
      const wrongM = [...lv.M];
      wrongM[askIdx] = res.z;
      view.show({ A: lv.A, B: lv.B, M: lv.M, askIndex: askIdx, showZ: false, wrongM, wrongAxis: askAxis, hideB: !!lv.hideB });
      $('view3dCap').textContent = `Điểm đỏ có ${askAxis} = ${res.z} nên lệch khỏi đường thẳng ${lineName}.`;
      await scene.failZ(res.z);
      await handleCatchEvent(res.event);
    }
  });
}

$('btnA').addEventListener('click', submitA);
$('btnB').addEventListener('click', submitB);
[allParam, allCanon].forEach((group) => group.forEach((inp, i) => inp.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (i < group.length - 1) group[i + 1].focus(); else submitA();
})));
$('zIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitB(); } });

// ---------------------------------------------------------------------------
// Vòng lặp thời gian
// ---------------------------------------------------------------------------

let lastFrame = performance.now();
function frame(t) {
  const dt = Math.min(0.25, (t - lastFrame) / 1000);
  lastFrame = t;
  if (run && started && !ended) {
    const left = renderTimer();
    if (left !== undefined && left <= 0) {
      run.timeUp();
      endGame('timeout');
    } else if (!busy) {
      const ev = run.tick(dt);
      if (ev) withAnimation(() => handleCatchEvent(ev));
    }
    if (!busy) shownDist += (run.monsterDist - shownDist) * Math.min(1, dt * 5);
    scene.setMonster(shownDist, settings.monster.maxDistance);
    renderHud();
    publish(false);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Bắt đầu / kết thúc
// ---------------------------------------------------------------------------

function newRun(seed) {
  run = new PlayerRun({
    levels: generateRun(seed, settings.levels),
    monster: settings.monster,
    lives: settings.lives,
    now,
  });
  shownDist = run.monsterDist;
}

/** Đếm ngược tới startAt rồi cho chạy. */
function beginCountdown() {
  const tick = () => {
    const left = startAt - now();
    if (left > 0) {
      overlay([el('h2', '', 'Chuẩn bị!'), el('div', 'count', String(Math.ceil(left / 1000))), el('p', 'muted', 'Hồ ly đã đánh hơi thấy các em…')]);
      setTimeout(tick, 100);
      return;
    }
    overlay(null);
    started = true;
    renderLevel();
    if (run.status === 'eliminated') showEliminated();
    else if (run.status !== 'playing') onFinished();
    else {
      const lineName = run.level.hideB ? 'd' : 'AB';
      setFeedback(`Chạy! Viết phương trình đường thẳng ${lineName} để bắn dây.`, '');
      activeInputs().p[0].focus({ preventScroll: true });
    }
  };
  tick();
}

function resultSummary() {
  const wrap = el('div');
  const passed = `${run.levelsPassed}/${run.totalLevels} màn`;
  wrap.append(el('p', '', `Em đã qua ${passed} · đúng ${run.correctCount} câu · sai ${run.wrongCount} câu.`));
  if (!solo && room) {
    const ol = el('ol', 'board board-list');
    const { myRank } = renderBoard(ol, room, { me: pid, top: 10, total: run.totalLevels });
    if (myRank) wrap.prepend(el('h2', '', `Hạng ${myRank}`));
    wrap.append(ol);
  }
  return wrap;
}

function onFinished() {
  publish(true);
  if (!solo && settings.endOnFirstFinish && room?.status === 'running') {
    backend.updateRoom(roomCode, { status: 'ended', endedAt: SERVER_NOW, endReason: 'finish' });
  }
  const t = run.finishedAt && startAt ? fmtTime(run.finishedAt - startAt) : '';
  overlay([
    el('h2', '', '🏁 Em đã thoát khỏi hồ ly!'),
    el('p', '', t ? `Thời gian: ${t}` : ''),
    resultSummary(),
    solo ? button('Chơi lại', () => location.reload()) : el('p', 'muted', 'Chờ cả lớp hoàn thành…'),
  ]);
  ended = solo;
}

function showEliminated() {
  publish(true);
  overlay([
    el('h2', '', '🦊 Hồ ly bắt được em rồi!'),
    el('p', 'muted', solo ? 'Hết 2 mạng.' : 'Hết 2 mạng — em không được xếp hạng ván này. Ngồi xem các bạn nhé.'),
    resultSummary(),
    solo ? button('Chơi lại', () => location.reload()) : button('Xem bảng xếp hạng', () => overlay(null), 'btn'),
  ]);
}

function endGame(reason) {
  if (ended) return;
  ended = true;
  if (run) run.timeUp();
  lockParts();
  publish(true);
  const title = reason === 'timeout' ? '⏰ Hết giờ!' : reason === 'finish' ? '🏁 Đã có bạn về đích!' : 'Ván chơi đã kết thúc';
  overlay([
    el('h2', '', title),
    resultSummary(),
    solo ? button('Chơi lại', () => location.reload()) : button('Về trang chủ', () => { location.href = 'index.html' + keepLocal; }, 'btn'),
  ]);
  if (!solo && reason === 'timeout' && room?.status === 'running') {
    backend.updateRoom(roomCode, { status: 'ended', endedAt: SERVER_NOW, endReason: 'timeout' });
  }
}

// ---------------------------------------------------------------------------
// Mạng
// ---------------------------------------------------------------------------

function publish(force) {
  if (solo || !backend || !run) return;
  const t = performance.now();
  const d = Math.round(run.monsterDist);
  if (!force && (t - lastPublish < settings.network.publishIntervalMs || d === lastPublishedDist)) return;
  lastPublish = t;
  lastPublishedDist = d;
  backend.updatePlayer(roomCode, pid, { name: myName, ...run.snapshot() }).catch((e) => console.warn(e));
}

function onRoom(data) {
  room = data;
  if (!data) {
    overlay([el('h2', '', 'Không tìm thấy phòng'), button('Về trang chủ', () => { location.href = 'index.html' + keepLocal; })]);
    return;
  }
  if (!run) {
    settings = mergeSettings(defaults, data.settings);
    newRun(hashSeed(`${roomCode}:${pid}`));
    const mine = data.players?.[pid];
    if (mine && mine.levelsPassed !== undefined && data.status !== 'lobby') run.restore(mine);
    renderLevel();
  }
  renderBoard($('board'), data, { me: pid, top: 5, total: run.totalLevels });

  if (data.status === 'lobby') {
    const n = playersOf(data).filter((p) => p.name).length;
    overlay([
      el('h2', '', `Phòng ${roomCode}`),
      el('p', '', `Chào ${myName}! Em đã vào phòng.`),
      el('p', 'muted', `${n} bạn đang chờ. Cả lớp sẽ xuất phát cùng lúc khi thầy/cô bấm Bắt đầu.`),
      el('p', 'small muted', `${settings.levels} màn · ${settings.timeLimitMinutes} phút · ${settings.lives} mạng`),
    ]);
  } else if (data.status === 'running' && !started && data.startAt) {
    startAt = data.startAt;
    beginCountdown();
  } else if (data.status === 'ended' && !ended) {
    if (!startAt) startAt = data.startAt || now();
    started = true;
    endGame(data.endReason || 'ended');
  }
  // Cập nhật bảng trong overlay (về đích / bị loại / kết thúc) để em ngồi xem vẫn thấy thứ hạng sống.
  document.querySelectorAll('#overlayBox .board-list').forEach((ol) => renderBoard(ol, data, { me: pid, top: 10, total: run.totalLevels }));
}

// ---------------------------------------------------------------------------
// Khởi động
// ---------------------------------------------------------------------------

if (solo) {
  $('boardCard').classList.add('hidden');
  $('who').textContent = 'Luyện tập một mình';
  newRun((Math.random() * 2 ** 32) >>> 0);
  renderLevel();
  overlay([
    el('h2', '', '🌕 Luyện tập'),
    el('p', '', `${settings.levels} màn · ${settings.timeLimitMinutes} phút · ${settings.lives} mạng. Hồ ly tiến dần theo thời gian, trả lời sai thì nó nhảy gần hơn.`),
    button('Bắt đầu', () => { startAt = Date.now() + 3000; beginCountdown(); }),
  ]);
} else {
  backend = await getBackend();
  if (backend.kind === 'local') {
    $('banner').textContent = 'Chế độ thử cục bộ (chưa cấu hình Firebase)';
    $('banner').classList.remove('hidden');
  }
  pid = getPlayerId(roomCode, backend.kind === 'local');
  myName = sessionStorage.getItem(`zipline:name:${roomCode}`) || localStorage.getItem(`zipline:name:${roomCode}`) || '';
  if (!myName) {
    location.href = `index.html?room=${roomCode}${qs.has('local') ? '&local=1' : ''}`;
  } else {
    $('who').textContent = `${myName} · phòng ${roomCode}`;
    await backend.joinRoom(roomCode, pid, myName);
    backend.subscribeRoom(roomCode, onRoom);
  }
}

// Dùng ở console để thử nhanh: window.__zip
window.__zip = { get run() { return run; }, scene, rankPlayers };
