// Final website for Meta: four-device check of the preview and a checkout, button and FAQ check of the production file.
// Both pages are injected with page.route, so nothing is uploaded. Meta, Google, the Worker (CRM) and Vercel are mocked
// here and also resolve to 0.0.0.0 on the runner, so no event or lead can leave. No payment step is submitted.
const { chromium, webkit, devices } = require('playwright');
const fs = require('fs');
const OUT = 'out-mf'; fs.mkdirSync(OUT, { recursive: true });
const PREVIEW = fs.readFileSync('fixtures/preview.html', 'utf8');
const PROD = fs.readFileSync('fixtures/production.html', 'utf8');
const PREVIEW_URL = 'https://gitteromri-ux.github.io/lla-blueprint-vip-preview/meta-final-check/';
const PROD_URL = 'https://www.longevitylifeacademy.com/meta-final-check.html';
const report = { preview: {}, production: {} };
const TRACK = /facebook|google-analytics|googletagmanager|doubleclick|googleadservices|workers\.dev|vercel\.app|licdn|clarity|hotjar|tiktok/;

async function guard(ctx, rec, pageUrl, html) {
  await ctx.route('**/*', async route => {
    const req = route.request(); const url = req.url(); let u;
    try { u = new URL(url); } catch (e) { return route.continue(); }
    if (url.split('?')[0] === pageUrl) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    if (TRACK.test(u.hostname)) {
      rec.tracking.push(req.method() + ' ' + u.hostname + u.pathname.slice(0, 60));
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
      if (/workers\.dev/.test(u.hostname)) {
        let body = { ok: true };
        if (/\/api\/lead\/ecomm$/.test(u.pathname)) body = { ok: true, stid: 'AUDIT', orderid: 'AUDIT-0' };
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (/googletagmanager|connect\.facebook/.test(u.hostname) && req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* blocked in audit */' });
      return route.fulfill({ status: 204, headers: cors, body: '' });
    }
    if (u.hostname === 'ipapi.co') return route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'US' });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { rec.blockedPosts.push(u.hostname + u.pathname.slice(0, 60)); return route.fulfill({ status: 204, body: '' }); }
    return route.continue();
  });
}

