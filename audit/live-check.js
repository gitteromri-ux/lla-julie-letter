// Checks the deployed preview link itself (no injection): is the served page the same file as the build,
// and how do the logos, Julie card and pricing look on an iPhone and on desktop. Read-only; nothing is submitted.
const { chromium, webkit, devices } = require('playwright');
const fs = require('fs'); const crypto = require('crypto');
const OUT = 'out-mf/live'; fs.mkdirSync(OUT, { recursive: true });
const URL0 = 'https://gitteromri-ux.github.io/lla-blueprint-vip-preview/meta-final/';
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
(async () => {
  const rep = { url: URL0 };
  const local = fs.readFileSync('fixtures/preview.html', 'utf8');
  rep.fixtureSha = sha(local);
  for (let i = 0; i < 20; i++) {
    const r = await fetch(URL0 + '?v=' + Date.now()); const t = await r.text();
    rep.status = r.status; rep.servedSha = sha(t); rep.sameAsBuild = rep.servedSha === rep.fixtureSha; rep.tries = i + 1;
    if (rep.sameAsBuild) break; await new Promise(z => setTimeout(z, 30000));
  }
  for (const [name, bt, o] of [['iphone', webkit, { ...devices['iPhone 14'] }], ['desktop', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }]]) {
    const b = await bt.launch(); const p = await (await b.newContext(o)).newPage();
    const rec = { tracking: [] };
    p.on('request', q => { if (/facebook|google-analytics|googletagmanager|doubleclick|workers\.dev|vercel\.app/.test(q.url())) rec.tracking.push(q.url().slice(0, 80)); });
    await p.goto(URL0 + '?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 }).catch(e => rec.err = String(e).slice(0, 200));
    await p.waitForTimeout(4000);
    rec.logos = await p.evaluate(() => [...document.querySelectorAll('.nav-logo-img, .hero-wordmark-img')].map(i => ({ cls: i.className, src: (i.currentSrc || i.src).split('/').pop(), natural: i.naturalWidth + 'x' + i.naturalHeight, shown: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height), dpr: devicePixelRatio, filter: getComputedStyle(i).filter })));
    rec.order = await p.evaluate(() => [...document.querySelectorAll('main > section, body > section, section[id]')].filter(s => !s.parentElement.closest('section')).map(s => s.id || s.className.split(' ')[0]));
    await p.screenshot({ path: `${OUT}/${name}-top.jpg`, type: 'jpeg', quality: 85 });
    for (const sel of ['#julie', '#pricing', '#cgm']) {
      const e = await p.$(sel); if (!e) { rec[sel] = 'missing'; continue; }
      await e.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
      const bb = await e.boundingBox(); rec[sel] = { screens: +(bb.height / (o.viewport ? o.viewport.height : 844)).toFixed(2) };
      await e.screenshot({ path: `${OUT}/${name}-${sel.slice(1)}.jpg`, type: 'jpeg', quality: 85 }).catch(() => {});
    }
    rep[name] = rec; await b.close();
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep, null, 1));
})();
