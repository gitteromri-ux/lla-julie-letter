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

block = '\n<style id="lla-aurora-4d">\n' + css + '\n</style>\n'
marker = "</body>"
i = html.rfind(marker)
if i == -1:
    raise SystemExit("no </body> in source")
html = html[:i] + block + html[i:]

out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html):,} bytes, layer {len(css):,} bytes)")
