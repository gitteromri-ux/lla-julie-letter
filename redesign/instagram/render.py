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
        h1=H.escape(parts[0]).replace(chr(10),' ')
        return f'<h1>{h1}</h1>'+''.join(f'<p class="lead">{E(x)}</p>' for x in parts[1:-1])+(f'<p class="meta">{E(parts[-1])}</p>' if len(parts)>1 else '')
    if style=='h2':
        return f'<h2>{E(parts[0])}</h2>'+''.join(f'<p class="lead">{E(x)}</p>' for x in parts[1:])
    if style=='cards':
        out=''
        for x in parts:
            if '\n' in x and not x.split('\n')[0][:2].isdigit() and '  ·  ' in x.split('\n')[0] and any(l[:2].isdigit() for l in x.split('\n')[1:]):
                head,*rows=x.split('\n'); out+=f'<div class="card"><b>{E(head)}</b><ol>'+''.join(f'<li>{E(r[4:])}</li>' for r in rows)+'</ol></div>'
            elif '\n' in x and '  ·  ' in x.split('\n')[0]:
                head,_,body=x.partition('\n')
                if True:
                    ttl,_,val=head.partition('  ·  '); out+=f'<div class="card"><span class="chip">{E(val)}</span><b>{E(ttl)}</b><p>{E(body)}</p></div>'
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
    if style=='price':
        out='<div class="price">'
        for x in parts:
            ls=x.split('\n')
            if ls[0].startswith('$') and len(ls)>1: out+=f'<span class="big">{E(ls[0])}</span><div>{E(chr(10).join(ls[1:]))}</div>'
            elif len(ls)>1 and len(ls[0])<40 and not ls[0].startswith('✓'): out+=f'<span class="ttl">{E(ls[0])}</span><div>{E(chr(10).join(ls[1:]))}</div>'
            else: out+=f'<div style="margin-top:12px">{E(x)}</div>'
        return out+'</div>'
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
    elif t=='Video': blocks.append(f'<div class="video"><img src="{data(p["poster"])}" alt="{H.escape(p["alt"])}"><span class="play"><svg viewBox="0 0 24 24" fill="#0A1C3F"><path d="M8 5v14l11-7z"/></svg></span><span class="vtag">{H.escape(p["alt"])}</span></div>')
    elif t=='Button': blocks.append(f'<a class="btn" href="{p["url"]}">{H.escape(p["label"])} →</a>')
    else: blocks.append('<div class="carousel">'+''.join(f'<figure><img src="{data(x["file"])}" alt=""><figcaption><b>{E(x["title"])}</b>{E(x["text"])}</figcaption></figure>' for x in p['items'])+'</div>')
