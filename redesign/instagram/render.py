#!/usr/bin/env python3
"""Render BUILD-SHEET.md and mock.html from components.json (verbatim site copy)."""
import json, base64, pathlib, html as H
from collections import Counter
HERE=pathlib.Path(__file__).parent; A=HERE/'assets'
C=[tuple(x) for x in json.load(open(HERE/'components.json'))]
CHK=next(p['url'] for t,p in C if t=='Button')
n=Counter(t for t,_ in C)
L=["# Longevity Life Academy · Instagram Instant Experience — build sheet","",
"Meta Ads Manager → Create ad → Destination **Instant Experience** → **Custom**. Add the components below **in this order**. Every string is verbatim from the landing page. Asset files are in `instagram/assets/`.","",
f"**{len(C)} components** · Text {n['Text']} · Photo {n['Photo']} · Video {n['Video']} · Carousel {n['Carousel']} · Button {n['Button']}. Under the 40-block ceiling.","",
f"Every Button opens the checkout **inside** the Instant Experience browser (in-app, no leaving Instagram): `{CHK}`","",
"| # | Component | Content | Asset / setting |","|---|---|---|---|"]
br=lambda s:H.escape(s).replace('\n','<br>')
for i,(t,p) in enumerate(C,1):
    if t=='Text': L.append(f"| {i} | Text | {br(p['text'])} | {len(p['text'])} chars |")
    elif t=='Photo': L.append(f"| {i} | Photo | {H.escape(p['alt'])} | `{p['file']}` · fit to width |")
    elif t=='Video': L.append(f"| {i} | Video | {H.escape(p['alt'])} | `{p['file']}` · poster `{p['poster']}` · autoplay muted, tap for sound |")
    elif t=='Button': L.append(f"| {i} | Button | **{p['label']}** | opens `{p['url']}` in-app |")
    else: L.append(f"| {i} | Carousel · {len(p['items'])} cards | "+' <br>— '.join(f"**{br(x['title'])}** {H.escape(x['text']).replace(chr(10),' ')} (`{x['file']}`)" for x in p['items'])+" | one card per file, square crop |")
L+=["","## The ad that opens it","","- Placements: Instagram Feed, Reels, Stories. Single video.",
"- Creative: `00-header-julie-v2.mp4` (the Julie film from the landing page), poster `00-header-julie-poster.jpg`.",
"- Headline: 18 Weeks to Your Own Longevity Protocol.","- Primary text: the hero standfirst (component 2).","- CTA: **Learn more** → this Instant Experience.","",
"## Verify in Ads Manager before publishing","",
"I could not reach Meta's documentation from this session, so confirm the live limits on the day: the per-text-block character cap (longest block here is "+str(max(len(p['text']) for t,p in C if t=='Text'))+" chars; split at a blank line if rejected), the carousel card cap (historically 10; the largest here is 6), and total components (37 here).",
"Video under 2 minutes each. Whitelist the checkout domain on the ad account for in-app open. The landing page's GTM does not fire inside an Instant Experience, so put the Meta Pixel / Conversions API on `checkout.html` for purchase attribution.",""]
(HERE/'BUILD-SHEET.md').write_text('\n'.join(L),encoding='utf-8')
def data(f):
    p=A/f; return f"data:{'image/png' if p.suffix=='.png' else 'image/jpeg'};base64,"+base64.b64encode(p.read_bytes()).decode()
E=lambda s:H.escape(s).replace('\n','<br>')
def para(text,style):
    parts=text.split('\n\n')
    if style=='hero':
        return f'<h1>{E(parts[0])}</h1>'+''.join(f'<p class="lead">{E(x)}</p>' for x in parts[1:-1])+(f'<p class="meta">{E(parts[-1])}</p>' if len(parts)>1 else '')
    if style=='h2':
        return f'<h2>{E(parts[0])}</h2>'+''.join(f'<p class="lead">{E(x)}</p>' for x in parts[1:])
    if style=='cards':
        out=''
        for x in parts:
            if '\n' in x and not x.split('\n')[0][:2].isdigit() and '  ·  ' in x.split('\n')[0] and any(l[:2].isdigit() for l in x.split('\n')[1:]):
                head,*rows=x.split('\n'); out+=f'<div class="card"><b>{E(head)}</b><ol>'+''.join(f'<li>{E(r[4:])}</li>' for r in rows)+'</ol></div>'
            elif x[:2].strip().isdigit() and '\n' in x:
                head,_,body=x.partition('\n'); out+=f'<div class="card"><b>{E(head)}</b><p>{E(body)}</p></div>'
            elif '\n' in x:
                head,_,body=x.partition('\n'); out+=f'<div class="card"><b>{E(head)}</b><p>{E(body)}</p></div>'
            else: out+=f'<h2>{E(x)}</h2>' if len(x)<60 else f'<p class="lead">{E(x)}</p>'
        return out
    if style=='phases':
        out=''
        for k,x in enumerate(parts):
            head,*rows=x.split('\n'); out+=f'<div class="card phase"><b>{E(head)}</b><ol>'+''.join(f'<li>{E(r[4:])}</li>' for r in rows)+'</ol></div>'
        return out
    if style=='steps':
        out=f'<h2>{E(parts[0])}</h2><p class="lead">{E(parts[1])}</p><div class="steps">'
        for x in parts[2:]:
            head,_,body=x.partition('\n'); n,_,ttl=head.partition('  '); out+=f'<div class="step"><b>{E(n)}</b><span>{E(ttl)}</span><p>{E(body)}</p></div>'
        return out+'</div>'
    if style=='quotes':
        return f'<h2>{E(parts[0])}</h2>'+''.join((lambda a,b:f'<blockquote>{E(a)}<cite>{E(b)}</cite></blockquote>')(*x.rpartition('\n')[::2]) for x in parts[1:])
    if style=='price': return '<div class="price">'+'<br><br>'.join(E(x) for x in parts)+'</div>'
    if style=='faq':
        out=''
        for x in parts:
            if '\n' in x: a,_,b=x.partition('\n'); out+=f'<details><summary>{E(a)}</summary><p>{E(b)}</p></details>'
            else: out+=f'<h2>{E(x)}</h2>'
        return out
    return ''.join(f'<p class="lead">{E(x)}</p>' for x in parts)
