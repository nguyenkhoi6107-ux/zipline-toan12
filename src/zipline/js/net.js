/**
 * net.js — Lớp kết nối phòng chơi (mục 7, 8).
 *
 * Hai bản cài cùng một giao diện:
 *  - FirebaseBackend: Firebase Realtime Database (dùng thật trên lớp).
 *  - LocalBackend: localStorage + BroadcastChannel, chỉ giữa các tab trên một trình duyệt (để thử).
 *
 * Cấu trúc dữ liệu:
 *  rooms/{code} = {
 *    status: 'lobby' | 'running' | 'ended',
 *    settings: { levels, timeLimitMinutes, lives, endOnFirstFinish, monster: {...} },
 *    createdAt, startAt, endedAt,
 *    players/{pid} = { name, joinedAt, online, levelsPassed, stage, lives, monsterDist,
 *                      status, finishedAt, lastProgressAt, wrongCount, correctCount, levelIndex }
 *  }
 */
import { firebaseConfig } from './firebase-config.js';

const FIREBASE_VERSION = '10.12.2';

/** Mã phòng 4 chữ số. */
export function randomRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Mã người chơi ngẫu nhiên, lưu theo phòng để tải lại trang không mất tiến độ.
 * perTab = true (chế độ thử cục bộ): lưu trong sessionStorage để mỗi tab là một học sinh khác nhau.
 */
export function getPlayerId(code, perTab = false) {
  const store = perTab ? sessionStorage : localStorage;
  const key = `zipline:pid:${code}`;
  let pid = store.getItem(key);
  if (!pid) {
    pid = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    store.setItem(key, pid);
  }
  return pid;
}

// ---------------------------------------------------------------------------

class LocalBackend {
  constructor() {
    this.kind = 'local';
    this.channel = 'BroadcastChannel' in window ? new BroadcastChannel('zipline') : null;
  }
  _key(code) { return `zipline:room:${code}`; }
  _read(code) {
    try { return JSON.parse(localStorage.getItem(this._key(code))); } catch { return null; }
  }
  _write(code, data) {
    localStorage.setItem(this._key(code), JSON.stringify(data));
    this.channel?.postMessage({ code });
    window.dispatchEvent(new CustomEvent('zipline-local', { detail: { code } }));
  }
  serverNow() { return Date.now(); }
  async roomExists(code) { return !!this._read(code); }
  async createRoom(code, settings) {
    this._write(code, { status: 'lobby', settings, createdAt: Date.now(), players: {} });
  }
  async getRoom(code) { return this._read(code); }
  async updateRoom(code, patch) {
    const r = this._read(code) || {};
    this._write(code, { ...r, ...patch });
  }
  async updatePlayer(code, pid, patch) {
    const r = this._read(code);
    if (!r) return;
    r.players = r.players || {};
    r.players[pid] = { ...(r.players[pid] || {}), ...patch };
    this._write(code, r);
  }
  async joinRoom(code, pid, name) {
    const r = this._read(code);
    const existing = r?.players?.[pid];
    await this.updatePlayer(code, pid, existing ? { name, online: true } : { name, joinedAt: Date.now(), online: true });
  }
  subscribeRoom(code, cb) {
    const fire = () => cb(this._read(code));
    const onMsg = (e) => { if (!e.data || e.data.code === code) fire(); };
    const onStorage = (e) => { if (e.key === this._key(code)) fire(); };
    const onLocal = (e) => { if (e.detail.code === code) fire(); };
    this.channel?.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);
    window.addEventListener('zipline-local', onLocal);
    fire();
    return () => {
      this.channel?.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('zipline-local', onLocal);
    };
  }
}

// ---------------------------------------------------------------------------

class FirebaseBackend {
  constructor() {
    this.kind = 'firebase';
    this.offset = 0;
  }
  async init() {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [{ initializeApp }, db] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-database.js`),
    ]);
    this.fb = db;
    this.db = db.getDatabase(initializeApp(firebaseConfig));
    // Đồng bộ đồng hồ với máy chủ Firebase để mọi máy cùng đếm giờ.
    db.onValue(db.ref(this.db, '.info/serverTimeOffset'), (s) => { this.offset = s.val() || 0; });
    return this;
  }
  _ref(path) { return this.fb.ref(this.db, path); }
  serverNow() { return Date.now() + this.offset; }
  async roomExists(code) { return (await this.fb.get(this._ref(`rooms/${code}/status`))).exists(); }
  async createRoom(code, settings) {
    await this.fb.set(this._ref(`rooms/${code}`), {
      status: 'lobby', settings, createdAt: this.fb.serverTimestamp(),
    });
  }
  async getRoom(code) { return (await this.fb.get(this._ref(`rooms/${code}`))).val(); }
  async updateRoom(code, patch) {
    const p = { ...patch };
    for (const k of Object.keys(p)) if (p[k] === 'SERVER_NOW') p[k] = this.fb.serverTimestamp();
    await this.fb.update(this._ref(`rooms/${code}`), p);
  }
  async updatePlayer(code, pid, patch) {
    await this.fb.update(this._ref(`rooms/${code}/players/${pid}`), patch);
  }
  async joinRoom(code, pid, name) {
    const ref = this._ref(`rooms/${code}/players/${pid}`);
    const snap = await this.fb.get(ref);
    await this.fb.update(ref, snap.exists()
      ? { name, online: true }
      : { name, joinedAt: this.fb.serverTimestamp(), online: true });
    this.fb.onDisconnect(this._ref(`rooms/${code}/players/${pid}/online`)).set(false);
  }
  subscribeRoom(code, cb) {
    return this.fb.onValue(this._ref(`rooms/${code}`), (s) => cb(s.val()));
  }
}

// ---------------------------------------------------------------------------

/**
 * Chọn backend: Firebase nếu đã điền databaseURL (và không có ?local=1 trên URL).
 * @returns {Promise<LocalBackend|FirebaseBackend>}
 */
export async function getBackend() {
  const forceLocal = new URLSearchParams(location.search).has('local');
  if (!forceLocal && firebaseConfig.databaseURL) {
    try {
      return await new FirebaseBackend().init();
    } catch (e) {
      console.error('Không kết nối được Firebase, chuyển sang chế độ thử cục bộ', e);
    }
  }
  return new LocalBackend();
}

/** Giá trị đặc biệt để updateRoom ghi giờ máy chủ. */
export const SERVER_NOW = 'SERVER_NOW';
