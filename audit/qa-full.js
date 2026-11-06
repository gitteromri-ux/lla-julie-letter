// Full QA of the deployed preview link (read only): every video, every text block, every button and link,
// on an iPhone (WebKit), a 320px Android (Chromium) and a desktop. Nothing is submitted: submit buttons are listed,
// not pressed, and the page's forms are neutered in the preview build. Tracking, relay and CRM hosts resolve to
// 0.0.0.0 on the runner (see the workflow), and the preview build carries no tracking code.
const { chromium, webkit, devices } = require('playwright');
const fs = require('fs'); const crypto = require('crypto');
const OUT = 'out-mf/qa'; fs.mkdirSync(OUT, { recursive: true });
const URL0 = process.env.QA_URL || 'https://gitteromri-ux.github.io/lla-blueprint-vip-preview/meta-final/';
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const TRACK = /facebook|google-analytics|googletagmanager|doubleclick|googleadservices|workers\.dev|vercel\.app|licdn|clarity|hotjar|tiktok/;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const rep = { url: URL0, fixtureSha: sha(fs.readFileSync('fixtures/preview.html', 'utf8')) };
  for (let i = 0; i < (process.env.QA_URL ? 0 : 20); i++) {
    try { rep.servedSha = sha(await (await fetch(URL0 + '?v=' + Date.now())).text()); } catch (e) { rep.servedSha = 'fetch failed'; }
    if (rep.servedSha === rep.fixtureSha) break; await wait(30000);
  }
  rep.sameAsBuild = rep.servedSha === rep.fixtureSha;
  const external = new Set();
  const devs = [
    ['iphone', process.env.QA_NO_WEBKIT ? chromium : webkit, { ...devices['iPhone 14'] }],
    ['android320', chromium, { viewport: { width: 320, height: 693 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
    ['desktop', chromium, { viewport: { width: 1440, height: 900 } }],
  ];
  await Promise.all(devs.filter(d => !process.env.QA_DEVICES || process.env.QA_DEVICES.split(',').includes(d[0])).map(async ([name, bt, o]) => {
    const rec = { errors: [], videos: [], text: {}, controls: [], skipped: [] };
    const b = await bt.launch(); const ctx = await b.newContext(o); const p = await ctx.newPage();
    p.on('pageerror', e => rec.errors.push(String(e).slice(0, 160)));
    try {
      await p.goto(URL0 + (URL0.startsWith('file:') ? '' : '?v=' + Date.now()), { waitUntil: 'load', timeout: 90000 });
      await p.waitForTimeout(4000);
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += 450) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(110); }
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(800);

      // ---------- videos ----------
      const nv = await p.evaluate(() => document.querySelectorAll('video').length);
      for (let i = 0; i < nv; i++) {
        const v = {};
        try {
          await p.evaluate(i => document.querySelectorAll('video')[i].scrollIntoView({ block: 'center', inline: 'center' }), i);
          await p.waitForTimeout(1200);
          Object.assign(v, await p.evaluate(i => { const e = document.querySelectorAll('video')[i]; const s = e.closest('section,footer,header,nav'); const r = e.getBoundingClientRect();
            return { fold: s ? (s.id || s.className.split(' ')[0]) : '?', src: (e.currentSrc || e.src || (e.querySelector('source') || {}).src || '').split('/').pop().slice(0, 50), autoplay: e.autoplay, controls: e.controls, shown: Math.round(r.width) + 'x' + Math.round(r.height), readyState: e.readyState, error: e.error ? e.error.code : 0, t0: e.currentTime, paused: e.paused }; }, i));
          await p.waitForTimeout(900);
          v.t1 = await p.evaluate(i => document.querySelectorAll('video')[i].currentTime, i);
          v.playing = (v.t1 !== v.t0) || (!v.paused && v.readyState >= 2);
          if (!v.playing) {
            v.tryPlay = await p.evaluate(async i => { const e = document.querySelectorAll('video')[i]; e.muted = true; try { await e.play(); } catch (err) { return 'play() failed: ' + String(err).slice(0, 80); } const a = e.currentTime; await new Promise(r => setTimeout(r, 1800)); return e.currentTime > a ? 'plays after a tap' : 'no progress after play()'; }, i);
          }
        } catch (e) { v.err = String(e).slice(0, 120); }
        rec.videos.push(v);
      }
      await p.evaluate(() => scrollTo(0, 0));

      // ---------- text ----------
      rec.text = await p.evaluate(() => {
        const vw = innerWidth, out = { overflowX: document.documentElement.scrollWidth - vw, offScreen: [], clipped: [], outsideBox: [], tiny: [] };
        const fold = e => { const s = e.closest('section,footer,nav,header'); return s ? (s.id || s.className.split(' ')[0]) : '?'; };
        const hidden = e => e.closest('[aria-hidden="true"],script,style,noscript') || getComputedStyle(e).visibility === 'hidden';
        const inScroller = e => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const c = getComputedStyle(x); if (/(auto|scroll|hidden|clip)/.test(c.overflowX) && x.scrollWidth > x.clientWidth + 2) { const xr = x.getBoundingClientRect(); if (xr.left >= -1 && xr.right <= innerWidth + 1) return true; } if (/track|slider|scroller|marquee|carousel/.test(String(x.className))) return true; } return false; };
        const tag = e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ').filter(Boolean).slice(0, 2).join('.');
        for (const e of document.querySelectorAll('body *')) {
          const own = [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
          if (!own || hidden(e)) continue;
          const cs = getComputedStyle(e); if (cs.display === 'none' || +cs.opacity === 0) continue;
          const r = e.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) continue;
          if ((r.right > vw + 1 || r.left < -1) && !inScroller(e) && cs.position !== 'fixed') out.offScreen.push(fold(e) + ' ' + tag(e) + ' "' + own.slice(0, 30) + '"');
          if (e.scrollWidth > e.clientWidth + 2 && /hidden|clip/.test(cs.overflowX) && e.clientWidth > 4) out.clipped.push(fold(e) + ' ' + tag(e) + ' "' + own.slice(0, 30) + '"');
          if (parseFloat(cs.fontSize) < 11) out.tiny.push(fold(e) + ' ' + tag(e) + ' ' + cs.fontSize + ' "' + own.slice(0, 20) + '"');
        }
        for (const box of document.querySelectorAll('a, button, [class*="card"], [class*="btn"], [class*="tile"], .mfp-t, .curriculum-tab')) {
          if (hidden(box)) continue; const br = box.getBoundingClientRect(); if (br.width <= 4 || br.height <= 4) continue;
          const cs = getComputedStyle(box); if (cs.display === 'none') continue;
          const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n;
          while ((n = w.nextNode())) {
            if (!n.textContent.trim() || hidden(n.parentElement) || getComputedStyle(n.parentElement).position === 'absolute') continue;
            const rg = document.createRange(); rg.selectNodeContents(n);
            for (const t of rg.getClientRects()) { if (t.width < 1) continue; if (t.right > br.right + 3 || t.left < br.left - 3 || t.bottom > br.bottom + 3) { out.outsideBox.push(fold(box) + ' ' + tag(box) + ' "' + n.textContent.trim().slice(0, 30) + '"'); break; } }
          }
        }
        for (const k of ['offScreen', 'clipped', 'outsideBox', 'tiny']) out[k] = [...new Set(out[k])];
        return out;
      });

      await p.addStyleTag({ content: 'html,body{scroll-behavior:auto!important}' });
      // ---------- buttons and links ----------
      const ctrls = await p.evaluate(() => {
        const list = []; const seen = new Set();
        const els = document.querySelectorAll('a[href], button, [role="tab"], [onclick]');
        els.forEach((e, i) => {
          if (e.closest('[aria-hidden="true"]')) return;
          const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
          const visible = r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]');
          const label = (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
          const key = e.tagName + '|' + (e.getAttribute('href') || '') + '|' + label + '|' + String(e.className).slice(0, 30);
          if (seen.has(key) && !/curriculum|faq|tab|hex|sess/.test(String(e.className))) return; seen.add(key);
          e.setAttribute('data-qa', i);
          const s = e.closest('section,footer,nav,header,#llaFloatCta,#et-bumpyard-widget,.mobile-nav');
          list.push({ i, tag: e.tagName.toLowerCase(), cls: String(e.className).split(' ').filter(Boolean).slice(0, 2).join('.'), label, href: e.getAttribute('href') || '', type: e.getAttribute('type') || '', fold: s ? (s.id || String(s.className).split(' ')[0]) : '?', visible });
        });
        return list;
      });
      ctrls.sort((a, b) => (/menu|nav-toggle|hamburger/i.test(a.cls + a.label) ? 1 : 0) - (/menu|nav-toggle|hamburger/i.test(b.cls + b.label) ? 1 : 0));
      for (const c of ctrls) {
        if (!c.visible) { rec.skipped.push(c.fold + ' ' + c.tag + '.' + c.cls + ' "' + c.label + '" (not on screen at this size)'); continue; }
        if (c.type === 'submit') { rec.skipped.push(c.fold + ' "' + c.label + '" (form submit, not pressed)'); continue; }
        const res = { fold: c.fold, what: c.tag + (c.cls ? '.' + c.cls : ''), label: c.label, href: c.href };
        try {
          await p.evaluate(i => { const e = document.querySelector(`[data-qa="${i}"]`); e.scrollIntoView({ block: 'center', inline: 'center' }); }, c.i);
          await p.waitForTimeout(120);
          const hit = await p.evaluate(i => { const e = document.querySelector(`[data-qa="${i}"]`); const r = e.getBoundingClientRect(); const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1); const t = document.elementFromPoint(x, y); if (!t) return 'nothing at point'; if (e.contains(t) || t.contains(e)) return 'ok'; const cov = t.closest('[id],[class]'); return 'covered by ' + (cov ? (cov.id || String(cov.className).split(' ')[0]) : t.tagName); }, c.i);
          res.tappable = hit;
          if (c.tag === 'a' && c.href && !c.href.startsWith('#')) {
            if (/^https?:/.test(c.href) && !TRACK.test(c.href)) external.add(c.href.split('#')[0]);
            res.result = /^(https?:|mailto:|tel:)/.test(c.href) ? 'link to ' + c.href.slice(0, 70) + ' (checked below)' : 'link to ' + c.href.slice(0, 70);
          } else if (c.href.startsWith('#') && c.href.length > 1) {
            const target = await p.evaluate(h => !!document.querySelector(h), c.href).catch(() => false);
            if (!target) { res.result = 'BROKEN: no ' + c.href + ' on the page'; }
            else {
              await p.evaluate(i => document.querySelector(`[data-qa="${i}"]`).click(), c.i); await p.waitForTimeout(800);
              const top = await p.evaluate(h => Math.round(document.querySelector(h).getBoundingClientRect().top), c.href);
              res.result = (top > -40 && top < 260) ? 'jumps to ' + c.href : 'clicked, ' + c.href + ' ends ' + top + 'px from the top';
            }
          } else {
            const changed = await p.evaluate(async i => { const e = document.querySelector(`[data-qa="${i}"]`); let n = 0; const mo = new MutationObserver(m => { n += m.length; }); mo.observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true }); const y0 = scrollY; const sx = [...document.querySelectorAll('*')].filter(x => x.scrollWidth > x.clientWidth + 2).map(x => x.scrollLeft); e.click(); await new Promise(r => setTimeout(r, 450)); mo.disconnect(); const sx2 = [...document.querySelectorAll('*')].filter(x => x.scrollWidth > x.clientWidth + 2).map(x => x.scrollLeft); return n > 0 || scrollY !== y0 || JSON.stringify(sx) !== JSON.stringify(sx2); }, c.i);
            res.result = changed ? 'responds' : 'NO RESPONSE';
            if (/nav-toggle|hamburger|menu/i.test(c.cls + c.label)) { await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => { const x = document.querySelector('.mobile-nav-close, [aria-label*="lose" i][class*="nav"]'); if (x) x.click(); document.body.classList.remove('menu-open', 'nav-open'); }); await p.waitForTimeout(300); }
          }
        } catch (e) { res.result = 'error ' + String(e).slice(0, 80); }
        rec.controls.push(res);
      }
      const bad = rec.controls.filter(x => /BROKEN|NO RESPONSE|error/.test(x.result) || (x.tappable && x.tappable !== 'ok'));
      rec.summary = { controlsTested: rec.controls.length, problems: bad.length, skipped: rec.skipped.length, videos: rec.videos.length, videosPlaying: rec.videos.filter(v => v.playing || /plays after/.test(v.tryPlay || '')).length, offScreen: rec.text.offScreen.length, clipped: rec.text.clipped.length, outsideBox: rec.text.outsideBox.length, tiny: rec.text.tiny.length };
      rec.problems = bad;
    } catch (e) { rec.errors.push('run ' + String(e).slice(0, 160)); }
    rep[name] = rec;
    fs.writeFileSync(`${OUT}/report-${name}.json`, JSON.stringify(rec, null, 1));
    await b.close();
  }));
  rep.outsideLinks = {};
  for (const u of external) {
    try { const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (LLA QA)' } }); rep.outsideLinks[u] = r.status; }
    catch (e) { rep.outsideLinks[u] = 'failed ' + String(e).slice(0, 60); }
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify({ sameAsBuild: rep.sameAsBuild, iphone: rep.iphone && rep.iphone.summary, android320: rep.android320 && rep.android320.summary, desktop: rep.desktop && rep.desktop.summary, outsideLinks: rep.outsideLinks }, null, 1));
})();
