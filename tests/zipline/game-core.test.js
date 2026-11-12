// Kiểm thử luật chơi (mục 3) và xếp hạng.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerRun } from '../../src/zipline/js/game-core.js';
import { rankPlayers } from '../../src/zipline/js/rank.js';

const monster = {
  startDistance: 100, maxDistance: 140, speedPerSecond: 1, jumpOnWrong: 25,
  pushBackOnRespawn: 60, gainOnLineCorrect: 10, gainOnLevelComplete: 30,
};
const lvl = { A: [1, 2, 3], B: [3, 6, 7], M: [2, 4, 5], AB: [2, 4, 4] };
const good = { point: ['1', '2', '3'], dir: ['2', '4', '4'] };
const bad = { point: ['1', '2', '3'], dir: ['3', '6', '7'] };
const make = (n = 2) => {
  let t = 0;
  const run = new PlayerRun({ levels: Array(n).fill(lvl), monster, lives: 2, now: () => ++t });
  return run;
};

test('đúng cả hai câu thì qua màn và bỏ xa quái', () => {
  const r = make();
  assert.equal(r.submitLine(good).correct, true);
  assert.equal(r.stage, 'z');
  assert.equal(r.monsterDist, 110);
  assert.equal(r.submitZ('5').correct, true);
  assert.equal(r.levelIndex, 1);
  assert.equal(r.monsterDist, 140);
});

test('sai thì quái nhảy gần, vẫn ở đoạn dây cũ; ô trống không bị phạt', () => {
  const r = make();
  r.submitLine(bad);
  assert.equal(r.monsterDist, 75);
  assert.equal(r.stage, 'line');
  const inv = r.submitLine({ point: ['', '2', '3'], dir: ['2', '4', '4'] });
  assert.equal(inv.penalized, false);
  assert.equal(r.monsterDist, 75);
  r.submitLine(good);
  r.submitZ('4');
  assert.equal(r.stage, 'z', 'sai câu b vẫn giữ câu a');
});

test('quái bắt: mất mạng, hồi sinh tại chỗ, quái lùi; hết mạng thì bị loại', () => {
  const r = make();
  r.submitLine(good);
  const e1 = r.tick(200);
  assert.equal(e1.type, 'caught');
  assert.equal(r.lives, 1);
  assert.equal(r.monsterDist, 60);
  assert.equal(r.stage, 'z');
  r.submitZ('0'); r.submitZ('0');
  const e2 = r.submitZ('0'); // 60 - 75 < 0
  assert.equal(e2.event.type, 'eliminated');
  assert.equal(r.status, 'eliminated');
  assert.equal(r.submitZ('5'), null);
});

test('quái đứng yên khi đang chạy hoạt cảnh', () => {
  const r = make();
  r.setPaused(true);
  r.tick(50);
  assert.equal(r.monsterDist, 100);
});

test('về đích', () => {
  const r = make(2);
  for (let i = 0; i < 2; i++) { r.submitLine(good); r.submitZ('5'); }
  assert.equal(r.status, 'finished');
  assert.ok(r.finishedAt);
});

test('xếp hạng: về đích trước > nhiều màn hơn > đạt trước; bị loại không xếp', () => {
  const { ranked, eliminated } = rankPlayers([
    { id: 'a', levelsPassed: 3, stage: 'line', status: 'playing', lastProgressAt: 5 },
    { id: 'b', levelsPassed: 8, status: 'finished', finishedAt: 200 },
    { id: 'c', levelsPassed: 8, status: 'finished', finishedAt: 100 },
    { id: 'd', levelsPassed: 3, stage: 'z', status: 'playing', lastProgressAt: 9 },
    { id: 'e', levelsPassed: 3, stage: 'line', status: 'timeout', lastProgressAt: 2 },
    { id: 'f', levelsPassed: 6, stage: 'line', status: 'eliminated' },
  ]);
  assert.deepEqual(ranked.map((p) => p.id), ['c', 'b', 'd', 'e', 'a']);
  assert.deepEqual(ranked.map((p) => p.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(eliminated.map((p) => p.id), ['f']);
});
