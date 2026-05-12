---
name: generating-changelog
description: Generates polished website release notes between two git tags for docs.streamlit.io. Use when preparing a new Streamlit release or reviewing changes between versions.
---

# Generating changelog

Generate publish-ready website changelog (docs.streamlit.io format) between two git tags. Uses PR labels (`impact:users`, `impact:internal`, `change:*`) for categorization and rewrites PR titles into user-friendly descriptions.

The GitHub release changelog is auto-generated from `.github/release.yml` — this skill only produces the website format.

**Usage:** `/generating-changelog <previous-tag> <new-tag>` (e.g., `/generating-changelog 1.44.1 1.45.0`)

If only one tag is given, treat it as the new release tag and fetch the previous tag automatically.

## Step 1: Validate input

- Parse the two tags from user args. First = previous release, second = new release.
- If only one tag is given, fetch the previous tag:
  ```bash
  gh api repos/streamlit/streamlit/releases/latest --jq '.tag_name'
  ```
- Validate both tags exist using exact references (no pattern matching):
  ```bash
  git rev-parse -q --verify "refs/tags/<tag>" > /dev/null
  ```
  This command must succeed (exit code 0) for each tag.
- Get the release date from the newer tag:
  ```bash
  git log -1 --format=%ai <new-tag>
  ```

## Step 2: Fetch PR data

Run the fetch script to extract PR numbers from `git log` and batch-fetch metadata via GitHub GraphQL:

```bash
uv run python scripts/changelog_fetch_prs.py <prev-tag> <new-tag>
```

This produces `work-tmp/pr-data.json` — a JSON array of `{number, title, labels, author, related_issues, related_issues_truncated}` objects sorted by PR number.

`related_issues` is sourced from the same batched GraphQL query (no per-PR N+1 requests) and includes linked issue numbers plus 👍 counts:

```json
"related_issues": [{"number": 9836, "thumbs_up": 42}]
```

## Step 3 & 4: Filter and categorize

Run the categorization script to exclude noise and categorize PRs by labels:

```bash
uv run python scripts/changelog_categorize_prs.py
```

This reads `work-tmp/pr-data.json`, applies the following rules, and writes `work-tmp/pr-categorized.json`:

**Excluded:** bot authors, release/version/docstring PRs, internal-only PRs (`impact:internal` without `impact:users` — this includes internal features with `change:*` labels).

**External contributors:** Each non-excluded PR includes an `is_external` boolean field. Authors matching `sfc-gh-*` or a known internal set are marked `is_external: false`; all others are `is_external: true`. The summary output lists external contributors separately — use this to attribute contributions without needing to look up GitHub profiles.

**Script categories** (by label priority: `breaking` > `feature` > `bugfix` > other):

| Label                               | Script Category      |
| ----------------------------------- | -------------------- |
| `change:breaking`                   | **Breaking Changes** |
| `change:feature`                    | **New Features**     |
| `change:bugfix`                     | **Bug Fixes**        |
| `impact:users` or unrecognized `change:*` labels | **Other Changes**    |

PRs with no `impact:*` or `change:*` labels are flagged as **unlabeled** for user review.

Note: `change:*` labels are typically required by release labeling conventions. The "Other Changes" fallback is a defensive catch-all for `impact:users` PRs and non-standard `change:*` values not covered by `breaking`/`feature`/`bugfix`.

**Important:** These script categories are intermediate groupings for triage. The website changelog does **not** have a "Breaking Changes" or "New Features" section. All entries are mapped into the three website tiers below. Breaking changes, deprecations, and removals fold into Notable Changes or Other Changes with appropriate emojis (see Step 6).

Map into three website tiers:

- **Highlights** (optional — omit entirely when no PRs qualify): Only 0–4 items per release. Reserve for truly major user-facing additions: entirely new capabilities (e.g., a new widget-to-URL-params system, dynamic container control), significant new API parameters that unlock new workflows, or major breaking changes. Incremental improvements, new config options, and additional parameters on existing commands belong in Notable Changes, not Highlights. Some releases (e.g., patch releases) have no Highlights section at all.
- **Notable Changes**: Remaining features, impactful improvements, new parameters, breaking changes not promoted to Highlights
- **Other Changes**: Bug fixes, docs, chores, minor improvements

