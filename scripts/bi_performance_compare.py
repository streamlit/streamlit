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

"""Compare paired BI performance samples and render a GitHub summary."""

from __future__ import annotations

import argparse
import json
import math
import statistics
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

_SCHEMA_VERSION = 1
_METRIC_NAMES = (
    "interaction_to_completion_ms",
    "input_to_backmsg_ms",
    "rerun_count",
    "websocket_messages_sent",
    "websocket_messages_received",
    "websocket_bytes_sent",
    "websocket_bytes_received",
    "server_script_duration_ms",
    "last_delta_to_paint_ms",
    "max_long_animation_frame_ms",
)


def _validate_sample(payload: dict[str, Any]) -> None:
    if payload.get("schema_version") != _SCHEMA_VERSION:
        raise ValueError("unsupported schema_version")
    benchmark = payload.get("benchmark")
    toolchain = payload.get("toolchain")
    sample = payload.get("sample")
    if (
        not isinstance(benchmark, dict)
        or not isinstance(toolchain, dict)
        or not isinstance(sample, dict)
    ):
        raise TypeError("benchmark, toolchain, and sample must be objects")
    if not isinstance(benchmark.get("benchmark_id"), str):
        raise TypeError("benchmark_id must be a string")
    primary_metric = benchmark.get("primary_metric")
    metric_value = (
        sample.get(primary_metric) if isinstance(primary_metric, str) else None
    )
    if (
        not isinstance(primary_metric, str)
        or not isinstance(metric_value, int | float)
        or isinstance(metric_value, bool)
    ):
        raise TypeError("primary metric must be numeric")


