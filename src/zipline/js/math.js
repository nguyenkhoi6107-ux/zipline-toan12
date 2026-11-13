/**
 * math.js — Bộ sinh đề và máy chấm (lộ trình bước 1).
 *
 * Mọi phép chấm đều làm bằng số hữu tỉ chính xác (tử/mẫu nguyên), không so chữ
 * và không dùng sai số dấu phẩy động, để không bao giờ chấm oan học sinh.
 *
 * Module thuần (không đụng DOM), dùng chung cho trình duyệt và Node test.
 */

// ---------------------------------------------------------------------------
// Số hữu tỉ
// ---------------------------------------------------------------------------

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Tạo số hữu tỉ tối giản {n, d} với d > 0. */
export function rat(n, d = 1) {
  if (d === 0) throw new Error('Mẫu số bằng 0');
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

const sub = (a, b) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => rat(a.n * b.n, a.d * b.d);
const isZero = (a) => a.n === 0;
export const ratEq = (a, b) => a.n * b.d === b.n * a.d;
export const ratToNumber = (a) => a.n / a.d;

/**
 * Đọc chuỗi học sinh nhập thành số hữu tỉ.
 * Chấp nhận: "5", "-3", "+2", "2.5", "2,5" (dấu phẩy kiểu Việt Nam), "1/2", "-3/4", "−3" (dấu trừ unicode).
 * Trả về null nếu không đọc được.
 * @param {string|number} raw
 * @returns {{n:number,d:number}|null}
 */
export function parseRational(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    raw = String(raw);
  }
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/\s+/g, '').replace(/[−–—]/g, '-').replace(',', '.');
  if (s === '' || s.length > 12) return null;

  const frac = /^([+-]?\d+)\/([+-]?\d+)$/.exec(s);
  if (frac) {
    const d = parseInt(frac[2], 10);
    if (d === 0) return null;
    return rat(parseInt(frac[1], 10), d);
  }
  const dec = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(s);
  if (dec && (dec[2] !== '' || dec[3])) {
    const sign = dec[1] === '-' ? -1 : 1;
    const intPart = dec[2] === '' ? 0 : parseInt(dec[2], 10);
    const fracDigits = dec[3] || '';
    if (fracDigits.length > 6) return null;
    const d = 10 ** fracDigits.length;
    const n = intPart * d + (fracDigits ? parseInt(fracDigits, 10) : 0);
    return rat(sign * n, d);
  }
  return null;
}

/** Hiển thị số hữu tỉ: "5", "-1/2". */
export function formatRat(a) {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}

/**
 * Hiển thị tọa độ kiểu SGK: A(1; 2; 3).
 * @param {number[]} p
 * @param {boolean|number} [hide=false] false: hiện hết; true: ẩn z; 0|1|2: ẩn trục tương ứng
 */
export function formatPoint(p, hide = false) {
  const idx = hide === true ? 2 : typeof hide === 'number' ? hide : -1;
  return `(${p.map((v, i) => (i === idx ? '?' : v)).join('; ')})`;
}

// ---------------------------------------------------------------------------
// Vectơ hữu tỉ
// ---------------------------------------------------------------------------

const toRatVec = (v) => v.map((x) => (typeof x === 'number' ? rat(x) : x));

/** Tích có hướng của hai vectơ hữu tỉ. */
function cross(u, v) {
  return [
    sub(mul(u[1], v[2]), mul(u[2], v[1])),
    sub(mul(u[2], v[0]), mul(u[0], v[2])),
    sub(mul(u[0], v[1]), mul(u[1], v[0])),
  ];
}
const isZeroVec = (v) => v.every(isZero);
/** u // v (cùng phương) khi tích có hướng bằng 0. */
const parallel = (u, v) => isZeroVec(cross(u, v));

// ---------------------------------------------------------------------------
// Sinh số ngẫu nhiên có hạt giống (để test lặp lại được)
// ---------------------------------------------------------------------------

/** PRNG mulberry32. Trả về hàm () => số trong [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Băm chuỗi thành hạt giống 32-bit. */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Sinh đề (mục 4)
// ---------------------------------------------------------------------------

