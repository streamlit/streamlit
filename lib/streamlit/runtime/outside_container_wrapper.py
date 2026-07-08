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

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.proto import Block_pb2


@dataclass
class OutsideContainerWrapper:
    """Cached implicit wrapper between an outside container and a fragment's writes.

    Attributes
    ----------
    delta_generator : DeltaGenerator
        The wrapper DeltaGenerator that the fragment writes into.
    creation_delta_path : list[int]
        The delta path at which the wrapper was originally created, retained so
        the wrapper's ``add_block`` delta can be re-emitted on each fragment rerun.
    block_proto : Block_pb2.Block
        The Block proto for the wrapper, also retained for re-emission.
    creating_fragment_id : str | None
        The fragment whose scope created the outside container (``None`` for the
        main script). Drives per-fragment eviction when that scope reruns.
    """

    delta_generator: DeltaGenerator
    creation_delta_path: list[int]
    block_proto: Block_pb2.Block
    creating_fragment_id: str | None
