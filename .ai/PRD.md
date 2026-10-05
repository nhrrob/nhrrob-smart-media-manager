# PRD — Smart Media Manager (Free) — "NHR Smart Media Manager", slug `nhrrob-smart-media-manager`

Status: **1.0.3 released 2026-09-25** · **1.1.0 built and verified 2026-10-05** (uncommitted on `dev`, version bumped; Robin reviews, commits and tags) · Owner: Nazmul Hasan Robin (nhrrob)
Last revised: 2026-10-05 (competitor review of 17 plugins; every gap that is free somewhere else was built into 1.1.0)

> Dev-only document. Excluded from distribution (`.distignore` + `.gitattributes export-ignore`).
> PRO/monetization scope: **[PRD-PRO.md](./PRD-PRO.md)**.
> What already shipped is recorded in `readme.txt` (changelog + feature list), not here. Architecture, REST routes and storage are in the plugin's `CLAUDE.md`.

## 1. Principles (non-negotiable)

### 1.1 Minimal footprint

**The shipped plugin zip should not grow without a reason.** 1.1.0 breaks the "must not grow" rule on purpose and needs Robin's sign-off (§6): the distribution zip went from **112 KB (1.0.3) to 174 KB**, because 26 features were added and nothing was removed. Measured with `wp dist-archive` on 2026-10-05.

What was done to keep it down:

- No runtime PHP dependencies, no JS or CSS libraries. `vendor/` is dev-only.
- ZIP download is a 90-line stored-ZIP writer in the browser, not a library and not server code.
- The media modal integration is one hand-written script (`admin/js/nhrsmm-media-modal.js`, 4 KB), not a second React bundle.
- The gallery block reuses the core `[gallery]` output; its editor script is 2.4 KB.
- Five new icons only (Tabler SVG, CSS mask).

From 1.1.0 on, **174 KB is the budget**: a new feature needs an equal removal or an explicit decision. Run `check:pcp` and a zip-size diff before every release.

### 1.2 No PRO in the free codebase

The free plugin carries **no PRO surface and no PRO wording**: no badges, no upgrade screen or link, no disabled "premium" controls, no "PRO" in code comments or UI strings. It will only expose a neutral **add-on API** (§3). Checked 2026-10-05: no such wording exists in the codebase.

**Anything free in another plugin is free here.** The full rule is [PRD-PRO.md](./PRD-PRO.md) §0.

### 1.3 No custom database tables

Settings live in one option (`nhrsmm_settings`). Everything else uses core storage: taxonomy terms and term meta (folders, color, order), the `menu_order` column (custom file order), user meta (starred, recent) and post meta (`_nhrsmm_filesize`, `_nhrsmm_unused`). `uninstall.php` removes all of it on every site.

### 1.4 Nothing the WordPress.org review team could object to

- No external requests by the plugin itself. AI goes through the core AI Client only, and every case where an image is sent is listed in the readme's External Services section.
- Alt text on upload is **off by default**.
- No server-side archive building, temp files or streamed downloads.
- Plugin Check must be clean on the plugin's own files before release.

## 2. Product

**Positioning (decided 2026-10-05):** a media folder manager that matches the free tier of FileBird, Real Media Library and Folders, with AI metadata as the reason to pick it over them. The folder competitors have no AI; the AI alt text plugins charge per image or need their own API key and have no folders.

**One home per action.** A new feature must slot into one of these places.

| Surface | Owns |
|---|---|
| **Smart Library** (Media → Smart Library) | Folder tree, grid and list, search, sort, filters, details panel, bulk bar, uploader |
| Smart Library → **Library views** | All Files, Recent, Starred, Missing alt text, Unused, Trash |
| Smart Library → **Sidebar tools** | Export / import folder structure, import from another plugin |
| **Media → Library** (core screen) | Folder dropdown in grid and list view |
| **Media modal** (block editor, featured image, page builders) | Folder tree, folder dropdown on narrow screens, upload into the selected folder |
| **Block editor** | Folder Gallery block and `[nhrsmm_gallery]` shortcode |
| **Settings → NHR Smart Media** | General (view, thumbnails, startup folder, default upload folder) and AI (alt text on upload, language, length, page context, extra instructions) |
| **WP-CLI** | `wp nhrsmm alt` |

## 3. Architecture constraints

