import re
import pathlib
#!/usr/bin/env python3
"""
Build a single self-contained HTML file from site/, for hosts that can only
serve one file (the Claude artifact viewer, an email preview, a USB stick).

Everything the page needs is folded in: the three external stylesheets and
three local scripts are inlined, and every referenced image becomes a data
URI. Three things necessarily differ from the deployed site/ build:

  - the nine .mp4 files are left as relative refs. They 404 on a one-file
    host and each <video> falls back to its poster, which IS inlined, so
    nothing renders empty.
  - GTM is removed. It cannot load under the artifact CSP anyway, and a
    preview host must not fire the real container.
  - the artifact viewer supplies <html>/<head>/<body>, so the document is
    lifted into <div id="lpRoot"> and the design layer's `body#lpRoot`
    selectors are retargeted at that div. Specificity is unchanged: the
    doubled id still clears the page's :not(#hero) sans-lock block.

Output is gitignored — it is derived, and ~7.6 MB.

    python3 build_artifact.py            # site/ -> preview-artifact.html
"""
import base64, mimetypes, os, pathlib, re, sys

HERE = pathlib.Path(__file__).parent
SITE = HERE / (sys.argv[1] if len(sys.argv) > 1 else "site")
OUT = HERE / (sys.argv[2] if len(sys.argv) > 2 else "preview-artifact.html")


def datauri(rel):
    p = SITE / rel.split("?")[0]
    if not p.is_file():
        return None
    mt = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    if p.suffix.lower() == ".svg":
        mt = "image/svg+xml"
    return f"data:{mt};base64," + base64.b64encode(p.read_bytes()).decode()


def main():
    # Guard: site/index.html is a copy of the built index.html. If a rebuild
    # has not been copied across yet, this script would silently package the
    # previous version — which is exactly how a stale artifact once shipped
    # with a fix that was already in index.html. Fail loudly instead.
    built = HERE / "index.html"
    site_page = SITE / "index.html"
    if built.is_file() and site_page.read_bytes() != built.read_bytes():
        raise SystemExit(
            f"ABORT: {site_page} is out of date with {built}.\n"
            f"Run:  python3 build.py && cp index.html site/index.html && python3 build_artifact.py"
        )

    h = site_page.read_text(encoding="utf-8")

    def inline_css(m):
        href = m.group(1).split("?")[0]
        p = SITE / href
        if not p.is_file():
            return m.group(0)
        css = p.read_text(encoding="utf-8", errors="ignore")

        def fix(u):
            raw = u.group(1).strip("'\"")
            if raw.startswith(("data:", "http", "#")):
                return u.group(0)
            d = datauri(os.path.normpath(os.path.join(os.path.dirname(href), raw)))
            return f"url({d})" if d else u.group(0)

        css = re.sub(r"url\(([^)]+)\)", fix, css)
        return f"<style>/* inlined {href} */\n{css}\n</style>"

    h = re.sub(r'<link[^>]+rel="stylesheet"[^>]+href="(assets/[^"]+)"[^>]*>', inline_css, h)

    def inline_js(m):
        p = SITE / m.group(1).split("?")[0]
        if not p.is_file():
            return m.group(0)
        js = p.read_text(encoding="utf-8", errors="ignore")
        return f"<script>/* inlined {m.group(1)} */\n{js}\n</script>"

    h = re.sub(r'<script[^>]+src="(assets/[^"]+\.js[^"]*)"[^>]*></script>', inline_js, h)

    def inline_attr(m):
        attr, rel = m.group(1), m.group(2)
        if rel.lower().split("?")[0].endswith(".mp4"):
            return m.group(0)
        d = datauri(rel)
        return f'{attr}="{d}"' if d else m.group(0)

    h = re.sub(r'\b(src|poster)="(assets/[^"]+)"', inline_attr, h)

    h = re.sub(r"<!-- Google Tag Manager -->.*?<!-- End Google Tag Manager -->", "", h, flags=re.S)
    h = re.sub(r'<noscript><iframe src="https://www\.googletagmanager\.com.*?</noscript>', "", h, flags=re.S)
    h = re.sub(r'<meta http-equiv="Content-Security-Policy".*?>', "", h, flags=re.S)
    # fonts.cdnfonts.com (Codec Pro) is not on the artifact CSP allowlist; the
    # display faces are Playfair from Google Fonts, so drop the blocked host
    h = re.sub(r"<link[^>]+cdnfonts[^>]*>", "", h)

    head = re.search(r"<head[^>]*>(.*?)</head>", h, re.S).group(1)
    body = re.search(r"<body[^>]*>(.*?)</body>", h, re.S).group(1)
    out = head + '\n<div id="lpRoot">\n' + body + "\n</div>"
    out = out.replace("html body#lpRoot#lpRoot[id][id]", "html #lpRoot#lpRoot[id][id]")
    out = re.sub(r"<title>.*?</title>", "<title>LLA Aurora Redesign</title>", out, count=1, flags=re.S)

    # background images referenced from CSS url(assets/...) — the CGM plates
    # and press cards were empty white boxes in the preview without this
    import base64 as _b64
    def _css_url(m):
        rel = m.group(1)
        for base in (SITE, pathlib.Path("/home/user/lla-course-checkout")):
            f = base / rel
            if f.is_file():
                mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","svg":"image/svg+xml"}.get(f.suffix[1:].lower(),"application/octet-stream")
                return 'url("data:%s;base64,%s")' % (mime, _b64.b64encode(f.read_bytes()).decode())
        return m.group(0)
    out = re.sub(r'url\(["\']?(assets/[^"\')]+?)["\']?\)', _css_url, out)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT.name}  {len(out.encode())/1048576:.1f} MB")


if __name__ == "__main__":
    main()
