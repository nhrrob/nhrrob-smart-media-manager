=== NHR Smart Media Manager – Media Library Folders & AI Alt Text ===
Contributors: nhrrob
Tags: media library folders, media folders, file manager, alt text, ai
Requires at least: 7.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Media library folders with a folder tree in the media modal, bulk editing, trash, and AI alt text through your own WordPress AI connector.

== Description ==

NHR Smart Media Manager organizes your WordPress media library into folders and writes alt text with AI. It adds a Smart Library page under Media, puts a folder tree in the media modal used by the block editor and page builders, and adds a folder filter to the Media Library. Folders are virtual, so file URLs never change.

**Key Features:**

* **Virtual Folder System** — Create nested folders to organize your media. Folders are stored as a custom taxonomy and do not move files on disk. Give folders a color, drag them into your own order, and search the folder tree.
* **Folders in the Media Library and Media Modal** — The media modal used by the block editor, featured image picker, and page builders gets a folder tree, and Media → Library (grid and list view) gets a folder dropdown. Files uploaded there go into the selected folder.
* **Import and Export** — Import folders and file assignments from FileBird, Real Media Library, CatFolders, Folders, Enhanced Media Library, Wicked Folders, Media Library Organizer, Mediamatic, HappyFiles, and WP Media Folder. Export your folder structure as a JSON file and import it on another site.
* **Modern Grid & List View** — Grid or sortable list view with thumbnail size control. Sort by date added, date modified, name, size, uploader, or your own custom order.
* **File Details Panel** — Slide-in panel with editable title, alt text, caption, and description. See where each file is used: post content, featured images, custom fields, page builder data, product galleries, and the site logo.
* **Files in Several Folders** — Keep one file in more than one folder without duplicating it.
* **Bulk Operations** — Select multiple files and move them, add them to a folder, edit their title, alt text, caption, and description together, download them as a ZIP, or move them to the trash.
* **Trash and Restore** — Deleted files go to a Trash view first, where they can be restored or deleted permanently.
* **Replace File** — Upload a new version of a file. The URL and every place the file is used stay the same.
* **Download as ZIP** — Download a selection or a whole folder with its subfolders as one ZIP file.
* **Smart Search & Filters** — Search by title, file name, alt text, and caption. Filter by file type, upload date, and your own uploads at the same time. Shareable URL state.
* **Missing Alt Text View** — See every image without alt text, with a live count.
* **Unused Files View** — Scan the library for files with no reference in post content, featured images, custom fields, page builder data, product galleries, or the site logo. Files used only in theme files or CSS are not detected, so review the list before deleting.
* **AI Alt Text, Captions, Titles & Descriptions** — Generate text for a file with one click, for a selection, or for every image missing alt text, using the WordPress AI connector you configure at Settings → Connectors. Optionally write alt text automatically on upload. Choose the language, maximum length, extra instructions, and whether to use the page title and SEO focus keyphrase (Yoast SEO, Rank Math, SEOPress) as context.
* **Upload Enhancements** — Assign files to folders on upload, drag-and-drop files or whole folders from your desktop (subfolders are kept), per-file progress bars, and a default upload folder.
* **Folder Gallery Block & Shortcode** — Show the images of a folder as a gallery with the Folder Gallery block or `[nhrsmm_gallery folder="12"]`.
* **Starred & Recent** — Star files and reopen recent ones. Both lists are saved to your user account.
* **WP-CLI** — `wp nhrsmm alt --limit=200` generates alt text for images that have none.
* **Multisite** — Each site in a network has its own folders and settings.
* **Keyboard Shortcuts** — Full keyboard navigation (Escape, Delete, Ctrl+A, Shift+click range select, Arrow keys).

== External Services ==

This plugin does **not** connect to any external service directly.

AI features (alt text and caption generation) are optional. When you trigger them, this plugin reads the image file from your server and passes it to the **WordPress core AI Client** (`wp_ai_client_prompt()`). The AI Client then transmits the image data to whichever external AI provider you have installed and configured at **Settings → Connectors** in your WordPress admin (for example, the official Anthropic or OpenAI connector plugins).

**What data is sent:** the image file and a short text prompt describing the task (e.g. "write alt text for this image").

**What data is sent:** see above. When "Use Page Context" is enabled in the plugin settings, the title of the page the file is attached to and that page's SEO focus keyphrase are included in the prompt. Any text you enter under "Extra Instructions" is included as well.

**When data is sent:**

* when you click a generate button on an individual file (alt text, caption, title, or description);
* when you start a bulk generation for selected images or for all images missing alt text (each image is sent one at a time while the progress window is open);
* when you run the `wp nhrsmm alt` WP-CLI command;
* automatically for each newly uploaded image, only if you turn on "Alt Text on Upload" in the plugin settings. This option is off by default.

