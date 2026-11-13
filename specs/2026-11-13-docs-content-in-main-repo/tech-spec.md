---
author: lukasmasuch
created: 2026-11-13
---

# Docs content in the main repo

## Summary

The pages of docs.streamlit.io live in `streamlit/docs`, apart from the code they describe.
This spec moves that content (`streamlit/docs:content/`, plus the images and redirects that
belong to it) into `streamlit/streamlit` under `docs/`. The docs site stays in
`streamlit/docs` and reads the folder through a git submodule that moves to each new
release. A feature PR then updates the user docs together with the code, where coding
agents and AI review already work, and the site publishes them when the release ships.

## Problem

### Docs are written after the fact, in another repo

A feature lands in `streamlit/streamlit` with its docstring. Everything else is written in
`streamlit/docs` around release day: the API reference page, its tile, the menu entry,
concept pages, tutorials, and release notes. Every minor release in the last year has a PR
like streamlit/docs#1606 ("Update docs for Streamlit 1.67.0 release"). It's written from
the changelog by whoever runs the release, not by the feature's author. Pages that the
release PR misses drift until someone sweeps them: streamlit/docs#1589 fixed outdated
content in 99 files for 1.66.0.

The agents that do most of the work in this repo can't help. `implementing-feature`,
`ai-pr-review`, and `ai-update-docs.yml` see docstrings, internal docs, and the bundled
`developing-with-streamlit` skill, but not the user docs. The docs repo has its own
`updating-docs-for-release` skill, which reconstructs what changed from the release notes.

### How the docs site uses `content/`

| Part | Facts | Location in `streamlit/docs` |
|---|---|---|
| Pages | 409 Markdown files, 3.2 MB. Pages aren't versioned: one page per command serves every version, and only docstrings vary. | `content/` |
| Navigation | Lists every page. A page without an entry fails the build. | `content/menu.md` |
| Readers | The `articleDirectory` constant, the homepage import, the llms.txt generators, and the offline docs builder | `lib/node/api.js:7`, `pages/index.js:29`, `python/generate_llms_txt.py:93`, `python/generate_llms_full_txt.py:337`, `scripts/build-offline-docs.js:14` |
| MDX components | About 25 custom tags, led by `RefCard` (416 uses), `Image` (395), `Autofunction` (308), `GitHubIssuesHint` (139), `TileContainer` (79), and `Cloud` (76) | `components/` |
| Images | 378 files, 65 MB. Content references 362 of them by `/images/...` URL. Seven files exceed 500 KB and add up to 32 MB; two GIFs alone are 25 MB. | `public/images/` |
| Redirects | 1,173 Netlify rules, added whenever a page moves | `public/_redirects` |
| Docstrings | The API reference for every released version, generated from PyPI by `python/generate.py` | `python/streamlit.json` (47 MB) |
| Example apps | About 250 app sources deployed to Community Cloud as `doc-*.streamlit.app`. Pages embed them with `<Cloud>`, and 63 files in `lib/streamlit/` link 219 of them from docstrings. | `python/api-examples-source/` and siblings |

