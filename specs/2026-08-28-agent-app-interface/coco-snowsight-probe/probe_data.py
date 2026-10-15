"""Deterministic content for the probe app, shared with `expected_answers.py`.

Every value an agent is asked about is derived here, so the answer key and the
app cannot drift apart.
"""

# An app directory, not a package.
# ruff: noqa: INP001

from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd

LINE_WIDTH = 100
REGIONS = ["alpha", "bravo", "charlie", "delta", "echo"]
TABLE_ROWS = 50_000
CHART_POINTS = 3_000
PDF_CODE = "ORCHID-42"

_WORDS = (
    "amber basil cedar dune ember fjord grove heron iris juniper kelp lumen "
    "moss nectar onyx pine quartz reed sage tundra umber vale willow yarrow"
).split()


def payload_text(kb: int) -> str:
    """About `kb` kilobytes of numbered lines, ending in a sentinel line.

    Each line is `LINE_WIDTH` characters including its newline and starts with
    its 1-based number, so a reader that sees only part of the text can say
    exactly which lines it saw. A per-line token follows the number: the words
    after it repeat in a pattern, so only the token proves a reader saw a line
    rather than reconstructed it. The sentinel names the size and a digest of
    the lines above it, which only a reader that saw the end can report.
    """
    line_count = max(1, kb * 1024 // LINE_WIDTH)
    lines = []
    for i in range(1, line_count + 1):
        prefix = f"L{i:06d} {line_token(i)} "
        words = " ".join(_WORDS[(i + j) % len(_WORDS)] for j in range(20))
        lines.append((prefix + words)[: LINE_WIDTH - 1].ljust(LINE_WIDTH - 1))
    body = "\n".join(lines)
    digest = hashlib.sha256(body.encode()).hexdigest()[:10]
    return f"{body}\nSENTINEL {kb}KB {line_count} lines {digest}"


def line_token(line_number: int) -> str:
    """The unguessable token on line `line_number` of every payload."""
    return hashlib.sha256(f"line-{line_number}".encode()).hexdigest()[:8]


def sales_table() -> pd.DataFrame:
    """A table far larger than the agent API's inline preview."""
    rng = np.random.default_rng(7)
    return pd.DataFrame(
        {
            "order_id": np.arange(1, TABLE_ROWS + 1),
            "region": rng.choice(REGIONS, TABLE_ROWS),
            "units": rng.integers(1, 50, TABLE_ROWS),
            "unit_price": np.round(rng.uniform(1, 200, TABLE_ROWS), 2),
        }
    )


def chart_series() -> pd.DataFrame:
    """A daily series with one spike, so "when was the peak" has one answer."""
    rng = np.random.default_rng(11)
    values = np.round(100 + np.cumsum(rng.normal(0, 1, CHART_POINTS)), 3)
    values[2_217] += 250
    return pd.DataFrame(
        {
            "day": pd.date_range("2018-01-01", periods=CHART_POINTS, freq="D"),
            "value": values,
        }
    )


def image_pixels() -> np.ndarray:
    """A 120x240 image: left half pure red, right half pure blue."""
    pixels = np.zeros((120, 240, 3), dtype=np.uint8)
    pixels[:, :120, 0] = 255
    pixels[:, 120:, 2] = 255
    return pixels


def pdf_bytes() -> bytes:
    """A one-page PDF whose only text is the code a reader must report."""
    text = f"PDF CODE: {PDF_CODE}"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
        ),
        None,
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    stream = f"BT /F1 18 Tf 24 64 Td ({text}) Tj ET".encode()
    objects[3] = b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    return bytes(out)
