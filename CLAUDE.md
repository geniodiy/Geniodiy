# Genio Institute (Apps Script web app)

Google Apps Script web app (HtmlService). `Code.gs` serves pages; each `Module*.html` is included into `Dashboard.html`. `Config.html` holds shared tokens, components, Supabase helpers, and the shared UI layer for popups/buttons. Deploy by importing files into Apps Script (`importProjectFilesFromDrive` in `Export.gs`), then create a new deployment version. Keep all element IDs and JS hooks intact when restyling.

## Design preferences (from the owner, apply to every page)

Reference implementations: `Login.html`, `ModuleHome.html`, `ModulePresensi.html`.

- **Fonts:** Plus Jakarta Sans everywhere (`var(--font)`). Poppins only for the brand name "Genio Institute" (`var(--font-brand)`, class `.genio-brand-title`). Never use Poppins elsewhere.
- **Logo:** keep the original lockup: logo image badge + "Genio" (blue) "Institute" (red) + "Yogyakarta". Do not replace it with a wordmark.
- **Type scale:** small and airy, like the Claude app. Body 11.5-12.5px, labels 10-11px, section titles 12px, card names 12-13px, hero numbers ~20px (18px in flat desktop rows).
- **Weights:** light by default (400-500), but use bold where it helps scanning: key numbers and money values 700, section titles / names / greetings / primary buttons 600, page titles 700.
- **Highlight panels:** blue brand panel (`var(--blue)`, soft radial glow, radius 18px, translucent white sub-cards). On desktop keep them flat: content laid out left-to-right on one row, not stacked. They must wrap safely (`flex-wrap`, `minmax(0,1fr)`, `min-width:0`, ellipsis on secondary text), so long real values like "Rp 201.500" never overlap.
- **Shapes:** buttons/inputs 8-10px radius, cards 14px, popups 18px, 1px borders `var(--border)`.
- **Buttons:** primary = blue background, white text; secondary = white with border. No black (`var(--ink)`) buttons.
- **Popups:** follow the login form style: light title, labels above grey input boxes (`var(--surface)`), blue focus ring, 36px actions. Handled globally by the "Genio UI layer" in `Config.html`.
- **Copy:** sentence case, no em dashes, no uppercase micro-labels.
- Light theme only (whole app is light).
