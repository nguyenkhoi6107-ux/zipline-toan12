/**
 * game-core.js — Luật chơi của một học sinh (mục 3), không phụ thuộc giao diện.
 *
 * Giao diện gọi tick(dt) mỗi khung hình, submitLine()/submitZ() khi học sinh nộp,
 * và setPaused() trong lúc chạy hoạt cảnh (quái đứng yên khi nhân vật đang đu dây/rơi).
 */
import { gradeLine, gradeZ, feedbackFor } from './math.js';

export class PlayerRun {
  /**
   * @param {object} opts
   * @param {object[]} opts.levels   Bộ đề từ generateRun()
   * @param {object} opts.monster    Tham số quái (xem config/game-config.json)
   * @param {number} opts.lives
   * @param {() => number} [opts.now] Đồng hồ (ms), tiêm vào để test
   */
  constructor({ levels, monster, lives = 2, now = () => Date.now() }) {
    this.levels = levels;
    this.monster = { ...monster };
    this.now = now;
    this.levelIndex = 0;
    /** 'line' = đang làm câu a, 'z' = đang làm câu b */
    this.stage = 'line';
    this.lives = lives;
    this.monsterDist = monster.startDistance;
    /** 'playing' | 'finished' | 'eliminated' | 'timeout' */
    this.status = 'playing';
    this.paused = false;
    this.levelsPassed = 0;
    this.wrongCount = 0;
    this.correctCount = 0;
    this.finishedAt = null;
    this.lastProgressAt = now();
  }

  /** Đề của màn hiện tại. */
  get level() {
    return this.levels[Math.min(this.levelIndex, this.levels.length - 1)];
  }

  get totalLevels() {
    return this.levels.length;
  }

  setPaused(p) {
    this.paused = p;
  }

  /** Tiến độ chi tiết để xếp hạng khi hết giờ: mỗi màn 2 bước. */
  get progressSteps() {
    return this.levelsPassed * 2 + (this.stage === 'z' ? 1 : 0);
  }

  _clampDist() {
    this.monsterDist = Math.min(this.monster.maxDistance, this.monsterDist);
  }

  /** Xử lý khi quái chạm nhân vật. Trả về sự kiện. */
  _checkCaught() {
    if (this.monsterDist > 0) return null;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.monsterDist = 0;
      this.status = 'eliminated';
      return { type: 'eliminated' };
    }
    // Hồi sinh ngay tại đoạn dây đang làm, quái lùi lại.
    this.monsterDist = this.monster.pushBackOnRespawn;
    return { type: 'caught', livesLeft: this.lives };
  }

  /**
   * Thời gian trôi: quái tiến đều.
   * @param {number} dtSec
   * @returns {object|null} sự kiện 'caught' | 'eliminated' nếu có
   */
  tick(dtSec) {
    if (this.status !== 'playing' || this.paused) return null;
    this.monsterDist -= this.monster.speedPerSecond * dtSec;
    return this._checkCaught();
  }

  _wrong() {
    this.wrongCount += 1;
    this.monsterDist -= this.monster.jumpOnWrong;
    return this._checkCaught();
  }

  /**
   * Nộp câu a.
   * @param {{point:string[], dir:string[]}} answer
   */
  submitLine(answer) {
    if (this.status !== 'playing' || this.stage !== 'line') return null;
    const g = gradeLine(this.level, answer);
    // Ô trống / không đọc được: không phạt, chỉ nhắc (tránh mất mạng oan vì gõ nhầm).
    if (g.reason === 'invalid') return { ...g, feedback: feedbackFor('a', g.reason), penalized: false };
    let event = null;
    if (g.correct) {
      this.correctCount += 1;
      this.stage = 'z';
      this.monsterDist += this.monster.gainOnLineCorrect;
      this._clampDist();
      this.lastProgressAt = this.now();
    } else {
      event = this._wrong();
    }
    return { ...g, feedback: feedbackFor('a', g.reason), penalized: !g.correct, event };
  }

  /**
   * Nộp câu b.
   * @param {string} raw
   */
  submitZ(raw) {
    if (this.status !== 'playing' || this.stage !== 'z') return null;
    const g = gradeZ(this.level, raw);
    if (g.reason === 'invalid') return { ...g, feedback: feedbackFor('b', g.reason, this.level), penalized: false };
    let event = null;
    if (g.correct) {
      this.correctCount += 1;
      this.levelsPassed += 1;
      this.lastProgressAt = this.now();
      this.monsterDist += this.monster.gainOnLevelComplete;
      this._clampDist();
      if (this.levelsPassed >= this.levels.length) {
        this.status = 'finished';
        this.finishedAt = this.now();
        event = { type: 'finished' };
      } else {
        this.levelIndex += 1;
        this.stage = 'line';
      }
    } else {
      event = this._wrong();
    }
    return { ...g, feedback: feedbackFor('b', g.reason, this.level), penalized: !g.correct, event };
  }

  /** Hết giờ ván. */
  timeUp() {
    if (this.status === 'playing') this.status = 'timeout';
  }

  /** Ảnh chụp trạng thái để gửi lên bảng xếp hạng. */
  snapshot() {
    return {
      levelIndex: this.levelIndex,
      levelsPassed: this.levelsPassed,
      stage: this.stage,
      lives: this.lives,
      monsterDist: Math.round(this.monsterDist),
      status: this.status,
      finishedAt: this.finishedAt,
      lastProgressAt: this.lastProgressAt,
      wrongCount: this.wrongCount,
      correctCount: this.correctCount,
    };
  }

  /** Khôi phục sau khi tải lại trang (cùng hạt giống đề). */
  restore(s) {
    if (!s) return;
    this.levelIndex = s.levelIndex ?? 0;
    this.levelsPassed = s.levelsPassed ?? 0;
    this.stage = s.stage ?? 'line';
    this.lives = s.lives ?? this.lives;
    this.monsterDist = s.monsterDist ?? this.monsterDist;
    this.status = s.status ?? 'playing';
    this.finishedAt = s.finishedAt ?? null;
    this.lastProgressAt = s.lastProgressAt ?? this.lastProgressAt;
    this.wrongCount = s.wrongCount ?? 0;
    this.correctCount = s.correctCount ?? 0;
  }
}
