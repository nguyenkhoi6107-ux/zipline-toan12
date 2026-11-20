/**
 * scene.js — Cảnh chơi 2D trên canvas (mục 6): đêm trăng tròn, vách núi, dây zip line,
 * nhân vật học sinh, hồ ly, và các hoạt cảnh đúng/sai.
 *
 * Cảnh chỉ minh họa; phần học nằm ở tọa độ số ghi cạnh A, B, M.
 * Mọi hoạt cảnh trả về Promise để bộ điều khiển await theo thứ tự.
 */
import { formatPoint } from './math.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;

/** PRNG nhỏ cho sao và núi (cố định giữa các khung hình). */
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export class Scene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{student:HTMLCanvasElement|null, fox:HTMLCanvasElement|null}} sprites
   */
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.anims = [];
    this.level = null;
    this.stage = 'line';
    this.isLast = false;
    this.monsterDist = 100;
    this.monsterMax = 140;
    this.ropeP = 0;
    this.wrongRope = null;
    this.poleM = { p: 0, wrongDy: 0 };
    this.char = { mode: 'stand', x: 0, y: 0, rot: 0, alpha: 1, ropeT: 0 };
    this.foxLunge = 0;
    this.flash = { a: 0, color: '255,40,40' };
    this.fade = 0;
    this.popups = [];
    this.confetti = [];
    this.ropeSnapAt = null;
    this.time = 0;
    this._resize();
    new ResizeObserver(() => this._resize()).observe(canvas);
    this._last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  // -------------------------------------------------------------------------
  // Bố cục
  // -------------------------------------------------------------------------

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(200, r.width);
    this.H = Math.max(120, r.height);
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._bg = this._renderBackground();
    this._layout();
  }

  _layout() {
    const { W, H } = this;
    const lv = this.level;
    const dz = lv ? lv.B[2] - lv.A[2] : 0;
    const tilt = clamp(dz / 10, -1, 1) * H * 0.07;
    const gA = H * 0.64 + tilt;
    const gB = H * 0.64 - tilt;
    const poleH = H * 0.26;
    const xA = W * 0.24;
    const xB = W * 0.78;
    const rawT = lv ? lv.t.n / lv.t.d : 0.4;
    // Giữ trụ đỡ M trong khoảng vực giữa hai vách đá (kể cả khi đề toán cho M chia ngoài đoạn AB)
    const t = clamp(rawT, 0.16, 0.84);
    this.L = {
      gA, gB, poleH, xA, xB,
      a: { x: xA, y: gA - poleH },
      b: { x: xB, y: gB - poleH },
      t,
      m: { x: lerp(xA, xB, t), y: lerp(gA - poleH, gB - poleH, t) },
      standX: xA - W * 0.075,
      charH: clamp(H * 0.26, 50, 150),
    };
    if (this.char.mode === 'stand' && !this.anims.length) this._placeStand();
  }

  _placeStand() {
    this.char.mode = 'stand';
    this.char.x = this.L.standX;
    this.char.y = this.L.gA;
    this.char.rot = 0;
  }

  /**
   * Nạp màn mới.
   * @param {object} level  đề {A,B,M,t}
   * @param {{stage:string, isLast:boolean}} opts
   */
  setLevel(level, { stage = 'line', isLast = false } = {}) {
    this.level = level;
    this.stage = stage;
    this.isLast = isLast;
    this.ropeP = stage === 'z' ? 1 : 0;
    this.poleM = { p: 0, wrongDy: 0 };
    this.wrongRope = null;
    this.ropeSnapAt = null;
    this.char.alpha = 1;
    this.char.mode = 'stand';
    this._layout();
    this._placeStand();
  }

  setStage(stage) { this.stage = stage; }

  setMonster(dist, max) {
    this.monsterDist = dist;
    this.monsterMax = max;
  }

  // -------------------------------------------------------------------------
  // Hoạt cảnh
  // -------------------------------------------------------------------------

  _tween(dur, fn) {
    return new Promise((resolve) => {
      this.anims.push({ t0: performance.now(), dur, fn, resolve });
    });
  }

  _wait(ms) { return this._tween(ms, () => {}); }

  popup(text, color = '#ffd84a') {
    this.popups.push({ text, color, t0: performance.now() });
  }

  /** Câu a đúng: dây bắn từ cột A trúng cột B. */
  async shootRope() {
    await this._tween(650, (p) => { this.ropeP = easeOut(p); });
    this.stage = 'z';
    this.popup('Trúng!', '#7dffb0');
  }

  /** Nhân vật đu theo một sợi dây sai rồi rơi xuống vực, sau đó quay lại chỗ cũ. */
  async _fallFrom(from, to, slideTo = 0.55) {
    const c = this.char;
    c.mode = 'hang';
    await this._tween(700, (p) => {
      const k = easeInOut(p) * slideTo;
      c.x = lerp(from.x, to.x, k);
      c.y = lerp(from.y, to.y, k);
    });
    this.wrongRope = this.wrongRope && { ...this.wrongRope, snapped: true };
    this.ropeSnapAt = { x: c.x, y: c.y };
    const x0 = c.x;
    const y0 = c.y;
    c.mode = 'fall';
    await this._tween(950, (p) => {
      c.x = x0 + p * 25;
      c.y = y0 + 1.4 * this.H * p * p;
      c.rot = p * 2.5;
      this.fade = clamp((p - 0.6) * 2.5, 0, 1);
    });
    this.wrongRope = null;
    this.ropeSnapAt = null;
    this.poleM.p = 0;
    this._placeStand();
    await this._tween(350, (p) => { this.fade = 1 - p; });
  }

  /** Câu a sai: dây bắn trật hướng. */
  async failLine() {
    const { a, b, gB } = this.L;
    const low = Math.random() < 0.6;
    // Trật xuống đâm vách đá, hoặc vọt quá lên trời.
    const target = low
      ? { x: b.x - this.W * 0.07, y: gB + this.H * 0.22 }
      : { x: b.x + this.W * 0.05, y: b.y - this.H * 0.32 };
    this.wrongRope = { from: a, to: target, p: 0 };
    await this._tween(550, (p) => { this.wrongRope.p = easeOut(p); });
    this.popup('Trật rồi!', '#ff7a7a');
    await this._fallFrom(a, target, 0.5);
  }

  /** Câu b sai: cột dựng sai tọa độ, dây đứt khi nhân vật tới M. */
  async failZ(valStudent) {
    const lv = this.level;
    const askIdx = lv.askIndex ?? 2;
    const diff = valStudent - lv.M[askIdx];
    this.poleM.wrongDy = clamp(-diff * this.H * 0.03, -this.H * 0.18, this.H * 0.18) || this.H * 0.06;
    if (Math.abs(this.poleM.wrongDy) < this.H * 0.05) this.poleM.wrongDy = Math.sign(this.poleM.wrongDy || 1) * this.H * 0.05;
    await this._tween(600, (p) => { this.poleM.p = easeOut(p); });
    this.popup('Cột lệch rồi!', '#ff7a7a');
    const { a, b, t } = this.L;
    await this._fallFrom(a, b, t);
  }

  /** Câu b đúng: dựng cột M rồi đu sang bờ bên kia. */
  async buildPoleAndZip() {
    this.poleM.wrongDy = 0;
    await this._tween(600, (p) => { this.poleM.p = easeOut(p); });
    this.popup('Cột vững!', '#7dffb0');
    const c = this.char;
    const { a, b, gB } = this.L;
    // Bước lên cột A
    await this._tween(300, (p) => { c.x = lerp(this.L.standX, a.x, p); c.y = lerp(this.L.gA, a.y, p); });
    c.mode = 'hang';
    await this._tween(1500, (p) => {
      const k = easeInOut(p);
      c.x = lerp(a.x, b.x, k);
      c.y = lerp(a.y, b.y, k);
      c.ropeT = k;
    });
    c.mode = 'stand';
    await this._tween(250, (p) => { c.x = b.x + p * this.W * 0.05; c.y = lerp(b.y, gB, p); });
    if (this.isLast) {
      this._burstConfetti();
      this.popup('VỀ ĐÍCH!', '#ffd84a');
      return;
    }
    await this._tween(450, (p) => { c.x = b.x + this.W * 0.05 + p * this.W * 0.3; this.fade = p; });
  }

  /** Sau khi chuyển màn: hiện dần cảnh mới. */
  async fadeIn() {
    await this._tween(350, (p) => { this.fade = 1 - p; });
  }

  /** Bị hồ ly bắt. */
  async caught(eliminated) {
    await this._tween(350, (p) => { this.foxLunge = easeOut(p); });
    this.flash.a = 0.8;
    this.popup(eliminated ? 'Bị bắt mất rồi!' : '−1 ♥', '#ff5a5a');
    await this._wait(500);
    if (!eliminated) await this._tween(450, (p) => { this.foxLunge = 1 - p; });
  }

  _burstConfetti() {
    const cols = ['#ffd84a', '#7dffb0', '#7ac8ff', '#ff8ad8', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      this.confetti.push({
        x: this.L.b.x, y: this.L.b.y,
        vx: (Math.random() - 0.5) * 320, vy: -Math.random() * 380 - 80,
        c: cols[i % cols.length], life: 2.5 + Math.random(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Vẽ
  // -------------------------------------------------------------------------

  _renderBackground() {
    const { W, H } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#090318');
    sky.addColorStop(0.35, '#1d082b');
    sky.addColorStop(0.7, '#421238');
    sky.addColorStop(1, '#130728');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    const rnd = seeded(7);
    for (let i = 0; i < 120; i++) {
      g.globalAlpha = 0.25 + rnd() * 0.7;
      g.fillStyle = '#ffeef8';
      const s = rnd() * 1.5 + 0.3;
      g.fillRect(rnd() * W, rnd() * H * 0.65, s, s);
    }
    g.globalAlpha = 1;

    // Trăng máu rực rỡ phía trên đỉnh núi tuyết
    const mx = W * 0.85;
    const my = H * 0.19;
    const mr = Math.min(W, H) * 0.11;
    const glow = g.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.8);
    glow.addColorStop(0, 'rgba(235, 38, 70, 0.52)');
    glow.addColorStop(0.5, 'rgba(180, 18, 48, 0.22)');
    glow.addColorStop(1, 'rgba(120, 10, 35, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    const moonGrad = g.createRadialGradient(mx - mr * 0.25, my - mr * 0.25, mr * 0.1, mx, my, mr);
    moonGrad.addColorStop(0, '#ff9c78');
    moonGrad.addColorStop(0.55, '#d11d3a');
    moonGrad.addColorStop(1, '#68071a');
    g.fillStyle = moonGrad;
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(75, 4, 18, 0.38)';
    g.beginPath(); g.arc(mx - mr * 0.28, my - mr * 0.18, mr * 0.22, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(mx + mr * 0.34, my + mr * 0.26, mr * 0.15, 0, Math.PI * 2); g.fill();

    // Dãy núi tuyết tím hồng phía xa (đồng bộ với Landing Page)
    const drawPeaks = (peaks, fill, snowFill) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(0, H);
      for (const [px, py] of peaks) g.lineTo(px * W, py * H);
      g.lineTo(W, H);
      g.closePath();
      g.fill();
      if (snowFill) {
        g.fillStyle = snowFill;
        for (let i = 1; i < peaks.length - 1; i += 2) {
          const [px, py] = peaks[i];
          g.beginPath();
          g.moveTo(px * W, py * H);
          g.lineTo((px - 0.055) * W, (py + 0.12) * H);
          g.lineTo(px * W, (py + 0.08) * H);
          g.lineTo((px + 0.055) * W, (py + 0.12) * H);
          g.closePath();
          g.fill();
        }
      }
    };
    drawPeaks(
      [[0, 0.56], [0.16, 0.28], [0.33, 0.54], [0.52, 0.21], [0.71, 0.52], [0.89, 0.31], [1, 0.52]],
      '#392168',
      'rgba(244, 236, 255, 0.72)',
    );
    drawPeaks(
      [[0, 0.64], [0.11, 0.48], [0.27, 0.62], [0.44, 0.44], [0.62, 0.60], [0.79, 0.46], [1, 0.62]],
      '#221147',
      null,
    );

    // Hàng thông phủ tuyết dọc chân núi
    for (let i = 0; i < 34; i++) {
      const tx = (i / 33) * W;
      const th = 22 + (i * 13) % 18;
      const ty = H * 0.63 + Math.sin(i * 0.8) * 6;
      g.fillStyle = i % 2 === 0 ? '#160a30' : '#110726';
      g.beginPath();
      g.moveTo(tx, ty - th);
      g.lineTo(tx - th * 0.38, ty + 8);
      g.lineTo(tx + th * 0.38, ty + 8);
      g.closePath();
      g.fill();
    }

    // Sương tím hồng dưới đáy vực
    const mist = g.createLinearGradient(0, H * 0.65, 0, H);
    mist.addColorStop(0, 'rgba(180, 120, 210, 0)');
    mist.addColorStop(1, 'rgba(195, 130, 215, 0.24)');
    g.fillStyle = mist;
    g.fillRect(0, H * 0.65, W, H * 0.35);
    return c;
  }

  _drawCliff(side) {
    const { ctx: g, W, H, L } = this;
    const top = side === 'left' ? L.gA : L.gB;
    const edge = side === 'left' ? L.xA + W * 0.06 : L.xB - W * 0.06;
    const r = seeded(side === 'left' ? 5 : 9);
    g.fillStyle = '#140a2e';
    g.beginPath();
    if (side === 'left') {
      g.moveTo(0, H); g.lineTo(0, top); g.lineTo(edge, top);
      for (let y = top; y < H; y += H * 0.08) g.lineTo(edge - r() * W * 0.04 - (y - top) * 0.12, y);
      g.lineTo(edge - W * 0.08, H);
    } else {
      g.moveTo(W, H); g.lineTo(W, top); g.lineTo(edge, top);
      for (let y = top; y < H; y += H * 0.08) g.lineTo(edge + r() * W * 0.04 + (y - top) * 0.12, y);
      g.lineTo(edge + W * 0.08, H);
    }
    g.closePath();
    g.fill();
    // Lớp tuyết trắng phủ dày trên mép vách đá
    g.strokeStyle = '#f3ecff';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    if (side === 'left') { g.moveTo(0, top); g.lineTo(edge, top); } else { g.moveTo(edge, top); g.lineTo(W, top); }
    g.stroke();
  }

  _drawPole(x, groundY, topY, color = '#8a5a34') {
    const g = this.ctx;
    g.strokeStyle = color;
    g.lineWidth = Math.max(4, this.W * 0.008);
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, groundY); g.lineTo(x, topY); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 10, groundY); g.lineTo(x, groundY - 18); g.lineTo(x + 10, groundY); g.stroke();
    g.fillStyle = '#d9d9d9';
    g.beginPath(); g.arc(x, topY, 4, 0, Math.PI * 2); g.fill();
  }

  _label(text, x, y, color = '#fff', bg = 'rgba(0,0,0,0.65)') {
    const g = this.ctx;
    const fs = clamp(this.W / 38, 11, 17);
    g.font = `600 ${fs}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const w = g.measureText(text).width + 10;
    const h = fs + 8;
    const bx = clamp(x - w / 2, 2, this.W - w - 2);
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect ? g.roundRect(bx, y - h / 2, w, h, 6) : g.rect(bx, y - h / 2, w, h);
    g.fill();
    g.fillStyle = color;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(text, bx + 5, y + 1);
  }

  _drawRope(from, to, p, color = '#e8d7a8', dashed = false) {
    const g = this.ctx;
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.setLineDash(dashed ? [6, 6] : []);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(lerp(from.x, to.x, p), lerp(from.y, to.y, p));
    g.stroke();
    g.setLineDash([]);
    if (p < 1) {
      g.fillStyle = '#cfd8e3';
      g.beginPath(); g.arc(lerp(from.x, to.x, p), lerp(from.y, to.y, p), 4, 0, Math.PI * 2); g.fill();
    }
  }

  _drawSprite(img, x, footY, h, { rot = 0, alpha = 1, flip = false, fallbackColor = '#5b8' } = {}) {
    const g = this.ctx;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, footY - h / 2);
    g.rotate(rot);
    if (flip) g.scale(-1, 1);
    if (img) {
      const w = (h * img.width) / img.height;
      g.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      g.fillStyle = fallbackColor;
      g.fillRect(-h * 0.2, -h / 2, h * 0.4, h);
    }
    g.restore();
  }

  _drawChar() {
    const { char: c, L } = this;
    const h = L.charH;
    if (c.mode === 'stand') {
      const bob = Math.abs(Math.sin(this.time * 9)) * 3;
      this._drawSprite(this.sprites.student, c.x, c.y - bob, h, { alpha: c.alpha });
    } else {
      // Treo trên ròng rọc
      const g = this.ctx;
      g.strokeStyle = '#aab';
      g.lineWidth = 2;
      if (c.mode === 'hang') {
        g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x - 8, c.y + h * 0.22); g.moveTo(c.x, c.y); g.lineTo(c.x + 8, c.y + h * 0.22); g.stroke();
        g.fillStyle = '#ccd';
        g.beginPath(); g.arc(c.x, c.y, 5, 0, Math.PI * 2); g.fill();
      }
      this._drawSprite(this.sprites.student, c.x, c.y + h * 1.12, h, { rot: c.rot + (c.mode === 'hang' ? -0.12 : 0), alpha: c.alpha });
    }
  }

  _drawFox() {
    const { L, W } = this;
    const h = L.charH * 1.1;
    const d = this.monsterDist;
    const near = L.standX - h * 0.45;
    // 60 m trở xuống thì hồ ly hiện trên vách; xa hơn chỉ thấy đôi mắt đỏ trong bóng tối.
    let x = near - (d / 60) * (near + h * 0.6);
    x = lerp(x, near + h * 0.15, this.foxLunge);
    if (d > 60 && !this.foxLunge) {
      const a = clamp((this.monsterMax - d) / (this.monsterMax - 60), 0.15, 1);
      const g = this.ctx;
      const y = L.gA - h * 0.75;
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
      g.fillStyle = `rgba(255,60,40,${a * pulse})`;
      g.shadowColor = 'red';
      g.shadowBlur = 10;
      g.beginPath(); g.ellipse(14, y, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(28, y, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      return;
    }
    const bob = Math.abs(Math.sin(this.time * 7)) * 4;
    if (x > -W) this._drawSprite(this.sprites.fox, x, L.gA - bob, h, { fallbackColor: '#e70' });
  }

  _drawFinish() {
    const { ctx: g, L, W } = this;
    const x = L.xB + W * 0.12;
    const y = L.gB;
    g.fillStyle = '#2b1e14';
    g.fillRect(x - 22, y - 34, 44, 34);
    g.fillStyle = '#ffcf6a';
    g.fillRect(x - 6, y - 20, 12, 20);
    g.fillStyle = '#4a2f1f';
    g.beginPath(); g.moveTo(x - 30, y - 34); g.lineTo(x, y - 56); g.lineTo(x + 30, y - 34); g.fill();
    g.strokeStyle = '#ccc'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 34, y); g.lineTo(x + 34, y - 64); g.stroke();
    g.fillStyle = '#ff4d4d';
    g.beginPath(); g.moveTo(x + 34, y - 64); g.lineTo(x + 58, y - 56); g.lineTo(x + 34, y - 48); g.fill();
    this._label('ĐÍCH', x, y - 72, '#ffd84a');
  }

  _draw() {
    const { ctx: g, W, H, L, level } = this;
    g.drawImage(this._bg, 0, 0, W, H);
    if (!level) return;

    this._drawCliff('left');
    this._drawCliff('right');
    if (this.isLast) this._drawFinish();

    this._drawPole(L.a.x, L.gA, L.a.y);
    this._drawPole(L.b.x, L.gB, L.b.y);

    // Cột đỡ M mọc từ đáy vực
    if (this.poleM.p > 0) {
      const topY = L.m.y + this.poleM.wrongDy;
      const y = lerp(H + 10, topY, this.poleM.p);
      const g2 = this.ctx;
      g2.strokeStyle = this.poleM.wrongDy ? '#a05050' : '#9c6a3c';
      g2.lineWidth = Math.max(5, W * 0.01);
      g2.beginPath(); g2.moveTo(L.m.x, H + 10); g2.lineTo(L.m.x, y); g2.stroke();
      g2.lineWidth = 2;
      for (let yy = H; yy > y + 14; yy -= 22) {
        g2.beginPath(); g2.moveTo(L.m.x - 9, yy); g2.lineTo(L.m.x + 9, yy - 18); g2.stroke();
      }
    }

    // Dây đúng (đứt ở chỗ nhân vật nếu đang rơi ở câu b)
    if (this.ropeP > 0) {
      if (this.ropeSnapAt && !this.wrongRope) {
        this._drawRope(L.a, this.ropeSnapAt, 1);
      } else {
        this._drawRope(L.a, L.b, this.ropeP);
      }
    }
    if (this.wrongRope && !this.wrongRope.snapped) {
      this._drawRope(this.wrongRope.from, this.wrongRope.to, this.wrongRope.p, '#ff8a7a');
    } else if (this.wrongRope && this.ropeSnapAt) {
      this._drawRope(this.wrongRope.from, this.ropeSnapAt, 1, '#ff8a7a');
    }

    // Nhãn tọa độ
    const lv = level;
    this._label(`A${formatPoint(lv.A)}`, L.a.x, L.a.y - 22, '#7ac8ff');
    this._label(lv.hideB ? 'Cột B' : `B${formatPoint(lv.B)}`, L.b.x, L.b.y - 22, '#ffb36b');
    if (this.stage === 'z' || this.poleM.p > 0) {
      const pulse = 5 + Math.sin(this.time * 5) * 2;
      g.strokeStyle = '#ffd84a';
      g.lineWidth = 2;
      g.setLineDash([3, 3]);
      g.beginPath(); g.arc(L.m.x, L.m.y, pulse + 3, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#ffd84a';
      g.beginPath(); g.arc(L.m.x, L.m.y, 3.5, 0, Math.PI * 2); g.fill();
      const hideArg = this.poleM.p < 1 || !!this.poleM.wrongDy ? (lv.askIndex ?? 2) : false;
      this._label(`M${formatPoint(lv.M, hideArg)}`, L.m.x, L.m.y - 24, '#ffd84a');
    }

    this._drawFox();
    this._drawChar();

    // Hạt pháo giấy
    for (const p of this.confetti) {
      g.fillStyle = p.c;
      g.fillRect(p.x, p.y, 5, 3);
    }

    // Chữ bật lên
    const now = performance.now();
    this.popups = this.popups.filter((p) => now - p.t0 < 1300);
    for (const p of this.popups) {
      const k = (now - p.t0) / 1300;
      g.globalAlpha = 1 - k;
      const fs = clamp(W / 18, 18, 40);
      g.font = `800 ${fs}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.strokeText(p.text, W / 2, H * 0.3 - k * 30);
      g.fillStyle = p.color;
      g.fillText(p.text, W / 2, H * 0.3 - k * 30);
      g.globalAlpha = 1;
    }

    if (this.flash.a > 0) {
      g.fillStyle = `rgba(${this.flash.color},${this.flash.a * 0.5})`;
      g.fillRect(0, 0, W, H);
    }
    if (this.fade > 0) {
      g.fillStyle = `rgba(0,0,0,${this.fade})`;
      g.fillRect(0, 0, W, H);
    }
  }

  _loop(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.time += dt;
    for (const a of [...this.anims]) {
      const p = clamp((now - a.t0) / a.dur, 0, 1);
      a.fn(p);
      if (p >= 1) {
        this.anims.splice(this.anims.indexOf(a), 1);
        a.resolve();
      }
    }
    this.flash.a = Math.max(0, this.flash.a - dt * 1.5);
    for (const p of this.confetti) {
      p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    }
    this.confetti = this.confetti.filter((p) => p.life > 0);
    this._draw();
    requestAnimationFrame((t) => this._loop(t));
  }
}