const AXIS_NAMES = ['x', 'y', 'z'];
const AXIS_LABELS = ['hoành độ x', 'tung độ y', 'cao độ z'];

/**
 * Danh sách tỉ số t = p/q tối giản, loại bỏ hoàn toàn trung điểm 1/2:
 * - Gồm cả chia trong (0 < t < 1, t ≠ 1/2) lẫn chia ngoài (t < 0 hoặc t > 1) ở các màn sau.
 */
const RATIOS_TIER_1 = [
  [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5],
];
const RATIOS_TIER_2 = [
  [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6],
  [-1, 3], [-2, 3], [4, 3], [5, 4],
];
const RATIOS_TIER_3 = [
  [2, 5], [3, 5], [4, 5], [1, 6], [5, 6],
  [2, 7], [3, 7], [4, 7], [5, 7], [3, 8], [5, 8], [7, 8],
  [-1, 4], [-3, 4], [-2, 5], [-3, 5], [5, 3], [7, 4], [6, 5],
];

/**
 * Bậc khó theo số màn:
 * - Màn đầu (1–2): tọa độ âm & dương, tỉ số 1/3, 2/3, 1/4, 3/4, 2/5, 3/5 (không có trung điểm 1/2).
 * - Màn giữa (3–5): biên độ lớn hơn, có cả điểm M chia ngoài đoạn AB (t < 0 hoặc t > 1) và bẫy hệ số 0t.
 * - Màn cuối (6–8): mẫu 5–8 hoặc chia ngoài, tử số lớn, vectơ bước lớn và bẫy thành phần bằng 0 thường xuyên.
 */
function tierFor(levelIndex, totalLevels) {
  const r = totalLevels <= 1 ? 0 : levelIndex / (totalLevels - 1);
  if (r < 0.25) {
    return {
      aMin: -7, aMax: 7, wMin: -5, wMax: 5, minBig: 1,
      ratios: RATIOS_TIER_1, zeroProb: 0.2, maxCoord: 34,
    };
  }
  if (r < 0.65) {
    return {
      aMin: -9, aMax: 9, wMin: -6, wMax: 6, minBig: 2,
      ratios: RATIOS_TIER_2, zeroProb: 0.4, maxCoord: 42,
    };
  }
  return {
    aMin: -12, aMax: 12, wMin: -7, wMax: 7, minBig: 2,
    ratios: RATIOS_TIER_3, zeroProb: 0.5, maxCoord: 50,
  };
}

export const QUESTION_TYPES = [
  'two_points_parametric',
  'two_points_canonical',
  'parallel_line',
  'plane_normal',
];

/**
 * Tìm vectơ pháp tuyến nguyên n = (n0, n1, n2) sao cho w · n = 0,
 * n[missingIdx] ≠ 0 và có ít nhất 2 thành phần khác 0.
 */
function findPlaneNormal(rng, w, missingIdx) {
  const others = [0, 1, 2].filter((k) => k !== missingIdx);
  for (let i = 0; i < 80; i++) {
    const n = [0, 0, 0];
    n[others[0]] = randInt(rng, -5, 5);
    n[others[1]] = randInt(rng, -5, 5);
    if (n[others[0]] === 0 && n[others[1]] === 0) continue;
    const dotOther = w[others[0]] * n[others[0]] + w[others[1]] * n[others[1]];
    if (dotOther === 0 || dotOther % w[missingIdx] !== 0) continue;
    const nMiss = -dotOther / w[missingIdx];
    if (nMiss === 0 || Math.abs(nMiss) > 9) continue;
    n[missingIdx] = nMiss;
    if (n.filter((c) => c !== 0).length < 2) continue;
    const g = gcd(gcd(n[0], n[1]), n[2]);
    return g > 1 ? n.map((c) => c / g) : n;
  }
  return null;
}

