---
name: creating-pull-requests
description: Creates or updates a pull request on GitHub with proper labels, branch naming, and description formatting. Use when changes are ready to be submitted as a PR to the streamlit/streamlit repository.
---

# Create pull request

Read `wiki/pull-requests.md` first. It defines branch names, commit messages, PR titles, descriptions, labels, and the testing plan. Write the title and description following the `/reviewing-pr-description` skill.

**Be fully autonomous.** Don't ask for confirmation. Leave any open questions as a PR comment.

## 1. Prepare the branch

- If on `develop`, create a branch named `{type}/{brief-description}`.
- Commit any remaining changes that belong to this PR (skip unrelated or scratch files) with a `<imperative verb> <what> <where>` message.
- Push: `git push -u origin HEAD`.

## 2. Compose the PR

- **Title:** `[type] Description of change`, ≤63 chars.
- **Body:** Fill in the sections of `.github/pull_request_template.md`. Add `- Closes #12345` for issues this PR resolves. In the Testing Plan, keep the bullets for the test types the changed test files cover (or explain why no tests are needed), and leave "Any manual testing needed?" for the user.
- **Labels:** Set exactly one `impact:*` label (`impact:users` or `impact:internal`) and one `change:*` label. `change:spec` PRs don't need an `impact:*` label. Don't set `feature:*` or `area:*` labels.

## 3. Create the PR

Check first whether a PR already exists with `gh pr view`. If one does, don't create a new PR. Update its title, description, or labels only where they no longer match the changes. Otherwise, run `gh pr create --base develop` with the title, body, and labels. Only add `--draft` if the user asks for a draft PR.