## Step 5: Present classification for review

**Before generating final output**, present a summary to the user:

1. Total PR count and count per category
2. List of PRs proposed for "Highlights" tier — allow user to promote/demote
3. Any unlabeled PRs flagged in Step 3, with suggested classifications
4. For borderline Highlights candidates, consider linked issue 👍 counts from `related_issues` as one prioritization signal (not the only signal)
5. External contributors identified by the script (from the `is_external` field) — verify any edge cases but no need to look up GitHub profiles for `sfc-gh-*` or known internal authors
6. Ask the user to confirm or adjust before proceeding

Note: Internal-only feature PRs (e.g., e2e infra, CI workflows, agent skills) are already excluded by the categorize script. You should not need to manually filter these.

Do NOT proceed to Step 6 until the user confirms.

## Step 6: Rewrite descriptions and generate output

Generate the file in the `work-tmp/` directory: `work-tmp/changelog-website-<new-tag>.md`

### Entry writing style by category

- **Highlights**: Announcing tone — "Introducing...", "Announcing...". PR links may be included or omitted at your discretion.
- **Features / new parameters** (Notable Changes): User-perspective voice — "You can now...", "`st.foo` has a new `bar` parameter to...", "`st.foo` supports..."
- **Bug fixes**: Always prefixed with "Bug fix:" — "Bug fix: `st.spinner` avoids a race condition..."
- **Deprecations/removals**: Plain description with specific emojis (see emoji list below).
- **Other non-bug entries**: Plain present-tense descriptions, no prefix.

### Formatting rules

- Remove `[fix]`/`[feat]`/`[chore]`/`[docs]` prefixes from PR titles before rewriting
- **Emojis**:
  - Bug fixes rotate through these insect/bug emojis: 🐛, 🦋, 🪲, 🐜, 🐝, 🐞, 🕷️, 🪳, 🪰, 🦠, 🦟, 🦂, 🦗, 🕸️, 🐌, 🦎, 🦀, 👽, 👻
  - Removals use 👻, deprecations use ☠️, under-consideration removals use 💩
  - Non-bug entries use emojis from this approved palette only (vary them, do not repeat consecutively).
    - UI/layout/design: 🎨, 📐, 🖼, 🧩, 📏, 💅, 🖌, 🎛, 🎚, 🔲, 🌈, 🪄
    - Data/charts/tables: 📊, 📈, 📋, 🔢, 🔣, 📒, 📃, 📄
    - Performance/speed: ⚡, 🚀, ⏱, ⏩, ⏳, 🏎
    - Security/auth: 🔒, 🔐, 🔏, 🛡, 🔑, 👮, 🥷
    - Config/settings: ⚙, 🔧, 🛠, ⚒, 🧰, ⛏, 🔩
    - Links/navigation: 🔗, 🧭, ➡, ⬆, ⬇, 🔝, 🚪, 🛣, ↩
    - Search/visibility: 🔍, 🔎, 👀, 🕵
    - Packages/dependencies: 📦, 🔤, 📥, 📤, 💿, 💾, 💽
    - New features/highlights: ✨, 🎯, 🆕, 🍿, 🎁, 🎈, 🎊, ⭐, 🌟, 🆙
    - Text/content/docs: ✍, 📝, 📜, 📖, 📘, 📚, ✏, ✒, 🖊, 🖋
    - Notifications/messaging: 🔔, 📣, 💬, 📨, 📩, 📬, 🛎
    - State/connection/sync: 💓, 🔀, 🔄, 🔁, 📶, 🔌, ⛓
    - Media/display: 📷, 📸, 📹, 📺, 🎥, 🎤, 🎵, 🎶, 🎹, 🖥
    - Files/storage: 📁, 📂, 🗂, 🗃, 🗑, 📌, 📍, 🏷, 🗜
    - Users/identity: 👤, 👥, 🧑, 👋, 🤝, 👑
    - Errors/warnings: 🚨, 🚩, ⚠, 🛑, ❌, ❓, 🚧
    - Testing/science: 🧪, ⚗, 🔭, 🧠
    - Misc objects: 💡, 💎, 💪, 💯, 💰, 💻, 💼, ⌨, 📱, 📲, 🖨, 🖱, 📞, 🗝, 🖇, ✂, ➕, 🪜, 🪧, 🏗, 🏠, 🏢, 🧱, 🪵
    - Fun/creative: 🍔, 🍞, 🍪, 🍰, 🎩, 🎫, 🏁, 🏃, 🏄, 🏋, 🏓, 🏹, 🐍, 🐙, 🦊, 🦐, 🤖, 🤹, 🥸, 🧞, 🛸, 🛹, 🪗, 🪆, 🚇, 🚒, 🚣, 🌱, 🌐, 🗺, 🗻
  - When no palette emoji fits, default to ✨
