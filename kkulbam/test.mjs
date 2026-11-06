import assert from 'node:assert/strict';
import { newState, hit, decay, isRaging, grade, angerPercent, COMBO_WINDOW, RAGE_MS } from './logic.js';

// 콤보 창 안에서 연타하면 배수가 오르고, 늦으면 1로 돌아간다
let s = hit(newState(), 0);
assert.equal(s.combo, 1);
assert.equal(s.score, 1);
s = hit(s, COMBO_WINDOW);          // 경계값은 이어진 것으로 본다
assert.equal(s.combo, 2);
assert.equal(s.score, 3);
s = hit(s, COMBO_WINDOW * 3);      // 창을 넘기면 리셋
assert.equal(s.combo, 1);
assert.equal(s.maxCombo, 2);

// 분노가 가득 차면 격노 모드가 켜지고 점수가 2배가 된다
let r = newState();
for (let i = 0; i < 15; i++) r = hit(r, i * 100);
assert.ok(isRaging(r, r.lastHit), '15대면 격노에 들어가야 한다');
const before = r.score, combo = r.combo;
r = hit(r, r.lastHit + 100);
assert.equal(r.score - before, (combo + 1) * 2, '격노 중에는 2배');

// 격노가 끝나면 게이지가 0으로 떨어진다
const after = decay(r, r.rageUntil + 1, 16);
assert.ok(!isRaging(after, r.rageUntil + 1));
assert.equal(after.rage, 0);

// 가만히 두면 분노가 빠지고 콤보가 끊긴다
const idle = decay({ ...newState(), rage: 50, combo: 5, lastHit: 0 }, 2000, 1000);
assert.equal(idle.rage, 30);
assert.equal(idle.combo, 0);

// 분노 지수는 99%를 넘지 않는다
assert.equal(angerPercent({ score: 99999 }), 99);
assert.equal(typeof grade({ hits: 0 }), 'string');

console.log('ok');