- **REST only** (`nhrsmm/v1`). The only non-REST entry points are core's own: `async-upload.php` for uploads and `query-attachments` for the media modal.
- **Two-layer auth:** route gate `manage_categories` (folders are shared terms, so Editor and above), plus per-attachment `edit_post` / `delete_post` on every ID-taking route. Settings need `manage_options`. The media modal filter is read-only and available to anyone with `upload_files`.
- **AI:** `wp_ai_client_prompt()` only, gated on `wp_supports_ai()`. Requires WordPress 7.0, which is why `Requires at least` is 7.0.
- **PHP 7.4:** no union types, no PHP 8 syntax.
- **Multisite:** folders and settings are per site (taxonomy terms and a per-site option). Uninstall loops every site. No Network Admin screen.
- **Add-on API: not built yet.** The free plugin has no extension points today. Before any add-on can exist it needs, at minimum: a PHP filter on the app boot payload (`window.nhrsmmConfig`), a PHP action after the app script is enqueued, a filter on the list query arguments, and a JS filter for extra sidebar views and bulk actions. Add these only when the add-on work starts (PRD-PRO §6), not before.

## 4. Release 1.1.0

### 4.1 Built 2026-10-05 (the 26 gaps from the competitor review)

Each item was missing in 1.0.3 and is free in at least one other plugin (§8).

**Expected in every folder plugin**

1. Folder tree and filter in the media modal; upload into the selected folder.
2. Folder dropdown on Media → Library, grid and list view.
3. Import from FileBird, Real Media Library, CatFolders, Folders (Premio), Enhanced Media Library, Wicked Folders, Media Library Organizer, Mediamatic, HappyFiles, WP Media Folder. Read-only on the source, batched 500 files per request.
4. Export and import of the folder structure as JSON.
5. Folder search, collapsible and resizable sidebar.
6. Startup folder setting; default upload folder setting (the option existed in 1.0.3 but had no UI).
7. Search matches file name and alt text (1.0.3 claimed this but only searched title and caption).
8. Trash with restore; delete no longer removes files permanently in one step.

**AI and metadata**

9. Missing alt text view with a count.
10. Bulk AI alt text for a selection, or for every image missing it.
11. Alt text on upload (opt-in, background cron event per image).
12. Bulk edit of title, alt text, caption, description.
13. AI options: language, maximum length, extra instructions, page title and SEO focus keyphrase as context (Yoast SEO, Rank Math, SEOPress).
14. AI title and description.
15. `wp nhrsmm alt` WP-CLI command.

**File management**

16. Replace a file and keep its URL (same file type only).
17. Download a selection or a folder with subfolders as a ZIP (built in the browser).
18. Folder colors.
19. Manual folder order; custom file order (drag and drop under the "Custom Order" sort).
20. Sort by date modified and uploader; filter by upload date and own uploads, combined with the type filter.
21. Upload a desktop folder and keep its subfolders.
22. A file in several folders (Add in the bulk bar and details panel; Shift-drop onto a folder).
23. Folder Gallery block and shortcode.
24. Wider "Used In" detection (custom fields, page builder data, product galleries, site logo) and an Unused view with a library scan.
25. Starred and Recent saved per user account.
26. Multisite-safe uninstall; RTL borders.

Also fixed: dragging a multi-file selection onto a folder did nothing in 1.0.3; the bulk bar was positioned off-screen on short windows.

### 4.2 Known limits (accepted for 1.1.0)

- **Media modal:** the tree filters and sets the upload folder. You cannot drag files onto a folder or create folders inside the modal; that is done in Smart Library.
- **ZIP:** held in browser memory, uncompressed, folder list capped at 2,000 files. Fails if files are served from another origin without CORS (offloaded media).
- **Unused scan:** does not see files referenced only from theme files, CSS, or options other than the site icon and logo. The view says so. The scan runs only while its window is open.
- **Replace file:** same MIME type only. A large image that WordPress stored as `-scaled` can get a new URL if the replacement is small enough not to be scaled.
- **Custom file order** is one order per file (`menu_order`), not one per folder.
- **Filter by uploader** is "only my uploads", not a user picker.

### 4.3 Release gate

