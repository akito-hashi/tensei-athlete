// 転生アスリート — 画面（ルールは engine.js、数値は data.js）
(function () {
  "use strict";
  const D = window.GameData, E = window.Engine;
  const S = window.Sfx || { play() {}, setOn() {}, isOn: () => false };
  const KEY = "tensei-athlete-v1";
  const FAST = new URLSearchParams(location.search).has("fast");
  const app = document.getElementById("app");

  let game = load();
  // 保存しない画面の状態
  const ui = { view: "title", prev: null, gender: "m", grew: false, msg: null, popup: null, tour: null, sportPick: null, keep: undefined, timer: null };

  // ---- 保存 ----
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1 && s.game && s.game.life && s.game.inherit && s.game.medals) return s.game;
    } catch (e) { /* こわれたセーブは無視して新しく始められるようにする */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, game })); } catch (e) { /* 容量不足などは遊びを止めない */ }
  }

  // ---- 小物 ----
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (x) => Math.round(x * 100) + "%";
  const SPORT_ICON = { track: "🏃", judo: "🥋", gym: "🤸" };
  const PRACTICE_ICON = { t_dash: "💨", t_hill: "⛰️", t_jog: "👟", t_form: "📐", j_uchi: "🤼", j_kin: "🏋️", j_rand: "🔥", j_ashi: "🦶", g_tetsu: "🔩", g_yuka: "🌀", g_wa: "⭕", g_ime: "🧘" };
  const LESSON_ICON = { track: "🏃", judo: "🥋", gym: "🤸", play: "⚽" };
  const MOT_FACE = ["😫", "😟", "🙂", "😊", "🤩"];
  const SEASONS = ["春", "春", "初夏", "夏", "夏", "秋", "冬"];
  const GRADES = [[1200, "SS"], [900, "S"], [650, "A"], [450, "B"], [300, "C"], [200, "D"], [120, "E"], [60, "F"], [0, "G"]];
  const grade = (v) => GRADES.find(([t]) => v >= t)[1];
  const friend = (id) => D.FRIENDS.find((f) => f.id === id);
  const sportName = (s) => D.SPORT_INFO[s].name;
  const medalIcon = { gold: "🥇", silver: "🥈", bronze: "🥉" };
  const medalName = { gold: "金メダル", silver: "銀メダル", bronze: "銅メダル" };

  function schoolLabel(age) {
    if (age <= 14) return `中学${age - 11}年`;
    if (age <= 17) return `高校${age - 14}年`;
    if (age <= 21) return `大学${age - 17}年`;
    return `社会人 ${age}歳`;
  }
  function meIcon() {
    const L = game.life, f = game.gender === "f";
    if (!L || L.age < 3) return "👶";
    if (L.age < 12) return f ? "👧" : "👦";
    if (L.sport === "judo") return "🥋";
    if (L.sport === "gym") return f ? "🤸‍♀️" : "🤸‍♂️";
    return f ? "🏃‍♀️" : "🏃‍♂️";
  }
  function lifebar() {
    const a = game.life.age, f = game.gender === "f";
    const steps = [["👶", 0], [f ? "👧" : "👦", 3], ["🧑", 12], [f ? "👩" : "👨", 18], ["🏅", 99]];
    let now = 0;
    steps.forEach(([, from], i) => { if (a >= from) now = i; });
    return `<div class="lifebar" aria-hidden="true">${steps.map(([ic], i) => `<span class="${i < now ? "done" : i === now ? "now" : ""}">${ic}</span>`).join("")}</div>`;
  }
  function setTheme(t) { document.body.className = t; }

  // ---- どの画面か ----
  function view() {
    if (ui.view) return ui.view;
    if (ui.tour) return "tour";
    const L = game.life;
    if (L.phase === "child") return L.childTurn === 0 && !ui.grew ? "birth" : "child";
    if (L.phase === "choose") return "choose";
    if (L.phase === "train") return L.pendingEvent ? "event" : L.pendingTournament ? "tour" : "train";
    return L.phase; // retire / gold
  }

  function render() {
    const v = view();
    if (v !== "gold") document.querySelectorAll(".confetti").forEach((c) => c.remove());
    app.dataset.screen = v;
    app.innerHTML = SCREENS[v]();
    if (ui.popup) app.insertAdjacentHTML("beforeend", popupHtml(ui.popup));
    const focus = app.querySelector("#popup [data-act=ok]") || app.querySelector("[autofocus]");
    if (focus) focus.focus({ preventScroll: true });
  }

  // ---- 各画面 ----
  const SCREENS = {
    title() {
      setTheme("night");
      const cont = game ? `<button class="btn plain" data-act="continue">つづきから ・ ${game.lifeNo}回目の人生 ${game.life.age >= 12 ? schoolLabel(game.life.age) : game.life.age + "歳"}</button>` : "";
      return `<div class="light" style="left:-20px"></div><div class="light" style="right:-20px"></div>
        <div class="logo"><div class="small">めざせ 金メダル</div><h1 class="big hot" style="margin:6px 0 0;font-weight:400">転生<br>アスリート</h1><div class="medal" aria-hidden="true">🥇</div></div>
        <div class="babies grow"><span aria-hidden="true">👶🧒🧑🏃🏅</span><small>何度生まれ変わっても、あの表彰台へ</small></div>
        <button class="btn" data-act="new">はじめから</button>${cont}
        <div class="row between"><button class="link" data-act="sound" aria-label="効果音のオンオフ">${S.isOn() ? "🔊 音あり" : "🔇 音なし"}</button>${game ? `<button class="link" data-act="book">メダル図鑑</button>` : ""}</div>`;
    },

    name() {
      setTheme("day");
      return `<div class="headline"><div class="t">はじめから</div><h2>どんな子が生まれる？</h2></div>
        <div class="crib" aria-hidden="true">👶</div>
        <div class="field card"><label for="name">名前（10文字まで）</label><input id="name" maxlength="10" autocomplete="off" placeholder="なまえ" autofocus></div>
        <div class="field card"><label>どっちで出場する？</label><div class="seg">
          <button data-gender="m" aria-pressed="${ui.gender === "m"}">男子</button><button data-gender="f" aria-pressed="${ui.gender === "f"}">女子</button></div></div>
        <div class="grow"></div>
        <button class="btn blue" data-act="start">うまれる！</button>
        <button class="link" data-act="title">もどる</button>`;
    },

    birth() {
      setTheme("day");
      const L = game.life;
      const best = D.SPORTS.reduce((a, s) => (D.TALENT_RANKS.indexOf(L.talents[s]) < D.TALENT_RANKS.indexOf(L.talents[a]) ? s : a), D.SPORTS[0]);
      const b = game.inherit.bonus.spd;
      const inh = game.lifeNo > 1 ? `<div class="inh card">前世ボーナス：能力の伸び <b>+${Math.round(b * 100)}%</b>
        ${game.inherit.innateSkills.length ? `／ 生まれつき：<b>${game.inherit.innateSkills.map((id) => D.SKILLS[id].name).join("・")}</b>` : ""}</div>` : "";
      return `<div class="headline"><div class="t">${game.lifeNo}回目の人生</div><h2>おぎゃあ！ ${esc(game.name)} 誕生</h2></div>
        <div class="crib" aria-hidden="true">👶</div>
        <div class="gacha card"><div class="lbl">この人生でいちばんの才能</div><div class="rank hot">${L.talents[best]}</div><div class="what">${sportName(best)}の才能</div></div>
        <div class="three">${D.SPORTS.map((s) => `<div class="card">${D.SPORT_INFO[s].short}<b class="hot r-${L.talents[s]}">${L.talents[s]}</b></div>`).join("")}</div>
        ${inh}<div class="grow"></div>
        <button class="btn blue" data-act="grow" autofocus>すくすく育てる</button>`;
    },

    child() {
      setTheme("day");
      const L = game.life;
      const ages = ["3歳になるまで", "6歳になるまで", "9歳になるまで", "12歳になるまで"];
      return `<div class="headline"><div class="t">${game.lifeNo}回目の人生 ・ 子どものころ</div><h2>${ages[L.childTurn]}、なにをする？</h2></div>
        <div class="age"><div class="who" aria-hidden="true">${meIcon()}</div><div class="n num">${L.age}<small style="font-size:18px">歳</small></div></div>
        <div class="say card">${ui.msg ? esc(ui.msg) : "子どものころに触れたものが、あとで競技をえらぶヒントになる。"}</div>
        <div class="grow"></div>
        <div class="lessons">${Object.entries(D.CHILD_LESSONS).map(([id, l]) => `<button class="card" data-lesson="${id}"><span class="ic" aria-hidden="true">${LESSON_ICON[id]}</span>${l.label}<small>${Object.keys(l.gains).slice(0, 2).map((k) => D.STAT_LABELS[k]).join("・")}${id === "play" ? "など" : ""}</small></button>`).join("")}</div>`;
    },

    choose() {
      setTheme("day");
      const L = game.life;
      const rec = E.recommendSport(L);
      const pick = ui.sportPick || rec;
      const most = D.SPORTS.reduce((a, s) => (L.encounters[s] > L.encounters[a] ? s : a), D.SPORTS[0]);
      const memory = L.encounters[most] > 0 ? `子どものころ、いちばん通ったのは「${D.CHILD_LESSONS[most].label}」だった。` : "子どものころは、外で遊んでばかりだった。";
      const desc = { track: "記録をちぢめる", judo: "トーナメントを勝ち抜く", gym: "演技の点数を上げる" };
      return `<div class="q card">いよいよ中学生。<b>何の部活に入る？</b><br><span class="sub">${memory}</span></div>
        <div class="sports">${D.SPORTS.map((s) => `<button class="sp card" data-sport="${s}" aria-pressed="${s === pick}">
          ${s === rec ? '<span class="chip tag">おすすめ</span>' : ""}<div class="ic" aria-hidden="true">${SPORT_ICON[s]}</div>
          <div><b>${sportName(s)}</b><span>${desc[s]}${game.inherit.exp[s] ? ` ・ 前世の経験 Lv.${game.inherit.exp[s]}` : ""}</span></div>
          <div class="rank">才能<i class="r-${L.talents[s]}">${L.talents[s]}</i></div></button>`).join("")}</div>
        <div class="grow"></div>
        <button class="btn" data-act="join">${D.SPORT_INFO[pick].short}部に入る！</button>`;
    },

    train() {
      setTheme("day");
      const L = game.life;
      const pv = E.tournamentPreview(game);
      const left = D.TURNS_PER_YEAR - L.slot;
      const acts = E.actions(L);
      const here = new Set(acts.flatMap((a) => a.friends));
      const msg = ui.msg || (L.injured ? `ケガが治るまで、あと ${L.injured}ターン。休むか遊ぼう。` : L.stamina < 40 ? "体力が少ない…。無理すると失敗やケガをしやすい。" : "どの練習をする？ 仲間がいる練習は大成功しやすい！");
      const btn = (a) => {
        if (a.kind === "rest") return `<button class="m card" data-action="rest"><span class="ic" aria-hidden="true">🛌</span>休む<small>体力 回復</small></button>`;
        if (a.kind === "play") return `<button class="m card" data-action="play"><span class="ic" aria-hidden="true">🎮</span>遊ぶ<small>やる気 UP</small></button>`;
        const g = E.previewGain(game, a.id);
        return `<button class="m card" data-action="${a.id}" ${a.enabled ? "" : "disabled"}>
          ${a.friends.length ? `<span class="frs" aria-label="${a.friends.map((f) => friend(f).name).join("、")}がいる">${a.friends.map((f) => friend(f).emoji).join("")}</span>` : ""}
          ${a.enabled && a.risk >= 0.1 ? `<span class="risk">失敗${pct(a.risk)}</span>` : ""}
          <span class="ic" aria-hidden="true">${PRACTICE_ICON[a.id]}</span>${a.label}<small>${D.STAT_LABELS[g.stat]} +${g.main}</small></button>`;
      };
      return `<div class="row between">${lifebar()}<span class="chip card" style="color:var(--blue)">${schoolLabel(L.age)} ${SEASONS[L.slot]}</span></div>
        <div class="gauges"><div class="g card">体力 <span class="num">${L.stamina}</span><div class="bar"><i style="width:${L.stamina}%;background:${L.stamina < 30 ? "var(--red)" : "var(--green)"}"></i></div></div>
          <div class="g card">やる気 ${MOT_FACE[L.motivation - 1]} ${D.MOTIVATION_LABELS[L.motivation - 1]}<div class="bar"><i style="width:${L.motivation * 20}%;background:#ffb000"></i></div></div></div>
        <div class="stats">${D.STATS.map((k) => `<div class="s card ${ui.ups && ui.ups[k] ? "up" : ""}">${D.STAT_LABELS[k]}<b class="num">${L.stats[k]}</b><span class="gr">${grade(L.stats[k])}</span></div>`).join("")}</div>
        <div class="goal card"><span>次は${pv.stages[0].name}・あと${left}ターン</span><span class="pct">勝てる見込み ${pct(pv.stages[0].chance)}</span></div>
        <div class="scene ${L.sport}"><span class="me" aria-hidden="true">${meIcon()}</span>${[...here].map((f) => `<span class="fr" aria-hidden="true">${friend(f).emoji}</span>`).join("")}</div>
        <div class="say card grow">${msg}</div>
        <div class="menu">${acts.map(btn).join("")}</div>
        <div class="foot"><button class="link" data-act="title">タイトルへ</button>${L.age >= D.VOLUNTARY_RETIRE_AGE ? `<button class="link" data-act="retire">引退する</button>` : `<span class="sub">スキル ${L.skills.length}</span>`}</div>`;
    },

    event() {
      setTheme("day");
      const ev = D.EVENTS.find((e) => e.id === game.life.pendingEvent);
      return `<div class="row between">${lifebar()}<span class="chip card" style="color:var(--blue)">${schoolLabel(game.life.age)} ${SEASONS[Math.max(0, game.life.slot - 1)]}</span></div>
        <div class="grow"></div>
        <div class="big-emoji" aria-hidden="true">${meIcon()}❓</div>
        <div class="ev card"><span class="chip tag">できごと</span><p style="margin:8px 0 0">${ev.text}</p></div>
        <div class="grow"></div>
        <div class="choices">${ev.choices.map((c, i) => `<button class="btn ${i ? "blue" : ""}" data-choice="${i}">${c.label}</button>`).join("")}</div>`;
    },

    tour() {
      setTheme("night");
      if (ui.tour) return tourReplay();
      const pv = E.tournamentPreview(game);
      const L = game.life;
      const sk = L.skills.filter((id) => D.SKILLS[id].power && (!D.SKILLS[id].sport || D.SKILLS[id].sport === L.sport));
      return `<div class="spot"></div>
        <div class="tour-title"><div class="t1">${schoolLabel(L.age)} ・ ${L.age}歳</div><div class="t2 hot">今年の大会</div></div>
        <div class="sub center">勝ち進むほど上の大会へ。負けたらそこで今年は終わり。</div>
        ${pv.stages.map((s) => `<div class="stage glass ${s.id}"><div class="row between"><span>${s.id === "olympic" ? "🏟️ " : ""}${s.name}</span><span class="num">${pct(s.chance)}</span></div><div class="bar2"><i style="width:${pct(s.chance)}"></i></div></div>`).join("")}
        <div class="sub center">体力 ${L.stamina} ・ やる気 ${MOT_FACE[L.motivation - 1]}${sk.length ? ` ・ スキル ${sk.map((id) => D.SKILLS[id].name).join("・")}` : ""}<br>※体力とやる気が高いほど、本番で力が出る</div>
        <div class="grow"></div>
        <button class="btn" data-act="fight" autofocus>いざ、勝負！</button>`;
    },

    retire() { return retireScreen(false); },
    nextlife() { return retireScreen(true); },

    gold() {
      setTheme("night");
      const L = game.life;
      setTimeout(confetti, 0);
      if (!ui.goldPlayed) { ui.goldPlayed = true; setTimeout(() => S.play("gold"), 0); }
      return `<div class="spot"></div><div class="grow"></div>
        <div class="goldmedal" aria-hidden="true">🥇</div>
        <div class="goldtext hot">金メダル！！</div>
        <div class="result glass center">${game.lifeNo}回目の人生、${L.age - 1}歳の${sportName(L.sport)}で<br><b>${esc(game.name)}</b>は ついに世界の頂点に立った。<br>何度も生まれ変わった日々が、この一瞬のためにあった。</div>
        <div class="grow"></div>
        <button class="btn" data-act="book">メダル図鑑を見る</button>
        <button class="btn plain" data-act="nextlife">次の人生へ（ほかの競技にも挑戦）</button>`;
    },

    book() {
      setTheme("day");
      const b = E.medalBook(game);
      const lives = [...game.lives].reverse();
      return `<div class="headline"><div class="t">これまでの ${game.lifeNo}回の人生</div><h2>メダル図鑑</h2></div>
        <div class="three">${D.SPORTS.map((s) => {
          const x = b[s];
          return `<div class="md card ${x.best ? "" : "lock"}" data-book="${s}"><span class="ic" aria-hidden="true">${SPORT_ICON[s]}</span>${D.SPORT_INFO[s].short}
            <span class="ms num">🥇 ${x.gold}</span><span class="num" style="font-size:12px">🥈 ${x.silver} 🥉 ${x.bronze}</span><small>${x.best ? "最高：" + x.best : "まだ挑戦していない"}</small></div>`;
        }).join("")}</div>
        ${game.cleared ? `<div class="clearbox hot">🏆 金メダル達成！<small style="font-family:'Zen Maru Gothic'">すべての競技で金を集めてみよう</small></div>` : `<div class="clearbox"><b>目標：オリンピックで金メダル</b><small>22歳と26歳の年に、日本選手権で勝てば出場できる</small></div>`}
        <div class="lives card">${lives.length ? lives.map((l) => `<div>${l.lifeNo}回目：${sportName(l.sport)} ・ ${l.bestName || "初戦敗退"}${l.medal ? " " + medalIcon[l.medal] : ""}</div>`).join("") : '<div class="sub">まだ前世の記録はない</div>'}</div>
        <div class="grow"></div>
        <button class="btn blue" data-act="back">もどる</button>`;
    },
  };

  function retireScreen(fromGold) {
    setTheme("night");
    const L = game.life;
    const gain = D.INHERIT_BASE + (L.bestWon + 1) * D.INHERIT_PER_STAGE;
    const cand = L.skills.filter((id) => !game.inherit.innateSkills.includes(id));
    if (ui.keep === undefined || (ui.keep && !cand.includes(ui.keep))) ui.keep = cand.slice().sort((a, b) => (D.SKILLS[b].power || 0) - (D.SKILLS[a].power || 0))[0] || null;
    const medals = D.SPORTS.flatMap((s) => game.medals[s].filter((m) => m.lifeNo === game.lifeNo).map((m) => medalIcon[m.medal] + medalName[m.medal]));
    return `<div class="tour-title"><div class="t1">${fromGold ? "金メダルの人生" : `${game.lifeNo}回目の人生`}、おつかれさま</div><div class="t2 hot">転生のとき</div></div>
      <div class="result glass">${sportName(L.sport)}ひとすじ ${L.age - 12}年。<br>いちばん遠くまで勝ち進んだ大会：<b>${L.bestWon >= 0 ? D.STAGES[L.bestWon].name : "なし（でも全部が経験になった）"}</b>${medals.length ? `<br>メダル：<b>${medals.join("・")}</b>` : ""}</div>
      <div class="lbl-gold">次の人生に引きつぐもの</div>
      <div class="ih">能力の伸び <b>+${Math.round(gain * 100)}%</b></div>
      <div class="ih">${sportName(L.sport)}の経験 <b>Lv.${game.inherit.exp[L.sport] + 1}</b></div>
      ${cand.length ? `<div class="lbl-gold">生まれつき持っていくスキルを 1つ</div><div class="keeps">${cand.map((id) => `<button data-keep="${id}" aria-pressed="${ui.keep === id}">${D.SKILLS[id].name}</button>`).join("")}</div>` : `<div class="sub">覚えたスキルはなかった。次の人生では仲間と練習してみよう。</div>`}
      <div class="grow"></div>
      <div class="big-emoji" aria-hidden="true" style="font-size:54px;filter:drop-shadow(0 0 20px #9fd0ff)">👻✨</div>
      <button class="btn" data-act="reborn">生まれ変わる！</button>
      ${fromGold ? `<button class="link" data-act="back">もどる</button>` : `<button class="link" data-act="book">メダル図鑑</button>`}`;
  }

  // ---- 大会の実況（1行ずつ流す） ----
  function tourItems(res) {
    const items = [];
    for (const r of res.rounds) {
      r.lines.forEach((l, i) => items.push({ cls: i === 0 ? "st" : l.startsWith("スキル") ? "sk" : i === r.lines.length - 1 ? (r.win ? "win" : "lose") : "", text: l }));
    }
    if (res.medal && res.medal !== "gold") items.push({ cls: "win", text: `${medalIcon[res.medal]} ${medalName[res.medal]}！ 世界で${res.medal === "silver" ? "2" : "3"}番目！` });
    return items;
  }
  function tourReplay() {
    const t = ui.tour, items = tourItems(t.res);
    const done = t.shown >= items.length;
    const shown = items.slice(Math.max(0, t.shown - 9), t.shown);
    const last = t.res.rounds[t.res.rounds.length - 1];
    const summary = done ? (t.res.medal === "gold" ? "🥇 金メダル！！" : last.win ? `🏆 ${last.name} 優勝！` : `今年は ${last.name} まで`) : "";
    return `<div class="spot"></div>
      <div class="tour-title"><div class="t1">${t.res.age}歳の大会</div><div class="t2 hot">${done ? summary : "実況中"}</div></div>
      <div class="feed glass grow">${shown.map((x) => `<p class="${x.cls}">${esc(x.text)}</p>`).join("")}</div>
      ${done ? `<button class="btn" data-act="tour-done" autofocus>次へ</button>` : `<button class="btn plain" data-act="skip">結果まで飛ばす</button>`}`;
  }
  function tick() {
    clearTimeout(ui.timer);
    if (!ui.tour) return;
    const n = tourItems(ui.tour.res).length;
    if (ui.tour.shown >= n) return;
    ui.timer = setTimeout(() => {
      ui.tour.shown++;
      const it = tourItems(ui.tour.res)[ui.tour.shown - 1];
      if (it) S.play(it.cls === "win" ? "win" : it.cls === "lose" ? "lose" : it.cls === "sk" ? "skill" : "tap");
      render(); tick();
    }, 650);
  }

  // ---- ポップアップ ----
  function popupHtml(p) {
    const ok = `<button class="btn" data-act="ok">OK</button>`;
    if (p.kind === "injury") return `<div id="popup" class="calm"><div class="big-emoji" aria-hidden="true">🤕</div><div class="goldtext hot" style="color:#fff;font-size:28px">ケガをしてしまった…</div><div class="result glass center">${p.turns}ターンは練習できない。<br>休むか遊んで、治るのを待とう。</div>${ok}</div>`;
    const ups = p.gains ? Object.entries(p.gains).map(([k, v]) => `<div class="upl"><span>${D.STAT_LABELS[k]}</span><b class="num">+${v}</b></div>`).join("") : "";
    const sk = p.skill ? `<div class="skill"><div class="lbl">スキルを覚えた！</div><div class="nm hot">${D.SKILLS[p.skill].name}</div><div class="ds">${D.SKILLS[p.skill].desc}</div></div>` : "";
    const head = p.great ? `<div class="great hot">大成功！！</div>` : `<div class="great hot" style="font-size:30px">ひらめいた！</div>`;
    const by = p.by ? `<div class="say card">${p.by}</div>` : "";
    return `<div id="popup"><div class="burst"></div>${head}<div class="big-emoji" aria-hidden="true">${meIcon()}</div><div class="ups">${ups}</div>${sk}${by}${ok}</div>`;
  }

  function confetti() {
    if (FAST || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ffcf3a", "#ff3d6e", "#3fd3ff", "#8fffb0", "#fff"];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("i");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2.5 + Math.random() * 2.5 + "s";
      c.style.animationDelay = Math.random() * 1.2 + "s";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 6000);
    }
  }

  // ---- 結果を文章に ----
  function trainMessage(r) {
    const gs = (g) => Object.entries(g).map(([k, v]) => `${D.STAT_LABELS[k]} +${v}`).join("　");
    const p = D.PRACTICES[game.life.sport].find((x) => x.id === r.action);
    let m;
    if (r.kind === "rest") m = `ぐっすり休んだ。体力 +${r.heal}`;
    else if (r.kind === "play") m = "思いきり遊んだ！ やる気が上がった。";
    else if (r.kind === "fail") m = `${p.label}……うまくいかなかった。体力だけ減った。`;
    else if (r.kind === "injury") m = "いたた……。ケガをしてしまった。";
    else m = `${p.label}${r.kind === "great" ? "、大成功！" : "！"} ${gs(r.gains)}`;
    const talk = (r.friendsMet || []).filter((f) => f.talk).map((f) => `<div class="who">${friend(f.id).name}</div>${f.talk}`).join("");
    return esc(m) + (talk ? `<br>${talk}` : "");
  }

  // ---- 操作 ----
  function onAction(a) {
    const r = E.train(game, a);
    save();
    ui.msg = trainMessage(r);
    ui.ups = r.gains || null;
    S.play(r.skillGot ? "skill" : { great: "great", success: "good", fail: "fail", injury: "fail", rest: "rest", play: "good" }[r.kind]);
    if (r.kind === "injury") ui.popup = { kind: "injury", turns: game.life.injured };
    else if (r.kind === "great" || r.skillGot) {
      const by = (r.friendsMet || []).find((f) => f.skill);
      ui.popup = { kind: "great", great: r.kind === "great", gains: r.gains, skill: r.skillGot, by: by ? `${friend(by.id).name}が教えてくれた！` : null };
    }
  }

  app.addEventListener("click", (ev) => {
    const el = ev.target.closest("button");
    if (!el || el.disabled) return;
    const d = el.dataset;
    if (d.act !== "skip") clearTimeout(ui.timer);
    try {
      if (d.action) onAction(d.action);
      else if (d.lesson) { const r = E.childStep(game, d.lesson); save(); ui.msg = `${D.CHILD_LESSONS[d.lesson].label}：${r.text}（${Object.entries(r.gains).map(([k, v]) => `${D.STAT_LABELS[k]}+${v}`).join(" ")}）`; }
      else if (d.sport) ui.sportPick = d.sport;
      else if (d.gender) { ui.gender = d.gender; const n = document.getElementById("name"); ui.nameDraft = n ? n.value : ""; }
      else if (d.choice != null) { const r = E.resolveEvent(game, +d.choice); save(); ui.msg = esc(r.text); ui.ups = null; S.play(r.skillGot ? "skill" : "tap"); if (r.skillGot) ui.popup = { kind: "great", great: false, gains: null, skill: r.skillGot }; }
      else if (d.keep) ui.keep = d.keep;
      else act(d.act);
    } catch (e) {
      console.error(e);
    }
    render();
    if (ui.nameDraft != null) { const n = document.getElementById("name"); if (n) n.value = ui.nameDraft; ui.nameDraft = null; }
  });

  function act(a) {
    switch (a) {
      case "new":
        if (game && !confirm("今のセーブを消して、はじめから始めますか？（メダル図鑑も消えます）")) return;
        ui.view = "name"; return;
      case "continue": ui.view = null; ui.msg = null; return;
      case "title": ui.view = "title"; ui.popup = null; return;
      case "start": {
        const name = (document.getElementById("name").value || "").trim().slice(0, 10);
        game = E.newGame({ name, gender: ui.gender });
        E.startLife(game);
        save();
        Object.assign(ui, { view: null, grew: false, msg: null, sportPick: null, keep: undefined });
        return;
      }
      case "grow": ui.grew = true; ui.msg = null; return;
      case "join": E.chooseSport(game, ui.sportPick || E.recommendSport(game.life)); save(); ui.msg = null; ui.sportPick = null; return;
      case "ok": ui.popup = null; return;
      case "fight": {
        const res = E.runTournament(game);
        save();
        ui.tour = { res, shown: FAST ? Infinity : 1 };
        tick();
        return;
      }
      case "skip": {
        clearTimeout(ui.timer); ui.tour.shown = Infinity;
        const last = ui.tour.res.rounds[ui.tour.res.rounds.length - 1];
        S.play(last.win ? "win" : "lose");
        return;
      }
      case "sound": S.setOn(!S.isOn()); if (S.isOn()) S.play("good"); return;
      case "tour-done": ui.tour = null; ui.msg = null; ui.ups = null; return;
      case "retire":
        if (!confirm("引退して、次の人生に生まれ変わりますか？")) return;
        E.retire(game); save(); return;
      case "nextlife": ui.view = "nextlife"; return;
      case "reborn":
        E.reincarnate(game, { keepSkill: ui.keep || undefined });
        save();
        Object.assign(ui, { view: null, grew: false, msg: null, sportPick: null, keep: undefined, ups: null, goldPlayed: false });
        return;
      case "book": ui.prev = ui.view; ui.view = "book"; return;
      case "back": ui.view = ui.view === "book" ? ui.prev : null; ui.prev = null; return;
    }
  }

  render();
})();
