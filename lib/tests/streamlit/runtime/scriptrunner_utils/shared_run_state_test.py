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

import threading

import pytest

from streamlit.proto.PageProfile_pb2 import Command
from streamlit.runtime.scriptrunner_utils.shared_run_state import SharedRunState


def _make_command(name: str) -> Command:
    return Command(name=name)


def test_reset_clears_all_fields() -> None:
    """``reset()`` empties every set and the telemetry state."""
    shared = SharedRunState()
    shared.widget_ids_this_run.check_and_add("widget")
    shared.widget_user_keys_this_run.check_and_add("key")
    shared.form_ids_this_run.check_and_add("form")
    shared.new_fragment_ids.check_and_add("fragment")
    shared.track_command(_make_command("markdown"), max_per_command=5, max_total=10)

    shared.reset()

    assert "widget" not in shared.widget_ids_this_run
    assert "key" not in shared.widget_user_keys_this_run
    assert "form" not in shared.form_ids_this_run
    assert "fragment" not in shared.new_fragment_ids
    assert shared.tracked_commands == ()
    assert shared.tracked_commands_count == 0
    assert shared.command_count_for("markdown") == 0


def test_track_command_appends_and_counts() -> None:
    """``track_command()`` records commands in the list and counter."""
    shared = SharedRunState()
    shared.track_command(_make_command("markdown"), max_per_command=5, max_total=10)
    shared.track_command(_make_command("button"), max_per_command=5, max_total=10)
    shared.track_command(_make_command("markdown"), max_per_command=5, max_total=10)

    assert shared.tracked_commands_count == 3
    assert [cmd.name for cmd in shared.tracked_commands] == [
        "markdown",
        "button",
        "markdown",
    ]
    assert shared.command_count_for("markdown") == 2
    assert shared.command_count_for("button") == 1


def test_track_command_respects_per_command_cap() -> None:
    """Past ``max_per_command``, a name is still counted but no longer appended."""
    shared = SharedRunState()
    for _ in range(5):
        shared.track_command(_make_command("markdown"), max_per_command=2, max_total=10)

    assert shared.tracked_commands_count == 2
    assert all(cmd.name == "markdown" for cmd in shared.tracked_commands)
    assert shared.command_count_for("markdown") == 5


def test_track_command_respects_total_cap() -> None:
    """``track_command()`` drops commands without counting them once the list is full."""
    shared = SharedRunState()
    for name in ["markdown", "button", "markdown", "text"]:
        shared.track_command(_make_command(name), max_per_command=5, max_total=2)

    assert [cmd.name for cmd in shared.tracked_commands] == ["markdown", "button"]
    assert shared.command_count_for("markdown") == 1
    assert shared.command_count_for("button") == 1
    assert shared.command_count_for("text") == 0


def test_concurrent_track_command_respects_total_cap() -> None:
    """Concurrent calls keep the list and the summed counts at ``max_total``."""
    shared = SharedRunState()
    num_threads = 16
    per_thread = 50
    max_total = 100
    barrier = threading.Barrier(num_threads)

    def worker(thread_index: int) -> None:
        barrier.wait()
        for _ in range(per_thread):
            shared.track_command(
                _make_command(f"cmd_{thread_index}"),
                max_per_command=per_thread,
                max_total=max_total,
            )

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(num_threads)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert shared.tracked_commands_count == max_total
    assert (
        sum(shared.command_count_for(f"cmd_{i}") for i in range(num_threads))
        == max_total
    )


def test_concurrent_track_command() -> None:
    """Concurrent ``track_command()`` calls do not lose any commands."""
    shared = SharedRunState()
    num_threads = 16
    per_thread = 50
    # Use a generous cap so every command is appended.
    cap = num_threads * per_thread + 1

    def worker(thread_index: int) -> None:
        for _ in range(per_thread):
            shared.track_command(
                _make_command(f"cmd_{thread_index}"),
                max_per_command=cap,
                max_total=cap,
            )

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(num_threads)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert shared.tracked_commands_count == num_threads * per_thread
    for i in range(num_threads):
        assert shared.command_count_for(f"cmd_{i}") == per_thread


def test_tracked_commands_returns_immutable_snapshot() -> None:
    """The returned tuple cannot be mutated and does not affect internal state."""
    shared = SharedRunState()
    shared.track_command(_make_command("markdown"), max_per_command=5, max_total=10)

    snapshot = shared.tracked_commands
    assert isinstance(snapshot, tuple)
    with pytest.raises(AttributeError):
        snapshot.append(_make_command("button"))  # type: ignore[attr-defined]

    assert shared.tracked_commands_count == 1
    assert [cmd.name for cmd in shared.tracked_commands] == ["markdown"]
