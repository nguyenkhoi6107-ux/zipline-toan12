/**
 * landing.js — Bối cảnh đêm cắm trại núi tuyết 5 lớp chiều sâu & phim cuộn chuột (scroll film) cho Foxy Running.
 *
 * Cấu trúc cuộn chuột (progress p từ 0.0 -> 1.0):
 *  - Act I   (0.00 - 0.18): Hero Foxy Running & khu cắm trại núi tuyết dưới ánh trăng.
 *  - Act II  (0.18 - 0.36): Khung cảnh mọi người vui vẻ bên lửa trại, nướng kẹo dẻo, trò chuyện.
 *  - Act III (0.36 - 0.56): Trăng hóa đỏ, bóng hồ ly in trên vách lều, một người biến thành cáo.
 *  - Act IV  (0.56 - 0.80): Mọi người hoảng loạn bỏ chạy băng qua rừng thông sâu, hồ ly đuổi sát.
 *  - Act V   (0.80 - 1.00): Tới vách vực Zip Line & khu vực bắt đầu trò chơi (Tạo phòng chơi / Luyện tập).
 */

import { getBackend } from './net.js';
import { loadImage, extract } from './sprites.js';
import { initBloodMoonPortal, navigateWithBloodMoon } from './portal.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smooth = (t) => t * t * (3 - 2 * t);
const band = (p, a, b, c, d) => smooth(invLerp(a, b, p)) * (1 - smooth(invLerp(c, d, p)));

