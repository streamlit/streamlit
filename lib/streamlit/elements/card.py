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

from typing import TYPE_CHECKING, Final, Literal, cast

from streamlit import logger
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib import agent_spec
from streamlit.elements.lib.layout_utils import (
    Height,
    Width,
    get_align,
    get_gap_config,
    get_height_config,
    get_justify,
    get_width_config,
    validate_bool_arg,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitMissingRequiredParameterError,
)
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import to_help_str, to_str, validate_icon_or_emoji

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.card_container import CardContainer

_LOGGER: Final = logger.get_logger(__name__)


def _slot_proto(
    *,
    horizontal: bool,
    justify: Literal["left", "right", "top"],
    width: Width,
) -> BlockProto:
    """Build a card child block: a header slot (``horizontal``) or the body.

    Every child is a plain flex container, so the frontend lays out slot
    and body content like any other container. A child with no content isn't
    rendered.
    """
    block_proto = BlockProto()
    block_proto.allow_empty = False
    flex = block_proto.flex_container
    flex.border = False
    flex.gap_config.CopyFrom(get_gap_config("xsmall" if horizontal else "small"))
    if horizontal:
        flex.direction = BlockProto.FlexContainer.Direction.HORIZONTAL
        flex.wrap = True
        flex.justify = get_justify(justify)
        flex.align = get_align("center")
    else:
        flex.direction = BlockProto.FlexContainer.Direction.VERTICAL
        flex.wrap = False
        flex.justify = get_justify("top")
        flex.align = get_align("left")
    block_proto.width_config.CopyFrom(get_width_config(width))
    block_proto.height_config.CopyFrom(
        get_height_config("content" if horizontal else "stretch")
    )
    return block_proto


