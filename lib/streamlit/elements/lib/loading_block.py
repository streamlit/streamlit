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

"""Loading blocks: containers that show a skeleton until content is drawn."""

from __future__ import annotations

from typing import TYPE_CHECKING

from streamlit.elements.lib import agent_spec
from streamlit.elements.lib.layout_utils import (
    get_align,
    get_gap_config,
    get_height_config,
    get_justify,
    get_width_config,
)
from streamlit.proto.Block_pb2 import Block as BlockProto

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import (
        HeightWithoutContent,
        WidthWithoutContent,
    )


def make_loading_block_proto(
    *,
    skeleton_height: HeightWithoutContent | None = None,
    width: WidthWithoutContent = "stretch",
    show_skeleton: bool = True,
) -> BlockProto:
    """Build the proto of a loading block: a vertical container, laid out like
    ``st.container()``, that shows a skeleton until content arrives.

    Parameters
    ----------
    skeleton_height
        The skeleton's height while the block has no content to keep, or
        ``None`` for the frontend default. ``"stretch"`` also stretches the block.
    width
        The block's width.
    show_skeleton
        Whether the block shows the skeleton. ``False`` builds the cleared
        block that ``SkeletonPlaceholder.__exit__`` re-sends.
    """
    block_proto = BlockProto()
    # A loading block renders while empty so its skeleton reserves space. A
    # cleared block is hidden while empty, like `st.container()`.
    block_proto.allow_empty = show_skeleton
    block_proto.flex_container.border = False
    block_proto.flex_container.wrap = False
    block_proto.flex_container.gap_config.CopyFrom(get_gap_config("small"))
    block_proto.flex_container.direction = BlockProto.FlexContainer.Direction.VERTICAL
    block_proto.flex_container.justify = get_justify("top")
    block_proto.flex_container.align = get_align("left")
    block_proto.width_config.CopyFrom(get_width_config(width))
    block_proto.height_config.CopyFrom(
        get_height_config("stretch" if skeleton_height == "stretch" else "content")
    )
    if show_skeleton:
        block_proto.loading.SetInParent()
        if skeleton_height is not None:
            block_proto.loading.skeleton_height.CopyFrom(
                get_height_config(skeleton_height)
            )
    return block_proto


def open_loading_block(
    dg: DeltaGenerator,
    *,
    skeleton_height: HeightWithoutContent | None = None,
    width: WidthWithoutContent = "stretch",
) -> DeltaGenerator:
    """Insert a loading block at ``dg``'s next position and return it."""
    return dg._block(
        make_loading_block_proto(skeleton_height=skeleton_height, width=width),
        # The agent API reports a plain container; the skeleton is presentation.
        agent_props=agent_spec.block("container"),
    )
