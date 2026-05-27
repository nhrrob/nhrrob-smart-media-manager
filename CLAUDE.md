# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Build Commands

```bash
npm run build   # production build → admin/build/
npm run start   # development watch mode
```

PHP has no build step. Composer autoload is pre-generated; run `composer dump-autoload` only when adding new classes to `includes/`.

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
| `Core\Ai` | `Core/Ai.php` | AI alt text via WP 7.0 `wp_ai_client_prompt()` |
| `Api\RestMedia` | `Api/RestMedia.php` | REST endpoints for all media operations |
| `Api\RestFolders` | `Api/RestFolders.php` | REST endpoints for folder CRUD and move |
| `Api\RestAi` | `Api/RestAi.php` | REST endpoint for AI alt text generation |
| `Api\RestSettings` | `Api/RestSettings.php` | REST GET/POST for plugin settings |
| `Activator` | `Activator.php` | Plugin activation tasks |
| `Deactivator` | `Deactivator.php` | Plugin deactivation tasks |

### Frontend

Two separate React bundles (both built with `@wordpress/scripts`):

| Entry | Output | Mount | JS Config |
|---|---|---|---|
| `admin/src/index.js` | `admin/build/index.js` | `#nhrsmm-app` | `window.nhrsmmConfig` |
| `admin/src/settings.js` | `admin/build/settings.js` | `#nhrsmm-settings-app` | `window.nhrsmmSettingsConfig` |

Media library state: `useReducer` + `AppContext` (`admin/src/context.js`). Components: `App`, `Sidebar`, `MainArea`, `DetailsPanel`, `UploadModal`, `Modals`.

Settings app: local `useState` per tab; saves via `fetch` POST to `/nhrsmm/v1/settings`.

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
- **AI:** `wp_ai_client_prompt()` only — never call any provider directly; gate all AI UI on `is_supported_for_text_generation()`

## Release Exclusions

The following dev-only files are excluded from both `.distignore` (WP.org distribution) and `.gitattributes` (git archive export). Any new dev-only file must be added to **both**.

Excluded: `CLAUDE.md`, `.ai/`, `admin/src/`, `node_modules/`, `.github/`, `.gitattributes`, `.gitignore`, `.distignore`, `package.json`, `package-lock.json`, `composer.lock`, `README.md`, and standard tooling files.

`admin/build/` is **NOT** excluded — compiled output must ship to WP.org.

## Skills

- `/release_plugin` — step-by-step release procedure (version bump, PR, tag, publish)
