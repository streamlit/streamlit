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

"""Focused interaction measurement helpers for BI performance benchmarks."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import platform
import re
import subprocess
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol

from e2e_playwright.shared.git_utils import get_git_root

if TYPE_CHECKING:
    from playwright.sync_api import Page


_SCHEMA_VERSION = 1
_BENCHMARK_DEFINITION_VERSION = 1
_SOURCE_PATHS = (
    "e2e_playwright/bi_performance_dashboard.py",
    "e2e_playwright/bi_performance_dashboard_test.py",
    "e2e_playwright/shared/bi_performance.py",
)


class _Action(Protocol):
    def __call__(self) -> float: ...


class _CompletionWaiter(Protocol):
    def __call__(self) -> dict[str, Any]: ...


@dataclass(frozen=True)
class BenchmarkDefinition:
    """Stable identity and dimensions for one benchmark interaction."""

    benchmark_id: str
    primary_metric: str
    design: str
    renderer: str
    interaction: str
    rows: int
    tier: str


@dataclass(frozen=True)
class InteractionMeasurement:
    """Metrics collected between browser input and final paint."""

    interaction_to_completion_ms: float
    input_to_backmsg_ms: float | None
    rerun_count: int
    websocket_messages_sent: int
    websocket_messages_received: int
    websocket_bytes_sent: int
    websocket_bytes_received: int
    server_script_duration_ms: float
    last_delta_to_paint_ms: float | None
    max_long_animation_frame_ms: float


def _get_revision() -> str:
    revision = os.environ.get("BI_PERFORMANCE_REVISION")
    if revision:
        return revision
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"],
        cwd=get_git_root(),
        text=True,
    ).strip()


def _hash_files(paths: tuple[str, ...]) -> str:
    digest = hashlib.sha256()
    root = get_git_root()
    for relative_path in paths:
        path = root / relative_path
        digest.update(relative_path.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _toolchain_metadata(page: Page) -> dict[str, str]:
    lock_hash = _hash_files(("uv.lock", "frontend/yarn.lock"))
    return {
        "fingerprint": lock_hash,
        "python": platform.python_version(),
        "playwright": importlib.metadata.version("playwright"),
        "browser": page.context.browser.version
        if page.context.browser is not None
        else "unknown",
    }


def _frame_size(params: dict[str, Any]) -> int:
    payload = params.get("response", {}).get("payloadData", "")
    return len(payload.encode("utf-8"))


def _long_animation_frame_count(page: Page) -> int:
    return int(
        page.evaluate(
            "() => (window.__stCapturedTraces?.['long-animation-frame'] || []).length"
        )
    )


def _max_new_long_animation_frame_duration(page: Page, start_index: int) -> float:
    value = page.evaluate(
        """startIndex => {
            const entries =
                window.__stCapturedTraces?.["long-animation-frame"] || [];
            return entries
                .slice(startIndex)
                .reduce((maximum, entry) => Math.max(maximum, entry.duration), 0);
        }""",
        start_index,
    )
    return float(value)


def _wait_for_two_animation_frames(page: Page) -> None:
    page.evaluate(
        """() => new Promise(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        })"""
    )


def _write_sample(
    page: Page,
    benchmark: BenchmarkDefinition,
    measurement: InteractionMeasurement,
    completion: dict[str, Any],
) -> Path:
    output_dir = Path(
        os.environ.get(
            "BI_PERFORMANCE_OUTPUT_DIR",
            get_git_root() / ".benchmarks" / "bi_performance" / "raw",
        )
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^a-zA-Z0-9_.-]", "_", benchmark.benchmark_id)
    output_path = output_dir / f"{safe_id}_{time.time_ns()}_{uuid.uuid4().hex}.json"
    payload = {
        "schema_version": _SCHEMA_VERSION,
        "benchmark": {
            **asdict(benchmark),
            "definition_version": _BENCHMARK_DEFINITION_VERSION,
            "definition_fingerprint": _hash_files(_SOURCE_PATHS),
        },
        "revision": _get_revision(),
        "toolchain": _toolchain_metadata(page),
        "sample": asdict(measurement),
        "completion": completion,
    }
    output_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8"
    )
    return output_path


def measure_interaction(
    page: Page,
    *,
    benchmark: BenchmarkDefinition,
    before_completion: dict[str, Any],
    action: _Action,
    wait_for_completion: _CompletionWaiter,
) -> InteractionMeasurement:
    """Measure one browser interaction and persist its raw sample.

    ``action`` returns the local monotonic timestamp immediately before the
    input event used as the latency origin. It may begin a gesture earlier so
    WebSocket counts include intermediate brush updates while latency still
    begins at pointer release.
    """
    client = page.context.new_cdp_session(page)
    sent_frames: list[tuple[float, int]] = []
    received_frames: list[tuple[float, int]] = []

    def on_frame_sent(params: dict[str, Any]) -> None:
        sent_frames.append((time.perf_counter(), _frame_size(params)))

    def on_frame_received(params: dict[str, Any]) -> None:
        received_frames.append((time.perf_counter(), _frame_size(params)))

    client.send("Network.enable")
    client.on("Network.webSocketFrameSent", on_frame_sent)
    client.on("Network.webSocketFrameReceived", on_frame_received)
    long_frame_start_index = _long_animation_frame_count(page)

    try:
        input_started_at = action()
        completion = wait_for_completion()
        _wait_for_two_animation_frames(page)
        completed_at = time.perf_counter()
    finally:
        try:
            client.send("Network.disable")
        finally:
            client.detach()

    relevant_sent = [
        (timestamp, size)
        for timestamp, size in sent_frames
        if timestamp >= input_started_at
    ]
    relevant_received = [
        (timestamp, size)
        for timestamp, size in received_frames
        if timestamp >= input_started_at
    ]
    all_gesture_sent = sent_frames
    all_gesture_received = received_frames

    first_backmsg_at = relevant_sent[0][0] if relevant_sent else None
    last_delta_at = relevant_received[-1][0] if relevant_received else None
    measurement = InteractionMeasurement(
        interaction_to_completion_ms=(completed_at - input_started_at) * 1000,
        input_to_backmsg_ms=(
            (first_backmsg_at - input_started_at) * 1000
            if first_backmsg_at is not None
            else None
        ),
        rerun_count=int(completion["run_count"]) - int(before_completion["run_count"]),
        websocket_messages_sent=len(all_gesture_sent),
        websocket_messages_received=len(all_gesture_received),
        websocket_bytes_sent=sum(size for _, size in all_gesture_sent),
        websocket_bytes_received=sum(size for _, size in all_gesture_received),
        server_script_duration_ms=float(completion["server_duration_ms"]),
        last_delta_to_paint_ms=(
            (completed_at - last_delta_at) * 1000 if last_delta_at is not None else None
        ),
        max_long_animation_frame_ms=_max_new_long_animation_frame_duration(
            page, long_frame_start_index
        ),
    )
    _write_sample(page, benchmark, measurement, completion)
    return measurement
