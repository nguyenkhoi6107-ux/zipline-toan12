/**
 * rank.js — Xếp hạng (mục 3).
 *  1. Ai về đích: theo thứ tự về đích.
 *  2. Còn đang chơi / hết giờ: theo số màn đã qua (và bước trong màn), ai đạt trước xếp trên.
 *  3. Hết 2 mạng: không được xếp hạng.
 */

/**
 * @param {object[]} players  mỗi phần tử: {id, name, levelsPassed, stage, status, finishedAt, lastProgressAt}
 * @returns {{ranked: object[], eliminated: object[]}} ranked có thêm trường rank (1-based)
 */
export function rankPlayers(players) {
  const list = players.filter(Boolean);
  const eliminated = list.filter((p) => p.status === 'eliminated');
  const active = list.filter((p) => p.status !== 'eliminated');

  const steps = (p) => (p.levelsPassed || 0) * 2 + (p.stage === 'z' ? 1 : 0);
  active.sort((a, b) => {
    const af = a.status === 'finished';
    const bf = b.status === 'finished';
    if (af !== bf) return af ? -1 : 1;
    if (af && bf) return (a.finishedAt || 0) - (b.finishedAt || 0);
    const d = steps(b) - steps(a);
    if (d !== 0) return d;
    return (a.lastProgressAt || 0) - (b.lastProgressAt || 0);
  });
  return {
    ranked: active.map((p, i) => ({ ...p, rank: i + 1 })),
    eliminated: eliminated.sort((a, b) => steps(b) - steps(a)),
  };
}
