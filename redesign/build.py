#!/usr/bin/env python3
"""
Build the Aurora 4D redesign of the Longevity Life Academy landing page.

Takes the live index.html untouched and appends one <style> block before
</body>. Nothing else in the document is read, moved, rewritten or removed:
same markup, same copy, same scripts, same GTM, same forms, same checkout.
"""
import sys, pathlib, re

here = pathlib.Path(__file__).parent
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "index.src.html"
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else here / "index.html"
css = (here / "lla-aurora-4d.css").read_text(encoding="utf-8")

html = src.read_text(encoding="utf-8")

# drop a previous build of this layer so the script is idempotent
html = re.sub(r'\n?<style id="lla-aurora-4d">.*?</style>', "", html, flags=re.S)

# Copy changes, made only where explicitly asked for. Everything else in
# the document is left byte for byte as it is.
TEXT_PATCHES = [
    # eTeacher mark: the exact file longevitylifeacademy.com uses in its fold.
    ('src="assets/eteacher-wordmark-only.png"', 'src="assets/e-teacher-logo.png"'),
    # Hero standfirst: break after "biology," so the block squares off under the headline.
    ("built around your biology, your numbers,", "built around your biology,<br>your numbers,"),
    # CGM fold headline, per the client's wording.
    ("Your Abbott Lingo ships<br><em>free, before lesson five.</em>",
     "Free CGM from Abbott Lingo.<br><em>Your own biodata, monitored.</em>"),
    # Julie Gibson Clark's billing, per the client's wording.
    ("Founding Faculty, ranked #2 on the Rejuvenation Olympics",
     "2nd Slowest Aging Woman on Earth, Founding Faculty"),
    ("Founding Faculty, Ranked #2 Rejuvenation Olympics",
     "2nd Slowest Aging Woman on Earth, Founding Faculty"),
]
for old, new in TEXT_PATCHES:
    if old in html:
        html = html.replace(old, new)
    else:
        print(f"  note: copy patch not applied, string absent: {old[:44]}...")

band = ('<section class="lla-enroll-band" aria-label="Enroll">'
        '<a href="checkout.html" class="lla-enroll-band-cta" data-fn-cta="band">Enroll now</a>'
        '<p class="lla-enroll-band-note">$279 a month. 18 live sessions, the Abbott Lingo CGM shipped free, your written protocol. 14-day guarantee.</p>'
        '</section>\n')
html = html.replace('<section class="pdp-press pressx"', band + '<section class="pdp-press pressx"', 1)

block = '\n<style id="lla-aurora-4d">\n' + css + '\n</style>\n'
marker = "</body>"
i = html.rfind(marker)
if i == -1:
    raise SystemExit("no </body> in source")
html = html[:i] + block + html[i:]

out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html):,} bytes, layer {len(css):,} bytes)")
