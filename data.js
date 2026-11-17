// 転生アスリート — ゲームの数値・文章データ（ルールは engine.js）
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATS = ["spd", "pow", "sta", "tec", "men"];
  const STAT_LABELS = { spd: "スピード", pow: "パワー", sta: "スタミナ", tec: "ワザ", men: "メンタル" };

  const SPORTS = ["track", "judo", "gym"];
  const SPORT_INFO = {
    track: { name: "陸上100m", short: "陸上", emoji: "🏃", weights: { spd: 0.45, pow: 0.25, sta: 0.1, tec: 0.1, men: 0.1 } },
    judo: { name: "柔道", short: "柔道", emoji: "🥋", weights: { spd: 0.1, pow: 0.35, sta: 0.2, tec: 0.2, men: 0.15 } },
    gym: { name: "体操", short: "体操", emoji: "🤸", weights: { spd: 0.1, pow: 0.15, sta: 0.1, tec: 0.45, men: 0.2 } },
  };

  // 才能ランク：出やすさ（合計100）と、能力の伸びにかかる倍率
  const TALENT_RANKS = ["S", "A", "B", "C", "D"];
  const TALENT_ODDS = { S: 7, A: 16, B: 34, C: 27, D: 16 };
  const TALENT_MULT = { S: 1.3, A: 1.15, B: 1.0, C: 0.9, D: 0.8 };

  // 子ども期の習い事（4回えらぶ。3歳→6歳→9歳→12歳）
  const CHILD_TURNS = 4;
  const CHILD_LESSONS = {
    track: { label: "かけっこ教室", gains: { spd: 4, sta: 2 }, text: "風になった気がした。" },
    judo: { label: "柔道教室", gains: { pow: 4, men: 2 }, text: "受け身だけは誰よりうまい。" },
    gym: { label: "体操教室", gains: { tec: 4, men: 2 }, text: "でんぐり返しで拍手をもらった。" },
    play: { label: "外で遊ぶ", gains: { spd: 1, pow: 1, sta: 2, tec: 1, men: 1 }, text: "泥だらけで帰ってきた。" },
  };

  return { STATS, STAT_LABELS, SPORTS, SPORT_INFO, TALENT_RANKS, TALENT_ODDS, TALENT_MULT, CHILD_TURNS, CHILD_LESSONS };
});
