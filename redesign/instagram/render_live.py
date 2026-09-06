#!/usr/bin/env python3
"""Live Instagram mock: feed with the sponsored Julie video ad -> tap Learn more -> Instant Experience, rendered the way Meta renders one."""
import json, base64, pathlib, html as H
HERE=pathlib.Path(__file__).parent; A=HERE/'assets'
C=[tuple(x) for x in json.load(open(HERE/'components.json'))]
d=json.load(open(HERE.parent/'instagram-copy.json'))
CHK=next(p['url'] for t,p in C if t=='Button')
def data(f):
    p=A/f; return f"data:{'image/png' if p.suffix=='.png' else 'image/jpeg'};base64,"+base64.b64encode(p.read_bytes()).decode()
E=lambda s:H.escape(s).replace('\n','<br>')
# ---- Instant Experience body, IE component model: text (size S/M/L, bold, colour, bg), photo, video, button, carousel (images only) ----
ie=[]; cur=None
def open_fold(f):
    global cur
    if f!=cur:
        if cur: ie.append('</div>')
        ie.append(f'<div class="f {f}">'); cur=f
for t,p in C:
    open_fold(p.get('fold','dark'))
    if t=='Text':
        parts=p['text'].split('\n\n'); st=p['style']
        if st in('hero',): ie.append(f'<div class="tx L b">{H.escape(parts[0]).replace(chr(10)," ")}</div>'+''.join(f'<div class="tx M">{E(x)}</div>' for x in parts[1:-1])+(f'<div class="tx S dim">{E(parts[-1])}</div>' if len(parts)>1 else ''))
        elif st=='h2': ie.append(f'<div class="tx L b">{E(parts[0])}</div>'+''.join(f'<div class="tx M">{E(x)}</div>' for x in parts[1:]))
        elif st=='meta': ie.append(f'<div class="tx S dim">{E(p["text"])}</div>')
        elif st=='price':
            ie.append('<div class="tx M gold">'+'<br><br>'.join(E(x) for x in parts)+'</div>')
        else:
            out=''
            for x in parts:
                if '\n' in x:
                    a,_,b=x.partition('\n'); out+=f'<div class="tx M"><b>{E(a)}</b><br>{E(b)}</div>'
                else: out+=f'<div class="tx L b">{E(x)}</div>' if len(x)<60 else f'<div class="tx M">{E(x)}</div>'
            ie.append(out)
    elif t=='Photo': ie.append(f'<img class="ph" src="{data(p["file"])}" alt="">')
    elif t=='Video': ie.append(f'<div class="vid"><img src="{data(p["poster"])}" alt=""><span class="pl"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span class="mute">🔇</span></div>')
    elif t=='Button': ie.append(f'<a class="ieb" href="{p["url"]}">{H.escape(p["label"])}</a>')
    else:
        ie.append('<div class="car">'+''.join(f'<img src="{data(x["file"])}" alt="">' for x in p['items'])+'</div><div class="dots">'+''.join('<i></i>' for _ in p['items'])+'</div>')
        ie.append('<div class="tx S">'+'<br>'.join(f'<b>{E(x["title"])}</b> {H.escape(x["text"]).replace(chr(10)," ")}' for x in p['items'])+'</div>')
