# When to move house

A small static site that estimates the best age to move house (or buy your first home), judged by your position at age 100.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

## Files

- `index.html` – page and inputs
- `styles.css` – styling (light and dark mode)
- `data.js` – mortgage rates by LTV and regional house price growth by property type
- `app.js` – the model, chart and tables

## Updating the data

All figures live in `data.js`:

- `BANDS` – `[max LTV %, rate %]` pairs. Based on 2026 average rates.
- `REGION` – `[long-run 2016–26 growth %, last 12 months %]` per region, from the UK House Price Index. The long-run values are estimates from regional average prices.
- `RENT_YIELD` – what a home would rent for as a share of its value each year (4.5%). Turns "how much more you'd value living there" into pounds for home owners.
- `TYPE` – adjustments by property type added to the regional figure, based on England-wide gaps between types.

Property tax bands (England/NI stamp duty, Scottish LBTT, Welsh LTT) are in `propTax()` in `app.js`, using bands in force from April 2025.

## Limitations

Lender borrowing is checked with a simple income multiple only (no detailed affordability or stress test), rates and growth are held constant into the future, and tax bands aren't inflated.

## Publishing changes

The site is served by GitHub Pages from `main`. When you change `styles.css`, `data.js` or `app.js`, bump the `?v=` number on their links in `index.html` so browsers don't mix a cached old file with the new page.
