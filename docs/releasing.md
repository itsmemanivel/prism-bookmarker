# Releasing Prism Bookmarks

How to version, tag, and publish a release of this extension.

## Versioning rules

Chrome imposes two constraints that drive the whole process:

1. The manifest version must be **1 to 4 dot-separated integers** — `1.0.0` or `1.2.3.4`. Suffixes like `1.0.0-beta` and a leading `v` are rejected.
2. The Chrome Web Store **refuses any upload whose version is not higher than the previous one**. You cannot re-upload the same version, even to fix a mistake.

`package.json` is the single source of truth for the version. `manifest.json` is written from it automatically, so the two can never drift apart.

This is wired up through the npm `version` lifecycle script, which npm runs after bumping `package.json` and before it creates the commit:

```json
"version": "node scripts/sync-version.mjs && git add manifest.json"
```

`scripts/sync-version.mjs` also validates the format and fails the bump if Chrome would reject it. Never edit the `version` field in `manifest.json` by hand.

## Release steps

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds the extension, checks the manifest version against the tag, and publishes a GitHub release with `prism-bookmarks.zip` attached. The normal release is therefore two commands:

```bash
npm version minor
git push --follow-tags origin master
```

Then download the ZIP from the release page and upload it to the Web Store. The manual steps below are the same process by hand, for when you want to test a build locally first.

### 1. Bump the version

Pick the part that matches the change:

```bash
npm version patch   # 1.0.0 -> 1.0.1   bug fixes
npm version minor   # 1.0.0 -> 1.1.0   new features
npm version major   # 1.0.0 -> 2.0.0   breaking or major rework
```

One command bumps `package.json`, rewrites `manifest.json`, stages both, commits, and creates an annotated tag such as `v1.1.0`.

### 2. Build the package

```bash
npm run package
```

This runs a type check and production build, then writes `prism-bookmarks.zip` from `dist/`.

Confirm the version actually shipped:

```bash
node -e "console.log(require('./dist/manifest.json').version)"
```

### 3. Test the build before publishing

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Choose **Load unpacked** and select the `dist` folder
4. Click the Prism icon and check the dashboard opens and your data is intact

Favicons only resolve in this packaged context. They never work on the dev server, which has no `chrome` API.

### 4. Push the commit and tag

```bash
git push --follow-tags origin master
```

Use `--follow-tags`. A plain `git push` sends the commit but not the tag, which leaves the GitHub release pointing at nothing.

### 5. Create the GitHub release

CI does this automatically when the tag is pushed. To do it by hand:

```bash
gh release create v1.1.0 prism-bookmarks.zip --title "Prism Bookmarks 1.1.0" --generate-notes
```

`--generate-notes` builds the release notes from commit messages since the previous tag, so write meaningful commit subjects.

### 6. Upload to the Chrome Web Store

1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select the item, go to **Package**, and upload `prism-bookmarks.zip`
3. Update the listing if the change is user-visible
4. **Save draft**, then **Submit for review**

Review usually takes a few days. The published version only changes once review passes.

## Fixing a bad release

You cannot overwrite a version on the Web Store. Bump to the next patch and release again:

```bash
npm version patch
npm run package
git push --follow-tags origin master
```

If a tag was created but not yet pushed, remove it with `git tag -d v1.0.1`. Avoid deleting tags that are already pushed, since anyone who fetched them keeps the old reference.

## Checklist

- [ ] Working tree is clean and `master` is up to date
- [ ] `npm run build` passes
- [ ] Version bumped with `npm version`, never edited by hand
- [ ] `dist/manifest.json` shows the expected version
- [ ] Unpacked build loaded and smoke-tested in Chrome
- [ ] Commit and tag pushed with `--follow-tags`
- [ ] GitHub release created with the ZIP attached
- [ ] ZIP uploaded to the Web Store and submitted for review

## Reference

| Item | Value |
|---|---|
| Repository | https://github.com/itsmemanivel/prism-bookmarker |
| Default branch | `master` |
| Tag format | `v<version>`, for example `v1.0.0` |
| Upload artifact | `prism-bookmarks.zip`, built from `dist/` |
| Privacy policy | https://gist.github.com/itsmemanivel/40658b0580a6ad7cb55a7091f0a53cf2 |
| Store assets | `screenshots/` at 1280x800 JPEG |

`dist/` and `prism-bookmarks.zip` are build outputs and are not tracked in git.
