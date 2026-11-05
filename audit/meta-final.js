// Screenshots the published Final website for Meta on iPhone and desktop. Read-only. No forms are submitted.
// Run 4: the .com-based rebuild. Also records any request to tracking or CRM hosts (must be zero).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const URL = 'https://gitteromri-ux.github.io/lla-blueprint-vip-preview/meta-final/?v=' + Date.now();
const OUT = 'out-meta'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const report = {};
  for (const [tag, opts, step] of [['iphone', { ...devices['iPhone 14'] }, 760], ['desktop', { viewport: { width: 1440, height: 900 } }, 820]]) {
    const c = await b.newContext(opts); const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('requestfailed', r => errs.push('failed ' + r.url()));
    p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    const tracking = []; p.on('request', r => { if (/facebook|google-analytics|googletagmanager|doubleclick|workers\.dev|vercel\.app|eteacher-leads|licdn/.test(r.url())) tracking.push(r.url().slice(0, 120)); });
    const resp = await p.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(1500);
    for (let y = 0; y < 30000; y += 600) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(800);
    const info = await p.evaluate(async () => {
      await document.fonts.ready;
      const imgs = [...document.images].map(i => [i.getAttribute('src'), i.naturalWidth > 0]);
      return {
        title: document.title,
        scrollWidth: document.documentElement.scrollWidth, innerWidth,
        height: document.documentElement.scrollHeight,
        brokenImages: imgs.filter(x => !x[1]).map(x => x[0]),
        fonts: ['Playfair Display', 'Inter', 'Codec Pro', 'Instrument Serif'].map(f => [f, document.fonts.check('16px "' + f + '"')]),
        masterclassTime: document.body.innerText.includes('November 14 at 12:00 PM ET'),
        pricingCard: !!document.querySelector('#pricing .pk-card'), press: document.querySelectorAll('#press .dv-lla-news-card').length,
        videos: [...document.querySelectorAll('video')].map(v => v.currentSrc ? v.currentSrc.split('/').pop() : '(none)'),
        price79: document.body.innerText.includes('$79'),
      };
    });
    report[tag] = { status: resp && resp.status(), ...info, errors: errs.slice(0, 20), tracking };
    let i = 0;
    for (let y = 0; y < info.height; y += step) {
      await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(450);
      await p.screenshot({ path: `${OUT}/${tag}-${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 70 }); i++;
    }
    await c.close();
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await b.close();
})();