/**
 * Sinh một màn: A, B, M nguyên; M = A + t·AB với t = p/q ≠ 1/2 (không bao giờ là trung điểm).
 * Hỗ trợ 4 dạng câu hỏi:
 *  1. two_points_parametric: Cho A, B -> viết PT tham số AB
 *  2. two_points_canonical:  Cho A, B -> viết PT chính tắc AB
 *  3. parallel_line:         Cho A và đường thẳng Δ có VTCP u_Δ -> viết PT tham số / chính tắc
 *  4. plane_normal:          Cho A, mp (P) có VTPT n, VTCP khuyết 1 thành phần m -> giải u·n=0 rồi viết PT
 *
 * @param {() => number} rng
 * @param {number} levelIndex  0-based
 * @param {number} totalLevels
 * @param {[number, number]|null} [forcedRatio] Tỉ số [p, q] ép trước để cả ván không trùng nhau
 * @param {number|null} [forcedAskIndex] Trục cần hỏi (0=x, 1=y, 2=z)
 * @param {string|null} [forcedType] Dạng câu hỏi ép trước
 * @param {string|null} [forcedEqForm] Dạng phương trình ('parametric'|'canonical') ép trước
 */
export function generateLevel(
  rng,
  levelIndex = 0,
  totalLevels = 8,
  forcedRatio = null,
  forcedAskIndex = null,
  forcedType = null,
  forcedEqForm = null,
) {
  const tier = tierFor(levelIndex, totalLevels);
  const askIndex = forcedAskIndex ?? (levelIndex === 0 ? 2 : randInt(rng, 0, 2));
  const knownAxes = [0, 1, 2].filter((k) => k !== askIndex);
  const questionType = forcedType ?? pick(rng, QUESTION_TYPES);
  const eqForm = forcedEqForm ?? (
    questionType === 'two_points_parametric' ? 'parametric'
      : questionType === 'two_points_canonical' ? 'canonical'
        : rng() < 0.5 ? 'parametric' : 'canonical'
  );
  const hideB = questionType === 'parallel_line' || questionType === 'plane_normal';

  for (let attempt = 0; attempt < 400; attempt++) {
    const A = [0, 1, 2].map(() => randInt(rng, tier.aMin, tier.aMax));
    const [p, q] = forcedRatio || pick(rng, tier.ratios);
    const w = [0, 1, 2].map(() => {
      let c = 0;
      while (c === 0) c = randInt(rng, tier.wMin, tier.wMax);
      return c;
    });

    // Bẫy tư duy: chỉ dùng cho phương trình tham số (phương trình chính tắc mẫu phải khác 0).
    if (eqForm === 'parametric' && rng() < tier.zeroProb) {
      const zeroAxis = pick(rng, knownAxes);
      w[zeroAxis] = 0;
    }
    if (eqForm === 'canonical' && w.some((c) => c === 0)) continue;
    // Phải có ít nhất 1 trục đã biết khác 0 để giải được t, và trục cần hỏi phải khác 0
    if (knownAxes.every((k) => w[k] === 0)) continue;
    if (w[askIndex] === 0) continue;

    // Bắt buộc các thành phần khác 0 có cả âm lẫn dương (trái dấu) và đủ lớn
    const nonZero = w.filter((c) => c !== 0);
    if (nonZero.every((c) => c > 0) && rng() < 0.85) {
      const idx = randInt(rng, 0, 2);
      if (w[idx] !== 0) w[idx] = -w[idx];
    }
    if (nonZero.filter((c) => Math.abs(c) >= 2).length < tier.minBig) continue;

    // Giữ w nguyên tố cùng nhau để tỉ số chia giữa AM và AB thực chất là p/q
    const gAll = gcd(gcd(w[0], w[1]), w[2]);
    if (gAll > 1) {
      for (let i = 0; i < 3; i++) w[i] /= gAll;
    }

    const AB = w.map((c) => c * q);
    const B = A.map((a, i) => a + AB[i]);
    const M = A.map((a, i) => a + p * w[i]);
    if ([...B, ...M].some((c) => Math.abs(c) > tier.maxCoord)) continue;

    const base = {
      A, B, M, AB,
      t: rat(p, q),
      askIndex,
      askAxis: AXIS_NAMES[askIndex],
      askLabel: AXIS_LABELS[askIndex],
      questionType,
      eqForm,
      hideB,
    };

    if (questionType === 'parallel_line') {
      const scale = pick(rng, [-2, -1, 1, 2]);
      return { ...base, parallelDir: w.map((c) => c * scale) };
    }

    if (questionType === 'plane_normal') {
      const nonZeroAxes = [0, 1, 2].filter((k) => w[k] !== 0);
      if (nonZeroAxes.length < 2) continue;
      const missingIdx = pick(rng, nonZeroAxes);
      const planeNormal = findPlaneNormal(rng, w, missingIdx);
      if (!planeNormal) continue;
      const dirTemplate = w.map((c, i) => (i === missingIdx ? null : c));
      return { ...base, planeNormal, missingIdx, dirTemplate };
    }

    return base;
  }
  // Dự phòng hiếm gặp (vẫn không dùng trung điểm)
  const fallback = {
    A: [2, -3, 1], B: [-4, 6, 10], M: [0, 0, 4], AB: [-6, 9, 9],
    t: rat(1, 3), askIndex: 2, askAxis: 'z', askLabel: 'cao độ z',
    questionType, eqForm, hideB,
  };
  if (questionType === 'parallel_line') return { ...fallback, parallelDir: [-2, 3, 3] };
  if (questionType === 'plane_normal') {
    return { ...fallback, planeNormal: [3, 1, 1], missingIdx: 2, dirTemplate: [-2, 3, null] };
  }
  return fallback;
}

