// ゲームバランスの目標：上手な人は 3〜5回目の人生で金メダル。でたらめではほぼ取れない。
const test = require("node:test");
const assert = require("node:assert/strict");
const { smartPolicy, randomPolicy, playUntilClear } = require("./bots.js");

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const smart = SEEDS.map((s) => playUntilClear(s, smartPolicy, 10));

test("上手なプレイ：クリアまでの人生の回数の中央値が 3〜5", () => {
  const n = smart.map((r) => (r.cleared ? r.lives.length : 11));
  const m = median(n);
  assert.ok(m >= 3 && m <= 5, `median ${m} / ${JSON.stringify(n)}`);
});

test("上手なプレイ：1回目の人生で金はめったに取れない（15%未満）", () => {
  const first = smart.filter((r) => r.cleared && r.lives.length === 1).length;
  assert.ok(first < SEEDS.length * 0.15, `${first}/${SEEDS.length}`);
});

test("上手なプレイ：7回以内にほぼ全員（90%以上）クリアできる", () => {
  const ok = smart.filter((r) => r.cleared && r.lives.length <= 7).length;
  assert.ok(ok >= SEEDS.length * 0.9, `${ok}/${SEEDS.length}`);
});

test("でたらめなプレイ：3回の人生で金を取れるのは 10% 未満", () => {
  const rnd = SEEDS.map((s) => playUntilClear(s, randomPolicy, 3));
  const ok = rnd.filter((r) => r.cleared).length;
  assert.ok(ok < SEEDS.length * 0.1, `${ok}/${SEEDS.length}`);
});

test("転生するほど、同じ年齢での実力が上がる", () => {
  let up = 0, n = 0;
  for (const r of smart) {
    for (let i = 1; i < r.lives.length; i++) {
      const a = r.lives[i - 1].powerAt[18], b = r.lives[i].powerAt[18];
      if (a == null || b == null) continue;
      n++; if (b > a) up++;
    }
  }
  assert.ok(n > 10 && up / n > 0.8, `${up}/${n}`);
});

test("1回の人生のターン数はおよそ 100（90〜115）", () => {
  for (const r of smart) for (const L of r.lives) if (L.phase === "retire") assert.ok(L.turns >= 90 && L.turns <= 115, `${L.turns}`);
});
