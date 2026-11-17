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

  // 練習：主に伸びる能力(main)と、少し伸びる能力(sub)
  const PRACTICES = {
    track: [
      { id: "t_dash", label: "スタートダッシュ", main: "spd", sub: "tec" },
      { id: "t_hill", label: "坂道ダッシュ", main: "pow", sub: "spd" },
      { id: "t_jog", label: "長めのジョグ", main: "sta", sub: "men" },
      { id: "t_form", label: "フォーム練習", main: "tec", sub: "spd" },
    ],
    judo: [
      { id: "j_uchi", label: "打ち込み", main: "tec", sub: "pow" },
      { id: "j_kin", label: "筋トレ", main: "pow", sub: "sta" },
      { id: "j_rand", label: "乱取り", main: "sta", sub: "men" },
      { id: "j_ashi", label: "足さばき", main: "spd", sub: "tec" },
    ],
    gym: [
      { id: "g_tetsu", label: "鉄棒", main: "tec", sub: "pow" },
      { id: "g_yuka", label: "ゆか", main: "spd", sub: "tec" },
      { id: "g_wa", label: "つり輪", main: "pow", sub: "sta" },
      { id: "g_ime", label: "イメトレ", main: "men", sub: "tec" },
    ],
  };
  const PRACTICE_GAIN = { main: 8, sub: 4 };
  const MOTIVATION_MULT = [0.8, 0.9, 1.0, 1.1, 1.2]; // やる気 1〜5
  const MOTIVATION_LABELS = ["ぜっ不調", "不調", "ふつう", "好調", "絶好調"];

  // 仲間（オリジナル）。練習にいると大成功しやすく、仲よし度 80 でスキルを教えてくれる
  const FRIENDS = [
    { id: "hayate", name: "ハヤテ", emoji: "😎", desc: "クールなライバル。負けずぎらい。", skill: "lastspurt" },
    { id: "momo", name: "モモ", emoji: "😊", desc: "いつも全力で応援してくれる。", skill: "ninin" },
    { id: "gou", name: "ゴウ", emoji: "💪", desc: "でかい。やさしい。よく食べる。", skill: "konjo" },
  ];
  const FRIEND_TALK = {
    hayate: "「…今日のお前、ちょっとだけ速かったな」",
    momo: "「いっしょにがんばろうね！」",
    gou: "「おにぎり、半分やるよ」",
  };

  // スキル。train: 練習への効果 / power: 大会での上乗せ（sport があればその競技だけ）
  const SKILLS = {
    honban: { name: "本番に強い", desc: "大会で実力以上が出る", power: 6 },
    lastspurt: { name: "ラストスパート", desc: "最後のひと押しで大会に強い", power: 5 },
    ninin: { name: "二人三脚", desc: "仲間との練習が大成功しやすい", train: { friendGreatPlus: 0.1 }, power: 2 },
    konjo: { name: "根性", desc: "体力が少なくても失敗しにくい", train: { failMult: 0.5 }, power: 2 },
    shuchu: { name: "集中力", desc: "大成功しやすい", train: { greatPlus: 0.05 }, power: 2 },
    tetsujin: { name: "鉄人", desc: "練習で体力が減りにくい", train: { costMult: 0.8 } },
    t_start: { name: "スタートの鬼", desc: "陸上の大会でとても強い", power: 8, sport: "track" },
    j_seoi: { name: "一本背負い", desc: "柔道の大会でとても強い", power: 8, sport: "judo" },
    g_pita: { name: "着地ピタリ", desc: "体操の大会でとても強い", power: 8, sport: "gym" },
  };
  const GREAT_SKILL_POOL = ["honban", "shuchu", "tetsujin", "t_start", "j_seoi", "g_pita"];

  // ゆるい日常イベント（えらぶと効果）
  const EVENTS = [
    { id: "banana", text: "コーチが差し入れにバナナを 100本持ってきた。", choices: [
      { label: "全部食べる", text: "おなかいっぱい。体力がもりもり回復！", stamina: 30, motivation: -1 },
      { label: "みんなに配る", text: "みんな笑顔。仲間との仲が深まった！", allFriends: 5, motivation: 1 } ] },
    { id: "hato", text: "練習中、ハトにずっと見つめられている気がする。", choices: [
      { label: "見つめ返す", text: "ハトが先に目をそらした。メンタルが上がった！", stats: { men: 4 } },
      { label: "気にせず走る", text: "ハトを置き去りにした。スピードが上がった！", stats: { spd: 3 } } ] },
    { id: "tv", text: "テレビの取材が来た！（地元のケーブルテレビ）", choices: [
      { label: "かっこよく答える", text: "放送は 3秒だった。でもやる気が上がった！", motivation: 1, stats: { men: 2 } },
      { label: "緊張でかむ", text: "かみまくった。もう何も怖くない。", stats: { men: 5 } } ] },
    { id: "rain", text: "大雨で外の練習が中止になった。", choices: [
      { label: "部屋で筋トレ", text: "床がきしんだ。パワーが上がった！", stats: { pow: 4 }, stamina: -10 },
      { label: "昼寝する", text: "よく寝た。体力が回復した！", stamina: 30 } ] },
    { id: "ojii", text: "謎のおじいさんが「若いの、背中で語れ」と言って去っていった。", choices: [
      { label: "背中をきたえる", text: "背中が少し語りはじめた。", stats: { pow: 3, tec: 2 } },
      { label: "意味を考える", text: "三日考えた。わからない。でも心が強くなった。", stats: { men: 5 } } ] },
    { id: "himo", text: "くつひもを結び直していたら、新しい動きをひらめいた！", choices: [
      { label: "集中して試す", text: "できた！ スキル「集中力」を覚えた！", skill: "shuchu" },
      { label: "メモだけする", text: "メモが読めない字だった。ワザが少し上がった。", stats: { tec: 2 } } ] },
    { id: "inu", text: "近所の犬が競走したそうにこっちを見ている。", choices: [
      { label: "本気で走る", text: "ギリギリ勝った。スピードが上がった！", stats: { spd: 5 }, stamina: -10 },
      { label: "勝ちをゆずる", text: "犬はとても満足そうだ。こっちもうれしい。", motivation: 1 } ] },
    { id: "omamori", text: "モモが手作りのお守りをくれた。", choices: [
      { label: "大切にする", text: "なんだか力がわいてくる。", friends: { momo: 10 }, stats: { men: 3 } } ] },
    { id: "yashoku", text: "夜中にどうしてもおなかがすいた。", choices: [
      { label: "がまんする", text: "がまんできた。メンタルが上がった！", stats: { men: 3 } },
      { label: "食べる", text: "カップめんは正義。", stamina: 15, motivation: 1 } ] },
    { id: "gou_bento", text: "ゴウが特大のお弁当を分けてくれた。", choices: [
      { label: "ありがたく食べる", text: "量がすごい。体力とパワーが上がった！", friends: { gou: 10 }, stamina: 20, stats: { pow: 2 } },
      { label: "半分だけ", text: "それでも多い。", friends: { gou: 5 }, stamina: 10 } ] },
  ];
  const EVENT_CHANCE = 0.15;

  return { PRACTICES, PRACTICE_GAIN, MOTIVATION_MULT, MOTIVATION_LABELS, FRIENDS, FRIEND_TALK, SKILLS, GREAT_SKILL_POOL, EVENTS, EVENT_CHANCE,
    STATS, STAT_LABELS, SPORTS, SPORT_INFO, TALENT_RANKS, TALENT_ODDS, TALENT_MULT, CHILD_TURNS, CHILD_LESSONS };
});