Done 2026-10-05, on the final code: PHPCS clean · ESLint and Stylelint clean · 64 unit tests pass · every plugin file lints under PHP 7.4.33 · Plugin Check clean on the plugin's own files (only the known dev-file notices) · **12 Playwright e2e tests pass** (6 existing, 6 new: upload into a folder, trash and restore, bulk edit, Missing alt text view, media modal tree, list-view filter), run against the local site `~/Sites/smm-shots` because Docker was not available for wp-env · permission probe: all 90 route/method combinations refused for anonymous, subscriber and author · **importer run against real installs** of FileBird, Real Media Library, CatFolders, Mediamatic, Folders (Premio), Enhanced Media Library and Media Library Organizer (their own tables and taxonomies, rows inserted by SQL; Mediamatic needed a fix because it now uses its own tables) · **multisite** on `~/Sites/otm-ms`: network activation, separate folders and settings per site, uninstall removes everything on every site · **RTL** checked visually with a forced right-to-left admin (library and media modal mirror correctly) · desktop-folder traversal tested with mock directory entries (nested folders, hidden files, batched readers) · ZIP writer validated against Python's `zipfile` · in the browser: bulk AI, replace file, alt text on upload, gallery block · version bumped to 1.1.0 · new banner and 8 screenshots in `.wordpress-org` · doc sync (readme, CLAUDE.md, this PRD).

**Still open before tagging:**

- **Robin's decisions** in §6 (zip size, `Requires at least`).
- A human dropping a real folder from the desktop once (the traversal logic is tested, the browser drop event is not).
- The plugin was syntax-checked on PHP 7.4, not run on it.
- Wicked Folders, HappyFiles and WP Media Folder imports are unverified: media folders are paid-only in all three. The Wicked taxonomy name follows its confirmed `wf_{post_type}_folders` pattern; `happyfiles_category`, `wpmf-category` and the older Mediamatic taxonomy `mediamatic_wpfolder` are from memory.
- Screenshots were taken on a site with no AI connector, so they show no AI status or AI buttons. Retake 2 and 3 on a connected site if the listing should show AI in action.
- Unit tests for `Usage` and `Importer` (both mostly SQL; tested against real databases instead).
- Review, commit, tag (Robin).

### 4.4 Backlog (free, not built)

Found free in another plugin on 2026-10-05, so they can only ever be free here (PRD-PRO §0). Neither is in 1.1.0; each needs a zip-size decision first (§1.1).

- **Alt text audit:** flag generic ("image", "logo", a file name), too-short and duplicated alt text next to the existing Missing alt text view. Rule-based, no AI needed. Free in Filikod.
- **Duplicate file finder:** identical files by content hash, with where each copy is used. Free in Filikod.

Smaller competitor features seen in the 2026-10-05 review and not built. None was judged worth the weight yet; listed so they are not rediscovered later.

