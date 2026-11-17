const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");
const D = require("../data.js");

function trainee(seed, sport = "track") {
  const g = E.newGame({ name: "x", gender: "m", seed });
  E.startLife(g);
  for (let i = 0; i < 4; i++) E.childStep(g, "play");
  E.chooseSport(g, sport);
  g.life.noEvents = true; // 偶然のイベントを止めて、練習の数字だけを見る
  return g;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

test("各競技に練習が 4つあり、休む・遊ぶと合わせて 6択", () => {
  for (const s of D.SPORTS) {
    const g = trainee(1, s);
    const ids = E.actions(g.life).map((a) => a.id);
    assert.equal(ids.length, 6);
    assert.ok(ids.includes("rest") && ids.includes("play"));
    assert.equal(D.PRACTICES[s].length, 4);
  }
});

test("練習すると主の能力が一番伸び、体力が 15〜25 減り、ターンが進む", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = trainee(seed);
    const p = D.PRACTICES.track[0];
    const before = clone(g.life.stats);
    const turn = g.life.turn;
    const r = E.train(g, p.id);
    if (r.kind === "fail") continue;
    const up = (k) => g.life.stats[k] - before[k];
    assert.ok(up(p.main) > 0 && up(p.main) >= up(p.sub), `seed ${seed}`);
    assert.ok(r.staminaCost >= 15 && r.staminaCost <= 25);
    assert.equal(g.life.stamina, 100 - r.staminaCost);
    assert.equal(g.life.turn, turn + 1);
  }
});

test("やる気が高いほど伸びが大きい", () => {
  const base = trainee(5);
  const hi = clone(base); hi.life.motivation = 5;
  const lo = clone(base); lo.life.motivation = 1;
  const id = D.PRACTICES.track[0].id;
  const rh = E.train(hi, id), rl = E.train(lo, id);
  assert.equal(rh.kind, rl.kind);
  assert.ok(rh.gains[D.PRACTICES.track[0].main] > rl.gains[D.PRACTICES.track[0].main]);
});

test("休むは失敗せず、体力が必ず回復する（上限 100）", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = trainee(seed);
    g.life.stamina = 30;
    const r = E.train(g, "rest");
    assert.equal(r.kind, "rest");
    assert.ok(g.life.stamina >= 60 && g.life.stamina <= 100);
    g.life.stamina = 95;
    E.train(g, "rest");
    assert.equal(g.life.stamina, 100);
  }
});

test("体力が少ないと失敗・ケガが増え、満タンならほぼ失敗しない", () => {
  let lowBad = 0, highBad = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const a = trainee(seed); a.life.stamina = 5;
    if (["fail", "injury"].includes(E.train(a, D.PRACTICES.track[1].id).kind)) lowBad++;
    const b = trainee(seed);
    if (["fail", "injury"].includes(E.train(b, D.PRACTICES.track[1].id).kind)) highBad++;
  }
  assert.ok(lowBad > 300 * 0.4, `low ${lowBad}`);
  assert.ok(highBad < 300 * 0.06, `high ${highBad}`);
});

test("ケガ中は練習できないが、休めば 3ターン以内に治る（行き止まりにならない）", () => {
  let injuredSeen = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const g = trainee(seed); g.life.stamina = 3;
    const r = E.train(g, D.PRACTICES.track[0].id);
    if (r.kind !== "injury") continue;
    injuredSeen++;
    assert.ok(g.life.injured >= 1 && g.life.injured <= 3);
    assert.deepEqual(E.actions(g.life).filter((a) => a.enabled).map((a) => a.id).sort(), ["play", "rest"]);
    assert.throws(() => E.train(g, D.PRACTICES.track[0].id));
    for (let i = 0; i < 3 && g.life.injured > 0; i++) E.train(g, "rest");
    assert.equal(g.life.injured, 0);
    assert.equal(E.actions(g.life).filter((a) => a.enabled).length, 6);
  }
  assert.ok(injuredSeen > 5);
});

