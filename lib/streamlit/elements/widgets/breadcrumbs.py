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

from typing import (
    TYPE_CHECKING,
    Generic,
    TypeVar,
    cast,
)

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.navigation.page import StreamlitPage
from streamlit.proto.Breadcrumbs_pb2 import Breadcrumbs as BreadcrumbsProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import register_widget
from streamlit.string_util import is_emoji, validate_material_icon

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )

T = TypeVar("T")


class _BreadcrumbsSerde(Generic[T]):
    """Serde for breadcrumbs widget with stateful selection behavior.

    Serializes the selected item index and deserializes back to the item value.
    Always returns a valid selection (defaults to last item if none specified).
    """

    options: Sequence[T]
    default_index: int

    def __init__(self, options: Sequence[T], default_index: int) -> None:
        self.options = options
        self.default_index = default_index

    def serialize(self, v: T | None) -> int:
        """Serialize selected item to index for int_value."""
        if v is None:
            return self.default_index
        return next(
            (i for i, opt in enumerate(self.options) if opt == v),
            self.default_index,
        )

    def deserialize(self, ui_value: int | None, _widget_id: str = "") -> T:
        """Deserialize int_value to selected item.

        Returns the item at the given index, or the default item if invalid.
        """
        if ui_value is None:
            return self.options[self.default_index]

        if 0 <= ui_value < len(self.options):
            return self.options[ui_value]

        # Fall back to default if index is out of range
        return self.options[self.default_index]


def _default_format_func_for_page(page: StreamlitPage) -> str:
    """Return the page title with icon if available."""
    if page.icon:
        return f"{page.icon} {page.title}"
    return page.title


def _extract_icon_from_text(text: str) -> tuple[str, str | None]:
    """Extract leading icon (material or emoji) from text.

    Returns a tuple of (remaining_text, icon_or_none).
    """
    parts = text.split(" ")
    if not parts:
        return text, None

    maybe_icon = parts[0].strip()
    try:
        if maybe_icon.startswith(":material"):
            icon = validate_material_icon(maybe_icon)
            return " ".join(parts[1:]), icon
        if is_emoji(maybe_icon):
            return " ".join(parts[1:]), maybe_icon
    except StreamlitAPIException:
        # Invalid icon format - treat as regular text without icon extraction
        pass

    return text, None


