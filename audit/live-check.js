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
  for (const [name, bt, o] of [['iphone', webkit, { ...devices['iPhone 14'] }], ['desktop', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['android320', chromium, { viewport: { width: 320, height: 693 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]) {
    const b = await bt.launch(); const p = await (await b.newContext(o)).newPage();
    const rec = { tracking: [] };
    p.on('request', q => { if (/facebook|google-analytics|googletagmanager|doubleclick|workers\.dev|vercel\.app/.test(q.url())) rec.tracking.push(q.url().slice(0, 80)); });
    await p.goto(URL0 + '?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 }).catch(e => rec.err = String(e).slice(0, 200));
    await p.waitForTimeout(4000);
    rec.fit = await p.evaluate(() => ({ screen: screen.width, innerWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth, viewport: (document.querySelector('meta[name="viewport"]') || {}).content }));
    rec.logos = await p.evaluate(() => [...document.querySelectorAll('.nav-logo-img, .hero-wordmark-img')].map(i => ({ cls: i.className, src: (i.currentSrc || i.src).split('/').pop(), natural: i.naturalWidth + 'x' + i.naturalHeight, shown: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height), dpr: devicePixelRatio, filter: getComputedStyle(i).filter })));
    rec.order = await p.evaluate(() => [...document.querySelectorAll('main > section, body > section, section[id]')].filter(s => !s.parentElement.closest('section')).map(s => s.id || s.className.split(' ')[0]));
    await p.screenshot({ path: `${OUT}/${name}-top.jpg`, type: 'jpeg', quality: 85 });
    rec.logos2 = await p.evaluate(async () => { const e = document.querySelector('.trust-strip-track'); if (!e) return 'missing'; e.scrollIntoView(); await new Promise(r => setTimeout(r, 400)); const a = getComputedStyle(e).transform; await new Promise(r => setTimeout(r, 1500)); const b = getComputedStyle(e).transform; return { anim: getComputedStyle(e).animationName, moving: a !== b, broken: [...e.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length }; });
    await p.addStyleTag({ content: 'nav, .nav, #llaFloatCta, #et-bumpyard-widget, [class*="whatsapp"]{visibility:hidden!important}' });
    rec.syllabus = await p.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      const sec = document.querySelector('#syllabus'); if (!sec) return 'missing'; sec.scrollIntoView(); await w(400);
      const tabs = [...sec.querySelectorAll('.curriculum-tab')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
      const res = { tabs, phases: [] };
      for (const n of [1, 2, 3, 4]) {
        sec.querySelector(`.curriculum-tab[data-phase-tab="${n}"]`).click(); await w(500);
        const blk = sec.querySelector('.phase-block.is-active');
        const it = blk.querySelector('.curriculum-item'); it.querySelector('.curriculum-trigger').click(); await w(600);
        const body = it.querySelector('.curriculum-body');
        res.phases.push({ n, active: blk.dataset.phase, sessions: blk.querySelectorAll('.curriculum-item').length, opened: it.classList.contains('active'), bodyPx: Math.round(body.getBoundingClientRect().height), h3px: getComputedStyle(blk.querySelector('h3')).fontSize, flowPx: getComputedStyle(blk.querySelector('.curriculum-flow')).fontSize });
        it.querySelector('.curriculum-trigger').click(); await w(400);
      }
      sec.querySelector('.curriculum-tab[data-phase-tab="3"]').click(); await w(400);
      sec.querySelector('.phase-block.is-active .curriculum-trigger').click(); await w(600);
      return res;
    });
    { const e = await p.$('#syllabus'); if (e) await e.screenshot({ path: `${OUT}/${name}-syllabus-p3.jpg`, type: 'jpeg', quality: 85 }).catch(() => {}); }
    await p.evaluate(async () => { const s = document.querySelector('#syllabus'); s.querySelector('.phase-block.is-active .curriculum-trigger').click(); s.querySelector('.curriculum-tab[data-phase-tab="1"]').click(); await new Promise(r => setTimeout(r, 500)); });
    for (const sel of ['#julie', '#pricing', '#cgm', '#syllabus', '#how']) {
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
