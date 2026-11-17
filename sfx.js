// 効果音（WebAudio で鳴らす。音のファイルは使わない）
(function () {
  "use strict";
  const KEY = "tensei-athlete-sound";
  let ctx = null;
  let on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch (e) { /* 保存できない環境でも鳴らせる */ }

  // [周波数Hz, 開始(秒), 長さ(秒), 波形]
  const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568, C4: 262, G4: 392, E4: 330, A3: 220 };
  const SOUNDS = {
    tap: [[N.A5, 0, 0.04, "square"]],
    good: [[N.E5, 0, 0.08, "triangle"], [N.A5, 0.07, 0.12, "triangle"]],
    great: [[N.C5, 0, 0.09, "square"], [N.E5, 0.08, 0.09, "square"], [N.G5, 0.16, 0.09, "square"], [N.C6, 0.24, 0.3, "square"]],
    skill: [[N.G5, 0, 0.08, "sine"], [N.C6, 0.08, 0.08, "sine"], [N.E6, 0.16, 0.08, "sine"], [N.G6, 0.24, 0.35, "sine"]],
    fail: [[N.E4, 0, 0.12, "sawtooth"], [N.C4, 0.12, 0.25, "sawtooth"]],
    rest: [[N.G4, 0, 0.15, "sine"], [N.C5, 0.15, 0.25, "sine"]],
    win: [[N.G5, 0, 0.1, "square"], [N.G5, 0.12, 0.1, "square"], [N.C6, 0.24, 0.4, "square"]],
    lose: [[N.E4, 0, 0.2, "triangle"], [N.A3, 0.2, 0.45, "triangle"]],
    gold: [[N.C5, 0, 0.15, "square"], [N.E5, 0.15, 0.15, "square"], [N.G5, 0.3, 0.15, "square"], [N.C6, 0.45, 0.25, "square"],
      [N.G5, 0.75, 0.12, "square"], [N.C6, 0.9, 0.7, "square"], [N.E6, 0.9, 0.7, "triangle"]],
  };

  function play(name) {
    if (!on || !SOUNDS[name]) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      if (ctx.state === "suspended") ctx.resume();
      const t0 = ctx.currentTime + 0.01;
      for (const [f, at, len, type] of SOUNDS[name]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + at); o.stop(t0 + at + len + 0.02);
      }
    } catch (e) { /* 音が出なくても遊びは止めない */ }
  }

  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* 無視 */ }
  }

  window.Sfx = { play, setOn, isOn: () => on };
})();
