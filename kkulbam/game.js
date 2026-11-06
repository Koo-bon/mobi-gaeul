import { newState, hit, decay, isRaging, grade, angerPercent, GAME_MS } from './logic.js';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
ctx.imageSmoothingEnabled = false;

const $ = (id) => document.getElementById(id);
const intro = $('intro'), result = $('result');

const HEAD_X = W / 2, HEAD_Y = 290;

let brand = '';
let state = newState();
let phase = 'intro';          // intro | play | result
let startedAt = 0;
let shake = 0;                // 화면 흔들림 강도
let squash = 0;               // 머리 눌림 0~1
let finger = 1;               // 0 = 내리치는 순간, 1 = 손 올라간 상태
let bumps = [];               // 머리에 쌓이는 혹
let stars = [];               // 튀는 별
let pops = [];                // 떠오르는 글자
let last = 0;

/* ---------------- 소리: 파일 없이 합성한다 ---------------- */
let ac = null;
function thwack(combo) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const buf = ac.createBuffer(1, 1400, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const n = ac.createBufferSource(); n.buffer = buf;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(.3, t); ng.gain.exponentialRampToValueAtTime(.001, t + .09);
    n.connect(ng).connect(ac.destination); n.start(t);

    const o = ac.createOscillator(); o.type = 'square';
    const f = 380 + Math.min(combo, 12) * 34;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(80, t + .1);
    const g = ac.createGain();
    g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .11);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .13);
  } catch { /* 소리는 없어도 게임은 돌아간다 */ }
}

/* ---------------- 한 대 때리기 ---------------- */
const SHOUTS = ['딱!', '퍽!', '꿀밤!', '아야!', '으악!', '커헉!'];

function strike(now) {
  state = hit(state, now);
  squash = 1;
  finger = 0;
  shake = Math.min(10, 3 + state.combo * .4);
  // 혹은 정해진 네 자리에 차례로 붙는다 (겹쳐서 한 덩어리가 되지 않게)
  if (bumps.length < 4) bumps.push({ x: -33 + bumps.length * 22, s: 0, h: 9 + Math.random() * 3 });
  else bumps[(Math.random() * 4) | 0].s = .4;   // 꽉 차면 아무 혹이나 다시 부풀린다
  for (let i = 0; i < 7; i++) {
    stars.push({
      x: HEAD_X + (Math.random() - .5) * 60, y: HEAD_Y - 58,
      vx: (Math.random() - .5) * 5, vy: -1.6 - Math.random() * 3.2, life: 1,
    });
  }
  pops.push({
    x: HEAD_X + (Math.random() - .5) * 90, y: HEAD_Y - 118, life: 1,
    text: state.combo >= 3 ? `x${state.combo}` : SHOUTS[(Math.random() * SHOUTS.length) | 0],
    big: state.combo >= 3,
  });
  thwack(state.combo);
}

/* ---------------- 그리기 도우미 ---------------- */
const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

