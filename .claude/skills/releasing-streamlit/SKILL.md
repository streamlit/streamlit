---
name: releasing-streamlit
description: Runs a Streamlit core release (regular x.y.0 or patch x.y.z) from wiki/release-process.md, pausing at each human gate. Invoke explicitly with /releasing-streamlit <version>.
disable-model-invocation: true
---

# Releasing Streamlit

Drive a core release with the user, following [`wiki/release-process.md`](../../../wiki/release-process.md). That runbook and the workflows in `.github/workflows/` are the source of truth. This skill adds how to drive them from an agent session: how to tell what is already done, when to ask, and where a human has to act.

**Usage:** `/releasing-streamlit <version>`, for example `/releasing-streamlit 1.67.0`. A patch version (`1.66.2`) runs the patch flow.

Read the runbook before the first step. If it disagrees with this skill, follow the runbook and tell the user this skill is out of date.

## Work out the state first, every time

Start every invocation, and finish every step, by running the read-only status board:

```bash
uv run --no-project python .claude/skills/releasing-streamlit/scripts/release_status.py <version>
```

It derives each step's state from GitHub, PyPI, and the SiS asset CDN. Nothing is stored locally, so rerunning the skill after a break, a crash, or someone else's manual step resumes correctly. Trust the board over your memory of the conversation, and show it to the user so they can see where things stand.

- `✗` on any row means stop. Show the row and ask the user how to proceed. Do not repair state automatically: a contradictory state (a tag that is not at the branch head, a build running on an old commit) usually means someone acted by hand, and guessing can publish the wrong commit.
- `…` means a run is in flight. Attach to it and watch; never dispatch the same workflow again. On the branch, cherry-pick, and tag rows the API can't show which version a run is for, so open the link and check before acting.
- `»` means the next step needs a human or a source the script can't read. On the cherry-picks row before tagging, it lists what's on the branch so far; it is not a decision.
- `⚠` means the board can't confirm the step (a red nightly, a branch base that matches no nightly, a successful build PyPI doesn't show yet). Show the row and ask before acting on it.
- The script exits with code 2 if a lookup failed (network, `gh` auth, rate limit). Report it and retry later; do not read a failed lookup as "not done".
- The board enforces the runbook's "one release in the publish phase at a time": another open `release/*` PR is `⚠` on the tag row until this release has a branch, then `✗`.

## Things the agent never does

These are irreversible or belong to a person, so they stay with the user even if the agent's credentials would allow them:

- Approve a deployment to the `release` environment. The second person's review is the release's independent check; an agent approving with someone's login defeats it.
- Post to Slack or reply on issues and forums. Draft the text instead.
- Set `dangerous_overwrite_existing_static_assets`, resolve a cherry-pick conflict, or work around a workflow's validation guard.

## Asking the user

Use `AskUserQuestion` for every decision and every handoff. In tools without it, ask the same question with numbered options. Keep status updates (progress, check results) as plain text.

- Put the decision and its main risk in the question. Put the exact command and its effect in the option preview, so the user sees what they approve.
- Offer a "Pause here" option on handoffs. Pausing is safe because the next invocation rebuilds state from the board.
- Copy a draft to the clipboard only if the user picks that option. The prod static-assets job link in step 5 is the exception: always copy it.

## Writes

Every write needs its own confirmation that names it: dispatching a workflow, submitting a Jenkins job, pushing or moving a tag, opening or merging a PR.

- The release workflows send Slack notifications when they run, so say so in the preview for any dispatch.
- Dispatch every workflow from `develop` except Build Release, which runs from the tag.
- The board's reads work on any `gh` account, but dispatches need write access to `streamlit/streamlit`. Check `gh auth status` before the first write, and switch accounts if needed.
- Offer `dry_run=true` first for the four workflows that have it, and say what it covers. Cherry-pick attempts the real pick and skips only the push, so it catches conflicts. Release branch and patch branch validate the inputs and check out the tag, but skip the branch script, so the version bump and `uv lock` don't run. Tag + PR validates the inputs, that the branch exists, and that the tag doesn't. No run of it checks for other open `release/*` PRs, so read the board's tag row before the real run.
- Recent `gh` versions print the run URL after `gh workflow run`; older ones print nothing. Either way, note the time just before dispatching and confirm the run by workflow, `event=workflow_dispatch`, your `gh` login, and a creation time after that timestamp. If it doesn't show up yet, poll again. Never dispatch a second time because the first run hasn't appeared.
- Confirm the result by its effect (the branch exists, the tag is at the branch head), not only by the run's conclusion. Print each run URL as soon as you find it, and each resulting branch, tag, or PR link as it appears.

## Regular release steps

Step numbers match the runbook.

1. **Cutoff nightly.** Nightly tags are named for the day *before* the 04:30 UTC run, so the run on Nov 5 publishes `x.y.z.dev20261104`.
   1. Confirm the nightly workflow is green.
   2. For SiS e2e, read the jenkins bot posts in Slack `#e2e-tests-sis-oss` (through Glean if available) for runs after the nightly published. Read the `Run`/`Passed` counts, not the PASSED/FAILED header, which has said PASSED at 1/5, and note if the suite has shrunk. If no run has covered the nightly yet, ask whether to wait, use the previous nightly, or pause. If you can't read Slack, ask the user to check the channel or the Datadog dashboard linked in the runbook.
   3. Ask the user whether specific PRs must be in the release, and confirm each by merge commit. A PR merged into another PR's branch only lands through that PR.
