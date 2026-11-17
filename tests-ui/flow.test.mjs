// 画面の通しテスト（Mac の Chrome を iPhone SE 第2・3世代＝375×667 の大きさで動かす）
// 使い方: npm run test:ui
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = "file://" + path.join(ROOT, "index.html");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const E = require("../engine.js");
const KEY = "tensei-athlete-v1";

let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CHROME, headless: true }); });
after(async () => { await browser?.close(); });

async function open({ save = null, fast = true, dialogs = "accept" } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  // iPhone SE（第2・第3世代）と同じ 375×667
  await p.emulate({ viewport: { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  p.errors = [];
  p.dialogs = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("dialog", (d) => { p.dialogs.push(d.message()); dialogs === "accept" ? d.accept() : d.dismiss(); });
  await p.goto(APP);
  await p.evaluate((k, s) => { localStorage.clear(); if (s) localStorage.setItem(k, JSON.stringify(s)); }, KEY, save);
  await p.goto(APP + (fast ? "?fast=1" : ""));
  return p;
}
const screen = (p) => p.$eval("#app", (el) => el.dataset.screen);
const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const click = (p, sel) => p.$eval(sel, (el) => el.click());
const fits = (p) => p.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1);

async function newGameToTraining(p, name = "テスト") {
  await click(p, '[data-act="new"]');
  assert.equal(await screen(p), "name");
  await p.type("#name", name);
  await click(p, '[data-gender="f"]');
  await click(p, '[data-act="start"]');
  assert.equal(await screen(p), "birth");
  await click(p, '[data-act="grow"]');
  for (const l of ["track", "judo", "gym", "play"]) { assert.equal(await screen(p), "child"); await click(p, `[data-lesson="${l}"]`); }
  assert.equal(await screen(p), "choose");
  await click(p, '[data-sport="judo"]');
  await click(p, '[data-act="join"]');
  assert.equal(await screen(p), "train");
}

// 画面ごとに、ふつうのプレイヤーのように 1手すすめる
async function step(p) {
  if (await p.$("#popup")) return click(p, '#popup [data-act="ok"]');
  const s = await screen(p);
  if (s === "event") return click(p, '[data-choice="0"]');
  if (s === "tour") {
    if (await p.$('[data-act="fight"]')) return click(p, '[data-act="fight"]');
    if (await p.$('[data-act="skip"]')) return click(p, '[data-act="skip"]');
    return click(p, '[data-act="tour-done"]');
  }
  if (s === "train") {
    const st = await saved(p);
    const L = st.game.life;
    if (L.injured || L.stamina < 40) return click(p, '[data-action="rest"]');
    return click(p, "[data-action]:not([data-action=rest]):not([data-action=play])");
  }
  throw new Error("想定外の画面: " + s);
}

test("はじめから 1回の人生を最後まで遊び、転生して 2回目が始まる（全画面がスクロールなしで収まる）", async () => {
  const p = await open();
  const seen = new Set();
  const check = async () => { const s = await screen(p); if (!seen.has(s)) { seen.add(s); assert.ok(await fits(p), `${s} が画面からはみ出す`); } };
  assert.equal(await screen(p), "title");
  await check();
  await click(p, '[data-act="new"]'); await check();
  await p.type("#name", "テスト"); await click(p, '[data-gender="f"]'); await click(p, '[data-act="start"]'); await check();
  await click(p, '[data-act="grow"]');
  for (const l of ["track", "judo", "gym", "play"]) { await check(); await click(p, `[data-lesson="${l}"]`); }
  await check();
  await click(p, '[data-sport="judo"]'); await click(p, '[data-act="join"]');
  for (let i = 0; i < 600; i++) {
    await check();
    const s = await screen(p);
    if (s === "retire" || s === "gold") break;
    if (await p.$("#popup")) { assert.ok(await fits(p), "ポップアップがはみ出す"); }
    await step(p);
  }
  const s = await screen(p);
  assert.ok(s === "retire" || s === "gold", s);
  assert.ok(["title", "name", "birth", "child", "choose", "train", "tour"].every((x) => seen.has(x)), [...seen].join(","));
  if (s === "retire") {
    const keep = await p.$("[data-keep]");
    if (keep) await keep.click();
    await click(p, '[data-act="reborn"]');
    assert.equal(await screen(p), "birth");
    assert.match(await p.$eval("#app", (el) => el.textContent), /2回目の人生/);
    assert.equal((await saved(p)).game.lifeNo, 2);
  }
  assert.deepEqual(p.errors, []);
});

test("途中でページを閉じても、つづきから同じところに戻れる", async () => {
  const p = await open();
  await newGameToTraining(p);
  for (let i = 0; i < 5; i++) await step(p);
  while ((await screen(p)) !== "train" || (await p.$("#popup"))) await step(p);
  const before = await saved(p);
  await p.reload();
  assert.equal(await screen(p), "title");
  assert.match(await p.$eval('[data-act="continue"]', (el) => el.textContent), /つづきから/);
  await click(p, '[data-act="continue"]');
  assert.equal(await screen(p), "train");
  assert.deepEqual(await saved(p), before);
  const shown = await p.$eval("#app", (el) => el.textContent);
  assert.ok(shown.includes(String(before.game.life.stats.pow)), "保存した能力が表示される");
  assert.deepEqual(p.errors, []);
});

test("オリンピックで金メダル → クリア画面 → メダル図鑑に金がのる", async () => {
  const g = E.newGame({ name: "きん", gender: "m", seed: 5 });
  E.startLife(g);
  for (let i = 0; i < 4; i++) E.childStep(g, "play");
  E.chooseSport(g, "gym");
  g.life.noEvents = true;
  g.life.age = 22; g.life.year = 10;
  while (!g.life.pendingTournament) E.train(g, "rest");
  delete g.life.noEvents;
  for (const k of Object.keys(g.life.stats)) g.life.stats[k] = 5000;
  const p = await open({ save: { v: 1, game: g } });
  await click(p, '[data-act="continue"]');
  assert.equal(await screen(p), "tour");
  assert.match(await p.$eval("#app", (el) => el.textContent), /オリンピック/);
  await click(p, '[data-act="fight"]');
  if (await p.$('[data-act="skip"]')) await click(p, '[data-act="skip"]');
  await click(p, '[data-act="tour-done"]');
  assert.equal(await screen(p), "gold");
  assert.ok(await fits(p));
  await click(p, '[data-act="book"]');
  assert.equal(await screen(p), "book");
  assert.match(await p.$eval('[data-book="gym"]', (el) => el.textContent), /🥇\s*1/);
  assert.ok(await fits(p));
  assert.deepEqual(p.errors, []);
});

test("名前に記号やタグを入れても、そのまま文字として表示される", async () => {
  const p = await open();
  await newGameToTraining(p, '<img src=x onerror="window.__x=1">');
  assert.equal(await p.evaluate(() => window.__x), undefined);
  assert.equal(await p.$("img[src=x]"), null);
  const st = await saved(p);
  assert.equal(st.game.name, '<img src=x onerror="window.__x=1">'.slice(0, 10));
});

test("セーブがあるときの「はじめから」は確認してから。やめればセーブは残る", async () => {
  const g = E.newGame({ name: "のこす", gender: "m", seed: 1 });
  E.startLife(g);
  const p = await open({ save: { v: 1, game: g }, dialogs: "dismiss" });
  await click(p, '[data-act="new"]');
  assert.equal(p.dialogs.length, 1);
  assert.equal(await screen(p), "title");
  assert.equal((await saved(p)).game.name, "のこす");
});

test("こわれたセーブがあっても、タイトルから新しく始められる", async () => {
  const p = await open();
  await p.evaluate((k) => localStorage.setItem(k, "{こわれた"), KEY);
  await p.reload();
  assert.equal(await screen(p), "title");
  assert.equal(await p.$('[data-act="continue"]'), null);
  await newGameToTraining(p);
  assert.deepEqual(p.errors, []);
});
