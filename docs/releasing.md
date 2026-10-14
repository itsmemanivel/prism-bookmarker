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

## Everyday commits

Ordinary work needs no build and produces no ZIP. Only tags trigger a release.

```bash
git add -A
git commit -m "..."
git push
```

## Releasing

A release is two commands. Pick the bump that matches the change:

```bash
npm version patch   # 1.0.0 -> 1.0.1   bug fixes
npm version minor   # 1.0.0 -> 1.1.0   new features
npm version major   # 1.0.0 -> 2.0.0   breaking or major rework

git push --follow-tags origin master
```

`npm version` bumps `package.json`, rewrites `manifest.json`, stages both, commits, and creates an annotated tag such as `v1.1.0`.

Use `--follow-tags`. A plain `git push` sends the commit but not the tag, and without the tag no release is built.

### What CI does

Pushing a `v*` tag runs `.github/workflows/release.yml`, which:

1. Checks out the tagged commit and runs `npm ci`
2. Runs `npm run build`
3. Fails the run if `dist/manifest.json` does not match the tag, so a mislabelled build never ships
4. Zips `dist/` into `prism-bookmarks.zip`
5. Publishes a GitHub release with the ZIP attached and notes generated from commit messages

Watch progress on the [Actions tab](https://github.com/itsmemanivel/prism-bookmarker/actions). If the run fails, no release is created and nothing is published.

The workflow uses `zip` rather than `npm run package`, because that script depends on PowerShell and the runner is Linux.

### Then upload to the Chrome Web Store

1. Download `prism-bookmarks.zip` from the release page
2. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Select the item, go to **Package**, and upload the ZIP
4. Update the listing if the change is user-visible
5. **Save draft**, then **Submit for review**

Review usually takes a few days. The published version only changes once review passes.

## Testing a build before you tag

CI proves the extension compiles and is versioned correctly. It cannot tell you the interface works, so smoke-test anything user-visible first.

Stop `npm run dev` before building. Dev mode rewrites `dist/` with stubs that load scripts from `localhost:5173`, and Manifest V3 blocks remote scripts, so an extension loaded from that folder shows a blank page with a `script-src 'self'` error in the console. Only a folder produced by `npm run build` is loadable.

```bash
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Choose **Load unpacked** and select the `dist` folder
4. Click the Prism icon and check the dashboard opens and your data is intact

Favicons only resolve in this packaged context. They never work on the dev server, which has no `chrome` API.

`npm run package` does the same build and additionally writes `prism-bookmarks.zip` locally. That is only useful for inspecting the artifact by hand; releases do not depend on it.

## Fixing a bad release

You cannot overwrite a version on the Web Store, and a published tag should not be moved. Bump to the next patch and release again:

```bash
npm version patch
git push --follow-tags origin master
```

If a tag was created but not yet pushed, remove it with `git tag -d v1.0.1` and reset the version commit before trying again. Avoid deleting or force-moving tags that are already pushed, since anyone who fetched them keeps the old reference.

If CI fails, no release is published. Fix the problem on `master`, then delete the unpushed tag and repeat the bump.

## Checklist

- [ ] Working tree is clean and `master` is up to date
- [ ] Unpacked build loaded and smoke-tested in Chrome
- [ ] Version bumped with `npm version`, never edited by hand
- [ ] Commit and tag pushed with `--follow-tags`
- [ ] Actions run finished green and the release has the ZIP attached
- [ ] ZIP uploaded to the Web Store and submitted for review

## Reference

| Item | Value |
|---|---|
| Repository | https://github.com/itsmemanivel/prism-bookmarker |
| Default branch | `master` |
| Tag format | `v<version>`, for example `v1.0.0` |
| Release workflow | `.github/workflows/release.yml`, triggered by `v*` tags |
| Upload artifact | `prism-bookmarks.zip`, built from `dist/` |
| Privacy policy | https://gist.github.com/itsmemanivel/40658b0580a6ad7cb55a7091f0a53cf2 |
| Store assets | `screenshots/` at 1280x800 JPEG |

`dist/` and `prism-bookmarks.zip` are build outputs and are not tracked in git.
