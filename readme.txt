=== NHR Smart Media Manager ===
Contributors: nhrrob
Tags: media library, media manager, folder, ai, alt text
Requires at least: 7.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI-powered WordPress media manager with folders, smart search, and one-click alt text generation.

== Description ==

NHR Smart Media Manager adds a powerful Smart Library page to your WordPress admin, giving you a clean, organized, and intelligent media management experience. It works alongside your existing WordPress media library and adds smart features baked in.

**Key Features:**

* **Virtual Folder System** — Create nested folders to organize your media. Folders are stored as a custom taxonomy and do not move files on disk.
* **Modern Grid & List View** — Beautiful grid or sortable list view with thumbnail size control.
* **File Details Panel** — Slide-in panel with editable title, alt text, caption, and description. See exactly where each file is used.
* **Bulk Operations** — Select multiple files and move or delete them at once.
* **Smart Search & Filters** — Search by filename, alt text, caption. Filter by file type. Shareable URL state.
* **AI Alt Text & Caption Generation** — Generate screen-reader-friendly alt text and captions for images with one click, using the WordPress AI connector you configure at Settings → Connectors.
* **Upload Enhancements** — Assign files to folders on upload, drag-and-drop from desktop, per-file progress bars.
* **Keyboard Shortcuts** — Full keyboard navigation (Escape, Delete, Ctrl+A, Shift+click range select, Arrow keys).

== External Services ==

This plugin does **not** connect to any external service directly. AI features (alt text and caption generation) use the WordPress core AI Client (`wp_ai_client_prompt()`), which routes requests through whichever AI provider connector you install and configure at **Settings → Connectors** in your WordPress admin.

The external service used — and any data sent to it — depends entirely on which AI connector plugin you activate. Please refer to that connector plugin's documentation for its privacy policy, terms of service, and data handling details.

No image data is stored by NHR Smart Media Manager beyond what is already in your WordPress media library.

== Installation ==

1. Upload the `nhrrob-smart-media-manager` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Go to **Media → Smart Library** to access the new media manager.
4. Optionally, go to **Settings → NHR Smart Media** to configure display defaults and view AI connector status.

== Frequently Asked Questions ==

= Does this add a new page or change the existing media library? =

The plugin adds a new "Smart Library" submenu item under the Media menu. Your existing WordPress media library and the native media modal remain completely unchanged.

= Do I need an AI provider to use this plugin? =

No. All features (folders, grid view, bulk operations, search) work without any AI provider. AI features (alt text and caption generation) require a compatible AI connector plugin installed and configured at Settings → Connectors.

= Where are my folders stored? =

Folders are stored as WordPress taxonomy terms (custom taxonomy `nhrsmm_media_folder`). Files are not physically moved on disk — it is a virtual organization layer.

= Does this work with popular plugins? =

Yes. The plugin only modifies the admin media library page. The native WordPress media modal used by page builders and the block editor is left untouched.

== Screenshots ==

1. Media library — grid view with folder sidebar
2. File details panel with AI alt text generation
3. List view with sortable columns
4. Upload modal with folder assignment
5. Settings page — display preferences and AI connector status

== Source Code ==

Full source code, including JavaScript source files and build tools, is available at:
https://github.com/nhrrob/nhrrob-smart-media-manager

To rebuild the JavaScript assets: `npm install && npm run build`

== Changelog ==

= 1.0.2 =
* Security: Added per-attachment permission checks on AI alt text, AI caption, and media usage REST API endpoints.

= 1.0.1 =
* Minor bug fixes and improvements.

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 1.0.0 =
Initial release.
