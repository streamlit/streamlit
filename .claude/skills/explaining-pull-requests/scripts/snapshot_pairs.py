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

"""Turn a PR's Playwright baseline churn into a ranked set of before/after pairs.

Why this exists: `e2e_playwright/__snapshots__/` holds thousands of committed
baseline PNGs, and a PR that changes rendering updates every one it affects. That
is the best visual a report can have — real rendered states, already reviewed,
including the error/empty/success states nobody screenshots by hand — but it
arrives in the wrong shape. A single feature PR can churn 50+ baselines across
three browsers, and a report that shows all of them is worse than one that shows
none.

So this does the selecting:

  * drops the firefox/webkit duplicates of the same state (same picture, 3x the
    space), keeping chromium
  * pulls the base-branch blob and the head blob straight out of git, so no test
    run or CI artifact is needed
  * ranks pairs by how much actually changed, so the top of the list is the state
    that best shows what the PR did
  * distinguishes a *new* baseline (no before — a state that did not exist) from a
    *changed* one, because captioning a new state as "after" implies a before that
    the reader will look for and not find

Ranking uses the share of pixels that differ, not byte size: a re-encode with
identical pixels is a 0% change however many bytes moved, and that is exactly the
kind of no-op churn that would otherwise crowd out the real state.

Read the percentage as *extent*, not importance. A label shifting one pixel
repaints every glyph edge and can score 11%, while a changed default that only
recolours a 20px icon scores under 1%. High-scoring pairs are where a rendering
change definitely happened — deciding whether it matters is still your job, and a
pair whose two images look identical to you is worth captioning as the subtle
shift it is rather than presenting as a dramatic one.

Usage:
    uv run python scripts/snapshot_pairs.py <base-ref> <head-ref> [--out DIR]
                                            [--top N] [--browser chromium]

Both refs must exist locally:
    git fetch origin pull/<N>/head:pr-<N>
    git fetch origin develop:refs/remotes/origin/develop
"""

from __future__ import annotations

import argparse
import json
import operator
import re
import subprocess
import sys
from io import BytesIO
from pathlib import Path
from typing import Any

SnapshotEntry = dict[str, Any]

SNAPSHOT_ROOT = "e2e_playwright/__snapshots__"
# __snapshots__/<platform>/<test_file>_test/<snapshot_name>[<variant>].png
#
# The bracket is not just a browser engine. It is `[chromium]` for a default-theme
# shot but `[dark_theme-chromium]` / `[light_theme-chromium]` when the test is
# parametrised over themes. Those theme variants are distinct STATES, not
# duplicates of each other, so the engine filter has to match the suffix and keep
# the prefix as a caption-worthy variant label. Matching the whole bracket exactly
# silently throws away every themed shot.
SNAPSHOT_PATH = re.compile(
    r"^e2e_playwright/__snapshots__/(?P<platform>[^/]+)/(?P<test>[^/]+)/"
    r"(?P<name>.+?)\[(?P<variant>[^\]]+)\]\.png$"
)

try:
    from PIL import Image, ImageChops

    HAVE_PIL = True
except ImportError:  # pragma: no cover - depends on the environment
    HAVE_PIL = False


def git(repo: str, *args: str, binary: bool = False) -> bytes | str:
    p = subprocess.run(["git", "-C", repo, *args], capture_output=True, check=False)
    if p.returncode != 0:
        raise SystemExit(
            f"git {' '.join(args)}\n{p.stderr.decode(errors='replace').strip()}"
        )
    return p.stdout if binary else p.stdout.decode(errors="replace")


def blob(repo: str, ref: str, path: str) -> bytes | None:
    """Contents of `path` at `ref`, or None if it does not exist there."""
    # check=False: a missing path at that ref is the expected "added baseline"
    # case, not an error.
    p = subprocess.run(
        ["git", "-C", repo, "show", f"{ref}:{path}"], capture_output=True, check=False
    )
    return p.stdout if p.returncode == 0 else None


def changed_snapshots(repo: str, merge_base: str, head: str) -> list[tuple[str, str]]:
    """-> [(status, path)] for baseline PNGs, status in A/M/D."""
    out = str(git(repo, "diff", "--name-status", merge_base, head, "--", SNAPSHOT_ROOT))
    rows: list[tuple[str, str]] = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[-1].endswith(".png"):
            rows.append((parts[0][:1], parts[-1]))
    return rows


def split_variant(variant: str) -> tuple[str, str]:
    """`dark_theme-chromium` -> ("dark_theme", "chromium"); `chromium` -> ("", "chromium")."""
    prefix, _, engine = variant.rpartition("-")
    return prefix, engine or variant