// ---------------------------------------------------------------------------
// 1. Xây dựng 5 lớp SVG phong cảnh: Núi tuyết trắng, Rừng thông, Lều trại, Vách vực
// ---------------------------------------------------------------------------
function buildWorldSVG() {
  // Lớp 1: Dãy núi tuyết trắng hùng vĩ phía xa (W = 3600, H = 1000)
  document.getElementById('L-far').innerHTML = `
  <svg viewBox="0 0 3600 1000" preserveAspectRatio="none">
    <defs>
      <linearGradient id="mFar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f7f2ff"/>
        <stop offset="32%" stop-color="#cbb8ee"/>
        <stop offset="72%" stop-color="#5d3f9e"/>
        <stop offset="100%" stop-color="#2a1758"/>
      </linearGradient>
      <linearGradient id="mShadow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8b72c9" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#24134f" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="snowCap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="65%" stop-color="#efe8ff"/>
        <stop offset="100%" stop-color="#bca6ea" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Dãy đỉnh tuyết trắng nối tiếp -->
    <polygon points="-120,860 320,310 760,860" fill="url(#mFar)"/>
    <polygon points="320,310 760,860 510,860" fill="url(#mShadow)"/>
    <polygon points="320,310 190,475 265,455 320,515 390,460 445,480" fill="url(#snowCap)"/>

    <polygon points="480,860 1060,155 1660,860" fill="url(#mFar)"/>
    <polygon points="1060,155 1660,860 1240,860" fill="url(#mShadow)"/>
    <polygon points="1060,155 860,390 955,355 1045,435 1135,365 1255,405" fill="url(#snowCap)"/>

    <polygon points="1340,860 1920,235 2480,860" fill="url(#mFar)"/>
    <polygon points="1920,235 2480,860 2080,860" fill="url(#mShadow)"/>
    <polygon points="1920,235 1750,435 1840,405 1925,470 2015,405 2095,440" fill="url(#snowCap)"/>

    <polygon points="2180,860 2820,175 3490,860" fill="url(#mFar)"/>
    <polygon points="2820,175 3490,860 3010,860" fill="url(#mShadow)"/>
    <polygon points="2820,175 2625,400 2735,370 2825,450 2930,380 3030,415" fill="url(#snowCap)"/>
  </svg>`;

  // Lớp 2: Sườn núi trung cảnh + đền canh gác cổ trên đỉnh tuyết
  let midPines = '';
  for (let i = 0; i < 68; i++) {
    const x = i * 64 + (i % 3) * 17;
    const h = 58 + (i * 29) % 55;
    const y = 735 - Math.sin(i * 0.42) * 38;
    midPines += `<polygon points="${x},${y - h} ${x - h * 0.28},${y + 20} ${x + h * 0.28},${y + 20}" fill="#2b1757"/>`;
  }
  document.getElementById('L-mid').innerHTML = `
  <svg viewBox="0 0 4300 1000" preserveAspectRatio="none">
    <defs>
      <linearGradient id="mMid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6847ab"/>
        <stop offset="45%" stop-color="#371f6e"/>
        <stop offset="100%" stop-color="#190d3a"/>
      </linearGradient>
    </defs>
    <path d="M-100,880 L180,540 L480,455 L820,600 L1280,470 L1720,620 L2180,420 L2680,610 L3160,445 L3680,595 L4120,460 L4400,880 Z" fill="url(#mMid)"/>
    <!-- Tuyết đọng trên sống núi trung cảnh -->
    <path d="M480,455 L385,482 L445,495 L485,475 L575,512 L525,470 Z" fill="#efe7ff" opacity="0.65"/>
    <path d="M1280,470 L1185,505 L1255,515 L1305,492 L1395,525 L1340,485 Z" fill="#efe7ff" opacity="0.6"/>
    <path d="M2180,420 L2075,468 L2155,475 L2205,450 L2300,492 L2245,442 Z" fill="#efe7ff" opacity="0.7"/>
    <path d="M3160,445 L3060,485 L3145,495 L3240,472 Z" fill="#efe7ff" opacity="0.65"/>

    <!-- Vọng lâu cổ kính đặt vững chãi trên đỉnh núi tuyết (x = 480, y = 455) -->
    <g transform="translate(455,392)">
      <!-- Bệ đá và bậc thang dẫn xuống sườn núi -->
      <polygon points="-28,64 78,64 92,86 -42,86" fill="#2a1654"/>
      <polygon points="10,64 40,64 56,92 -6,92" fill="#d8caf2" opacity="0.75"/>
      <!-- Chân cột sàn gỗ -->
      <rect x="-18" y="48" width="8" height="18" fill="#180b36"/>
      <rect x="60" y="48" width="8" height="18" fill="#180b36"/>
      <rect x="-24" y="44" width="98" height="6" rx="2" fill="#3a1e6d"/>
      <!-- Thân đền & cửa sáng ánh lửa -->
      <rect x="-12" y="16" width="74" height="30" fill="#1b0e3d"/>
      <rect x="14" y="22" width="22" height="22" rx="2" fill="#ffb86b" class="lamp"/>
      <!-- Mái cong Á Đông phủ tuyết trắng -->
      <path d="M-46,18 Q25,-12 96,18 L78,26 L-28,26 Z" fill="#23124b"/>
      <path d="M-38,16 Q25,-8 88,16" stroke="#f3ecff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <!-- Chóp tháp nhọn -->
      <polygon points="25,-42 19,4 31,4" fill="#1b0e3d"/>
      <circle cx="-40" cy="23" r="4" fill="#ffd27d" class="lamp"/>
      <circle cx="90" cy="23" r="4" fill="#ffd27d" class="lamp"/>
    </g>
    ${midPines}
  </svg>`;

  // Lớp 3: Rừng thông dày đặc có phủ tuyết trắng + những cặp mắt hồ ly thấp thoáng trong bóng tối
  let trees = '';
  let eyes = '';
  for (let i = 0; i < 82; i++) {
    const x = i * 68 + ((i * 19) % 37);
    const scale = 0.75 + ((i * 13) % 45) / 100;
    const baseY = 785 + Math.sin(i * 0.65) * 18;
    const h = 210 * scale;
    const w = 62 * scale;
    const shade = i % 2 === 0 ? '#180c38' : '#12082c';
    trees += `
      <g transform="translate(${x},${baseY})">
        <polygon points="0,${-h} ${-w * 0.55},${-h * 0.55} ${-w * 0.25},${-h * 0.58} ${-w * 0.8},${-h * 0.22} ${-w * 0.35},${-h * 0.25} ${-w},${h * 0.08} ${w},${h * 0.08} ${w * 0.35},${-h * 0.25} ${w * 0.8},${-h * 0.22} ${w * 0.25},${-h * 0.58} ${w * 0.55},${-h * 0.55}" fill="${shade}"/>
        <polygon points="0,${-h} ${-w * 0.44},${-h * 0.62} ${0},${-h * 0.67} ${w * 0.44},${-h * 0.62}" fill="#e6dcff" opacity="0.72"/>
        <polygon points="${-w * 0.26},${-h * 0.55} ${-w * 0.68},${-h * 0.28} ${0},${-h * 0.35} ${w * 0.68},${-h * 0.28} ${w * 0.26},${-h * 0.55}" fill="#d8c8fa" opacity="0.45"/>
      </g>`;
    if (i > 18 && i < 72 && i % 5 === 0) {
      const ey = baseY - 45 - (i % 3) * 24;
      const delay = (i * 0.37).toFixed(1);
      eyes += `
        <g class="eye" style="animation-delay:${delay}s">
          <ellipse cx="${x - 8}" cy="${ey}" rx="4.5" ry="2.2" fill="#ff2e4c"/>
          <ellipse cx="${x + 8}" cy="${ey}" rx="4.5" ry="2.2" fill="#ff2e4c"/>
        </g>`;
    }
  }
  document.getElementById('L-forest').innerHTML = `
  <svg viewBox="0 0 5600 1000" preserveAspectRatio="none">
    <path d="M-100,980 L-100,765 Q700,720 1400,765 T2800,755 T4200,768 T5700,750 L5700,980 Z" fill="#13092e"/>
    ${trees}
    <g id="forestEyes" opacity="0">${eyes}</g>
  </svg>`;

  // Lớp 4 (Mặt đất chính): Khu đất cắm trại phủ tuyết trắng, 2 chiếc lều phát sáng, lửa trại bập bùng,
  // bóng hồ ly 9 đuôi in lên vách lều, con đường tuyết chạy xuyên rừng và Vách vực Zip Line ở cuối
  document.getElementById('L-ground').innerHTML = `
  <svg viewBox="0 0 6400 1000" preserveAspectRatio="none">
    <defs>
      <linearGradient id="snowGround" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f3ecff"/>
        <stop offset="28%" stop-color="#cdb9f0"/>
        <stop offset="70%" stop-color="#53378e"/>
        <stop offset="100%" stop-color="#14092d"/>
      </linearGradient>
      <radialGradient id="campGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffae52" stop-opacity="0.85"/>
        <stop offset="45%" stop-color="#ff5e3a" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#ff5e3a" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="bloodGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff1e42" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="#9c0b26" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#520011" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="tentWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffdca8"/>
        <stop offset="55%" stop-color="#f59b4c"/>
        <stop offset="100%" stop-color="#9e3d28"/>
      </linearGradient>
      <linearGradient id="tentOuter" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#6b52a8"/>
        <stop offset="100%" stop-color="#2a1858"/>
      </linearGradient>
    </defs>

    <!-- Hồ băng phản chiếu ánh trăng ở phía trái -->
    <ellipse cx="420" cy="835" rx="460" ry="55" fill="#23144d"/>
    <ellipse cx="380" cy="835" rx="180" ry="32" fill="#f7deb8" opacity="0.22"/>

    <!-- Triền tuyết trắng trải dài từ khu cắm trại tới bờ vực (x: 0 -> 5180) -->
    <path d="M-120,1000 L-120,825 Q380,745 980,770 Q1680,795 2320,765 Q3050,735 3780,775 Q4480,805 5160,765 L5240,1000 Z" fill="url(#snowGround)"/>
    <!-- Lớp tuyết trắng sáng trên mép đồi -->
    <path d="M-120,825 Q380,745 980,770 Q1680,795 2320,765 Q3050,735 3780,775 Q4480,805 5160,765 L5160,792 Q4480,832 3780,800 Q3050,762 2320,790 Q1680,820 980,795 Q380,770 -120,848 Z" fill="#ffffff" opacity="0.82"/>

    <!-- ============ KHU CẮM TRẠI (x ~ 520 .. 2100) ============ -->
    <!-- Cây cầu gỗ nhỏ bắc qua suối tuyết (lấy cảm hứng từ ảnh Kamui) -->
    <g transform="translate(360,742)">
      <path d="M0,45 Q130,-18 260,45" stroke="#3b204d" stroke-width="14" fill="none"/>
      <path d="M0,22 Q130,-42 260,22" stroke="#59326b" stroke-width="6" fill="none"/>
      <line x1="35" y1="12" x2="35" y2="34" stroke="#472659" stroke-width="5"/>
      <line x1="80" y1="-2" x2="80" y2="22" stroke="#472659" stroke-width="5"/>
      <line x1="130" y1="-8" x2="130" y2="18" stroke="#472659" stroke-width="5"/>
      <line x1="180" y1="-2" x2="180" y2="22" stroke="#472659" stroke-width="5"/>
      <line x1="225" y1="12" x2="225" y2="34" stroke="#472659" stroke-width="5"/>
      <path d="M4,20 Q130,-43 256,20" stroke="#f7f1ff" stroke-width="3" fill="none" opacity="0.85"/>
    </g>

    <!-- Đèn đá cổ bên suối -->
    <g transform="translate(650,715)">
      <polygon points="0,70 36,70 30,42 6,42" fill="#23144a"/>
      <rect x="8" y="22" width="20" height="20" fill="#1a0e38"/>
      <rect x="12" y="26" width="12" height="12" fill="#ffbe6b" class="lamp"/>
      <polygon points="-6,22 18,6 42,22" fill="#2e1b5e"/>
      <path d="M-4,21 L18,7 L40,21" stroke="#f4edff" stroke-width="3" fill="none"/>
    </g>

    <!-- Lều nhỏ phía xa -->
    <g transform="translate(820,665)">
      <polygon points="0,105 95,15 190,105" fill="#3a256e"/>
      <polygon points="95,15 190,105 135,105" fill="#23144a"/>
      <polygon points="75,105 95,52 115,105" fill="#ffae5c" opacity="0.75"/>
      <path d="M0,105 L95,15 L142,60" stroke="#f6f0ff" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>

    <!-- Quầng sáng lửa trại trên nền tuyết -->
    <ellipse id="campFireHalo" class="fire-glow" cx="1235" cy="785" rx="370" ry="110" fill="url(#campGlow)"/>
    <ellipse id="campBloodHalo" cx="1235" cy="785" rx="420" ry="135" fill="url(#bloodGlow)" opacity="0"/>

    <!-- LỀU CHÍNH PHÁT SÁNG (x ~ 1470) — nơi bóng người bạn hóa thành Hồ Ly 9 đuôi -->
    <g id="mainTent" transform="translate(1450,565)">
      <!-- Dây chằng lều -->
      <line x1="-55" y1="215" x2="55" y2="115" stroke="#8a74bd" stroke-width="2" opacity="0.6"/>
      <line x1="435" y1="215" x2="325" y2="115" stroke="#8a74bd" stroke-width="2" opacity="0.6"/>
      <!-- Thân lều vòm -->
      <path d="M0,215 Q55,35 190,10 Q325,35 380,215 Z" fill="url(#tentOuter)"/>
      <!-- Vách lều phát sáng ấm từ đèn bên trong -->
      <path d="M28,210 Q78,55 190,28 Q302,55 352,210 Z" fill="url(#tentWall)"/>
      <!-- Khung xương lều -->
      <path d="M28,210 Q185,40 305,210" stroke="#431c2c" stroke-width="4" fill="none" opacity="0.55"/>
      <path d="M352,210 Q195,40 75,210" stroke="#431c2c" stroke-width="4" fill="none" opacity="0.55"/>
      <!-- Tuyết trắng đọng dày trên nóc lều -->
      <path d="M52,95 Q120,18 190,10 Q265,18 328,95 Q285,68 242,74 Q190,42 142,74 Q95,68 52,95 Z" fill="#ffffff" opacity="0.92"/>

      <!-- Bóng người bạn ngồi trong lều -> biến thành bóng Hồ Ly có tai nhọn & đuôi xù khi cuộn chuột -->
      <g id="tentHumanShadow" transform="translate(185,125)" opacity="0.55">
        <ellipse cx="0" cy="52" rx="34" ry="38" fill="#3a121b"/>
        <circle cx="0" cy="2" r="20" fill="#3a121b"/>
      </g>
      <g id="tentFoxShadow" transform="translate(185,118)" opacity="0">
        <!-- 5 chiếc đuôi hồ ly xòe ra trên vách lều -->
        <path d="M10,65 Q75,10 110,-25 Q95,35 35,78 Z" fill="#1e030b"/>
        <path d="M12,72 Q95,40 135,15 Q105,68 35,84 Z" fill="#1e030b"/>
        <path d="M-10,65 Q-75,10 -110,-25 Q-95,35 -35,78 Z" fill="#1e030b"/>
        <path d="M-12,72 Q-95,40 -135,15 Q-105,68 -35,84 Z" fill="#1e030b"/>
        <path d="M0,58 Q0,-35 22,-55 Q32,-5 12,62 Z" fill="#1e030b"/>
        <!-- Đầu cáo có 2 tai nhọn hoắt -->
        <polygon points="-24,10 -34,-42 -4,-8" fill="#1e030b"/>
        <polygon points="24,10 34,-42 4,-8" fill="#1e030b"/>
        <ellipse cx="0" cy="18" rx="28" ry="24" fill="#1e030b"/>
        <ellipse cx="0" cy="64" rx="40" ry="36" fill="#1e030b"/>
        <!-- Đôi mắt đỏ rực phát sáng qua vải lều -->
        <ellipse cx="-10" cy="15" rx="5" ry="2.5" fill="#ff1e42"/>
        <ellipse cx="10" cy="15" rx="5" ry="2.5" fill="#ff1e42"/>
      </g>

      <!-- Cửa lều mở hé -->
      <path d="M115,212 L162,92 L208,212 Z" fill="#2c0b16"/>
      <path d="M115,212 L162,92 L138,212 Z" fill="#ffbe6b" opacity="0.7"/>
    </g>

    <!-- Dây đèn lồng treo giữa lều và cây thông -->
    <path d="M1010,685 Q1230,720 1465,670" stroke="#3a235c" stroke-width="2.5" fill="none"/>
    <circle cx="1085" cy="698" r="6" fill="#ffd27d" class="lamp"/>
    <circle cx="1165" cy="705" r="6" fill="#ff9a52" class="lamp"/>
    <circle cx="1245" cy="706" r="6" fill="#ffd27d" class="lamp"/>
    <circle cx="1325" cy="700" r="6" fill="#ff9a52" class="lamp"/>
    <circle cx="1400" cy="686" r="6" fill="#ffd27d" class="lamp"/>

    <!-- Ghế cắm trại & khúc gỗ quanh đống lửa -->
    <g transform="translate(1045,738)">
      <path d="M0,42 L18,0 L56,12 L46,48 Z" fill="#b84a39"/>
      <line x1="6" y1="42" x2="0" y2="58" stroke="#2c1744" stroke-width="4"/>
      <line x1="44" y1="46" x2="52" y2="60" stroke="#2c1744" stroke-width="4"/>
    </g>
    <g transform="translate(1355,742) scale(-1,1)">
      <path d="M0,42 L18,0 L56,12 L46,48 Z" fill="#d96b43"/>
      <line x1="6" y1="42" x2="0" y2="58" stroke="#2c1744" stroke-width="4"/>
      <line x1="44" y1="46" x2="52" y2="60" stroke="#2c1744" stroke-width="4"/>
    </g>

    <!-- ĐỐNG LỬA TRẠI BẬP BÙNG (x = 1225, y = 780) -->
    <g id="bonfire" transform="translate(1225,782)">
      <!-- Vòng đá & củi -->
      <ellipse cx="0" cy="14" rx="74" ry="20" fill="#20113d"/>
      <rect x="-48" y="-4" width="96" height="14" rx="7" transform="rotate(-14)" fill="#4d2433"/>
      <rect x="-48" y="-4" width="96" height="14" rx="7" transform="rotate(16)" fill="#3b1929"/>
      <ellipse cx="-52" cy="12" rx="14" ry="9" fill="#3a2863"/>
      <ellipse cx="-26" cy="18" rx="16" ry="10" fill="#4b357a"/>
      <ellipse cx="4" cy="20" rx="15" ry="9" fill="#35235c"/>
      <ellipse cx="34" cy="17" rx="16" ry="10" fill="#4b357a"/>
      <ellipse cx="56" cy="11" rx="13" ry="8" fill="#35235c"/>
      <!-- Ngọn lửa nhiều tầng -->
      <path class="flame f1" d="M-42,6 Q-50,-75 0,-145 Q52,-75 42,6 Z" fill="#ff4b2b" opacity="0.9"/>
      <path class="flame f2" d="M-30,6 Q-32,-62 -4,-122 Q22,-80 32,6 Z" fill="#ff9233" opacity="0.95"/>
      <path class="flame f3" d="M-18,6 Q-12,-48 2,-88 Q18,-45 18,6 Z" fill="#fff1a8"/>
    </g>

    <!-- Biển gỗ chỉ đường lên Vách vực Zip Line (x ~ 2450) -->
    <g transform="translate(2450,690)">
      <rect x="-6" y="0" width="12" height="90" fill="#2e1846"/>
      <polygon points="-55,14 55,6 68,24 52,40 -55,44" fill="#462663"/>
      <path d="M-52,13 L55,6 L65,20" stroke="#f4edff" stroke-width="3" fill="none"/>
    </g>

    <!-- Những dấu chân trên tuyết dọc đường chạy trốn (x: 2300 -> 4700) -->
    <g fill="#7e63b8" opacity="0.55">
      ${Array.from({ length: 28 }, (_, i) => {
        const x = 2300 + i * 88;
        const y = 790 + Math.sin(i * 0.7) * 14 + (i % 2) * 8;
        return `<ellipse cx="${x}" cy="${y}" rx="10" ry="4" transform="rotate(-8 ${x} ${y})"/>`;
      }).join('')}
    </g>

    <!-- ============ VÁCH VỰC ZIP LINE CUỐI ĐƯỜNG (x ~ 5100 .. 6400) ============ -->
    <!-- Khe vực sâu thẳm -->
    <polygon points="5140,765 5240,1000 5840,1000 5920,670 6400,670 6400,1000 5140,1000" fill="#090418"/>
    <!-- Vách đá bên kia vực (điểm B) -->
    <polygon points="5820,1000 5915,665 6400,650 6400,1000" fill="#23134a"/>
    <path d="M5915,665 L6400,650 L6400,676 L5915,690 Z" fill="#f5eeff"/>

    <!-- Trụ neo A (bờ bên này, x = 5110, y = 765) -->
    <g transform="translate(5110,615)">
      <rect x="-10" y="0" width="20" height="155" fill="#3b215e"/>
      <rect x="-18" y="-8" width="36" height="14" rx="4" fill="#ff9a3c"/>
      <circle cx="0" cy="-1" r="8" fill="#ffe29a" class="lamp"/>
      <rect x="-82" y="-54" width="164" height="34" rx="8" fill="#0d0622" opacity="0.85"/>
      <text x="0" y="-30" text-anchor="middle" fill="#7ac8ff" font-family="Be Vietnam Pro, sans-serif" font-weight="700" font-size="24">A(x₀, y₀, z₀)</text>
    </g>

    <!-- Trụ đỡ M giữa vực (x = 5520) -->
    <g transform="translate(5520,715)">
      <rect x="-7" y="0" width="14" height="285" fill="#2c1752"/>
      <circle cx="0" cy="0" r="10" fill="#ffd84a" class="lamp"/>
      <rect x="16" y="-42" width="96" height="34" rx="8" fill="#0d0622" opacity="0.88"/>
      <text x="64" y="-18" text-anchor="middle" fill="#ffd84a" font-family="Be Vietnam Pro, sans-serif" font-weight="700" font-size="24">M(z?)</text>
    </g>

    <!-- Trụ đích B (bờ bên kia, x = 5945, y = 665) -->
    <g transform="translate(5945,565)">
      <rect x="-10" y="0" width="20" height="105" fill="#3b215e"/>
      <rect x="-18" y="-8" width="36" height="14" rx="4" fill="#7dffb0"/>
      <circle cx="0" cy="-1" r="8" fill="#7dffb0" class="lamp"/>
      <text x="0" y="-22" text-anchor="middle" fill="#ffb36b" font-family="Be Vietnam Pro, sans-serif" font-weight="700" font-size="26">B</text>
    </g>

    <!-- Dây cáp Zip Line nối A -> M -> B -->
    <line x1="5110" y1="615" x2="5945" y2="565" stroke="#ffe19c" stroke-width="4" stroke-dasharray="12 6"/>
    <line x1="5110" y1="615" x2="5945" y2="565" stroke="#ff9a3c" stroke-width="2"/>
  </svg>`;

  // Lớp 5 (Tiền cảnh cận ống kính): Gốc thông tuyết & tảng đá tối hai bên khung hình tạo chiều sâu
  document.getElementById('L-front').innerHTML = `
  <svg viewBox="0 0 7400 1000" preserveAspectRatio="none">
    <!-- Cụm đá phủ tuyết ở tiền cảnh -->
    <g transform="translate(180,875)">
      <path d="M0,150 Q45,20 145,45 Q220,0 310,75 L350,150 Z" fill="#080417"/>
      <path d="M45,52 Q95,28 145,45 Q215,12 275,55" stroke="#d8cbf5" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/>
    </g>
    <!-- Cụm đá và tán thông thấp ở tiền cảnh dọc đường chạy (không cắt ngang nhân vật chính) -->
    ${[2350, 3680, 4950].map((x) => `
      <g transform="translate(${x},850)">
        <path d="M0,160 Q60,25 170,55 Q250,10 340,95 L380,160 Z" fill="#060210" opacity="0.94"/>
        <path d="M55,58 Q115,32 170,55 Q240,22 300,68" stroke="#cbb8f0" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.45"/>
      </g>
    `).join('')}
  </svg>`;

  // Nhóm bạn cắm trại vui vẻ bên đống lửa (Act I & Act II): nướng kẹo dẻo, đàn hát ấm áp
  document.getElementById('campersHappy').innerHTML = `
  <svg width="560" height="230" viewBox="0 0 560 230">
    <!-- Bạn bên trái ngồi ghế nướng kẹo dẻo marshmallow trên ngọn lửa (phong cách ảnh tham chiếu 2) -->
    <g id="happyLeft" transform="translate(115,188)">
      <!-- Balo & thân -->
      <rect x="-34" y="-76" width="24" height="52" rx="10" fill="#221244"/>
      <path d="M-18,-82 Q16,-80 22,-22 L-22,-22 Z" fill="#2c3e6b"/>
      <path d="M-18,-26 L22,-26 L34,8 L16,12 L4,-14 L-12,-14 Z" fill="#2b4238"/>
      <!-- Đầu & mũ len ấm -->
      <circle cx="2" cy="-102" r="21" fill="#ffcca8"/>
      <path d="M-19,-104 Q2,-134 24,-104 Z" fill="#d9464f"/>
      <circle cx="2" cy="-124" r="6" fill="#fff0f3"/>
      <!-- Khuôn mặt tươi cười nhìn lửa trại -->
      <path d="M8,-104 Q12,-108 16,-104" stroke="#241023" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M7,-93 Q13,-87 19,-93" stroke="#9e2a2b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <circle cx="15" cy="-97" r="3.5" fill="#ff7b7b" opacity="0.6"/>
      <!-- Tay cầm que nướng kẹo dẻo marshmallow vươn về phía đống lửa -->
      <path d="M8,-64 L48,-52" stroke="#3c558f" stroke-width="11" stroke-linecap="round"/>
      <line x1="46" y1="-53" x2="112" y2="-78" stroke="#d8b384" stroke-width="3" stroke-linecap="round"/>
      <rect x="95" y="-82" width="11" height="15" rx="3" transform="rotate(-20 100 -75)" fill="#fff8f0"/>
      <rect x="108" y="-87" width="11" height="15" rx="3" transform="rotate(-20 113 -80)" fill="#ffe3c2"/>
    </g>

    <!-- Bạn ở giữa đứng vẫy tay hát hò vui vẻ bên ánh lửa -->
    <g id="happyMid" transform="translate(360,188)">
      <path d="M-18,-26 L-24,10 L-10,10 L-4,-24 L6,-24 L12,10 L26,10 L18,-26 Z" fill="#293d33"/>
      <path d="M-22,-86 Q0,-92 22,-86 L26,-24 L-26,-24 Z" fill="#3b4f82"/>
      <!-- Khăn quàng cổ ấm -->
      <path d="M-18,-86 Q0,-78 18,-86 L22,-74 Q0,-68 -18,-74 Z" fill="#f08a3c"/>
      <path d="M8,-78 L16,-50 L6,-48 L2,-76 Z" fill="#f08a3c"/>
      <!-- Hai tay giơ cao vui vẻ -->
      <path d="M-20,-78 L-44,-112" stroke="#3b4f82" stroke-width="11" stroke-linecap="round"/>
      <circle cx="-46" cy="-115" r="6" fill="#ffcca8"/>
      <path d="M20,-78 L42,-108" stroke="#3b4f82" stroke-width="11" stroke-linecap="round"/>
      <circle cx="44" cy="-111" r="6" fill="#ffcca8"/>
      <!-- Đầu & nụ cười rạng rỡ -->
      <circle cx="0" cy="-106" r="21" fill="#ffcca8"/>
      <path d="M-21,-108 Q-12,-130 4,-126 Q18,-126 22,-106 Q12,-116 -2,-114 Q-14,-114 -21,-108 Z" fill="#231433"/>
      <path d="M-12,-107 Q-8,-111 -4,-107" stroke="#241023" stroke-width="2.3" fill="none" stroke-linecap="round"/>
      <path d="M4,-107 Q8,-111 12,-107" stroke="#241023" stroke-width="2.3" fill="none" stroke-linecap="round"/>
      <path d="M-8,-96 Q0,-86 8,-96 Z" fill="#b8323c"/>
      <!-- Nốt nhạc bay lên -->
      <text x="-54" y="-135" fill="#ffd87d" font-size="20">♪</text>
      <text x="38" y="-128" fill="#ffa86b" font-size="18">♫</text>
    </g>

    <!-- Người bạn thứ 3 đứng trầm ngâm gần cửa lều (kẻ sắp hóa thành Hồ Ly) -->
    <g id="happyImposter" transform="translate(475,188)">
      <path d="M-16,-24 L-20,10 L-6,10 L-2,-22 L6,-22 L10,10 L22,10 L16,-24 Z" fill="#261f38"/>
      <!-- Áo khoác đỏ sẫm giống màu áo Hồ Ly -->
      <path d="M-24,-88 Q0,-94 24,-88 L28,-22 L-28,-22 Z" fill="#6b1d2f"/>
      <circle cx="0" cy="-108" r="20" fill="#f3bfa0"/>
      <path d="M-20,-110 Q0,-134 22,-108 Q10,-120 -20,-110 Z" fill="#1d0f2b"/>
      <!-- Nụ cười nửa miệng bí ẩn -->
      <path d="M-11,-108 L-4,-106" stroke="#241023" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M4,-106 L11,-108" stroke="#241023" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M-6,-95 Q2,-90 9,-97" stroke="#4a101d" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// 2. Cắt các tư thế nhân vật từ 2 tờ thiết kế (student-sheet.png & fox-sheet.png)
// ---------------------------------------------------------------------------
async function loadActorSprites() {
  const logo = [{ x: 868, y: 868, w: 70, h: 64 }];
  const [sRes, fRes] = await Promise.allSettled([
    loadImage('assets/student-sheet.png'),
    loadImage('assets/fox-sheet.png'),
  ]);
  const out = {};
  if (sRes.status === 'fulfilled') {
    const s = sRes.value;
    // Ô trên-trái: tư thế chính diện; Ô dưới-phải: tư thế chạy sang phải
    out.studentFront = extract(s, { x: 20, y: 12, w: 480, h: 495 }).toDataURL();
    out.studentRun = extract(s, { x: 530, y: 512, w: 494, h: 512 }, logo).toDataURL();
  }
  if (fRes.status === 'fulfilled') {
    const f = fRes.value;
    // Ô trên-trái: Hồ ly đứng nhìn thẳng; Ô dưới-phải: Hồ ly lao sang phải
    out.foxFront = extract(f, { x: 18, y: 12, w: 490, h: 495 }).toDataURL();
    out.foxRun = extract(f, { x: 530, y: 512, w: 494, h: 512 }, logo).toDataURL();
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Bầu trời sao & hệ hạt (Tuyết trắng, Tàn lửa trại, Cánh hoa/Tro đỏ ma mị)
// ---------------------------------------------------------------------------
function initCanvases(getProgress) {
  const starCanvas = document.getElementById('stars');
  const fxCanvas = document.getElementById('fx');
  const sCtx = starCanvas.getContext('2d');
  const fCtx = fxCanvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  const stars = Array.from({ length: 150 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.88,
    r: 0.6 + Math.random() * 1.7,
    tw: Math.random() * Math.PI * 2,
    sp: 0.6 + Math.random() * 1.8,
  }));

  // Chòm sao hình mặt Cáo trên bầu trời đêm
  const foxConstellation = [
    [0.58, 0.14], [0.61, 0.07], [0.64, 0.13], [0.69, 0.13],
    [0.72, 0.07], [0.75, 0.14], [0.665, 0.22], [0.58, 0.14],
  ];

  const snow = Array.from({ length: 75 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1.2 + Math.random() * 2.8,
    vx: -0.15 - Math.random() * 0.35,
    vy: 0.25 + Math.random() * 0.55,
    a: 0.35 + Math.random() * 0.55,
  }));

  const embers = Array.from({ length: 38 }, () => ({
    x: 0.25 + Math.random() * 0.35,
    y: 0.55 + Math.random() * 0.4,
    r: 1.2 + Math.random() * 2.6,
    vy: -0.4 - Math.random() * 0.9,
    vx: (Math.random() - 0.5) * 0.4,
    hue: 18 + Math.random() * 28,
  }));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    starCanvas.width = W * dpr;
    starCanvas.height = Math.round(H * 0.78 * dpr);
    fxCanvas.width = W * dpr;
    fxCanvas.height = H * dpr;
    sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let lastScroll = 0;
  function tick(now) {
    const t = now * 0.001;
    const p = getProgress();
    const scrollVel = (p - lastScroll) * 60;
    lastScroll = p;

    // Vẽ bầu trời sao + chòm sao Hồ Ly
    const sh = H * 0.78;
    sCtx.clearRect(0, 0, W, sh);
    for (const st of stars) {
      const alpha = 0.35 + 0.65 * Math.sin(t * st.sp + st.tw);
      sCtx.fillStyle = `rgba(255,248,255,${alpha.toFixed(2)})`;
      sCtx.beginPath();
      sCtx.arc(st.x * W, st.y * sh, st.r, 0, Math.PI * 2);
      sCtx.fill();
    }
    const blood = smooth(invLerp(0.32, 0.52, p));
    sCtx.strokeStyle = blood > 0.3
      ? `rgba(255,70,95,${0.18 + blood * 0.35})`
      : 'rgba(230,215,255,0.22)';
    sCtx.lineWidth = 1;
    sCtx.beginPath();
    foxConstellation.forEach(([cx, cy], idx) => {
      const x = (cx - p * 0.12) * W;
      const y = cy * sh;
      if (idx === 0) sCtx.moveTo(x, y); else sCtx.lineTo(x, y);
    });
    sCtx.stroke();

    // Vẽ tuyết bay & tàn lửa đỏ ma mị
    fCtx.clearRect(0, 0, W, H);
    const chaseBoost = 1 + band(p, 0.52, 0.62, 0.78, 0.86) * 3.2 + Math.abs(scrollVel) * 2.5;
    for (const fl of snow) {
      fl.x += (fl.vx * chaseBoost) / W;
      fl.y += (fl.vy * (0.8 + chaseBoost * 0.25)) / H;
      if (fl.x < -0.02) fl.x = 1.02;
      if (fl.x > 1.02) fl.x = -0.02;
      if (fl.y > 1.02) { fl.y = -0.02; fl.x = Math.random(); }
      fCtx.fillStyle = blood > 0.5
        ? `rgba(255,215,225,${fl.a})`
        : `rgba(245,240,255,${fl.a})`;
      fCtx.beginPath();
      fCtx.arc(fl.x * W, fl.y * H, fl.r, 0, Math.PI * 2);
      fCtx.fill();
    }

    for (const em of embers) {
      em.x += (em.vx - scrollVel * 0.4) / W;
      em.y += em.vy / H;
      if (em.y < 0.15) {
        em.y = 0.82 + Math.random() * 0.16;
        em.x = 0.15 + Math.random() * 0.65;
      }
      const hue = lerp(em.hue, 350, blood);
      fCtx.fillStyle = `hsla(${hue},95%,62%,0.78)`;
      fCtx.beginPath();
      fCtx.arc(em.x * W, em.y * H, em.r, 0, Math.PI * 2);
      fCtx.fill();
    }

    requestAnimationFrame(tick);
  }

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(tick);
  } else {
    tick(0);
  }
}

// ---------------------------------------------------------------------------
// 4. Đạo diễn chuyển động theo cuộn chuột (Scroll Film Choreographer)
// ---------------------------------------------------------------------------
function initDirector() {
  const film = document.getElementById('film');
  const shake = document.getElementById('shake');
  const skyBlood = document.getElementById('skyBlood');
  const moon = document.getElementById('moon');
  const moonBlood = document.getElementById('moonBlood');
  const bloodTint = document.getElementById('bloodTint');
  const flash = document.getElementById('flash');

  const lFar = document.getElementById('L-far');
  const lMid = document.getElementById('L-mid');
  const lForest = document.getElementById('L-forest');
  const lGround = document.getElementById('L-ground');
  const lFront = document.getElementById('L-front');
  const mistBack = document.getElementById('mistBack');
  const mistFront = document.getElementById('mistFront');

  const titleWrap = document.getElementById('titleWrap');
  const kanji = document.getElementById('kanji');
  const chars = [...document.querySelectorAll('.title .ch')];
  const hauntDisp = document.getElementById('hauntDisp');

  const capJoy = document.querySelector('.cap-joy');
  const capTurn = document.querySelector('.cap-turn');
  const kLines = [...document.querySelectorAll('.cap-turn .k-line')];
  const capRun = document.querySelector('.cap-run');
  const gate = document.getElementById('gate');
  const progressEl = document.getElementById('progress');

  const st0 = document.getElementById('st0');
  const st1 = document.getElementById('st1');
  const st2 = document.getElementById('st2');
  const foxFront = document.getElementById('foxFront');
  const foxRun = document.getElementById('foxRun');

  // Cài chỉ số thứ tự chữ cái để hiện dần và tạo chuyển động lệch pha khi cuộn
  chars.forEach((ch, idx) => ch.style.setProperty('--i', idx));

  // Thỉnh thoảng nháy nhẹ 1 chữ cái trong FOXY RUNNING như đèn ma trơi
  setInterval(() => {
    if (window.scrollY > window.innerHeight * 1.5) return;
    const pick = chars[Math.floor(Math.random() * chars.length)];
    if (!pick) return;
    pick.classList.add('flick');
    setTimeout(() => pick.classList.remove('flick'), 130);
  }, 2400);

  let targetP = 0;
  let curP = 0;
  let ptrX = 0, ptrY = 0;

  function measureScroll() {
    const max = Math.max(1, film.offsetHeight - window.innerHeight);
    targetP = clamp(window.scrollY / max, 0, 1);
  }
  window.addEventListener('scroll', measureScroll, { passive: true });
  window.addEventListener('resize', measureScroll);
  measureScroll();

  window.addEventListener('pointermove', (e) => {
    ptrX = (e.clientX / window.innerWidth - 0.5) * 2;
    ptrY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function renderFrame() {
    curP += (targetP - curP) * 0.11;
    if (Math.abs(targetP - curP) < 0.0002) curP = targetP;
    const p = curP;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    progressEl.style.transform = `scaleX(${p.toFixed(4)})`;

    // ---- Kích thước & độ dịch ngang của 5 lớp phong cảnh (tỷ lệ theo chiều cao màn hình) ----
    // Lớp mặt đất có hệ số rộng 6.4 * vh (khớp viewBox 6400x1000) để tọa độ cảnh luôn chuẩn trên mọi màn hình
    const groundW = Math.max(vw * 2.4, vh * 6.4);
    const farW = Math.max(vw * 1.5, vh * 3.6);
    const midW = Math.max(vw * 1.8, vh * 4.3);
    const forestW = Math.max(vw * 2.1, vh * 5.6);
    const frontW = Math.max(vw * 2.7, vh * 7.4);

    lFar.style.width = `${farW}px`;
    lMid.style.width = `${midW}px`;
    lForest.style.width = `${forestW}px`;
    lGround.style.width = `${groundW}px`;
    lFront.style.width = `${frontW}px`;

    // Máy quay giữ quanh khu trại ở đầu (0 -> 0.25), rồi lia nhanh xuyên rừng khi chạy trốn (0.48 -> 0.88)
    const camP = lerp(p * 0.35, smooth(invLerp(0.18, 0.92, p)), 0.78);
    // Đảm bảo dịch chuyển ngang luôn <= 0 để không bao giờ hở mép trái khi di chuột sang phải
    const shiftOf = (w, rate, ptrAllowance) => Math.min(0, -(w - vw) * camP * rate - Math.max(0, ptrX) * ptrAllowance);
    const groundShift = shiftOf(groundW, 1.0, 24);

    lFar.style.transform = `translate3d(${shiftOf(farW, 0.45, 8).toFixed(1)}px, ${(ptrY * 4).toFixed(1)}px, 0)`;
    lMid.style.transform = `translate3d(${shiftOf(midW, 0.68, 12).toFixed(1)}px, ${(ptrY * 6).toFixed(1)}px, 0)`;
    lForest.style.transform = `translate3d(${shiftOf(forestW, 0.86, 18).toFixed(1)}px, 0, 0)`;
    lGround.style.transform = `translate3d(${groundShift.toFixed(1)}px, 0, 0)`;
    lFront.style.transform = `translate3d(${shiftOf(frontW, 1.04, 28).toFixed(1)}px, 0, 0)`;

    mistBack.style.transform = `translate3d(${(-p * 180).toFixed(1)}px, 0, 0)`;
    mistFront.style.transform = `translate3d(${(-p * 340).toFixed(1)}px, 0, 0)`;

    // ---- Bầu trời, mặt trăng hóa đỏ & không khí ma mị khi bước sang Act III ----
    const blood = smooth(invLerp(0.32, 0.50, p));
    skyBlood.style.opacity = (blood * 0.88).toFixed(3);
    moonBlood.style.opacity = blood.toFixed(3);
    bloodTint.style.opacity = (blood * 0.38).toFixed(3);

    const moonX = lerp(0, vw * 0.16, p) - ptrX * 6;
    const moonY = lerp(0, -vh * 0.05, Math.sin(p * Math.PI)) - ptrY * 5;
    const moonScale = 1 + blood * 0.26;
    moon.style.transform = `translate3d(${moonX.toFixed(1)}px, ${moonY.toFixed(1)}px, 0) scale(${moonScale.toFixed(3)})`;

    // Chi tiết SVG trong cảnh: bóng hồ ly trong lều, đôi mắt đỏ trong rừng, quầng lửa máu
    const tentHuman = document.getElementById('tentHumanShadow');
    const tentFox = document.getElementById('tentFoxShadow');
    const campBlood = document.getElementById('campBloodHalo');
    const forestEyes = document.getElementById('forestEyes');
    if (tentHuman && tentFox) {
      const morph = smooth(invLerp(0.33, 0.45, p));
      tentHuman.setAttribute('opacity', ((1 - morph) * 0.55).toFixed(2));
      tentFox.setAttribute('opacity', (morph * 0.92).toFixed(2));
    }
    if (campBlood) campBlood.setAttribute('opacity', blood.toFixed(2));
    if (forestEyes) forestEyes.setAttribute('opacity', smooth(invLerp(0.35, 0.55, p)).toFixed(2));

    // Chớp sáng đỏ & rung nhẹ màn hình đúng khoảnh khắc biến hình thành cáo (p ~ 0.44)
    const jolt = Math.exp(-Math.pow((p - 0.455) / 0.028, 2));
    flash.style.opacity = (jolt * 0.52).toFixed(3);
    if (jolt > 0.05) {
      const sx = Math.sin(p * 950) * jolt * 10;
      const sy = Math.cos(p * 820) * jolt * 7;
      shake.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
    } else {
      shake.style.transform = 'none';
    }

    // ---- TÊN TRÒ CHƠI: FOXY RUNNING (ấn tượng, ma mị, rùng rợn & chuyển động khi cuộn chuột) ----
    const heroP = invLerp(0, 0.25, p);
    const heroFade = 1 - smooth(invLerp(0.13, 0.24, p));
    titleWrap.style.opacity = heroFade.toFixed(3);
    titleWrap.style.pointerEvents = heroFade > 0.2 ? 'auto' : 'none';
    titleWrap.style.transform = `translate3d(${(ptrX * -14).toFixed(1)}px, ${(-heroP * vh * 0.24 + ptrY * -8).toFixed(1)}px, 0)`;

    kanji.style.transform = `translate(-50%, -50%) rotate(${(-8 - heroP * 18).toFixed(1)}deg) scale(${(1 + heroP * 0.55).toFixed(3)})`;

    // Từng chữ cái của FOXY RUNNING tách giãn, nghiêng lệch & run rẩy mạnh dần khi cuộn chuột
    if (hauntDisp) {
      hauntDisp.setAttribute('scale', (4 + heroP * 38).toFixed(1));
    }
    chars.forEach((ch, idx) => {
      const mid = (chars.length - 1) / 2;
      const offset = idx - mid;
      const dx = offset * heroP * 26;
      const dy = Math.sin(idx * 1.7 + p * 36) * heroP * 24 - heroP * 18;
      const rot = offset * heroP * 5;
      ch.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg)`;
    });

    // ---- CHUYỂN ĐỘNG CỦA CÁC NHÂN VẬT THEO CÂU CHUYỆN TUẦN TỰ ----
    const actorH = clamp(vh * 0.22, 130, 225);
    const foxH = actorH * 1.18;
    [st0, st1, st2].forEach((el) => { el.style.height = `${actorH}px`; });
    foxFront.style.height = `${foxH}px`;
    foxRun.style.height = `${foxH}px`;

    // Tọa độ mặt đất nơi lửa trại trên màn hình (x = 1225 / 6400 của lớp ground)
    const fireScreenX = (1225 / 6400) * groundW + groundShift;
    const groundY = vh * 0.80;

    // 1) Giai đoạn Đầu -> Vui vẻ (p: 0.00 -> 0.38): Nhóm bạn ngồi/đứng quanh lửa trại nướng kẹo dẻo, ca hát vui vẻ
    // 2) Giai đoạn Biến hình (p: 0.36 -> 0.52): Trăng hóa đỏ, người bạn gần cửa lều hóa thành Cáo (foxFront), 2 bạn kia giật mình hoảng hốt
    // 3) Giai đoạn Chạy trốn (p: 0.50 -> 0.85): Các bạn lao nhanh qua rừng thông, Cáo phóng đuổi theo sau
    // 4) Giai đoạn Bắt đầu trò chơi (p: 0.80 -> 1.00): Đứng trước trụ Zip Line bên bờ vực, cáo gầm gừ phía sau

    const happyFade = 1 - smooth(invLerp(0.34, 0.41, p));
    const panicAppear = smooth(invLerp(0.36, 0.43, p));
    const morphP = smooth(invLerp(0.38, 0.47, p));
    const chaseP = smooth(invLerp(0.50, 0.82, p));
    const gateP = smooth(invLerp(0.78, 0.90, p));

    // Nhóm bạn vui vẻ quanh lửa trại (Act I & Act II)
    const campersHappy = document.getElementById('campersHappy');
    if (campersHappy) {
      const happyScale = actorH / 165;
      const sway = Math.sin(p * 32) * 5;
      const hx = fireScreenX - 230 * happyScale;
      const hy = groundY - 196 * happyScale + Math.abs(Math.sin(p * 26)) * 4;
      campersHappy.style.opacity = happyFade.toFixed(3);
      campersHappy.style.transform = `translate3d(${hx.toFixed(1)}px, ${hy.toFixed(1)}px, 0) scale(${happyScale.toFixed(3)}) rotate(${(sway * 0.15).toFixed(2)}deg)`;
    }

    // Nhịp nhún nhảy khi hoảng sợ & bỏ chạy
    const strideFreq = lerp(32, 95, smooth(invLerp(0.45, 0.60, p)));
    const runAmp = lerp(6, 18, band(p, 0.48, 0.56, 0.78, 0.86));

    // Vị trí X của 2 bạn học sinh khi phát hiện Hồ Ly -> Bỏ chạy -> Tới trụ Zip Line A
    const campX0 = fireScreenX - actorH * 0.25;
    const campX1 = fireScreenX - actorH * 1.15;

    const runX0 = lerp(vw * 0.44, vw * 0.75, chaseP);
    const runX1 = lerp(vw * 0.30, vw * 0.61, chaseP);

    // Ở cuối trang (Act V), 2 học sinh đứng bên phải trụ A để nhãn A(x₀, y₀, z₀) nổi bật rõ ràng
    const cliffX0 = vw * 0.79;
    const cliffX1 = vw * 0.68;

    const toChase = smooth(invLerp(0.45, 0.55, p));
    const x0 = lerp(lerp(campX0, runX0, toChase), cliffX0, gateP);
    const x1 = lerp(lerp(campX1, runX1, toChase), cliffX1, gateP);

    const bob0 = Math.abs(Math.sin(p * strideFreq)) * runAmp;
    const bob1 = Math.abs(Math.sin(p * strideFreq + 1.8)) * runAmp;
    const tilt = band(p, 0.48, 0.55, 0.78, 0.86) * 12;

    st0.style.opacity = panicAppear.toFixed(3);
    st0.style.transform = `translate3d(${x0.toFixed(1)}px, ${(groundY - actorH - bob0).toFixed(1)}px, 0) rotate(${tilt.toFixed(1)}deg)`;

    st1.style.opacity = panicAppear.toFixed(3);
    st1.style.transform = `translate3d(${x1.toFixed(1)}px, ${(groundY - actorH - bob1).toFixed(1)}px, 0) rotate(${(tilt * 0.9).toFixed(1)}deg)`;

    // Bạn thứ 3 gần cửa lều co giật trong chớp mắt rồi biến thành Hồ Ly (p: 0.35 -> 0.46)
    const imposterX = fireScreenX + actorH * 0.85;
    const shakeImposter = band(p, 0.34, 0.39, 0.45, 0.48) * Math.sin(p * 720) * 11;
    const imposterVis = band(p, 0.33, 0.37, 0.41, 0.46);
    st2.style.opacity = imposterVis.toFixed(3);
    st2.style.transform = `translate3d(${(imposterX + shakeImposter).toFixed(1)}px, ${(groundY - actorH).toFixed(1)}px, 0) scale(${(1 - morphP * 0.28).toFixed(2)})`;

    // Hồ ly chính diện hiện ra đúng chỗ người bạn vừa biến mất
    const foxReveal = band(p, 0.39, 0.44, 0.51, 0.56);
    foxFront.style.opacity = foxReveal.toFixed(3);
    foxFront.style.transform = `translate3d(${imposterX.toFixed(1)}px, ${(groundY - foxH).toFixed(1)}px, 0) scale(${(0.78 + foxReveal * 0.28).toFixed(3)})`;

    // Hồ ly tư thế săn mồi lao mình về phía trước đuổi theo học sinh (Act IV & Act V)
    const foxChaseVis = smooth(invLerp(0.50, 0.57, p));
    const foxChaseX = lerp(lerp(vw * 0.10, vw * 0.35, chaseP), vw * 0.44, gateP);
    const foxCycle = Math.sin(p * strideFreq * 0.9 + 0.6);
    const foxLeap = Math.abs(foxCycle) * (runAmp * 1.45);
    const isChasing = band(p, 0.50, 0.56, 0.78, 0.86);
    const foxPitch = lerp(6, 18 + foxCycle * 7, isChasing);
    const foxSkew = lerp(-3, -10 - foxCycle * 5, isChasing);
    const foxStretch = 1 + isChasing * 0.08 * Math.abs(foxCycle);
    foxRun.style.opacity = foxChaseVis.toFixed(3);
    foxRun.style.transform = `translate3d(${foxChaseX.toFixed(1)}px, ${(groundY - foxH - foxLeap).toFixed(1)}px, 0) rotate(${foxPitch.toFixed(1)}deg) skewX(${foxSkew.toFixed(1)}deg) scale(${foxStretch.toFixed(2)}, ${(2 - foxStretch).toFixed(2)})`;

    // ---- HIỂN THỊ LỜI KỂ CHUYỆN TUẦN TỰ & KHU VỰC BẮT ĐẦU TRÒ CHƠI ----
    const joyVis = band(p, 0.17, 0.23, 0.31, 0.36);
    capJoy.style.opacity = joyVis.toFixed(3);
    capJoy.style.transform = `translate3d(0, ${((1 - joyVis) * 24).toFixed(1)}px, 0)`;

    const turnVis = band(p, 0.35, 0.40, 0.52, 0.57);
    capTurn.style.opacity = turnVis.toFixed(3);
    const kTimings = [[0.36, 0.41], [0.40, 0.45], [0.44, 0.49]];
    kLines.forEach((kl, i) => {
      const kv = smooth(invLerp(kTimings[i][0], kTimings[i][1], p));
      kl.style.opacity = kv.toFixed(3);
      kl.style.transform = `translate3d(0, ${((1 - kv) * 18).toFixed(1)}px, 0)`;
    });

    const runVis = band(p, 0.56, 0.61, 0.73, 0.78);
    capRun.style.opacity = runVis.toFixed(3);
    capRun.style.transform = `translate3d(${((1 - runVis) * 40).toFixed(1)}px, 0, 0)`;

    const gateVis = smooth(invLerp(0.79, 0.88, p));
    gate.style.opacity = gateVis.toFixed(3);
    gate.style.transform = `translate3d(0, ${((1 - gateVis) * 32).toFixed(1)}px, 0)`;
    if (gateVis > 0.55) {
      gate.removeAttribute('inert');
    } else {
      gate.setAttribute('inert', '');
    }

    requestAnimationFrame(renderFrame);
  }

  // Hỗ trợ prefers-reduced-motion: hiển thị ngay trạng thái sẵn sàng chơi nhưng vẫn đủ chiều sâu
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gate.style.opacity = '1';
    gate.removeAttribute('inert');
    titleWrap.style.opacity = '1';
  } else {
    requestAnimationFrame(renderFrame);
  }

  // Các nút điều hướng cuộn mượt tới đúng mốc thời gian của bộ phim
  const jumpTargets = { top: 0, story: 0.25, gate: 0.96 };
  document.querySelectorAll('[data-jump]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const key = a.getAttribute('data-jump');
      if (!(key in jumpTargets)) return;
      e.preventDefault();
      const max = Math.max(1, film.offsetHeight - window.innerHeight);
      window.scrollTo({ top: max * jumpTargets[key], behavior: 'smooth' });
    });
  });

  return () => curP;
}

