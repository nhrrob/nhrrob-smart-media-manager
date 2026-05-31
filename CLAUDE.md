# CLAUDE.md

## Commands

```bash
# Release / zip
npm run release      # lint → unit tests → e2e → build → dump-autoload --no-dev → pcp → zip → restore autoload
npm run build:zip    # build → dump-autoload --no-dev → zip → restore autoload

# JS
npm run build        # production build → admin/build/ + regenerates POT file
npm run start        # watch mode
npm run make:pot     # regenerate languages/nhrrob-smart-media-manager.pot manually
npm run lint:js      # wp-scripts lint-js admin/src
npm run format:js    # wp-scripts format admin/src
npm run lint:css     # wp-scripts lint-style admin/css/*.css

# PHP
composer run phpcs   # lint
composer run phpcbf  # auto-fix

# Tests
composer run test:unit   # PHPUnit (Brain Monkey, no DB)
npm run test:e2e         # Playwright (requires wp-env running)
npm run test:e2e:ui

# wp-env (Docker required)
npm run env:start    # http://localhost:8888  admin/password
npm run env:stop
npm run env:clean    # wipe DB + uploads
npm run env:destroy
```

Node: pin to Node 24 — run `nvm use` in project root.

`node_modules` is dev-only. `admin/build/`, `admin/svg/`, `admin/css/nhrsmm-icons.css` are committed and work without it.

**No production Composer deps.** The plugin self-autoloads its own `Nhrsmm\SmartMediaManager\` classes via a `spl_autoload_register` in the main file (mapping → `includes/`) — it does NOT `require vendor/autoload.php`. `vendor/` is dev-only (phpunit/phpcs/brain-monkey), gitignored, and excluded from every zip (`.distignore` + `.gitattributes`). This is why all distribution paths work without churn: GitHub source zip, `wp dist-archive`, and WP.org never carry a Composer autoloader that could reference missing dev packages. After cloning, run `composer install` for dev tools. `vendor/autoload.php` is loaded only in the phpunit bootstrap (`tests/php/bootstrap.php`). If you ever add a real production dependency, switch the main file back to `require vendor/autoload.php` and ship the `--no-dev` vendor.

## REST API (`nhrsmm/v1`)

| Route | Methods | Controller |
|---|---|---|
| `/folders` | GET, POST | `RestFolders` |
| `/folders/{id}` | PUT, DELETE | `RestFolders` |
| `/folders/{id}/move` | POST | `RestFolders` |
| `/media` | GET | `RestMedia` |
| `/media/bulk-move` | POST | `RestMedia` |
| `/media/bulk-delete` | DELETE | `RestMedia` |
| `/media/{id}` | GET, PUT | `RestMedia` |
| `/media/{id}/move` | POST | `RestMedia` |
| `/media/{id}/usage` | GET | `RestMedia` |
| `/ai/alt-text` | POST | `RestAi` |
| `/ai/caption` | POST | `RestAi` |
| `/settings` | GET, POST | `RestSettings` |

Media routes require `upload_files`. Settings requires `manage_options`.

## Non-Obvious Implementation Details

**Asset manifests:** `@wordpress/scripts` emits `admin/build/{name}.asset.php` with auto-detected WP package dependencies and a content-hash version. Never manage script deps manually.

**CSS is hand-crafted:** `admin/css/nhrsmm-admin.css` is plain CSS (not a build output). Scoped under `.nhrsmm`. `admin/css/nhrsmm-icons.css` maps `.ti-xxx` to SVGs in `admin/svg/` via `mask-image`.

**Icons (no icon font):** `admin/svg/` holds Tabler Icons SVG files. Icons render via CSS `mask-image` — the `.ti` base class sets `display: inline-block; width/height: 1em; background-color: currentColor`. Use `<i className="ti ti-xxx" />` in JSX.

**Adding an icon:**
1. `npm install` if `node_modules` was deleted.
2. Copy `node_modules/@tabler/icons/icons/outline/<name>.svg` → `admin/svg/<name>.svg`
3. Add to `admin/css/nhrsmm-icons.css` (alphabetical): `.ti-<name> { -webkit-mask-image: url('../svg/<name>.svg'); mask-image: url('../svg/<name>.svg'); }`
4. Use `<i className="ti ti-<name>" />`. No build needed.
For filled icons: source from `icons/filled/`, name as `<name>-filled`.

**`Folders::get_counts()` direct DB query:** `wp_term_taxonomy.count` is only updated for published posts — attachments use `post_status = 'inherit'` so it's always 0. The direct query counts `term_relationships` rows. The `phpcs:disable` block is intentional — keep it.

**`_nhrsmm_filesize` post meta:** Written lazily in `format_attachment()` on first read (not on upload). Enables `orderby=meta_value_num` sort-by-size without a migration.

**Upload flow:** `UploadModal.js` posts to WP's `async-upload.php` (legacy endpoint, `action=upload-attachment`, `media-form` nonce), then calls `POST /media/{id}/move` to assign a folder. Two steps because WP has no REST upload endpoint.

**localStorage-only state:** `starredIds`, `thumbSize` (grid column size, 80–200 px), and `recentIds` never sync to DB. `thumbSize` (px) is separate from `thumbnail_size` in plugin settings (`small|medium|large`, controls which WP image size the API returns).

## Frontend Entry Points

| Entry | Mount | JS Config global |
|---|---|---|
| `admin/src/index.js` | `#nhrsmm-app` | `window.nhrsmmConfig` |
| `admin/src/settings.js` | `#nhrsmm-settings-app` | `window.nhrsmmSettingsConfig` |

