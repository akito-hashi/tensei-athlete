const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");
const D = require("../data.js");

function trainee(seed, sport = "track") {
  const g = E.newGame({ name: "x", gender: "m", seed });
  E.startLife(g);
  for (let i = 0; i < 4; i++) E.childStep(g, "play");
  E.chooseSport(g, sport);
  g.life.noEvents = true;
  return g;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
function toTournament(g) {
  for (let i = 0; !g.life.pendingTournament; i++) {
    if (i > 20) throw new Error("大会が来ない");
    E.train(g, "rest");
  }
}
function setAll(g, v) { for (const k of D.STATS) g.life.stats[k] = v; }

test(`1年は ${D.TURNS_PER_YEAR}ターン。年の終わりに大会があり、終わるまで練習できない`, () => {
  const g = trainee(1);
  for (let i = 0; i < D.TURNS_PER_YEAR - 1; i++) { E.train(g, "rest"); assert.equal(g.life.pendingTournament, null); }
  E.train(g, "rest");
  assert.ok(g.life.pendingTournament);
  assert.throws(() => E.train(g, "rest"));
  E.runTournament(g);
  assert.equal(g.life.pendingTournament, null);
  assert.equal(g.life.age, 13);
  assert.equal(g.life.slot, 0);
});

test("年齢で大会の階段が変わり、オリンピックは 22歳と 26歳だけ", () => {
  const ids = (age) => E.stageChain(age).map((s) => s.id);
  assert.deepEqual(ids(12), ["chiku", "ken_j", "zenkoku_j"]);
  assert.deepEqual(ids(16), ["ken_h", "chiho", "inter"]);
  assert.deepEqual(ids(19), ["nihon_q", "nihon", "sekai"]);
  assert.deepEqual(ids(22), ["nihon_q", "nihon", "olympic"]);
  assert.deepEqual(ids(26), ["nihon_q", "nihon", "olympic"]);
  for (let a = 12; a <= 26; a++) if (![22, 26].includes(a)) assert.ok(!ids(a).includes("olympic"), `age ${a}`);
});

test("勝つ確率は事前に見られて、能力が高いほど上がる", () => {
  const g = trainee(2);
  toTournament(g);
  const lo = clone(g), hi = clone(g);
  setAll(lo, 20); setAll(hi, 60);
  const pl = E.tournamentPreview(lo), ph = E.tournamentPreview(hi);
  assert.equal(pl.stages.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.ok(pl.stages[i].chance > 0 && pl.stages[i].chance < 1);
    assert.ok(ph.stages[i].chance > pl.stages[i].chance);
  }
  assert.ok(pl.stages[0].chance > pl.stages[2].chance, "上の大会ほどむずかしい");
});

test("スキルを持っていると勝つ確率が上がる（その競技のスキルはさらに）", () => {
  const g = trainee(3);
  toTournament(g);
  setAll(g, 30);
  const base = E.tournamentPreview(g).stages[1].chance;
  const a = clone(g); a.life.skills.push("honban");
  const b = clone(g); b.life.skills.push("t_start");
  const c = clone(g); c.life.skills.push("j_seoi"); // 別の競技のスキルは効かない
  assert.ok(E.tournamentPreview(a).stages[1].chance > base);
  assert.ok(E.tournamentPreview(b).stages[1].chance > E.tournamentPreview(a).stages[1].chance);
  assert.equal(E.tournamentPreview(c).stages[1].chance, base);
});

test("実際の勝ち負けは、見せた確率どおりの割合になる（運は少しだけ）", () => {
  let wins = 0, p = null;
  const N = 800;
  for (let seed = 1; seed <= N; seed++) {
    const g = trainee(seed);
    toTournament(g);
    setAll(g, 30); g.life.stamina = 100; g.life.motivation = 3;
    const pre = E.tournamentPreview(g).stages[0].chance;
    if (p == null) p = pre; else assert.equal(pre, p);
    if (E.runTournament(g).rounds[0].win) wins++;
  }
  assert.ok(Math.abs(wins / N - p) < 0.06, `${wins / N} vs ${p}`);
});

test("体力が少ないと大会の確率が下がる（大会前は休むのが作戦になる）", () => {
  const g = trainee(4);
  toTournament(g); setAll(g, 30);
  const full = clone(g); full.life.stamina = 100;
  const tired = clone(g); tired.life.stamina = 10;
  assert.ok(E.tournamentPreview(full).stages[0].chance > E.tournamentPreview(tired).stages[0].chance);
});

test("負けたところで止まり、結果が歴史に残る。負けても次の年に進める", () => {
  const g = trainee(5);
  toTournament(g); setAll(g, 1);
  const r = E.runTournament(g);
  assert.equal(r.rounds.at(-1).win, false);
  for (const x of r.rounds.slice(0, -1)) assert.equal(x.win, true);
  assert.equal(g.life.history.length, 1);
  assert.equal(g.life.history[0].age, 12);
  assert.equal(g.life.phase, "train");
  E.train(g, D.PRACTICES.track[0].id);
});

test("競技ごとに結果の見せ方がちがう（タイム・試合・得点）と実況がある", () => {
  for (const [sport, key] of [["track", "time"], ["judo", "how"], ["gym", "score"]]) {
    const g = trainee(6, sport);
    toTournament(g); setAll(g, 40); g.life.skills.push("honban");
    const r = E.runTournament(g);
    for (const x of r.rounds) {
      assert.ok(x.display[key] != null, `${sport} ${key}`);
      assert.ok(x.lines.length >= 2 && x.lines.every((l) => typeof l === "string" && l.length));
    }
    assert.ok(r.rounds.some((x) => x.lines.some((l) => l.includes("本番に強い"))), "スキル発動の実況");
  }
});

test("22歳のオリンピックで勝つと金メダル → クリア", () => {
  const g = trainee(7, "judo");
  g.life.age = 22; g.life.year = 10;
  toTournament(g); setAll(g, 999);
  const r = E.runTournament(g);
  assert.equal(r.medal, "gold");
  assert.equal(g.life.phase, "gold");
  assert.equal(g.cleared, true);
  assert.deepEqual(g.medals.judo.map((m) => m.medal), ["gold"]);
  assert.equal(g.medals.judo[0].lifeNo, 1);
});

test("オリンピックで惜しく負けると銀・銅（クリアにはならない）", () => {
  assert.equal(E.olympicMedal(5), "gold");
  assert.equal(E.olympicMedal(-1), "silver");
  assert.equal(E.olympicMedal(-15), "bronze");
  assert.equal(E.olympicMedal(-60), null);
});

test("26歳の大会が終わると引退。高校卒業（18歳）からは自分で引退もできる", () => {
  const g = trainee(8);
  assert.throws(() => E.retire(g));
  g.life.age = 26; g.life.year = 14;
  toTournament(g); setAll(g, 1);
  E.runTournament(g);
  assert.equal(g.life.phase, "retire");
  const h = trainee(9);
  h.life.age = 18; h.life.year = 6;
  E.retire(h);
  assert.equal(h.life.phase, "retire");
});

test("1回の人生はおよそ 100ターン", () => {
  const g = trainee(10);
  let turns = 0;
  while (g.life.phase === "train") {
    if (turns > 300) throw new Error("人生が終わらない");
    if (g.life.pendingTournament) { setAll(g, 1); E.runTournament(g); continue; }
    E.train(g, "rest"); turns++;
  }
  assert.ok(turns >= 90 && turns <= 120, `turns ${turns}`);
});