def pixel_delta(before: bytes | None, after: bytes | None) -> SnapshotEntry:
    """Share of differing pixels, plus dimensions. Honest about what it could not do."""
    info: SnapshotEntry = {
        "pct_changed": None,
        "before_size": None,
        "after_size": None,
        "metric": None,
    }
    if not HAVE_PIL:
        info["metric"] = (
            "unavailable (Pillow not installed) — ranked by byte delta instead"
        )
        return info
    if before is None or after is None:
        info["metric"] = "single image — no comparison possible"
        for key, data in (("before_size", before), ("after_size", after)):
            if data is not None:
                with Image.open(_buf(data)) as im:
                    info[key] = list(im.size)
        return info

    with Image.open(_buf(before)) as b_im, Image.open(_buf(after)) as a_im:
        b_rgb, a_rgb = b_im.convert("RGB"), a_im.convert("RGB")
        info["before_size"], info["after_size"] = list(b_rgb.size), list(a_rgb.size)
        if b_rgb.size != a_rgb.size:
            # A dimension change is a layout shift: the most visible kind of change
            # there is, and not meaningfully expressible as a percentage.
            info["pct_changed"] = 100.0
            info["metric"] = "dimensions differ (layout shift) — ranked top"
            return info
        diff = ImageChops.difference(b_rgb, a_rgb).convert("L")
        # Threshold above JPEG-ish/antialiasing noise so a font-hinting wobble does
        # not outrank a genuinely redrawn component.
        changed = sum(
            count for value, count in enumerate(diff.histogram()) if value > 8
        )
        total = a_rgb.size[0] * a_rgb.size[1]
        info["pct_changed"] = round(100.0 * changed / total, 3) if total else 0.0
        info["metric"] = "share of pixels differing by >8/255 in luminance"
    return info


def _buf(data: bytes) -> BytesIO:
    return BytesIO(data)


def select(entries: list[SnapshotEntry], top: int) -> list[SnapshotEntry]:
    """Pick the `top` most report-worthy states out of the churn.

    Three rules, in order, each fixing a way a naive "sort by delta" misleads:

    1. One entry per *state* first. A themed test contributes
       `foo (light_theme)` and `foo (dark_theme)`, which are near-identical
       pictures; letting both in spends two of four figures saying one thing.
       Extra theme variants are held back and only used to backfill.

    2. Modified and added are ranked in separate pools and interleaved. A new
       baseline has no "before", so it has no percentage, and any single numeric
       ranking buries it under the modified ones — even when the new states *are*
       the feature (a PR adding four input types adds four baselines and modifies
       two). Interleaving guarantees the report shows both kinds.

    3. Removed baselines go last. A deleted state is real information but it is
       rarely the picture that explains a PR.
    """
    best_by_state: dict[tuple[str, str], SnapshotEntry] = {}
    overflow: list[SnapshotEntry] = []
    for e in entries:
        key = (e["test"], e["snapshot"])
        held = best_by_state.get(key)
        if held is None or _state_score(e) > _state_score(held):
            if held is not None:
                overflow.append(held)
            best_by_state[key] = e
        else:
            overflow.append(e)

    states = list(best_by_state.values())
    modified = sorted(
        (e for e in states if e["status"] == "modified"),
        key=lambda e: e["pct_changed"] or 0,
        reverse=True,
    )
    added = sorted(
        (e for e in states if e["status"] == "added"),
        key=operator.itemgetter("snapshot"),
    )
    removed = sorted(
        (e for e in states if e["status"] == "removed"),
        key=operator.itemgetter("snapshot"),
    )

    picked: list[SnapshotEntry] = []
    while len(picked) < top and (modified or added):
        if modified:
            picked.append(modified.pop(0))
        if len(picked) < top and added:
            picked.append(added.pop(0))
    for pool in (removed, overflow):
        while len(picked) < top and pool:
            picked.append(pool.pop(0))
    return picked