- **Folder tree extras:** clone a folder (Wicked Folders), select several folders to delete at once (FileBird, Folders, Wicked), create several folders in one go (Folders), flat tree view and folder icon themes (FileBird Pro).
- **Inside the media modal:** drag files onto a folder and create folders there (FileBird, Real Media Library). Today that is done in Smart Library (§4.2).
- **Default attributes per file type** on upload (Media Library Organizer, free).
- **Uploader filter as a user picker** instead of "only my uploads" (§4.2).
- **Per-folder custom file order** (Real Media Library); today the order is per file (§4.2).
- **Duplicate a file, ZIP upload with auto-extract** (Media Library Organizer Pro).
- **Background removal** (Enable Media Replace, through ShortPixel's service): needs an external service, so not a fit (§1.4).

## 5. Not planned (would add weight or risk without clear demand)

Revisit only on real user requests. Anything here is still free if it ever ships, unless PRD-PRO §3 lists it.

- **AI file rename.** Free in AltGenix, so it could never be PRO; renaming changes URLs and breaks references that cannot all be found.
- **Folders for posts, pages and custom post types.** Wicked Folders and Folders (Premio) do this free; it is a different product from a media manager.
- **Image compression, WebP/AVIF conversion, thumbnail regeneration.** An optimizer plugin's job.
- **SVG upload.** Safe SVG (1M+ installs) does it; sanitizing SVG is a security responsibility not worth taking on here.
- **Physical folders on disk / changing file URLs.** Breaks links; the virtual model is the selling point.
- **File access protection, private URLs, hotlink blocking.** Needs server rules; high support cost.
- **Per-user private folder trees.** Free in FileBird, so it could only ever be free here; it complicates every query and the permission model. Wait for demand.
- **EXIF/IPTC mapping, custom media taxonomies, MIME type manager.** Media Library Assistant and Enhanced Media Library own this niche.
- **Undo for the last action.** Trash already covers the destructive case.
- **Server-side ZIP, cloud storage connectors, FTP sync.**

## 6. Open decisions

- **Zip size:** accept 174 KB as the new baseline (§1.1), or cut features to get closer to 112 KB? Candidates to cut if needed: gallery block, unused scan, the importer sources that could not be verified.
- **`Requires at least: 7.0`:** only AI needs 7.0. Lowering it would reach far more sites, since folder competitors support much older versions. Not changed without Robin's confirmation.
- **Banner and screenshots (done 2026-10-05, Robin to approve):** the banner was redrawn from `banner-source.svg` with a folder tree and an AI alt text chip, and eight screenshots were taken from demo content on `smm-shots`. Replace either if they do not match the look you want.
- **Modal tree depth:** add drag-to-folder and folder creation inside the modal, or leave that to Smart Library (§4.2)?

## 7. Decided (don't relitigate)

- **Free vs PRO line (2026-10-05):** all 26 items in §4.1 are free because each is free in at least one other plugin. PRO is only what nobody gives away (PRD-PRO §3).
- **Media modal integration is vanilla JS on the core media views,** not a React app injected into the modal.
- **ZIP is built in the browser** to avoid server-side archive code and streamed responses (§1.4).
- **Delete means trash.** Permanent delete is only available from the Trash view.
- **One folder taxonomy, shared by all users.** Route gate stays `manage_categories` (decided in 1.0.3).
- **Name and tags (2026-10-05):** display name **NHR Smart Media Manager – Media Library Folders & AI Alt Text**; in-app title stays "Smart Media Manager". Tags: `media library folders, media folders, file manager, alt text, ai`.
- **The slug, text domain, `nhrsmm` prefixes and REST namespace never change.**

## 8. Sources

Checked 2026-10-05 from the WordPress.org listings (descriptions and free/Pro notes); none of the plugins were installed, except that the source of the eight folder plugins was read for their storage schema.

- FileBird (200k installs): https://wordpress.org/plugins/filebird/ — free: unlimited folders and subfolders, modal tree, import, export, per-user folders, startup folder, gallery block; Pro: sort options, sort by size, folder colors, ZIP download, post-type folders.
- Real Media Library (100k): https://wordpress.org/plugins/real-media-library-lite/ — free: modal filter, shortcuts (file in several folders), custom order, folder upload, gallery, multisite, import.
- Folders by Premio (90k): https://wordpress.org/plugins/folders/ — free: folder colors, media replace, import/export, undo, multiple folders; Pro: subfolders, dynamic folders, unused media cleanup.
- Media Library Organizer (20k): https://wordpress.org/plugins/media-library-organizer/ — free: ZIP export, default attributes; Pro: AI image categorization, advanced search, duplicate file, ZIP upload, EXIF/IPTC.
- Wicked Folders (20k): https://wordpress.org/plugins/wicked-folders/ — media folders are Pro; free has colors, dynamic folders (posts only), breadcrumbs.
- CatFolders (6k): https://wordpress.org/plugins/catfolders/ — Pro: subfolders, sort options, folder permissions.
- Mediamatic (1k): https://wordpress.org/plugins/mediamatic/ — free: media replace, CSV export; Pro: subfolders, colors, per-user folders, role permissions, ZIP.
- Media Library Assistant (70k), Enhanced Media Library (60k), Media Library Helper (10k): bulk metadata editing, taxonomy filters, missing-alt search — all free.
- AltText.ai (20k): https://wordpress.org/plugins/alttext-ai/ — paid credits; auto on upload, bulk, WP-CLI, SEO keyphrase, 130 languages.
- AI Alt Text Generator (2k): https://wordpress.org/plugins/ai-alt-text-generator/ — 50 free images a month or own API key; page context, keyphrase.
- Media File Renamer (40k): AI rename is Pro. Enable Media Replace (600k): free replace. Media Cleaner (90k): free unused scan with trash; page builder support and filesystem scan are Pro.
