// Kiểm thử bộ sinh đề và máy chấm (lộ trình bước 1).
// Chạy: node --test tests/zipline/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRational, ratEq, rat, gradeLine, gradeZ, generateLevel, generateRun, makeRng,
} from '../../src/zipline/js/math.js';

const L = { A: [1, 2, 3], B: [3, 6, 7], M: [2, 4, 5], AB: [2, 4, 4] }; // ví dụ trong tài liệu
const ans = (point, dir) => ({ point: point.map(String), dir: dir.map(String) });

test('parseRational: các cách viết số', () => {
  assert.ok(ratEq(parseRational('5'), rat(5)));
  assert.ok(ratEq(parseRational(' -3 '), rat(-3)));
  assert.ok(ratEq(parseRational('+2'), rat(2)));
  assert.ok(ratEq(parseRational('2.5'), rat(5, 2)));
  assert.ok(ratEq(parseRational('2,5'), rat(5, 2)));
  assert.ok(ratEq(parseRational('10/2'), rat(5)));
  assert.ok(ratEq(parseRational('-3/4'), rat(-3, 4)));
  assert.ok(ratEq(parseRational('3/-4'), rat(-3, 4)));
  assert.ok(ratEq(parseRational('−7'), rat(-7)));
  assert.ok(ratEq(parseRational('.5'), rat(1, 2)));
  assert.ok(ratEq(parseRational('5.0'), rat(5)));
  for (const bad of ['', ' ', 'abc', '1/0', '1..2', '2t', '--1', '1/2/3', '-', '.']) {
    assert.equal(parseRational(bad), null, `"${bad}" phải bị từ chối`);
  }
});

test('câu a: chấp nhận mọi cách viết đúng', () => {
  const good = [
    ans([1, 2, 3], [2, 4, 4]), // gốc A, vectơ AB
    ans([3, 6, 7], [2, 4, 4]), // gốc B
    ans([1, 2, 3], [-2, -4, -4]), // vectơ BA
    ans([1, 2, 3], [1, 2, 2]), // rút gọn
    ans([3, 6, 7], [4, 8, 8]), // gấp đôi
    ans([1, 2, 3], [3, 6, 6]), // gấp rưỡi
    ans([2, 4, 5], [1, 2, 2]), // gốc M (cũng trên đường)
    ans([-1, -2, -1], [1, 2, 2]), // điểm khác trên đường (t = -1)
    ans([1, 2, 3], ['1/2', 1, 1]), // phân số
    ans(['1,0', '2.0', 3], ['0,5', 1, 1]), // thập phân
  ];
  for (const a of good) assert.equal(gradeLine(L, a).correct, true, JSON.stringify(a));
});

test('câu a: từ chối các lỗi thường gặp', () => {
  const cases = [
    [ans([1, 2, 3], [3, 6, 7]), 'not_parallel'], // lấy tọa độ B làm vectơ
    [ans([1, 2, 3], [4, 8, 10]), 'not_parallel'], // A + B
    [ans([1, 2, 3], [2, 4, 3]), 'not_parallel'], // tính nhầm một thành phần
    [ans([1, 2, 3], [-2, 4, 4]), 'not_parallel'], // sai dấu một thành phần
    [ans([2, 4, 4], [1, 2, 3]), 'not_parallel'], // đảo vai điểm và vectơ
    [ans([0, 0, 0], [2, 4, 4]), 'point_off_line'], // quên điểm gốc
    [ans([1, 2, 4], [1, 2, 2]), 'point_off_line'], // lệch một tọa độ gốc
    [ans([1, 2, 3], [0, 0, 0]), 'zero_dir'],
    [ans([1, '', 3], [2, 4, 4]), 'invalid'],
  ];
  for (const [a, reason] of cases) {
    const g = gradeLine(L, a);
    assert.equal(g.correct, false, JSON.stringify(a));
    assert.equal(g.reason, reason, JSON.stringify(a));
  }
});

