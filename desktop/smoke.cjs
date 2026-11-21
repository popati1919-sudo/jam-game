const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { createServer } = require("node:net");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { chromium } = require("playwright-core");

const executable = path.join(__dirname, "dist", "Rooftops-in-Bloom-Windows-x64.exe");

async function launchAndCheck(check) {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const endpoint = "http://127.0.0.1:" + port;
  const launcher = spawn(executable, ["--remote-debugging-port=" + port], { stdio: "inherit" });
  const exited = once(launcher, "exit");
  let browser;
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (launcher.exitCode !== null) throw Error("Portable launcher exited before the game opened: " + launcher.exitCode);
      try {
        const response = await fetch(endpoint + "/json/list");
        const targets = await response.json();
        if (targets.some(target => target.url === "bloom://game/index.html")) break;
      } catch { /* The portable runtime is still unpacking. */ }
      await delay(500);
    }
    browser = await chromium.connectOverCDP(endpoint, { timeout: 15000 });
    const context = browser.contexts()[0];
    const page = context.pages().find(page => page.url() === "bloom://game/index.html");
    assert.ok(page, "The packaged game must open its local page");
    await page.locator("#board").waitFor();
    assert.match(await page.title(), /Rooftops in Bloom/i);
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.locator("#level-title").textContent(), "Lilac Square");
    assert.equal(await page.locator(".desktop-download").isVisible(), false);
    await page.evaluate(() => document.fonts.ready.then(() => true));
    assert.ok(await page.evaluate(() => document.fonts.check('16px "Young Serif"')));
    assert.ok(await page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)));
    await context.setOffline(true);
    await check(page);
    console.log("Verified offline play in the portable Windows executable.");
  } finally {
    if (browser) {
      const session = await browser.newBrowserCDPSession();
      await session.send("Browser.close").catch(() => {});
    }
    const timeout = Date.now() + 15000;
    while (launcher.exitCode === null && Date.now() < timeout) await delay(150);
    if (launcher.exitCode === null) {
      spawn("taskkill", ["/PID", String(launcher.pid), "/T", "/F"], { stdio: "inherit" });
      throw Error("The portable launcher failed to exit cleanly");
    }
    const [code] = await exited;
    assert.equal(code, 0);
  }
}

async function smoke() {
  await launchAndCheck(async page => {
    assert.equal(await page.locator("#water-count").textContent(), "0");
    await page.locator("#board").press("a");
    await page.locator("#plant").click();
    assert.equal(await page.locator("#water-count").textContent(), "2");
    assert.equal(await page.locator("#reserve").textContent(), "2");
  });
  await launchAndCheck(async page => {
    assert.equal(await page.locator("#water-count").textContent(), "2", "Previous turn must survive relaunch");
    await page.locator("#undo").click();
    assert.equal(await page.locator("#water-count").textContent(), "0");
    assert.equal(await page.locator("#reserve").textContent(), "3");
  });
  console.log("Placement, persistence across restart and undo passed.");
}
smoke().catch(error => { console.error(error); process.exitCode = 1; });
