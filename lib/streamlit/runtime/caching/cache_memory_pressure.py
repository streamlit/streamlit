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

"""Best-effort memory-pressure diagnostics for ``st.cache_data`` writes."""

from __future__ import annotations

import os
import platform
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable

    from streamlit.runtime.stats import CacheStat

_LOGGER: Final = get_logger(__name__)

_CGROUP_ROOT: Final = Path("/sys/fs/cgroup")
_PROC_SELF_CGROUP: Final = Path("/proc/self/cgroup")
_PROC_SELF_STATM: Final = Path("/proc/self/statm")
_PRESSURE_RATIO: Final = 0.80
_RESET_RATIO: Final = 0.70
_PROBE_INTERVAL_SECONDS: Final = 5.0
_FALLBACK_WARNING_INTERVAL_SECONDS: Final = 60.0 * 60.0
_LARGE_ENTRY_BYTES: Final = 256 * 1024 * 1024
_V1_UNLIMITED_MIN_BYTES: Final = 1 << 60
_MAX_CONTRIBUTORS: Final = 3


@dataclass(frozen=True)
class MemorySample:
    """A current memory measurement and its finite limit, when available."""

    usage_bytes: int
    limit_bytes: int | None
    source: str


@dataclass(frozen=True)
class CacheContributor:
    """Serialized cache usage attributed to one displayed function name."""

    display_name: str
    byte_length: int
    entry_count: int


@dataclass(frozen=True)
class CacheUsageSummary:
    """Serialized cache totals and their largest function contributors."""

    total_bytes: int
    entry_count: int
    contributors: tuple[CacheContributor, ...]


@dataclass(frozen=True)
class _WarningContext:
    sample: MemorySample | None
    projected_usage_bytes: int | None
    fallback: bool


@dataclass
class _DiagnosticState:
    next_probe_at: float = 0.0
    last_sample: MemorySample | None = None
    cgroup_warning_active: bool = False
    last_fallback_warning_at: float = float("-inf")


_state_lock: Final = threading.Lock()
_state: Final = _DiagnosticState()


def summarize_cache_stats(stats: Iterable[CacheStat]) -> CacheUsageSummary:
    """Aggregate per-entry cache stats into a bounded, deterministic summary."""
    totals: dict[str, tuple[int, int]] = {}
    total_bytes = 0
    entry_count = 0
    for stat in stats:
        if stat.category_name != "st_cache_data":
            continue
        previous_bytes, previous_count = totals.get(stat.cache_name, (0, 0))
        totals[stat.cache_name] = (
            previous_bytes + stat.byte_length,
            previous_count + 1,
        )
        total_bytes += stat.byte_length
        entry_count += 1

    contributors = sorted(
        (
            CacheContributor(
                display_name=name,
                byte_length=byte_length,
                entry_count=count,
            )
            for name, (byte_length, count) in totals.items()
        ),
        key=lambda item: (-item.byte_length, -item.entry_count, item.display_name),
    )
    return CacheUsageSummary(
        total_bytes=total_bytes,
        entry_count=entry_count,
        contributors=tuple(contributors[:_MAX_CONTRIBUTORS]),
    )


def maybe_log_cache_memory_pressure(
    *,
    current_function: str,
    pending_entry_bytes: int,
    get_cache_summary: Callable[[], CacheUsageSummary],
) -> None:
    """Log a warning before a cache write when memory pressure is detected."""
    try:
        now = time.monotonic()
        sample = _get_rate_limited_memory_sample(now)
        warning_context = _reserve_warning(
            sample=sample,
            pending_entry_bytes=pending_entry_bytes,
            now=now,
        )
        if warning_context is None:
            return

        summary = get_cache_summary()
        _LOGGER.warning(
            "%s",
            _format_warning(
                context=warning_context,
                summary=summary,
                current_function=current_function,
                pending_entry_bytes=pending_entry_bytes,
            ),
        )
    except Exception:
        # Diagnostics must never interfere with a cache write.
        return