**Where data goes:** to the external AI service you configure. This plugin has no control over, and takes no responsibility for, that service's data handling. Please refer to the connector plugin's documentation for its privacy policy and terms of service.

No image data is stored by NHR Smart Media Manager beyond what is already in your WordPress media library.

== Installation ==

1. Upload the `nhrrob-smart-media-manager` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Go to **Media → Smart Library** to access the new media manager.
4. Optionally, go to **Settings → NHR Smart Media** to configure display defaults and view AI connector status.

== Frequently Asked Questions ==

= Does this add a new page or change the existing media library? =

The plugin adds a new "Smart Library" submenu item under the Media menu. Your existing WordPress media library and the media modal keep working as before; the plugin adds a folder tree to the media modal and a folder dropdown to the Media Library so you can filter by folder and upload into a folder.

= Do I need an AI provider to use this plugin? =

No. All features (folders, grid view, bulk operations, search) work without any AI provider. AI features (alt text and caption generation) require a compatible AI connector plugin installed and configured at Settings → Connectors.

= Where are my folders stored? =

Folders are stored as WordPress taxonomy terms (custom taxonomy `nhrsmm_media_folder`). Files are not physically moved on disk — it is a virtual organization layer.

= Does this work with popular plugins? =

Yes. Folders are virtual, so file URLs never change. The folder tree appears in the standard WordPress media modal, which page builders and the block editor use.

= What happens when I delete a file? =

It is moved to the Trash view, where you can restore it or delete it permanently. WordPress empties trashed items after 30 days by default.

= Can I move my folders from another plugin? =

Yes. Open Smart Library and use the plug icon at the bottom of the folder sidebar. Folders and file assignments are copied; the other plugin's data is not changed.

== Screenshots ==

1. Smart Library: folder tree with colors and a folder's files in the grid
2. File details panel: alt text, title, caption, description, and folders
3. Bulk bar: move, add to a folder, edit, download as ZIP, or trash the selected files
4. Missing alt text view
5. List view with sortable columns
6. Folder tree in the media modal used by the block editor and page builders
7. Upload modal: drop files or whole folders and pick the target folder
8. Settings: AI options for language, length, page context, and alt text on upload

== Source Code ==

Full source code, including JavaScript source files and build tools, is available at:
https://github.com/nhrrob/nhrrob-smart-media-manager

To rebuild the JavaScript assets: `npm install && npm run build`

== Changelog ==

= 1.1.0 =
* New: Folder tree in the media modal and folder dropdown in Media → Library (grid and list), with upload into the selected folder.
* New: Import folders from FileBird, Real Media Library, CatFolders, Folders, Enhanced Media Library, Wicked Folders, Media Library Organizer, Mediamatic, HappyFiles, and WP Media Folder.
* New: Export and import the folder structure as JSON.
* New: Folder colors, manual folder order, folder search, collapsible and resizable sidebar, breadcrumb path.
* New: Startup folder and default upload folder settings.
* New: Trash view with restore; deleting a file now moves it to the trash first.
* New: Missing alt text view and Unused files view with a library scan.
* New: Bulk edit of title, alt text, caption, and description.
* New: Bulk AI alt text, AI titles and descriptions, optional alt text on upload, and AI options (language, length, page context, extra instructions).
* New: `wp nhrsmm alt` WP-CLI command.
* New: Replace a file while keeping its URL.
* New: Download a selection or a folder as a ZIP.
* New: Keep a file in several folders; hold Shift while dropping files on a folder to add instead of move.
* New: Sort by date modified, uploader, or a custom drag-and-drop order; filter by upload date and your own uploads.
* New: Upload whole folders from your desktop and keep their structure.
* New: Folder Gallery block and `[nhrsmm_gallery]` shortcode.
* New: Starred and Recent lists are saved per user account.
* Improved: Search now matches file names and alt text.
* Improved: "Used In" also checks custom fields, page builder data, product galleries, and the site logo.
* Improved: Uninstall cleans up every site in a multisite network.
* Fixed: Dragging a multi-file selection onto a folder now moves all selected files.
* Fixed: The bulk action bar could sit below the visible area on short windows.
* Fixed: AI was shown as connected, and AI buttons were offered, on sites with no AI connector configured.
* Fixed: Files that also had terms from another plugin's taxonomy were counted as Uncategorized.

= 1.0.3 =
* Security: All plugin routes now require Editor+ (manage_categories). Folders are shared taxonomy terms — restricting to upload_files allowed any uploader to modify the global folder structure.


= 1.0.2 =
* Security: Added per-attachment permission checks on AI alt text, AI caption, and media usage REST API endpoints.

= 1.0.1 =
* Minor bug fixes and improvements.

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 1.1.0 =
Folders in the media modal and Media Library, import from other folder plugins, trash, bulk editing, and bulk AI alt text. Deleting a file now moves it to the trash first.

= 1.0.0 =
Initial release.
