#!/usr/bin/env python3
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Print the status board for a Streamlit core release. Read-only.

Derives every step's state from GitHub, PyPI, and the SiS static asset CDN, so
it is safe to run at any time and gives the same answer however many times it
runs. It never dispatches workflows, pushes, or merges.

Usage:
    uv run --no-project python .claude/skills/releasing-streamlit/scripts/release_status.py 1.67.0
    uv run --no-project python .claude/skills/releasing-streamlit/scripts/release_status.py 1.67.0 --json

Steps the script cannot observe (SiS e2e results in Slack, the Anaconda
request, Community Cloud example apps) are reported as "manual".
"""

# A CLI that shells out to `gh` and prints a report.
# ruff: noqa: T201, S404, S603, S310

from __future__ import annotations

import argparse
import json
import operator
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from typing import Any

REPO = "streamlit/streamlit"
DOCS_REPO = "streamlit/docs"
FEEDSTOCK_REPO = "conda-forge/streamlit-feedstock"
VERSION_COMMIT_PREFIX = "Up version to "
ASSET_HOSTS = {"preprod": "preprod.app.snowflake.com", "prod": "app.snowflake.com"}
ASSET_PATHS = ("static/css/index.css", "static/js/index.js")
# Agents can't submit on this controller, so the board links it for the user.
PROD_ASSETS_JOB = (
    "https://prod-001.jenkins.jenkinsprod1.us-west-2.aws-dev.app.snowflake.com"
    "/job/Streamlit/job/streamlit-build/build?delay=0sec"
)
# The SiS CDN answers 403 to urllib's default user agent.
USER_AGENT = "streamlit-release-status/1.0"

# Single-width BMP symbols, so the columns line up and no viewer mangles them.
DONE, RUNNING, TODO, FAIL, WARN, MANUAL, NA = "✓", "…", "·", "✗", "⚠", "»", "-"


@dataclass
class Step:
    key: str
    title: str
    state: str = TODO
    detail: str = ""
    links: list[str] = field(default_factory=list)
    # A workflow run of this step is in flight: attach to it before anything else.
    active: bool = False
    # Only a person's confirmation is left; later steps can proceed meanwhile.
    confirm_only: bool = False


class UnavailableError(Exception):
    """A lookup failed (network, auth). Reported as a warning, never as 'not done'."""


def gh_api(path: str, *, jq: str | None = None, paginate: bool = False) -> Any:
    cmd = ["gh", "api", path]
    if paginate:
        cmd.append("--paginate")
    if jq:
        cmd += ["--jq", jq]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60, check=False
        )
    except subprocess.TimeoutExpired as e:
        raise UnavailableError(f"gh api {path}: timed out") from e
    if proc.returncode != 0:
        if any(m in proc.stderr for m in ("Not Found", "HTTP 404", "No commit found")):
            return None
        raise UnavailableError(f"gh api {path}: {proc.stderr.strip()[:200]}")
    out = proc.stdout.strip()
    if not out:
        return None
    if jq:
        return out
    return json.loads(out)


def asset_exists(url: str) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            # Some Snowsight paths answer a missing file with 200 and the app's
            # HTML page, so a 200 alone doesn't prove the asset is there.
            return resp.status == 200 and "html" not in resp.headers.get(
                "Content-Type", ""
            )
    except urllib.error.HTTPError as e:
        # A missing asset is a 403 or 404; anything else is a failed lookup.
        if e.code in {403, 404}:
            return False
        raise UnavailableError(f"{url}: HTTP {e.code}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise UnavailableError(f"{url}: {e}") from e


def recent_prs(repo: str, state: str = "all", pages: int = 1) -> list[dict[str, Any]]:
    prs: list[dict[str, Any]] = []
    for page in range(1, pages + 1):
        batch = (
            gh_api(f"repos/{repo}/pulls?state={state}&per_page=100&page={page}") or []
        )
        prs += batch
        if len(batch) < 100:
            break
    return prs


def pypi_versions() -> list[str]:
    try:
        with urllib.request.urlopen(
            "https://pypi.org/pypi/streamlit/json", timeout=20
        ) as resp:
            data = json.load(resp)
    except (urllib.error.URLError, TimeoutError) as e:
        raise UnavailableError(f"PyPI: {e}") from e
    return [v for v, files in data["releases"].items() if files]


def parse(v: str) -> tuple[int, int, int] | None:
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", v)
    return (int(m[1]), int(m[2]), int(m[3])) if m else None


def ref_sha(ref: str) -> str | None:
    """Commit SHA for refs/heads/... or refs/tags/... (annotated tags are peeled)."""
    data = gh_api(f"repos/{REPO}/commits/{ref}", jq=".sha")
    return data or None


def compare(base: str, head: str) -> dict[str, Any]:
    cmp = gh_api(f"repos/{REPO}/compare/{base}...{head}")
    if cmp is None:
        raise UnavailableError(f"compare {base}...{head} returned 404")
    return cmp


def active_runs(workflow: str) -> list[dict[str, Any]]:
    """Unfinished runs of a workflow. The API can't filter by dispatch inputs,
    so a run here may be for another version.
    """
    runs = gh_api(f"repos/{REPO}/actions/workflows/{workflow}/runs?per_page=10") or {}
    return [r for r in runs.get("workflow_runs") or [] if r["status"] != "completed"]


def expected_version_check(version: str, published: list[str]) -> Step:
    step = Step("version", "Version")
    target = parse(version)
    if target is None:
        step.state, step.detail = FAIL, f"{version!r} is not a full x.y.z version"
        return step
    parsed = sorted(p for p in (parse(v) for v in published) if p)
    if target in parsed:
        step.state, step.detail = DONE, "already on PyPI"
        return step
    latest = parsed[-1]
    maj, minor, patch = target
    if patch == 0:
        expected = (latest[0], latest[1] + 1, 0)
        ok = target == expected
        why = (
            f"next minor after {'.'.join(map(str, latest))} is "
            f"{'.'.join(map(str, expected))} (major releases aren't supported)"
        )
    else:
        ok = (maj, minor, patch - 1) in parsed
        why = f"a patch must follow {maj}.{minor}.{patch - 1}, which is not on PyPI"
    if ok:
        kind = "regular" if patch == 0 else "patch"
        step.state, step.detail = (
            DONE,
            f"{kind} release; latest PyPI is {'.'.join(map(str, latest))}",
        )
    else:
        step.state, step.detail = FAIL, f"unexpected version: {why}"
    return step


def nightly_tags(prev: tuple[int, int, int]) -> list[str]:
    """Nightly tags after the previous release, newest first.

    Nightlies are versioned one patch above the latest PyPI release at the time,
    so a patch published after the cutoff changes the prefix. Search the whole
    minor line of the previous release and sort by the date suffix.
    """
    tags = gh_api(
        f"repos/{REPO}/git/matching-refs/tags/{prev[0]}.{prev[1]}.",
        jq=".[].ref",
        paginate=True,
    )
    if not tags:
        return []
    return sorted(
        (
            name
            for t in tags.splitlines()
            if ".dev" in (name := t.removeprefix("refs/tags/"))
        ),
        key=lambda n: n.rsplit(".dev", 1)[1],
        reverse=True,
    )


def find_cutoff_nightly(base_sha: str, prev: tuple[int, int, int]) -> str | None:
    """Return the nightly tag whose parent commit is the release branch's base."""
    for name in nightly_tags(prev)[:30]:
        # commits/<tag> peels annotated tags and includes the parents.
        parent = gh_api(f"repos/{REPO}/commits/refs/tags/{name}", jq=".parents[0].sha")
        if parent == base_sha:
            return name
    return None


