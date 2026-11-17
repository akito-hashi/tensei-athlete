// ゲームバランスの目標：ふつうの子ども（★の練習を中心に遊ぶ）で 3〜5回目の人生に金。
// 上手な人はもう少し早い。でたらめではほぼ取れない。競技によって難しさが大きく違わない。
const test = require("node:test");
const assert = require("node:assert/strict");
const { smartPolicy, casualPolicy, randomPolicy, playUntilClear } = require("./bots.js");

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const livesToClear = (rs) => rs.map((r) => (r.cleared ? r.lives.length : 99));

const smart = SEEDS.map((s) => playUntilClear(s, smartPolicy, 10));
const casual = SEEDS.map((s) => playUntilClear(s, casualPolicy, 10));

test("ふつうのプレイ：クリアまでの人生の回数の中央値が 3〜5", () => {
  const n = livesToClear(casual);
  assert.ok(median(n) >= 3 && median(n) <= 5, `median ${median(n)} / ${n}`);
});

test("ふつうのプレイ：6回以内にほぼ全員（85%以上）クリアできる", () => {
  const ok = livesToClear(casual).filter((x) => x <= 6).length;
  assert.ok(ok >= SEEDS.length * 0.85, `${ok}/${SEEDS.length}`);
});

test("上手なプレイ：中央値 2〜4。1回目の人生で金はめったに取れない（15%未満）", () => {
  const n = livesToClear(smart);
  assert.ok(median(n) >= 2 && median(n) <= 4, `median ${median(n)} / ${n}`);
  assert.ok(n.filter((x) => x === 1).length < SEEDS.length * 0.15);
});

test("どの競技を選んでも、難しさの差は人生 1回分まで", () => {
  const meds = ["track", "judo", "gym"].map((sp) => median(livesToClear(SEEDS.map((s) => playUntilClear(s, (g) => casualPolicy(g, sp), 10)))));
  assert.ok(Math.max(...meds) - Math.min(...meds) <= 1, JSON.stringify(meds));
});

test("でたらめなプレイ：3回の人生で金を取れるのは 10% 未満", () => {
  const ok = SEEDS.map((s) => playUntilClear(s, randomPolicy, 3)).filter((r) => r.cleared).length;
  assert.ok(ok < SEEDS.length * 0.1, `${ok}/${SEEDS.length}`);
});

test("転生するほど、同じ年齢での実力が上がる", () => {
  let up = 0, n = 0;
  for (const r of [...smart, ...casual]) {
    for (let i = 1; i < r.lives.length; i++) {
      const a = r.lives[i - 1].powerAt[18], b = r.lives[i].powerAt[18];
      if (a == null || b == null || r.lives[i].sport !== r.lives[i - 1].sport) continue;
      n++; if (b > a) up++;
    }
  }
  assert.ok(n > 10 && up / n > 0.8, `${up}/${n}`);
});

test("1回の人生のターン数はおよそ 100（90〜115）", () => {
  for (const r of [...smart, ...casual]) for (const L of r.lives) if (L.phase === "retire") assert.ok(L.turns >= 90 && L.turns <= 115, `${L.turns}`);
});
