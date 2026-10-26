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

from pathlib import Path

_ROOT = Path(__file__).parents[1]
_BI_WORKFLOW = (_ROOT / ".github/workflows/bi-performance.yml").read_text(
    encoding="utf-8"
)
_GENERIC_WORKFLOW = (_ROOT / ".github/workflows/performance.yml").read_text(
    encoding="utf-8"
)


def test_performance_workflow_keeps_generic_label_and_excludes_bi_tests() -> None:
    assert "github.event.label.name == 'run-performance'" in _GENERIC_WORKFLOW
    assert (
        'pytest --browser chromium -n 1 --reruns 1 -m "performance and not bi_performance"'
        in (_GENERIC_WORKFLOW)
    )
    assert 'branches:\n      - "develop"' in _GENERIC_WORKFLOW


def test_bi_workflow_routes_only_explicit_requests() -> None:
    triggers = _BI_WORKFLOW.split("permissions:", maxsplit=1)[0]

    assert "types: [labeled]" in triggers
    assert "workflow_dispatch:" in triggers
    assert "\n  push:" not in triggers
    assert "\n  schedule:" not in triggers
    assert "github.event.label.name == 'run-bi-performance'" in _BI_WORKFLOW
    assert "labels/run-bi-performance" in _BI_WORKFLOW
    assert "labels/run-performance" not in _BI_WORKFLOW


def test_bi_workflow_uses_exact_revisions_in_one_job() -> None:
    assert "github.event.pull_request.base.sha || inputs.base_ref" in _BI_WORKFLOW
    assert (
        "github.event.pull_request.merge_commit_sha || inputs.candidate_ref"
        in _BI_WORKFLOW
    )
    assert "strategy:" not in _BI_WORKFLOW
    assert "matrix:" not in _BI_WORKFLOW

    base_position = _BI_WORKFLOW.index("- name: Run exact-base benchmarks")
    candidate_position = _BI_WORKFLOW.index("- name: Run PR merge benchmarks")
    comparison_position = _BI_WORKFLOW.index("- name: Generate paired comparison")
    assert base_position < candidate_position < comparison_position


def test_bi_workflow_runs_only_bi_targets_and_publishes_existing_report() -> None:
    assert "benchmark_target=bi-performance-short" in _BI_WORKFLOW
    assert "benchmark_target=bi-performance-extended" in _BI_WORKFLOW
    assert "python-performance-tests" not in _BI_WORKFLOW
    assert "lighthouse-tests" not in _BI_WORKFLOW
    assert "pytest --browser" not in _BI_WORKFLOW
    assert "scripts/bi_performance_compare.py" in _BI_WORKFLOW
    assert '--output "$RUNNER_TEMP/bi-results/comparison.json"' in _BI_WORKFLOW
    assert 'cat "$RUNNER_TEMP/bi-results/summary.md" >> "$GITHUB_STEP_SUMMARY"' in (
        _BI_WORKFLOW
    )
    assert "path: ${{ runner.temp }}/bi-results" in _BI_WORKFLOW
    assert "- name: Fail incomplete benchmark execution" in _BI_WORKFLOW
    assert "steps.base_benchmark.outcome != 'success'" in _BI_WORKFLOW
    assert "steps.candidate_benchmark.outcome != 'success'" in _BI_WORKFLOW
