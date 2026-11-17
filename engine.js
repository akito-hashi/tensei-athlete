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
    life.turn = 0;
    life.board = {};
    life.pendingEvent = null;
    rollBoard(game);
    return life;
  }

  // ---- 育成ターン ----
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function skillTrain(life, key) {
    let plus = 0, mult = 1;
    for (const id of life.skills) {
      const t = D.SKILLS[id] && D.SKILLS[id].train;
      if (!t || t[key] == null) continue;
      if (key.endsWith("Plus")) plus += t[key]; else mult *= t[key];
    }
    return key.endsWith("Plus") ? plus : mult;
  }

  // 仲間がどの練習に来ているか（毎ターンえらび直す。来ない日もある）
  function rollBoard(game) {
    const life = game.life;
    const practices = D.PRACTICES[life.sport];
    life.board = {};
    for (const p of practices) life.board[p.id] = [];
    for (const f of D.FRIENDS) {
      if (rand(game) < 0.3) continue;
      life.board[practices[randInt(game, 0, practices.length - 1)].id].push(f.id);
    }
  }

  function injuryChance(life) {
    return life.stamina < 20 ? (0.05 + (20 - life.stamina) * 0.025) * skillTrain(life, "failMult") : 0;
  }
  function failChance(life) {
    const base = life.stamina < 30 ? 0.03 + (30 - life.stamina) * 0.02 : 0.02;
    return base * skillTrain(life, "failMult");
  }
  // UI 用：その練習が失敗する（ケガ含む）おおよその確率
  function riskOf(life) {
    const inj = injuryChance(life);
    return inj + (1 - inj) * failChance(life);
  }

  function actions(life) {
    const list = D.PRACTICES[life.sport].map((p) => ({
      id: p.id, kind: "practice", label: p.label, main: p.main, sub: p.sub,
      friends: (life.board && life.board[p.id]) || [], risk: riskOf(life), enabled: !life.injured,
    }));
    list.push({ id: "rest", kind: "rest", label: "休む", enabled: true, friends: [] });
    list.push({ id: "play", kind: "play", label: "遊ぶ", enabled: true, friends: [] });
    return list;
  }

  function learnSkill(life, id) {
    if (!id || life.skills.includes(id)) return null;
    life.skills.push(id);
    return id;
  }

  function addFriend(life, id, n) {
    const before = life.friends[id] || 0;
    const after = clamp(before + n, 0, 100);
    life.friends[id] = after;
    const f = D.FRIENDS.find((x) => x.id === id);
    const out = { id, before, after };
    if (before < 40 && after >= 40) out.talk = D.FRIEND_TALK[id];
    if (before < 80 && after >= 80) out.skill = learnSkill(life, f.skill);
    return out;
  }

  function practiceTurn(game, p) {
    const life = game.life;
    const r = { kind: "success", action: p.id, gains: {}, mult: 1, staminaCost: 0, friendsMet: [], skillGot: null };
    if (rand(game) < injuryChance(life)) {
      r.kind = "injury";
      life.injured = randInt(game, 1, 3);
      life.motivation = clamp(life.motivation - 1, 1, 5);
      return r;
    }
    const failP = failChance(life); // 練習前の体力で決まる（画面に出す確率と同じ）
    r.staminaCost = Math.round(randInt(game, 15, 25) * skillTrain(life, "costMult"));
    life.stamina = clamp(life.stamina - r.staminaCost, 0, 100);
    if (rand(game) < failP) {
      r.kind = "fail";
      if (rand(game) < 0.5) life.motivation = clamp(life.motivation - 1, 1, 5);
      return r;
    }
    const friends = life.board[p.id] || [];
    const greatP = 0.1 + skillTrain(life, "greatPlus") + (friends.length ? 0.1 + skillTrain(life, "friendGreatPlus") : 0);
    if (rand(game) < greatP) { r.kind = "great"; r.mult = 2; }
    const m = D.TALENT_MULT[life.talents[life.sport]] * D.MOTIVATION_MULT[life.motivation - 1] * r.mult;
    const exp = game.inherit.exp[life.sport] || 0;
    r.gains[p.main] = Math.round((D.PRACTICE_GAIN.main + exp) * m) + randInt(game, 0, 1) + friends.length;
    r.gains[p.sub] = (r.gains[p.sub] || 0) + Math.round(D.PRACTICE_GAIN.sub * m);
    addStats(life, r.gains);
    for (const f of friends) r.friendsMet.push(addFriend(life, f, 10 + randInt(game, 0, 4)));
    const fromFriend = r.friendsMet.find((x) => x.skill);
    if (fromFriend) r.skillGot = fromFriend.skill;
    else if (r.kind === "great" && rand(game) < 0.2) {
      const pool = D.GREAT_SKILL_POOL.filter((id) => !life.skills.includes(id) && (!D.SKILLS[id].sport || D.SKILLS[id].sport === life.sport));
      if (pool.length) r.skillGot = learnSkill(life, pool[randInt(game, 0, pool.length - 1)]);
    }
    return r;
  }

  function assertCanAct(life) {
    assertPhase(life, "train");
    if (life.pendingEvent) throw new Error("イベントをえらんでください");
    if (life.pendingTournament) throw new Error("大会が先です");
  }

  // 1ターン進める。action は練習 id / "rest" / "play"
  function train(game, action) {
    const life = game.life;
    assertCanAct(life);
    let r;
    if (action === "rest") {
      const heal = randInt(game, 40, 50);
      life.stamina = clamp(life.stamina + heal, 0, 100);
      if (rand(game) < 0.3) life.motivation = clamp(life.motivation + 1, 1, 5);
      r = { kind: "rest", action, heal, gains: {} };
    } else if (action === "play") {
      life.stamina = clamp(life.stamina + 20, 0, 100);
      life.motivation = clamp(life.motivation + 1, 1, 5);
      addStats(life, { men: 1 });
      r = { kind: "play", action, gains: { men: 1 } };
    } else {
      const p = D.PRACTICES[life.sport].find((x) => x.id === action);
      if (!p) throw new Error("知らない練習です: " + action);
      if (life.injured) throw new Error("ケガ中は練習できません");
      r = practiceTurn(game, p);
    }
    if ((action === "rest" || action === "play") && life.injured) life.injured -= 1;
    endTurn(game, r);
    return r;
  }

  function endTurn(game, r) {
    const life = game.life;
    life.turn += 1;
    life.slot += 1;
    if (!life.noEvents && rand(game) < D.EVENT_CHANCE) {
      const ev = D.EVENTS[randInt(game, 0, D.EVENTS.length - 1)];
      life.pendingEvent = ev.id;
      r.event = ev.id;
    }
    rollBoard(game);
  }

  function resolveEvent(game, idx) {
    const life = game.life;
    assertPhase(life, "train");
    const ev = D.EVENTS.find((e) => e.id === life.pendingEvent);
    if (!ev) throw new Error("イベントはありません");
    const c = ev.choices[idx];
    if (!c) throw new Error("その選択肢はありません");
    if (c.stats) for (const [k, v] of Object.entries(c.stats)) life.stats[k] = Math.max(0, life.stats[k] + v);
    if (c.stamina) life.stamina = clamp(life.stamina + c.stamina, 0, 100);
    if (c.motivation) life.motivation = clamp(life.motivation + c.motivation, 1, 5);
    const friendsMet = [];
    if (c.allFriends) for (const f of D.FRIENDS) friendsMet.push(addFriend(life, f.id, c.allFriends));
    if (c.friends) for (const [id, n] of Object.entries(c.friends)) friendsMet.push(addFriend(life, id, n));
    let skillGot = c.skill ? learnSkill(life, c.skill) : null;
    if (!skillGot) { const fs = friendsMet.find((x) => x.skill); if (fs) skillGot = fs.skill; }
    life.pendingEvent = null;
    return { text: c.text, friendsMet, skillGot };
  }

  return { newGame, startLife, childStep, recommendSport, chooseSport, actions, train, resolveEvent, riskOf, rand, randInt };
});