async function previewRun(browserType, name, ctxOpts, step) {
  const rec = { tracking: [], blockedPosts: [], errors: [], failed: [] };
  const b = await browserType.launch();
  const ctx = await b.newContext(ctxOpts);
  await guard(ctx, rec, PREVIEW_URL, PREVIEW);
  const p = await ctx.newPage();
  p.on('pageerror', e => rec.errors.push(String(e).slice(0, 200)));
  p.on('requestfailed', r => { const f = r.failure(); if (!/\.(mp4|m3u8|ts)(\?|$)/.test(r.url())) rec.failed.push(r.url().slice(0, 120) + ' ' + (f && f.errorText)); });
  p.on('response', r => { if (r.status() >= 400) rec.failed.push(r.status() + ' ' + r.url().slice(0, 120)); });
  await p.goto(PREVIEW_URL, { waitUntil: 'load', timeout: 90000 }).catch(e => rec.errors.push('goto ' + e));
  await p.waitForTimeout(5000);
  rec.heroVideo = await p.evaluate(() => [...document.querySelectorAll('#hero video')].map(v => ({ src: (v.currentSrc || v.src || '').split('/').pop().slice(0, 40), paused: v.paused, readyState: v.readyState, w: Math.round(v.getBoundingClientRect().width) })));
  try { await p.screenshot({ path: `${OUT}/${name}-hero.jpg`, type: 'jpeg', quality: 70 }); } catch (e) {}
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(150); }
  await p.waitForTimeout(1200);
  Object.assign(rec, await p.evaluate(() => ({
    height: document.documentElement.scrollHeight, vh: innerHeight, screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(1),
    overflowX: document.documentElement.scrollWidth - innerWidth,
    broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0).map(i => (i.currentSrc || i.src).split('/').pop()),
    videosPlaying: [...document.querySelectorAll('video')].filter(v => !v.paused).length, videos: document.querySelectorAll('video').length,
    floater: (() => { const c = document.querySelector('#llaFloatCta'); return c ? c.className : 'missing'; })(),
    whatsapp: !!document.querySelector('#et-bumpyard-widget .widget-trigger-btn'),
  })));
  let i = 0;
  for (let y = 0; y < rec.height; y += step) {
    await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(500);
    try { await p.screenshot({ path: `${OUT}/${name}-${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 62 }); } catch (e) { rec.errors.push('shot ' + e.message.slice(0, 80)); }
    i++;
  }
  report.preview[name] = rec;
  await b.close();
}

async function productionRun(name, ctxOpts) {
  const rec = { tracking: [], blockedPosts: [], errors: [], failed: [], buttons: [], faq: {}, modal: {} };
  const b = await chromium.launch();
  const ctx = await b.newContext(ctxOpts);
  await guard(ctx, rec, PROD_URL, PROD);
  const p = await ctx.newPage();
  p.on('pageerror', e => rec.errors.push(String(e).slice(0, 200)));
  await p.goto(PROD_URL + '?llatest=1', { waitUntil: 'load', timeout: 90000 }).catch(e => rec.errors.push('goto ' + e));
  await p.waitForTimeout(3000);
  rec.ctaCount = await p.evaluate(() => document.querySelectorAll('[data-checkout-open]').length);
  const sels = { pricing: '#pricing .pk-btn', hero: '#hero .btn-primary', julie: '#julie .mf-jbtn', nav: '.nav .nav-cta', final: '#apply .btn-primary', learn: '#syllabus .section-cta-btn', news: '#skills .section-cta-btn', how: '#how .section-cta-btn', teachers: '#teachers .section-cta-btn', faq: '#faq .section-cta-btn', reviews: '.testimonials .section-cta-btn', systems: '.deepdive .section-cta-btn', floater: '#llaFloatCta' };
  for (const [k, sel] of Object.entries(sels)) {
    const el = await p.$(sel);
    if (!el) { rec.buttons.push({ k, found: false }); continue; }
    if (k === 'floater') { await p.evaluate(() => scrollTo(0, 2600)); await p.waitForTimeout(900); }
    try { if (k !== 'floater') await el.scrollIntoViewIfNeeded(); await el.click({ timeout: 4000 }); } catch (e) { rec.buttons.push({ k, click: 'failed ' + e.message.slice(0, 80) }); continue; }
    await p.waitForTimeout(700);
    const open = await p.evaluate(() => { const m = document.getElementById('enrollModal'); return !!(m && m.classList.contains('open')); });
    rec.buttons.push({ k, opensCheckout: open });
    if (k === 'pricing' && open) await p.screenshot({ path: `${OUT}/prod-${name}-modal-step1.jpg`, type: 'jpeg', quality: 70 });
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  }
  const qs = await p.$$('.faq-q');
  let opened = 0;
  for (const q of qs) {
    try {
      await q.scrollIntoViewIfNeeded(); await q.click(); await p.waitForTimeout(450);
      const hgt = await q.evaluate(el => { const a = el.parentElement.querySelector('.faq-a'); return a ? a.getBoundingClientRect().height : 0; });
      if (hgt > 30) opened++;
    } catch (e) {}
  }
  rec.faq = { questions: qs.length, opened };
  await p.screenshot({ path: `${OUT}/prod-${name}-faq.jpg`, type: 'jpeg', quality: 62 });
  try {
    await p.click('#pricing .pk-btn'); await p.waitForTimeout(800);
    await p.fill('#emName', 'Audit Test'); await p.fill('#emEmail', 'audit.llatest@example.com'); await p.fill('#emPhone', '2025550123');
    await p.click('#emGo1'); await p.waitForTimeout(3500);
    rec.modal.step2 = await p.evaluate(() => { const s = document.getElementById('emStep2'); return !!(s && s.classList.contains('on')); });
    rec.modal.step2Text = await p.evaluate(() => { const s = document.getElementById('emStep2'); return s ? s.innerText.replace(/\s+/g, ' ').slice(0, 400) : ''; });
    rec.modal.err = await p.evaluate(() => { const e = document.getElementById('emErr'); return e ? e.textContent : ''; });
    await p.screenshot({ path: `${OUT}/prod-${name}-modal-step2.jpg`, type: 'jpeg', quality: 70 });
  } catch (e) { rec.modal.error = e.message.slice(0, 200); }
  rec.trackingCount = rec.tracking.length; rec.tracking = rec.tracking.slice(0, 25);
  report.production[name] = rec;
  await b.close();
}

(async () => {
  const iphone = { ...devices['iPhone 14'] }; delete iphone.defaultBrowserType;
  const runs = [
    () => previewRun(webkit, 'iphone14-safari', { ...devices['iPhone 14'] }, 664),
    () => previewRun(chromium, 'pixel7-chrome', { ...devices['Pixel 7'] }, 740),
    () => previewRun(webkit, 'iphoneSE-safari', { ...devices['iPhone SE'] }, 548),
    () => previewRun(chromium, 'desktop-chrome', { viewport: { width: 1440, height: 900 } }, 900),
    () => productionRun('iphone', iphone),
    () => productionRun('desktop', { viewport: { width: 1440, height: 900 } }),
  ];
  for (const r of runs) { try { await r(); } catch (e) { report.fatal = (report.fatal || []).concat(String(e).slice(0, 300)); } }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1).slice(0, 20000));
})();
