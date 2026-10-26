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

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import pytest

if TYPE_CHECKING:
    from types import ModuleType


def _load_compare_module() -> ModuleType:
    path = Path(__file__).with_name("bi_performance_compare.py")
    spec = importlib.util.spec_from_file_location("bi_performance_compare", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bi_performance_compare = _load_compare_module()


def _sample(
    *,
    revision: str,
    latency: float,
    reruns: int = 1,
    benchmark_id: str = "bi.linked.vega.rows10002.point_selection.v1",
    definition_fingerprint: str = "definition-a",
    toolchain_fingerprint: str = "toolchain-a",
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "benchmark": {
            "benchmark_id": benchmark_id,
            "primary_metric": "interaction_to_completion_ms",
            "design": "linked",
            "renderer": "vega",
            "interaction": "point_selection",
            "rows": 10_002,
            "tier": "short",
            "definition_version": 1,
            "definition_fingerprint": definition_fingerprint,
        },
        "revision": revision,
        "toolchain": {
            "fingerprint": toolchain_fingerprint,
            "python": "3.13.1",
            "playwright": "1.64.0",
            "browser": "156.0",
        },
        "sample": {
            "interaction_to_completion_ms": latency,
            "input_to_backmsg_ms": 150.0,
            "rerun_count": reruns,
            "websocket_messages_sent": 1,
            "websocket_messages_received": 12,
            "websocket_bytes_sent": 500,
            "websocket_bytes_received": 5_000,
            "server_script_duration_ms": 20.0,
            "last_delta_to_paint_ms": 17.0,
            "max_long_animation_frame_ms": 0.0,
        },
        "completion": {"run_count": reruns + 1},
    }


def _comparison(
    base_samples: list[dict[str, Any]],
    candidate_samples: list[dict[str, Any]],
    *,
    base_errors: list[str] | None = None,
    candidate_errors: list[str] | None = None,
    base_status: str = "success",
    candidate_status: str = "success",
) -> dict[str, Any]:
    return cast(
        "dict[str, Any]",
        bi_performance_compare.build_comparison(
            base_samples=base_samples,
            candidate_samples=candidate_samples,
            base_errors=base_errors or [],
            candidate_errors=candidate_errors or [],
            base_sha="base-sha-1234567890",
            candidate_sha="candidate-sha-1234567890",
            base_status=base_status,
            candidate_status=candidate_status,
        ),
    )


def test_load_samples_reports_malformed_and_accepts_valid_files(
    tmp_path: Path,
) -> None:
    valid = _sample(revision="base", latency=200)
    (tmp_path / "valid.json").write_text(json.dumps(valid), encoding="utf-8")
    (tmp_path / "malformed.json").write_text("{", encoding="utf-8")
    (tmp_path / "wrong-schema.json").write_text(
        json.dumps({**valid, "schema_version": 99}),
        encoding="utf-8",
    )
    (tmp_path / "wrong-shape.json").write_text(
        json.dumps({**valid, "benchmark": []}),
        encoding="utf-8",
    )

    samples, errors = bi_performance_compare._load_samples(tmp_path)

    assert samples == [valid]
    assert len(errors) == 3
    assert any("malformed.json" in error for error in errors)
    assert any("unsupported schema_version" in error for error in errors)
    assert any("must be objects" in error for error in errors)


def test_build_comparison_calculates_medians_deltas_and_noise() -> None:
    base = [
        _sample(revision="base", latency=value, reruns=5) for value in (209, 210, 211)
    ]
    candidate = [
        _sample(revision="candidate", latency=value, reruns=1)
        for value in (99, 100, 101)
    ]

    comparison = _comparison(base, candidate)
    benchmark = comparison["benchmarks"][0]
    latency = benchmark["metrics"]["interaction_to_completion_ms"]
    reruns = benchmark["metrics"]["rerun_count"]

    assert comparison["status"] == "complete"
    assert benchmark["status"] == "comparable"
    assert latency["base_median"] == 210
    assert latency["candidate_median"] == 100
    assert latency["absolute_delta"] == -110
    assert latency["percentage_delta"] == pytest.approx(-52.380952)
    assert latency["base_sample_count"] == 3
    assert latency["candidate_sample_count"] == 3
    assert latency["noise"] == "low"
    assert reruns["base_median"] == 5
    assert reruns["candidate_median"] == 1


def test_changed_benchmark_definition_is_non_comparable() -> None:
    base = [_sample(revision="base", latency=200)]
    candidate = [
        _sample(
            revision="candidate",
            latency=100,
            definition_fingerprint="definition-b",
        )
    ]

    comparison = _comparison(base, candidate)

    assert comparison["benchmarks"][0]["status"] == (
        "non-comparable-benchmark-definition"
    )
    assert "metrics" not in comparison["benchmarks"][0]


def test_changed_toolchain_is_non_comparable() -> None:
    base = [_sample(revision="base", latency=200)]
    candidate = [
        _sample(
            revision="candidate",
            latency=100,
            toolchain_fingerprint="toolchain-b",
        )
    ]

    comparison = _comparison(base, candidate)

    assert comparison["benchmarks"][0]["status"] == "non-comparable-toolchain"


def test_missing_revision_samples_and_failures_produce_partial_artifact() -> None:
    base = [_sample(revision="base", latency=200)]

    comparison = _comparison(
        base,
        [],
        candidate_errors=["No JSON samples found"],
        candidate_status="failure",
    )

    assert comparison["status"] == "partial"
    assert comparison["benchmarks"][0]["status"] == "missing-candidate"
    assert comparison["revisions"]["candidate"]["errors"] == ["No JSON samples found"]


def test_summary_prioritizes_selection_latency_and_reruns() -> None:
    base = [
        _sample(revision="base", latency=value, reruns=5) for value in (200, 210, 220)
    ]
    candidate = [
        _sample(revision="candidate", latency=value, reruns=1)
        for value in (90, 100, 110)
    ]

    summary = bi_performance_compare._render_summary(_comparison(base, candidate))

    assert "BI dashboard performance comparison" in summary
    assert "point_selection" in summary
    assert "210.0 ms" in summary
    assert "100.0 ms" in summary
    assert "-52.4%" in summary
    assert "5.0 → 1.0" in summary
    assert "informational" in summary