def _load_samples(directory: Path) -> tuple[list[dict[str, Any]], list[str]]:
    samples: list[dict[str, Any]] = []
    errors: list[str] = []
    if not directory.exists():
        return samples, [f"Missing sample directory: {directory}"]

    for path in sorted(directory.rglob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            _validate_sample(payload)
            samples.append(payload)
        except (json.JSONDecodeError, OSError, TypeError, ValueError) as ex:
            errors.append(f"{path}: {ex}")
    if not samples and not errors:
        errors.append(f"No JSON samples found in: {directory}")
    return samples, errors


def _group_samples(
    samples: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for sample in samples:
        grouped[str(sample["benchmark"]["benchmark_id"])].append(sample)
    return dict(grouped)


def _numeric_values(samples: list[dict[str, Any]], metric_name: str) -> list[float]:
    values: list[float] = []
    for sample in samples:
        value = sample["sample"].get(metric_name)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            values.append(float(value))
    return values


def _median(values: list[float]) -> float | None:
    return statistics.median(values) if values else None


def _relative_mad(values: list[float]) -> float | None:
    if not values:
        return None
    median = statistics.median(values)
    mad = statistics.median(abs(value - median) for value in values)
    if median == 0:
        return 0.0 if mad == 0 else math.inf
    return mad / abs(median)


def _noise_indicator(base: list[float], candidate: list[float]) -> str:
    if len(base) < 3 or len(candidate) < 3:
        return "insufficient-samples"
    relative_mad = max(_relative_mad(base) or 0, _relative_mad(candidate) or 0)
    if relative_mad >= 0.1:
        return "high"
    if relative_mad >= 0.05:
        return "moderate"
    return "low"


def _metric_comparison(
    base_samples: list[dict[str, Any]],
    candidate_samples: list[dict[str, Any]],
    metric_name: str,
) -> dict[str, Any]:
    base_values = _numeric_values(base_samples, metric_name)
    candidate_values = _numeric_values(candidate_samples, metric_name)
    base_median = _median(base_values)
    candidate_median = _median(candidate_values)
    absolute_delta = (
        candidate_median - base_median
        if base_median is not None and candidate_median is not None
        else None
    )
    percentage_delta = (
        absolute_delta / base_median * 100
        if absolute_delta is not None and base_median not in {None, 0}
        else None
    )
    return {
        "base_samples": base_values,
        "candidate_samples": candidate_values,
        "base_median": base_median,
        "candidate_median": candidate_median,
        "absolute_delta": absolute_delta,
        "percentage_delta": percentage_delta,
        "base_sample_count": len(base_values),
        "candidate_sample_count": len(candidate_values),
        "noise": _noise_indicator(base_values, candidate_values),
    }


def _compare_benchmark(
    benchmark_id: str,
    base_samples: list[dict[str, Any]] | None,
    candidate_samples: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    if not base_samples:
        return {
            "benchmark_id": benchmark_id,
            "status": "missing-base",
            "candidate_sample_count": len(candidate_samples or []),
        }
    if not candidate_samples:
        return {
            "benchmark_id": benchmark_id,
            "status": "missing-candidate",
            "base_sample_count": len(base_samples),
        }

    base_definition = base_samples[0]["benchmark"]
    candidate_definition = candidate_samples[0]["benchmark"]
    if base_definition != candidate_definition:
        return {
            "benchmark_id": benchmark_id,
            "status": "non-comparable-benchmark-definition",
            "base_definition": base_definition,
            "candidate_definition": candidate_definition,
        }

    base_toolchain = base_samples[0]["toolchain"]
    candidate_toolchain = candidate_samples[0]["toolchain"]
    if base_toolchain != candidate_toolchain:
        return {
            "benchmark_id": benchmark_id,
            "status": "non-comparable-toolchain",
            "base_toolchain": base_toolchain,
            "candidate_toolchain": candidate_toolchain,
        }

    primary_metric = str(base_definition["primary_metric"])
    metrics = {
        metric_name: _metric_comparison(
            base_samples,
            candidate_samples,
            metric_name,
        )
        for metric_name in _METRIC_NAMES
    }
    return {
        "benchmark_id": benchmark_id,
        "status": "comparable",
        "definition": base_definition,
        "toolchain": base_toolchain,
        "primary_metric": primary_metric,
        "sample_count": {
            "base": len(base_samples),
            "candidate": len(candidate_samples),
        },
        "metrics": metrics,
        "raw_samples": {
            "base": base_samples,
            "candidate": candidate_samples,
        },
    }


def build_comparison(
    *,
    base_samples: list[dict[str, Any]],
    candidate_samples: list[dict[str, Any]],
    base_errors: list[str],
    candidate_errors: list[str],
    base_sha: str,
    candidate_sha: str,
    base_status: str,
    candidate_status: str,
) -> dict[str, Any]:
    """Build the versioned combined result for one paired run."""
    base_grouped = _group_samples(base_samples)
    candidate_grouped = _group_samples(candidate_samples)
    benchmark_ids = sorted(set(base_grouped) | set(candidate_grouped))
    benchmarks = [
        _compare_benchmark(
            benchmark_id,
            base_grouped.get(benchmark_id),
            candidate_grouped.get(benchmark_id),
        )
        for benchmark_id in benchmark_ids
    ]
    is_partial = (
        bool(base_errors)
        or bool(candidate_errors)
        or base_status != "success"
        or candidate_status != "success"
        or not base_samples
        or not candidate_samples
    )
    return {
        "schema_version": _SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).isoformat(),
        "status": "partial" if is_partial else "complete",
        "revisions": {
            "base": {
                "sha": base_sha,
                "execution_status": base_status,
                "sample_count": len(base_samples),
                "errors": base_errors,
            },
            "candidate": {
                "sha": candidate_sha,
                "execution_status": candidate_status,
                "sample_count": len(candidate_samples),
                "errors": candidate_errors,
            },
        },
        "benchmarks": benchmarks,
    }


def _format_number(value: float | None, *, suffix: str = "") -> str:
    return "—" if value is None else f"{value:.1f}{suffix}"


def _render_summary(comparison: dict[str, Any]) -> str:
    base = comparison["revisions"]["base"]
    candidate = comparison["revisions"]["candidate"]
    lines = [
        "## BI dashboard performance comparison",
        "",
        (
            f"Base `{base['sha'][:12]}` vs. PR merge "
            f"`{candidate['sha'][:12]}` · **{comparison['status']}**"
        ),
        "",
        "This report is informational; no performance threshold is enforced.",
        "",
        "| Benchmark | Base median | PR median | Delta | Base → PR reruns | Noise |",
        "|---|---:|---:|---:|---:|---|",
    ]
    comparable_count = 0
    for benchmark in comparison["benchmarks"]:
        if benchmark["status"] != "comparable":
            continue
        comparable_count += 1
        primary = benchmark["metrics"][benchmark["primary_metric"]]
        reruns = benchmark["metrics"]["rerun_count"]
        lines.append(
            "| {benchmark_id} | {base} ms | {candidate} ms | {delta} | "
            "{base_reruns} → {candidate_reruns} | {noise} |".format(
                benchmark_id=benchmark["benchmark_id"],
                base=_format_number(primary["base_median"]),
                candidate=_format_number(primary["candidate_median"]),
                delta=_format_number(primary["percentage_delta"], suffix="%"),
                base_reruns=_format_number(reruns["base_median"]),
                candidate_reruns=_format_number(reruns["candidate_median"]),
                noise=primary["noise"],
            )
        )
    if comparable_count == 0:
        lines.append("| _No comparable benchmarks_ | — | — | — | — | — |")

    non_comparable = [
        benchmark
        for benchmark in comparison["benchmarks"]
        if benchmark["status"] != "comparable"
    ]
    if non_comparable:
        lines.extend(["", "### Non-comparable or missing benchmarks", ""])
        lines.extend(
            f"- `{benchmark['benchmark_id']}`: {benchmark['status']}"
            for benchmark in non_comparable
        )

    execution_problems = []
    for revision_name in ("base", "candidate"):
        revision = comparison["revisions"][revision_name]
        if revision["execution_status"] != "success":
            execution_problems.append(
                f"{revision_name} execution: {revision['execution_status']}"
            )
        execution_problems.extend(revision["errors"])
    if execution_problems:
        lines.extend(["", "### Partial-artifact details", ""])
        lines.extend(f"- {problem}" for problem in execution_problems)

    lines.extend(
        [
            "",
            (
                "Primary selection rows are reported separately by stable benchmark "
                "ID, including point latency, brush-release latency, and reruns per "
                "gesture."
            ),
            (
                "Noise is based on median absolute deviation. Small samples and "
                "loopback runner measurements are directional, not reliable p95 "
                "estimates."
            ),
        ]
    )
    return "\n".join(lines) + "\n"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-dir", type=Path, required=True)
    parser.add_argument("--candidate-dir", type=Path, required=True)
    parser.add_argument("--base-sha", required=True)
    parser.add_argument("--candidate-sha", required=True)
    parser.add_argument("--base-status", default="success")
    parser.add_argument("--candidate-status", default="success")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    """Compare raw sample directories and write JSON plus Markdown."""
    args = _parse_args()
    base_samples, base_errors = _load_samples(args.base_dir)
    candidate_samples, candidate_errors = _load_samples(args.candidate_dir)
    comparison = build_comparison(
        base_samples=base_samples,
        candidate_samples=candidate_samples,
        base_errors=base_errors,
        candidate_errors=candidate_errors,
        base_sha=args.base_sha,
        candidate_sha=args.candidate_sha,
        base_status=args.base_status,
        candidate_status=args.candidate_status,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(comparison, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    args.summary.write_text(_render_summary(comparison), encoding="utf-8")


if __name__ == "__main__":
    main()