def _state_score(e: SnapshotEntry) -> tuple[float, int]:
    """Which variant best represents a state: biggest change, default theme first."""
    theme_rank = {"default": 2, "light_theme": 1}.get(e["theme"], 0)
    return (e["pct_changed"] or 0, theme_rank)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base", help="e.g. origin/develop")
    ap.add_argument("head", help="e.g. pr-16385")
    ap.add_argument("--repo", default=".")
    ap.add_argument("--out", default="work-tmp/pr-report/snapshots")
    ap.add_argument("--top", type=int, default=4, help="pairs to stage (default 4)")
    ap.add_argument(
        "--browser",
        default="chromium",
        help="browser engine to keep (default chromium)",
    )
    args = ap.parse_args()

    # The "before" picture is the baseline at the MERGE BASE, not at the base tip.
    # Using the tip silently produces before == after for any PR whose content has
    # already landed (a squash-merge leaves the head commit out of develop while
    # develop's tree already has the change), which reads as "0% changed" and
    # quietly drops the real pair to the bottom of the ranking.
    merge_base = str(git(args.repo, "merge-base", args.base, args.head)).strip()

    rows = changed_snapshots(args.repo, merge_base, args.head)
    if not rows:
        print("No baseline PNGs changed in this PR.")
        print(
            "That is a real signal, not a dead end: either the change does not alter "
            "rendering, or the baselines were never regenerated. If the PR touches UI, "
            "say which of those it is — an unregenerated baseline belongs under "
            '"watch out for".'
        )
        return 0

    parsed = []
    for status, path in rows:
        m = SNAPSHOT_PATH.match(path)
        if m:
            g = m.groupdict()
            g["theme"], g["engine"] = split_variant(g["variant"])
            parsed.append((status, path, g))

    engines = sorted({p[2]["engine"] for p in parsed})
    picked = [p for p in parsed if p[2]["engine"] == args.browser]
    browser_note = ""
    if not picked:
        # Some PRs only touch firefox/webkit baselines (a flaky-test fix, say).
        # Falling back beats reporting "no visuals" when visuals exist.
        picked = parsed
        browser_note = (
            f"no {args.browser} baselines changed; falling back to all engines "
            f"({', '.join(engines)})"
        )
        print(f"note: {browser_note}")

    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)

    entries = []
    for status, path, g in picked:
        before = blob(args.repo, merge_base, path) if status != "A" else None
        after = blob(args.repo, args.head, path) if status != "D" else None
        delta = pixel_delta(before, after)
        entries.append(
            {
                "status": {"A": "added", "M": "modified", "D": "removed"}.get(
                    status, status
                ),
                "path": path,
                "test": g["test"],
                "snapshot": g["name"],
                "theme": g["theme"] or "default",
                "engine": g["engine"],
                "platform": g["platform"],
                "_before": before,
                "_after": after,
                "byte_delta": abs(len(after or b"") - len(before or b"")),
                **delta,
            }
        )

    staged = select(entries, args.top)
    staged_paths = {e["path"] for e in staged}
    rest = [e for e in entries if e["path"] not in staged_paths]

    manifest = []
    for i, e in enumerate(staged, 1):
        stem = f"{i:02d}-{e['test']}-{re.sub(r'[^A-Za-z0-9_.-]+', '_', e['snapshot'])}"
        if e["theme"] != "default":
            stem += f"-{e['theme']}"
        written = {}
        for role, data in (("before", e.pop("_before")), ("after", e.pop("_after"))):
            if data is not None:
                fp = outdir / f"{stem}-{role}.png"
                fp.write_bytes(data)
                written[role] = str(fp)
        manifest.append(
            {
                "rank": i,
                **{k: v for k, v in e.items() if not k.startswith("_")},
                **written,
            }
        )

    for e in rest:
        e.pop("_before", None)
        e.pop("_after", None)

    doc = {
        "base": args.base,
        "merge_base": merge_base,
        "head": args.head,
        "engines_changed": engines,
        "engine_filter": args.browser,
        "browser_note": browser_note,
        "total_baselines_changed": len(rows),
        "distinct_states_after_engine_filter": len(picked),
        "staged": len(manifest),
        "pairs": manifest,
        "not_staged": [
            {k: v for k, v in e.items() if k in {"path", "status", "pct_changed"}}
            for e in rest
        ],
    }
    (outdir / "manifest.json").write_text(json.dumps(doc, indent=2))

    print(
        f"{len(rows)} baseline PNG(s) changed across {len(engines)} engine(s) "
        f"({', '.join(engines)}); before = merge base {merge_base[:10]}."
    )
    print(
        f"{len(picked)} distinct state(s) after the {args.browser} filter; "
        f"staging top {len(manifest)}.\n"
    )
    for e in manifest:
        pct = "    n/a" if e["pct_changed"] is None else f"{e['pct_changed']:6.2f}%"
        roles = "+".join(r for r in ("before", "after") if r in e)
        theme = "" if e["theme"] == "default" else f" ({e['theme']})"
        print(
            f"  {e['rank']:>2}. {pct}  {e['status']:<8} "
            f"{e['test']}/{e['snapshot']}{theme}  [{roles}]"
        )
    if doc["not_staged"]:
        # Never let a cap look like full coverage.
        print(
            f"\n  {len(doc['not_staged'])} further changed baseline(s) NOT staged — see manifest.json."
        )
        print(
            "  If the report implies it covers every visual change, say how many it left out."
        )
    if not HAVE_PIL:
        print(
            "\n  warning: Pillow unavailable, so ranking fell back to byte size. A re-encode"
        )
        print(
            "  with identical pixels can outrank a real change. Treat the order as a hint."
        )
    print(f"\n-> {outdir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
