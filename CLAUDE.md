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
WP_BASE_URL=http://smm-shots.test npx playwright test   # same suite against the local Herd site ~/Sites/smm-shots (admin / password, demo data in demo.json); no Docker needed
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
| `/folders/{id}` | PUT (name and/or color), DELETE | `RestFolders` |
| `/folders/{id}/move` | POST | `RestFolders` |
| `/folders/{id}/files` | GET (recursive url/path list for ZIP) | `RestFolders` |
| `/folders/reorder` | POST | `RestFolders` |
| `/folders/path` | POST (ensure path, used by folder uploads) | `RestFolders` |
| `/folders/export`, `/folders/import` | GET, POST | `RestFolders` |
| `/import/sources`, `/import` | GET, POST (other folder plugins, batched) | `RestFolders` |
| `/media` | GET | `RestMedia` |
| `/media/bulk-move` | POST (`mode`: move, add, remove) | `RestMedia` |
| `/media/bulk-delete` | DELETE (trash; `force` = permanent) | `RestMedia` |
| `/media/bulk-restore`, `/media/bulk-update`, `/media/reorder` | POST | `RestMedia` |
| `/media/scan-unused` | POST (batch of 10, cursor = `after`) | `RestMedia` |
| `/media/{id}` | GET, PUT | `RestMedia` |
| `/media/{id}/move` | POST | `RestMedia` |
| `/media/{id}/replace` | POST (multipart `file`) | `RestMedia` |
| `/media/{id}/usage` | GET | `RestMedia` |
| `/user-state` | POST (starred, recent → user meta) | `RestMedia` |
| `/ai/alt-text`, `/ai/caption` | POST | `RestAi` |
| `/ai/generate` | POST (`field`: alt, caption, title, description; `save`) | `RestAi` |
| `/settings` | GET, POST | `RestSettings` |

All routes require `manage_categories` (Editor+), with per-attachment `edit_post` / `delete_post` checks on ID-taking routes. Settings requires `manage_options`.

`/media` query params: `page, per_page, folder, search, type, orderby (date|modified|title|size|author|menu_order), order, ids, alt=missing, status=trash, unused=1, author, date_from, date_to`.

## PHP Modules

| Class | Role |
|---|---|
| `Core\Options` | Single `nhrsmm_settings` option: defaults, read, validated save |
| `Core\Folders` | Folder terms: tree, counts, color/order (term meta), path, export/import, flat list |
| `Core\Media` | Listing, search, update, move, trash/restore, bulk edit, reorder, replace file |
| `Core\Usage` | Where-used lookup and the unused-files scan (`_nhrsmm_unused` post meta) |
| `Core\Importer` | Reads other folder plugins' tables/taxonomies (read-only) |
| `Core\Ai` | Alt, caption, title, description; prompt options; auto alt cron callback |
| `Admin\NativeLibrary` | Folder tree in the media modal, folder dropdown in Media → Library grid/list and in narrow modals (`admin/js/nhrsmm-media-modal.js`, hand-written, not built; its CSS is an inline style on `media-views`). The tree is skipped in grid mode because that layout is not absolutely positioned. |
| `Block` | `[nhrsmm_gallery]` shortcode and `nhrsmm/folder-gallery` block. Wraps core's `gallery_shortcode()` output in `.nhrsmm-gallery` with its own inline grid CSS (`nhrsmm-gallery` style handle), because core gallery markup has no column styles in block themes |
| `Cli` | `wp nhrsmm alt` |
| `Abilities` | Six `nhrsmm/*` abilities for AI agents and MCP clients (see below) |

## Abilities (AI agents, MCP)

`Abilities` registers on `wp_abilities_api_categories_init` / `wp_abilities_api_init` (only fired when something asks for the registry). Category `nhrsmm`; every ability is gated by `Abilities::check_permission()` (`manage_categories`, same as REST) and flagged `public` + `show_in_rest` + `mcp.public` so the WordPress MCP Adapter (not bundled) exposes it.

