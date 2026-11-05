/* LLA pages.dev live audit. Read-only against production:
 * - every request to Meta (facebook.com), the CAPI relay (vercel.app), the CRM worker (workers.dev),
 *   Google/Cloudflare analytics is answered locally by the browser and recorded, never sent;
 * - the runner's /etc/hosts also points those hosts at 0.0.0.0 as a second safety net;
 * - no real order, lead, payment or Meta event is created. */
const { chromium, webkit, devices } = require('playwright');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const OUT = path.join(__dirname, process.env.AUDIT_SET === '3' ? 'out3' : process.env.AUDIT_SET === '4' ? 'out4' : 'out'); const SHOTS = path.join(OUT, 'shots'); const LIVE = path.join(OUT, 'live');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(LIVE, { recursive: true });
const SITE = process.env.LLA_SITE || 'https://longevitylifeacademy.pages.dev';
const FBCLID = 'IwZXh0bgNhZW0BMABhZGlkAasYz9rA1XcBHfU_Lq3Kx7MzZ3oAbCdEf-AUDIT1105';
const LAND = SITE + '/?fbclid=' + FBCLID + '&cid=118149&adGroupID=108816&utm_source=Facebook&utm_medium=Topic&utm_campaign=120222000000000001&utm_term=52668330870828&utm_content=52674115544628&creative=52674115544628&placement=Facebook_Mobile_Feed&cq_src=facebook&cq_cmp=LGV_EN_PPC_ecomm-02&cq_con=audit&cq_med=Facebook_Mobile_Feed&cq_net=fb&cq_plt=fp';
const BUYER = { name: 'Jane Auditor', email: 'jane.auditor@lla-audit.dev', phone: '2125550147' };
const IDS = { stid: '900000001', orderid: '900000002', paymentId: '900000003' };
const report = { startedAt: new Date().toISOString(), land: LAND, fbclid: FBCLID, scenarios: {}, live: {} };
const save = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function details(plan) {
  const up = plan === 'upfront';
  return { OrderId: Number(IDS.orderid), StudentId: Number(IDS.stid), PaymentID: Number(IDS.paymentId), MainAbroadCourseID: 258, AbroadCourseID: 1774,
    AmountToCharge: up ? 799 : 79, FirstPayment: up ? 799 : 79, NumOfPayments: up ? 1 : 4, LeftToPay: up ? 0 : 676, PaymentPerMonth: up ? 0 : 169,
    OrderCoursePrice: up ? 799 : 755, Email: BUYER.email, FirstName: 'Jane', LastName: 'Auditor', State: 'NY',
    Airwallex: { paymentIntentId: 'int_AUDITMOCK0000000000', clientSecret: 'AUDIT_MOCK_SECRET', amount: up ? 799 : 79, currency: 'USD', customerId: 'cus_AUDITMOCK' } };
}