def latest_nightly_run() -> dict[str, Any] | None:
    runs = gh_api(
        f"repos/{REPO}/actions/workflows/nightly.yml/runs?per_page=1&event=schedule"
    )
    workflow_runs = (runs or {}).get("workflow_runs") or []
    return workflow_runs[0] if workflow_runs else None


def status(version: str) -> dict[str, Any]:
    steps: list[Step] = []
    published = pypi_versions()
    vstep = expected_version_check(version, published)
    steps.append(vstep)
    target = parse(version)
    if vstep.state == FAIL or target is None:
        return {
            "version": version,
            "steps": [asdict(s) for s in steps],
            "next": "Fix the version argument.",
        }

    is_patch = target[2] != 0
    on_pypi = version in published
    branch = f"release/{version}"
    branch_sha = ref_sha(f"refs/heads/{branch}")
    tag_sha = ref_sha(f"refs/tags/{version}")

    # 1. Cutoff
    prev = max(p for p in (parse(v) for v in published) if p and p < target)
    cutoff = Step("cutoff", "Base" if is_patch else "Cutoff nightly")
    base_ref: str | None = None
    if is_patch:
        base_ref = f"{target[0]}.{target[1]}.{target[2] - 1}"
        cutoff.state, cutoff.detail = DONE, f"base tag {base_ref}"
    elif tag_sha or branch_sha:
        cmp = compare("develop", tag_sha or branch_sha)
        base_sha = cmp["merge_base_commit"]["sha"]
        nightly = find_cutoff_nightly(base_sha, prev)
        if nightly:
            base_ref = f"{nightly}^"
            cutoff.state, cutoff.detail = (
                DONE,
                f"{nightly} (from {branch} base {base_sha[:9]})",
            )
        else:
            base_ref = base_sha
            cutoff.state, cutoff.detail = (
                WARN,
                f"branch base {base_sha[:9]} matches no nightly tag",
            )
    else:
        run = latest_nightly_run()
        if run:
            green = run["conclusion"] == "success"
            cutoff.state = MANUAL if green else WARN
            tags = nightly_tags(prev)
            cutoff.detail = (
                f"latest nightly run {run['created_at']} {run['conclusion'] or run['status']}"
                f" · newest nightly tag {tags[0] if tags else 'none since ' + '.'.join(map(str, prev))}. "
                "Confirm the tag and check SiS e2e counts in #e2e-tests-sis-oss."
            )
            cutoff.links.append(run["html_url"])
    steps.append(cutoff)

    # 2. Branch
    bstep = Step("branch", "Release branch")
    branch_wf = (
        "patch-release-branch-creation.yml"
        if is_patch
        else "release-branch-creation.yml"
    )
    if branch_sha:
        bstep.state, bstep.detail = DONE, f"{branch} @ {branch_sha[:9]}"
    elif running := active_runs(branch_wf):
        bstep.state = RUNNING
        bstep.active = True
        bstep.detail = (
            f"{branch_wf} run in progress; attach to it, don't dispatch again"
        )
        bstep.links += [r["html_url"] for r in running]
    steps.append(bstep)

    # 3. Cherry-picks
    pstep = Step("picks", "Cherry-picks")
    head_sha = tag_sha or branch_sha
    if head_sha and base_ref:
        cmp = compare(base_ref, head_sha)
        heads = [c["commit"]["message"].split("\n")[0] for c in cmp["commits"]]
        picks = [h for h in heads if not h.startswith(VERSION_COMMIT_PREFIX)]
        pstep.detail = f"{len(picks)}: " + "; ".join(picks[:5]) if picks else "none"
        if len(picks) > 5:
            pstep.detail += f"; … {len(picks) - 5} more"
        # Before tagging, the list is not a decision: ask whether more are needed.
        if tag_sha:
            pstep.state = DONE
        else:
            pstep.state = MANUAL
            pstep.detail += " so far · ask whether more are needed before tagging"
    if not on_pypi and (running := active_runs("cherry-pick-to-release-branch.yml")):
        pstep.state = RUNNING
        pstep.active = True
        pstep.detail = (
            pstep.detail + " · " if pstep.detail else ""
        ) + "cherry-pick run in progress"
        pstep.links += [r["html_url"] for r in running]
    steps.append(pstep)

    # 4. Tag + merge-back PR
    tstep = Step("tag", "Tag + merge-back PR")
    prs = (
        gh_api(f"repos/{REPO}/pulls?state=all&head=streamlit:{branch}&per_page=5") or []
    )
    pr = prs[0] if prs else None
    open_prs = recent_prs(REPO, state="open", pages=3)
    others = [
        str(p["number"])
        for p in open_prs
        if p["head"]["ref"].startswith("release/")
        and (not pr or p["number"] != pr["number"])
    ]
    pr_pending = False
    if tag_sha:
        if branch_sha and tag_sha != branch_sha and not on_pypi:
            tstep.state = FAIL
            tstep.detail = (
                f"tag {tag_sha[:9]} is NOT the branch head {branch_sha[:9]}. Stop."
            )
        else:
            tstep.state = DONE
            tstep.detail = f"{version} @ {tag_sha[:9]}"
        if pr:
            state = "merged" if pr.get("merged_at") else pr["state"]
            tstep.detail += f" · PR #{pr['number']} {state}"
            tstep.links.append(pr["html_url"])
            # Build Release finds the release branch through the open PR.
            if state != "open" and not on_pypi:
                tstep.state = FAIL
                tstep.detail += ", but it must stay open until publishing"
        elif not on_pypi:
            # Only a missing PR on a correctly placed tag can be a run in progress.
            pr_pending = tstep.state == DONE
            tstep.state, tstep.detail = FAIL, tstep.detail + " · no merge-back PR"
    if not on_pypi and (running := active_runs("release-tag-and-pr-creation.yml")):
        # A running Tag + PR explains a missing tag or PR, but not a tag off the
        # branch head or a closed PR. The run may also be for another version.
        if tstep.state == TODO or pr_pending:
            tstep.state = RUNNING
            tstep.active = True
            note = "tag + PR run in progress; attach to it, don't dispatch again"
        else:
            note = "a tag + PR run is in progress, likely for another version"
        tstep.detail = (tstep.detail + " · " if tstep.detail else "") + note
        tstep.links += [r["html_url"] for r in running]
    if others and not on_pypi:
        # Tag + PR would open a second release PR, which Build Release can't tell
        # apart. Before this release has a branch it's only a heads-up.
        tstep.state = FAIL if branch_sha else WARN
        note = f"other open release/* PRs: {', '.join('#' + n for n in others)}"
        tstep.detail = f"{tstep.detail} · {note}" if tstep.detail else note
    # scripts/get_release_branch.py reads only the first page (30 newest) of open PRs.
    if pr and pr["state"] == "open" and not on_pypi:
        first_page = {p["number"] for p in open_prs[:30]}
        if pr["number"] not in first_page and tstep.state != FAIL:
            tstep.state = WARN
            tstep.detail += (
                " · release PR is not among the 30 newest open PRs, so Build Release"
                " won't find it"
            )
    steps.append(tstep)

    # 5. SiS static assets
    astep = Step("assets", "SiS static assets")
    results = {}
    for env, host in ASSET_HOSTS.items():
        results[env] = all(
            asset_exists(f"https://{host}/static/streamlit/{version}/{p}")
            for p in ASSET_PATHS
        )
    if all(results.values()):
        astep.state, astep.detail = DONE, "preprod 200 · prod 200"
    elif results["preprod"]:
        astep.state, astep.detail = (
            MANUAL,
            "preprod 200 · prod missing (run the prod Jenkins job)",
        )
        astep.links.append(PROD_ASSETS_JOB)
    else:
        astep.detail = "preprod missing · prod " + (
            "200" if results["prod"] else "missing"
        )
    steps.append(astep)

    # 6. Build Release
    rstep = Step("build", "Build Release")
    if on_pypi:
        rel = gh_api(f"repos/{REPO}/releases/tags/{version}")
        rstep.state = DONE if rel else WARN
        rstep.detail = "on PyPI · GitHub release " + ("exists" if rel else "MISSING")
        if rel:
            rstep.links.append(rel["html_url"])
    else:
        runs = gh_api(
            f"repos/{REPO}/actions/workflows/release.yml/runs?branch={version}&per_page=5"
        )
        workflow_runs = (runs or {}).get("workflow_runs") or []
        run = workflow_runs[0] if workflow_runs else None
        if run:
            rstep.links.append(run["html_url"])
            if run["status"] == "completed":
                if tag_sha and run["head_sha"] != tag_sha:
                    if run["conclusion"] == "success":
                        # It may already have uploaded; PyPI's JSON API can lag.
                        rstep.state = FAIL
                        rstep.detail = (
                            f"a run on {run['head_sha'][:9]} succeeded but tag {version} "
                            f"is {tag_sha[:9]}. Check PyPI before anything else."
                        )
                    else:
                        # The tag moved after this run; a new run is the next step.
                        rstep.detail = (
                            f"last run {run['conclusion']} on {run['head_sha'][:9]}, "
                            f"before tag {version} moved to {tag_sha[:9]}"
                        )
                elif run["conclusion"] == "success":
                    # PyPI's JSON API can lag the upload by a few minutes.
                    rstep.state = WARN
                    rstep.detail = f"run succeeded but {version} is not on PyPI yet"
                else:
                    rstep.state = FAIL
                    rstep.detail = (
                        f"last run {run['conclusion']} and {version} is not on PyPI"
                    )
            else:
                pending = (
                    gh_api(f"repos/{REPO}/actions/runs/{run['id']}/pending_deployments")
                    or []
                )
                rstep.state = RUNNING
                rstep.active = True
                rstep.detail = (
                    "waiting for `release` approval"
                    if pending
                    else f"run {run['status']}"
                )
        # A run started before the tag moved builds the old commit, and it can
        # still be waiting for approval behind a newer run.
        stale = [
            r
            for r in workflow_runs
            if r["status"] != "completed" and tag_sha and r["head_sha"] != tag_sha
        ]
        if stale:
            note = (
                f"in-flight run on {stale[0]['head_sha'][:9]} but tag {version} "
                f"is {tag_sha[:9]}. Cancel it; do not approve it."
            )
            # Keep an earlier stop (a succeeded run PyPI may not list yet) visible.
            rstep.detail = f"{rstep.detail} · {note}" if rstep.state == FAIL else note
            rstep.state = FAIL
            rstep.links = [r["html_url"] for r in stale] + rstep.links
    steps.append(rstep)

    # 7. Docs (regular releases only)
    if is_patch:
        steps.append(Step("docs", "Docs", NA, "not needed for patch releases"))
    else:
        dstep = Step("docs", "Docs", detail="no docs PR found")
        docs_prs = recent_prs(DOCS_REPO, pages=2)
        # Match only the release PR ("Update docs for Streamlit <v> release");
        # follow-up PRs also mention the version and must not count as done.
        release_re = re.compile(rf"Streamlit {re.escape(version)} release")
        doc = next((p for p in docs_prs if release_re.search(p["title"])), None)
        if doc:
            num, state, merged_at = doc["number"], doc["state"], doc["merged_at"]
            dstep.links.append(doc["html_url"])
            if merged_at:
                after = [
                    p
                    for p in docs_prs
                    if p["title"] == "Automated sitemap update"
                    and p["merged_at"]
                    and p["merged_at"] >= merged_at
                ]
                sitemap = (
                    min(after, key=operator.itemgetter("merged_at"))["number"]
                    if after
                    else None
                )
                # The board can't see Community Cloud deploys, so a person confirms.
                dstep.state = MANUAL if sitemap else RUNNING
                dstep.confirm_only = bool(sitemap)
                dstep.detail = f"PR #{num} merged · sitemap " + (
                    f"#{sitemap} merged" if sitemap else "pending"
                )
                dstep.detail += (
                    " · confirm any example apps in the docs PR are deployed"
                )
            elif state == "closed":
                dstep.state = FAIL
                dstep.detail = f"PR #{num} was closed without merging"
            else:
                dstep.state, dstep.detail = (
                    RUNNING,
                    f"PR #{num} {state}, awaiting review/merge",
                )
        steps.append(dstep)

    # 8. Close out
    cstep = Step("closeout", "Close out")
    parts = []
    pr_merged = bool(pr and pr.get("merged_at"))
    parts.append(
        "release PR " + ("merged" if pr_merged else pr["state"] if pr else "not opened")
    )
    feed = next(
        (p for p in recent_prs(FEEDSTOCK_REPO) if p["title"].endswith(f"v{version}")),
        None,
    )
    feed_merged = bool(feed and feed["merged_at"])
    if feed:
        parts.append(
            f"conda-forge #{feed['number']} "
            + ("merged" if feed_merged else feed["state"])
        )
        cstep.links.append(feed["html_url"])
    else:
        parts.append("conda-forge PR not yet opened")
    # The Anaconda request can go out as soon as the release is on PyPI.
    if on_pypi:
        parts.append(
            "send the Anaconda request in #anaconda-snowflake-technical"
            " and do issue/forum follow-ups"
        )
    cstep.detail = " · ".join(parts)
    if pr_merged and feed_merged:
        # The rest is outside what the board can see.
        cstep.state = MANUAL
        cstep.confirm_only = True
    elif on_pypi:
        cstep.state = RUNNING
    steps.append(cstep)

    return {
        "version": version,
        "steps": [asdict(s) for s in steps],
        "next": next_action(steps),
    }


