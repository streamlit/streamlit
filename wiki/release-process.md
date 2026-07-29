# Core release and patch process

This guide covers the engineering steps for publishing the `streamlit` package.
It combines the regular release and patch release runbooks with the automation
in this repository.

The checked-in workflows are the source of truth for what GitHub performs. If
this guide and a workflow disagree, follow the workflow and update this page.

## Before you start

- Assign a release engineer and a second member of the OSS Release Team to
  approve the protected `release` environment.
- Choose the full version without a `v` prefix, such as `1.60.0` or `1.60.1`.
- Keep only one release in the publish phase at a time. The build workflow
  expects to find the matching open `release/*` PR.

All release branches and tags use the same version:

```text
branch: release/1.60.0
tag:    1.60.0
```

## Workflow reference

| Workflow | Use | Required inputs | Result |
|----------|-----|-----------------|--------|
| [Release Branch Creation](https://github.com/streamlit/streamlit/actions/workflows/release-branch-creation.yml) | Regular release | `release_version`, `nightly_tag` | Creates `release/<version>` from a nightly tag and sets the production version |
| [Patch Release Branch Creation](https://github.com/streamlit/streamlit/actions/workflows/patch-release-branch-creation.yml) | Patch release | `patch_version`, `base_tag` | Creates `release/<patch-version>` from an existing release tag |
| [Cherry-Pick to Release Branch](https://github.com/streamlit/streamlit/actions/workflows/cherry-pick-to-release-branch.yml) | Either release type | `release_version`, `cherry_pick_sha` | Cherry-picks one commit and pushes the release branch |
| [Release Tag and PR Creation](https://github.com/streamlit/streamlit/actions/workflows/release-tag-and-pr-creation.yml) | Either release type | `release_version` | Tags the release branch and opens its merge-back PR to `develop` |
| [Build Release](https://github.com/streamlit/streamlit/actions/workflows/release.yml) | Either release type | Run the workflow from the release tag | Tests, builds, publishes to PyPI, and creates the GitHub release |

The workflows validate version formats, branch and tag existence, and other
preconditions before changing the repository. They also send the configured
release notifications.

## Regular release

### 1. Select and test the cutoff nightly

The [Nightly Build workflow](https://github.com/streamlit/streamlit/actions/workflows/nightly.yml)
runs daily at 04:30 UTC. Use the nightly from the scheduled release cutoff day
as the release candidate.

1. Confirm the selected nightly workflow completed successfully, including
   Python, JavaScript, and Playwright tests.
2. Record its full tag. Nightly versions are derived from the latest PyPI
   patch version + 1, so a cutoff for a `1.60.0` release typically looks like
   `1.59.1.dev20260725`, not `1.60.1.dev20260725`.

### 2. Create the release branch

Run [Release Branch Creation](https://github.com/streamlit/streamlit/actions/workflows/release-branch-creation.yml)
from `develop` with:

- `release_version`: the production version, such as `1.60.0`
- `nightly_tag`: the exact tested nightly tag

The workflow verifies the nightly marker, removes the nightly-only package-name
and version commit, creates `release/<version>`, updates the Python and
JavaScript package versions, regenerates `uv.lock`, commits those changes, and
pushes the branch.

### 3. Add only essential post-cutoff changes

The original author of a post-cutoff change is responsible for getting it onto
the release branch. Cherry-pick only changes that are necessary and low risk,
such as:

- a critical bug fix required to ship safely;
- a small correction to documentation for a feature already in the release.

For each commit, run [Cherry-Pick to Release Branch](https://github.com/streamlit/streamlit/actions/workflows/cherry-pick-to-release-branch.yml)
with the target release version and one commit SHA. The workflow accepts a
7-to-40-character SHA, checks out `release/<version>`, cherry-picks the commit,
and pushes the branch.

If the workflow reports a conflict, it aborts without pushing. Resolve the
cherry-pick manually on a local checkout of the release branch, run the checks
appropriate to the change, and push the resolved commit. Do not broaden the
change while resolving the conflict.

After all cherry-picks:

- test each release-specific fix on the release branch;
- rerun focused unit or end-to-end tests as appropriate;
- inspect the complete diff from the selected nightly's source commit
  (`<nightly-tag>^`) to the release branch.

### 4. Create the tag and merge-back PR

Run [Release Tag and PR Creation](https://github.com/streamlit/streamlit/actions/workflows/release-tag-and-pr-creation.yml)
with the release version.

The workflow:

1. verifies `release/<version>` exists and `<version>` is not already a tag;
2. creates an annotated tag at the exact remote release-branch commit;
3. opens `[chore] Release v<version>` from the release branch to `develop`;
4. adds the `change:chore` and `impact:users` labels.

Before publication, the tag may be moved if the release branch changes (see
[Handling failures](#handling-failures) for the delete-and-recreate commands).
After publication, treat the tag as immutable and use a new version for
additional fixes.

Do not merge the generated PR yet. [Build Release](https://github.com/streamlit/streamlit/actions/workflows/release.yml)
uses an open `release/*` PR to verify that the selected tag corresponds to a
release branch. Until publishing completes:

- keep the expected merge-back PR open;
- ensure it is the only open `release/*` PR;
- verify its head is `release/<version>` and its base is `develop`.

### 5. Deploy static assets for SiS (Streamlit in Snowflake)

Run the Static Assets Workflow for SiS after creating the release tag and
before building the release. This ensures that Streamlit in Snowflake on
Snowpark Container Services (SPCS) loads static assets from the CDN instead of
serving them locally.

Follow the Snowflake-internal
[Static Assets Workflow for SiS instructions](https://docs.google.com/document/d/1iyvW4mWsUvt3G9W9CbuhvrOkNAoKsRi7yfBoZzQI6dw/edit?tab=t.0#heading=h.hgtyabu854x3)
(skip if you do not have access; the high-level steps are below):

1. Run the workflow in preprod.
2. Verify that the static assets load and render correctly.
3. Run the workflow in production.

### 6. Build and publish

Open [Build Release](https://github.com/streamlit/streamlit/actions/workflows/release.yml),
select the newly created tag in **Use workflow from**, and run the workflow.
Selecting `develop` or the release branch instead of the tag will fail the
version checks.

The workflow:

1. runs the complete Python, JavaScript, and Playwright test workflows against
   the tag;
2. waits for approval on the protected `release` environment;
3. verifies the open release PR, branch name, tag, and package version agree;
4. builds the package with `make package`;
5. uploads the distributions from `lib/dist` to PyPI using trusted publishing;
6. creates a GitHub release with automatically generated notes.

Before approving the protected environment, the second release-team member
should verify:

- the release PR contains only the version update and approved cherry-picks;
- the tag points to the current release-branch head;
- package versions match the tag;
- all required automated and focused manual tests passed.

### 7. Verify and close out

1. Confirm the new version appears in the
   [Streamlit PyPI history](https://pypi.org/project/streamlit/#history).
2. Install from PyPI in a clean environment:

   ```bash
   uv venv .venv-release-test
   source .venv-release-test/bin/activate
   uv pip install "streamlit==<version>"
   streamlit version
   ```

3. Confirm the command prints the expected version and smoke-test that the app
   starts successfully.
4. Confirm the GitHub release exists and skim its generated notes.
5. Merge the release PR back into `develop`.
6. Complete the documentation release, public release notes, and any relevant
   issue or forum follow-ups.
7. Wait for the automated release PR to appear in the
   [conda-forge Streamlit feedstock](https://github.com/conda-forge/streamlit-feedstock/pulls).
   This can take a couple of hours after the PyPI release.
8. Confirm the feedstock PR checks pass, fix any failures if needed, and merge
   the PR.
9. Request publication to the default Conda channel in the Snowflake-internal
   [#anaconda-snowflake-technical](https://snowflake.enterprise.slack.com/archives/C02D68R4D0D)
   Slack channel. You may need to request access to the channel first. Use this
   message template:

   > Released Streamlit v<version>

## Patch release

Use a patch release for a focused fix that must reach users before the next
regular release. Agree on the scope and release owner before creating the
branch. Keep the patch minimal; unrelated changes remain on `develop`.

### 1. Choose the patch version and base tag

The patch workflow enforces that:

- both values are full `x.y.z` versions;
- the base tag already exists;
- the patch has the same major and minor components as the base;
- the patch component is exactly one greater than the base.

For example, create `1.60.2` from `1.60.1`, not from `1.60.0`.

### 2. Create the patch branch

Run [Patch Release Branch Creation](https://github.com/streamlit/streamlit/actions/workflows/patch-release-branch-creation.yml)
from `develop` with:

- `patch_version`: the new patch version;
- `base_tag`: the immediately preceding release in that minor line.

The workflow checks out the base tag, creates `release/<patch-version>`, updates
the core package versions, regenerates `uv.lock`, commits the version update,
and pushes the branch.

### 3. Cherry-pick and test the fix

Use [Cherry-Pick to Release Branch](https://github.com/streamlit/streamlit/actions/workflows/cherry-pick-to-release-branch.yml)
once for each approved fix commit. Prefer commits that have already landed on
`develop`, so the merge-back PR does not become the only place containing the
fix.

Verify:

- the reported issue is fixed on the patch branch;
- nearby behavior has not regressed;
- focused automated tests pass;
- the branch contains only the version update and approved fixes.

If the incident affected custom components, also test the relevant component
API and decide whether a separate npm package release is required.

### 4. Tag, publish, and follow up

Use the same steps as a regular release:

1. [Create the tag and merge-back PR](#4-create-the-tag-and-merge-back-pr).
2. [Deploy static assets for SiS](#5-deploy-static-assets-for-sis).
3. [Build and publish](#6-build-and-publish) from the patch tag.
4. [Verify and close out](#7-verify-and-close-out).

Also respond to the people who reported the issue. For a significant incident
or a failed emergency release, create a postmortem and schedule a review
according to the current internal incident process.

## Separately versioned component packages

The core release automation does not update either component-library package;
their versions are independent from the `streamlit` version.

For `@streamlit/component-v2-lib`:

1. Run [Bump @streamlit/component-v2-lib version and open PR](https://github.com/streamlit/streamlit/actions/workflows/bump-component-v2-lib.yml).
2. Ensure the resulting `frontend/component-v2-lib/package.json` change is in
   the release branch before tagging. If it landed after cutoff, cherry-pick its
   commit.
3. After the core tag exists, run [Publish @streamlit/component-v2-lib to npm](https://github.com/streamlit/streamlit/actions/workflows/publish-component-v2-lib.yml)
   from that tag. This workflow builds, lints, tests, validates the package,
   waits for `release` environment approval, publishes through npm trusted
   publishing, and verifies registry propagation.

Publishing the v1 `streamlit-component-lib` must currently be handled manually.
Components v1 is considered legacy, and no new releases are planned.

## Handling failures

- **Cherry-pick conflict:** The workflow aborts and does not push. Resolve it
  manually on `release/<version>`, test, and push.
- **Test failure before publication:** Determine whether the failure is a
  product regression, a bad test, or a confirmed flake. Fix real defects on
  `develop` and cherry-pick only the approved fix. If a tag already exists but
  the release has not been published, move the tag to the updated release
  branch head. Do not re-run [Release Tag and PR Creation](https://github.com/streamlit/streamlit/actions/workflows/release-tag-and-pr-creation.yml);
  that workflow refuses to recreate an existing tag. Delete and recreate the
  tag manually on the updated release-branch head instead:

  ```bash
  git fetch origin "release/<version>"
  git tag -d "<version>"
  git push origin ":refs/tags/<version>"
  git tag -a "<version>" -m "Release <version>" "origin/release/<version>"
  git push origin "<version>"
  ```
- **Failure during or after publication:** Check PyPI and GitHub Releases before
  retrying. Package uploads and releases are externally visible and cannot be
  treated like an unstarted job.
- **Unexpected branch, PR, tag, or version validation failure:** Stop and
  correct the repository state. Do not bypass the guard or publish from an
  arbitrary ref.
