// バランス確認用のボット（テストとシミュレーションで共用）
const E = require("../engine.js");
const D = require("../data.js");

const rankScore = (r) => 5 - D.TALENT_RANKS.indexOf(r);

// 上手なプレイヤー：才能の高い競技を選び、体力を管理し、大会前は休む
function smartPolicy(g) {
  const L = g.life;
  if (L.phase === "child") {
    const best = D.SPORTS.reduce((a, s) => (rankScore(L.talents[s]) > rankScore(L.talents[a]) ? s : a), D.SPORTS[0]);
    return E.childStep(g, best);
  }
  if (L.phase === "choose") {
    const best = D.SPORTS.reduce((a, s) => (rankScore(L.talents[s]) + (g.inherit.exp[s] || 0) > rankScore(L.talents[a]) + (g.inherit.exp[a] || 0) ? s : a), D.SPORTS[0]);
    return E.chooseSport(g, best);
  }
  if (L.pendingEvent) return E.resolveEvent(g, 0);
  if (L.pendingTournament) return E.runTournament(g);
  if (L.injured) return E.train(g, "rest");
  const last = L.slot === D.TURNS_PER_YEAR - 1;
  if (L.stamina < 40 || (last && L.stamina < 75)) return E.train(g, L.motivation <= 2 ? "play" : "rest");
  const w = D.SPORT_INFO[L.sport].weights;
  const opts = E.actions(L).filter((a) => a.kind === "practice");
  const val = (a) => w[a.main] * 2 + w[a.sub] + a.friends.length * 0.15;
  return E.train(g, opts.reduce((a, b) => (val(b) > val(a) ? b : a)).id);
}

// ふつうの子ども：おすすめの競技を選び、★の練習を中心に（ときどき気まぐれに）練習する。大会前に休む作戦はしない
function casualPolicy(g, forceSport) {
  const L = g.life;
  const pick = (arr) => arr[E.randInt(g, 0, arr.length - 1)];
  if (L.phase === "child") return E.childStep(g, pick(["track", "judo", "gym", "play"]));
  if (L.phase === "choose") return E.chooseSport(g, forceSport || E.recommendSport(L));
  if (L.pendingEvent) return E.resolveEvent(g, E.randInt(g, 0, D.EVENTS.find((e) => e.id === L.pendingEvent).choices.length - 1));
  if (L.pendingTournament) return E.runTournament(g);
  if (L.injured || L.stamina < 35) return E.train(g, L.motivation <= 2 ? "play" : "rest");
  const acts = E.actions(L).filter((a) => a.kind === "practice");
  const keys = acts.filter((a) => a.key);
  return E.train(g, (E.rand(g) < 0.7 ? pick(keys) : pick(acts)).id);
}

// でたらめなプレイヤー
function randomPolicy(g) {
  const L = g.life;
  const pick = (arr) => arr[E.randInt(g, 0, arr.length - 1)];
  if (L.phase === "child") return E.childStep(g, pick(["track", "judo", "gym", "play"]));
  if (L.phase === "choose") return E.chooseSport(g, pick(D.SPORTS));
  if (L.pendingEvent) return E.resolveEvent(g, 0);
  if (L.pendingTournament) return E.runTournament(g);
  return E.train(g, pick(E.actions(L).filter((a) => a.enabled)).id);
}

// 始まった人生を最後まで遊ぶ。各年齢の大会前の実力を記録する
function runLife(g, policy) {
  const powerAt = {};
  let turns = 0;
  while (["child", "choose", "train"].includes(g.life.phase)) {
    const L = g.life;
    if (L.phase === "train" && !L.pendingEvent) {
      if (L.pendingTournament) powerAt[L.age] = E.power(L);
      else turns++;
    }
    policy(g);
    if (turns > 400) throw new Error("人生が終わらない");
  }
  return { phase: g.life.phase, sport: g.life.sport, powerAt, turns };
}

// クリアするまで（最大 maxLives 回）転生をくり返す
function playUntilClear(seed, policy, maxLives = 10) {
  const g = E.newGame({ name: "bot", gender: "m", seed });
  const lives = [];
  while (lives.length < maxLives) {
    if (lives.length === 0) E.startLife(g); else E.reincarnate(g);
    const r = runLife(g, policy);
    lives.push(r);
    if (r.phase === "gold") break;
  }
  return { cleared: g.cleared, lives, game: g };
}

module.exports = { smartPolicy, casualPolicy, randomPolicy, playUntilClear };
