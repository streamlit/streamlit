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

"""Unit tests for streamlit.runtime.scriptrunner_utils.run_descriptor."""

from __future__ import annotations

import dataclasses
import uuid

import pytest

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg, ForwardMsgMetadata
from streamlit.runtime.scriptrunner_utils.run_descriptor import RunDescriptor


def test_create_full_app_run() -> None:
    """A descriptor created without fragment IDs describes a full-app run."""
    run = RunDescriptor.create()

    assert run.fragment_ids == ()
    assert str(uuid.UUID(run.script_run_id)) == run.script_run_id


@pytest.mark.parametrize("fragment_ids", [None, []])
def test_create_with_empty_fragment_ids(fragment_ids: list[str] | None) -> None:
    """None and an empty list both produce a full-app run."""
    assert RunDescriptor.create(fragment_ids).fragment_ids == ()


def test_create_fragment_run_keeps_order() -> None:
    """`create` keeps fragment IDs in the given order as an immutable tuple."""
    fragment_ids = ["outer", "inner"]

    run = RunDescriptor.create(fragment_ids)
    fragment_ids.append("later")

    assert run.fragment_ids == ("outer", "inner")


def test_create_generates_unique_ids() -> None:
    """Each created descriptor gets a new run ID."""
    assert RunDescriptor.create().script_run_id != RunDescriptor.create().script_run_id


def test_is_frozen() -> None:
    """Mutating a descriptor after creation raises."""
    run = RunDescriptor.create()

    with pytest.raises(dataclasses.FrozenInstanceError):
        run.script_run_id = "other"  # type: ignore[misc]


@pytest.mark.parametrize(
    "run",
    [
        RunDescriptor(script_run_id="full_run"),
        RunDescriptor(script_run_id="fragment_run", fragment_ids=("a", "b")),
    ],
)
def test_from_metadata_round_trip(run: RunDescriptor) -> None:
    """from_metadata reads back the identity written to ForwardMsg metadata."""
    msg = ForwardMsg()
    msg.metadata.run.script_run_id = run.script_run_id
    msg.metadata.run.fragment_ids.extend(run.fragment_ids)

    parsed = ForwardMsg()
    parsed.ParseFromString(msg.SerializeToString())

    assert RunDescriptor.from_metadata(parsed.metadata) == run


def test_from_metadata_without_run() -> None:
    """Metadata without a run identity yields None."""
    metadata = ForwardMsgMetadata()
    metadata.delta_path[:] = [0, 1]

    assert RunDescriptor.from_metadata(metadata) is None


def test_from_metadata_without_script_run_id() -> None:
    """A run identity without a run ID yields None."""
    metadata = ForwardMsgMetadata()
    metadata.run.fragment_ids.append("fragment")

    assert RunDescriptor.from_metadata(metadata) is None
