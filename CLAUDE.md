# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build   # production build → admin/build/
npm run start   # development watch mode
```

**`node_modules` is dev-only.** All build outputs (`admin/build/`, `admin/svg/`, `admin/css/nhrsmm-icons.css`) are committed to git and work without it. Delete `node_modules` freely after finishing development; `npm install` restores it when needed again.

The only reason to run `npm install` is: building/watching JS, running lint/tests/e2e, or adding a new icon (needs `@tabler/icons` in `node_modules`).

PHP has no build step. `vendor/autoload.php` is pre-committed; run `composer dump-autoload` only when adding new classes to `includes/`.

## Linting & Formatting

```bash
npm run lint          # JS + CSS + PHP (all)
npm run lint:js       # wp-scripts lint-js admin/src
npm run lint:css      # wp-scripts lint-style admin/css/*.css
npm run lint:php      # phpcs via composer
npm run format:js     # wp-scripts format admin/src

composer run phpcbf   # auto-fix PHP CS violations
```

## Sandbox Environment (wp-env / Docker)

```bash
npm run env:start     # spin up WP on http://localhost:8888 (admin/password)
npm run env:stop      # stop containers
npm run env:clean     # wipe DB and uploads, keep containers
npm run env:destroy   # remove containers and volumes entirely
```

wp-env requires Docker Desktop running. Config: `.wp-env.json`.

## Testing

```bash
composer run test:unit          # PHPUnit unit tests (Brain Monkey, no DB)
npm run test:unit               # same, via npm proxy

npm run test:e2e                # Playwright E2E (requires wp-env running)
npm run test:e2e:ui             # Playwright in interactive UI mode
WP_BASE_URL=http://... npm run test:e2e  # override base URL
```

PHPUnit config: `phpunit.xml.dist`. Tests live in `tests/php/Unit/`.
Playwright config: `playwright.config.js`. Tests live in `tests/e2e/`.

### Test file inventory

| File | Coverage |
|---|---|
| `tests/php/Unit/TestCase.php` | Base class — wires Brain Monkey + Mockery per test |
| `tests/php/Unit/Core/FoldersTest.php` | `Core\Folders` — folder CRUD, tree builder |
| `tests/php/Unit/Core/AiTest.php` | `Core\Ai` — all paths in `generate_alt_text()` and `generate_caption()` |
| `tests/php/Unit/AssetsProviderLabelTest.php` | `Assets::get_ai_provider_label()` (private, via ReflectionMethod) |
| `tests/php/bootstrap.php` | Constants, `WP_Error` stub, Anthropic provider stub |
| `tests/e2e/media-library.spec.js` | Playwright E2E for media library |

### Critical: Brain Monkey / Patchwork constraint

**Never define WordPress functions as PHP function stubs in `bootstrap.php`.** Patchwork (used by Brain Monkey) cannot intercept functions that were defined before `Monkey\setUp()` runs. Define per-test overrides exclusively with `Functions\when()` or `Functions\expect()` inside test methods. Only class stubs (like `WP_Error`) are safe in bootstrap.

The "function not available" test pattern: simply don't call `Functions\when('wp_ai_client_prompt')` — `function_exists()` then returns false naturally.

## Node Version

Pin: Node 24 (`.nvmrc`). Run `nvm use` in the project root to switch.

## Architecture

### Boot Flow

`nhrrob-smart-media-manager.php` → `Nhrsmm_Smart_Media_Manager::init()` (singleton) → `plugins_loaded` → `init_plugin()` → `App::init()`:

1. `register_taxonomy()` — registers `nhrsmm_media_folder` hierarchical taxonomy on `init`
2. `new Assets()` — registers/enqueues scripts+styles on `admin_enqueue_scripts`; adds `nhrsmm-page` body class
3. `new Admin\MediaPage()` — adds Smart Media Library submenu page under Media
4. `new Admin\Settings()` — adds settings page under Settings menu
5. `rest_api_init` — registers all four REST controllers
6. `add_attachment` / `delete_attachment` — auto-assigns/removes default folder

### REST API (`nhrsmm/v1`)

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

Media routes require `upload_files`. Settings route requires `manage_options`.

### Class Responsibilities (`includes/`)

| Class | File | Job |
|---|---|---|
| `App` | `App.php` | Boot; registers taxonomy, wires all classes, REST routes, attachment hooks |
| `Assets` | `Assets.php` | Register/enqueue scripts+styles; localize config; body class filter |
| `Admin\MediaPage` | `Admin/MediaPage.php` | Adds media library submenu page; renders `#nhrsmm-app` mount point |
| `Admin\Settings` | `Admin/Settings.php` | Adds settings page; renders `#nhrsmm-settings-app` mount point |
| `Core\Media` | `Core/Media.php` | `WP_Query` media list, single get, update, move, bulk operations, usage search |
| `Core\Folders` | `Core/Folders.php` | Folder CRUD via `nhrsmm_media_folder` taxonomy terms; recursive tree builder |
| `Core\Ai` | `Core/Ai.php` | AI alt text and caption generation via WP 7.0 `wp_ai_client_prompt()` |
| `Api\RestMedia` | `Api/RestMedia.php` | REST endpoints for all media operations |
| `Api\RestFolders` | `Api/RestFolders.php` | REST endpoints for folder CRUD and move |
| `Api\RestAi` | `Api/RestAi.php` | REST endpoints for AI alt text (`/ai/alt-text`) and caption (`/ai/caption`) |
| `Api\RestSettings` | `Api/RestSettings.php` | REST GET/POST for plugin settings |
| `Activator` | `Activator.php` | Plugin activation tasks |
| `Deactivator` | `Deactivator.php` | Plugin deactivation tasks |