/** Xáo trộn mảng theo rng (Fisher-Yates). */
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sinh cả bộ đề cho một học sinh, đảm bảo đa dạng tỉ số t, trục hỏi và dạng câu hỏi qua từng màn. */
export function generateRun(seed, totalLevels = 8) {
  const rng = makeRng(seed);
  const used = new Set();
  let lastZone = null; // 'nearA' | 'nearB' | 'outside'
  let lastAsk = -1;

  // Phân bố đều và ngẫu nhiên 4 dạng câu hỏi, tránh 2 màn liên tiếp trùng dạng.
  let types = [];
  while (types.length < totalLevels) {
    types.push(...shuffle(rng, QUESTION_TYPES));
  }
  types = types.slice(0, totalLevels);
  for (let i = 1; i < types.length; i++) {
    if (types[i] === types[i - 1]) {
      const swapIdx = types.findIndex((t, k) => k > i && t !== types[i - 1]);
      if (swapIdx !== -1) [types[i], types[swapIdx]] = [types[swapIdx], types[i]];
    }
  }

  return Array.from({ length: totalLevels }, (_, i) => {
    const tier = tierFor(i, totalLevels);
    const zoneOf = ([p, q]) => (p < 0 || p > q ? 'outside' : p / q < 0.5 ? 'nearA' : 'nearB');
    let candidates = tier.ratios.filter(([p, q]) => !used.has(`${p}/${q}`));
    if (candidates.length === 0) candidates = tier.ratios;
    const diffZone = candidates.filter((r) => zoneOf(r) !== lastZone);
    const pool = diffZone.length > 0 ? diffZone : candidates;
    const ratio = pick(rng, pool);
    used.add(`${ratio[0]}/${ratio[1]}`);
    lastZone = zoneOf(ratio);

    // Luân phiên hỏi x, y, z của M để học sinh không làm máy móc (màn 1 hỏi z, các màn sau đổi trục)
    const askChoices = i === 0 ? [2] : [0, 1, 2].filter((a) => a !== lastAsk);
    const askIndex = pick(rng, askChoices);
    lastAsk = askIndex;

    return generateLevel(rng, i, totalLevels, ratio, askIndex, types[i]);
  });
}

// ---------------------------------------------------------------------------
// Máy chấm (mục 5)
// ---------------------------------------------------------------------------

/**
 * Chấm câu a.
 * Đúng khi: (1) vectơ chỉ phương u ≠ 0 và u // AB (nếu chính tắc thì mọi thành phần u ≠ 0);
 *           (2) điểm gốc P nằm trên đường thẳng.
 *
 * @param {{A:number[], B:number[], eqForm?:string}} level
 * @param {{point:(string|number)[], dir:(string|number)[]}} answer  6 ô số học sinh nhập
 * @returns {{correct:boolean, reason:string, point?:number[], dir?:number[]}}
 *   reason ∈ 'ok' | 'invalid' | 'zero_dir' | 'zero_canonical_dir' | 'not_parallel' | 'point_off_line'
 */
