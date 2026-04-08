---
name: sharing-pr-agent-artifacts
description: Uploads agent-generated artifacts (specs, plans, learnings) to the streamlit.wiki for sharing via PR comments. Use when you have agent artifacts to share with reviewers.
---

# Sharing PR agent artifacts

Uploads intermediate files (implementation plans, specs, learnings, explorations, architecture diagrams) to [streamlit.wiki](https://github.com/streamlit/streamlit.wiki.git) so they can be linked in PR descriptions and comments. Use this for agent-generated artifacts that are useful for reviewers but don't belong in the main repo.

**Important:** The wiki repo uses `master` as its default branch. Always push to `master`, never create other branches.

**Public URL pattern:**

```
https://issues.streamlit.app/agent_wiki_explorer?file=<relative-path>
```

Example: `https://issues.streamlit.app/agent_wiki_explorer?file=pull-requests/12345/implementation-plan.md`

## Prerequisites

- A PR must exist for the current branch

## Workflow

### 1. Get PR number

```bash
gh pr view --json number --jq '.number'
```

If no PR exists, stop and inform the user.

### 2. Set up wiki repo

Check if the wiki is already cloned:

```bash
if [ -d "agent-wiki/.git" ]; then
  # Use subshell to avoid directory navigation issues if pull fails
  (cd agent-wiki && git checkout master && git pull origin master)
else
  git clone https://github.com/streamlit/streamlit.wiki.git agent-wiki
fi
```

### 3. Create PR directory

```bash
mkdir -p agent-wiki/pull-requests/<pr-number>
```

### 4. Discover and copy files

**Common locations** (check these first):

- `work-tmp/` — temporary working files, drafts, exploration notes
- `specs/` — untracked product/tech specs created for this PR

**What to include:**

- Specs, plans, design docs (`.md`)
- Implementation notes and decisions
- Architecture diagrams (`.png`, `.svg`)
- Research findings and explorations

**Always exclude:**

> **Warning:** The wiki is a **public repo**. Never upload confidential information, internal sensitive discussions, or anything that shouldn't be publicly visible. Since Streamlit is open-source, almost all tech and product related planning documents are fine to share publicly.

- Files already tracked in the main repo (use `git ls-files` to check)
- Credentials, secrets, tokens, API keys (`.env`, `*credentials*`, `*secret*`, `*token*`, `*api_key*`)
- Confidential or internal-only information
- Test-related artifacts
- Debug logs and temporary output
- Build artifacts
- Large binary files (>10MB)
- IDE/editor files
- Files unrelated to the current PR

Copy selected files:

```bash
cp <file> agent-wiki/pull-requests/<pr-number>/
```

### 5. Commit and push

```bash
# Use subshell to avoid directory navigation issues
(
  cd agent-wiki
  git checkout master
  git add pull-requests/
  git commit -m "Add artifacts for PR #<pr-number>"
  git pull --rebase origin master
  git push origin master
)
```

If push fails due to conflicts:

1. Run `git pull --rebase origin master`
2. Resolve conflicts manually
3. Run `git rebase --continue`
4. Push again

Never use `--force`.

### 6. Comment on PR

If new files were added, post a summary comment to the PR:

```bash
gh pr comment <pr-number> --body "$(cat <<'EOF'
### Added Agent Docs

- [implementation-plan.md](https://issues.streamlit.app/agent_wiki_explorer?file=pull-requests/<pr-number>/implementation-plan.md): Main technical implementation plan
- [exploration.md](https://issues.streamlit.app/agent_wiki_explorer?file=pull-requests/<pr-number>/exploration.md): Initial research and design exploration
EOF
)"
```

Include only top-level documents relevant to reviewers. Assets embedded in those documents (e.g., images) don't need separate entries.

## Notes

- The `agent-wiki/` directory is gitignored and persists across sessions
- Always push to `master` — never create feature branches or use `--force`
- This is a **public repo** — never push sensitive information
- Only upload files directly relevant to the current PR
