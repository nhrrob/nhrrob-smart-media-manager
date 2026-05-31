# Skill: Release Plugin

Step-by-step release procedure for **NHR Smart Media Manager**.

## Versioning

- **Minor release:** increment third digit — `1.0.0` → `1.0.1`
- **Feature release:** increment second digit — `1.0.0` → `1.1.0`

## Step 0: Sync local branches

```bash
git checkout main && git pull origin main
git checkout dev && git pull origin dev
git checkout dev
```

## Prerequisites

- On `dev` branch
- No uncommitted changes

## Step 0.5: Generate release zip

Run the full release script — it lints, tests, builds, runs PCP, and produces the zip:

```bash
npm run release
```

For a quick zip without tests (e.g. hotfix iteration):

```bash
npm run build:zip
```

Both run `composer dump-autoload --no-dev` before zipping — regenerates the autoloader without dev package references (fixes the myclabs autoloader bug) without removing any vendor packages. Dev autoloads are restored at the end with `composer dump-autoload`.

## Step 1: Version bump

Update the version string in **three places**:

1. `nhrrob-smart-media-manager.php` — `Version:` header line
2. `nhrrob-smart-media-manager.php` — `const version = 'X.Y.Z';`
3. `readme.txt` — `Stable tag: X.Y.Z`

Add changelog entry in `readme.txt` under `== Changelog ==`:

```
= X.Y.Z =
* Feature: Description.
* Fix: Description.
```

## Step 2: Commit and PR

```bash
git add nhrrob-smart-media-manager.php readme.txt
git commit -m "Chore: Bump version to X.Y.Z"
git push origin dev
# Create PR to main via GitHub CLI or Web UI
```

## Step 3: Approval and merge

**Wait for explicit user approval before proceeding.** Do NOT merge until the user says "yes" or "proceed".

Once approved:

```bash
git checkout main && git pull origin main
```

## Step 4: Tag and publish

```bash
git tag -a vX.Y.Z -m "Release version X.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "X.Y.Z" --notes "Changelog notes here"
```

## Step 5: Post-release sync

```bash
git checkout dev
git merge main
git push origin dev
```