def _get_rate_limited_memory_sample(now: float) -> MemorySample | None:
    with _state_lock:
        if now < _state.next_probe_at:
            return _state.last_sample
        _state.next_probe_at = now + _PROBE_INTERVAL_SECONDS

    sample = _read_memory_sample()
    with _state_lock:
        _state.last_sample = sample
    return sample


def _reserve_warning(
    *,
    sample: MemorySample | None,
    pending_entry_bytes: int,
    now: float,
) -> _WarningContext | None:
    with _state_lock:
        if sample is not None and sample.limit_bytes is not None:
            projected_usage = sample.usage_bytes + pending_entry_bytes
            pressure_ratio = projected_usage / sample.limit_bytes
            if pressure_ratio <= _RESET_RATIO:
                _state.cgroup_warning_active = False
            if pressure_ratio >= _PRESSURE_RATIO and not _state.cgroup_warning_active:
                _state.cgroup_warning_active = True
                return _WarningContext(
                    sample=sample,
                    projected_usage_bytes=projected_usage,
                    fallback=False,
                )
            return None

        if (
            pending_entry_bytes >= _LARGE_ENTRY_BYTES
            and now - _state.last_fallback_warning_at
            >= _FALLBACK_WARNING_INTERVAL_SECONDS
        ):
            _state.last_fallback_warning_at = now
            return _WarningContext(
                sample=sample,
                projected_usage_bytes=None,
                fallback=True,
            )
        return None


def _read_memory_sample() -> MemorySample | None:
    if platform.system() != "Linux":
        return None

    cgroup_text = _read_text(_PROC_SELF_CGROUP) or ""
    finite_samples: list[MemorySample] = []
    first_unlimited_sample: MemorySample | None = None
    for usage_path, limit_path, source in _cgroup_file_candidates(cgroup_text):
        usage = _read_nonnegative_int(usage_path)
        if usage is None:
            continue
        limit = _read_limit(limit_path)
        sample = MemorySample(usage_bytes=usage, limit_bytes=limit, source=source)
        if limit is not None:
            finite_samples.append(sample)
        elif first_unlimited_sample is None:
            first_unlimited_sample = sample

    if finite_samples:
        return min(
            finite_samples,
            key=lambda sample: (
                sample.limit_bytes
                if sample.limit_bytes is not None
                else _V1_UNLIMITED_MIN_BYTES
            ),
        )
    if first_unlimited_sample is not None:
        return first_unlimited_sample

    process_rss = _read_process_rss()
    if process_rss is None:
        return None
    return MemorySample(
        usage_bytes=process_rss,
        limit_bytes=None,
        source="process RSS",
    )


def _cgroup_file_candidates(
    cgroup_text: str,
) -> list[tuple[Path, Path, str]]:
    candidates = [
        (
            _CGROUP_ROOT / "memory.current",
            _CGROUP_ROOT / "memory.max",
            "cgroup v2 memory",
        ),
        (
            _CGROUP_ROOT / "memory" / "memory.usage_in_bytes",
            _CGROUP_ROOT / "memory" / "memory.limit_in_bytes",
            "cgroup v1 memory",
        ),
    ]

    for line in cgroup_text.splitlines():
        fields = line.split(":", 2)
        if len(fields) != 3:
            continue
        controllers = fields[1].split(",")
        relative_path = fields[2].lstrip("/")
        if fields[1] == "":
            candidates.extend(
                (
                    directory / "memory.current",
                    directory / "memory.max",
                    "cgroup v2 memory",
                )
                for directory in _cgroup_directories(
                    base=_CGROUP_ROOT,
                    relative_path=relative_path,
                )
            )
        elif "memory" in controllers:
            candidates.extend(
                (
                    directory / "memory.usage_in_bytes",
                    directory / "memory.limit_in_bytes",
                    "cgroup v1 memory",
                )
                for base in (
                    _CGROUP_ROOT / "memory",
                    _CGROUP_ROOT,
                )
                for directory in _cgroup_directories(
                    base=base,
                    relative_path=relative_path,
                )
            )

    return list(dict.fromkeys(candidates))


def _cgroup_directories(*, base: Path, relative_path: str) -> list[Path]:
    path_parts = Path(relative_path).parts
    return [
        base.joinpath(*path_parts[:part_count])
        for part_count in range(len(path_parts), 0, -1)
    ]


