# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, Literal, Sequence, Union, cast

from typing_extensions import TypeAlias

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.dialog import Dialog
    from streamlit.elements.lib.mutable_status_container import StatusContainer

SpecType: TypeAlias = Union[int, Sequence[Union[int, float]]]


class LayoutsMixin:
    @gather_metrics("container")
    def container(
        self, *, height: int | None = None, border: bool | None = None
    ) -> DeltaGenerator:
        """Insert a multi-element container.

        Inserts an invisible container into your app that can be used to hold
        multiple elements. This allows you to, for example, insert multiple
        elements into your app out of order.

        To add elements to the returned container, you can use the ``with`` notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        Parameters
        ----------
        height : int or None
            Desired height of the container expressed in pixels. If ``None`` (default)
            the container grows to fit its content. If a fixed height, scrolling is
            enabled for large content and a grey border is shown around the container
            to visually separate its scroll surface from the rest of the app.

            .. note::
                Use containers with scroll sparingly. If you do, try to keep
                the height small (below 500 pixels). Otherwise, the scroll
                surface of the container might cover the majority of the screen
                on mobile devices, which makes it hard to scroll the rest of the app.

        border : bool or None
            Whether to show a border around the container. If ``None`` (default), a
            border is shown if the container is set to a fixed height and not
            shown otherwise.


        Examples
        --------
        Inserting elements using ``with`` notation:

        >>> import streamlit as st
        >>>
        >>> with st.container():
        ...    st.write("This is inside the container")
        ...
        ...    # You can call any Streamlit command, including custom components:
        ...    st.bar_chart(np.random.randn(50, 3))
        ...
        >>> st.write("This is outside the container")

        .. output ::
            https://doc-container1.streamlit.app/
            height: 520px

        Inserting elements out of order:

        >>> import streamlit as st
        >>>
        >>> container = st.container(border=True)
        >>> container.write("This is inside the container")
        >>> st.write("This is outside the container")
        >>>
        >>> # Now insert some more in the container
        >>> container.write("This is inside too")

        .. output ::
            https://doc-container2.streamlit.app/
            height: 300px

        Using ``height`` to make a grid:

        >>> import streamlit as st
        >>>
        >>> row1 = st.columns(3)
        >>> row2 = st.columns(3)
        >>>
        >>> for col in row1 + row2:
        >>>     tile = col.container(height=120)
        >>>     tile.title(":balloon:")

        .. output ::
            https://doc-container3.streamlit.app/
            height: 350px

        Using ``height`` to create a scrolling container for long content:

        >>> import streamlit as st
        >>>
        >>> long_text = "Lorem ipsum. " * 1000
        >>>
        >>> with st.container(height=300):
        >>>     st.markdown(long_text)

        .. output ::
            https://doc-container4.streamlit.app/
            height: 400px

        """
        block_proto = BlockProto()
        block_proto.allow_empty = False
        block_proto.vertical.border = border or False
        if height:
            # Activate scrolling container behavior:
            block_proto.allow_empty = True
            block_proto.vertical.height = height
            if border is None:
                # If border is None, we activated the
                # border as default setting for scrolling
                # containers.
                block_proto.vertical.border = True

        return self.dg._block(block_proto)

    @gather_metrics("columns")
    def columns(
        self, spec: SpecType, *, gap: str | None = "small"
    ) -> list[DeltaGenerator]:
        """Insert containers laid out as side-by-side columns.

        Inserts a number of multi-element containers laid out side-by-side and
        returns a list of container objects.

        To add elements to the returned containers, you can use the ``with`` notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        Columns can only be placed inside other columns up to one level of nesting.

        .. warning::
            Columns cannot be placed inside other columns in the sidebar. This is only possible in the main area of the app.

        Parameters
        ----------
        spec : int or Iterable of numbers
            Controls the number and width of columns to insert. Can be one of:

            * An integer that specifies the number of columns. All columns have equal
              width in this case.
            * An Iterable of numbers (int or float) that specify the relative width of
              each column. E.g. ``[0.7, 0.3]`` creates two columns where the first
              one takes up 70% of the available with and the second one takes up 30%.
              Or ``[1, 2, 3]`` creates three columns where the second one is two times
              the width of the first one, and the third one is three times that width.

        gap : "small", "medium", or "large"
            The size of the gap between the columns. Defaults to "small".

        Returns
        -------
        list of containers
            A list of container objects.

        Examples
        --------
        You can use the ``with`` notation to insert any element into a column:

        >>> import streamlit as st
        >>>
        >>> col1, col2, col3 = st.columns(3)
        >>>
        >>> with col1:
        ...    st.header("A cat")
        ...    st.image("https://static.streamlit.io/examples/cat.jpg")
        ...
        >>> with col2:
        ...    st.header("A dog")
        ...    st.image("https://static.streamlit.io/examples/dog.jpg")
        ...
        >>> with col3:
        ...    st.header("An owl")
        ...    st.image("https://static.streamlit.io/examples/owl.jpg")

        .. output ::
            https://doc-columns1.streamlit.app/
            height: 620px

        Or you can just call methods directly on the returned objects:

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> col1, col2 = st.columns([3, 1])
        >>> data = np.random.randn(10, 1)
        >>>
        >>> col1.subheader("A wide column with a chart")
        >>> col1.line_chart(data)
        >>>
        >>> col2.subheader("A narrow column with the data")
        >>> col2.write(data)

        .. output ::
            https://doc-columns2.streamlit.app/
            height: 550px

        """
        weights = spec
        weights_exception = StreamlitAPIException(
            "The input argument to st.columns must be either a "
            + "positive integer or a list of positive numeric weights. "
            + "See [documentation](https://docs.streamlit.io/library/api-reference/layout/st.columns) "
            + "for more information."
        )

        if isinstance(weights, int):
            # If the user provided a single number, expand into equal weights.
            # E.g. (1,) * 3 => (1, 1, 1)
            # NOTE: A negative/zero spec will expand into an empty tuple.
            weights = (1,) * weights

        if len(weights) == 0 or any(weight <= 0 for weight in weights):
            raise weights_exception

        def column_gap(gap):
            if type(gap) == str:
                gap_size = gap.lower()
                valid_sizes = ["small", "medium", "large"]

                if gap_size in valid_sizes:
                    return gap_size

            raise StreamlitAPIException(
                'The gap argument to st.columns must be "small", "medium", or "large". \n'
                f"The argument passed was {gap}."
            )

        gap_size = column_gap(gap)

        def column_proto(normalized_weight: float) -> BlockProto:
            col_proto = BlockProto()
            col_proto.column.weight = normalized_weight
            col_proto.column.gap = gap_size
            col_proto.allow_empty = True
            return col_proto

        block_proto = BlockProto()
        block_proto.horizontal.gap = gap_size
        row = self.dg._block(block_proto)
        total_weight = sum(weights)
        return [row._block(column_proto(w / total_weight)) for w in weights]

    @gather_metrics("tabs")
    def tabs(self, tabs: Sequence[str]) -> Sequence[DeltaGenerator]:
        r"""Insert containers separated into tabs.

        Inserts a number of multi-element containers as tabs.
        Tabs are a navigational element that allows users to easily
        move between groups of related content.

        To add elements to the returned containers, you can use the ``with`` notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. warning::
            All the content of every tab is always sent to and rendered on the frontend.
            Conditional rendering is currently not supported.

        Parameters
        ----------
        tabs : list of str
            Creates a tab for each string in the list. The first tab is selected by default.
            The string is used as the name of the tab and can optionally contain Markdown,
            supporting the following elements: Bold, Italics, Strikethroughs, Inline Code,
            Emojis, and Links.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents) render.
            Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

        Returns
        -------
        list of containers
            A list of container objects.

        Examples
        --------
        You can use the ``with`` notation to insert any element into a tab:

        >>> import streamlit as st
        >>>
        >>> tab1, tab2, tab3 = st.tabs(["Cat", "Dog", "Owl"])
        >>>
        >>> with tab1:
        ...    st.header("A cat")
        ...    st.image("https://static.streamlit.io/examples/cat.jpg", width=200)
        ...
        >>> with tab2:
        ...    st.header("A dog")
        ...    st.image("https://static.streamlit.io/examples/dog.jpg", width=200)
        ...
        >>> with tab3:
        ...    st.header("An owl")
        ...    st.image("https://static.streamlit.io/examples/owl.jpg", width=200)

        .. output ::
            https://doc-tabs1.streamlit.app/
            height: 620px

        Or you can just call methods directly on the returned objects:

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> tab1, tab2 = st.tabs(["📈 Chart", "🗃 Data"])
        >>> data = np.random.randn(10, 1)
        >>>
        >>> tab1.subheader("A tab with a chart")
        >>> tab1.line_chart(data)
        >>>
        >>> tab2.subheader("A tab with the data")
        >>> tab2.write(data)


        .. output ::
            https://doc-tabs2.streamlit.app/
            height: 700px

        """
        if not tabs:
            raise StreamlitAPIException(
                "The input argument to st.tabs must contain at least one tab label."
            )

        if any(isinstance(tab, str) == False for tab in tabs):
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
        tab_container = self.dg._block(block_proto)
        return tuple(tab_container._block(tab_proto(tab_label)) for tab_label in tabs)

    @gather_metrics("expander")
    def expander(self, label: str, expanded: bool = False) -> DeltaGenerator:
        r"""Insert a multi-element container that can be expanded/collapsed.

        Inserts a container into your app that can be used to hold multiple elements
        and can be expanded or collapsed by the user. When collapsed, all that is
        visible is the provided label.

        To add elements to the returned container, you can use the ``with`` notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. warning::
            Currently, you may not put expanders inside another expander.

        Parameters
        ----------
        label : str
            A string to use as the header for the expander. The label can optionally
            contain Markdown and supports the following elements: Bold, Italics,
            Strikethroughs, Inline Code, Emojis, and Links.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents) render.
            Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.
        expanded : bool
            If True, initializes the expander in "expanded" state. Defaults to
            False (collapsed).

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

        .. output ::
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

        .. output ::
            https://doc-expander.streamlit.app/
            height: 750px

        """
        if label is None:
            raise StreamlitAPIException("A label is required for an expander")

        expandable_proto = BlockProto.Expandable()
        expandable_proto.expanded = expanded
        expandable_proto.label = label

        block_proto = BlockProto()
        block_proto.allow_empty = False
        block_proto.expandable.CopyFrom(expandable_proto)

        return self.dg._block(block_proto=block_proto)

    @gather_metrics("popover")
    def popover(
        self,
        label: str,
        *,
        help: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
    ) -> "DeltaGenerator":
        r"""Insert a popover container.

        Inserts a multi-element container as a popover. It consists of a button-like
        element and a container that opens when the button is clicked.

        Opening and closing the popover will not trigger a rerun. Interacting
        with widgets inside of an open popover will rerun the app while keeping
        the popover open. Clicking outside of the popover will close it.

        To add elements to the returned container, you can use the "with"
        notation (preferred) or just call methods directly on the returned object.
        See examples below.

        .. warning::
            You may not put a popover inside another popover.

        Parameters
        ----------
        label : str
            The label of the button that opens the popover container.
            The label can optionally contain Markdown and supports the
            following elements: Bold, Italics, Strikethroughs, Inline Code,
            Emojis, and Links.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
                For a list of all supported codes,
                see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
                must be on their own lines). Supported LaTeX functions are listed
                at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents) render.
            Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

        help : str
            An optional tooltip that gets displayed when the popover button is
            hovered over.

        disabled : bool
            An optional boolean, which disables the popover button if set to
            True. The default is False.

        use_container_width : bool
            An optional boolean, which makes the popover button stretch its width
            to match the parent container. This only affects the button and not
            the width of the popover container.

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

        .. output ::
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

        .. output ::
            https://doc-popover2.streamlit.app/
            height: 400px
        """
        if label is None:
            raise StreamlitAPIException("A label is required for a popover")

        popover_proto = BlockProto.Popover()
        popover_proto.label = label
        popover_proto.use_container_width = use_container_width
        popover_proto.disabled = disabled
        if help:
            popover_proto.help = str(help)

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.popover.CopyFrom(popover_proto)

        return self.dg._block(block_proto=block_proto)

    @gather_metrics("status")
    def status(
        self,
        label: str,
        *,
        expanded: bool = False,
        state: Literal["running", "complete", "error"] = "running",
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

        Parameters
        ----------

        label : str
            The initial label of the status container. The label can optionally
            contain Markdown and supports the following elements: Bold,
            Italics, Strikethroughs, Inline Code, Emojis, and Links.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents)
            render. Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

        expanded : bool
            If True, initializes the status container in "expanded" state. Defaults to
            False (collapsed).

        state : "running", "complete", or "error"
            The initial state of the status container which determines which icon is
            shown:

            * ``running`` (default): A spinner icon is shown.

            * ``complete``: A checkmark icon is shown.

            * ``error``: An error icon is shown.

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

        .. output ::
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
        ...     status.update(label="Download complete!", state="complete", expanded=False)
        >>>
        >>> st.button("Rerun")

        .. output ::
            https://doc-status-update.streamlit.app/
            height: 300px

        """
        # We need to import StatusContainer here to avoid a circular import
        from streamlit.elements.lib.mutable_status_container import StatusContainer

        return StatusContainer._create(
            self.dg, label=label, expanded=expanded, state=state
        )

    def _dialog(
        self,
        title: str,
        *,
        dismissible: bool = True,
        width: Literal["small", "large"] = "small",
    ) -> "Dialog":
        """Inserts the dialog container.

        Marked as internal because it is used by the dialog_decorator and is not supposed to be used directly.
        The dialog_decorator also has a more descriptive docstring since it is user-facing.
        """

        # We need to import Dialog here to avoid a circular import
        from streamlit.elements.lib.dialog import Dialog

        return Dialog._create(self.dg, title, dismissible=dismissible, width=width)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
