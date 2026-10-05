# PRD — Smart Media Manager PRO

Status: **proposal, nothing built** · Owner: Nazmul Hasan Robin (nhrrob)
Code: none yet. If built, a separate private add-on plugin (`nhrrob-smart-media-manager-pro`), never inside the free plugin.
Last revised: 2026-10-05 (first draft from the competitor review behind free 1.1.0; same day: three AI candidates added, and Duplicate Finder, AI File Rename and an alt text audit moved out after a WordPress.org search found each one free)

> Dev-only document. Excluded from distribution (`.distignore` + `.gitattributes export-ignore`).
> Free/core scope: **[PRD.md](./PRD.md)**.
> Everything below marked *proposed* is a recommendation for Robin to confirm, not a decision.

## 0. The free-vs-PRO rule (non-negotiable)

1. **If a feature is free in any other WordPress plugin, it is free here.** It goes in the free PRD, not in PRO.
2. **If a feature is listed in the free PRD, it is free,** even if an older PRO draft claimed it.
3. **PRO carries major features only.** Each one must solve a real job someone would pay for. No padding with minor add-ons.
4. **Re-check before building.** Competitor tiers drift. Re-verify each feature's market status (§3) before it is built, and move it to free if it has gone free elsewhere.

The 2026-10-05 market check was done from WordPress.org listings only. It can show that a feature is free somewhere; it cannot prove a feature is free nowhere. Every item in §3 needs the rule-4 check against pricing pages and smaller plugins before any code is written.

## 1. Locked decisions

| Decision | Choice |
|---|---|
| Delivery | **Separate PRO add-on plugin** with `Requires Plugins: nhrrob-smart-media-manager`. The free plugin has no add-on API yet; the minimal contract is listed in PRD §3 and gets built when PRO work starts. |
| Licensing/billing | **Freemius**, in the add-on only, never in free *(proposed, same as the Database Cleaner add-on)* |
| Free-side discoverability | None. The free codebase never mentions PRO (PRD §1.2). |
| Storage | No custom tables in the add-on either. Capped, non-autoloaded options and core meta only. |

## 2. Who pays, and why

The free plugin gives away everything the folder plugins charge for. PRO sells **one story: a large media library that organizes and describes itself, without someone doing it by hand.**

| Buyer | Job | PRO features |
|---|---|---|
| Content-heavy sites (news, stores, photographers) with thousands of files | "New uploads should land in the right folder with proper alt text, the backlog should get fixed without me clicking through it, and I should be able to find any image by describing it." | AI Auto-Sort, Smart Folders, Scheduled AI Backfill, Search by Content |
| Agencies and multi-author sites | "Clients and authors should only see and change the folders they are meant to." | Folder Permissions |

## 3. PRO candidates (market-checked 2026-10-05, listings only)

Seven candidates. Recommended for a 1.0: **3.1, 3.2 and 3.3** (they tell the §2 story together), with **3.4 Search by Content** as the strongest follow-up. 3.5 to 3.7 are weaker or riskier and should wait for demand.

### A. AI automation

#### 3.1 AI Auto-Sort
- Suggests or applies a folder for each new upload, based on the image content and the existing folder names.
- "Sort this folder" and "Sort Uncategorized" for the backlog, with a review step before anything moves.
- Can propose new folders when nothing fits; never creates them without confirmation.
- Every move is listed so it can be undone as a batch.

*Market:* Media Library Organizer Pro has "AI image categorization". No free plugin found. *Verify* how MLO's works (their own service or the user's key) and whether any free plugin does it.

#### 3.2 Smart Folders
- Saved rules that behave like folders: file type, size, upload date, uploader, missing alt text, unused, dimensions, attached-to post type, and AI tags if 3.5 exists.
- Shown in the sidebar and in the media modal tree.
- Builds on the free filters; the free plugin keeps every individual filter.

*Market:* "Dynamic folders" for media are Pro in Folders (Premio) and Wicked Folders. Wicked's free version has dynamic folders for posts and pages only. *Verify* that no free plugin offers saved rule-based media folders.

#### 3.3 Scheduled AI Backfill
- Works through every image missing alt text (and optionally captions and titles) in the background, a few per cron run, with a daily cap the owner sets.
- Pauses on provider errors or rate limits and reports what is left.
- The free plugin keeps bulk generation while the window is open, alt text on upload, and WP-CLI.

*Market:* AltText.ai and AI Alt Text Generator do bulk generation through their own paid credits. AltGenix (free, 20 installs) processes "pending images in the Bulk Optimizer" with the user's own key, but from an open screen, not unattended. No plugin found that runs an unattended backlog against the site's own AI connector. *Verify.* Risk: sending images to an AI provider on a schedule needs a very clear consent screen and readme disclosure in the add-on.

#### 3.4 Search by Content
- Find images by what is in them ("red shoes on a beach", "team photo outdoors") without anyone having tagged them.
- Works from an AI description stored once per image (post meta, capped length), so a search itself makes no AI request.
- The description is produced with the alt text in the same AI call where possible, to avoid paying the provider twice.
- The easiest PRO feature to demonstrate.

*Market:* a WordPress.org search on 2026-10-05 ("ai image search media library", "semantic search media library") found nothing that searches the media library by image content. AI Search and Mori AI Search do semantic search for posts and products on the front end. Lens Media Library Folders (80 installs) lists "smart search", which appears to be folder-name search. *Verify* Lens and the premium folder plugins.