def next_action(steps: list[Step]) -> str:
    """Stops first, then in-flight workflow runs (attach instead of dispatching
    again), then the first unfinished step in release order. Steps that only
    need a person to confirm don't hold up later steps, so they come last.
    """
    for s in steps:
        if s.state == FAIL:
            return f"Stop: {s.title}: {s.detail}"
    active = [s for s in steps if s.active]
    if active:
        return "Watch: " + "; ".join(f"{s.title}: {s.detail}" for s in active)
    for s in steps:
        if s.state not in {DONE, NA} and not s.confirm_only:
            return f"{s.title}: {s.detail or 'not started'}"
    confirm = [s for s in steps if s.confirm_only]
    if confirm:
        return "Confirm with the user: " + "; ".join(
            f"{s.title}: {s.detail}" for s in confirm
        )
    return "All steps done."


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("version", help="full x.y.z version, e.g. 1.67.0")
    parser.add_argument(
        "--json", action="store_true", help="print machine-readable output"
    )
    args = parser.parse_args()
    try:
        result = status(args.version)
    except UnavailableError as e:
        print(f"{WARN} could not complete lookups: {e}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    print(f"Streamlit release {result['version']}\n")
    for s in result["steps"]:
        print(f"  {s['state']}  {s['title']:<22} {s['detail']}")
        for link in s["links"]:
            print(f"     {'':<22} {link}")
    print(f"\n  Next: {result['next']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