ie.append('</div>')
h=d['hero']; poster=data('00-header-julie-poster.jpg'); avatar=data('00-logo.png')
page=f'''<meta charset="utf-8"><title>LLA on Instagram</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#0b0b0f;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}}
.wrap{{display:flex;gap:56px;justify-content:center;align-items:flex-start;padding:36px 20px}}
.phone{{width:390px;flex:0 0 390px;height:844px;border-radius:52px;background:#000;padding:11px;box-shadow:0 0 0 3px #1c1c22,0 50px 120px rgba(0,0,0,.85);position:relative}}
.scr{{border-radius:42px;overflow:hidden;height:100%;background:#fff;position:relative;display:flex;flex-direction:column}}
.notch{{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:120px;height:34px;background:#000;border-radius:0 0 22px 22px;z-index:9}}
.sb{{height:54px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 30px 8px;font-size:15px;font-weight:600;color:#000}}
.scroll{{flex:1;overflow-y:auto;scrollbar-width:none}}.scroll::-webkit-scrollbar{{display:none}}
/* feed */
.ighead{{display:flex;align-items:center;justify-content:space-between;padding:6px 16px 10px}}
.igword{{font-family:"Billabong","Brush Script MT",cursive;font-size:30px;color:#000}}
.icons{{display:flex;gap:22px;font-size:22px}}
.stories{{display:flex;gap:14px;padding:4px 14px 12px;overflow:hidden}}
.story{{flex:0 0 66px;text-align:center;font-size:11px;color:#262626}}
.story i{{display:block;width:62px;height:62px;border-radius:50%;margin:0 auto 4px;padding:3px;background:linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)}}
.story i span{{display:block;width:100%;height:100%;border-radius:50%;background:#ddd url({avatar}) center/70% no-repeat;border:2px solid #fff}}
.post{{border-top:1px solid #efefef}}
.ph2{{display:flex;align-items:center;gap:10px;padding:10px 12px}}
.av{{width:34px;height:34px;border-radius:50%;background:#fff url({avatar}) center/88% no-repeat;border:1px solid #ddd}}
.nm{{font-size:14px;font-weight:600;color:#262626;line-height:1.2}}.nm small{{display:block;font-weight:400;font-size:12px;color:#737373}}
.dots3{{margin-left:auto;color:#262626;font-size:20px;letter-spacing:1px}}
.media{{position:relative;background:#000;aspect-ratio:4/5;overflow:hidden}}
.media img{{width:100%;height:100%;object-fit:cover;display:block}}
.pl{{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}}
.pl svg{{width:28px;height:28px;fill:#fff;margin-left:3px}}
.mute{{position:absolute;right:12px;bottom:12px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.6);font-size:13px;display:flex;align-items:center;justify-content:center}}
.cta{{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#0095F6;color:#fff;font-size:14px;font-weight:600;text-decoration:none}}
.acts{{display:flex;gap:16px;padding:10px 12px 6px;font-size:22px;color:#262626}}.acts .bk{{margin-left:auto}}
.likes{{padding:0 12px;font-size:14px;font-weight:600;color:#262626}}
.cap{{padding:4px 12px 14px;font-size:14px;line-height:1.35;color:#262626}}.cap b{{font-weight:600}}.cap .more{{color:#737373}}
.tabs{{height:78px;border-top:1px solid #efefef;display:flex;justify-content:space-around;align-items:flex-start;padding-top:12px;font-size:24px;background:#fff}}
.tabs .me{{width:26px;height:26px;border-radius:50%;background:url({avatar}) center/90% no-repeat;border:2px solid #000}}
/* instant experience */
.ieh{{display:flex;align-items:center;padding:10px 14px;background:#fff;border-bottom:1px solid #e6e6e6;font-size:15px;font-weight:600;color:#262626}}
.ieh .x{{font-size:22px;font-weight:400;width:32px}}.ieh .t{{flex:1;text-align:center}}.ieh .m{{width:32px;text-align:right;letter-spacing:1px}}
.f{{padding:6px 0 14px}}.f.dark{{background:#071230;color:#fff}}.f.light{{background:#fff;color:#262626}}
.tx{{padding:8px 16px;line-height:1.35}}.tx.L{{font-size:26px;line-height:1.15;padding-top:14px}}.tx.M{{font-size:16px}}.tx.S{{font-size:13.5px}}.b{{font-weight:700}}
.dim{{opacity:.75}}.gold{{background:#0C2148;color:#F3DCB2;margin:6px 16px;padding:14px;border-radius:6px}}
.f.light .dim{{color:#555}}
.ph,.vid img{{width:100%;display:block}}.vid{{position:relative;background:#000}}
.ieb{{display:block;margin:10px 16px 14px;padding:14px;text-align:center;background:#0095F6;color:#fff;font-weight:700;font-size:16px;border-radius:6px;text-decoration:none}}
.car{{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}}.car::-webkit-scrollbar{{display:none}}
.car img{{flex:0 0 100%;aspect-ratio:1/1;object-fit:cover;scroll-snap-align:start}}
.dots{{text-align:center;padding:6px 0 2px}}.dots i{{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(127,127,127,.5);margin:0 2px}}.dots i:first-child{{background:#0095F6}}
.lbl{{position:absolute;left:0;right:0;bottom:-34px;text-align:center;color:#8b8b95;font:13px -apple-system,sans-serif}}
</style>
<div class="wrap">
<div class="phone"><div class="notch"></div><div class="scr">
<div class="sb"><span>9:41</span><span>●●● ⌒ ▮</span></div>
<div class="scroll">
<div class="ighead"><span class="igword">Instagram</span><span class="icons">♡ ✈</span></div>
<div class="stories">{''.join('<div class="story"><i><span></span></i>'+n+'</div>' for n in ['Your story','longevitylife','julie.gibson','eteacher','courtney','wellness'])}</div>
<div class="post">
<div class="ph2"><span class="av"></span><span class="nm">longevitylifeacademy<small>Sponsored</small></span><span class="dots3">•••</span></div>
<div class="media"><img src="{poster}" alt=""><span class="pl"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span class="mute">🔇</span></div>
<a class="cta" href="#ie">Learn more <span>›</span></a>
<div class="acts"><span>♡</span><span>◯</span><span>✈</span><span class="bk">▢</span></div>
<div class="likes">2,418 likes</div>
<div class="cap"><b>longevitylifeacademy</b> {H.escape(h['sub'])} <span class="more">… more</span></div>
</div>
<div class="post"><div class="ph2"><span class="av" style="background-image:none;background:#ddd"></span><span class="nm">wellness.daily<small>2h</small></span><span class="dots3">•••</span></div><div class="media" style="background:#e9e9ee;aspect-ratio:1/1"></div></div>
</div>
<div class="tabs"><span>⌂</span><span>⌕</span><span>⊕</span><span>▶</span><span class="me"></span></div>
</div><div class="lbl">1 · The ad in the feed</div></div>

<div class="phone" id="ie"><div class="notch"></div><div class="scr">
<div class="sb"><span>9:41</span><span>●●● ⌒ ▮</span></div>
<div class="ieh"><span class="x">✕</span><span class="t">Longevity Life Academy</span><span class="m">•••</span></div>
<div class="scroll">{''.join(ie)}</div>
</div><div class="lbl">2 · Tap "Learn more": the Instant Experience, in-app</div></div>
</div>'''
(HERE/'live.html').write_text(page,encoding='utf-8'); print('live.html',round(len(page.encode())/1048576,1),'MB')
