const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");
const D = require("../data.js");

function retiredAt(seed, { sport = "track", bestWon = 4, skills = [] } = {}) {
  const g = E.newGame({ name: "x", gender: "m", seed });
  E.startLife(g);
  for (let i = 0; i < 4; i++) E.childStep(g, "play");
  E.chooseSport(g, sport);
  g.life.bestWon = bestWon;
  g.life.skills.push(...skills);
  g.life.age = 18;
  E.retire(g);
  return g;
}

test("引退前は転生できない", () => {
  const g = E.newGame({ name: "x", gender: "m", seed: 1 });
  E.startLife(g);
  assert.throws(() => E.reincarnate(g));
});

test("転生すると前世ボーナスが増え、遠くまで勝ち進んだほど多い", () => {
  const near = retiredAt(1, { bestWon: 0 });
  const far = retiredAt(1, { bestWon: 7 });
  const rn = E.reincarnate(near), rf = E.reincarnate(far);
  for (const k of D.STATS) {
    assert.ok(near.inherit.bonus[k] > 0);
    assert.ok(far.inherit.bonus[k] > near.inherit.bonus[k]);
  }
  assert.ok(rf.bonusGain > rn.bonusGain);
});

test("同じ競技の経験が 1 増え、新しい人生が始まる", () => {
  const g = retiredAt(2, { sport: "judo" });
  E.reincarnate(g);
  assert.equal(g.inherit.exp.judo, 1);
  assert.equal(g.inherit.exp.track, 0);
  assert.equal(g.lifeNo, 2);
  assert.equal(g.life.phase, "child");
  assert.equal(g.life.age, 0);
});

test("スキルを 1つ「生まれつき」として次の人生に持っていける", () => {
  const g = retiredAt(3, { skills: ["honban", "konjo"] });
  E.reincarnate(g, { keepSkill: "konjo" });
  assert.deepEqual(g.inherit.innateSkills, ["konjo"]);
  for (let i = 0; i < 4; i++) E.childStep(g, "play");
  E.chooseSport(g, "gym");
  assert.ok(g.life.skills.includes("konjo"));
  // 持っていないスキルは選べない
  const h = retiredAt(4, { skills: ["honban"] });
  assert.throws(() => E.reincarnate(h, { keepSkill: "konjo" }));
});

test("前の人生の記録が残る（メダル図鑑用）", () => {
  const g = retiredAt(5, { sport: "gym", bestWon: 5 });
  E.reincarnate(g);
  assert.equal(g.lives.length, 1);
  const L = g.lives[0];
  assert.equal(L.lifeNo, 1);
  assert.equal(L.sport, "gym");
  assert.equal(L.bestWon, 5);
  const book = E.medalBook(g);
  assert.equal(book.gym.best, D.STAGES[5].name);
  assert.equal(book.track.best, null);
  assert.equal(book.gym.gold, 0);
});

test("金メダルのあとも転生して、ほかの競技のメダルを集められる", () => {
  const g = retiredAt(6, { sport: "judo", bestWon: 9 });
  g.life.phase = "gold"; g.cleared = true; g.medals.judo.push({ lifeNo: 1, age: 22, medal: "gold" });
  E.reincarnate(g);
  assert.equal(g.cleared, true);
  assert.equal(E.medalBook(g).judo.gold, 1);
  assert.equal(g.life.phase, "child");
});

test("保存した状態からでも転生後の続きが同じになる", () => {
  const a = retiredAt(7, { skills: ["honban"] });
  const b = JSON.parse(JSON.stringify(a));
  for (const g of [a, b]) { E.reincarnate(g, { keepSkill: "honban" }); E.childStep(g, "track"); }
  assert.deepEqual(a, b);
});