### Non-Obvious Implementation Details

**Asset manifests:** `@wordpress/scripts build` emits `admin/build/{name}.asset.php` alongside each JS bundle. `Assets::load_asset()` reads these to get the auto-detected `dependencies` array (WP packages like `wp-element` are listed here automatically) and a content-hash `version`. Never manually manage script dependencies — let the build tool generate these files.

**CSS is hand-crafted, not compiled:** `admin/css/nhrsmm-admin.css` is a plain CSS file maintained by hand, not a build output. All custom styles are scoped under the `.nhrsmm` wrapper class. `admin/css/nhrsmm-icons.css` is also hand-maintained — it maps `.ti-xxx` class names to SVG files in `admin/svg/` via `mask-image: url()`.

**Icons use CSS `mask-image` with SVG files** — no icon font or library ships to WP.org. The `<i className="ti ti-xxx">` pattern is preserved unchanged throughout the React components. `admin/svg/` holds 49 plain `.svg` files (Tabler Icons source). `admin/css/nhrsmm-icons.css` maps each `.ti-xxx` class to its SVG via `mask-image: url('../svg/xxx.svg')`. The `.ti` base class sets `display: inline-block; width/height: 1em; background-color: currentColor` so icons scale and inherit colour exactly like a font icon. See **Adding an icon** below.

**`Folders::get_counts()` uses a direct DB query** instead of `wp_term_taxonomy.count` because WordPress only calls `_update_post_term_count()` for published posts. Attachments use `post_status = 'inherit'` so their term counts are never updated by WP, making `count` always 0. The direct query counts `term_relationships` rows instead. The `// phpcs:ignore` comment suppresses the PHPCS direct-query warning — keep it.

**`_nhrsmm_filesize` post meta** is populated lazily in `format_attachment()` on first read, not on upload. This enables sort-by-size (`orderby=meta_value_num`) without a migration or upload hook. The meta key is internal and prefixed.

**Upload uses `async-upload.php`, not REST:** `UploadModal.js` posts to WP's legacy `async-upload.php` endpoint (with `action=upload-attachment` and the `media-form` nonce). After a successful upload, it makes a separate REST `POST /media/{id}/move` call to assign the folder. This two-step pattern exists because WP has no REST endpoint for initial file upload.

**`starredIds`, `thumbSize`, and `recentIds` are localStorage-only.** They are intentional client-side preferences that never sync to the DB. `thumbSize` (80–200 px integer, controls the CSS grid column size) is separate from `thumbnail_size` in plugin settings (`small|medium|large`, controls which WP image size is requested from the API).

### Adding an icon