test("大成功はときどき起き、伸びが 2倍になる", () => {
  let great = 0, n = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const g = trainee(seed);
    for (const f of Object.keys(g.life.board)) g.life.board[f] = []; // 仲間なし
    const plain = clone(g);
    const r = E.train(g, D.PRACTICES.track[0].id);
    n++;
    if (r.kind !== "great") continue;
    great++;
    assert.equal(r.mult, 2);
  }
  assert.ok(great > n * 0.05 && great < n * 0.2, `great ${great}/${n}`);
});

test("仲間がいる練習をすると仲よし度が上がり、80 でスキルを教えてくれる", () => {
  const g = trainee(11);
  const friend = D.FRIENDS[0].id;
  const pid = D.PRACTICES.track[0].id;
  let got = null;
  for (let i = 0; i < 40 && !got; i++) {
    g.life.stamina = 100; g.life.injured = 0;
    for (const p of D.PRACTICES.track) g.life.board[p.id] = [];
    g.life.board[pid] = [friend];
    const before = g.life.friends[friend] || 0;
    const r = E.train(g, pid);
    if (r.kind === "fail") continue;
    assert.ok((g.life.friends[friend] || 0) > before);
    if (r.skillGot) got = r.skillGot;
  }
  assert.ok(g.life.friends[friend] >= 80);
  assert.equal(got, D.FRIENDS[0].skill);
  assert.ok(g.life.skills.includes(D.FRIENDS[0].skill));
});

test("毎ターン、仲間がどの練習にいるかが決まる（UI で見せる）", () => {
  const g = trainee(2);
  const ids = D.PRACTICES.track.map((p) => p.id).sort();
  assert.deepEqual(Object.keys(g.life.board).sort(), ids);
  for (const fs of Object.values(g.life.board)) for (const f of fs) assert.ok(D.FRIENDS.some((x) => x.id === f));
});

test("イベントが起きると、えらぶまで練習できない。えらぶと効果が出て消える", () => {
  const g = trainee(3);
  g.life.noEvents = false;
  let seen = 0;
  for (let i = 0; i < 200 && seen < 5; i++) {
    if (g.life.pendingEvent) {
      seen++;
      assert.throws(() => E.train(g, "rest"));
      const ev = D.EVENTS.find((e) => e.id === g.life.pendingEvent);
      assert.ok(ev.choices.length >= 1);
      const r = E.resolveEvent(g, 0);
      assert.ok(typeof r.text === "string" && r.text.length > 0);
      assert.equal(g.life.pendingEvent, null);
    } else if (g.life.pendingTournament) {
      E.runTournament(g);
    } else {
      g.life.stamina = 100; g.life.injured = 0;
      E.train(g, "rest");
    }
  }
  assert.ok(seen >= 3, `events ${seen}`);
});

test("でたらめに遊んでも、体力 0〜100・やる気 1〜5・能力 0 以上を保つ", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = trainee(seed);
    g.life.noEvents = false;
    for (let i = 0; i < 60; i++) {
      if (g.life.pendingEvent) {
        const ev = D.EVENTS.find((e) => e.id === g.life.pendingEvent);
        E.resolveEvent(g, E.randInt(g, 0, ev.choices.length - 1));
        continue;
      }
      if (g.life.pendingTournament) { E.runTournament(g); continue; }
      if (g.life.phase !== "train") break;
      const opts = E.actions(g.life).filter((a) => a.enabled);
      E.train(g, opts[E.randInt(g, 0, opts.length - 1)].id);
      const L = g.life;
      assert.ok(L.stamina >= 0 && L.stamina <= 100, `stamina ${L.stamina}`);
      assert.ok(L.motivation >= 1 && L.motivation <= 5);
      for (const k of D.STATS) assert.ok(L.stats[k] >= 0);
    }
  }
});

test("練習ボタンに出す『伸びの目安』は、ふつうに成功したときの伸びと一致する", () => {
  let checked = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const g = trainee(seed);
    const p = D.PRACTICES.track[1];
    const est = E.previewGain(g, p.id);
    const r = E.train(g, p.id);
    if (r.kind !== "success") continue;
    checked++;
    const friends = r.friendsMet.length;
    assert.ok(r.gains[p.main] - friends >= est.main && r.gains[p.main] - friends <= est.main + 1, `seed ${seed}`);
    assert.equal(r.gains[p.sub], est.sub);
  }
  assert.ok(checked > 20);
});
