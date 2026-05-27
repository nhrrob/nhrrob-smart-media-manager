=== NHR Smart Media Manager ===
Contributors: nhrrob
Tags: media library, media manager, folder, ai, alt text, media organizer, file manager
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.0
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
* **AI Alt Text Generation** — Generate accurate, screen-reader-friendly alt text for images using OpenAI gpt-4o-mini with one click.
* **Upload Enhancements** — Assign files to folders on upload, drag-and-drop from desktop, per-file progress bars.
* **Keyboard Shortcuts** — Full keyboard navigation (Escape, Delete, Ctrl+A, Shift+click range select, Arrow keys).

== External Services ==

This plugin connects to the OpenAI API (https://api.openai.com) when the AI Alt Text feature is used.

* **Data sent:** The URL of the image you choose to generate alt text for.
* **When sent:** Only when you explicitly click "Generate Alt Text" on a specific image.
* **Who:** OpenAI, LLC (https://openai.com)
* **OpenAI Terms of Service:** https://openai.com/terms
* **OpenAI Privacy Policy:** https://openai.com/privacy

You must provide your own OpenAI API key. The API key is stored encrypted in your WordPress database and is never exposed to the browser.

No image data is stored by NHR Smart Media Manager beyond what is already in your WordPress media library.

== Installation ==

1. Upload the `nhrrob-smart-media-manager` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Go to **Media → Smart Library** to access the new media manager.
4. Optionally, go to **Settings → NHR Smart Media** to configure AI features and display defaults.

== Frequently Asked Questions ==

= Does this add a new page or change the existing media library? =

The plugin adds a new "Smart Library" submenu item under the Media menu. Your existing WordPress media library and the native media modal remain completely unchanged.

= Do I need an OpenAI API key? =

Only for the AI Alt Text feature. All other features (folders, grid view, bulk operations, search) work without any API key.

= Where are my folders stored? =

Folders are stored as WordPress taxonomy terms (custom taxonomy `nhrsmm_media_folder`). Files are not physically moved on disk — it's a virtual organization layer.

= Is my API key secure? =

Yes. The API key is encrypted using AES-256-CBC with your WordPress `SECURE_AUTH_KEY` before being stored in the database. It is never output to any HTML page or JavaScript variable.

= Does this work with popular plugins? =

Yes. The plugin only modifies the admin media library page. The native WordPress media modal used by page builders and the block editor is left untouched.

== Screenshots ==

1. Media library — grid view with folder sidebar
2. File details panel with AI alt text generation
3. List view with sortable columns
4. Upload modal with folder assignment
5. Settings page — AI configuration

== Changelog ==

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 1.0.0 =
Initial release.
