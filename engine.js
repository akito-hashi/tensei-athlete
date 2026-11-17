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
    life.pendingTournament = null;
    life.bestWon = -1;
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

  // 乱数と仲間を除いた伸び（練習ボタンの目安にも使う）
  function baseGain(game, p, mult = 1) {
    const life = game.life;
    const m = D.TALENT_MULT[life.talents[life.sport]] * D.MOTIVATION_MULT[life.motivation - 1] * mult;
    const exp = game.inherit.exp[life.sport] || 0;
    const bonus = game.inherit.bonus;
    return {
      main: Math.round((D.PRACTICE_GAIN.main + exp) * m * (1 + bonus[p.main])),
      sub: Math.round(D.PRACTICE_GAIN.sub * m * (1 + bonus[p.sub])),
    };
  }

  function previewGain(game, practiceId) {
    const p = D.PRACTICES[game.life.sport].find((x) => x.id === practiceId);
    if (!p) throw new Error("知らない練習です: " + practiceId);
    return { stat: p.main, subStat: p.sub, ...baseGain(game, p) };
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
    const base = baseGain(game, p, r.mult);
    r.gains[p.main] = base.main + randInt(game, 0, 1) + friends.length;
    r.gains[p.sub] = (r.gains[p.sub] || 0) + base.sub;
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
    if (life.slot >= D.TURNS_PER_YEAR) {
      life.pendingTournament = { age: life.age };
      r.tournament = true;
    } else if (!life.noEvents && rand(game) < D.EVENT_CHANCE) {
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

  // ---- 大会 ----
  const STAGE_INDEX = Object.fromEntries(D.STAGES.map((s, i) => [s.id, i]));
  const stage = (id) => D.STAGES[STAGE_INDEX[id]];

  function stageChain(age) {
    let ids;
    if (age <= 14) ids = ["chiku", "ken_j", "zenkoku_j"];
    else if (age <= 17) ids = ["ken_h", "chiho", "inter"];
    else ids = ["nihon_q", "nihon", D.OLYMPIC_AGES.includes(age) ? "olympic" : "sekai"];
    return ids.map(stage);
  }

  function activeSkills(life) {
    return life.skills
      .map((id) => ({ id, ...D.SKILLS[id] }))
      .filter((s) => s.power && (!s.sport || s.sport === life.sport))
      .sort((a, b) => b.power - a.power);
  }

  // 大会での実力：競技ごとの重みつき能力 × 調子 ＋ スキル
  function power(life) {
    const w = D.SPORT_INFO[life.sport].weights;
    let base = 0;
    for (const k of D.STATS) base += w[k] * life.stats[k];
    const cond = (0.85 + 0.15 * life.stamina / 100) * (0.94 + 0.03 * (life.motivation - 1));
    const skill = activeSkills(life).reduce((a, s) => a + s.power, 0);
    return base * cond + skill;
  }

  const winChance = (pw, level) => 1 / (1 + Math.exp(-(pw - level) / D.LUCK_SCALE));

  function tournamentPreview(game) {
    const life = game.life;
    const pw = power(life);
    return {
      age: life.age, power: pw,
      stages: stageChain(life.age).map((s) => ({ id: s.id, name: s.name, level: s.level, chance: winChance(pw, s.level) })),
    };
  }

  function olympicMedal(margin) {
    if (margin >= 0) return "gold";
    if (margin >= -D.LUCK_SCALE) return "silver";
    if (margin >= -2 * D.LUCK_SCALE) return "bronze";
    return null;
  }

  function luck(game) {
    const u = Math.min(1 - 1e-9, Math.max(1e-9, rand(game)));
    return D.LUCK_SCALE * Math.log(u / (1 - u)); // ロジスティック分布：勝つ割合が winChance と一致する
  }

  function displayFor(sport, perf, margin, win, game) {
    const p = Math.max(0, perf);
    const place = win ? 1 : Math.min(8, 2 + Math.floor(-margin / 16));
    if (sport === "track") return { time: (9.5 + 5 * Math.exp(-p / 200)).toFixed(2), place };
    if (sport === "gym") return { score: (8 + 7 * (1 - Math.exp(-p / 240))).toFixed(3), place };
    const m = Math.abs(margin);
    return { how: m > 2 * D.LUCK_SCALE ? "一本" : m > 0.7 * D.LUCK_SCALE ? "技あり" : "判定", place };
  }

  function linesFor(game, s, d, win, skills) {
    const n = game.name, sp = game.life.sport;
    const lines = [];
    if (sp === "track") lines.push(`【${s.name}】${n}、スタートラインへ。`, "位置について……ドン！");
    else if (sp === "judo") lines.push(`【${s.name}】${n}、畳の上へ。`, "はじめ！");
    else lines.push(`【${s.name}】${n}、演技スタート。`, "大きく深呼吸……！");
    for (const k of skills) lines.push(`スキル「${k.name}」発動！`);
    if (sp === "track") lines.push(win ? `${d.time}秒！ 1着でゴール！！` : `${d.time}秒…… ${d.place}着。あと少し！`);
    else if (sp === "judo") lines.push(win ? `${d.how}！ ${n}の勝ち！！` : `${d.how}で負け……。次こそ！`);
    else lines.push(win ? `${d.score}点！ トップに立った！！` : `${d.score}点…… ${d.place}位。くやしい！`);
    return lines;
  }

  function runTournament(game) {
    const life = game.life;
    assertPhase(life, "train");
    if (!life.pendingTournament) throw new Error("大会はまだです");
    if (life.pendingEvent) throw new Error("イベントをえらんでください");
    const pw = power(life);
    const skills = activeSkills(life).slice(0, 2);
    const rounds = [];
    let medal = null;
    for (const s of stageChain(life.age)) {
      const chance = winChance(pw, s.level);
      const perf = pw + luck(game);
      const margin = perf - s.level;
      const win = margin >= 0;
      const display = displayFor(life.sport, perf, margin, win, game);
      if (s.id === "olympic") { medal = olympicMedal(margin); if (medal === "silver") display.place = 2; if (medal === "bronze") display.place = 3; }
      rounds.push({ stage: s.id, name: s.name, chance, win, margin, display, lines: linesFor(game, s, display, win, skills) });
      if (win) life.bestWon = Math.max(life.bestWon, STAGE_INDEX[s.id]);
      if (!win) break;
    }
    const age = life.age;
    const last = rounds[rounds.length - 1];
    life.history.push({ age, reached: last.stage, won: last.win, medal });
    if (medal) game.medals[life.sport].push({ lifeNo: game.lifeNo, age, medal });
    life.pendingTournament = null;
    life.year += 1;
    life.age += 1;
    life.slot = 0;
    if (medal === "gold") { life.phase = "gold"; game.cleared = true; }
    else if (age >= D.RETIRE_AGE) life.phase = "retire";
    return { age, rounds, medal, best: last.win ? last.stage : rounds.length > 1 ? rounds[rounds.length - 2].stage : null };
  }

  function retire(game) {
    const life = game.life;
    assertPhase(life, "train");
    if (life.age < D.VOLUNTARY_RETIRE_AGE) throw new Error(`${D.VOLUNTARY_RETIRE_AGE}歳から引退できます`);
    life.phase = "retire";
  }

  // ---- 転生 ----
  function lifeMedal(game, lifeNo) {
    const order = ["gold", "silver", "bronze"];
    let best = null;
    for (const s of D.SPORTS) for (const m of game.medals[s]) if (m.lifeNo === lifeNo && (best == null || order.indexOf(m.medal) < order.indexOf(best))) best = m.medal;
    return best;
  }

  function inheritGain(life) {
    return D.INHERIT_BASE + (life.bestWon + 1) * D.INHERIT_PER_STAGE;
  }

  function defaultKeepSkill(game) {
    const cand = game.life.skills.filter((id) => !game.inherit.innateSkills.includes(id));
    cand.sort((a, b) => (D.SKILLS[b].power || 0) - (D.SKILLS[a].power || 0));
    return cand[0] || null;
  }

  function reincarnate(game, { keepSkill } = {}) {
    const life = game.life;
    if (!life || !["retire", "gold"].includes(life.phase)) throw new Error("引退してから転生します");
    if (keepSkill != null && !life.skills.includes(keepSkill)) throw new Error("持っていないスキルです");
    const kept = keepSkill != null ? keepSkill : defaultKeepSkill(game);
    const gain = inheritGain(life);
    for (const k of D.STATS) game.inherit.bonus[k] = Math.round((game.inherit.bonus[k] + gain) * 1000) / 1000;
    game.inherit.exp[life.sport] += 1;
    if (kept && !game.inherit.innateSkills.includes(kept)) game.inherit.innateSkills.push(kept);
    game.lives.push({
      lifeNo: game.lifeNo, sport: life.sport, talents: life.talents, bestWon: life.bestWon,
      bestName: life.bestWon >= 0 ? D.STAGES[life.bestWon].name : null,
      medal: lifeMedal(game, game.lifeNo), endAge: life.age,
    });
    startLife(game);
    return { bonusGain: gain, sport: game.lives[game.lives.length - 1].sport, keptSkill: kept };
  }

  // メダル図鑑：競技ごとのメダル数と、いちばん遠くまで勝ち進んだ大会
  function medalBook(game) {
    const lives = [...game.lives];
    const L = game.life;
    if (L && ["retire", "gold"].includes(L.phase)) lives.push({ sport: L.sport, bestWon: L.bestWon });
    const book = {};
    for (const s of D.SPORTS) {
      const count = (m) => game.medals[s].filter((x) => x.medal === m).length;
      const bw = Math.max(-1, ...lives.filter((x) => x.sport === s).map((x) => x.bestWon));
      book[s] = { gold: count("gold"), silver: count("silver"), bronze: count("bronze"), best: bw >= 0 ? D.STAGES[bw].name : null };
    }
    return book;
  }

  return { previewGain, reincarnate, medalBook, newGame, startLife, childStep, recommendSport, chooseSport, actions, train, resolveEvent, riskOf,
    stageChain, power, tournamentPreview, runTournament, olympicMedal, retire, rand, randInt };
});
