/**
 * view3d.js — Hình 3D nhỏ minh họa đường thẳng AB và điểm M trong không gian Oxyz (mục 6).
 * Tự xoay chậm; kéo chuột/ngón tay để xoay. Vẽ bằng canvas 2D (phép chiếu song song),
 * không cần thư viện 3D nên nhẹ trên máy cũ.
 */
import { formatPoint } from './math.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class View3D {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.yaw = -0.7;
    this.pitch = 0.45;
    this.auto = true;
    this.data = null;
    let drag = null;
    const down = (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; this.auto = false; };
    const move = (e) => {
      if (!drag) return;
      this.yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
      this.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.01, -0.2, 1.4);
      this.draw();
    };
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); down(e); });
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.style.touchAction = 'none';
    const tick = () => {
      if (this.auto && this.data && !document.hidden) { this.yaw += 0.006; this.draw(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /**
   * @param {object} d
   * @param {number[]} d.A
   * @param {number[]} d.B
   * @param {number[]|null} d.M         điểm M (hiện z nếu showZ)
   * @param {boolean} d.showZ
   * @param {{point:number[],dir:number[]}|null} d.wrongLine  đường học sinh nhập sai (vẽ đỏ)
   * @param {number[]|null} d.wrongM    điểm M học sinh nhập sai (vẽ đỏ)
   */
  show(d) {
    this.data = d;
    this.auto = true;
    this.draw();
  }

  _project(p) {
    const [x, y, z] = p.map((v, i) => v - this.center[i]);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const x1 = x * cy - y * sy;
    const y1 = x * sy + y * cy;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const sx = x1;
    const sz = z * cp + y1 * sp;
    return { x: this.cx + sx * this.scale, y: this.cy - sz * this.scale, depth: y1 * cp - z * sp };
  }

  draw() {
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(r.width * dpr)) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0c1130';
    g.fillRect(0, 0, W, H);
    const d = this.data;
    if (!d) return;

    const pts = [[0, 0, 0], d.A, d.B];
    if (d.M) pts.push(d.M);
    if (d.wrongM) pts.push(d.wrongM);
    const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
    const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
    this.center = lo.map((v, i) => (v + hi[i]) / 2);
    const span = Math.max(4, ...hi.map((v, i) => v - lo[i]));
    this.scale = Math.min(W, H) / (span * 1.55);
    this.cx = W / 2;
    this.cy = H / 2;

    const P = (p) => this._project(p);
    const line = (a, b, color, width = 1.5, dash = []) => {
      const p = P(a), q = P(b);
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      g.setLineDash([]);
    };
    const text = (p, s, color, dx = 6, dy = -6, align = 'left') => {
      const q = P(p);
      g.font = '600 11px system-ui, sans-serif';
      g.fillStyle = color;
      g.textAlign = align;
      g.fillText(s, q.x + dx, q.y + dy);
    };
    const dot = (p, color, rr = 4) => {
      const q = P(p);
      g.fillStyle = color;
      g.beginPath(); g.arc(q.x, q.y, rr, 0, Math.PI * 2); g.fill();
    };

    // Trục tọa độ
    const L = span * 0.75;
    const axes = [[[L, 0, 0], 'x', '#ff6b6b'], [[0, L, 0], 'y', '#6bff95'], [[0, 0, L], 'z', '#6bb5ff']];
    for (const [end, name, col] of axes) {
      line(end.map((v) => -v * 0.25), end, col + '99', 1);
      text(end, name, col, 3, 3);
    }
    text([0, 0, 0], 'O', '#aab', -12, 12);

    // Đường AB kéo dài (nét đứt) và đoạn AB (dây)
    const AB = d.B.map((b, i) => b - d.A[i]);
    const at = (t) => d.A.map((a, i) => a + t * AB[i]);
    line(at(-1.2), at(2.2), 'rgba(232,215,168,0.35)', 1, [4, 4]);
    line(d.A, d.B, '#e8d7a8', 2.5);

    // Đường học sinh nhập sai
    if (d.wrongLine) {
      const { point, dir } = d.wrongLine;
      const n = Math.hypot(...dir) || 1;
      const k = (span * 0.9) / n;
      line(point.map((p, i) => p - k * dir[i]), point.map((p, i) => p + k * dir[i]), '#ff5a5a', 2, [6, 3]);
      dot(point, '#ff5a5a', 3);
      text(point, 'đường của em', '#ff8a8a', 6, 12);
    }

    // A ghi bên trái, B và M bên phải để nhãn không chồng nhau khi các điểm gần nhau.
    dot(d.A, '#7ac8ff');
    text(d.A, `A${formatPoint(d.A)}`, '#7ac8ff', -7, 4, 'right');
    dot(d.B, '#ffb36b');
    text(d.B, `B${formatPoint(d.B)}`, '#ffb36b');

    if (d.M) {
      // Hình chiếu của M xuống mặt Oxy giúp thấy rõ vị trí trong không gian.
      const foot = [d.M[0], d.M[1], 0];
      line(foot, d.M, 'rgba(255,216,74,0.6)', 1, [2, 3]);
      dot(foot, 'rgba(255,216,74,0.5)', 2);
      dot(d.M, '#ffd84a', 4.5);
      const hideArg = d.showZ ? false : (d.askIndex ?? 2);
      text(d.M, `M${formatPoint(d.M, hideArg)}`, '#ffd84a', 7, 4);
    }
    if (d.wrongM) {
      line([d.wrongM[0], d.wrongM[1], 0], d.wrongM, 'rgba(255,90,90,0.5)', 1, [2, 3]);
      dot(d.wrongM, '#ff5a5a', 4);
      const ax = d.wrongAxis || 'z';
      const idx = d.askIndex ?? 2;
      text(d.wrongM, `${ax} = ${d.wrongM[idx]} (lệch khỏi dây)`, '#ff8a8a', 6, -8);
    }
  }
}
