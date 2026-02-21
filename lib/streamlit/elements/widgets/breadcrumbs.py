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
    """Serde for breadcrumbs widget with trigger-based behavior.

    Serializes the clicked item index and deserializes back to the item value.
    Returns None when no item has been clicked (initial state or after reset).
    """

    options: Sequence[T]

    def __init__(self, options: Sequence[T]) -> None:
        self.options = options

    def serialize(self, v: T | None) -> str:
        """Serialize clicked item to index string."""
        if v is None:
            return ""
        index = next(
            (i for i, opt in enumerate(self.options) if opt == v),
            None,
        )
        return str(index) if index is not None else ""

    def deserialize(self, ui_value: str | None, _widget_id: str = "") -> T | None:
        """Deserialize index string to item value."""
        if ui_value is None or ui_value == "":
            return None

        try:
            index = int(ui_value)
            if 0 <= index < len(self.options):
                return self.options[index]
        except (ValueError, IndexError):
            pass

        return None


def _default_format_func_for_page(page: StreamlitPage) -> str:
    """Default format function for StreamlitPage objects.

    Returns the page title with icon if available.
    """
    if page.icon:
        return f"{page.icon} {page.title}"
    return page.title


class BreadcrumbsMixin:
    @gather_metrics("breadcrumbs")
    def breadcrumbs(
        self,
        items: Sequence[T],
        *,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        format_func: Callable[[T], str] | None = None,
    ) -> T | None:
        r"""Display a breadcrumbs navigation widget.

        A breadcrumbs widget displays a horizontal navigation path (e.g.,
        Home > Section > Page), helping users understand their location in
        multi-page or nested app flows and quickly jump to higher-level views.

        Clicking an item triggers a rerun and returns the clicked item.
        The last item represents the current page and is not clickable.

        Parameters
        ----------
        items : Sequence[T]
            Items to display in the breadcrumb path, ordered from root to
            current. The last item represents the current page and is not
            clickable. Must contain at least one item.

            Each item can be any type, including strings, dictionaries, or
            ``st.Page`` objects. When using ``st.Page`` objects, the title
            and icon are automatically extracted.

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

        on_click : callable
            An optional callback invoked when an item is clicked.

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

            The output can optionally contain GitHub-flavored Markdown,
            including Material icons (e.g., ``:material/home:``). If the
            formatted string starts with a Material icon or emoji, it will
            be extracted and displayed as an icon.

            For ``st.Page`` objects, the default format function uses the
            page's title and icon.

        Returns
        -------
        T or None
            The clicked item when a breadcrumb is clicked, or ``None`` if no
            item was clicked. The last item (current page) is not clickable
            and cannot be returned.

        Examples
        --------
        **Basic usage:**

        >>> import streamlit as st
        >>>
        >>> clicked = st.breadcrumbs(["Home", "Electronics", "Phones", "iPhone 15"])
        >>>
        >>> if clicked == "Home":
        ...     st.switch_page("home.py")
        >>> elif clicked == "Electronics":
        ...     st.switch_page("electronics.py")
        >>> elif clicked == "Phones":
        ...     st.switch_page("phones.py")
        >>> # "iPhone 15" is current page, not clickable

        **With icons:**

        >>> import streamlit as st
        >>>
        >>> clicked = st.breadcrumbs(
        ...     ["home", "folder", "file"],
        ...     format_func=lambda x: f":material/{x}: {x.title()}",
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
        >>> clicked = st.breadcrumbs(
        ...     pages,
        ...     format_func=lambda p: p["title"],
        ... )
        >>>
        >>> if clicked:
        ...     st.switch_page(clicked["path"])

        **With st.Page objects:**

        >>> import streamlit as st
        >>>
        >>> home = st.Page("home.py", title="Home", icon=":material/home:")
        >>> section = st.Page("section.py", title="Section")
        >>> current = st.Page("current.py", title="Current Page")
        >>>
        >>> clicked = st.breadcrumbs([home, section, current])
        >>>
        >>> if clicked:
        ...     st.switch_page(clicked)  # st.Page works with st.switch_page

        """
        return self._breadcrumbs(
            items=items,
            key=key,
            help=help,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            format_func=format_func,
        )

    def _breadcrumbs(
        self,
        items: Sequence[T],
        *,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        format_func: Callable[[T], str] | None = None,
    ) -> T | None:
        if len(items) == 0:
            raise StreamlitAPIException(
                "The `items` argument to `st.breadcrumbs` must contain at least one item."
            )

        items_list: list[T] = list(items)

        def resolve_format_func(item: T) -> str:
            """Apply user-provided format_func or fall back to defaults."""
            if format_func is not None:
                return format_func(item)
            if isinstance(item, StreamlitPage):
                return _default_format_func_for_page(item)
            return str(item)

        def _transform_item_to_proto(
            item: T,
        ) -> BreadcrumbsProto.BreadcrumbItem:
            """Convert item to proto, extracting icon from formatted string if present."""
            transformed = resolve_format_func(item)
            transformed_parts = transformed.split(" ")
            icon: str | None = None

            if len(transformed_parts) > 0:
                maybe_icon = transformed_parts[0].strip()
                try:
                    if maybe_icon.startswith(":material"):
                        icon = validate_material_icon(maybe_icon)
                    elif is_emoji(maybe_icon):
                        icon = maybe_icon

                    if icon:
                        # Reassemble the string without the icon
                        transformed = " ".join(transformed_parts[1:])
                except StreamlitAPIException:
                    # Not a valid icon, keep as-is
                    pass

            return BreadcrumbsProto.BreadcrumbItem(
                content=transformed,
                content_icon=icon,
            )

        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_click,
            default_value=None,
            writes_allowed=False,
        )

        ctx = get_script_run_ctx()
        form_id = current_form_id(self.dg)

        formatted_items = [_transform_item_to_proto(item) for item in items_list]

        element_id = compute_and_register_element_id(
            "breadcrumbs",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            items=formatted_items,
            help=help,
        )

        proto = BreadcrumbsProto()
        proto.id = element_id
        proto.disabled = disabled
        proto.form_id = form_id

        if help is not None:
            proto.help = help

        proto.items.extend(formatted_items)

        serde = _BreadcrumbsSerde[T](items_list)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        if ctx:
            save_for_app_testing(ctx, element_id, widget_state.value)

        self.dg._enqueue("breadcrumbs", proto)

        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