test('câu a: vectơ có thành phần 0', () => {
  const L0 = { A: [1, 2, 3], B: [1, 6, 7], M: [1, 4, 5] };
  assert.equal(gradeLine(L0, ans([1, 2, 3], [0, 4, 4])).correct, true);
  assert.equal(gradeLine(L0, ans([1, 2, 3], [0, 1, 1])).correct, true);
  assert.equal(gradeLine(L0, ans([1, 2, 3], [1, 4, 4])).correct, false);
  assert.equal(gradeLine(L0, ans([2, 2, 3], [0, 1, 1])).correct, false);
});

test('câu b: so bằng giá trị', () => {
  for (const z of ['5', '5,0', '5.0', '10/2', ' 5 ', '+5']) assert.equal(gradeZ(L, z).correct, true, z);
  for (const z of ['4', '-5', '5.1', '6']) assert.equal(gradeZ(L, z).correct, false, z);
  assert.equal(gradeZ(L, '').reason, 'invalid');
});

test('sinh đề: luôn nguyên, M không bao giờ là trung điểm, đa dạng tỉ số và trục hỏi', () => {
  const rng = makeRng(12345);
  const seenRatios = new Set();
  const seenAxes = new Set();
  for (let i = 0; i < 5000; i++) {
    const lv = generateLevel(rng, i % 8, 8);
    const { A, B, M, AB, t, askIndex } = lv;
    for (const v of [A, B, M, AB]) for (const c of v) assert.ok(Number.isInteger(c));
    assert.deepEqual(B, A.map((a, k) => a + AB[k]));
    assert.ok(t.n !== 0 && !(t.n === 1 && t.d === 2), 'M không bao giờ là trung điểm (t ≠ 1/2) và không trùng A');
    assert.ok(!(t.n === t.d), 'M không trùng B');
    for (let k = 0; k < 3; k++) assert.equal(M[k] * t.d, A[k] * t.d + t.n * AB[k]);
    const knownAxes = [0, 1, 2].filter((k) => k !== askIndex);
    assert.ok(knownAxes.some((k) => AB[k] !== 0), 'cần ít nhất 1 tọa độ đã biết thay đổi để tìm t');
    assert.ok(AB[askIndex] !== 0, 'tọa độ cần tìm phải thay đổi dọc theo AB');
    // Đáp án chuẩn luôn được chấm đúng
    assert.equal(gradeLine(lv, ans(A, AB)).correct, true);
    assert.equal(gradeLine(lv, ans(B, AB.map((c) => -c))).correct, true);
    assert.equal(gradeZ(lv, String(M[askIndex])).correct, true);
    for (const c of [...B, ...M]) assert.ok(Math.abs(c) <= 50);
    seenRatios.add(`${t.n}/${t.d}`);
    seenAxes.add(askIndex);
  }
  assert.ok(seenRatios.size >= 15, 'phải có ít nhất 15 tỉ số t khác nhau');
  assert.equal(seenAxes.size, 3, 'phải hỏi đủ cả 3 trục x, y, z');
});

test('generateRun: 8 màn trong một ván không lặp lại tỉ số t liên tiếp và đổi trục hỏi', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const run = generateRun(seed, 8);
    assert.equal(run.length, 8);
    const ratios = run.map((lv) => `${lv.t.n}/${lv.t.d}`);
    assert.equal(new Set(ratios).size, 8, '8 màn trong 1 ván phải có 8 tỉ số t khác nhau hoàn toàn');
    for (let i = 1; i < run.length; i++) {
      assert.notEqual(run[i].askIndex, run[i - 1].askIndex, '2 màn liên tiếp không hỏi cùng 1 trục');
    }
  }
});

test('sinh đề: cùng hạt giống thì cùng đề, khác hạt giống thì khác số liệu', () => {
  assert.deepEqual(generateRun(42), generateRun(42));
  assert.notDeepEqual(generateRun(42), generateRun(43));
  assert.equal(generateRun(1, 8).length, 8);
});
