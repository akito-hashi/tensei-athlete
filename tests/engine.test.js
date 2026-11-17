const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");

const STATS = ["spd", "pow", "sta", "tec", "men"];
const SPORTS = ["track", "judo", "gym"];

test("同じ乱数の種なら同じ才能、違う種なら別の才能になりうる", () => {
  const a = E.newGame({ name: "たろう", gender: "m", seed: 42 });
  const b = E.newGame({ name: "たろう", gender: "m", seed: 42 });
  E.startLife(a); E.startLife(b);
  assert.deepEqual(a.life.talents, b.life.talents);
  const seen = new Set();
  for (let s = 1; s <= 40; s++) { const g = E.newGame({ name: "x", gender: "m", seed: s }); E.startLife(g); seen.add(JSON.stringify(g.life.talents)); }
  assert.ok(seen.size > 10);
});

test("才能は 3競技それぞれ S〜D", () => {
  for (let s = 1; s <= 50; s++) {
    const g = E.newGame({ name: "x", gender: "f", seed: s });
    E.startLife(g);
    assert.deepEqual(Object.keys(g.life.talents).sort(), [...SPORTS].sort());
    for (const r of Object.values(g.life.talents)) assert.match(r, /^[SABCD]$/);
  }
});

test("生まれた直後は子ども期。習い事を 4回選ぶと 12歳で競技えらびになり、出会いが記録される", () => {
  const g = E.newGame({ name: "x", gender: "m", seed: 7 });
  E.startLife(g);
  assert.equal(g.lifeNo, 1);
  assert.equal(g.life.phase, "child");
  assert.equal(g.life.age, 0);
  E.childStep(g, "judo"); E.childStep(g, "judo"); E.childStep(g, "track"); E.childStep(g, "play");
  assert.equal(g.life.phase, "choose");
  assert.equal(g.life.age, 12);
  assert.deepEqual(g.life.encounters, { track: 1, judo: 2, gym: 0 });
  assert.ok(SPORTS.includes(E.recommendSport(g.life)));
});

test("競技を選ぶと育成が始まる（中学1年の最初のターン）", () => {
  const g = E.newGame({ name: "x", gender: "m", seed: 7 });
  E.startLife(g);
  for (let i = 0; i < 4; i++) E.childStep(g, "play");
  E.chooseSport(g, "gym");
  assert.equal(g.life.phase, "train");
  assert.equal(g.life.sport, "gym");
  assert.equal(g.life.age, 12);
  assert.equal(g.life.slot, 0);
  assert.equal(g.life.stamina, 100);
  assert.throws(() => E.chooseSport(g, "judo")); // 2回は選べない
});

test("前世ボーナスが初期の能力に効く", () => {
  const plain = E.newGame({ name: "x", gender: "m", seed: 3 });
  const boosted = E.newGame({ name: "x", gender: "m", seed: 3 });
  for (const k of STATS) boosted.inherit.bonus[k] = 0.5;
  E.startLife(plain); E.startLife(boosted);
  for (const k of STATS) assert.ok(boosted.life.stats[k] > plain.life.stats[k], k);
});

test("ゲームの状態を文字にして戻しても、続きが同じように進む（保存のため）", () => {
  const a = E.newGame({ name: "x", gender: "m", seed: 99 });
  E.startLife(a);
  E.childStep(a, "track");
  const b = JSON.parse(JSON.stringify(a));
  for (const g of [a, b]) { E.childStep(g, "gym"); E.childStep(g, "judo"); E.childStep(g, "track"); E.chooseSport(g, "track"); }
  assert.deepEqual(a, b);
});
