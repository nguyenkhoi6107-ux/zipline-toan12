/**
 * portal.js — Hiệu ứng chuyển trang "Trăng máu bùng sáng" (Blood Moon Eclipse Transition)
 * và bầu trời sao/tuyết rơi nhẹ tạo sự thống nhất concept giữa Landing, Tạo phòng và Màn chơi.
 */

export function initBloodMoonPortal() {
  if (document.getElementById('bloodPortal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'bloodPortal';
  wrap.className = 'blood-portal is-entering';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `
    <div class="bp-sky"></div>
    <div class="bp-moon">
      <div class="bp-fox">狐</div>
    </div>
    <div class="bp-flare"></div>
  `;
  document.body.appendChild(wrap);

  // Khi trang vừa mở: trăng máu dịu dần để lộ giao diện trang
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      wrap.classList.remove('is-entering');
    });
  });

  // Bắt các liên kết chuyển trang nội bộ để kích hoạt hiệu ứng Trăng máu đỏ chói lên
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const raw = a.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) return;
    e.preventDefault();
    navigateWithBloodMoon(a.href);
  });
}

export function navigateWithBloodMoon(url) {
  const wrap = document.getElementById('bloodPortal');
  if (!wrap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    location.href = url;
    return;
  }
  wrap.classList.add('is-leaving');
  setTimeout(() => {
    location.href = url;
  }, 460);
}
