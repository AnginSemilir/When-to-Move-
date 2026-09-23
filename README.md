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
- `model.js` – the calculations and default inputs, with no page code, so they can be tested on their own
- `app.js` – the page: reads the inputs, shows the verdict, chart and tables
- `tests/` – scenario library and sense checks

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

## Tests

Needs Node.js 18 or later, and nothing else:

```
npm test                  # or: node tests/run.js
node tests/run.js --verbose
```

The run covers:

- **Formulas**, checked against figures worked out by hand: mortgage payments, stamp duty, LBTT, LTT and rate bands.
- **Hand-counted worlds**, where growth, interest, inflation and pay rises are all zero, so the result at 100 can be added up exactly.
- **Scenarios** (`tests/scenarios.js`): people described by the inputs they'd type, each with the answer a sensible person would expect. Every result must also obey some basic rules: no loan over 95% LTV or the lending limit, no mortgage past the age limit, the best year really is the best, and so on.
- **What-ifs**: change one input and the answer should move the way common sense says. For example, more savings never leaves you worse off.

To check a result someone exported from the page (the **Export** button saves a JSON file with their inputs and results), run `node tests/check-export.js <file.json>`. It re-runs their inputs and says whether the model still gives the same answer. Their `inputs` can also be pasted straight into a new scenario.

It finishes with a table of every scenario's result for reading through. To add a scenario, copy one in `tests/scenarios.js` and change the inputs and expectations.
