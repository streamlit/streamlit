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
    """Identity of one top-level backend execution.

    A run is either a full-app run or one fragment rerun batch: the ordered
    fragment roots that one ScriptRunner loop iteration executes together.
    This is the backend counterpart of the ``RunIdentity`` proto:
    ``new_session`` carries this identity in ``ForwardMsg.metadata.run``.

    Attributes
    ----------
    script_run_id : str
        A unique ID for this run.
    fragment_ids : tuple[str, ...]
        The fragment roots selected for this run, in execution order. Empty
        for a full-app run.
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
        """Read the run identity from ForwardMsg metadata.

        Returns None if the metadata carries no run identity.
        """
        if not metadata.HasField("run") or not metadata.run.script_run_id:
            return None
        return cls(
            script_run_id=metadata.run.script_run_id,
            fragment_ids=tuple(metadata.run.fragment_ids),
        )