- **`st.*` command references**: Use backtick formatting and link to the specific API doc subcategory path: [`st.image`](/develop/api-reference/media/st.image), [`st.dataframe`](/develop/api-reference/data/st.dataframe). Only link the first/primary mention of a command. Links are more common in Notable Changes than Other Changes.
- **PR and issue links**: Include both PR links and related issue links when applicable. Format: `([#14139](https://github.com/streamlit/streamlit/pull/14139), [#9836](https://github.com/streamlit/streamlit/issues/9836))`. Use `/pull/` for PRs and `/issues/` for issues.
- **Punctuation**: Every entry ends with a period after the closing parenthesis of PR/issue links.
- **Contributor attribution**: Attribute external (non-Snowflake) contributors. Use `[username]` (no `@` prefix) in link text, placed after the closing paren and period: `([#NNNNN](https://github.com/streamlit/streamlit/pull/NNNNN)). Thanks, [username](https://github.com/username)`!
- **Multi-PR grouped entries**: For complex multi-PR features, use a parent bullet with a colon, then indented sub-bullets:
  ```
  - 🎨 Main feature description:
      - Sub-detail or sub-command ([#NNNNN](https://github.com/streamlit/streamlit/pull/NNNNN)).
      - Another sub-detail ([#MMMMM](https://github.com/streamlit/streamlit/pull/MMMMM)).
  ```

### Output structure

```markdown
## **Version <new-tag>**

_Release date: <Month Day, Year>_

**Highlights**

- 🍿 Introducing [`st.new_thing`](/develop/api-reference/widgets/st.new_thing) — a widget that lets you do something amazing ([#14200](https://github.com/streamlit/streamlit/pull/14200)).

**Notable Changes**

- 📊 [`st.dataframe`](/develop/api-reference/data/st.dataframe) has a new `selection_mode` parameter that lets you configure row and column selection behavior ([#14139](https://github.com/streamlit/streamlit/pull/14139), [#9836](https://github.com/streamlit/streamlit/issues/9836)).
- ☠️ `st.legacy_thing` is deprecated and will be removed in a future version. Use `st.new_thing` instead ([#14050](https://github.com/streamlit/streamlit/pull/14050)).
- 🔑 App menu redesign:
  - New "Settings" option in the app menu ([#14100](https://github.com/streamlit/streamlit/pull/14100)).
  - Reorganized menu items for better discoverability ([#14101](https://github.com/streamlit/streamlit/pull/14101)).

**Other Changes**

- 🐛 Bug fix: `st.spinner` avoids a race condition when used right before a cache miss ([#13849](https://github.com/streamlit/streamlit/pull/13849), [#13634](https://github.com/streamlit/streamlit/issues/13634)).
- 🦋 Bug fix: `st.number_input` no longer resets to default when the step value changes ([#14125](https://github.com/streamlit/streamlit/pull/14125)). Thanks, [contributor](https://github.com/contributor)!
- 🪲 Bug fix: Fixed a layout shift in `st.columns` when using `gap="small"` ([#14080](https://github.com/streamlit/streamlit/pull/14080)).
```

When the release has no Highlights, omit that section entirely (do not include an empty Highlights header).

## Step 7: Final summary

After writing the file, print:

- File path for the generated changelog
- PR counts per category
- Reminder to review the file before publishing

## Key references

- `.github/release.yml` — canonical label-to-category mapping (also used for auto-generated GitHub release notes)
- Website changelog format reference: `https://docs.streamlit.io/develop/quick-reference/release-notes`
- Example docs markdown file (style inspiration): `https://raw.githubusercontent.com/streamlit/docs/997b19a5eda68b72ce091d69be9d6921a37e3da0/content/develop/quick-references/release-notes/2026.md`
