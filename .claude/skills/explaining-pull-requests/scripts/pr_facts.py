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

"""Gather everything needed to write a PR report, for one or more PRs.

Exists because doing this by hand is ~10 gh/git calls, and because one of them
fails *silently* rather than loudly:

    Diffing a PR locally needs a real merge base. A freshly created worktree has
    no `origin/develop` ref, so `git merge-base` returns empty and the diff
    silently expands to the entire repository (a 3-file PR reads as 870 files).
    We take the diff from GitHub instead, then assert its file count matches the
    count GitHub reports for the PR. A mismatch means the diff is wrong, and
    every downstream conclusion would be built on fiction.

Also classifies the changed files the way a Streamlit reviewer would, so the
report's stat chip and its risk notes have something real to stand on:
baselines, e2e tests, protos, public API surface, theme tokens.

Usage:
    uv run python scripts/pr_facts.py <pr-ref> [<pr-ref> ...] --out DIR

<pr-ref> may be a full URL, owner/repo#123, owner/repo/123, or a bare number
(repo inferred from the current directory, so a bare number works inside a
streamlit/streamlit checkout).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

IMG_PATTERNS = [
    re.compile(r'<img[^>]+src="([^"]+)"', re.IGNORECASE),
    re.compile(r"!\[[^\]]*\]\((https?://[^)\s]+)\)"),
]

# How a Streamlit reviewer reads a file list. Order matters only for reporting.
FILE_CLASSES: dict[str, re.Pattern[str]] = {
    "snapshot_baselines": re.compile(r"^e2e_playwright/__snapshots__/.*\.png$"),
    "e2e_tests": re.compile(r"^e2e_playwright/(?!__snapshots__/).*_test\.py$"),
    "e2e_apps": re.compile(
        r"^e2e_playwright/(?!__snapshots__/)(?!.*_test\.py$)[^/]*\.py$"
    ),
    "protos": re.compile(r"^proto/streamlit/proto/.*\.proto$"),
    "python_elements": re.compile(r"^lib/streamlit/elements/"),
    "python_runtime": re.compile(r"^lib/streamlit/runtime/"),
    "python_tests": re.compile(r"^lib/tests/"),
    "type_tests": re.compile(r"^lib/tests/streamlit/typing/"),
    "frontend_components": re.compile(r"^frontend/(lib|app)/src/components/"),
    "frontend_theme": re.compile(r"^frontend/lib/src/theme/"),
    "frontend_tests": re.compile(r"^frontend/.*\.test\.tsx?$"),
    "config": re.compile(r"^lib/streamlit/config\.py$"),
}

# Paths whose change puts the PR in the blast radius the assessing-external-test-risk
# skill exists for: proxies, embedded iframes, CSP, cross-origin, pinned hosts.
EXTERNAL_RISK = re.compile(
    r"^(lib/streamlit/web/|lib/streamlit/runtime/(websocket|http|secrets)"
    r"|frontend/connection/|lib/streamlit/config\.py"
    r"|.*host_config|.*/Hostframe|.*embed)",
    re.IGNORECASE,
)

FIELDS = (
    "number,title,body,state,isDraft,additions,deletions,changedFiles,labels,"
    "headRefName,baseRefName,url,reviewDecision,headRefOid,createdAt,updatedAt,commits"
)


def run(cmd: list[str], check: bool = True) -> tuple[int, str, str]:
    p = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if check and p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{p.stderr.strip()}")
    return p.returncode, p.stdout, p.stderr


def parse_ref(ref: str) -> tuple[str | None, int]:
    """-> (owner/repo or None, number)."""
    m = re.search(r"github\.com/([^/]+/[^/]+)/pull/(\d+)", ref)
    if m:
        return m.group(1), int(m.group(2))
    m = re.match(r"^([^/\s]+/[^/#\s]+)[#/](\d+)$", ref)
    if m:
        return m.group(1), int(m.group(2))
    m = re.match(r"^#?(\d+)$", ref)
    if m:
        return None, int(m.group(1))
    raise SystemExit(f"Cannot parse PR reference: {ref!r}")


def harvest_images(text: str) -> list[str]:
    found: list[str] = []
    for pat in IMG_PATTERNS:
        for u in pat.findall(text or ""):
            if u.startswith("http") and u not in found:
                found.append(u)
    return found


def collect_reviews(repo: str, num: int) -> tuple[str, list[str]]:
    """Reviews + issue comments + inline review comments. -> (markdown, image urls)."""
    urls: list[str] = []
    lines: list[str] = []

    _, out, _ = run(
        ["gh", "pr", "view", str(num), "--repo", repo, "--json", "reviews,comments"]
    )
    d = json.loads(out)

    lines.append("# Reviews\n")
    for r in d.get("reviews", []):
        who = (r.get("author") or {}).get("login", "?")
        body = (r.get("body") or "").strip()
        lines.append(f"## review · {who} · {r.get('state')}\n")
        if body:
            lines.append(body + "\n")
            urls += harvest_images(body)

    lines.append("\n# Issue comments\n")
    for c in d.get("comments", []):
        who = (c.get("author") or {}).get("login", "?")
        body = (c.get("body") or "").strip()
        lines.append(f"## comment · {who}\n{body}\n")
        urls += harvest_images(body)

    lines.append("\n# Inline review comments (incl. bots)\n")
    code, out, _ = run(
        ["gh", "api", f"repos/{repo}/pulls/{num}/comments", "--paginate"], check=False
    )
    if code == 0:
        try:
            for c in json.loads(out):
                who = (c.get("user") or {}).get("login", "?")
                body = (c.get("body") or "").strip()
                lines.append(
                    f"## inline · {who} · {c.get('path')}:{c.get('line')} · "
                    f"{c.get('created_at')} · commit {(c.get('commit_id') or '')[:10]}\n{body}\n"
                )
                urls += harvest_images(body)
        except json.JSONDecodeError:
            lines.append("_(could not parse inline comments)_\n")

    return "\n".join(lines), urls


def diff_files(diff: str) -> list[str]:
    return re.findall(r"^diff --git a/(\S+)", diff, re.MULTILINE)


def classify(files: list[str]) -> dict[str, list[str]]:
    out = {
        name: [f for f in files if pat.search(f)] for name, pat in FILE_CLASSES.items()
    }
    out["external_risk_surface"] = [f for f in files if EXTERNAL_RISK.search(f)]
    return {k: v for k, v in out.items() if v}


def proto_additions(diff: str) -> dict[str, list[str]]:
    """Added proto field declarations and added enum values.

    Both are compatibility stories the diff states misleadingly, and they are
    different stories:

      * a new *field* takes a proto3 scalar default (`false`/`0`/`""`), so an
        older frontend behaves as it did before rather than as the diff implies;
      * a new *enum value* is a number an older frontend has no case for, so the
        question is what its switch statement's default branch does — which is
        usually not "the new behaviour" and occasionally not "the old" either.

    Field declarations are `<type> <name> = <n>;`; enum values are `NAME = <n>;`
    with no type. Matching only the former misses every PR that extends an enum,
    which is a common shape here (adding input types, chart kinds, layouts).
    """
    fields: list[str] = []
    enum_values: list[str] = []
    in_proto = False
    for line in diff.splitlines():
        if line.startswith("diff --git a/"):
            in_proto = ".proto" in line
            continue
        if not (in_proto and line.startswith("+") and not line.startswith("+++")):
            continue
        body = line[1:].strip().rstrip(";")
        m = re.match(
            r"^(?:optional\s+|repeated\s+)?([A-Za-z_][\w.]*)\s+(\w+)\s*=\s*(\d+)$", body
        )
        if m:
            fields.append(f"{m.group(1)} {m.group(2)} = {m.group(3)}")
            continue
        m = re.match(r"^([A-Z][A-Z0-9_]*)\s*=\s*(\d+)$", body)
        if m:
            enum_values.append(f"{m.group(1)} = {m.group(2)}")
    return {"fields": fields, "enum_values": enum_values}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("refs", nargs="+")
    ap.add_argument("--out", default="work-tmp/pr-report/facts")
    args = ap.parse_args()

    outroot = Path(args.out)
    outroot.mkdir(parents=True, exist_ok=True)
    report: list[str] = []

    for ref in args.refs:
        repo, num = parse_ref(ref)
        if not repo:
            _, out, _ = run(["gh", "repo", "view", "--json", "nameWithOwner"])
            repo = json.loads(out)["nameWithOwner"]

        code, out, err = run(
            ["gh", "pr", "view", str(num), "--repo", repo, "--json", FIELDS],
            check=False,
        )
        if code != 0:
            raise SystemExit(
                f"Could not read {repo}#{num}: {err.strip()}\n"
                f"If this is an auth failure rather than a missing PR, check which account "
                f"is active with `gh auth status`."
            )
        meta = json.loads(out)
        meta["_repo"] = repo

        d = outroot / f"{repo.replace('/', '__')}__{num}"
        d.mkdir(parents=True, exist_ok=True)

        _, diff, _ = run(["gh", "pr", "diff", str(num), "--repo", repo])
        (d / "diff.txt").write_text(diff)

        files = diff_files(diff)
        claimed = meta.get("changedFiles")
        ok = claimed == len(files)
        (d / "diffstat.txt").write_text(
            f"files in diff: {len(files)}\nchangedFiles per GitHub: {claimed}\n"
            f"additions: {meta.get('additions')}  deletions: {meta.get('deletions')}\n"
            f"MATCH: {ok}\n\n" + "\n".join(files)
        )

        commits = meta.pop("commits", []) or []
        (d / "commits.txt").write_text(
            "\n".join(
                f"{(c.get('oid') or '')[:10]} {c.get('committedDate', '')[:10]} "
                f"{(c.get('messageHeadline') or '').strip()}"
                for c in commits
            )
        )

        reviews_md, urls = collect_reviews(repo, num)
        urls = harvest_images(meta.get("body") or "") + urls
        (d / "reviews.md").write_text(reviews_md)
        (d / "meta.json").write_text(json.dumps(meta, indent=2))

        buckets = classify(files)
        protos = proto_additions(diff)
        (d / "surface.json").write_text(
            json.dumps(
                {
                    "counts": {k: len(v) for k, v in buckets.items()},
                    "files": buckets,
                    "proto_added_fields": protos["fields"],
                    "proto_added_enum_values": protos["enum_values"],
                    "labels": [lbl.get("name") for lbl in meta.get("labels") or []],
                },
                indent=2,
            )
        )

        (d / "visuals.json").write_text(
            json.dumps(
                {
                    "remote_images": list(dict.fromkeys(urls)),
                    "snapshot_baselines_in_diff": buckets.get("snapshot_baselines", []),
                    "note": (
                        "If snapshot_baselines_in_diff is non-empty, run snapshot_pairs.py — "
                        "those are real before/after pairs of already-reviewed rendered states, "
                        "and they cover error/empty states a hand-taken screenshot skips. "
                        "Otherwise use remote_images (this repo's PR template prompts authors "
                        "for a screenshot, so the hit rate is high). If both are empty and the "
                        "PR touches UI, capture with `make debug` per the debugging-streamlit "
                        "skill. If it has no UI, draw the numbers instead."
                    ),
                },
                indent=2,
            )
        )

        labels = (
            ", ".join(lbl.get("name", "") for lbl in meta.get("labels") or [])
            or "(none)"
        )
        report.append(
            f"{repo}#{num} [{meta.get('state')}"
            f"{', draft' if meta.get('isDraft') else ''}] {meta.get('title')}\n"
            f"  labels: {labels}\n"
            f"  {len(files)} files, +{meta.get('additions')}/-{meta.get('deletions')}, "
            f"{len(commits)} commits, base {meta.get('baseRefName')}, head "
            f"{(meta.get('headRefOid') or '')[:10]}\n"
            f"  diff/metadata file count match: "
            f"{'OK' if ok else 'MISMATCH -- do not trust the diff'}\n"
            f"  surface: "
            + ", ".join(f"{k}={len(v)}" for k, v in buckets.items())
            + "\n"
            f"  remote images: {len(urls)}   "
            f"snapshot baselines: {len(buckets.get('snapshot_baselines', []))}\n"
            f"  -> {d}"
        )

    print("\n".join(report))
    print(
        "\nNext: for reading surrounding code and `git log -S`, fetch BOTH the PR head\n"
        "and its base into your worktree:\n"
        "  git fetch origin pull/<N>/head:pr-<N>\n"
        "  git fetch origin develop:refs/remotes/origin/develop   # else merge-base is empty"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
