# One Hope design tokens

Taken from the public stylesheet of [weareonehope.com](https://www.weareonehope.com/) on Nov 19, 2026 (`one-hope-church.shared.957df83c1.min.css`). The app keeps this identity and draws it more carefully than the marketing site: full-bleed photography, a sky-to-dove wash, ink edges, and a press state.

## Color

| Token                 | Hex       | Where the site uses it             |
| --------------------- | --------- | ---------------------------------- |
| `--green` Olive       | `#3F4903` | Green buttons, wordmark field      |
| `--orange` Terracotta | `#DF8052` | Orange buttons                     |
| `--blue` Sky          | `#CADDF6` | Home hero background               |
| `--dove`              | `#E5E4D0` | Text on the hero, page wash        |
| `--black-2` Ink       | `#1C1B1B` | Wordmark, button border, body text |

Buttons on the site are a flat color, a 1px ink border, 5px corners, and `scale(0.95)` while pressed. The app keeps the ink border and the press, and uses 12px corners so the same blocks feel finished on a phone.

## Type

The site sets headlines in **Articulat CF** (600) and navigation in **Inter**. Articulat CF is a commercial font and is not embedded here. The app uses the system sans at the site's scale: a 40pt semibold display and a title for section names. Scripture stays in a serif italic so a verse is obviously a verse. That serif is not on the website.

## Photography and marks

Only files already published by the church:

- Wordmark: `web/public/brand/logo.svg` and the ink/dove wordmark PNGs (fill `#1C1B1B` on the SVG).
- Photos already in `web/public/photos/`: `hero.jpg`, `about.jpg`, `community1.jpg`, `times.jpg`, `video.jpg`.

No stock photos are labeled as One Hope. No extra symbols.

## Spacing

The site hero uses a large top pad (about 10.6rem) and a short bottom pad (about 4.4rem). The app hero is full-bleed with the title sitting on a dark wash at the bottom, which is the same photograph with more room to breathe.

## Motion

Buttons scale down slightly on press, matching `.btn-orange:active`. Haptics are a soft tap on social links and daily actions. Reduced motion keeps the press and skips extra movement.