blocks=[]; cur=None
for t,p in C:
    fold=p.get('fold','dark')
    if fold!=cur:
        if cur is not None: blocks.append('</section>')
        blocks.append(f'<section class="fold {fold}">'); cur=fold
    if t=='Text': blocks.append(para(p['text'],p['style']))
    elif t=='Photo': blocks.append(f'<figure class="ph"><img src="{data(p["file"])}" alt="{H.escape(p["alt"])}"><figcaption>{H.escape(p["alt"])}</figcaption></figure>')
    elif t=='Video': blocks.append(f'<div class="video"><img src="{data(p["poster"])}" alt="{H.escape(p["alt"])}"><span class="play">▶</span><span class="vtag">{H.escape(p["alt"])}</span></div>')
    elif t=='Button': blocks.append(f'<a class="btn" href="{p["url"]}">{H.escape(p["label"])} →</a>')
    else: blocks.append('<div class="carousel">'+''.join(f'<figure><img src="{data(x["file"])}" alt=""><figcaption><b>{E(x["title"])}</b>{E(x["text"])}</figcaption></figure>' for x in p['items'])+'</div>')
blocks.append('</section>')
css='''
:root{--navy:#050F24;--blue:#1170F7;--gold:#E9CB92}
body{margin:0;background:#0B0F19;font-family:'Playfair Display',Georgia,serif;font-style:italic;color:#fff}
.stage{max-width:430px;margin:0 auto;background:var(--navy);min-height:100vh;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 40px 120px rgba(0,0,0,.7)}
.topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(5,15,36,.88);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.1);font:13px Inter,sans-serif}
.topbar img{height:34px}.topbar span{margin-left:auto;opacity:.7}
.ie{padding:0 0 60px}
.ph{margin:0}.ph img,.video img{width:100%;display:block}.ph figcaption{font:12px Inter,sans-serif;color:rgba(255,255,255,.55);padding:8px 18px 0}
.video{position:relative}.play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.92);color:#0A1C3F;display:flex;align-items:center;justify-content:center;font:28px Inter,sans-serif}
.vtag{position:absolute;left:12px;bottom:12px;font:12px Inter,sans-serif;background:rgba(0,0,0,.6);padding:5px 9px;border-radius:8px}
h1{font-weight:500;font-size:46px;line-height:.98;letter-spacing:-.02em;margin:26px 18px 14px}
h2{font-weight:500;font-size:36px;line-height:1.02;letter-spacing:-.02em;margin:46px 18px 12px;background:linear-gradient(100deg,#fff,#A9CCFF 60%,#7BEBD6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
p.lead{font-size:19px;line-height:1.5;margin:0 18px 14px;color:rgba(232,242,255,.9)}
p.meta{font:14px Inter,sans-serif;letter-spacing:.02em;color:#9FD0FF;margin:0 18px 16px}
.btn{display:block;margin:12px 18px 24px;padding:19px;text-align:center;border-radius:16px;font-size:23px;font-weight:600;color:#fff;text-decoration:none;background:linear-gradient(180deg,#5AA0FF,#1170F7 42%,#0246C4);border:1px solid rgba(255,255,255,.34);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.6),0 18px 40px -12px rgba(17,112,247,.9)}
.card{margin:0 18px 12px;padding:18px;border-radius:18px;background:linear-gradient(168deg,rgba(255,255,255,.10),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.14)}
.card b{display:block;font-weight:500;font-size:22px;line-height:1.15;margin-bottom:8px}.card p{margin:0;font-size:16.5px;line-height:1.5;color:rgba(226,238,255,.82)}
.card ol{margin:0;padding-left:22px;font-size:16px;line-height:1.55;color:rgba(226,238,255,.86)}
.card:nth-of-type(6n+1){border-color:rgba(31,192,140,.55)}.card:nth-of-type(6n+2){border-color:rgba(91,123,255,.55)}.card:nth-of-type(6n+3){border-color:rgba(240,169,74,.55)}.card:nth-of-type(6n+4){border-color:rgba(140,107,255,.55)}.card:nth-of-type(6n+5){border-color:rgba(55,201,232,.55)}.card:nth-of-type(6n){border-color:rgba(255,126,157,.55)}
blockquote{margin:0 18px 12px;padding:20px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(176,169,255,.4);font-size:19px;line-height:1.45}cite{display:block;margin-top:12px;font:13px Inter,sans-serif;color:#B0CCF4}
.price{margin:14px 18px;padding:24px 20px;border-radius:22px;background:radial-gradient(400px 200px at 90% -10%,rgba(233,203,146,.25),transparent 60%),linear-gradient(172deg,#0C2148,#050F22);border:1px solid rgba(233,203,146,.45);font-size:19px;line-height:1.4}
.carousel{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:6px 18px 12px;scrollbar-width:none}.carousel::-webkit-scrollbar{display:none}
.carousel figure{flex:0 0 78%;scroll-snap-align:center;margin:0;border-radius:18px;overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.14)}
.carousel img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.carousel figcaption{padding:14px 16px 18px;color:#0A1C3F;font-size:15px;line-height:1.4}.carousel figcaption b{display:block;font-size:19px;font-weight:500;margin-bottom:4px}
details{margin:0 18px 10px;border-bottom:1px solid rgba(255,255,255,.12);padding:12px 0}summary{font-size:19px;cursor:pointer;list-style:none}summary::after{content:"+";float:right;color:#9FD0FF}details p{margin:10px 0 0;font-size:16.5px;line-height:1.5}

.fold{padding:6px 0 26px}
.fold.light{background:linear-gradient(180deg,#FFFFFF 0%,#EEF4FF 100%);color:#08152C}
.fold.light h2{background:linear-gradient(100deg,#0A3C82,#0B6BF5 55%,#12A98C);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.fold.light p.lead{color:#41526E}.fold.light p.meta{color:#1E4FD8}.fold.light .ph figcaption{color:#5C6C86}
.fold.light .card{background:#fff;border:1px solid rgba(14,42,88,.12);box-shadow:0 2px 6px rgba(6,18,40,.06),0 18px 40px -22px rgba(6,18,40,.25)}
.fold.light .card b{color:#0A1B36}.fold.light .card p,.fold.light .card ol{color:#41526E}
.fold.light details{border-bottom-color:rgba(14,42,88,.14)}.fold.light summary{color:#0A1B36}.fold.light details p{color:#41526E}.fold.light summary::after{color:#1E4FD8}
.fold.light .price{color:#fff}
.fold.light .carousel figure{border-color:rgba(14,42,88,.12);box-shadow:0 14px 30px -18px rgba(6,18,40,.35)}
.fold.dark .card.phase{background:rgba(255,255,255,.06)}
.card.phase:nth-of-type(1){border-top:6px solid #0B2A63}.card.phase:nth-of-type(2){border-top:6px solid #1E4FD8}.card.phase:nth-of-type(3){border-top:6px solid #0C8A70}.card.phase:nth-of-type(4){border-top:6px solid #5B45C7}
.card.phase b{font-size:20px}
.steps{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 18px 0}
.step{border-radius:18px;padding:16px 14px 18px;color:#fff;background:var(--sc);box-shadow:0 18px 36px -18px var(--sc)}
.step:nth-child(1){--sc:#1E4FD8}.step:nth-child(2){--sc:#0C8A70}.step:nth-child(3){--sc:#5B45C7}.step:nth-child(4){--sc:#C2701C}.step:nth-child(5){--sc:#B3325E;grid-column:1/-1}
.step b{display:inline-flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:11px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);font-weight:500;margin-bottom:8px}
.step span{display:block;font-size:20px;line-height:1.1;margin-bottom:6px}.step p{margin:0;font-size:15px;line-height:1.45;color:rgba(255,255,255,.88)}
.foot{margin:28px 18px 0;font:12px Inter,sans-serif;color:rgba(255,255,255,.45);text-align:center}
'''
page=f'''<meta charset="utf-8">
<title>LLA Instagram Instant Experience</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500;1,600&family=Inter:wght@400;500;600&display=swap">
<style>{css}</style>
<div class="stage"><div class="topbar"><img src="{data('00-logo.png')}" alt="Longevity Life Academy"><span>Instant Experience · {len(C)} components</span></div>
<div class="ie">
{chr(10).join(blocks)}
<p class="foot">Mock of the Instagram Instant Experience. Every word is verbatim from the landing page. Build order and assets: instagram/BUILD-SHEET.md</p>
</div></div>'''
(HERE/'mock.html').write_text(page,encoding='utf-8')
print("build sheet lines:",len(L),"| mock MB:",round(len(page.encode())/1048576,1),"| components:",len(C))
