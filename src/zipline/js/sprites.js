/**
 * sprites.js — Cắt nhân vật từ ảnh tờ thiết kế (4 tư thế trên nền đen) và xóa nền.
 *
 * Ảnh gốc: assets/student-sheet.png, assets/fox-sheet.png (1024×1024, lưới 2×2).
 * Dùng ô dưới-phải của mỗi tờ (nhân vật quay sang phải, hướng chạy của game).
 * Nền đen được xóa bằng loang màu (flood fill) từ mép ảnh nên viền tối bên trong nhân vật giữ nguyên.
 */

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * @param {HTMLImageElement} img
 * @param {{x:number,y:number,w:number,h:number}} rect   vùng cắt (theo pixel ảnh gốc)
 * @param {{x:number,y:number,w:number,h:number}[]} erase  vùng xóa thêm (ví dụ dấu logo), theo tọa độ ảnh gốc
 * @returns {HTMLCanvasElement} đã cắt sát nhân vật
 */
export function extract(img, rect, erase = []) {
  const c = document.createElement('canvas');
  c.width = rect.w;
  c.height = rect.h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const data = ctx.getImageData(0, 0, rect.w, rect.h);
  const px = data.data;
  const W = rect.w;
  const H = rect.h;
  const lum = (i) => Math.max(px[i], px[i + 1], px[i + 2]);

  // Xóa dấu logo lấp lánh ở góc (màu xám, không bão hòa).
  for (const e of erase) {
    for (let y = Math.max(0, e.y - rect.y); y < Math.min(H, e.y - rect.y + e.h); y++) {
      for (let x = Math.max(0, e.x - rect.x); x < Math.min(W, e.x - rect.x + e.w); x++) {
        const i = (y * W + x) * 4;
        const mx = Math.max(px[i], px[i + 1], px[i + 2]);
        const mn = Math.min(px[i], px[i + 1], px[i + 2]);
        if (mx - mn < 30) { px[i] = px[i + 1] = px[i + 2] = 0; }
      }
    }
  }

  // Loang từ mép: pixel gần đen nối với mép là nền.
  const TH = 30;
  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (bg[k] || lum(k * 4) > TH) return;
    bg[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const k = stack.pop();
    const x = k % W;
    const y = (k - x) / W;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (bg[k]) { px[k * 4 + 3] = 0; continue; }
      // Làm mềm viền: pixel tối sát nền thì bán trong suốt.
      const nearBg = (x > 0 && bg[k - 1]) || (x < W - 1 && bg[k + 1]) || (y > 0 && bg[k - W]) || (y < H - 1 && bg[k + W]);
      if (nearBg) px[k * 4 + 3] = Math.min(255, lum(k * 4) * 4);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(data, 0, 0);

  const out = document.createElement('canvas');
  out.width = Math.max(1, maxX - minX + 1);
  out.height = Math.max(1, maxY - minY + 1);
  out.getContext('2d').drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Tải và chuẩn bị sprite. Trả về {student, fox} là canvas nền trong suốt.
 * Nếu tải lỗi, trả về null cho sprite đó (cảnh sẽ vẽ hình thay thế).
 */
export async function loadSprites(base = 'assets/') {
  const logo = [{ x: 868, y: 868, w: 70, h: 64 }];
  // Bắt đầu từ x = 530 để không dính chóp đuôi của tư thế dưới-trái.
  const quad = { x: 530, y: 512, w: 494, h: 512 };
  const [s, f] = await Promise.allSettled([
    loadImage(base + 'student-sheet.png'),
    loadImage(base + 'fox-sheet.png'),
  ]);
  return {
    student: s.status === 'fulfilled' ? extract(s.value, quad, logo) : null,
    fox: f.status === 'fulfilled' ? extract(f.value, quad, logo) : null,
  };
}
