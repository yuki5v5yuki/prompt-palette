# Microsoft Store release runbook

This runbook captures the repeatable release path for Prompt Palette Windows Store updates.

## Goal

Ship a new Microsoft Store update without losing the current Store identity.

Keep these identities stable:

- Partner Center product: `Prompt Palette`
- Product ID: `9NQ19JRTMPC1`
- MSIX package identity: `yuki5.PromptPalette`
- Publisher: `CN=C04C86FA-F1E0-40B1-8499-E5BF7245F317`
- Architecture: `x64`

## Before changing files

1. Check the currently published package version in Partner Center.
2. Choose a strictly higher MSIX version.
3. Keep app version and package version aligned:

- App version: `0.2.1`
- MSIX version: `0.2.1.0`

Do not submit a lower version than Partner Center already has. During the 2026-05-15 release, Partner Center already had `v0.2.0.0`, so `0.1.1.0` was not valid for update submission.

## Files to update

Update the version consistently in:

- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/src/commands.rs`
- `msix/AppxManifest.xml`
- `msix/build-msix.ps1`

## Local checks

Run:

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Optional Mac packaging check:

```bash
npm run tauri:build
```

## Commit and push

Use a clear release-prep commit:

```bash
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/commands.rs msix/AppxManifest.xml msix/build-msix.ps1
git commit -m "chore: prepare 0.2.1 store release"
git push origin master
```

## GitHub Actions

Wait for:

- Windows build: success
- macOS build: success
- MSIX build: success

`sign-windows` may fail if `SIGNPATH_API_TOKEN` is not configured. That does not prevent using the generated MSIX, but it means the signing automation still needs setup.

Download the `prompt-palette-msix` artifact and place it somewhere easy to select, for example:

```text
/Users/yuki5/Downloads/prompt-palette-msix-0.2.1/PromptPalette.msix
```

Verify the MSIX manifest:

```bash
unzip -p /Users/yuki5/Downloads/prompt-palette-msix-0.2.1/PromptPalette.msix AppxManifest.xml
shasum -a 256 /Users/yuki5/Downloads/prompt-palette-msix-0.2.1/PromptPalette.msix
```

Confirm:

- `Identity Name="yuki5.PromptPalette"`
- `Version="0.2.1.0"` or the chosen higher version
- `Publisher="CN=C04C86FA-F1E0-40B1-8499-E5BF7245F317"`
- `ProcessorArchitecture="x64"`

## Partner Center

1. Open Partner Center.
2. Go to `アプリとゲーム`.
3. Open `Prompt Palette`.
4. If needed, click `更新の開始` to create a new submission draft.
5. Open the draft `Packages` page.
6. Upload the new `PromptPalette.msix`.
7. Wait for upload and validation.
8. Confirm the new version appears above the old version.
9. If Partner Center says the old package will be removed after save because a higher version supports the same customers, confirm this is expected.
10. Click `Save`.
11. Return to overview and confirm:

- Package: `PromptPalette.msix`
- Status: `Validated`
- Change state: `更新済み`

## Chrome upload gotcha

If Codex Chrome upload fails with `Not allowed`, enable file upload access:

1. Open `chrome://extensions/?id=hehggadaopoacecdllhhajmbjkdcmajg`.
2. Turn on `ファイルの URL へのアクセスを許可する`.
3. Retry the Partner Center upload.

This fixed the 2026-05-15 upload.

## Confirmation gates

Codex may proceed after prior user approval for:

- Opening Partner Center pages
- Uploading the prepared MSIX
- Saving the draft package changes after explaining that the older same-customer package will be removed from the draft

Codex must ask immediately before:

- Deleting a submission
- Removing a cloud package manually with a `Remove` button
- Clicking `送信して認定を受ける`

## Final submission

Only click `送信して認定を受ける` after direct user confirmation.

After the user submits, record:

- Submission number
- Submitted date
- Package version
- Artifact path and hash
- Any Partner Center warnings
- Whether SignPath signing is still failing

## 2026-05-15 known-good release facts

- Commit: `0c3b49a chore: prepare 0.2.1 store release`
- GitHub Actions run: `25898623351`
- Artifact path: `/Users/yuki5/Downloads/prompt-palette-msix-0.2.1/PromptPalette.msix`
- MSIX sha256: `e790d308cdb1c2f4eacbaba33931a2446245b59de412a3053f75df099f0096f1`
- Partner Center draft: `Submission 3`
- Package validation: `Validated`
- Draft package state after save: `更新済み`
- User later completed final submission manually