function parsePixel(rec) {
  try {
    const u = new URL(rec.url); const p = new URLSearchParams(u.search);
    if (rec.post && /multipart/.test(rec.ctype || '') ) { const re = /name="([^"]+)"\r?\n\r?\n([^\r\n]*)/g; let mm; while ((mm = re.exec(rec.post))) p.set(mm[1], mm[2]); }
    else if (rec.post && /=/.test(rec.post) && !/^\s*[{[]/.test(rec.post)) new URLSearchParams(rec.post).forEach((v, k) => p.set(k, v));
    const o = { t: rec.t, phase: rec.phase, path: u.pathname, ev: p.get('ev'), eid: p.get('eid'), id: p.get('id'), fbp: p.get('fbp'), fbc: p.get('fbc'), dl: (p.get('dl') || '').slice(0, 160) };
    const cd = {}; const ud = [];
    p.forEach((v, k) => { if (k.startsWith('cd[')) cd[k.slice(3, -1)] = v.slice(0, 120); if (k.startsWith('ud[')) ud.push(k.slice(3, -1)); });
    o.cd = cd; o.ud = ud; return o;
  } catch (e) { return { t: rec.t, phase: rec.phase, raw: rec.url.slice(0, 200) }; }
}
function parseRelay(rec) {
  let j = null; try { j = JSON.parse(rec.body); } catch (e) {}
  const cdv = (o, k) => (o[k] !== undefined ? o[k] : (o.custom_data ? o.custom_data[k] : undefined));
  const pick = (o) => o && ({ event_name: o.event_name, event_id: o.event_id, action_source: o.action_source, url: (o.url || o.event_source_url || '').slice(0, 200),
    value: cdv(o, 'value'), currency: cdv(o, 'currency'), content_ids: cdv(o, 'content_ids'), order_id: cdv(o, 'order_id'), plan: o.plan,
    fbc: o.fbc || (o.user_data && o.user_data.fbc), fbp: o.fbp || (o.user_data && o.user_data.fbp), email: o.email ? String(o.email).slice(0, 80) : undefined, phone: o.phone ? String(o.phone).slice(0, 40) : undefined,
    fn: o.fn, ln: o.ln, st: o.st, country: o.country, external_id: o.external_id ? String(o.external_id).slice(0, 70) : undefined,
    test_event_code: o.test_event_code || (j && j.test_event_code) || null });
  let evs = [];
  if (j && Array.isArray(j.data)) evs = j.data.map(pick); else if (j) evs = [pick(j)];
  return { t: rec.t, phase: rec.phase, path: rec.path, events: evs, topKeys: j ? Object.keys(j) : null, body: (rec.body || '').slice(0, 4000) };
}

async function setup(ctx, sc) {
  Object.assign(sc, { pixelRaw: [], relayRaw: [], worker: [], blocked: [], hosts: {}, console: [], pageErrors: [], failed: [], shots: [], n: 0, phase: 'start', t0: Date.now(), notes: [] });
  await ctx.addInitScript(() => {
    window.__perf = {};
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
    try { new PerformanceObserver(l => { const e = l.getEntries().pop(); if (e) window.__perf.lcp = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  });
  await ctx.route('**/*', async route => {
    const req = route.request(); let u; try { u = new URL(req.url()); } catch (e) { return route.continue(); }
    const h = u.hostname, m = req.method(), t = Date.now() - sc.t0, phase = sc.phase;
    sc.hosts[h] = (sc.hosts[h] || 0) + 1;
    try {
      if (/(^|\.)facebook\.com$/.test(h)) {
        let pb = ''; try { const bf = req.postDataBuffer(); pb = bf ? bf.toString('utf8') : ''; } catch (e) {} sc.pixelRaw.push({ t, phase, method: m, url: req.url().slice(0, 6000), ctype: req.headers()['content-type'] || '', post: pb.slice(0, 12000) });
        return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
      }
      if (/\.vercel\.app$/.test(h)) {
        sc.relayRaw.push({ t, phase, method: m, path: u.pathname, body: (req.postData() || '').slice(0, 12000) });
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, events_received: 1, meta_status: 200, fbtrace_id: 'AUDIT_MOCK' }) });
      }
      if (/\.workers\.dev$/.test(h)) {
        const body = req.postData() || ''; sc.worker.push({ t, phase, method: m, path: u.pathname, body: body.slice(0, 3000) });
        const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS' };
        if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
        let resp = { ok: true };
        if (/\/api\/lead\/ecomm$/.test(u.pathname)) resp = { ok: true, stid: IDS.stid, orderid: IDS.orderid };
        else if (/\/api\/checkout\/details$/.test(u.pathname)) { const ref = req.headers()['referer'] || ''; resp = details(/plan=upfront/.test(ref) ? 'upfront' : 'monthly'); }
        else if (/\/api\/checkout\/payments\/crm$/.test(u.pathname)) return route.fulfill({ status: 202, headers: cors, contentType: 'application/json', body: '{"accepted":true}' });
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(resp) });
      }
      if (sc.blockVideo && /\.(mp4|webm|m3u8)(\?|$)/.test(u.pathname)) { sc.blocked.push({ t, phase, host: h, method: m, path: 'VIDEO ' + u.pathname.slice(-50) }); return route.fulfill({ status: 404, body: '' }); }
      if (h === 'ipapi.co') return route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'US' });
      if (/google-analytics\.com$|analytics\.google\.com$|doubleclick\.net$|googleadservices\.com$|cloudflareinsights\.com$|clarity\.ms$|ads\.linkedin\.com$|analytics\.tiktok\.com$|hotjar\.(com|io)$/.test(h) ||
          (/(^|\.)google\.(com|co\.\w+)$/.test(h) && /collect|pagead|ccm|conversion|ads/.test(u.pathname))) {
        sc.blocked.push({ t, phase, host: h, method: m, path: u.pathname.slice(0, 120), q: u.search.slice(0, 600) });
        return route.fulfill({ status: 204, body: '' });
      }
      if (m !== 'GET' && m !== 'HEAD' && !/(^|\.)airwallex\.com$|(^|\.)paypal\.com$|paypalobjects\.com$/.test(h)) {
        sc.blocked.push({ t, phase, host: h, method: m, path: u.pathname.slice(0, 120), body: (req.postData() || '').slice(0, 300) });
        return route.fulfill({ status: 204, body: '' });
      }
      return route.continue();
    } catch (e) { sc.notes.push('route error ' + h + ' ' + e.message); try { return route.continue(); } catch (_) {} }
  });
}
function watch(page, sc) {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) sc.console.push({ t: Date.now() - sc.t0, phase: sc.phase, type: m.type(), text: m.text().slice(0, 300) }); });
  page.on('pageerror', e => sc.pageErrors.push({ phase: sc.phase, text: String(e).slice(0, 300) }));
  page.on('requestfailed', r => { const u = r.url(); if (!/facebook\.com|vercel\.app|workers\.dev/.test(u)) sc.failed.push({ phase: sc.phase, url: u.slice(0, 160), err: (r.failure() || {}).errorText }); });
  page.on('response', async r => {
    try { if (r.request().resourceType() === 'document' && r.url().startsWith(SITE)) { (sc.docs = sc.docs || []).push({ phase: sc.phase, url: r.url().slice(0, 220), status: r.status(), headers: r.headers() }); } } catch (e) {}
  });
}
async function shot(page, sc, name, full) {
  const f = 'shots/' + sc.id + '-' + String(++sc.n).padStart(2, '0') + '-' + name + '.jpg';
  try { await page.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 62, fullPage: !!full, timeout: 30000 }); sc.shots.push(f); } catch (e) { sc.notes.push('shot ' + name + ': ' + e.message.slice(0, 120)); }
}
async function vis(page, sel) { for (const e of await page.locator(sel).all()) { try { if (await e.isVisible()) return e; } catch (_) {} } return null; }
const modalOpen = page => page.evaluate(() => { const m = document.querySelector('#enrollModal'); if (!m) return false; const cs = getComputedStyle(m); return cs.display !== 'none' && cs.visibility !== 'hidden' && m.getBoundingClientRect().height > 50; }).catch(() => false);
const modalText = page => page.evaluate(() => { const m = document.querySelector('#enrollModal'); return m ? m.innerText.replace(/\s+/g, ' ').trim().slice(0, 1600) : null; }).catch(() => null);
const visibleErrors = page => page.evaluate(() => [...document.querySelectorAll('#enrollModal .em-err, #enrollModal [role=alert], #enrollModal .err, #enrollModal .error, #enrollModal [aria-invalid="true"]')]
  .filter(e => e.getClientRects().length && (e.innerText || '').trim()).map(e => (e.id || String(e.className).slice(0, 30)) + ': ' + (e.innerText || '').trim().slice(0, 200))).catch(() => []);