blocks.append('</section>')
css='''
:root{--navy:#050F24;--ink:#0A1B36;--blue:#1170F7;--gold:#E9CB92}
*{box-sizing:border-box}
body{margin:0;background:#0E1526;font-family:Inter,-apple-system,sans-serif;color:#fff}
.phone{width:430px;max-width:100%;margin:28px auto;border-radius:44px;background:#000;padding:12px;box-shadow:0 0 0 2px #2a3148,0 60px 140px rgba(0,0,0,.8)}
.screen{border-radius:34px;overflow:hidden;background:var(--navy)}
@media (max-width:480px){.phone{margin:0;padding:0;border-radius:0;box-shadow:none}.screen{border-radius:0}}
.topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;padding:12px 18px;background:rgba(5,15,36,.9);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.1)}
.topbar img{height:58px;width:auto}
.ie{padding:0 0 40px}
.fold{padding:10px 0 34px}
.fold.light{background:linear-gradient(180deg,#FFFFFF 0%,#EEF4FF 100%);color:var(--ink)}
h1,h2{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:500;letter-spacing:-.02em;text-wrap:balance}
h1{font-size:42px;line-height:1.0;margin:24px 20px 14px}
h2{font-size:34px;line-height:1.04;margin:40px 20px 12px}
.fold.dark h2{color:#fff}
.fold.light h2{background:linear-gradient(100deg,#0A3C82,#0B6BF5 60%,#12A98C);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
p.lead{font-size:17px;line-height:1.55;margin:0 20px 14px;color:rgba(232,242,255,.88)}
.fold.light p.lead{color:#41526E}
p.meta{font-size:14px;font-weight:500;letter-spacing:.01em;color:#9FD0FF;margin:0 20px 16px;line-height:1.6}
.fold.light p.meta{color:#1E4FD8}
.btn{display:block;margin:14px 20px 22px;padding:18px;text-align:center;border-radius:14px;font-size:19px;font-weight:600;color:#fff;text-decoration:none;background:linear-gradient(180deg,#5AA0FF,#1170F7 42%,#0246C4);border:1px solid rgba(255,255,255,.34);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.55),0 16px 34px -12px rgba(17,112,247,.85)}
.ph{margin:0}.ph img,.video img{width:100%;display:block}
.ph figcaption{font-size:13px;color:rgba(255,255,255,.55);padding:8px 20px 0;line-height:1.4}.fold.light .ph figcaption{color:#5C6C86}
.video{position:relative}.video::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.55))}
.play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,.94);z-index:2;display:flex;align-items:center;justify-content:center}
.play svg{width:26px;height:26px;margin-left:4px}
.vtag{position:absolute;left:18px;right:18px;bottom:16px;z-index:2;font-size:15px;font-weight:600;line-height:1.3;text-shadow:0 1px 8px rgba(0,0,0,.6)}
.card{margin:0 20px 12px;padding:18px 18px 20px;border-radius:16px;background:linear-gradient(168deg,rgba(255,255,255,.10),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.14)}
.card b{display:block;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:500;font-size:22px;line-height:1.15;margin-bottom:8px;color:#fff}
.card p{margin:0;font-size:15.5px;line-height:1.5;color:rgba(226,238,255,.85)}
.card ol{margin:0;padding-left:20px;font-size:15px;line-height:1.55;color:rgba(226,238,255,.88)}
.fold.dark .card:nth-of-type(4n+1){border-left:5px solid #2F7BFF}.fold.dark .card:nth-of-type(4n+2){border-left:5px solid #12B58F}.fold.dark .card:nth-of-type(4n+3){border-left:5px solid #E0A03C}.fold.dark .card:nth-of-type(4n){border-left:5px solid #7A5CFF}
.fold.light .card{background:#fff;border:1px solid rgba(14,42,88,.12);box-shadow:0 2px 6px rgba(6,18,40,.06),0 18px 40px -22px rgba(6,18,40,.25)}
.fold.light .card b{color:var(--ink)}.fold.light .card p,.fold.light .card ol{color:#41526E}
.fold.light .card:nth-of-type(6n+1){border-left:5px solid #1E4FD8}.fold.light .card:nth-of-type(6n+2){border-left:5px solid #0C8A70}.fold.light .card:nth-of-type(6n+3){border-left:5px solid #5B45C7}.fold.light .card:nth-of-type(6n+4){border-left:5px solid #C2701C}.fold.light .card:nth-of-type(6n+5){border-left:5px solid #0E7FA8}.fold.light .card:nth-of-type(6n){border-left:5px solid #B3325E}
.chip{display:inline-block;font-size:12.5px;font-weight:600;letter-spacing:.01em;padding:5px 11px;border-radius:999px;background:#1E4FD8;color:#fff;margin-bottom:10px}
.fold.light .card:nth-of-type(6n+2) .chip{background:#0C8A70}.fold.light .card:nth-of-type(6n+3) .chip{background:#5B45C7}.fold.light .card:nth-of-type(6n+4) .chip{background:#C2701C}.fold.light .card:nth-of-type(6n+5) .chip{background:#0E7FA8}.fold.light .card:nth-of-type(6n) .chip{background:#B3325E}
.card.phase{border-left:0!important}.card.phase b{font-size:20px}
.card.phase:nth-of-type(1){border-top:6px solid #0B2A63}.card.phase:nth-of-type(2){border-top:6px solid #1E4FD8}.card.phase:nth-of-type(3){border-top:6px solid #0C8A70}.card.phase:nth-of-type(4){border-top:6px solid #5B45C7}
blockquote{margin:0 20px 12px;padding:20px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(176,169,255,.4);font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:18px;line-height:1.45}
cite{display:block;margin-top:12px;font:13px Inter,sans-serif;color:#B0CCF4}
.price{margin:14px 20px;padding:24px 22px;border-radius:20px;background:radial-gradient(400px 200px at 90% -10%,rgba(233,203,146,.25),transparent 60%),linear-gradient(172deg,#0C2148,#050F22);border:1px solid rgba(233,203,146,.45);font-size:16px;line-height:1.5;color:#fff}
.price .big{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:64px;line-height:1;color:var(--gold);display:block;margin:6px 0 4px}
.price .ttl{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:28px;line-height:1.1;display:block;margin-bottom:4px}
.carousel{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:6px 20px 12px;scrollbar-width:none}.carousel::-webkit-scrollbar{display:none}
.carousel figure{flex:0 0 80%;scroll-snap-align:center;margin:0;border-radius:16px;overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.14)}
.fold.light .carousel figure{border-color:rgba(14,42,88,.12);box-shadow:0 14px 30px -18px rgba(6,18,40,.35)}
.carousel img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}
.carousel figcaption{padding:14px 16px 18px;color:var(--ink);font-size:14.5px;line-height:1.45}
.carousel figcaption b{display:block;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:500;font-size:20px;margin-bottom:4px}
details{margin:0 20px 8px;border-bottom:1px solid rgba(255,255,255,.12);padding:12px 0}summary{font-size:17px;font-weight:600;cursor:pointer;list-style:none;color:var(--ink)}.fold.dark summary{color:#fff}
summary::after{content:"+";float:right;color:#1E4FD8;font-weight:400}details p{margin:10px 0 0;font-size:15.5px;line-height:1.55;color:#41526E}
.fold.light details{border-bottom-color:rgba(14,42,88,.14)}
.steps{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 20px 0}
.step{border-radius:16px;padding:16px 14px 18px;color:#fff;background:var(--sc);box-shadow:0 18px 36px -18px var(--sc)}
.step:nth-child(1){--sc:#1E4FD8}.step:nth-child(2){--sc:#0C8A70}.step:nth-child(3){--sc:#5B45C7}.step:nth-child(4){--sc:#C2701C}.step:nth-child(5){--sc:#B3325E;grid-column:1/-1}
.step b{display:inline-flex;width:36px;height:36px;align-items:center;justify-content:center;border-radius:10px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);font-weight:600;margin-bottom:8px;font-size:14px}
.step span{display:block;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:21px;line-height:1.1;margin-bottom:6px}.step p{margin:0;font-size:14.5px;line-height:1.45;color:rgba(255,255,255,.9)}
'''
page=f'''<meta charset="utf-8">
<title>LLA Instagram Instant Experience</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500;1,600&family=Inter:wght@400;500;600&display=swap">
<style>{css}</style>
<div class="phone"><div class="screen"><div class="topbar"><img src="{data('00-logo.png')}" alt="Longevity Life Academy"></div>
<div class="ie">
{chr(10).join(blocks)}
</div></div></div>'''
(HERE/'mock.html').write_text(page,encoding='utf-8')
print("build sheet lines:",len(L),"| mock MB:",round(len(page.encode())/1048576,1),"| components:",len(C))