export function gradeLine(level, answer) {
  const P = answer.point.map(parseRational);
  const u = answer.dir.map(parseRational);
  if ([...P, ...u].some((x) => x === null)) return { correct: false, reason: 'invalid' };

  const numeric = { point: P.map(ratToNumber), dir: u.map(ratToNumber) };
  const A = toRatVec(level.A);
  const AB = toRatVec(level.B.map((b, i) => b - level.A[i]));

  if (isZeroVec(u)) return { correct: false, reason: 'zero_dir', ...numeric };
  if (level?.eqForm === 'canonical' && u.some(isZero)) {
    return { correct: false, reason: 'zero_canonical_dir', ...numeric };
  }
  if (!parallel(u, AB)) return { correct: false, reason: 'not_parallel', ...numeric };
  const AP = P.map((x, i) => sub(x, A[i]));
  if (!parallel(AP, AB)) return { correct: false, reason: 'point_off_line', ...numeric };
  return { correct: true, reason: 'ok', ...numeric };
}

/**
 * Chấm câu b: so giá trị học sinh nhập với tọa độ cần tìm của M (mặc định là z nếu không có askIndex).
 * @returns {{correct:boolean, reason:string, z?:number}} reason ∈ 'ok' | 'invalid' | 'wrong'
 */
export function gradeZ(level, raw) {
  const z = parseRational(raw);
  if (z === null) return { correct: false, reason: 'invalid' };
  const idx = level.askIndex ?? 2;
  const ok = ratEq(z, rat(level.M[idx]));
  return { correct: ok, reason: ok ? 'ok' : 'wrong', z: ratToNumber(z) };
}

/** Lời nhắn sau khi chấm — giống cô giáo chỉ ra chỗ sai, không đưa đáp án. */
export function feedbackFor(part, reason, level = null) {
  const axis = level?.askAxis || 'z';
  const known = ['x', 'y', 'z'].filter((a) => a !== axis).join(' hoặc ');
  const qType = level?.questionType;
  const notParallelMsg = qType === 'parallel_line'
    ? 'Vectơ chỉ phương chưa cùng phương với vectơ chỉ phương của Δ.'
    : qType === 'plane_normal'
      ? 'Vectơ chỉ phương chưa đúng. Nhớ: d ⊂ (P) nên u · n = 0, nhân lại bằng 0 để giải thành phần còn thiếu.'
      : 'Vectơ chỉ phương chưa cùng phương với AB. Nhớ: AB = (xB − xA; yB − yA; zB − zA).';
  const offLineMsg = level?.hideB
    ? 'Vectơ đúng phương, nhưng điểm gốc chưa nằm trên đường thẳng d. Thử lấy chính điểm A.'
    : 'Vectơ đúng phương, nhưng điểm gốc chưa nằm trên đường AB. Thử lấy chính điểm A hoặc B.';
  const wrongBMsg = level?.eqForm === 'canonical'
    ? `Chưa đúng. Thay tọa độ đã biết (${known}) của M vào phương trình chính tắc để tìm ${axis}.`
    : `Chưa đúng. Thay tọa độ đã biết (${known}) của M vào phương trình để giải tìm t, rồi thay t vào phương trình của ${axis}.`;

  const msgs = {
    a: {
      ok: 'Chính xác! Dây đã bắn trúng cột bên kia.',
      invalid: 'Còn ô trống hoặc số chưa đọc được. Nhập số nguyên, phân số (1/2) hoặc thập phân (2,5).',
      zero_dir: 'Vectơ chỉ phương không được bằng vectơ 0.',
      zero_canonical_dir: 'Mẫu số (tọa độ vectơ chỉ phương) trong phương trình chính tắc phải khác 0.',
      not_parallel: notParallelMsg,
      point_off_line: offLineMsg,
    },
    b: {
      ok: 'Chính xác! Cột đỡ tại M đã dựng xong.',
      invalid: 'Chưa đọc được số. Nhập số nguyên, phân số hoặc thập phân.',
      wrong: wrongBMsg,
    },
  };
  return msgs[part][reason] || '';
}