class CardMixin:
    @gather_metrics("card")
    def card(
        self,
        label: str,
        *,
        icon: str | None = None,
        caption: str | None = None,
        help: str | None = None,
        key: Key | None = None,
        border: bool = True,
        background: bool = False,
        width: Width = "stretch",
        height: Height = "stretch",
    ) -> CardContainer:
        r"""Insert a titled panel container.

        A card is a panel for dashboards. It has a header with a title, an
        optional icon, caption, and help tooltip, and a body that can hold any
        elements. Cards fill the height of their row by default, so cards
        placed side by side line up.

        To add elements to the card, use the ``with`` notation (preferred) or
        call commands directly on the returned object.

        Parameters
        ----------
        label : str
            The card title. This supports inline Markdown, like other labels.
            The label is one line and ends in an ellipsis when it doesn't fit.
            A label of about 30 characters or fewer works best. Use ``caption``
            or ``help`` for longer text.

            The label is the card's accessible name, so don't leave it empty.
            To group elements without a title, use
            ``st.container(border=True)``.

        icon : str or None
            An optional emoji or icon to display before the label. This can be
            one of the following:

            - ``None`` (default): No icon is displayed.
            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.
            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            The ``"spinner"`` value that ``st.expander`` accepts raises an
            exception for ``st.card``.

        caption : str or None
            A short line below the label. This supports inline Markdown. It
            shows up to two lines and then ends in an ellipsis. Use it for
            units, a time window, or a short hint.

        help : str or None
            A tooltip that appears when the user hovers over a help icon beside
            the label. This supports GitHub-flavored Markdown.

        key : str or int or None
            An optional string or integer to give this element a stable
            identity. If this is ``None`` (default), the element's identity
            will be determined based on the values of the other parameters.

            Additionally, if ``key`` is provided, it will be used as a CSS
            class name prefixed with ``st-key-``. The card isn't a widget, so
            its key registers no widget state.

        border : bool
            Whether to draw an outline around the card. This defaults to
            ``True``. With ``border=False`` and ``background=False``, the card
            is a titled section with no frame and no padding, for use inside
            something that is already framed.

        background : bool
            Whether to fill the card with the theme's secondary background
            color. This defaults to ``False``. When this is ``True``, elements
            inside the card swap the colors they normally take from the
            background and secondary background, the way elements in the
            sidebar do.

        width : "stretch", "content", or int
            The width of the card. This can be one of the following:

            - ``"stretch"`` (default): The width of the card matches the width
              of the parent container.
            - ``"content"``: The width of the card matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The card has a fixed
              width. If the specified width is greater than the width of the
              parent container, the width of the card matches the width of the
              parent container.

        height : "stretch", "content", or int
            The height of the card. Unlike ``st.container``, this defaults to
            ``"stretch"``. This can be one of the following:

            - ``"stretch"`` (default): The height of the card matches the
              height of its content or the height of the parent container,
              whichever is larger. In a horizontal container, the parent is
              the row, so cards in the same row line up. A stretch card never
              clips or scrolls its content.
            - ``"content"``: The height of the card matches the height of its
              content.
            - An integer specifying the height in pixels: The card has a fixed
              height. The header stays in place and the body scrolls if its
              content is larger than the space below the header.

            .. note::
                Use scrolling cards sparingly. If you use scrolling cards,
                avoid heights that exceed 500 pixels. Otherwise, the scroll
                surface of the card might cover the majority of the screen on
                mobile devices, which makes it hard to scroll the rest of the
                page.

        Returns
        -------
        CardContainer
            A container object. Elements can be added to the card by calling
            methods on it or by using the ``with`` notation.

        Examples
        --------
        **Example 1: A titled card**

        >>> import numpy as np
        >>> import streamlit as st
        >>>
        >>> with st.card("Revenue", caption="Last 12 months"):
        ...     st.line_chart(np.random.randn(12, 2))

        **Example 2: Cards that line up in a row**

        Cards stretch to the height of their row by default. Give every card
        in a row the same header fields so their charts start at the same
        height.

        >>> import numpy as np
        >>> import streamlit as st
        >>>
        >>> left, right = st.columns(2)
        >>> with left.card("Signups", caption="Per day"):
        ...     st.bar_chart(np.random.randn(30, 1))
        >>> with right.card("Churn", caption="Per day"):
        ...     st.write("Churn is flat this month.")

        **Example 3: A filled card on a tinted page**

        Set ``background=True`` for a card that is filled with the theme's
        secondary background color.

        >>> import streamlit as st
        >>>
        >>> with st.card("Summary", background=True, border=False):
        ...     st.metric("Active users", "1,204", "+8%")

        """
        if label is None:
            raise StreamlitMissingRequiredParameterError("label")

        label = to_str(label)
        if not label.strip():
            _LOGGER.warning(
                "`label` got an empty value. This is discouraged for accessibility "
                "reasons, because the label is the card's accessible name. Please "
                "provide a non-empty label, or use `st.container(border=True)` for "
                "an untitled group.",
                stack_info=True,
            )

        validated_icon = validate_icon_or_emoji(icon)
        if validated_icon == "spinner":
            raise StreamlitAPIException(
                'The value "spinner" is not a valid `icon` for `st.card`. '
                "Pass an emoji or a Material icon instead.",
                error_id="card-icon-spinner-not-supported",
            )

        validate_bool_arg("border", border)
        validate_bool_arg("background", background)
        validate_width(width, allow_content=True)
        validate_height(height, allow_content=True)

        # An empty or whitespace-only caption or help counts as not set.
        caption_text = to_str(caption) if caption is not None else ""
        if not caption_text.strip():
            caption_text = ""
        help_text = to_help_str(help) if help is not None else ""
        if not help_text.strip():
            help_text = ""

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.card.label = label
        block_proto.card.icon = validated_icon
        block_proto.card.caption = caption_text
        block_proto.card.help = help_text
        block_proto.card.border = border
        block_proto.card.background = background
        block_proto.width_config.CopyFrom(get_width_config(width))
        block_proto.height_config.CopyFrom(get_height_config(height))

        maybe_key = to_key(key)
        if maybe_key:
            block_proto.id = compute_and_register_element_id(
                "card", user_key=maybe_key, dg=None, key_as_main_identity=False
            )

        card_dg = self.dg._block(
            block_proto,
            agent_props=agent_spec.block(
                "card",
                label=label,
                icon=validated_icon or None,
                caption=caption_text or None,
                help=help_text or None,
                key=maybe_key,
            ),
        )

        # The slots and the body are always created, in this order, so the
        # body keeps its place whether or not a slot is written. They are an
        # implementation detail of the card, so a non-visual client reads the
        # body's content as the card's own.
        slot_agent_props = agent_spec.block("container", transparent=True)
        header_extras = card_dg._block(
            _slot_proto(horizontal=True, justify="left", width="content"),
            agent_props=slot_agent_props,
        )
        actions = card_dg._block(
            _slot_proto(horizontal=True, justify="right", width="content"),
            agent_props=slot_agent_props,
        )
        body = cast(
            "CardContainer",
            card_dg._block(
                _slot_proto(horizontal=False, justify="top", width="stretch"),
                dg_type=get_dg_singleton_instance().card_container_cls,
                agent_props=slot_agent_props,
            ),
        )
        body._header_extras = header_extras
        body._actions = actions
        return body

    @property
    def dg(self) -> DeltaGenerator:
        return cast("DeltaGenerator", self)