class BreadcrumbsMixin:
    @gather_metrics("breadcrumbs")
    def breadcrumbs(
        self,
        items: Sequence[T],
        *,
        selection: T | int | None = None,
        separator: str = "/",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        format_func: Callable[[T], str] | None = None,
    ) -> T:
        r"""Display a breadcrumbs navigation widget.

        A breadcrumbs widget displays a horizontal navigation path (e.g.,
        Home > Section > Page), helping users understand their location in
        multi-page or nested app flows and quickly jump to higher-level views.

        The widget maintains a stateful selection. Clicking an item updates
        the selection, triggers a rerun, and returns the newly selected item.
        The selected item is visually highlighted and displayed as
        non-clickable text.

        Parameters
        ----------
        items : Sequence[T]
            Items to display in the breadcrumb path, ordered from root to
            current. Must contain at least one item.

            Each item can be any type, including strings, dictionaries, or
            ``st.Page`` objects. When using ``st.Page`` objects, the title
            and icon are automatically extracted.

        selection : T, int, or None
            The item to select initially. Can be specified as an item value
            from ``items`` or as an integer index. If ``None`` (default),
            the last item is selected (representing the current page).

        separator : str
            Separator displayed between items. Defaults to ``"/"``.
            Supports plain text or Material icons (e.g.,
            ``:material/chevron_right:``).

        key : str or int
            An optional string or integer to use as the unique key for the
            widget. If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may not
            share the same key.

        help : str or None
            A tooltip that gets displayed when hovering over the widget.
            If this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when the selection changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the widget if set to ``True``.
            When disabled, all items appear as plain text and are not
            clickable. The default is ``False``.

        format_func : function
            Function to modify the display of the items. It receives
            the raw item as an argument and should output the label to be
            shown for that item. This has no impact on the return value of
            the command.

            The output is treated as plain text. If the formatted string
            starts with a Material icon shortcode (e.g., ``:material/home:``)
            or an emoji, that leading icon will be extracted and displayed as
            the breadcrumb icon. Any remaining text is rendered without
            Markdown formatting.

            For ``st.Page`` objects, the default format function uses the
            page's title and icon.

        Returns
        -------
        T
            The currently selected item. Initially this is the item specified
            by ``selection`` (or the last item by default). After clicking
            a breadcrumb item, this returns that item.

        Examples
        --------
        **Basic usage:**

        >>> import streamlit as st
        >>>
        >>> selected = st.breadcrumbs(["Home", "Electronics", "Phones", "iPhone 15"])
        >>>
        >>> if selected == "Home":
        ...     st.switch_page("home.py")
        >>> elif selected == "Electronics":
        ...     st.switch_page("electronics.py")
        >>> elif selected == "Phones":
        ...     st.switch_page("phones.py")
        >>> # "iPhone 15" is selected by default (last item)

        **With icons:**

        >>> import streamlit as st
        >>>
        >>> selected = st.breadcrumbs(
        ...     ["home", "folder", "file"],
        ...     format_func=lambda x: f":material/{x}: {x.title()}",
        ... )

        **With custom separator:**

        >>> import streamlit as st
        >>>
        >>> # Using a text separator
        >>> selected = st.breadcrumbs(["Home", "Section", "Page"], separator=" > ")
        >>>
        >>> # Using a material icon as separator
        >>> selected = st.breadcrumbs(
        ...     ["Home", "Section", "Page"],
        ...     separator=":material/chevron_right:",
        ... )

        **With custom objects:**

        >>> import streamlit as st
        >>>
        >>> pages = [
        ...     {"id": "home", "title": "Home", "path": "home.py"},
        ...     {"id": "users", "title": "Users", "path": "users.py"},
        ...     {"id": "detail", "title": "User Detail", "path": "detail.py"},
        ... ]
        >>>
        >>> selected = st.breadcrumbs(
        ...     pages,
        ...     format_func=lambda p: p["title"],
        ... )
        >>>
        >>> if selected != pages[-1]:  # Not on the last page
        ...     st.switch_page(selected["path"])

        **With st.Page objects:**

        >>> import streamlit as st
        >>>
        >>> home = st.Page("home.py", title="Home", icon=":material/home:")
        >>> section = st.Page("section.py", title="Section")
        >>> current = st.Page("current.py", title="Current Page")
        >>>
        >>> selected = st.breadcrumbs([home, section, current])
        >>>
        >>> if selected != current:
        ...     st.switch_page(selected)  # st.Page works with st.switch_page

        """
        return self._breadcrumbs(
            items=items,
            selection=selection,
            separator=separator,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            format_func=format_func,
        )

    def _breadcrumbs(
        self,
        items: Sequence[T],
        *,
        selection: T | int | None = None,
        separator: str = "/",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        format_func: Callable[[T], str] | None = None,
    ) -> T:
        if not items:
            raise StreamlitAPIException(
                "The `items` argument to `st.breadcrumbs` must contain at least one item."
            )

        items_list = list(items)

        # Determine the default selection index
        if selection is None:
            # Default to last item (current page)
            default_index = len(items_list) - 1
        elif isinstance(selection, int):
            # Selection is an index
            if not (0 <= selection < len(items_list)):
                raise StreamlitAPIException(
                    f"The `selection` index {selection} is out of range. "
                    f"Valid indices are 0 to {len(items_list) - 1}."
                )
            default_index = selection
        else:
            # Selection is an item value - find its index
            try:
                default_index = items_list.index(selection)
            except ValueError:
                raise StreamlitAPIException(
                    f"The `selection` value {selection!r} is not in `items`. "
                    "Please provide a valid item from the `items` sequence."
                )

        def _format_item(item: T) -> str:
            """Apply format_func or use default formatting."""
            if format_func is not None:
                return format_func(item)
            if isinstance(item, StreamlitPage):
                return _default_format_func_for_page(item)
            return str(item)

        def _item_to_proto(item: T, index: int) -> BreadcrumbsProto.BreadcrumbItem:
            """Convert item to proto, extracting icon if present."""
            formatted = _format_item(item)
            content, icon = _extract_icon_from_text(formatted)
            # Validate that content is non-empty after icon extraction
            stripped_content = content.strip()
            if not stripped_content:
                raise StreamlitAPIException(
                    f"Item at index {index} in `st.breadcrumbs` must contain text in "
                    "addition to any leading icon. Icon-only labels are not supported "
                    "because they would create inaccessible buttons without visible text."
                )
            return BreadcrumbsProto.BreadcrumbItem(
                content=stripped_content,
                content_icon=icon,
            )

        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None,
            writes_allowed=False,
        )

        ctx = get_script_run_ctx()
        form_id = current_form_id(self.dg)

        formatted_items = [
            _item_to_proto(item, index) for index, item in enumerate(items_list)
        ]

        element_id = compute_and_register_element_id(
            "breadcrumbs",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            items=formatted_items,
            help=help,
            separator=separator,
        )

        proto = BreadcrumbsProto()
        proto.id = element_id
        proto.disabled = disabled
        proto.form_id = form_id
        proto.separator = separator

        if help is not None:
            proto.help = help

        proto.items.extend(formatted_items)

        serde = _BreadcrumbsSerde[T](items_list, default_index)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="int_value",
        )

        # Send current selection index to frontend for styling
        proto.value = str(serde.serialize(widget_state.value))

        if ctx:
            save_for_app_testing(ctx, element_id, widget_state.value)

        self.dg._enqueue("breadcrumbs", proto)

        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
