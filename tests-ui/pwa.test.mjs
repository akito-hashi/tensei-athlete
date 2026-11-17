// ホーム画面に追加・オフライン・演出（動きを減らす設定・音のオンオフ）の確認
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const E = require("../engine.js");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };

let browser, server, BASE;
before(async () => {
  server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const f = path.join(ROOT, u.endsWith("/") ? u + "index.html" : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  BASE = `http://127.0.0.1:${server.address().port}/`;
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await browser?.close(); server?.close(); });

async function page() {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  return p;
}

test("マニフェストとアイコンがそろっていて、ホーム画面に追加できる", async () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(m.name, "転生アスリート");
  assert.equal(m.display, "standalone");
  for (const ic of m.icons) {
    const buf = fs.readFileSync(path.join(ROOT, ic.src));
    assert.equal(buf.subarray(1, 4).toString(), "PNG");
    const [w] = ic.sizes.split("x").map(Number);
    assert.equal(buf.readUInt32BE(16), w);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "icons/icon-180.png")));
  const p = await page();
  await p.goto(BASE);
  assert.equal(await p.$eval('link[rel="manifest"]', (l) => l.getAttribute("href")), "manifest.webmanifest");
  assert.equal(await p.$eval('link[rel="apple-touch-icon"]', (l) => l.getAttribute("href")), "icons/icon-180.png");
});

test("一度開けば、電波がなくても開いて遊べる", async () => {
  const p = await page();
  await p.goto(BASE);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForFunction(() => navigator.serviceWorker.controller);
  await p.setOfflineMode(true);
  await p.reload();
  assert.equal(await p.$eval("#app", (el) => el.dataset.screen), "title");
  await p.$eval('[data-act="new"]', (e) => e.click());
  await p.$eval('[data-act="start"]', (e) => e.click());
  assert.equal(await p.$eval("#app", (el) => el.dataset.screen), "birth");
  assert.deepEqual(p.errors, []);
});

test("サービスワーカーが保存するファイルは、すべて実在する", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const files = [...sw.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(files.length >= 6);
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  for (const f of ["index.html", "style.css", "data.js", "engine.js", "app.js", "sfx.js"]) assert.ok(files.includes(f), `${f} が sw.js にない`);
});

function goldSave() {
  const g = E.newGame({ name: "きん", gender: "f", seed: 5 });
  E.startLife(g);
  for (let i = 0; i < 4; i++) E.childStep(g, "play");
  E.chooseSport(g, "track");
  g.life.phase = "gold"; g.life.age = 23; g.cleared = true;
  g.medals.track.push({ lifeNo: 1, age: 22, medal: "gold" });
  return { v: 1, game: g };
}

test("「動きを減らす」設定のときは、紙ふぶきや動きが出ない", async () => {
  const p = await page();
  await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await p.goto(BASE);
  await p.evaluate((s) => localStorage.setItem("tensei-athlete-v1", JSON.stringify(s)), goldSave());
  await p.reload();
  await p.$eval('[data-act="continue"]', (e) => e.click());
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await p.$eval("#app", (el) => el.dataset.screen), "gold");
  assert.equal(await p.$$eval(".confetti", (c) => c.length), 0);
  assert.equal(await p.$eval(".goldmedal", (e) => getComputedStyle(e).animationName), "none");
});

test("ふつうの設定では金メダルで紙ふぶきが舞う", async () => {
  const p = await page();
  await p.goto(BASE);
  await p.evaluate((s) => localStorage.setItem("tensei-athlete-v1", JSON.stringify(s)), goldSave());
  await p.reload();
  await p.$eval('[data-act="continue"]', (e) => e.click());
  await new Promise((r) => setTimeout(r, 300));
  assert.ok((await p.$$eval(".confetti", (c) => c.length)) > 10);
});

test("音はタイトルで消せて、その設定が残る。音ありで遊んでもエラーが出ない", async () => {
  const p = await page();
  await p.goto(BASE);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  assert.match(await p.$eval('[data-act="sound"]', (e) => e.textContent), /🔊/);
  // 音ありのまま、大会の実況まで遊ぶ
  await p.$eval('[data-act="new"]', (e) => e.click());
  await p.$eval('[data-act="start"]', (e) => e.click());
  await p.$eval('[data-act="grow"]', (e) => e.click());
  for (let i = 0; i < 4; i++) await p.$eval('[data-lesson="track"]', (e) => e.click());
  await p.$eval('[data-act="join"]', (e) => e.click());
  for (let i = 0; i < 30 && (await p.$eval("#app", (el) => el.dataset.screen)) !== "tour"; i++) {
    if (await p.$("#popup")) await p.$eval('#popup [data-act="ok"]', (e) => e.click());
    else if (await p.$("[data-choice]")) await p.$eval('[data-choice="0"]', (e) => e.click());
    else await p.$eval('[data-action="t_dash"]', (e) => e.click());
  }
  await p.$eval('[data-act="fight"]', (e) => e.click());
  await new Promise((r) => setTimeout(r, 1500));
  await p.$eval('[data-act="skip"], [data-act="tour-done"]', (e) => e.click());
  assert.deepEqual(p.errors, []);
  await p.$eval('[data-act="title"]', (e) => e.click()).catch(() => {});
  await p.goto(BASE);
  await p.$eval('[data-act="sound"]', (e) => e.click());
  assert.match(await p.$eval('[data-act="sound"]', (e) => e.textContent), /🔇/);
  assert.equal(await p.evaluate(() => localStorage.getItem("tensei-athlete-sound")), "off");
  await p.reload();
  assert.match(await p.$eval('[data-act="sound"]', (e) => e.textContent), /🔇/);
});