Icons are plain SVG files from the [Tabler Icons](https://tabler.io/icons) library. All 49 current icons live in `admin/svg/`. No build step is needed — just two manual actions.

**Adding an outline icon (most icons):**

1. If `node_modules` has been deleted, run `npm install` first.
2. Copy the SVG from `node_modules/@tabler/icons/icons/outline/<name>.svg` → `admin/svg/<name>.svg`
3. Add one line to `admin/css/nhrsmm-icons.css` (keep alphabetical order):
   ```css
   .ti-<name> { -webkit-mask-image: url('../svg/<name>.svg'); mask-image: url('../svg/<name>.svg'); }
   ```
4. Use in JSX: `<i className="ti ti-<name>" />`

**Adding a filled icon** (solid/filled variant, e.g. `star-filled`):

Same steps, but source is `node_modules/@tabler/icons/icons/filled/<name>.svg`, copy to `admin/svg/<name>-filled.svg`, and CSS class is `.ti-<name>-filled`.

**Browse available icons:** https://tabler.io/icons — search by name, the filename matches the icon name exactly.

After copying the SVG and adding the CSS line, the icon works immediately — no `npm run build` required.

### Frontend

Two separate React bundles (both built with `@wordpress/scripts`):

| Entry | Output | Mount | JS Config global |
|---|---|---|---|
| `admin/src/index.js` | `admin/build/index.js` | `#nhrsmm-app` | `window.nhrsmmConfig` |
| `admin/src/settings.js` | `admin/build/settings.js` | `#nhrsmm-settings-app` | `window.nhrsmmSettingsConfig` |

#### Shared utilities

- `admin/src/context.js` — `AppContext`, `initialState`, `reducer`, `useApp()` hook
- `admin/src/api.js` — `apiFetch(method, path, body)`, exported `get/post/put/del`; handles both pretty and plain-permalink REST URLs (plain-permalink `rest_route=` param can't contain an embedded query string — `buildUrl()` promotes params to top-level)
- `admin/src/utils.js` — `formatBytes`, `formatDate`, `mimeToLabel`, `typeToIcon`, `iconForMime`, `copyToClipboard`, `getUrlParam`, `setUrlParams`, `findFolder`, `getFolderName`

#### `nhrsmmConfig` shape (media library page)

```js
{
  restUrl,          // REST base URL for nhrsmm/v1
  nonce,            // wp_rest nonce
  mediaUploadNonce, // media-form nonce (for async-upload.php)
  adminUrl,         // wp-admin URL
  pluginUrl,        // plugin root URL
  settingsUrl,      // options-general.php?page=nhrsmm-settings
  connectorsUrl,    // options-connectors.php  (WP 7.0 AI Connectors page)
  defaultView,      // 'grid' | 'list'
  thumbSize,        // 'small' | 'medium' | 'large'
  perPage,          // 20 | 40 | 60 | 100
  version,
  aiConfigured,     // bool — wp_supports_ai() result
  aiProvider,       // 'Anthropic' | 'OpenAI' | 'Google' | 'AI' | ''
  currentUserId,
}
```

#### `nhrsmmSettingsConfig` shape (settings page)

```js
{
  restUrl,
  nonce,
  mediaLibraryUrl,  // upload.php?page=nhrsmm-media-library
  connectorsUrl,    // options-connectors.php
  wpMediaUrl,       // upload.php
  version,
  aiConfigured,     // bool
  settings: { default_view, thumbnail_size, items_per_page },
}
```

#### Media library state (`context.js`)

Key state fields: `view`, `currentFolder`, `recentView`, `starredView`, `starredIds` (localStorage), `files`, `selection`, `detailsTarget`, `search`, `filterType`, `pagination`, `folders`, `uncategorizedCount`, `thumbSize` (localStorage), `sortBy`, `sortOrder`, `loading`, `uploadOpen`, `uploadInitialFiles`, `confirmModal`, `contextMenu`, `toast`.

### Settings

All settings stored in `nhrsmm_settings` WP option (array):

| Key | Values | Default |
|---|---|---|
| `default_view` | `grid`, `list` | `grid` |
| `thumbnail_size` | `small`, `medium`, `large` | `medium` |
| `items_per_page` | `20`, `40`, `60`, `100` | `40` |

Default upload folder stored separately in `nhrsmm_default_upload_folder` option (term ID, int).

## Key Conventions

- **Constant prefix:** `NHRSMM_` — all six constants defined in main plugin file
- **Option/hook/nonce prefix:** `nhrsmm_`
- **Script/style handles:** `nhrsmm-app`, `nhrsmm-settings`, `nhrsmm-admin`
- **REST namespace:** `nhrsmm/v1`
- **Taxonomy:** `nhrsmm_media_folder` (hierarchical, non-public)
- **CSS scope:** all styles scoped under `.nhrsmm` wrapper class
- **JS globals:** `nhrsmmConfig` (media library), `nhrsmmSettingsConfig` (settings page)
- **PHP:** 7.4+ compatible — no union types (`|`) in signatures; use scalar return types only
- **AI:** `wp_ai_client_prompt()` only — never call any provider directly; gate all AI UI on `wp_supports_ai()` (WP 7.0 core function); `is_supported_for_text_generation()` does NOT exist. Builder API: `using_system_instruction()`, `with_text()` for the prompt, `generate_text()` returns `string|WP_Error` directly. AI Connectors settings page: `options-connectors.php`.
- **Comments:** JS inline comments only for non-obvious WHYs (one line max). PHP docblocks required on all public/protected methods (PHPCS enforces this). No section-divider comments.
- **PHPCS intentional exclusions:** PSR-4 filenames (`Folders.php`, not `class-folders.php`) and short array syntax `[]` are allowed. Main plugin file mixing class + bootstrap function is the standard WP pattern — both exclusions are in `phpcs.xml.dist`.

## Release Exclusions

`.distignore` (WP.org zip) and `.gitattributes` (git archive) must stay in sync — add any new dev-only file to **both**.

`vendor/` ships **partially**: the autoloader and production deps are included; dev-only packages (PHPUnit, Brain Monkey, PHPCS, etc.) are excluded by path in `.distignore`. `admin/build/` is **not** excluded — compiled output must ship.

Excluded from both: `CLAUDE.md`, `.ai/`, `admin/src/`, `node_modules/`, `.github/`, config/tooling files, `tests/`, and dev-only vendor paths.

## Skills

- `/release_plugin` — step-by-step release procedure (version bump, PR, tag, publish)
