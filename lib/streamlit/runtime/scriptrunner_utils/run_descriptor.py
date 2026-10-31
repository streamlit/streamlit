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

"""Immutable identity for one top-level backend script execution."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence


def generate_scriptrun_id() -> str:
    """Randomly generate a unique ID for a script execution."""
    return str(uuid.uuid4())


@dataclass(frozen=True)
class RunDescriptor:
    """Identity of one top-level backend execution and its frontend start/finish pair.

    A descriptor is created once per ScriptRunner loop iteration and carried on
    SCRIPT_STARTED and every matching terminal event. It is not an
    output-freshness token for overlapping fragment revisions.
    """

    script_run_id: str
    fragment_ids_this_run: tuple[str, ...]

    @classmethod
    def create(
        cls, fragment_ids_this_run: Sequence[str] | None = None
    ) -> RunDescriptor:
        """Create a descriptor for a new top-level execution."""
        return cls(
            script_run_id=generate_scriptrun_id(),
            fragment_ids_this_run=tuple(fragment_ids_this_run or ()),
        )