2. **Release branch.** Dispatch with the exact nightly tag. Afterwards, the diff from `<nightly>^` should be a single `Up version to <version>` commit touching the package version files (`lib/pyproject.toml`, the frontend `package.json` files) and `uv.lock`. Stop if it's anything else.
3. **Cherry-picks.** Ask whether any are needed before tagging. One full 40-character SHA per run; the workflow rejects short SHAs. On a conflict, hand off. If `@streamlit/component-v2-lib` needs a version bump this release, its commit must be on the branch before tagging (runbook, "Separately versioned component packages").
4. **Tag and merge-back PR.** Leave the PR open until publishing completes; Build Release looks for it.
5. **SiS static assets.** In this order:
   1. Ask whether any SiS static-asset patches landed since the branch point. If so, the internal Static Assets doc's patch instructions apply (that is when `is_internal_patch` is set); walk through them with the user. Otherwise leave it unchecked.
   2. Submit the preprod job if the user has access: `sf jenkins submit -c https://snowpark-python-001.jenkinsdev1.us-west-2.aws-dev.app.snowflake.com -j Streamlit/job/streamlit-build -p "streamlit_release_version=<version>"`.
   3. Wait for the board's preprod 200 on `index.css` and `index.js`. That is the internal doc's check; there is no separate render check.
   4. Give the user the prod job link and copy it to the clipboard without asking: <https://prod-001.jenkins.jenkinsprod1.us-west-2.aws-dev.app.snowflake.com/job/Streamlit/job/streamlit-build/build?delay=0sec>. Tell them to set `streamlit_release_version=<version>` and leave `dangerous_overwrite_existing_static_assets` unchecked. Agents can't submit on that controller, so the user runs it, or hands it to someone with ci-prod Jenkins access (Okta group `jenkins-ci-prod-st-platform`).
   5. Confirm the user's build with `sf jenkins status`, `get-params`, and `fetch-logs`, which do work there: it should be for `<version>` and have checked out the tag commit.
   6. Wait for the board's prod 200. Only then go to step 6.
6. **Build Release.** Dispatch with `--ref <version>`. The `release` environment only accepts `x.y.z` tags and prevents self-review, so whoever triggers the run can't approve it. While tests run, report progress and the first failing job immediately. When it waits for approval, show the evidence (release PR diff, tag SHA vs branch head, run commit vs tag, package versions, test results). Draft "Release needs approval: <run URL>" for Slack `#pe-st-open-source-release`, the format past releases used there, and ask whether it has already been sent. Present the checks as evidence for the approver to verify, not as a sign-off.
7. **Docs.** Confirm PyPI and the GitHub release, then smoke-test in a throwaway venv outside the repo (install `streamlit==<version>` from PyPI, `streamlit version`, run a small app). Run `git fetch --tags` and the `generating-changelog` skill. Show which PRs it dropped so the user can pull any back. Then run `updating-docs-for-release` in a `streamlit/docs` checkout. Opening that PR writes to another repo, so confirm it separately. The docs PR needs a reviewer who isn't the author. New commands may need API images from a designer, and new example apps are deployed to Community Cloud by hand.
8. **Close out.** Merge the release PR into `develop` with a squash merge, as past release PRs were. Watch the conda-forge feedstock PR (it appears a couple of hours after PyPI). If its checks fail, help fix them. Merging needs a feedstock maintainer. If component-v2-lib was bumped, offer its publish workflow from the core tag. Draft "Released Streamlit v<version>" for `#anaconda-snowflake-technical`, and remind the user about issue and forum follow-ups.

## Patch releases

Follow the runbook's "Patch release" section. The base tag is the previous release in the same minor line (`1.66.1` for `1.66.2`, `1.66.0` for `1.66.1`).

1. Dispatch the patch branch workflow with `patch_version` and `base_tag`.
2. Cherry-pick each approved fix, preferring commits already on `develop`. Then work through the runbook's verification with the user: the fix works on the branch, nearby behavior hasn't regressed, focused tests pass, and the branch contains only the version bump and the fixes. If custom components were affected, decide with the user whether an npm release is needed.
3. Then run regular steps 4, 5, 6 and 8. Skip docs. Remind the user to reply to whoever reported the issue, and that a significant incident needs a postmortem.

## When something fails

- **Tests fail before publishing:** show the failing jobs. Offer to investigate, re-run failed jobs, or pause. Never offer to approve anyway.
- **Failure during or after publishing:** check PyPI and the GitHub release before offering anything. A published version is immutable, so a fix needs a new version.
- **The tag must move** (a fix has to land after tagging, before publishing). Prefer this order: show the commits between the tag and the branch head, and have the user confirm each is an approved pick. Nothing else may ship. Cancel any Build Release run on the old commit. If any commit isn't approved, stop: the tag must be the branch head, so tagging below it isn't a way out. Then recreate the tag at the branch head's SHA as you confirmed it (`git tag -a <version> -m "Streamlit <version>" <confirmed-sha>`), not at a branch ref that could move in between. If the static assets were already deployed from the old commit, stop and hand off: they can't be rebuilt without the overwrite flag, which is not the agent's call. The board can't see which commit the assets came from, so its assets ✓ doesn't settle this; check the Jenkins build's parameters and logs.
- **A workflow's validation guard trips:** stop and show it.

## Finishing

End with the final board and a link list for the release thread: branch, tag, release PR, run URLs, PyPI, GitHub release, docs PR, sitemap PR, conda-forge PR.
