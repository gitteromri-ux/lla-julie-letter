# Longevity Life Academy, redesigned clone of the live funnel page

This folder is a standalone clone of the live page at longevitylifeacademy.pages.dev,
rebuilt with a new presentation layer. It is a proposal for review. Nothing here touches
the live site, the Cloudflare Pages project, the Worker, GTM, ActiveCampaign or the checkout.

What was kept byte for byte from the live page

- Every visible word, in the same order, in the same folds. Verified by extracting all text
  nodes from the live page and from this page and comparing them: identical.
- Every video and image, referenced by the same relative paths under assets/.
- Google Tag Manager snippet and noscript frame, CSP and security meta tags.
- The enroll modal markup and its logic, the CRM leads script, the campaign id script,
  the ecommerce config, eteacher-ecomm.js, ecom-layer.js and nanp-state-autofill.js.
- All CTA hrefs and data-fn-cta attributes, so GTM and the checkout flow see the same DOM.

What changed

- One stylesheet in the head replaces the stacked override rounds and the three legacy css files.
- Section classes gained is-dark and rail markers for the mobile sliders. No text nodes changed.
- Three blog clips gained poster frames from assets/posters so the cards never render blank.
- A small presentation script adds slider dots on mobile and shows or hides the floating CTA.

Going live, when approved

1. Copy index.html over ck2/index.html and ck2/dist/index.html in lla-course-checkout.
2. Confirm ck2/dist/assets already contains every file listed in assets/ here (it does today,
   the files were copied from there without modification).
3. Deploy Pages and the Worker with the usual scripts, then verify with a cache busted link.