// ---------------------------------------------------------------------------
// 5. Kết nối chức năng Tạo phòng chơi / Luyện tập / Vào phòng (giữ nguyên logic game)
// ---------------------------------------------------------------------------
function initGameActions() {
  const qs = new URLSearchParams(location.search);
  const keep = qs.has('local') ? '&local=1' : '';
  document.querySelectorAll('.js-teacher').forEach((el) => {
    el.href = 'teacher.html' + (keep ? '?local=1' : '');
  });

  const codeInput = document.getElementById('code');
  if (qs.get('room')) {
    codeInput.value = qs.get('room');
    // Nếu mở link có sẵn mã phòng (?room=1234) thì cuộn thẳng xuống khu vực trò chơi
    setTimeout(() => {
      const film = document.getElementById('film');
      const max = Math.max(1, film.offsetHeight - window.innerHeight);
      window.scrollTo({ top: max * 0.96, behavior: 'smooth' });
    }, 350);
  }

  const backendP = getBackend();
  backendP.then((b) => {
    document.getElementById('modeNote').textContent = b.kind === 'local'
      ? 'Chế độ thử cục bộ: phòng hoạt động giữa các tab trên cùng trình duyệt này.'
      : 'Đã kết nối máy chủ phòng chơi trực tuyến.';
  });

  document.getElementById('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim();
    const name = document.getElementById('name').value.trim().slice(0, 20);
    const err = document.getElementById('joinErr');
    if (!/^\d{4}$/.test(code)) { err.textContent = 'Mã phòng gồm 4 chữ số.'; return; }
    if (!name) { err.textContent = 'Em nhập tên nhé.'; return; }
    err.textContent = 'Đang kiểm tra phòng…';
    try {
      const b = await backendP;
      if (!(await b.roomExists(code))) { err.textContent = 'Không tìm thấy phòng ' + code + '.'; return; }
      sessionStorage.setItem('zipline:name:' + code, name);
      if (b.kind !== 'local') localStorage.setItem('zipline:name:' + code, name);
      navigateWithBloodMoon(`play.html?room=${code}${keep}`);
    } catch (ex) {
      err.textContent = 'Lỗi kết nối: ' + ex.message;
    }
  });
}

// ---------------------------------------------------------------------------
// Khởi chạy
// ---------------------------------------------------------------------------
buildWorldSVG();
initBloodMoonPortal();
initGameActions();
const getProgress = initDirector();
initCanvases(getProgress);

loadActorSprites().then((sp) => {
  const st0 = document.getElementById('st0');
  const st1 = document.getElementById('st1');
  const st2 = document.getElementById('st2');
  const foxFront = document.getElementById('foxFront');
  const foxRun = document.getElementById('foxRun');

  if (sp.studentRun) {
    st0.src = sp.studentRun;
    st1.src = sp.studentRun;
  }
  if (sp.studentFront || sp.studentRun) {
    st2.src = sp.studentFront || sp.studentRun;
  }
  if (sp.foxFront || sp.foxRun) {
    foxFront.src = sp.foxFront || sp.foxRun;
  }
  if (sp.foxRun) {
    foxRun.src = sp.foxRun;
  }
  document.body.classList.remove('is-loading');
});