Release-docs PRs touch `content/`, `python/streamlit.json`, and example-app sources, and
sometimes images and the "What's new" tiles in `pages/index.js` (streamlit/docs#1412, #1453,
#1509, #1560, #1606).

### Activity in the last 12 months

Of 190 PRs merged into `streamlit/docs`, 85 came from Dependabot. PRs touching each part of
the content (a PR can count more than once):

| Section | PRs |
|---|---|
| `develop/quick-references` (release notes, cheat sheet) | 31 |
| `develop/concepts` | 30 |
| `develop/api-reference` | 28 |
| `get-started` | 13 |
| `develop/tutorials` | 12 |
| `deploy` | 10 |
| `kb` | 5 |

Only 4 PRs changed `deploy/` or `kb/` without also touching `develop/`, so content that
changes independently of library releases is rare. 23 merged PRs came from forks. About 15
of them changed content and came from outside the team, mostly typo and link fixes plus a
few third-party tutorials. Streamlit shipped a minor release about every two
weeks, from 1.62.0 on 2026-08-19 to 1.67.0 on 2026-11-05.

## Goals

- Docs for a change land in the same PR as the change.
- docs.streamlit.io documents the latest release and never shows pages for unreleased
  features.
- Agents and AI review in `streamlit/streamlit` can read, write, and check user docs.
- A content mistake fails the PR that makes it, not the docs build on release day.

Non-goals: moving the Next.js site, its MDX components, `python/streamlit.json`, or the
example apps; changing URLs, the page format, or the menu format; versioning pages per
release.

## Proposal

### 1. Layout in `streamlit/streamlit`

```text
docs/
├── AGENTS.md      # rules for writing docs pages (§5)
├── _redirects     # from streamlit/docs:public/_redirects
├── content/       # from streamlit/docs:content/, unchanged
│   ├── index.md
│   ├── menu.md
│   └── deploy/ develop/ get-started/ kb/
└── images/        # from streamlit/docs:public/images/
```

- `docs/` sits at the repo root, outside `lib/`, so it isn't part of the wheel or sdist.
- `_redirects` moves with the pages, because moving or renaming a page needs a redirect in
  the same PR.
- The import is one commit that names the source `streamlit/docs` SHA, without history.
  The history stays in `streamlit/docs`; importing it would add years of docs commits to
  the log that `generating-changelog` and the release tooling read.
- The two GIFs over 10 MB are re-encoded as animated WebP, which still works with Markdown
  image syntax.

### 2. How `streamlit/docs` reads it

```ini
# .gitmodules
[submodule "streamlit"]
	path = streamlit
	url = https://github.com/streamlit/streamlit.git
	shallow = true
```

```text
content           -> streamlit/docs/content
public/images     -> ../streamlit/docs/images
public/_redirects -> ../streamlit/docs/_redirects
```

With these symlinks, the five readers and every `/images/...` URL work unchanged. Two
things need checking in the first implementation step: that webpack resolves the
`../content/index.md` import in `pages/index.js` through the symlink, and that the export
copies the symlinked files into `out/`. If either fails, the readers point at
`streamlit/docs/content` directly, which is one constant or import each.

Other changes in the docs repo:

- The default `make` target also runs `git submodule update --init --depth 1`.
- Netlify checks out submodules of public repos on its own. The shallow checkout is all of
  `streamlit/streamlit`: 159 MB in 10,285 files, 126 MB of it E2E snapshots. If that slows
  builds noticeably, switch to alternative B, which keeps the same pin rules.
- Dependabot's `gitsubmodule` updates stay off, because they would move the pin to
  `develop`.
- The README's contributing section points content changes to `streamlit/streamlit`.

### 3. What the pin points at

A submodule pins a commit. The pin follows releases:

| Event | The pin moves to |
|---|---|
| A minor release `X.Y.0` is tagged | The `X.Y.0` tag |
| A patch release `X.Y.Z` is tagged | The `X.Y.Z` tag, if `docs/` changed since the current pin |
| An urgent docs fix is needed between releases | The fix's cherry-pick on the latest release branch |

Commits on `develop` reach the site only through a release, so pages for unreleased
features never go live early.

Urgent fixes are rare: wrong security guidance, broken Community Cloud instructions, or a
wrong install command. They merge to `develop` first, `cherry-pick-to-release-branch.yml`
puts them on the latest `release/X.Y.Z` branch, and the pin moves to that commit. Everything
else, typo fixes included, waits for the next release, about two weeks at most.

`patch-release-branch-creation.yml` branches from the previous tag, so a fix that was
cherry-picked onto `release/1.67.0` after its tag isn't on `release/1.67.1`. The release
PR (§4) warns when the new pin doesn't contain the current one, so the fix can be
cherry-picked again before merging.

Release notes have to be in the pinned commit. The release manager runs
`generating-changelog`, which writes into
`docs/content/develop/quick-references/release-notes/`, and commits the result to the
release branch before tagging. The release merge PR then brings it back to `develop`.
`release-tag-and-pr-creation.yml` fails when the release notes have no section for the
version being tagged.

### 4. Release PR in `streamlit/docs`

A workflow in `streamlit/docs` replaces most of the manual release PR. It runs on a
schedule and on manual dispatch, and opens a PR when a new release tag exists:

1. Move the submodule to the tag (§3).
2. Generate docstrings for the new version with `python/generate.py`, as `make docstrings`
   does today.
3. Compare the `<Cloud>` embeds in the previous and new docstrings, and list the example
   apps to deploy. Step 5 of the docs repo's `updating-docs-for-release` skill does this by
   hand today.
4. Put `git diff --stat` of `docs/` between the two pins in the PR body, plus the warning
   from §3 when the new pin doesn't contain the current one.

Merging the PR publishes the release docs. The "What's new" tiles in `pages/index.js` stay
in the docs repo and are updated in this PR. A schedule avoids storing a `streamlit/docs`
token in `streamlit/streamlit`; a `repository_dispatch` from `release.yml` can replace it
later if the delay matters.

### 5. Writing docs in `streamlit/streamlit`

- `docs/AGENTS.md` holds the page rules that live in the docs README and skill today:
  frontmatter (`title`, `slug`, `description`, `keywords`), the `menu.md` entry, tiles in
  the section `_index.md` and in the API reference `_index.md`, the allowed components,
  image paths, redirects for moved pages, and the release-notes format.
- The root `AGENTS.md` and `wiki/new-feature-guide.md` require user-facing changes to update
  `docs/content` in the same PR. A new command adds a page, tile, and menu entry. A new
  parameter or behavior change updates the concept pages and tutorials that describe it.
- `implementing-feature`, `implementing-bug-fix`, and `finalizing-pr` include the docs
  step. `ai-pr-review` flags missing or outdated docs. The weekly `ai-update-docs.yml` run
  covers `docs/content` as well as internal docs.
- Tile images come from a designer's Figma template; agents don't generate them. A PR that
  adds a command uses a shared placeholder image when the real one isn't ready, and the
  validator (§6) lists placeholder uses so the release PR catches them.
- Example apps for new docstring examples still go to
  `streamlit/docs:python/api-examples-source/`, as they do today.

### 6. Checks in `streamlit/streamlit`

This repo never renders the docs. Without checks, a broken page surfaces only when the
release PR builds the site.

**Content validator.** `scripts/check_docs_content.py` runs in `make check`, in pre-commit,
and in CI when `docs/` changes. It checks that:

- every page has a `title` and a `slug`, and slugs are unique
- every page has a `menu.md` entry, and every menu URL has a page
- every `/images/...` reference exists in `docs/images/`
- every internal link points to a slug or to a redirect source in `docs/_redirects`
- every MDX tag is a known component, and every `<Autofunction function="streamlit.…">`
  names something that `streamlit` exports, apart from an allowlist of removed commands
  whose pages stay for older versions

It also reports placeholder tile images. The import PR fixes or allowlists whatever the
validator flags in today's content.

**Site build.** The validator doesn't parse MDX, so an unbalanced tag or a stray `{` still
breaks the site. A CI job that runs when `docs/` changes checks out `streamlit/docs`,
points it at the PR's `docs/`, and runs `make export`. The build time hasn't been measured.
If it's too slow for every docs PR, the job runs nightly against `develop`, and the
validator stays the per-PR check.

**Repo settings.**

- `ruff format` runs with `preview = true`, which formats Python code blocks inside
  Markdown. `docs/` goes into `extend-exclude`, so imported samples keep their formatting.
- `check-added-large-files` rejects files over 500 KB, which covers seven of today's
  images. It gets a higher limit for `docs/images/`.
- `CODEOWNERS` assigns `docs/` to the docs maintainers.
- PRs that only touch `docs/` skip the Python, frontend, and E2E suites. The skip happens
  inside the jobs rather than through `paths-ignore`, because required checks that never
  report block the merge.

### 7. Migration

1. Right after a minor release, freeze content PRs in `streamlit/docs`.
2. Import `content/`, `public/images/`, and `public/_redirects` into `docs/` on `develop`,
   with the validator, repo settings, and `CODEOWNERS`. Cherry-pick the import onto the
   release branch of the release that just shipped, so that the first pin has the content
   but no unreleased changes.
3. In `streamlit/docs`, add the submodule pinned to that commit, replace the folders with
   symlinks, and add the release workflow. Update the README and trim the
   `updating-docs-for-release` skill to the steps in §4.
4. Port open `streamlit/docs` PRs that touch content to `streamlit/streamlit`, and close
   them with a pointer.
5. Lift the freeze.

### What changes for readers and contributors

- Readers see no change. URLs, redirects, search, llms.txt, and offline docs are built from
  the same files.
- Docs changes reach the site at the next release instead of on merge, except urgent fixes
  (§3).
- Content changes need a `streamlit/streamlit` PR. That repo has paused PRs from outside
  the maintainer team (`fork-pr-welcome.yml`), so the roughly 15 community docs PRs a year
  stop unless `docs/` is exempt.
- PRs in `streamlit/docs` become site changes and release PRs.

## Alternatives considered

### A. Keep the content in `streamlit/docs` and open companion PRs

Agents in `streamlit/streamlit` open a matching PR in `streamlit/docs` for each change. This
avoids the migration, but every change needs two PRs, agents need a token for the docs repo,
the companion PR still waits for the release, and AI review can't check docs and code
together. It doesn't meet the first goal.

### B. Pin file and sparse checkout instead of a submodule

`streamlit/docs` stores the pinned ref in a one-line file, and a build script fetches only
`docs/` with `git clone --filter=blob:none --sparse`. This downloads about 70 MB instead of
159 MB, and it can build the site for any branch, which would allow rendered previews of
`streamlit/streamlit` PRs. The cost is a custom script in place of a standard git
mechanism. The pin rules and release flow are the same, so this is the fallback if the
submodule checkout slows builds, or if per-PR previews become a goal.

### C. Copy the folder into `streamlit/docs` on each release

A workflow copies `docs/` from the release tag into `streamlit/docs:content/` and opens a
PR. The docs repo stays self-contained, but there are now two copies, and edits to the copy
drift unless a check rejects them. A submodule gives the same reviewable release PR without
the second copy.

### D. Pin to `develop`

Docs would go live on merge, but so would pages for unreleased features. API reference
pages, whose docstrings come from PyPI, would also disagree with concept pages written for
`develop`.

### E. Move the whole docs site into `streamlit/streamlit`

This removes the pin, but it adds a Next.js app, the 47 MB docstrings file, and the Netlify
setup to the main repo, and couples site deploys to its CI. The example apps would have to
be redeployed from new paths. Publishing would still have to follow releases, so the site
would need its own release-branch deploys.

### F. Import with history

`git filter-repo` would keep per-line blame, but it fills the main repo's history with docs
commits that changelog tooling then has to filter. Blame for imported pages stays available
in `streamlit/docs`.

## Out of scope

- Moving the example-app sources. Docstrings already link them across repos, and moving
  them means redeploying each Community Cloud app from a new path.
- Moving the MDX components, or making pages renderable without the docs site.
- Rendered previews of docs changes in `streamlit/streamlit` PRs (alternative B enables
  them).
- Formatting Python samples in docs pages with `ruff`.
- Moving the "What's new" tiles from `pages/index.js` into the content.

## Open questions

1. Should `docs/` accept PRs from outside the maintainer team?
2. Who owns `docs/` in `CODEOWNERS`?
3. Is a delay of up to two weeks acceptable for non-urgent fixes, or should every docs fix
   be cherry-picked onto the release branch?