- Read-only: `nhrsmm/list-folders`, `nhrsmm/list-media` (`folder, search, type, alt=missing, unused, page, per_page`), `nhrsmm/get-media-usage`.
- Writes: `nhrsmm/create-folder`, `nhrsmm/move-media` (replaces the files' folders), `nhrsmm/update-media` (alt, title, caption, description).

Rules: ID-taking abilities go through `Abilities::can_edit_attachment()`, which checks the post type as well as `edit_post` — `Core\Media::update()` and `bulk_move()` do not check that an ID is an attachment, and an agent may pass any ID. **Nothing destructive is offered**: no trash/delete, replace file, folder delete/rename, import, settings. **No ability calls the AI provider** (an agent writes alt text itself through `update-media`), so nothing here spends the user's AI credits or needs an External Services change. Core validates output against `output_schema`; keep schemas loose. `tests/php/Unit/AbilitiesTest.php` pins the list, gate and annotations; a new ability also needs the readme FAQ and PRD §4.5.

## Non-Obvious Implementation Details

**Query budget:** `Folders::flat()` and `export()` build the tree without counts (`tree( false )`), because the folder dropdowns load on every editor screen. Only `get_tree()` (the `/folders` route) runs the library-wide count queries. `Media::format_attachment()` reads folders with `get_the_terms()` so a list page uses the term cache `WP_Query` filled; do not switch it back to `wp_get_object_terms()` or set `update_post_term_cache` to false on list queries. `Folders::files()` loads posts in chunks of 200 and stops at its 2000-file cap. `Usage::get()` returns after the first hit when called with a limit of 1 (the unused scan). `Folders::delete()` leaves unassigning the files to `wp_delete_term()`; do not loop over them first.

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

**`_nhrsmm_filesize` post meta:** Written lazily in `format_attachment()` on first read (not on upload). Sort-by-size LEFT JOINs this meta through a `posts_clauses` filter (`Media::size_order_filter()`), so files with no cached size yet still appear in the list; a `meta_key` sort would drop them.

**Upload flow:** `UploadModal.js` posts to WP's `async-upload.php` (legacy endpoint, `action=upload-attachment`, `media-form` nonce) with an extra `nhrsmm_folder` field. `App::on_attachment_add()` reads that field (or the default upload folder) and assigns the folder. The media modal script sends the same field through `wp.Uploader`. Dropped desktop folders are walked with `webkitGetAsEntry()` and their paths created through `POST /folders/path`; three uploads run at a time.

**Storage (no custom tables, one option):** settings in `nhrsmm_settings`; folder color and order in term meta (`nhrsmm_color`, `nhrsmm_order`); custom file order in the core `menu_order` column; starred/recent in user meta (`nhrsmm_starred`, `nhrsmm_recent`); `_nhrsmm_filesize` and `_nhrsmm_unused` post meta; a one-hour `nhrsmm_import_{source}` transient during an import. `uninstall.php` removes all of them on every site.

**Trash:** delete calls `wp_trash_post()` directly, so it works without the `MEDIA_TRASH` constant; core's scheduled cleanup empties it. `get_post_status()` returns the parent's status for attachments, so read `post_status` with `get_post_field()`.

**ZIP download is built in the browser** (`buildZip()` in `utils.js`, stored/uncompressed) from file URLs. There is no server-side ZipArchive, temp file, or streamed response.

**Search:** `Media::search_filter()` adds a `posts_search` filter for the one query so it also matches `_wp_attachment_image_alt` and `_wp_attached_file`.

**Auto alt on upload:** off by default; queues a single `nhrsmm_auto_alt` cron event per image. Any change to when data is sent to the AI provider must be reflected in the readme's External Services section.

**Browser-only state:** `thumbSize` (grid column size, 80–200 px), sidebar width/collapsed, open folders, and the last opened folder live in localStorage. `thumbSize` (px) is separate from `thumbnail_size` in plugin settings (`small|medium|large`). The theme choice is `nhrsmm_theme` (`dark|light`; absent = follow the OS).

**Dark theme:** `admin/src/theme.js` (`initTheme()` in both entry files, `<ThemeToggle />` in the top bar and settings header) sets `data-nhrsmm-theme` on `<html>`, not on the app root, because modals and menus are portalled to `<body>`. The dark block at the end of `nhrsmm-admin.css` only remaps tokens: neutrals are inverted and `--white` is the surface. So: use `var(--on-accent)`, never `var(--white)`, for text or marks on a brand, AI-gradient or image-overlay fill; and avoid new hard-coded colours, since they will not flip.

## Frontend Entry Points

| Entry | Mount | JS Config global |
|---|---|---|
| `admin/src/index.js` | `#nhrsmm-app` | `window.nhrsmmConfig` |
| `admin/src/settings.js` | `#nhrsmm-settings-app` | `window.nhrsmmSettingsConfig` |
| `admin/src/block.js` | block editor | `window.nhrsmmBlock` (`folders`) |

**`nhrsmmConfig` shape:**
```js
{ restUrl, nonce, mediaUploadNonce, adminUrl, pluginUrl, settingsUrl,
  connectorsUrl, defaultView, thumbSize, perPage, version,
  aiConfigured, aiProvider, currentUserId, startupFolder, starredIds, recentIds }
```

**`nhrsmmSettingsConfig` shape:**
```js
{ restUrl, nonce, mediaLibraryUrl, connectorsUrl, wpMediaUrl, version,
  aiConfigured, folders, settings: { default_view, thumbnail_size, items_per_page,
  startup_folder, default_upload_folder, auto_alt, ai_language, ai_model, ai_alt_length,
  ai_prompt, ai_context } }
```

## Key Conventions

- **Prefix:** `NHRSMM_` (constants), `nhrsmm_` (options, hooks, nonces, handles)
- **REST namespace:** `nhrsmm/v1` | **Taxonomy:** `nhrsmm_media_folder` | **CSS scope:** `.nhrsmm`
- **PHP 7.4+:** no union types in signatures; scalar return types only. Supported and tested through PHP 8.6. `composer.json` pins `config.platform.php` to 8.1 (the lowest PHPUnit 10 runs on) so dev dependencies work on every version CI tests with. When a PHP version reaches GA, move it from `include` into the `php` list in `php.yml` and add the next one as experimental.
- **AI:** use `wp_ai_client_prompt()` only — never call providers directly. Gate all AI UI on `Core\Ai::is_available()`: `wp_supports_ai()` alone is true on any site that has not disabled AI, even with no connector, so `is_available()` also asks the builder method `wp_ai_client_prompt()->is_supported_for_text_generation()` (a builder method; no global function of that name exists). Builder: `using_system_instruction()` → `with_text()` (or `with_file()`) → `generate_text()` returns `string|\WP_Error`. `is_supported_for_text_generation()` does NOT exist. AI Connectors page: `options-connectors.php`.
- **JS i18n:** `.eslintrc.js` has `allowedTextDomain: ['nhrrob-smart-media-manager']` configured. All `__()` / `_n()` calls need the text domain. `sprintf()` with placeholders needs a `// translators:` comment above it.
- **Docblocks:** PHP docblocks required on all public/protected methods (PHPCS enforces). JS inline comments for non-obvious WHY only — one line max.

## Testing Constraint (Brain Monkey / Patchwork)

**Never define WP functions as stubs in `bootstrap.php`.** Patchwork cannot intercept functions defined before `Monkey\setUp()` runs. Define all per-test overrides with `Functions\when()` or `Functions\expect()` inside test methods only. Only class stubs (e.g. `WP_Error`) are safe in bootstrap.

## Release Exclusions

`.distignore` (WP.org zip) and `.gitattributes` (git archive) must stay in sync. `vendor/` ships partially — autoloader + production deps only; dev packages excluded by path. `admin/build/` ships (never exclude it).

## CI (GitHub Actions)

A PR to `main` shows the **PHP Compatibility** checks (`PHPCS (WPCS + PHPCompatibilityWP)` and one `PHP x.y` per version) plus three more: `Run Plugin Check`, `Semgrep + PHPStan` and `Endpoint authorization probe` (the last two are the two jobs of `security.yml`).

| Workflow | Trigger | What it runs |
|---|---|---|
| `plugin-check.yml` | PR to `main` | Plugin Check on the repo checkout; dev-file notices (`hidden_files`, `.ai`, `.github`, `CLAUDE.md`) ignored |
| `security.yml` | PR to `main`, manual | Semgrep `p/php`, PHPStan level 0 (`.github/security/phpstan.neon`), and the endpoint probe: every plugin REST route and AJAX action called as subscriber and anonymous with nonces forced valid; fails on any success response or attempted DB write |
| `php.yml` | PR to `main`, manual | PHPCS with PHPCompatibilityWP (`testVersion` 7.4-), then per PHP version (7.4–8.5 required, 8.6 non-blocking until its GA): syntax check, PHPUnit (8.1+ only, PHPUnit 10 needs it), and `.github/ci/smoke.php` in a real WordPress (every GET route and read-only ability as admin; fails on any PHP notice from the plugin) |
| `deploy.yml` | tag push | Deploy to WordPress.org |

`.github/security/` is copied from `nhrrob-options-table-manager` (the reference). Run the probe locally:
`python3 .github/security/probe.py --wp "wp --path=$HOME/Sites/smm-shots" --script "$PWD/.github/security/endpoint-probe.php"` (with `PROBE_PLUGIN_DIR` set to the plugin's directory on that site).

Semgrep flags any `echo` whose expression contains a value derived from `$_GET`/`$_POST`, even through `selected()`. Call `selected()` / `checked()` as their own statements instead of concatenating their return value.

## Skills

- `/release_plugin` — version bump, PR, tag, publish procedure