def _read_limit(path: Path) -> int | None:
    raw_value = _read_text(path)
    if raw_value is None:
        return None
    value = raw_value.strip()
    if value == "max":
        return None
    try:
        limit = int(value)
    except ValueError:
        return None
    if limit <= 0 or limit >= _V1_UNLIMITED_MIN_BYTES:
        return None
    return limit


def _read_nonnegative_int(path: Path) -> int | None:
    raw_value = _read_text(path)
    if raw_value is None:
        return None
    try:
        value = int(raw_value.strip())
    except ValueError:
        return None
    return value if value >= 0 else None


def _read_process_rss() -> int | None:
    statm = _read_text(_PROC_SELF_STATM)
    if statm is None:
        return None
    fields = statm.split()
    if len(fields) < 2:
        return None
    try:
        resident_pages = int(fields[1])
        page_size = os.sysconf("SC_PAGE_SIZE")
    except (OSError, TypeError, ValueError):
        return None
    if resident_pages < 0 or page_size <= 0:
        return None
    return resident_pages * page_size


def _read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return None


def _format_warning(
    *,
    context: _WarningContext,
    summary: CacheUsageSummary,
    current_function: str,
    pending_entry_bytes: int,
) -> str:
    sample = context.sample
    if context.fallback:
        if sample is None:
            memory_description = "Current process/cgroup memory is unavailable."
        else:
            memory_description = (
                f"Current {sample.source} is {_format_bytes(sample.usage_bytes)}."
            )
        pressure_description = (
            "A large st.cache_data result is about to be cached. "
            f"{memory_description} No finite cgroup memory limit was detected, "
            "so total available memory is unknown."
        )
    elif (
        sample is not None
        and sample.limit_bytes is not None
        and context.projected_usage_bytes is not None
    ):
        current_ratio = sample.usage_bytes / sample.limit_bytes
        projected_ratio = context.projected_usage_bytes / sample.limit_bytes
        pressure_description = (
            "st.cache_data is approaching its available memory: "
            f"current {sample.source} is {_format_bytes(sample.usage_bytes)} of "
            f"{_format_bytes(sample.limit_bytes)} ({current_ratio:.1%}); accounting "
            f"conservatively for the pending serialized entry gives "
            f"{_format_bytes(context.projected_usage_bytes)} ({projected_ratio:.1%})."
        )
    else:
        pressure_description = "st.cache_data memory pressure was detected."

    if summary.contributors:
        contributor_description = "; ".join(
            f"{_sanitize_display_name(item.display_name)}: "
            f"{_format_bytes(item.byte_length)} in {item.entry_count} entries"
            for item in summary.contributors
        )
    else:
        contributor_description = "none available"

    return (
        f"{pressure_description} Current serialized st.cache_data usage is "
        f"{_format_bytes(summary.total_bytes)} across {summary.entry_count} entries. "
        f"Largest cached functions: {contributor_description}. Current cache write: "
        f"{_sanitize_display_name(current_function)}, pending serialized entry "
        f"{_format_bytes(pending_entry_bytes)}. Reduce cached result sizes, set ttl "
        "or max_entries, or clear unused caches with st.cache_data.clear(). Actual "
        "process memory also includes live/deserialized caller copies and other app "
        "state. If the process is OOM-killed, this warning is only available in "
        "externally retained Streamlit server, container, or hosting-platform logs."
    )


def _sanitize_display_name(display_name: str) -> str:
    return display_name.replace("\r", "\\r").replace("\n", "\\n")[:200]


def _format_bytes(byte_length: int) -> str:
    value = float(byte_length)
    for unit in ("B", "KiB", "MiB", "GiB", "TiB"):
        if abs(value) < 1024.0 or unit == "TiB":
            return f"{value:.1f} {unit}"
        value /= 1024.0
    return f"{value:.1f} TiB"  # pragma: no cover


def _reset_state_for_testing() -> None:
    with _state_lock:
        _state.next_probe_at = 0.0
        _state.last_sample = None
        _state.cgroup_warning_active = False
        _state.last_fallback_warning_at = float("-inf")