#### 3.5 AI Tags
- Automatic keywords per image, stored as terms in a second, non-public taxonomy.
- Filter by tag in Smart Library; usable as a Smart Folders rule (3.2).
- Only worth building together with 3.2 or 3.4; on its own it is a minor add-on (§0 rule 3).

*Market:* nothing found on WordPress.org ("ai image tagging media", "auto tag images ai"). Media Library Organizer Pro's AI categorization may overlap. *Verify.*

### B. Control and reach

#### 3.6 Folder Permissions
- Per role or per user: which folders can be seen, uploaded to, and changed.
- Enforced in the REST routes and in the media modal query, not only hidden in the UI.

*Market:* Pro in CatFolders and Mediamatic. Lens Media Library Folders advertises "role-based permissions"; its listing did not make clear whether that is in the free version — **check this first**, because if it is free there, this feature cannot be PRO. Per-user private folders are free in FileBird, so that part cannot be PRO either (PRD §5). Risk: inside wp-admin this is a convenience, not a security boundary. An editor can still reach files through the core Media Library unless core queries are filtered too.

#### 3.7 Translated Alt Text
- Generates alt text per language for WPML and Polylang sites, stored on each translated attachment.

*Market:* AltText.ai does this on its paid plans, and general translation plugins (TranslatePress and others) translate alt text as part of translating the page. The least distinctive candidate. **Recommend not building this** unless customers ask.

## 4. Moved out of PRO

Considered for PRO and ruled out because another plugin gives it away. All are in free 1.1.0 (PRD §4.1).

| Feature | Free in |
|---|---|
| ZIP download of a folder | Media Library Organizer |
| Folder colors | Folders (Premio), Wicked Folders |
| Subfolders | FileBird, Real Media Library |
| Sort by file size, extra sort options | Present in free 1.0.3 already |
| File in several folders | Folders (Premio), Real Media Library |
| Replace media | Enable Media Replace, Folders (Premio), Mediamatic |
| Unused media scan | Media Cleaner |
| Bulk metadata edit, missing-alt filter | Media Library Helper, Media Library Assistant |
| Per-user private folders | FileBird (not built; PRD §5) |
| Duplicate Finder (identical files) | Filikod (100 installs) lists duplicate image detection in its free listing. Not built; PRD §4.4 |
| Alt text audit (generic, too short, duplicated alt text) | Filikod: free ALT quality score and bulk fixing. Not built; PRD §4.4 |
| AI File Rename | AltGenix (20 installs): free AI filename generation with the user's own key. Not built and not planned: renaming changes URLs (PRD §5) |

## 5. Pricing *(proposed, not decided)*

- Annual: **$39/yr** (1 site) · **$79/yr** (5) · **$149/yr** (unlimited), with lifetime at about 3× annual. Same grid as the Database Cleaner add-on, so both products can share a pricing page.
- Not checked against FileBird Pro, Real Media Library Pro or AltText.ai pricing. That comparison is required before this is confirmed.

## 6. Roadmap *(proposed)*

1. **Release free 1.1.0 first** and finish its release gate (PRD §4.3). PRO has nothing to attach to until the free plugin has an audience.
2. **Launch trigger:** a proposed threshold of about 1,000 active installs, the same reasoning as the Database Cleaner add-on (below that, conversions cannot cover Freemius, support and upkeep). The plugin was first released on 2026-09-25, so this is some way off.
3. **Before building:** run the §0 rule-4 check on 3.1 to 3.4, then add the add-on API to the free plugin (PRD §3) in its own free release.
4. **Build order:** Smart Folders (no AI dependency, reuses the free filters) → Scheduled AI Backfill → AI Auto-Sort → Search by Content.
5. **3.5 to 3.7:** only on real customer demand.

## 7. Open questions

- Is a three- or four-feature PRO enough to charge for, or should it wait until Folder Permissions has a design that is honest about its limits?
- Four of the recommended features are AI. Is a PRO that mostly depends on the customer's own AI provider account acceptable, given Smart Folders is the only one that works without it?
- AI features depend on WordPress 7.0 and the site owner's own provider account. How much of the audience has both?
- Does Scheduled AI Backfill need a spending guard beyond a daily image cap (the provider bills the site owner, not us)?
- Lifetime-tier multiplier, refund window, and whether to offer a Freemius trial.

## 8. Sources

Same listings as PRD §8, checked 2026-10-05. PRO-relevant lines:

- Media Library Organizer Pro: AI image categorization, advanced search, duplicate a file, ZIP upload, EXIF/IPTC, image optimization.
- Folders (Premio) Pro: unlimited subfolders, dynamic folders, delete unused media, folders for plugins and post types.
- Wicked Folders Pro: media library folders, dynamic folders for media.
- CatFolders Pro: subfolders, advanced sort, folder access permissions, post-type folders.
- Mediamatic Pro: subfolders, colors, private per-user folders, role-based permissions, ZIP, duplicate folders, automatic backups.
- FileBird Pro: folder themes, ZIP download, sort options, sort by size, folder colors, post-type folders.
- Media File Renamer Pro: AI rename, move files between directories, metadata sync.

Added from a WordPress.org search on 2026-10-05 (search API, listing text only):

- Filikod: https://wordpress.org/plugins/filikod/ — free ALT quality score, generic/short/duplicated alt detection, bulk fixing, duplicate image detection.
- AltGenix: https://wordpress.org/plugins/altgenix-ai-image-seo/ — free alt text, title, caption and description with the user's own key, on upload and in bulk, plus optional AI filenames.
- Lens Media Library Folders: https://wordpress.org/plugins/lens-media-library-folders/ — folders, trash, undo/redo, favorites; advertises role-based permissions and "smart search" (tier unclear).
