// 転生アスリート — ゲームのルール（画面は app.js）
// 状態はすべて素のオブジェクト。乱数の状態も game.rng に持つので、JSON にして保存・復元しても同じ続きになる。
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"));
  else root.Engine = factory(root.GameData);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";

  // ---- 乱数（mulberry32。状態は game.rng） ----
  function rand(game) {
    game.rng = (game.rng + 0x6d2b79f5) >>> 0;
    let t = game.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randInt(game, lo, hi) { return lo + Math.floor(rand(game) * (hi - lo + 1)); }

  function zeroStats() { const o = {}; for (const k of D.STATS) o[k] = 0; return o; }
  function zeroSports() { const o = {}; for (const s of D.SPORTS) o[s] = 0; return o; }

  function newGame({ name, gender, seed }) {
    return {
      v: 1,
      name: String(name || "").trim() || "ななし",
      gender: gender === "f" ? "f" : "m",
      rng: (seed == null ? Math.floor(Math.random() * 2 ** 32) : seed) >>> 0,
      lifeNo: 0,
      cleared: false,
      medals: { track: [], judo: [], gym: [] },
      inherit: { bonus: zeroStats(), exp: zeroSports(), innateSkills: [] },
      lives: [],
      life: null,
    };
  }

  function rollTalent(game) {
    let r = rand(game) * 100;
    for (const rank of D.TALENT_RANKS) { r -= D.TALENT_ODDS[rank]; if (r < 0) return rank; }
    return "D";
  }

  function startLife(game) {
    game.lifeNo += 1;
    const talents = {};
    for (const s of D.SPORTS) talents[s] = rollTalent(game);
    const stats = {};
    for (const k of D.STATS) stats[k] = Math.round((10 + randInt(game, 0, 5)) * (1 + game.inherit.bonus[k]));
    game.life = {
      phase: "child", age: 0, childTurn: 0,
      talents, encounters: zeroSports(), stats,
      sport: null, year: 0, slot: 0,
      stamina: 100, motivation: 3, injured: 0,
      friends: {}, skills: [], history: [], log: [],
    };
    return game.life;
  }

  function assertPhase(life, phase) {
    if (!life || life.phase !== phase) throw new Error(`今は ${phase} の場面ではありません`);
  }

  function addStats(life, gains) {
    for (const [k, v] of Object.entries(gains)) life.stats[k] += v;
  }

  // 子ども期：習い事を 1つえらぶ。4回で 12歳になり、競技えらびへ
  function childStep(game, choice) {
    const life = game.life;
    assertPhase(life, "child");
    const lesson = D.CHILD_LESSONS[choice];
    if (!lesson) throw new Error("知らない習い事です: " + choice);
    const gains = {};
    for (const [k, v] of Object.entries(lesson.gains)) gains[k] = v + randInt(game, 0, 1);
    addStats(life, gains);
    if (choice !== "play") life.encounters[choice] += 1;
    life.childTurn += 1;
    life.age = life.childTurn * 3;
    if (life.childTurn >= D.CHILD_TURNS) life.phase = "choose";
    return { choice, gains, text: lesson.text };
  }

  // おすすめ競技：才能 ＋ 子ども時代に触れた回数
  function recommendSport(life) {
    const score = (s) => (5 - D.TALENT_RANKS.indexOf(life.talents[s])) * 2 + life.encounters[s];
    return D.SPORTS.reduce((best, s) => (score(s) > score(best) ? s : best), D.SPORTS[0]);
  }

  function chooseSport(game, sport) {
    const life = game.life;
    assertPhase(life, "choose");
    if (!D.SPORTS.includes(sport)) throw new Error("知らない競技です: " + sport);
    life.sport = sport;
    life.phase = "train";
    life.year = 0;
    life.slot = 0;
    life.stamina = 100;
    life.motivation = 3;
    life.skills = [...game.inherit.innateSkills];
    return life;
  }

  return { newGame, startLife, childStep, recommendSport, chooseSport, rand, randInt };
});
