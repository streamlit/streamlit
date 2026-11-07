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

import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable

    from streamlit.proto.ForwardMsg_pb2 import ForwardMsgMetadata


def _generate_scriptrun_id() -> str:
    """Randomly generate a unique ID for a script execution."""
    return str(uuid.uuid4())


@dataclass(frozen=True)
class RunDescriptor:
    """The ID of one script run and the fragments it reruns.

    A run is a full-app rerun, or a rerun of one or more fragments that
    ScriptRunner executes together. ScriptRunner creates one per run, and
    AppSession writes it into ``ForwardMsg.metadata.run`` (the ``RunIdentity``
    proto) on that run's ``new_session`` and ``script_finished``.

    Attributes
    ----------
    script_run_id : str
        A unique ID for this run.
    fragment_ids : tuple[str, ...]
        Fragments this run reruns, with parent fragments before nested ones.
        Empty for a full-app run.
    """

    script_run_id: str
    fragment_ids: tuple[str, ...] = ()

    @classmethod
    def create(cls, fragment_ids: Iterable[str] | None = None) -> RunDescriptor:
        """Create a descriptor with a newly generated run ID."""
        return cls(
            script_run_id=_generate_scriptrun_id(),
            fragment_ids=tuple(fragment_ids or ()),
        )

    @classmethod
    def from_metadata(cls, metadata: ForwardMsgMetadata) -> RunDescriptor | None:
        """Read the descriptor from ``metadata.run``, or None if it's unset or has no run ID."""
        if not metadata.HasField("run") or not metadata.run.script_run_id:
            return None
        return cls(
            script_run_id=metadata.run.script_run_id,
            fragment_ids=tuple(metadata.run.fragment_ids),
        )
