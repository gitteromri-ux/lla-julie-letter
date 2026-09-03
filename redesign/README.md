# Longevity Life Academy — Aurora 4D design layer

A premium visual redesign of the LLA landing page
(`longevitylifeacademy.pages.dev` / `lla-course-checkout/index.html`).

**Nothing functional was touched.** The build takes the live `index.html`
byte for byte and appends exactly one `<style id="lla-aurora-4d">` block
before `</body>`. Verified after every build:

- the file is byte-identical to the source once that block is removed;
- every rendered text node matches the original — 674 of 674, at 1512px and
  at 390px (checked by walking both DOMs and comparing in order);
- GTM, `dataLayer`, all 14 `<script>` blocks, the single `<form>`, all 9
  inputs, both selects, all 16 `checkout.html` links and all 14
  `data-fn-cta` attributes are unchanged in count and position;
- all nine mobile scroll-snap sliders built in round 3 still swipe
  (pillars, syllabus tabs, session cards, faculty, testimonials, what-it-is,
  the five-step mechanism, press, FAQ).

No fold was removed, reordered or renamed.

## Files

| file | what it is |
| --- | --- |
| `lla-aurora-4d.css` | the design layer, the only thing authored here |
| `index.src.html` | the live page, unmodified, kept as the build input |
| `index.html` | the built page: `index.src.html` + the layer |
| `build.py` | rebuilds `index.html`; idempotent |

Rebuild after editing the CSS:

```
python3 build.py                     # uses index.src.html -> index.html
python3 build.py <src> <out>         # or point it anywhere
```

## Deploying

Copy `redesign/index.html` over `index.html` in the site repo
(`gitteromri-ux/lla-course-checkout`, root and `dist/`). Asset paths are
untouched and stay relative, so nothing else moves. To roll back, restore
the previous `index.html` or delete the `<style id="lla-aurora-4d">` block.

## The design

**Type.** Playfair Display italic carries every headline on the page, hero
included, at `clamp(46px, 5.6vw, 86px)` (hero to 104px), tight leading and
−0.02em tracking. The italic clause in each headline takes a gradient fill
mixed in oklab so it never crosses grey. Inter carries all body copy at a
74-character measure.

**Colour.** Each fold gets its own accent pair, walking blue → violet →
mint → gold → aqua down the page so no two neighbours share a hue. Light
folds are white cores with three coloured blooms over an ice floor; dark
folds are navy with a blue key light and mint/violet rim light. A fine SVG
grain sits over both so the large gradients never band.

**Depth.** Every surface carries three shadow planes (contact, key,
ambient), an inner top highlight, and a masked gradient rim that reads as a
lit edge. Cards lift 7px on hover with a coloured ambient bloom; the blur
is desktop-only so phone scrolling stays at 60fps.

## Two defects fixed along the way

Both were already live, and both are repaired in CSS only:

1. **The faculty fold rendered as five hairlines on desktop.** A late
   `aspect-ratio:auto !important` cancelled the ratio the cinematic card
   depends on while its photo and body are both absolutely positioned, so
   every card collapsed to 0px tall. The ratio is restored above 821px;
   mobile keeps its stacked treatment.
2. **A black band under the CGM product shot**, where the plate was taller
   than the photo. The image now sets the height.

The admissions form's labels were also near-invisible pale blue on white;
they are darkened. Colour only — no field, name, order or behaviour changed.
