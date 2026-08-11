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

"""Make a PR report self-contained, and refuse to ship a bad one.

Four jobs:

  1. Inline every local image as a base64 data URI. Required, not a convenience:
     the report is viewed through `components.v1.html` in an iframe with no base
     URL, so a relative <img src> resolves to nothing. Inlining is also what lets
     the file survive being moved or attached.

  2. Enforce the length budget and the presence of a visual. This report competes
     with reading the diff -- if it isn't dramatically faster, it's just one more
     thing to review. A budget that's merely advisory gets ignored under the
     pressure to be thorough, so it's checked here instead.

  3. Validate the quiz. A mis-keyed quiz is worse than no quiz -- it teaches the
     reader the wrong answer and stamps it "cleared". So this checks, per
     question, that the answer key agrees with the letter the explanation names,
     that options are well-formed, and that each quiz's declared count is real.

  4. Warn on total size. The wiki explorer inlines the whole file into an iframe
     srcdoc, so a report carrying a dozen full-page baselines gets slow to open.

Failures are hard failures; only the size check is a warning.

Usage:
    uv run python scripts/finalize.py report.html [--check-only] [--max-words N]
"""

from __future__ import annotations

import argparse
import base64
import mimetypes
import re
import sys
from pathlib import Path

LETTERS = "ABCDEFGH"
# The srcdoc payload is roughly the file size; past a few MB the explorer's iframe
# takes visibly long to paint. Not fatal, so not an error.
SOFT_SIZE_LIMIT_MB = 4.0
PLACEHOLDERS = [
    re.compile(r"__IMG[A-Z_]*__"),
    re.compile(r"\{\{[A-Z_]+\}\}"),
    re.compile(r"\bTODO\b"),
    re.compile(r"\bLOREM\b", re.IGNORECASE),
]


def inline_images(html: str, base: Path) -> tuple[str, list[str], list[str]]:
    done: list[str] = []
    missing: list[str] = []

    def sub(m: re.Match[str]) -> str:
        src = m.group(2)
        if src.startswith(("data:", "http://", "https://")):
            return m.group(0)
        p = Path(src.removeprefix("file://"))
        if not p.is_absolute():
            p = base / p
        if not p.is_file():
            missing.append(src)
            return m.group(0)
        mime = mimetypes.guess_type(p.name)[0] or "image/png"
        b64 = base64.b64encode(p.read_bytes()).decode()
        done.append(f"{src} ({p.stat().st_size / 1024:.1f} KB)")
        return f'{m.group(1)}data:{mime};base64,{b64}"'

    return (
        re.sub(r'(<img[^>]*?\ssrc=")([^"]+)"', sub, html, flags=re.IGNORECASE),
        done,
        missing,
    )


def visible_words(fragment: str) -> int:
    """Rough word count of rendered text: drop tags, comments, and entities."""
    t = re.sub(r"<!--.*?-->", " ", fragment, flags=re.DOTALL)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"&[a-z#0-9]+;", " ", t)
    return len([w for w in t.split() if any(c.isalnum() for c in w)])


def check_budget(html: str, max_words: int) -> tuple[list[str], list[str]]:
    """Per-PR: enforce the prose budget and require a visual. -> (errors, notes)."""
    errors: list[str] = []
    notes: list[str] = []

    stripped = re.sub(
        r"<(script|style)\b.*?</\1>", " ", html, flags=re.DOTALL | re.IGNORECASE
    )
    sections = re.findall(
        r'<section class="pr[^"]*" id="(pr-[^"]+)">(.*?)</section>', stripped, re.DOTALL
    )
    if not sections:
        # Fall back to budgeting the whole document rather than skipping. Keying
        # only on the template's markup would let a hand-rolled report dodge the
        # budget entirely -- and a silently-skipped check is worse than no check,
        # because it reads as a pass.
        body = re.search(r"<body[^>]*>(.*)</body>", stripped, re.DOTALL)
        sections = [("whole document", body.group(1) if body else stripped)]
        notes.append(
            'no <section class="pr" id="pr-…"> found — budgeting the whole document '
            "instead (was this built from assets/template.html?)"
        )

    for sid, sec in sections:
        # Everything before the quiz is the part the reader must *read*. The quiz
        # is the payoff, not overhead, so it's reported but not budgeted.
        head, _, quiz = sec.partition('<div class="quiz"')
        prose = visible_words(head)
        qwords = visible_words(quiz)

        has_img = bool(re.search(r"<img\b", head, re.IGNORECASE))
        has_viz = 'class="viz"' in head
        if not (has_img or has_viz):
            errors.append(
                f"[{sid}] no visual. A picture is the payload of this report — add a "
                f"harvested/captured image, or for a PR with no UI use a .viz block "
                f"(stat tiles for two headline numbers, dumbbell for a paired "
                f"before/after)."
            )
        if 'class="delta"' in head:
            errors.append(
                f"[{sid}] uses the retired .delta bars. A bar whose track has no declared "
                f"maximum implies a scale nobody stated, and two bars 0.45pp apart read as "
                f"a verdict the data doesn't support. Use .statpair (two headline numbers) "
                f"or the .db dumbbell with a labelled axis instead."
            )

        # The brief is the orientation a screenshot can't give. Its absence is the
        # difference between "here is a picture" and "here is why you're looking".
        if 'class="brief"' not in head:
            errors.append(
                f"[{sid}] no brief. Add the four-beat preamble (problem / why / approach / "
                f"how) above the visual — a screenshot means more once the reader knows "
                f"what problem it solves."
            )

        pts = len(re.findall(r'<div class="pt"', head))
        if pts < 2:
            errors.append(
                f'[{sid}] only {pts} point(s) under "what isn\'t obvious". That section is '
                f"the one readers value most; 2-5 is the range."
            )
        elif pts > 5:
            errors.append(
                f"[{sid}] {pts} points under \"what isn't obvious\", max 5. Past five you're "
                f"including things that don't change what the reader does — keep the ones "
                f"that do."
            )

        if prose > max_words:
            errors.append(
                f"[{sid}] {prose} words of prose, budget {max_words}. Cut prose — not "
                f"visuals, and don't raise the budget. Usual culprits: the PR-comment "
                f"pitch rendered as well as copied, a file-by-file walkthrough, a brief "
                f"whose beats ran to a paragraph each, or a testing/CI section that "
                f"shouldn't exist. Trim the brief and the watch-out list before the points."
            )
        else:
            head_room = max_words - prose
            notes.append(
                f"{sid}: {prose} words prose ({head_room} under budget), "
                f"{qwords} in quiz, visual: {'screenshot' if has_img else 'viz block'}"
            )
    return errors, notes