**`nhrsmmConfig` shape:**
```js
{ restUrl, nonce, mediaUploadNonce, adminUrl, pluginUrl, settingsUrl,
  connectorsUrl, defaultView, thumbSize, perPage, version,
  aiConfigured, aiProvider, currentUserId }
```

**`nhrsmmSettingsConfig` shape:**
```js
{ restUrl, nonce, mediaLibraryUrl, connectorsUrl, wpMediaUrl, version,
  aiConfigured, settings: { default_view, thumbnail_size, items_per_page } }
```

## Key Conventions

- **Prefix:** `NHRSMM_` (constants), `nhrsmm_` (options, hooks, nonces, handles)
- **REST namespace:** `nhrsmm/v1` | **Taxonomy:** `nhrsmm_media_folder` | **CSS scope:** `.nhrsmm`
- **PHP 7.4+:** no union types in signatures; scalar return types only
- **AI:** use `wp_ai_client_prompt()` only — never call providers directly. Gate all AI UI on `wp_supports_ai()`. Builder: `using_system_instruction()` → `with_text()` (or `with_file()`) → `generate_text()` returns `string|\WP_Error`. `is_supported_for_text_generation()` does NOT exist. AI Connectors page: `options-connectors.php`.
- **JS i18n:** `.eslintrc.js` has `allowedTextDomain: ['nhrrob-smart-media-manager']` configured. All `__()` / `_n()` calls need the text domain. `sprintf()` with placeholders needs a `// translators:` comment above it.
- **Docblocks:** PHP docblocks required on all public/protected methods (PHPCS enforces). JS inline comments for non-obvious WHY only — one line max.

## Testing Constraint (Brain Monkey / Patchwork)

**Never define WP functions as stubs in `bootstrap.php`.** Patchwork cannot intercept functions defined before `Monkey\setUp()` runs. Define all per-test overrides with `Functions\when()` or `Functions\expect()` inside test methods only. Only class stubs (e.g. `WP_Error`) are safe in bootstrap.

## Release Exclusions

`.distignore` (WP.org zip) and `.gitattributes` (git archive) must stay in sync. `vendor/` ships partially — autoloader + production deps only; dev packages excluded by path. `admin/build/` ships (never exclude it).

## Skills

- `/release_plugin` — version bump, PR, tag, publish procedure
