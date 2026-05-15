---
name: ms-store-release
description: Prepare and operate Microsoft Store update submissions for a packaged desktop app, especially Prompt Palette. Use when the user asks to release or update an app through Microsoft Partner Center, build or upload an MSIX, handle Store package versioning, verify GitHub Actions MSIX artifacts, fix Chrome file upload permission issues, or proceed through Partner Center up to but not past final certification submission.
---

# MS Store Release

Use this skill to make Microsoft Store updates repeatable.

## Core rule

Never click the final `送信して認定を受ける` button without direct action-time user confirmation.

Also confirm before manual cloud removal actions, including Partner Center `Remove` buttons or `送信の削除`.

## Prompt Palette constants

For Prompt Palette, keep these stable unless the user explicitly says otherwise:

- Product ID: `9NQ19JRTMPC1`
- Package name: `yuki5.PromptPalette`
- Publisher: `CN=C04C86FA-F1E0-40B1-8499-E5BF7245F317`
- Architecture: `x64`
- Branch: `master`
- Runbook: `docs/ms-store-release-runbook.md`
- Wiki project page: `/Users/Shared/obsidian-wiki/30_projects/prompt-palette/README.md`
- Same-day journal pattern: `/Users/Shared/obsidian-wiki/10_sources/journal/YYYY-MM-DD_prompt-palette-status-check.md`

## Workflow

1. Read the wiki project page and same-day journal before acting.
2. Check the repo status and current app/package versions.
3. Check Partner Center for the currently published package version.
4. Pick a strictly higher MSIX version.
5. Update all version files listed in `docs/ms-store-release-runbook.md`.
6. Run:

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

7. Commit and push the release-prep change.
8. Wait for GitHub Actions Windows/macOS/MSIX jobs.
9. Download the `prompt-palette-msix` artifact.
10. Verify `AppxManifest.xml` inside the MSIX and record sha256.
11. Open Partner Center and create or reuse the update draft.
12. Upload the MSIX on the draft `Packages` page.
13. Wait for validation.
14. If the new higher package replaces an older same-customer package, explain that and get confirmation before saving.
15. Save draft package changes.
16. Stop before final certification submission unless the user gives immediate confirmation.
17. Update the wiki journal with progress, blockers, and learnings.

## Chrome upload fix

If direct file upload fails with `Not allowed`, open:

```text
chrome://extensions/?id=hehggadaopoacecdllhhajmbjkdcmajg
```

Enable:

```text
ファイルの URL へのアクセスを許可する
```

Then retry upload.

## What to record

Record these in the wiki journal:

- Version chosen
- Files changed
- Test results
- Commit hash
- GitHub Actions run id
- Artifact path
- MSIX sha256
- Partner Center submission number
- Package validation state
- Whether final submission was performed
- Any learnings, especially browser permission or Partner Center UI issues

## Known-good example

The 2026-05-15 release used:

- New package version: `0.2.1.0`
- Commit: `0c3b49a chore: prepare 0.2.1 store release`
- Actions run: `25898623351`
- Artifact: `/Users/yuki5/Downloads/prompt-palette-msix-0.2.1/PromptPalette.msix`
- sha256: `e790d308cdb1c2f4eacbaba33931a2446245b59de412a3053f75df099f0096f1`
- Partner Center draft: `Submission 3`
- Result before final submit: `PromptPalette.msix` / `Validated` / `更新済み`
