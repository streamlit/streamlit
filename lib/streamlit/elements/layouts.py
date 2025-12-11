# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from collections.abc import Sequence
from typing import TYPE_CHECKING, Literal, TypeAlias, cast

from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib.layout_utils import (
    Gap,
    Height,
    HorizontalAlignment,
    VerticalAlignment,
    Width,
    WidthWithoutContent,
    get_align,
    get_gap_size,
    get_height_config,
    get_justify,
    get_width_config,
    validate_height,
    validate_horizontal_alignment,
    validate_vertical_alignment,
    validate_width,
)
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidColumnSpecError,
    StreamlitInvalidVerticalAlignmentError,
)
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.GapSize_pb2 import GapConfig
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import validate_icon_or_emoji

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.dialog import Dialog
    from streamlit.elements.lib.mutable_status_container import StatusContainer
    from streamlit.runtime.state import WidgetCallback

SpecType: TypeAlias = int | Sequence[int | float]


class LayoutsMixin:
    @gather_metrics("container")
    def container(
        self,
        *,
        border: bool | None = None,
        key: Key | None = None,
        width: Width = "stretch",
        height: Height = "content",
        horizontal: bool = False,
        horizontal_alignment: HorizontalAlignment = "left",
        vertical_alignment: VerticalAlignment = "top",
        gap: Gap | None = "small",
    ) -> DeltaGenerator:
        """Insert a multi-element container.

        Inserts an invisible container into your app that can be used to hold
        multiple elements. This allows you to, for example, insert multiple
        elements into your app out of order.

        To add elements to the returned container, you can use the ``with``
        notation (preferred) or just call commands directly on the returned
        object. See examples below.

        Parameters
        ----------
        border : bool or None
            Whether to show a border around the container. If ``None`` (default), a
            border is shown if the container is set to a fixed height and not
            shown otherwise.

        key : str or None
            An optional string to give this container a stable identity.

            Additionally, if ``key`` is provided, it will be used as CSS
            class name prefixed with ``st-key-``.

        width : "stretch", "content", or int
            The width of the container. This can be one of the following:

            - ``"stretch"`` (default): The width of the container matches the
              width of the parent container.
            - ``"content"``: The width of the container matches the width of
              its content.
            - An integer specifying the width in pixels: The container has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the container matches the width
              of the parent container.

        height : "content", "stretch", or int
            The height of the container. This can be one of the following:

            - ``"content"`` (default): The height of the container matches the
              height of its content.
            - ``"stretch"``: The height of the container matches the height of
              its content or the height of the parent container, whichever is
              larger. If the container is not in a parent container, the height
              of the container matches the height of its content.
            - An integer specifying the height in pixels: The container has a
              fixed height. If the content is larger than the specified
              height, scrolling is enabled.

            .. note::
                Use scrolling containers sparingly. If you use scrolling
                containers, avoid heights that exceed 500 pixels. Otherwise,
                the scroll surface of the container might cover the majority of
                the screen on mobile devices, which makes it hard to scroll the
                rest of the app.

        horizontal : bool
            Whether to use horizontal flexbox layout. If this is ``False``
            (default), the container's elements are laid out vertically. If
            this is ``True``, the container's elements are laid out
            horizontally and will overflow to the next line if they don't fit
            within the container's width.

        horizontal_alignment : "left", "center", "right", or "distribute"
            The horizontal alignment of the elements inside the container. This
            can be one of the following:

            - ``"left"`` (default): Elements are aligned to the left side of
              the container.
            - ``"center"``: Elements are horizontally centered inside the
              container.
            - ``"right"``: Elements are aligned to the right side of the
              container.
            - ``"distribute"``: Elements are distributed evenly in the
              container. This increases the horizontal gap between elements to
              fill the width of the container. A standalone element is aligned
              to the left.

              When ``horizontal`` is ``False``, ``"distribute"`` aligns the
              elements the same as ``"left"``.

        vertical_alignment : "top", "center", "bottom", or "distribute"
            The vertical alignment of the elements inside the container. This
            can be one of the following:

            - ``"top"`` (default): Elements are aligned to the top of the
              container.
            - ``"center"``: Elements are vertically centered inside the
              container.
            - ``"bottom"``: Elements are aligned to the bottom of the
              container.
            - ``"distribute"``: Elements are distributed evenly in the
              container. This increases the vertical gap between elements to
              fill the height of the container. A standalone element is aligned
              to the top.

              When ``horizontal`` is ``True``, ``"distribute"`` aligns the
              elements the same as ``"top"``.

        gap : "small", "medium", "large", or None
            The minimum gap size between the elements inside the container.
            This can be one of the following:

            - ``"small"`` (default): 1rem gap between the elements.
            - ``"medium"``: 2rem gap between the elements.
            - ``"large"``: 4rem gap between the elements.
            - ``None``: No gap between the elements.

            The rem unit is relative to the ``theme.baseFontSize``
            configuration option.

            The minimum gap applies to both the vertical and horizontal gaps
            between the elements. Elements may have larger gaps in one
            direction if you use a distributed horizontal alignment or fixed
            height.

        Examples
        --------
        **Example 1: Inserting elements using ``with`` notation**

        You can use the ``with`` statement to insert any element into a
        container.

        >>> import streamlit as st
        >>>
        >>> with st.container():
        ...     st.write("This is inside the container")
        ...
        ...     # You can call any Streamlit command, including custom components:
        ...     st.bar_chart(np.random.randn(50, 3))
        >>>
        >>> st.write("This is outside the container")

        .. output::
            https://doc-container1.streamlit.app/
            height: 520px

        **Example 2: Inserting elements out of order**

        When you create a container, its position in the app remains fixed and
        you can add elements to it at any time. This allows you to insert
        elements out of order in your app. You can also write to the container
        by calling commands directly on the container object.

        >>> import streamlit as st
        >>>
        >>> container = st.container(border=True)
        >>> container.write("This is inside the container")
        >>> st.write("This is outside the container")
        >>>
        >>> container.write("This is inside too")

        .. output::
            https://doc-container2.streamlit.app/
            height: 300px

        **Example 3: Grid layout with columns and containers**

        You can create a grid with a fixed number of elements per row by using
        columns and containers.

        >>> import streamlit as st
        >>>
        >>> row1 = st.columns(3)
        >>> row2 = st.columns(3)
        >>>
        >>> for col in row1 + row2:
        >>>     tile = col.container(height=120)
        >>>     tile.title(":balloon:")

        .. output::
            https://doc-container3.streamlit.app/
            height: 350px

        **Example 4: Vertically scrolling container**

        You can create a vertically scrolling container by setting a fixed
        height.

        >>> import streamlit as st
        >>>
        >>> long_text = "Lorem ipsum. " * 1000
        >>>
        >>> with st.container(height=300):
        >>>     st.markdown(long_text)

        .. output::
            https://doc-container4.streamlit.app/
            height: 400px

        **Example 5: Horizontal container**

        You can create a row of widgets using a horizontal container. Use
        ``horizontal_alignment`` to specify the alignment of the elements.

        >>> import streamlit as st
        >>>
        >>> flex = st.container(horizontal=True, horizontal_alignment="right")
        >>>
        >>> for card in range(3):
        >>>     flex.button(f"Button {card + 1}")

        .. output::
            https://doc-container5.streamlit.app/
            height: 250px

        """
        key = to_key(key)
        block_proto = BlockProto()
        block_proto.allow_empty = False
        block_proto.flex_container.border = border or False
        block_proto.flex_container.gap_config.gap_size = get_gap_size(
            gap, "st.container"
        )

        validate_horizontal_alignment(horizontal_alignment)
        validate_vertical_alignment(vertical_alignment)
        if horizontal:
            block_proto.flex_container.wrap = True
            block_proto.flex_container.direction = (
                BlockProto.FlexContainer.Direction.HORIZONTAL
            )
            block_proto.flex_container.justify = get_justify(horizontal_alignment)
            block_proto.flex_container.align = get_align(vertical_alignment)
        else:
            block_proto.flex_container.wrap = False
            block_proto.flex_container.direction = (
                BlockProto.FlexContainer.Direction.VERTICAL
            )
            block_proto.flex_container.justify = get_justify(vertical_alignment)
            block_proto.flex_container.align = get_align(horizontal_alignment)

        validate_width(width, allow_content=True)
        block_proto.width_config.CopyFrom(get_width_config(width))

        if isinstance(height, int) or border:
            block_proto.allow_empty = True

        if border is not None:
            block_proto.flex_container.border = border
        elif isinstance(height, int):
            block_proto.flex_container.border = True
        else:
            block_proto.flex_container.border = False

        validate_height(height, allow_content=True)
        block_proto.height_config.CopyFrom(get_height_config(height))

        if key:
            # At the moment, the ID is only used for extracting the
            # key on the frontend and setting it as CSS class.
            # There are plans to use the ID for other container features
            # in the future. This might require including more container
            # parameters in the ID calculation.
            block_proto.id = compute_and_register_element_id(
                "container", user_key=key, dg=None, key_as_main_identity=False
            )

        return self.dg._block(block_proto)

    @gather_metrics("columns")
    def columns(
        self,
        spec: SpecType,
        *,
        gap: Gap | None = "small",
        vertical_alignment: Literal["top", "center", "bottom"] = "top",
        border: bool = False,
        width: WidthWithoutContent = "stretch",
    ) -> list[DeltaGenerator]:
        """Insert containers laid out as side-by-side columns.

        Inserts a number of multi-element containers laid out side-by-side and
        returns a list of container objects.

        To add elements to the returned containers, you can use the ``with`` notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. note::
            To follow best design practices and maintain a good appearance on
            all screen sizes, don't nest columns more than once.

        Parameters
        ----------
        spec : int or Iterable of numbers
            Controls the number and width of columns to insert. Can be one of:

            - An integer that specifies the number of columns. All columns have equal
              width in this case.
            - An Iterable of numbers (int or float) that specify the relative width of
              each column. E.g. ``[0.7, 0.3]`` creates two columns where the first
              one takes up 70% of the available with and the second one takes up 30%.
              Or ``[1, 2, 3]`` creates three columns where the second one is two times
              the width of the first one, and the third one is three times that width.

        gap : "small", "medium", "large", or None
            The size of the gap between the columns. This can be one of the
            following:

            - ``"small"`` (default): 1rem gap between the columns.
            - ``"medium"``: 2rem gap between the columns.
            - ``"large"``: 4rem gap between the columns.
            - ``None``: No gap between the columns.

            The rem unit is relative to the ``theme.baseFontSize``
            configuration option.

        vertical_alignment : "top", "center", or "bottom"
            The vertical alignment of the content inside the columns. The
            default is ``"top"``.

        border : bool
            Whether to show a border around the column containers. If this is
            ``False`` (default), no border is shown. If this is ``True``, a
            border is shown around each column.

        width : "stretch" or int
            The width of the column group. This can be one of the following:

            - ``"stretch"`` (default): The width of the column group matches the
              width of the parent container.
            - An integer specifying the width in pixels: The column group has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the column group matches the
              width of the parent container.

        Returns
        -------
        list of containers
            A list of container objects.

        Examples
        --------
        **Example 1: Use context management**

        You can use the ``with`` statement to insert any element into a column:

        >>> import streamlit as st
        >>>
        >>> col1, col2, col3 = st.columns(3)
        >>>
        >>> with col1:
        ...     st.header("A cat")
        ...     st.image("https://static.streamlit.io/examples/cat.jpg")
        >>>
        >>> with col2:
        ...     st.header("A dog")
        ...     st.image("https://static.streamlit.io/examples/dog.jpg")
        >>>
        >>> with col3:
        ...     st.header("An owl")
        ...     st.image("https://static.streamlit.io/examples/owl.jpg")

        .. output::
            https://doc-columns1.streamlit.app/
            height: 620px


        **Example 2: Use commands as container methods**

        You can just call methods directly on the returned objects:

        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> df = rng(0).standard_normal((10, 1))
        >>> col1, col2 = st.columns([3, 1])
        >>>
        >>> col1.subheader("A wide column with a chart")
        >>> col1.line_chart(df)
        >>>
        >>> col2.subheader("A narrow column with the data")
        >>> col2.write(df)

        .. output::
            https://doc-columns2.streamlit.app/
            height: 550px

        **Example 3: Align widgets**

        Use ``vertical_alignment="bottom"`` to align widgets.

        >>> import streamlit as st
        >>>
        >>> left, middle, right = st.columns(3, vertical_alignment="bottom")
        >>>
        >>> left.text_input("Write something")
        >>> middle.button("Click me", use_container_width=True)
        >>> right.checkbox("Check me")

        .. output::
            https://doc-columns-bottom-widgets.streamlit.app/
            height: 200px

        **Example 4: Use vertical alignment to create grids**

        Adjust vertical alignment to customize your grid layouts.

        >>> import streamlit as st
        >>>
        >>> vertical_alignment = st.selectbox(
        >>>     "Vertical alignment", ["top", "center", "bottom"], index=2
        >>> )
        >>>
        >>> left, middle, right = st.columns(3, vertical_alignment=vertical_alignment)
        >>> left.image("https://static.streamlit.io/examples/cat.jpg")
        >>> middle.image("https://static.streamlit.io/examples/dog.jpg")
        >>> right.image("https://static.streamlit.io/examples/owl.jpg")

        .. output::
            https://doc-columns-vertical-alignment.streamlit.app/
            height: 600px

        **Example 5: Add borders**

        Add borders to your columns instead of nested containers for consistent
        heights.

        >>> import streamlit as st
        >>>
        >>> left, middle, right = st.columns(3, border=True)
        >>>
        >>> left.markdown("Lorem ipsum " * 10)
        >>> middle.markdown("Lorem ipsum " * 5)
        >>> right.markdown("Lorem ipsum ")

        .. output::
            https://doc-columns-borders.streamlit.app/
            height: 250px

        """
        weights = spec
        if isinstance(weights, int):
            # If the user provided a single number, expand into equal weights.
            # E.g. (1,) * 3 => (1, 1, 1)
            # NOTE: A negative/zero spec will expand into an empty tuple.
            weights = (1,) * weights

        if len(weights) == 0 or any(weight <= 0 for weight in weights):
            raise StreamlitInvalidColumnSpecError()

        vertical_alignment_mapping: dict[
            str, BlockProto.Column.VerticalAlignment.ValueType
        ] = {
            "top": BlockProto.Column.VerticalAlignment.TOP,
            "center": BlockProto.Column.VerticalAlignment.CENTER,
            "bottom": BlockProto.Column.VerticalAlignment.BOTTOM,
        }

        if vertical_alignment not in vertical_alignment_mapping:
            raise StreamlitInvalidVerticalAlignmentError(
                vertical_alignment=vertical_alignment,
                element_type="st.columns",
            )

        gap_size = get_gap_size(gap, "st.columns")
        gap_config = GapConfig()
        gap_config.gap_size = gap_size

        def column_proto(normalized_weight: float) -> BlockProto:
            col_proto = BlockProto()
            col_proto.column.weight = normalized_weight
            col_proto.column.gap_config.CopyFrom(gap_config)
            col_proto.column.vertical_alignment = vertical_alignment_mapping[
                vertical_alignment
            ]
            col_proto.column.show_border = border
            col_proto.allow_empty = True
            return col_proto

        block_proto = BlockProto()
        block_proto.flex_container.direction = (
            BlockProto.FlexContainer.Direction.HORIZONTAL
        )
        block_proto.flex_container.wrap = True
        block_proto.flex_container.gap_config.CopyFrom(gap_config)
        block_proto.flex_container.scale = 1
        block_proto.flex_container.align = BlockProto.FlexContainer.Align.STRETCH

        validate_width(width=width)
        block_proto.width_config.CopyFrom(get_width_config(width=width))

        row = self.dg._block(block_proto)
        total_weight = sum(weights)
        return [row._block(column_proto(w / total_weight)) for w in weights]

    @gather_metrics("tabs")
    def tabs(
        self,
        tabs: Sequence[str],
        *,
        width: WidthWithoutContent = "stretch",
        default: str | None = None,
    ) -> Sequence[DeltaGenerator]:
        r"""Insert containers separated into tabs.

        Inserts a number of multi-element containers as tabs.
        Tabs are a navigational element that allows users to easily
        move between groups of related content.

        To add elements to the returned containers, you can use the ``with`` notation
        (preferred) or just call methods directly on the returned object. See
        the examples below.

        .. note::
            All content within every tab is computed and sent to the frontend,
            regardless of which tab is selected. Tabs do not currently support
            conditional rendering. If you have a slow-loading tab, consider
            using a widget like ``st.segmented_control`` to conditionally
            render content instead.

        Parameters
        ----------
        tabs : list of str
            Creates a tab for each string in the list. The first tab is selected
            by default. The string is used as the name of the tab and can
            optionally contain GitHub-flavored Markdown of the following types:
            Bold, Italics, Strikethroughs, Inline Code, Links, and Images.
            Images display like icons, with a max height equal to the font
            height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        width : "stretch" or int
            The width of the tab container. This can be one of the following:

            - ``"stretch"`` (default): The width of the container matches the
              width of the parent container.
            - An integer specifying the width in pixels: The container has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the container matches the width
              of the parent container.

        default : str or None
            The default tab to select. If this is ``None`` (default), the first
            tab is selected. If this is a string, it must be one of the tab
            labels. If two tabs have the same label as ``default``, the first
            one is selected.

        Returns
        -------
        list of containers
            A list of container objects.

        Examples
        --------
        *Example 1: Use context management*

        You can use ``with`` notation to insert any element into a tab:

        >>> import streamlit as st
        >>>
        >>> tab1, tab2, tab3 = st.tabs(["Cat", "Dog", "Owl"])
        >>>
        >>> with tab1:
        ...     st.header("A cat")
        ...     st.image("https://static.streamlit.io/examples/cat.jpg", width=200)
        >>> with tab2:
        ...     st.header("A dog")
        ...     st.image("https://static.streamlit.io/examples/dog.jpg", width=200)
        >>> with tab3:
        ...     st.header("An owl")
        ...     st.image("https://static.streamlit.io/examples/owl.jpg", width=200)

        .. output::
            https://doc-tabs1.streamlit.app/
            height: 620px

        *Example 2: Call methods directly*

        You can call methods directly on the returned objects:

        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> df = rng(0).standard_normal((10, 1))
        >>>
        >>> tab1, tab2 = st.tabs(["📈 Chart", "🗃 Data"])
        >>>
        >>> tab1.subheader("A tab with a chart")
        >>> tab1.line_chart(df)
        >>>
        >>> tab2.subheader("A tab with the data")
        >>> tab2.write(df)

        .. output::
            https://doc-tabs2.streamlit.app/
            height: 700px

        *Example 3: Set the default tab and style the tab labels*

        Use the ``default`` parameter to set the default tab. You can also use
        Markdown in the tab labels.

        >>> import streamlit as st
        >>>
        >>> tab1, tab2, tab3 = st.tabs(
        ...     [":cat: Cat", ":dog: Dog", ":rainbow[Owl]"], default=":rainbow[Owl]"
        ... )
        >>>
        >>> with tab1:
        >>>     st.header("A cat")
        >>>     st.image("https://static.streamlit.io/examples/cat.jpg", width=200)
        >>> with tab2:
        >>>     st.header("A dog")
        >>>     st.image("https://static.streamlit.io/examples/dog.jpg", width=200)
        >>> with tab3:
        >>>     st.header("An owl")
        >>>     st.image("https://static.streamlit.io/examples/owl.jpg", width=200)

        .. output::
            https://doc-tabs3.streamlit.app/
            height: 620px

        """
        if not tabs:
            raise StreamlitAPIException(
                "The input argument to st.tabs must contain at least one tab label."
            )

        if default and default not in tabs:
            raise StreamlitAPIException(
                f"The default tab '{default}' is not in the list of tabs."
            )

        if any(not isinstance(tab, str) for tab in tabs):
            raise StreamlitAPIException(
                "The tabs input list to st.tabs is only allowed to contain strings."
            )

        def tab_proto(label: str) -> BlockProto:
            tab_proto = BlockProto()
            tab_proto.tab.label = label
            tab_proto.allow_empty = True
            return tab_proto

        block_proto = BlockProto()
        block_proto.tab_container.SetInParent()
        validate_width(width)
        block_proto.width_config.CopyFrom(get_width_config(width))

        default_index = tabs.index(default) if default else 0

        block_proto.tab_container.default_tab_index = default_index

        tab_container = self.dg._block(block_proto)

        return tuple(tab_container._block(tab_proto(tab)) for tab in tabs)

    @gather_metrics("expander")
    def expander(
        self,
        label: str,
        expanded: bool = False,
        *,
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        r"""Insert a multi-element container that can be expanded/collapsed.

        Inserts a container into your app that can be used to hold multiple elements
        and can be expanded or collapsed by the user. When collapsed, all that is
        visible is the provided label.

        To add elements to the returned container, you can use the ``with`` notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. note::
            All content within the expander is computed and sent to the
            frontend, even if the expander is closed.

            To follow best design practices and maintain a good appearance on
            all screen sizes, don't nest expanders.

        Parameters
        ----------
        label : str
            A string to use as the header for the expander. The label can optionally
            contain GitHub-flavored Markdown of the following types: Bold, Italics,
            Strikethroughs, Inline Code, Links, and Images. Images display like
            icons, with a max height equal to the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        expanded : bool
            If True, initializes the expander in "expanded" state. Defaults to
            False (collapsed).

        icon : str, None
            An optional emoji or icon to display next to the expander label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            - ``"spinner"``: Displays a spinner as an icon.

        width : "stretch" or int
            The width of the expander container. This can be one of the following:

            - ``"stretch"`` (default): The width of the container matches the
              width of the parent container.
            - An integer specifying the width in pixels: The container has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the container matches the width
              of the parent container.

        Examples
        --------
        You can use the ``with`` notation to insert any element into an expander

        >>> import streamlit as st
        >>>
        >>> st.bar_chart({"data": [1, 5, 2, 6, 2, 1]})
        >>>
        >>> with st.expander("See explanation"):
        ...     st.write('''
        ...         The chart above shows some numbers I picked for you.
        ...         I rolled actual dice for these, so they're *guaranteed* to
        ...         be random.
        ...     ''')
        ...     st.image("https://static.streamlit.io/examples/dice.jpg")

        .. output::
            https://doc-expander.streamlit.app/
            height: 750px

        Or you can just call methods directly on the returned objects:

        >>> import streamlit as st
        >>>
        >>> st.bar_chart({"data": [1, 5, 2, 6, 2, 1]})
        >>>
        >>> expander = st.expander("See explanation")
        >>> expander.write('''
        ...     The chart above shows some numbers I picked for you.
        ...     I rolled actual dice for these, so they're *guaranteed* to
        ...     be random.
        ... ''')
        >>> expander.image("https://static.streamlit.io/examples/dice.jpg")

        .. output::
            https://doc-expander.streamlit.app/
            height: 750px

        """
        if label is None:
            raise StreamlitAPIException("A label is required for an expander")

        expandable_proto = BlockProto.Expandable()
        expandable_proto.expanded = expanded
        expandable_proto.label = label
        if icon is not None:
            expandable_proto.icon = validate_icon_or_emoji(icon)

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.expandable.CopyFrom(expandable_proto)
        validate_width(width)
        block_proto.width_config.CopyFrom(get_width_config(width))

        return self.dg._block(block_proto=block_proto)

    @gather_metrics("popover")
    def popover(
        self,
        label: str,
        *,
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        help: str | None = None,
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool | None = None,
        width: Width = "content",
    ) -> DeltaGenerator:
        r"""Insert a popover container.

        Inserts a multi-element container as a popover. It consists of a button-like
        element and a container that opens when the button is clicked.

        Opening and closing the popover will not trigger a rerun. Interacting
        with widgets inside of an open popover will rerun the app while keeping
        the popover open. Clicking outside of the popover will close it.

        To add elements to the returned container, you can use the "with"
        notation (preferred) or just call methods directly on the returned object.
        See examples below.

        .. note::
            To follow best design practices, don't nest popovers.

        Parameters
        ----------
        label : str
            The label of the button that opens the popover container.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        help : str or None
            A tooltip that gets displayed when the popover button is hovered
            over. If this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        type : "primary", "secondary", or "tertiary"
            An optional string that specifies the button type. This can be one
            of the following:

            - ``"primary"``: The button's background is the app's primary color
              for additional emphasis.
            - ``"secondary"`` (default): The button's background coordinates
              with the app's background color for normal emphasis.
            - ``"tertiary"``: The button is plain text without a border or
              background for subtlety.

        icon : str
            An optional emoji or icon to display next to the button label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            - ``"spinner"``: Displays a spinner as an icon.

        disabled : bool
            An optional boolean that disables the popover button if set to
            ``True``. The default is ``False``.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its content. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the content of the button is wider than the
            parent container, the content will line wrap.

            The popover container's minimum width matches the width of its
            button. The popover container may be wider than its button to fit
            the container's content.

            .. deprecated::
                ``use_container_width`` is deprecated and will be removed in a
                future release. For ``use_container_width=True``, use
                ``width="stretch"``. For ``use_container_width=False``, use
                ``width="content"``.

        width : int, "stretch", or "content"
            The width of the button. This can be one of the following:

            - ``"content"`` (default): The width of the button matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the button matches the width of the
              parent container.
            - An integer specifying the width in pixels: The button has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the button matches the width
              of the parent container.

            The popover container's minimum width matches the width of its
            button. The popover container may be wider than its button to fit
            the container's contents.

        Examples
        --------
        You can use the ``with`` notation to insert any element into a popover:

        >>> import streamlit as st
        >>>
        >>> with st.popover("Open popover"):
        >>>     st.markdown("Hello World 👋")
        >>>     name = st.text_input("What's your name?")
        >>>
        >>> st.write("Your name:", name)

        .. output::
            https://doc-popover.streamlit.app/
            height: 400px

        Or you can just call methods directly on the returned objects:

        >>> import streamlit as st
        >>>
        >>> popover = st.popover("Filter items")
        >>> red = popover.checkbox("Show red items.", True)
        >>> blue = popover.checkbox("Show blue items.", True)
        >>>
        >>> if red:
        ...     st.write(":red[This is a red item.]")
        >>> if blue:
        ...     st.write(":blue[This is a blue item.]")

        .. output::
            https://doc-popover2.streamlit.app/
            height: 400px

        """
        if label is None:
            raise StreamlitAPIException("A label is required for a popover")

        if use_container_width is not None:
            width = "stretch" if use_container_width else "content"

        # Checks whether the entered button type is one of the allowed options
        if type not in ["primary", "secondary", "tertiary"]:
            raise StreamlitAPIException(
                'The type argument to st.popover must be "primary", "secondary", or "tertiary". '
                f'\nThe argument passed was "{type}".'
            )

        popover_proto = BlockProto.Popover()
        popover_proto.label = label
        popover_proto.disabled = disabled
        popover_proto.type = type
        if help:
            popover_proto.help = str(help)
        if icon is not None:
            popover_proto.icon = validate_icon_or_emoji(icon)

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.popover.CopyFrom(popover_proto)

        validate_width(width, allow_content=True)
        block_proto.width_config.CopyFrom(get_width_config(width))

        return self.dg._block(block_proto=block_proto)

    @gather_metrics("status")
    def status(
        self,
        label: str,
        *,
        expanded: bool = False,
        state: Literal["running", "complete", "error"] = "running",
        width: WidthWithoutContent = "stretch",
    ) -> StatusContainer:
        r"""Insert a status container to display output from long-running tasks.

        Inserts a container into your app that is typically used to show the status and
        details of a process or task. The container can hold multiple elements and can
        be expanded or collapsed by the user similar to ``st.expander``.
        When collapsed, all that is visible is the status icon and label.

        The label, state, and expanded state can all be updated by calling ``.update()``
        on the returned object. To add elements to the returned container, you can
        use ``with`` notation (preferred) or just call methods directly on the returned
        object.

        By default, ``st.status()`` initializes in the "running" state. When called using
        ``with`` notation, it automatically updates to the "complete" state at the end
        of the "with" block. See examples below for more details.

        .. note::
            All content within the status container is computed and sent to the
            frontend, even if the status container is closed.

            To follow best design practices and maintain a good appearance on
            all screen sizes, don't nest status containers.

        Parameters
        ----------
        label : str
            The initial label of the status container. The label can optionally
            contain GitHub-flavored Markdown of the following types: Bold, Italics,
            Strikethroughs, Inline Code, Links, and Images. Images display like
            icons, with a max height equal to the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        expanded : bool
            If True, initializes the status container in "expanded" state. Defaults to
            False (collapsed).

        state : "running", "complete", or "error"
            The initial state of the status container which determines which icon is
            shown:

            - ``running`` (default): A spinner icon is shown.
            - ``complete``: A checkmark icon is shown.
            - ``error``: An error icon is shown.

        width : "stretch" or int
            The width of the status container. This can be one of the following:

            - ``"stretch"`` (default): The width of the container matches the
              width of the parent container.
            - An integer specifying the width in pixels: The container has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the container matches the width
              of the parent container.

        Returns
        -------
        StatusContainer
            A mutable status container that can hold multiple elements. The label, state,
            and expanded state can be updated after creation via ``.update()``.

        Examples
        --------
        You can use the ``with`` notation to insert any element into an status container:

        >>> import time
        >>> import streamlit as st
        >>>
        >>> with st.status("Downloading data..."):
        ...     st.write("Searching for data...")
        ...     time.sleep(2)
        ...     st.write("Found URL.")
        ...     time.sleep(1)
        ...     st.write("Downloading data...")
        ...     time.sleep(1)
        >>>
        >>> st.button("Rerun")

        .. output::
            https://doc-status.streamlit.app/
            height: 300px

        You can also use ``.update()`` on the container to change the label, state,
        or expanded state:

        >>> import time
        >>> import streamlit as st
        >>>
        >>> with st.status("Downloading data...", expanded=True) as status:
        ...     st.write("Searching for data...")
        ...     time.sleep(2)
        ...     st.write("Found URL.")
        ...     time.sleep(1)
        ...     st.write("Downloading data...")
        ...     time.sleep(1)
        ...     status.update(
        ...         label="Download complete!", state="complete", expanded=False
        ...     )
        >>>
        >>> st.button("Rerun")

        .. output::
            https://doc-status-update.streamlit.app/
            height: 300px

        """
        return get_dg_singleton_instance().status_container_cls._create(
            self.dg, label, expanded=expanded, state=state, width=width
        )

    def _dialog(
        self,
        title: str,
        *,
        dismissible: bool = True,
        width: Literal["small", "large", "medium"] = "small",
        on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
    ) -> Dialog:
        """Inserts the dialog container.

        Marked as internal because it is used by the dialog_decorator and is not supposed to be used directly.
        The dialog_decorator also has a more descriptive docstring since it is user-facing.
        """
        return get_dg_singleton_instance().dialog_container_cls._create(
            self.dg, title, dismissible=dismissible, width=width, on_dismiss=on_dismiss
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