def validate_quiz(html: str) -> list[str]:
    errors: list[str] = []

    quizzes = re.findall(
        r'<div class="quiz"\s+id="([^"]+)"[^>]*data-total="(\d+)"', html
    )
    if not quizzes:
        errors.append(
            "no quiz found -- the report is meant to gate on one. Pass --check-only "
            "deliberately if this report is intentionally quiz-free."
        )

    blocks = re.findall(
        r'<div class="q" data-a="(\d+)">(.*?)(?=<div class="q" data-a=|<div class="quiz-foot")',
        html,
        re.DOTALL,
    )
    if len(blocks) == 0 and quizzes:
        errors.append(
            "quiz container present but no question blocks matched -- check markup"
        )

    for i, (key, body) in enumerate(blocks, 1):
        label = re.search(r'class="qn">([^<]*)<', body)
        tag = (label.group(1).strip() if label else f"question {i}")[:48]

        radios = re.findall(r'<input[^>]+type="radio"[^>]*>', body)
        names = set(re.findall(r'name="([^"]+)"', body))
        values = sorted(int(v) for v in re.findall(r'<input[^>]+value="(\d+)"', body))

        if len(radios) != 4:
            errors.append(f"[{tag}] has {len(radios)} options; expected 4")
        if len(names) != 1:
            errors.append(f"[{tag}] spans {len(names)} input groups: {sorted(names)}")
        if values != list(range(len(values))):
            errors.append(f"[{tag}] option values are {values}; expected 0..n-1")

        k = int(key)
        if k >= len(radios):
            errors.append(f"[{tag}] data-a={k} but only {len(radios)} options exist")
            continue

        named = re.search(r'class="why"[^>]*>.*?<b>([A-H])[.\)]', body, re.DOTALL)
        if not named:
            errors.append(
                f"[{tag}] explanation does not open by naming its answer letter "
                f'(expected e.g. "<b>{LETTERS[k]}.</b>") -- that naming is what makes '
                f"the key checkable"
            )
        elif named.group(1) != LETTERS[k]:
            errors.append(
                f"[{tag}] MIS-KEYED: data-a={k} means {LETTERS[k]}, "
                f"but the explanation says {named.group(1)}"
            )

    for qid, total in quizzes:
        seg = html.split(f'id="{qid}"', 1)[1].split("quiz-foot", 1)[0]
        found = len(re.findall(r'<div class="q" data-a=', seg))
        if int(total) != found:
            errors.append(
                f"[{qid}] declares data-total={total} but contains {found} questions"
            )

    for pat in PLACEHOLDERS:
        errors.extend(
            f"unfilled placeholder left in output: {hit!r}"
            for hit in set(pat.findall(html))
        )

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("report")
    ap.add_argument(
        "--check-only", action="store_true", help="validate without rewriting"
    )
    ap.add_argument(
        "--max-words",
        type=int,
        default=550,
        help="prose budget per PR section, excluding the quiz (default 550 — roughly "
        "two minutes of reading. The allowance covers the four-beat brief and up to "
        "five points; it is not headroom for prose elsewhere)",
    )
    args = ap.parse_args()

    path = Path(args.report).resolve()
    if not path.is_file():
        print(f"error: {path} not found", file=sys.stderr)
        return 1
    html = path.read_text()

    if args.check_only:
        inlined: list[str] = []
        missing: list[str] = []
    else:
        html, inlined, missing = inline_images(html, path.parent)

    errors = validate_quiz(html)
    budget_errors, budget_notes = check_budget(html, args.max_words)
    errors += budget_errors
    for src in missing:
        errors.append(f"image not found on disk, left as-is: {src}")

    if errors:
        print(
            f"FAIL — {len(errors)} problem(s); {path.name} not written:\n",
            file=sys.stderr,
        )
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    if not args.check_only:
        path.write_text(html)

    n_q = len(re.findall(r'<div class="q" data-a=', html))
    size_mb = len(html.encode()) / 1_048_576
    print(f"OK — {path.name}")
    print(
        f"  size: {size_mb:.2f} MB   questions: {n_q}   images inlined: {len(inlined)}"
    )
    for note in budget_notes:
        print(f"  {note}")
    for d in inlined:
        print(f"    + {d}")
    if size_mb > SOFT_SIZE_LIMIT_MB:
        print(
            f"  warning: {size_mb:.1f} MB is above the {SOFT_SIZE_LIMIT_MB} MB soft limit. "
            f"The wiki explorer inlines the file into an iframe srcdoc, so this will be "
            f"slow to open. Drop a figure or downscale the largest baselines."
        )
    if re.search(r'<img[^>]+src="https?://', html):
        print(
            "  note: remote image URLs remain. They need network to render, and "
            "GitHub user-attachment URLs can expire — download and re-run if the "
            "report must work offline or be archived."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