async function state(page) {
  return page.evaluate(() => {
    const ls = {}, ss = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/lla|fb|attr|promo|buyer|xid|relay/i.test(k)) ls[k] = String(localStorage.getItem(k)).slice(0, 400); } } catch (e) {}
    try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = String(sessionStorage.getItem(k)).slice(0, 400); } } catch (e) {}
    const P = window.LLA_PROMO || {};
    return { url: location.href.slice(0, 300), title: document.title, LLA_LIVE: window.LLA_LIVE, ecommCfg: window.LLA_ECOMM_CONFIG ? { env: window.LLA_ECOMM_CONFIG.env, mode: window.LLA_ECOMM_CONFIG.mode } : null,
      promo: { code: P.code, active: P.active, firstPayment: P.firstPayment, codes: P.codes }, perf: window.__perf, cookie: document.cookie.slice(0, 600), ls, ss,
      dataLayer: (window.dataLayer || []).map(x => { try { return JSON.stringify(x).slice(0, 200); } catch (e) { return String(x).slice(0, 100); } }).slice(0, 60) };
  }).catch(e => ({ err: e.message }));
}
async function priceTexts(page) {
  return page.evaluate(() => {
    const out = []; const seen = new Set(); const H = innerHeight;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.nextNode ? w.currentNode : null; if (!n) break;
      const s = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!s || !/\$\s?\d|\d\s?%|JULIE249|MASTERCLASS-VIP|credit|coupon|refund|cash back|per month|\/ ?mo/i.test(s)) continue;
      const el = n.parentElement; if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      const blk = el.closest('p,li,div,span,a,button,h1,h2,h3,h4,small,b,strong') || el; const txt = (blk.innerText || s).replace(/\s+/g, ' ').trim().slice(0, 220);
      if (seen.has(txt)) continue; seen.add(txt);
      const sec = el.closest('section[id],#mockBar,#mockStrip,#enrollModal,header,footer,[id]');
      out.push({ screen: +((el.getBoundingClientRect().top + scrollY) / H).toFixed(1), where: sec ? (sec.id || sec.tagName) : '', text: txt });
    }
    return out.slice(0, 260);
  }).catch(e => [{ err: e.message }]);
}
async function scrollShots(page, sc, max) {
  const H = await page.evaluate(() => innerHeight); let total = await page.evaluate(() => document.documentElement.scrollHeight);
  sc.screens = +(total / H).toFixed(1);
  for (let i = 0, y = 0; y < total && i < max; i++, y += H) {
    await page.evaluate(v => window.scrollTo(0, v), y); await sleep(700); await shot(page, sc, 'screen' + String(i + 1).padStart(2, '0'));
    total = await page.evaluate(() => document.documentElement.scrollHeight);
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
}
async function layout(page) {
  return page.evaluate(() => {
    const H = innerHeight; const secs = [...document.querySelectorAll('section[id], header, footer')].filter(s => s.getClientRects().length && s.getBoundingClientRect().height > 40)
      .map(s => ({ id: s.id || s.tagName, screen: +((s.getBoundingClientRect().top + scrollY) / H).toFixed(1), h: +(s.getBoundingClientRect().height / H).toFixed(1), head: ((s.querySelector('h1,h2') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140) }));
    const ctas = [...document.querySelectorAll('a,button')].filter(x => /enrol|reserve|join|start|buy|get started|pay/i.test(x.innerText || '') && x.getClientRects().length && x.offsetWidth > 0)
      .map(x => ({ text: (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60), href: x.getAttribute('href') || '', id: x.id || '', cls: String(x.className).slice(0, 40), screen: +((x.getBoundingClientRect().top + scrollY) / H).toFixed(1), fixed: getComputedStyle(x).position === 'fixed' || !!x.closest('#mockBar') }));
    const vids = [...document.querySelectorAll('video')].map(v => ({ src: (v.currentSrc || v.getAttribute('src') || '').slice(-70), preload: v.preload, autoplay: v.autoplay, w: v.offsetWidth, h: v.offsetHeight, screen: +((v.getBoundingClientRect().top + scrollY) / H).toFixed(1) }));
    const fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.style + ' ' + f.weight).filter((v, i, a) => a.indexOf(v) === i);
    const small = [...document.querySelectorAll('p,li,span,a,small,b,label')].filter(e => e.getClientRects().length && (e.innerText || '').trim().length > 3 && !e.closest('#enrollModal') && parseFloat(getComputedStyle(e).fontSize) < 14).length;
    return { W: innerWidth, H, docW: document.documentElement.scrollWidth, screens: +(document.documentElement.scrollHeight / H).toFixed(1), h1: (document.querySelector('#hero h1') || document.querySelector('h1') || {}).innerText, heroSub: ((document.querySelector('#hero .pdp-cine-sub') || {}).innerText || '').slice(0, 300), secs, ctas, vids, fonts, textUnder14px: small,
      mockBar: ((document.querySelector('#mockBar') || {}).innerText || '').replace(/\s+/g, ' '), mockStrip: ((document.querySelector('#mockStrip') || {}).innerText || '').replace(/\s+/g, ' ') };
  }).catch(e => ({ err: e.message }));
}
async function clickContinue(page) { const b = await vis(page, '#enrollModal button:has-text("Continue"), #enrollModal [type=submit]'); if (!b) return false; await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click({ timeout: 8000 }).catch(() => {}); return true; }
async function fillStep1(page, o) {
  const name = await vis(page, '#emName, #enrollModal input[placeholder*="Name" i]'); const email = await vis(page, '#emEmail, #enrollModal input[type=email]'); const phone = await vis(page, '#emPhone, #enrollModal input[type=tel]');
  if (name) await name.fill(o.name); if (email) await email.fill(o.email);
  if (o.country) { for (const s of await page.locator('#enrollModal select').all()) { if (!(await s.isVisible().catch(() => false))) continue; const opts = await s.locator('option').allInnerTexts(); if (opts.some(t => t.trim() === o.country)) { await s.selectOption({ label: o.country }).catch(() => {}); break; } } }
  if (phone) { await phone.fill(''); await phone.fill(o.phone); }
  if (o.state) { for (const s of await page.locator('#enrollModal select').all()) { if (!(await s.isVisible().catch(() => false))) continue; const opts = await s.locator('option').allInnerTexts(); const hit = opts.find(t => t.trim() === o.state); if (hit) { await s.selectOption({ label: hit }).catch(() => {}); } } }
  return { name: !!name, email: !!email, phone: !!phone };
}
async function openModalFromHero(page, sc) {
  const c = await vis(page, '#hero a:has-text("Enroll"), #hero button:has-text("Enroll"), #hero .pdp-cine-cta');
  if (c) { await c.click({ timeout: 8000 }).catch(e => sc.notes.push('hero cta click ' + e.message.slice(0, 80))); }
  else { const b = await vis(page, '#mockBar a, a:has-text("Enroll now")'); if (b) await b.click().catch(() => {}); }
  await sleep(1400); return modalOpen(page);
}
function summarise(sc) {
  sc.pixel = sc.pixelRaw.map(parsePixel); sc.relay = sc.relayRaw.map(parseRelay);
  const pairs = []; const rel = []; sc.relay.forEach(r => r.events.forEach(e => e && rel.push(Object.assign({ t: r.t, phase: r.phase }, e))));
  sc.pixel.filter(p => p.ev && (p.path === '/tr/' || p.path === '/tr')).forEach(p => { const twin = rel.find(r => r.event_name === p.ev && r.event_id === p.eid); pairs.push({ phase: p.phase, ev: p.ev, eid: p.eid, browser: true, server: !!twin, value: p.cd.value, serverValue: twin && twin.value }); });
  rel.forEach(r => { if (!sc.pixel.find(p => p.ev === r.event_name && p.eid === r.event_id)) pairs.push({ phase: r.phase, ev: r.event_name, eid: r.event_id, browser: false, server: true, serverValue: r.value }); });
  sc.eventPairs = pairs; delete sc.relayRaw;
}

async function liveFiles() {
  const L = report.live = { files: [], index: null };
  const get = async (p) => {
    const t = Date.now(); let r; try { r = await fetch(SITE + p, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' } }); } catch (e) { L.files.push({ path: p, err: e.message }); return null; }
    const buf = Buffer.from(await r.arrayBuffer()); const rec = { path: p, status: r.status, ms: Date.now() - t, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), type: r.headers.get('content-type'), cache: r.headers.get('cache-control'), location: r.headers.get('location') };
    if (p === '/' ) rec.headers = Object.fromEntries(r.headers.entries());
    L.files.push(rec);
    if (r.status === 200 && buf.length < 3e6) { const f = path.join(LIVE, (p === '/' ? 'index.html' : p.replace(/^\//, '').split('?')[0]) || 'index.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); }
    return { status: r.status, text: buf.toString('utf8') };
  };
  const pages = ['/', '/index.html', '/checkout.html', '/blueprint/', '/blueprint/index.html', '/blueprint/checkout.html', '/privacy.html', '/cancellation.html', '/robots.txt', '/checkout'];
  const assets = new Set();
  for (const p of pages) {
    const r = await get(p); if (!r || r.status !== 200 || !/html/.test(p) && p !== '/' && p !== '/blueprint/') continue;
    const re = /(?:src|href)\s*=\s*["']([^"'#]+\.(?:js|css)(?:\?[^"']*)?)["']/g; let m;
    const base = p.startsWith('/blueprint/') ? '/blueprint/' : '/';
    while ((m = re.exec(r.text))) { let u = m[1]; if (/^https?:/.test(u)) { if (!u.startsWith(SITE)) continue; u = u.slice(SITE.length); } else if (u.startsWith('../')) u = '/' + u.slice(3); else if (!u.startsWith('/')) u = base + u; assets.add(u.split('?')[0]); }
  }
  for (const a of [...assets].sort()) await get(a);
  save();
}

async function scenarioIphoneFull(br, key, label, opt) {
  opt = opt || {};
  const sc = report.scenarios[key] = { id: label, device: opt.device || 'iPhone 14' };
  const ctx = await br.newContext({ ...devices['iPhone 14'], locale: 'en-US', timezoneId: 'America/New_York' });
  sc.blockVideo = !!opt.blockVideo; await setup(ctx, sc); const page = await ctx.newPage(); watch(page, sc);
  sc.phase = 'land'; const t0 = Date.now();
  await page.goto(LAND, { waitUntil: 'load', timeout: 120000 }).catch(e => sc.notes.push('goto ' + e.message.slice(0, 100)));
  sc.loadMs = Date.now() - t0; await sleep(5000);
  sc.cookies = (await ctx.cookies()).filter(c => /_fb|lla/i.test(c.name)).map(c => ({ name: c.name, value: c.value, domain: c.domain, expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session', httpOnly: c.httpOnly }));
  sc.landState = await state(page); sc.layout = await layout(page);
  await shot(page, sc, 'land-first-screen');
  sc.phase = 'scroll'; if (opt.scroll !== false) await scrollShots(page, sc, 40); sc.priceTexts = await priceTexts(page);
  sc.phase = 'cta-test'; sc.ctaTest = [];
  for (const sel of ['#hero a:has-text("Enroll")', 'header a:has-text("Enroll")', '#mockBar a', '#offer a:has-text("Enroll")', '#enroll-mini a', '#vip a:has-text("Enroll")', '#learn-com a:has-text("Enroll")', '#syllabus a:has-text("Enroll")']) {
    const el = await vis(page, sel); if (!el) { sc.ctaTest.push({ sel, found: false }); continue; }
    await el.scrollIntoViewIfNeeded().catch(() => {}); await sleep(300); const before = await page.evaluate(() => scrollY);
    await el.click({ timeout: 6000 }).catch(() => {}); await sleep(1200); const open = await modalOpen(page);
    sc.ctaTest.push({ sel, found: true, text: (await el.innerText().catch(() => '')).trim().slice(0, 40), opensModal: open, scrolledInstead: !open && Math.abs((await page.evaluate(() => scrollY)) - before) > 50 });
    if (open) { const x = await vis(page, '#enrollModal .em-x, #enrollModal [aria-label="Close"]'); if (x) await x.click().catch(() => {}); else await page.keyboard.press('Escape').catch(() => {}); await sleep(600); }
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
  sc.phase = 'enroll-click'; sc.modalOpened = await openModalFromHero(page, sc); await shot(page, sc, 'step1-empty'); sc.step1Text = await modalText(page);
  sc.phase = 'step1-validation'; sc.validation = {};
  await clickContinue(page); await sleep(900); sc.validation.empty = { errors: await visibleErrors(page), advanced: /start date/i.test(await modalText(page) || '') }; await shot(page, sc, 'step1-empty-continue');
  await fillStep1(page, { name: BUYER.name, email: 'jane.auditor@', phone: BUYER.phone, country: 'United States', state: 'New York' }); await clickContinue(page); await sleep(900);
  sc.validation.badEmail = { errors: await visibleErrors(page), advanced: /start date/i.test(await modalText(page) || '') }; await shot(page, sc, 'step1-bad-email');
  await fillStep1(page, { name: 'Jane', email: BUYER.email, phone: BUYER.phone }); await clickContinue(page); await sleep(900);
  sc.validation.oneWordName = { errors: await visibleErrors(page), advanced: /start date/i.test(await modalText(page) || '') }; await shot(page, sc, 'step1-one-word-name');
  await fillStep1(page, { name: BUYER.name, email: BUYER.email, phone: '5550147', country: 'United States' }); await clickContinue(page); await sleep(900);
  sc.validation.shortPhone = { errors: await visibleErrors(page), advanced: /start date/i.test(await modalText(page) || '') }; await shot(page, sc, 'step1-short-phone');
  sc.phase = 'step1-continue';
  sc.filled = await fillStep1(page, { name: BUYER.name, email: BUYER.email, phone: BUYER.phone, country: 'United States', state: 'New York' }); await shot(page, sc, 'step1-filled');
  const tStep1 = Date.now(); await clickContinue(page);
  await page.waitForFunction(() => /start date/i.test((document.querySelector('#enrollModal') || {}).innerText || ''), null, { timeout: 30000 }).catch(() => {});
  sc.step1ToStep2Ms = Date.now() - tStep1; await sleep(1500); await shot(page, sc, 'step2'); sc.step2Text = await modalText(page);
  sc.phase = 'step2';
  sc.step2Controls = await page.evaluate(() => [...document.querySelectorAll('#enrollModal button, #enrollModal label, #enrollModal input, #enrollModal [data-pl]')].filter(e => e.getClientRects().length)
    .map(e => e.tagName + ':' + (e.id || '') + ':' + String(e.className).slice(0, 24) + ':' + (e.getAttribute('data-pl') || '') + ':' + (e.innerText || e.value || e.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 60))).catch(() => []);
  const date = await vis(page, '#enrollModal button.dp-card'); if (date) { await date.click().catch(() => {}); await sleep(800); }
  await shot(page, sc, 'step2-date-selected');
  sc.promoTest = {};
  try {
    const lbl = await vis(page, '#enrollModal label:has-text("promo"), #enrollModal :text("I have promo code")'); if (lbl) { await lbl.click().catch(() => {}); await sleep(400); }
    const inp = await vis(page, '#enrollModal input[id*="romo" i], #enrollModal input[id*="code" i], #enrollModal input[placeholder*="code" i]');
    if (inp) {
      sc.promoTest.before = await inp.inputValue().catch(() => null);
      await inp.fill('WRONG10'); const ap = await vis(page, '#emApply, #enrollModal button:has-text("Apply")'); if (ap) await ap.click().catch(() => {}); await sleep(1000);
      sc.promoTest.wrongCode = (await modalText(page) || '').match(/.{0,120}(code|promo).{0,160}/i)?.[0] || null; await shot(page, sc, 'step2-wrong-promo');
      await inp.fill(sc.promoTest.before || 'JULIE249'); const ap2 = await vis(page, '#emApply, #enrollModal button:has-text("Apply")'); if (ap2) await ap2.click().catch(() => {}); await sleep(1000);
      sc.promoTest.restored = (await modalText(page) || '').match(/.{0,80}\$79.{0,120}/)?.[0] || null;
    } else sc.promoTest.input = 'not found';
  } catch (e) { sc.promoTest.err = e.message.slice(0, 120); }
  sc.step2TextAfter = await modalText(page);
  const cont = await vis(page, '#emGo2, #enrollModal button:has-text("Continue")');
  if (cont) { const bb = await cont.boundingBox().catch(() => null); sc.step2ContinueBelowFold = bb ? (bb.y + bb.height > (await page.evaluate(() => innerHeight))) : null; }
  sc.phase = 'step2-continue'; const tStep2 = Date.now();
  if (cont) { await cont.scrollIntoViewIfNeeded().catch(() => {}); await shot(page, sc, 'step2-continue-visible'); await cont.click({ timeout: 8000 }).catch(e => sc.notes.push('step2 continue ' + e.message.slice(0, 80))); }
  await page.waitForURL(/checkout/, { timeout: 45000 }).catch(() => sc.notes.push('no navigation to checkout within 45s'));
  sc.step2ToCheckoutMs = Date.now() - tStep2; sc.phase = 'checkout';
  await sleep(2500); await shot(page, sc, 'checkout-first-screen');
  await page.waitForFunction(() => { const m = document.getElementById('awx-dropin'); return m && (m.querySelector('iframe') || /disabled|error|could not|try again/i.test(m.innerText)); }, null, { timeout: 25000 }).catch(() => {});
  sc.checkoutReadyMs = Date.now() - tStep2; await sleep(2500);
  await shot(page, sc, 'checkout-after-mount'); await shot(page, sc, 'checkout-full', true);
  if (opt.paypalTab) {
    sc.phase = 'paypal-tab';
    const tab = await vis(page, '[data-pm="paypal"], [data-method="paypal"], button:has(img[alt*="PayPal" i]), [role=tab]:has-text("PayPal"), img[alt*="PayPal" i]');
    sc.paypalTabFound = !!tab;
    if (tab) { await tab.scrollIntoViewIfNeeded().catch(() => {}); await tab.click().catch(() => {}); await sleep(6000); }
    sc.paypalState = await page.evaluate(() => { const b = document.getElementById('paypalBox'); const c = document.getElementById('paypal-button-container'); return { boxShown: !!(b && getComputedStyle(b).display !== 'none'), buttonFrames: c ? c.querySelectorAll('iframe').length : 0, status: ((document.getElementById('paypal-status') || {}).innerText || '').slice(0, 120), sdk: !!(window.paypal && window.paypal.Buttons) }; }).catch(e => ({ err: e.message }));
    await shot(page, sc, 'paypal-tab');
    const pb = await page.$('#paypalBox'); if (pb) { await pb.scrollIntoViewIfNeeded().catch(() => {}); await sleep(800); await shot(page, sc, 'paypal-buttons'); }
  }
  sc.checkoutState = await state(page); sc.checkoutLayout = await layout(page); sc.checkoutPrices = await priceTexts(page);
  sc.checkoutText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 3000)).catch(() => null);
  sc.payMethods = await page.evaluate(() => ({ awxMount: !!document.getElementById('awx-dropin'), awxIframes: [...document.querySelectorAll('iframe')].map(f => (f.src || '').slice(0, 120)), paypalSdk: !!document.querySelector('script[src*="paypal.com/sdk"]'), paypalSdkSrc: (document.querySelector('script[src*="paypal.com/sdk"]') || {}).src || null, paypalButtons: !!document.querySelector('[id*=paypal i] iframe, .paypal-buttons'), awxSdk: !!window.Airwallex, applePayText: /apple pay/i.test(document.body.innerText), googlePayText: /google pay/i.test(document.body.innerText), applePayEl: !!document.querySelector('apple-pay-button,[class*=apple-pay i],[id*=applepay i]'), googlePayEl: !!document.querySelector('[class*=gpay i],[id*=gpay i],[class*=google-pay i]'), recurringWords: (document.body.innerText.match(/.{0,60}(recurring|subscription|auto-?renew|automatically charge|future payments|save (your )?card).{0,60}/ig) || []).slice(0, 6) })).catch(e => ({ err: e.message }));
  if (opt.backForward !== false) {
    sc.phase = 'checkout-reload'; await page.reload({ waitUntil: 'load', timeout: 90000 }).catch(() => {}); await sleep(6000); await shot(page, sc, 'checkout-after-reload');
    sc.phase = 'back-to-page'; await page.goBack({ waitUntil: 'load', timeout: 90000 }).catch(() => {}); await sleep(5000); sc.afterBack = { url: page.url().slice(0, 200), modal: await modalOpen(page), modalText: (await modalText(page) || '').slice(0, 300) }; await shot(page, sc, 'after-back');
    const c2 = await vis(page, '#emGo2, #enrollModal button:has-text("Continue")'); sc.afterBack.continueVisible = !!c2;
    if (c2) { sc.phase = 'second-continue'; await c2.scrollIntoViewIfNeeded().catch(() => {}); await c2.click().catch(() => {}); await page.waitForURL(/checkout/, { timeout: 45000 }).catch(() => {}); await sleep(6000); await shot(page, sc, 'second-checkout'); }
  }
  sc.phase = 'end'; await sleep(3000); await ctx.close(); summarise(sc); save();
}

async function scenarioAndroidTimed(cr) {
  const sc = report.scenarios.android = { id: 'B-pixel7-chrome-weakLTE', device: 'Pixel 7 (Chromium), weak LTE 120ms 4Mbps CPU x3' };
  const ctx = await cr.newContext({ ...devices['Pixel 7'], locale: 'en-US', timezoneId: 'America/Chicago' });
  await setup(ctx, sc); const page = await ctx.newPage(); watch(page, sc);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 120, downloadThroughput: 4e6 / 8, uploadThroughput: 1.5e6 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 3 });
  sc.phase = 'land'; const t0 = Date.now();
  await page.goto(LAND.replace('AUDIT1105', 'AUDIT1105B'), { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(e => sc.notes.push('goto ' + e.message.slice(0, 80)));
  sc.dclMs = Date.now() - t0;
  await page.waitForFunction(() => !!(window.LLA_ECOMM && document.querySelector('#hero a, #mockBar a')), null, { timeout: 120000 }).catch(() => {}); sc.ctaReadyMs = Date.now() - t0;
  await page.waitForLoadState('load', { timeout: 180000 }).catch(() => {}); sc.loadMs = Date.now() - t0; await sleep(2500);
  sc.landState = await state(page); sc.layout = await layout(page); await shot(page, sc, 'land');
  sc.phase = 'enroll-click'; const tm = Date.now(); sc.modalOpened = await openModalFromHero(page, sc); sc.modalOpenMs = Date.now() - tm;
  sc.phase = 'step1-continue'; await fillStep1(page, { name: 'Sam Upfront', email: 'sam.upfront@lla-audit.dev', phone: '3125550178', country: 'United States', state: 'Illinois' });
  const t1 = Date.now(); await clickContinue(page);
  await page.waitForFunction(() => /start date/i.test((document.querySelector('#enrollModal') || {}).innerText || ''), null, { timeout: 45000 }).catch(() => {}); sc.step1ToStep2Ms = Date.now() - t1; await sleep(1200);
  sc.phase = 'step2'; await shot(page, sc, 'step2');
  const date = await vis(page, '#enrollModal button.dp-card'); if (date) { await date.click().catch(() => {}); await sleep(600); }
  const up = await vis(page, '#enrollModal [data-pl="upfront"], #enrollModal label:has-text("one payment"), #enrollModal button:has-text("one payment"), #enrollModal :text("Pay in full")');
  sc.upfrontOptionVisible = !!up; if (up) { await up.click().catch(() => {}); await sleep(700); await shot(page, sc, 'step2-upfront'); }
  sc.step2Text = await modalText(page);
  sc.phase = 'step2-continue'; const t2 = Date.now(); const cont = await vis(page, '#emGo2, #enrollModal button:has-text("Continue")');
  if (cont) { await cont.scrollIntoViewIfNeeded().catch(() => {}); await cont.click().catch(() => {}); }
  await page.waitForURL(/checkout/, { timeout: 60000 }).catch(() => sc.notes.push('no checkout navigation'));
  sc.step2ToCheckoutUrlMs = Date.now() - t2; sc.phase = 'checkout';
  await page.waitForFunction(() => { const m = document.getElementById('awx-dropin'); return m && (m.querySelector('iframe') || /disabled|error|could not|try again/i.test(m.innerText)); }, null, { timeout: 60000 }).catch(() => {});
  sc.step2ToMountAttemptMs = Date.now() - t2; await sleep(2000); await shot(page, sc, 'checkout');
  sc.checkoutState = await state(page); sc.checkoutText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 2000)).catch(() => null);
  sc.phase = 'callback-form'; await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.goto(SITE + '/#ask', { waitUntil: 'load', timeout: 90000 }).catch(() => {}); await sleep(3000);
  try {
    const form = page.locator('#ask form').first(); sc.callbackForm = { found: await form.count() > 0 };
    if (sc.callbackForm.found) {
      await form.scrollIntoViewIfNeeded().catch(() => {});
      for (const i of await form.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea').all()) {
        if (!(await i.isVisible().catch(() => false))) continue; const tp = (await i.getAttribute('type')) || ''; const nm = ((await i.getAttribute('name')) || (await i.getAttribute('id')) || (await i.getAttribute('placeholder')) || '').toLowerCase();
        await i.fill(tp === 'email' || /mail/.test(nm) ? 'sam.upfront@lla-audit.dev' : tp === 'tel' || /phone|mobile/.test(nm) ? '3125550178' : /last/.test(nm) ? 'Upfront' : /first|name/.test(nm) ? 'Sam' : 'Audit question, please ignore.').catch(() => {});
      }
      for (const s of await form.locator('select').all()) { if (await s.isVisible().catch(() => false)) { const v = await s.locator('option').evaluateAll(os => (os.find(o => o.value && !o.disabled) || {}).value); if (v) await s.selectOption(v).catch(() => {}); } }
      for (const c of await form.locator('input[type=checkbox]').all()) { if (await c.isVisible().catch(() => false)) await c.check().catch(() => {}); }
      await shot(page, sc, 'callback-filled');
      const btn = await vis(page, '#ask form button, #ask form [type=submit]'); if (btn) await btn.click().catch(() => {}); await sleep(3500);
      sc.callbackForm.after = await page.evaluate(() => ((document.querySelector('#ask') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 400)).catch(() => null); await shot(page, sc, 'callback-after');
    }
  } catch (e) { sc.notes.push('callback ' + e.message.slice(0, 100)); }
  sc.phase = 'end'; await sleep(2500); await ctx.close(); summarise(sc); save();
}

async function scenarioSmallPhoneCountry(wk) {
  const sc = report.scenarios.smallphone = { id: 'C-iphoneSE-country', device: 'iPhone SE (WebKit) 375x667, videos blocked' };
  const ctx = await wk.newContext({ ...devices['iPhone SE'], locale: 'en-US', timezoneId: 'America/Los_Angeles' });
  sc.blockVideo = true; await setup(ctx, sc); const page = await ctx.newPage(); watch(page, sc);
  sc.phase = 'land'; await page.goto(LAND.replace('AUDIT1105', 'AUDIT1105C'), { waitUntil: 'load', timeout: 120000 }).catch(() => {}); await sleep(4000);
  await shot(page, sc, 'land'); sc.layout = await layout(page);
  sc.phase = 'enroll-click'; sc.modalOpened = await openModalFromHero(page, sc); await shot(page, sc, 'step1');
  sc.continueVisibleWithoutScroll = await page.evaluate(() => { const b = [...document.querySelectorAll('#enrollModal button')].find(x => /continue/i.test(x.innerText) && x.getClientRects().length); if (!b) return null; const r = b.getBoundingClientRect(); return r.bottom <= innerHeight; }).catch(() => null);
  sc.phase = 'wrong-country'; sc.countryTests = {};
  for (const [label, o] of [['canadaWithUsNumber', { country: 'Canada', phone: BUYER.phone }], ['ukWithUsNumber', { country: 'United Kingdom', phone: BUYER.phone }], ['ukWithUkNumber', { country: 'United Kingdom', phone: '7700900123' }], ['israelWithUsNumber', { country: 'Israel', phone: BUYER.phone }]]) {
    await fillStep1(page, { name: BUYER.name, email: BUYER.email, phone: o.phone, country: o.country }); await clickContinue(page); await sleep(1500);
    const txt = await modalText(page) || ''; const adv = /start date/i.test(txt);
    const diag = await page.evaluate(() => ({ modalSelect: (document.getElementById('emCountry') || {}).value || null, readByCode: (window.LLA_COUNTRY && window.LLA_COUNTRY.selected) ? window.LLA_COUNTRY.selected() : 'LLA_COUNTRY missing', countrySelects: [...document.querySelectorAll('select[data-lla-country="1"]')].map(s => (s.id || '?') + '@' + ((s.closest('section[id],#enrollModal,form') || {}).id || 'nosection') + '=' + s.value), ccLabel: ((document.getElementById('emCcIso') || {}).innerText || '') + ' ' + ((document.getElementById('emCcDial') || {}).innerText || '') })).catch(e => ({ err: e.message }));
    sc.countryTests[label] = { advancedToStep2: adv, errors: await visibleErrors(page), diag }; await shot(page, sc, label);
    if (adv) { const back = await vis(page, '#enrollModal button:has-text("Back"), #enrollModal .em-back, #enrollModal [data-step="1"]'); if (back) { await back.click().catch(() => {}); await sleep(800); } else { const x = await vis(page, '#enrollModal .em-x'); if (x) await x.click().catch(() => {}); await sleep(600); await openModalFromHero(page, sc); } }
  }
  sc.phase = 'end'; await sleep(2000); await ctx.close(); summarise(sc); save();
}

async function scenarioDesktop(cr) {
  const sc = report.scenarios.desktop = { id: 'D-desktop-1440', device: 'Desktop Chromium 1440x900' };
  const ctx = await cr.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', timezoneId: 'America/New_York' });
  await setup(ctx, sc); const page = await ctx.newPage(); watch(page, sc);
  sc.phase = 'land'; await page.goto(LAND.replace('AUDIT1105', 'AUDIT1105D'), { waitUntil: 'load', timeout: 120000 }).catch(() => {}); await sleep(4000);
  sc.layout = await layout(page); await shot(page, sc, 'hero');
  const off = await page.$('#offer'); if (off) { await off.scrollIntoViewIfNeeded(); await sleep(800); await shot(page, sc, 'offer'); }
  sc.phase = 'enroll-click'; await page.evaluate(() => scrollTo(0, 0)); sc.modalOpened = await openModalFromHero(page, sc); await shot(page, sc, 'modal');
  sc.phase = 'end'; await sleep(1500); await ctx.close(); summarise(sc); save();
}

async function scenarioDirectCheckout(wk) {
  const sc = report.scenarios.directCheckout = { id: 'E-direct-checkout-links', device: 'iPhone 14 (WebKit)' };
  const ctx = await wk.newContext({ ...devices['iPhone 14'], locale: 'en-US' });
  await setup(ctx, sc); const page = await ctx.newPage(); watch(page, sc); sc.pages = [];
  for (const p of ['/checkout.html?stid=' + IDS.stid + '&orderid=' + IDS.orderid + '&plan=monthly&promo=on', '/blueprint/checkout.html?stid=' + IDS.stid + '&orderid=' + IDS.orderid + '&plan=upfront', '/checkout.html']) {
    sc.phase = 'direct ' + p.split('?')[0] + (p.includes('upfront') ? ' upfront' : p.includes('monthly') ? ' monthly' : ' no-ids');
    await page.goto(SITE + p, { waitUntil: 'load', timeout: 90000 }).catch(() => {}); await sleep(9000);
    await shot(page, sc, sc.phase.replace(/[^a-z0-9]+/gi, '-'));
    sc.pages.push({ path: p, text: await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 1500)).catch(() => null), state: await state(page) });
  }
  sc.phase = 'end'; await sleep(1500); await ctx.close(); summarise(sc); save();
}

async function scenarioSilenced(cr) {
  const sc = report.scenarios.silenced = { id: 'F-tester-flag', device: 'Chromium mobile, ?llatest=1' };
  const ctx = await cr.newContext({ ...devices['Pixel 7'] });
  await setup(ctx, sc); const page = await ctx.newPage(); watch(page, sc);
  sc.phase = 'land-llatest'; await page.goto(LAND.replace('AUDIT1105', 'AUDIT1105F') + '&llatest=1', { waitUntil: 'load', timeout: 120000 }).catch(() => {}); await sleep(6000);
  sc.landState = await state(page);
  sc.phase = 'end'; await ctx.close(); summarise(sc); save();
}

async function scenarioExtra(cr) {
  const sc = report.scenarios.extra = { id: 'G-iphone-ctas-form', device: 'iPhone 14 viewport, Chromium' };
  const ctx = await cr.newContext({ ...devices['iPhone 14'], locale: 'en-US', timezoneId: 'America/New_York' });
  await setup(ctx, sc); const page = await ctx.newPage(); watch(page, sc); sc.checks = {};
  sc.phase = 'land'; await page.goto(LAND.replace('AUDIT1105', 'AUDIT1105G'), { waitUntil: 'load', timeout: 120000 }).catch(() => {}); await sleep(4000);
  // 1 floating bar after scrolling into the page
  sc.phase = 'floating-bar';
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.35)); await sleep(1500);
  const barInfo = await page.evaluate(() => { const a = document.querySelector('#mockBar a'); if (!a) return null; const r = a.getBoundingClientRect(); const bar = document.getElementById('mockBar'); return { href: a.getAttribute('href'), text: a.innerText.trim(), inView: r.top >= 0 && r.bottom <= innerHeight, x: r.left + r.width / 2, y: r.top + r.height / 2, barVisible: bar ? getComputedStyle(bar).visibility + '/' + getComputedStyle(bar).opacity + '/' + getComputedStyle(bar).transform : null, topEl: (() => { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e ? (e.id || e.tagName) + '.' + String(e.className).slice(0, 30) : null; })() }; });
  sc.checks.floatingBar = { info: barInfo };
  await shot(page, sc, 'floating-bar-before');
  if (barInfo && barInfo.inView) { const y0 = await page.evaluate(() => scrollY); await page.mouse.click(barInfo.x, barInfo.y); await sleep(1500); sc.checks.floatingBar.opensModal = await modalOpen(page); sc.checks.floatingBar.scrolledTo = Math.round(await page.evaluate(() => scrollY)) - Math.round(y0); await shot(page, sc, 'floating-bar-after'); }
  if (await modalOpen(page)) { const x = await vis(page, '#enrollModal .em-x'); if (x) await x.click().catch(() => {}); await sleep(600); }
  // 2 offer card buttons
  sc.phase = 'offer-cta';
  const off = await page.$('#offer'); if (off) { await off.scrollIntoViewIfNeeded().catch(() => {}); await sleep(800); }
  sc.checks.offerButtons = await page.evaluate(() => [...document.querySelectorAll('#offer a, #offer button')].filter(e => e.getClientRects().length).map(e => ({ tag: e.tagName, id: e.id, text: (e.innerText || '').trim().slice(0, 50), href: e.getAttribute('href') || '' })));
  const ob = await vis(page, '#offer button:has-text("enroll"), #offer a:has-text("enroll"), #codeApply');
  if (ob) { await ob.scrollIntoViewIfNeeded().catch(() => {}); await shot(page, sc, 'offer-card'); await ob.click().catch(() => {}); await sleep(1800); sc.checks.offerCta = { text: (await ob.innerText().catch(() => '')).trim(), opensModal: await modalOpen(page), modalStep: (await modalText(page) || '').slice(0, 160), url: page.url().slice(0, 120) }; await shot(page, sc, 'offer-cta-after'); }
  if (await modalOpen(page)) { const x = await vis(page, '#enrollModal .em-x'); if (x) await x.click().catch(() => {}); await sleep(600); }
  // 3 callback form
  sc.phase = 'callback-form';
  const form = page.locator('#ask form').first();
  if (await form.count()) {
    await form.scrollIntoViewIfNeeded().catch(() => {}); await sleep(600);
    sc.checks.formFields = await form.evaluate(f => [...f.querySelectorAll('input,select,textarea,button')].map(e => ({ tag: e.tagName, type: e.type, id: e.id, name: e.name, req: e.required, ph: e.placeholder || '', visible: !!e.getClientRects().length })));
    const fill = async (sel, v) => { const e = await vis(page, '#ask ' + sel); if (e) { await e.fill(v).catch(() => {}); return true; } return false; };
    await fill('input[name*="first" i], input[id*="first" i]', 'Sam'); await fill('input[name*="last" i], input[id*="last" i]', 'Upfront');
    await fill('input[type=email]', 'sam.upfront@lla-audit.dev'); await fill('input[type=tel]', '3125550178'); await fill('textarea', 'Audit test question, please ignore.');
    for (const s of await page.locator('#ask form select').all()) { if (await s.isVisible().catch(() => false)) { const v = await s.locator('option').evaluateAll(os => (os.find(o => o.value && !o.disabled) || {}).value); const cur = await s.inputValue().catch(() => ''); if (!cur && v) await s.selectOption(v).catch(() => {}); } }
    for (const c of await page.locator('#ask form input[type=checkbox]').all()) { if (await c.isVisible().catch(() => false)) await c.check({ force: true }).catch(() => {}); }
    await shot(page, sc, 'callback-filled');
    const btn = await vis(page, '#ask form button[type=submit], #ask form button:has-text("Send"), #ask form [type=submit]');
    const before = sc.worker.length; if (btn) await btn.click().catch(() => {}); await sleep(4500);
    sc.checks.callback = { submitted: sc.worker.length > before, workerCalls: sc.worker.slice(before).map(w => w.method + ' ' + w.path), invalid: await page.evaluate(() => [...document.querySelectorAll('#ask form :invalid')].map(e => e.name || e.id)).catch(() => null), msg: await page.evaluate(() => ((document.querySelector('#ask form .form-error, #ask .form-success, #ask [role=alert], #ask .ok, #ask .success') || {}).innerText || '').slice(0, 200)).catch(() => null), after: await page.evaluate(() => ((document.querySelector('#ask') || {}).innerText || '').replace(/\s+/g, ' ').slice(-400)).catch(() => null) };
    await shot(page, sc, 'callback-after');
  }
  sc.phase = 'end'; await sleep(2500); await ctx.close(); summarise(sc); save();
}

(async () => {
  if (!process.env.AUDIT_SET) { try { await liveFiles(); } catch (e) { report.live.err = e.message; } }
  const cr = await chromium.launch(); const wk = process.env.SMOKE ? cr : await webkit.launch();
  const jobs = [['iphoneChrome', b => scenarioIphoneFull(b, 'iphoneChrome', 'A-iphone14-chromeEngine', { device: 'iPhone 14 viewport and UA, Chromium engine, videos on' }), cr],
    ['iphoneSafari', b => scenarioIphoneFull(b, 'iphoneSafari', 'A2-iphone14-webkit', { device: 'iPhone 14, WebKit (Safari engine), videos blocked to avoid a WebKit-on-Linux video crash', blockVideo: true, scroll: false }), wk],
    ['android', scenarioAndroidTimed, cr], ['smallphone', scenarioSmallPhoneCountry, wk], ['desktop', scenarioDesktop, cr], ['directCheckout', scenarioDirectCheckout, wk], ['silenced', scenarioSilenced, cr]];
  if (process.env.AUDIT_SET === '4') {
    await Promise.all([
      scenarioIphoneFull(cr, 'iphoneChrome', 'A-iphone14-chromeEngine', { device: 'iPhone 14, Chromium engine, videos on', paypalTab: true, backForward: false }).catch(e => { (report.scenarios.iphoneChrome = report.scenarios.iphoneChrome || {}).fatal = String(e).slice(0, 300); }),
      scenarioIphoneFull(wk, 'iphoneSafari', 'A2-iphone14-webkit', { device: 'iPhone 14, WebKit (Safari engine), videos blocked', blockVideo: true, scroll: false, paypalTab: true, backForward: false }).catch(e => { (report.scenarios.iphoneSafari = report.scenarios.iphoneSafari || {}).fatal = String(e).slice(0, 300); })
    ]);
    if (wk !== cr) await wk.close(); await cr.close(); report.finishedAt = new Date().toISOString(); save(); console.log('done set 4'); return;
  }
  const run = process.env.AUDIT_SET === '3' ? [['extra', scenarioExtra, cr], ['iphoneSafari', b => scenarioIphoneFull(b, 'iphoneSafari', 'A2-iphone14-webkit', { device: 'iPhone 14, WebKit (Safari engine), videos blocked', blockVideo: true, scroll: false, backForward: false }), wk]] : jobs;
  for (const [name, fn, br] of run) {
    try { await fn(br); } catch (e) { const s2 = (report.scenarios[name] = report.scenarios[name] || {}); s2.fatal = String(e).slice(0, 400); try { if (s2.relayRaw) summarise(s2); } catch (_) {} save(); }
  }
  if (wk !== cr) await wk.close(); await cr.close();
  report.finishedAt = new Date().toISOString(); save();
  console.log('done', Object.keys(report.scenarios).map(k => k + ':' + (report.scenarios[k].fatal ? 'FATAL' : 'ok')).join(' '));
})();
