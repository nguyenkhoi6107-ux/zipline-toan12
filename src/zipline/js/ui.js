/**
 * ui.js — Tiện ích giao diện dùng chung cho màn học sinh và màn giáo viên.
 */
import { rankPlayers } from './rank.js';

/** Tải cấu hình mặc định (config/game-config.json). */
export async function loadConfig() {
  const r = await fetch('config/game-config.json', { cache: 'no-cache' });
  return r.json();
}

/** Gộp cấu hình mặc định với cấu hình giáo viên chọn cho phòng. */
export function mergeSettings(defaults, room = {}) {
  return {
    ...defaults,
    ...room,
    monster: { ...defaults.monster, ...(room.monster || {}) },
  };
}

/** mm:ss */
export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Tạo phần tử với textContent (tránh chèn HTML từ tên học sinh). */
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Danh sách người chơi từ dữ liệu phòng. */
export function playersOf(room) {
  return Object.entries(room?.players || {}).map(([id, p]) => ({ id, ...p }));
}

/**
 * Vẽ bảng xếp hạng ngắn vào một <ol>.
 * @param {HTMLElement} ol
 * @param {object} room
 * @param {{me?:string, top?:number, total:number}} opts
 */
export function renderBoard(ol, room, { me, top = 5, total = 8 } = {}) {
  const { ranked, eliminated } = rankPlayers(playersOf(room).filter((p) => p.name));
  ol.replaceChildren();
  const row = (p, out) => {
    const li = el('li', (p.id === me ? 'me ' : '') + (out ? 'out' : ''));
    li.append(
      el('span', 'rk', out ? '✖' : p.status === 'finished' ? '🏁' : String(p.rank)),
      el('span', 'nm', p.name + (p.id === me ? ' (em)' : '')),
      el('span', 'lv', `${p.levelsPassed || 0}/${total}`),
      el('span', 'hp', out ? '' : '♥'.repeat(Math.max(0, p.lives ?? 0))),
    );
    return li;
  };
  const shown = ranked.slice(0, top);
  shown.forEach((p) => ol.append(row(p)));
  const mine = ranked.find((p) => p.id === me);
  if (mine && !shown.includes(mine)) {
    ol.append(el('li', 'sep', '…'));
    ol.append(row(mine));
  }
  const myOut = eliminated.find((p) => p.id === me);
  if (myOut) ol.append(row(myOut, true));
  if (!ranked.length && !eliminated.length) ol.append(el('li', 'sep', 'Chưa có ai.'));
  return { ranked, eliminated, myRank: mine?.rank ?? null };
}
