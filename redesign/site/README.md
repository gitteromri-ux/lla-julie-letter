# Deployable preview

Static copy of the redesigned landing page, self-contained: `index.html`
(the Aurora 4D build), `checkout.html` verbatim from the live site, and
the 35 non-video assets those two pages reference (4 MB).

The nine referenced `.mp4` files are not committed. `vercel.json` rewrites
`/assets/*.mp4` to the live origin, so the browser still fetches them
same-origin and the page's `media-src 'self'` CSP is satisfied. If that
origin is ever unreachable the videos fall back to their posters and
nothing else changes. `vercel.json` also sends `X-Robots-Tag: noindex` so
the preview cannot outrank the real site.

Nothing here is a source of truth. `../index.html` is the deliverable;
this folder exists so the redesign has a URL.

Note: `index.html` and `checkout.html` still carry the site's real GTM
container, because the brief was to leave analytics untouched. Traffic to
this preview URL will therefore show up in GTM/GA under the preview
hostname. Filter by hostname, or ask and I will publish a GTM-free copy
of the preview — the committed deliverable keeps GTM either way.
