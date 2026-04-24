# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Shopify theme (Dawn-based) for "Monroe" store. No build system — assets are deployed directly via Shopify CLI.

## CLI Commands

```bash
# Develop against a store (hot reload)
shopify theme dev --store=<store-handle>

# Push theme to store
shopify theme push --store=<store-handle>

# Pull latest from store
shopify theme pull --store=<store-handle>

# Check CLI version
shopify version
```

No `npm install`, no build step, no test runner. Changes to files in `assets/`, `sections/`, `snippets/`, `templates/`, `layout/`, `config/` are pushed directly.

## Architecture

### Directory Layout

| Directory | Purpose |
|-----------|---------|
| `layout/` | Root HTML shells — `theme.liquid` wraps all storefront pages, `password.liquid` wraps the password page |
| `templates/` | Route-to-section wiring — JSON files declare which sections render per route (e.g. `product.json` → `main-product` section) |
| `sections/` | Reusable page regions, each with schema for theme editor settings |
| `snippets/` | Partials rendered via `{% render 'snippet-name' %}` — no schema, no editor settings |
| `assets/` | CSS files (component-*.css, base.css) and JS files — loaded via `{{ 'file.js' | asset_url }}` |
| `config/` | `settings_schema.json` (theme editor UI definition) + `settings_data.json` (saved values) |
| `locales/` | Translation strings accessed via `{{ 'key' | t }}` |

### JS Architecture

All interactivity uses **native Web Components** (`customElements.define`). No framework, no bundler.

Key patterns:
- **`pubsub.js`** — global `subscribe(eventName, callback)` / `publish(eventName, data)` event bus. Events defined in `constants.js` as `PUB_SUB_EVENTS` (e.g. `cartUpdate`, `quantityUpdate`, `variantChange`).
- **`global.js`** — base utilities: `getFocusableElements`, `SectionId`, `HTMLUpdateUtility`, `fetchConfig`, trap-focus helpers. Most components extend or use these.
- Component files map 1:1 to their HTML element name (e.g. `cart-drawer.js` defines `<cart-drawer>`, `product-form.js` defines `<product-form>`).
- Scripts loaded with `defer` from `theme.liquid`; section-specific scripts loaded inline in their section file.

### CSS Architecture

Component-scoped CSS files (`component-*.css`) are loaded only where needed (referenced in section files or `theme.liquid`). `base.css` is global. No preprocessor — plain CSS with custom properties for theming.

### Data Flow: Cart

`product-form` → POST to `/cart/add.js` → publishes `cartUpdate` event → `cart-drawer` or `cart-notification` subscribes and re-renders via section rendering API (`/sections?sections=cart-drawer`).

### Sections vs Snippets

- **Sections** appear in theme editor, have `{% schema %}` blocks, can be added/removed/reordered by merchants.
- **Snippets** are code partials, invoked with `{% render %}` (not `{% include %}`), cannot access variables from parent scope unless passed explicitly.

### Settings

Global theme settings: `config/settings_schema.json` defines fields, `config/settings_data.json` stores current values. Access in Liquid via `settings.setting_name`. Section-level settings accessed via `section.settings.setting_name`.
