// 순수 로직만 둔다. 캔버스도 DOM도 건드리지 않아서 노드에서 바로 테스트할 수 있다.
export const GAME_MS = 10000;      // 한 판 길이
export const COMBO_WINDOW = 500;   // 이 안에 또 때리면 콤보가 이어진다
export const MAX_COMBO = 20;
export const RAGE_PER_HIT = 7;     // 한 대당 차오르는 분노
export const RAGE_MS = 3000;       // 격노 모드 지속 시간

export function newState() {
  return { hits: 0, combo: 0, maxCombo: 0, score: 0, rage: 0, rageUntil: 0, lastHit: -Infinity };
}

export const isRaging = (s, now) => now < s.rageUntil;

/** 꿀밤 한 대. 바뀐 상태를 돌려준다(원본은 건드리지 않는다). */
export function hit(s, now) {
  const combo = now - s.lastHit <= COMBO_WINDOW ? Math.min(s.combo + 1, MAX_COMBO) : 1;
  const raging = isRaging(s, now);
  const next = {
    ...s,
    hits: s.hits + 1,
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    score: s.score + combo * (raging ? 2 : 1),
    lastHit: now,
  };
  if (!raging) {
    next.rage = Math.min(100, s.rage + RAGE_PER_HIT);
    if (next.rage >= 100) next.rageUntil = now + RAGE_MS;
  }
  return next;
}

/** 시간이 흐르면서 분노가 빠진다. 격노 중에는 게이지가 남은 시간을 보여준다. */
export function decay(s, now, dtMs) {
  const combo = now - s.lastHit > COMBO_WINDOW ? 0 : s.combo;
  if (isRaging(s, now)) {
    return { ...s, combo, rage: (100 * (s.rageUntil - now)) / RAGE_MS };
  }
  // 격노가 막 끝났으면 게이지를 비우고 다시 처음부터 모은다
  if (s.rageUntil) return { ...s, combo, rage: 0, rageUntil: 0 };
  return { ...s, combo, rage: Math.max(0, s.rage - dtMs * 0.02) };
}

export const angerPercent = (s) => Math.min(99, Math.round(s.score / 8));

export function grade(s) {
  if (s.hits >= 120) return '손가락이 흉기입니다';
  if (s.hits >= 80) return '분이 좀 풀리셨나요';
  if (s.hits >= 45) return '아직 더 때릴 수 있습니다';
  if (s.hits >= 15) return '마음이 여리시군요';
  return '그냥 참고 사시는 편';
}