function text(str, x, y, size, color, align = 'center', weight = 700) {
  ctx.font = `${weight} ${size}px Galmuri, monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x | 0, y | 0);
}

/* ---------------- 배경 ---------------- */
function drawBack(now, raging) {
  px(0, 0, W, H, raging ? '#4a1030' : '#241a46');
  px(0, 0, W, 170, raging ? '#5d1536' : '#2d2156');
  // 멀리 보이는 창문들
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 38, y = 46 + ((i * 29) % 46);
    px(x, y, 20, 26, raging ? '#7a2048' : '#3b2d6d');
    px(x + 4, y + 5, 12, 7, raging ? '#c05a7a' : '#584293');
  }
  // 바닥
  px(0, 360, W, H - 360, raging ? '#380c24' : '#1b1430');
  px(0, 360, W, 5, raging ? '#7a2048' : '#3b2d6d');
}

/* ---------------- 머리통 ---------------- */
function drawVictim(now, raging) {
  const sq = squash;
  const cx = HEAD_X, cy = HEAD_Y + sq * 7;
  const hw = 60 + sq * 5, hh = 54 - sq * 6;
  const skin = raging ? '#ffd0b0' : '#ffe2c4';
  const line = '#2a1a33';

  // 어깨
  px(cx - 72, cy + hh + 16, 144, 70, raging ? '#8a2a4f' : '#4b3b8a');
  px(cx - 72, cy + hh + 16, 144, 6, raging ? '#aa3b66' : '#5f4ca8');

  // 목
  px(cx - 16, cy + hh - 6, 32, 26, '#e8c7a4');

  // 머리 (모서리를 깎아 픽셀 느낌)
  px(cx - hw, cy - hh + 8, hw * 2, hh * 2 - 16, skin);
  px(cx - hw + 8, cy - hh, hw * 2 - 16, hh * 2, skin);
  // 테두리
  ctx.strokeStyle = line; ctx.lineWidth = 3;
  ctx.strokeRect((cx - hw + 8) | 0, (cy - hh) | 0, (hw * 2 - 16) | 0, (hh * 2) | 0);

  // 귀
  px(cx - hw - 7, cy - 6, 9, 20, skin);
  px(cx + hw - 2, cy - 6, 9, 20, skin);

  // 머리카락
  px(cx - hw + 8, cy - hh, hw * 2 - 16, 16, '#3a2a4a');
  px(cx - hw, cy - hh + 8, hw * 2, 8, '#3a2a4a');

  // 이마 띠 + 브랜드 이름
  const bw = hw * 2 - 20;
  px(cx - bw / 2, cy - hh + 18, bw, 24, raging ? '#ffcf4d' : '#fff7ec');
  ctx.strokeStyle = line; ctx.lineWidth = 2;
  ctx.strokeRect((cx - bw / 2) | 0, (cy - hh + 18) | 0, bw | 0, 24);
  let size = 17;
  ctx.font = `700 ${size}px Galmuri, monospace`;
  while (ctx.measureText(brand).width > bw - 10 && size > 8) {
    size--; ctx.font = `700 ${size}px Galmuri, monospace`;
  }
  text(brand, cx, cy - hh + 31, size, '#1b1430');

  // 눈: 맞을수록 찡그린다
  const hurt = squash > .35;
  const eyeY = cy + 4;
  for (const s of [-1, 1]) {
    const ex = cx + s * 22;
    if (hurt) { px(ex - 10, eyeY, 20, 4, line); }
    else {
      px(ex - 9, eyeY - 8, 18, 16, '#fff7ec');
      px(ex - 4 + s * 2, eyeY - 4, 8, 9, line);
    }
    // 눈썹: 격노하면 안쪽이 내려와 치켜뜬 모양이 된다
    const by = eyeY - 14 + (hurt ? 3 : 0);
    if (raging) { px(ex - 11, by - 3 * s, 11, 4, line); px(ex, by + 3 * s, 11, 4, line); }
    else px(ex - 11, by, 22, 4, line);
  }

  // 입
  if (hurt) { px(cx - 13, cy + 28, 26, 14, line); px(cx - 9, cy + 32, 18, 6, '#ff8a8a'); }
  else px(cx - 14, cy + 32, 28, 4, line);

  // 혹
  bumps.forEach((b) => {
    b.s = Math.min(1, b.s + .14);
    const h = b.h * b.s, bx = cx + b.x, base = cy - hh + 4;   // 머리 위에 딱 붙인다
    px(bx - h, base - h, h * 2, h, '#ff9fb4');
    px(bx - h * .55, base - h * 1.7, h * 1.1, h * .8, '#ff9fb4');
    px(bx - h * .3, base - h * 1.5, 4, 3, '#ffd2dc');
  });
}

/* ---------------- 손 ---------------- */
function drawHand() {
  const t = finger;                       // 0 = 타격, 1 = 대기
  const x = HEAD_X + 58, y = HEAD_Y - 118 - 46 * t;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35 - 0.9 * t);
  px(-16, -14, 34, 30, '#ffe2c4');                 // 주먹
  ctx.strokeStyle = '#2a1a33'; ctx.lineWidth = 3;
  ctx.strokeRect(-16, -14, 34, 30);
  px(-30, -4, 16, 11, '#ffe2c4');                  // 튕기는 손가락
  ctx.strokeRect(-30, -4, 16, 11);
  px(-16, 16, 30, 12, '#c3b6e6');                  // 소매
  ctx.restore();
}

/* ---------------- 이펙트 ---------------- */
function drawEffects(dt) {
  for (const s of stars) {
    s.x += s.vx; s.y += s.vy; s.vy += .22; s.life -= dt / 620;
    if (s.life > 0) {
      ctx.globalAlpha = Math.max(0, s.life);
      text('★', s.x, s.y, 14, '#ffcf4d');
      ctx.globalAlpha = 1;
    }
  }
  stars = stars.filter((s) => s.life > 0);

  for (const p of pops) {
    p.y -= 1.1; p.life -= dt / 700;
    if (p.life > 0) {
      ctx.globalAlpha = Math.max(0, p.life);
      text(p.text, p.x, p.y, p.big ? 30 : 22, p.big ? '#ff6b9d' : '#fff7ec');
      ctx.globalAlpha = 1;
    }
  }
  pops = pops.filter((p) => p.life > 0);
}

/* ---------------- HUD ---------------- */
function drawHud(now, raging) {
  const left = Math.max(0, GAME_MS - (now - startedAt));
  // 남은 시간
  px(0, 0, W, 14, '#0d0a1a');
  px(0, 0, (W * left) / GAME_MS, 14, left < 3000 ? '#ff6b6b' : '#8affc1');
  text(`${(left / 1000).toFixed(1)}초`, W - 8, 28, 13, '#fff7ec', 'right');
  text(`${state.score}점`, 8, 28, 15, '#ffcf4d', 'left');
  if (state.combo > 1) text(`${state.combo} 연타`, W / 2, 28, 15, '#ff6b9d');

  // 분노 게이지
  const gy = H - 30;
  text('분노', 8, gy + 7, 13, '#c3b6e6', 'left');
  px(48, gy, W - 60, 16, '#0d0a1a');
  px(50, gy + 2, ((W - 64) * state.rage) / 100, 12, raging ? '#ffcf4d' : '#ff6b9d');
  if (raging) text('격 노 모 드 ! 점수 2배', W / 2, gy - 18, 17, '#ffcf4d');
}

/* ---------------- 루프 ---------------- */
function frame(now) {
  const dt = Math.min(50, now - last || 16);
  last = now;

  if (phase === 'play') {
    state = decay(state, now, dt);
    if (now - startedAt >= GAME_MS) finish();
  }
  squash = Math.max(0, squash - dt / 110);
  finger = Math.min(1, finger + dt / 110);
  shake = Math.max(0, shake - dt / 26);

  const raging = phase === 'play' && isRaging(state, now);
  const amp = shake + (raging ? 2 : 0);

  ctx.save();
  ctx.translate((Math.random() - .5) * amp, (Math.random() - .5) * amp);
  drawBack(now, raging);
  drawVictim(now, raging);
  if (phase === 'play') drawHand();
  drawEffects(dt);
  ctx.restore();

  if (raging) { ctx.fillStyle = 'rgba(255,60,80,.14)'; ctx.fillRect(0, 0, W, H); }
  if (phase === 'play') drawHud(now, raging);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- 화면 전환 ---------------- */
function begin() {
  const v = $('name').value.trim();
  if (!v) { $('err').textContent = '이름을 적어야 때릴 수 있습니다.'; return; }
  $('err').textContent = '';
  brand = v;
  state = newState();
  bumps = []; stars = []; pops = [];
  startedAt = performance.now();
  phase = 'play';
  intro.hidden = true; result.hidden = true;
  thwack(0);   // 첫 탭에서 오디오를 깨운다
}

function finish() {
  phase = 'result';
  $('r-title').textContent = `${brand} 에게`;
  $('r-score').textContent = `꿀밤 ${state.hits}대`;
  $('r-lines').innerHTML =
    `점수 ${state.score}점<br>최고 콤보 x${state.maxCombo}<br>분노 지수 ${angerPercent(state)}%`;
  $('r-grade').textContent = grade(state);
  result.hidden = false;
}

cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (phase === 'play') strike(performance.now());
});
$('start').addEventListener('click', begin);
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') begin(); });
$('again').addEventListener('click', begin);
$('other').addEventListener('click', () => {
  result.hidden = true; intro.hidden = false; phase = 'intro';
  bumps = []; stars = []; pops = []; state = newState();
  $('name').select();
});
