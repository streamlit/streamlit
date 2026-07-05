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
from typing import TYPE_CHECKING, cast

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import Width, create_layout_config
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Pagination_pb2 import Pagination as PaginationProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    BindOption,
    PersistStateOption,
    get_session_state,
    register_widget,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.scriptrunner_utils.script_run_context import ScriptRunContext
    from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs


@dataclass
class PaginationSerde:
    """Serializer/deserializer for pagination widget values."""

    default: int
    num_pages: int

    def serialize(self, value: int) -> int:
        return value

    def deserialize(self, ui_value: int | None) -> int:
        if ui_value is None:
            return self.default
        # Clamp to valid range if num_pages changed
        if ui_value < 1:
            return self.default
        if ui_value > self.num_pages:
            return self.default
        return ui_value


class PaginationMixin:
    @gather_metrics("pagination")
    def pagination(
        self,
        num_pages: int,
        *,
        default: int = 1,
        max_visible_pages: int | None = 7,
        width: Width = "content",
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> int:
        r"""Display a pagination widget for navigating through pages of content.

        The widget displays numbered page buttons with previous/next arrows and
        intelligent truncation for large page counts. One page is always selected,
        and the widget returns the currently selected page number (1-indexed).

        Parameters
        ----------
        num_pages : int
            Total number of pages. Must be at least 1.

        default : int
            Initial selected page (1-indexed). Must be between 1 and ``num_pages``.
            The default is ``1``.

        max_visible_pages : int or None
            Target number of page buttons to display (excluding prev/next arrows).
            The actual number may be slightly higher in certain edge cases to ensure
            the first and last pages are always visible for navigation context.
            The widget auto-adapts to available width and may show fewer pages to
            prevent wrapping. The default is ``7``.

            - Set to ``None`` to remove the explicit page-count cap (all pages are
              eligible to be shown; responsive auto-adaptation may still hide some).
            - Set to ``0`` to show only prev/next arrows (no page numbers).

        width : "content", "stretch", or int
            The width of the pagination widget. This can be one of the following:

            - ``"content"`` (default): The width of the widget matches the width
              of its content, but doesn't exceed the width of the parent container.
            - ``"stretch"``: The width of the widget matches the width of the
              parent container.
            - An integer specifying the width in pixels: The widget has a fixed
              width. If the specified width is greater than the width of the parent
              container, the width of the widget matches the width of the parent
              container.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget
            behavior <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        on_change : callable
            An optional callback invoked when the selected page changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the pagination widget if set
            to ``True``. The default is ``False``.

        bind : "query-params" or None
            Bind the widget's value to ``st.query_params`` so that the widget's
            value is synced to the URL query string. If this is ``"query-params"``
            (default is ``None``), the widget's value will be read from and
            written to the URL using the ``key`` parameter as the query
            parameter name. This enables shareable URLs that preserve the
            widget's state. If ``bind`` is set, ``key`` is required.

        persist_state : "page", "session", or None
            How long to preserve the widget's value when it isn't rendered.
            If this is ``None`` (default), the value is lost when the widget
            stops being rendered or the user switches pages. If this is
            ``"page"``, the value is preserved only while the user stays on the
            page where the widget is defined (for example, while the widget is
            conditionally hidden); it is discarded on a page switch and is not
            restored if the user returns to the page. If this is ``"session"``,
            the value is preserved for the entire session, including across
            page switches, so it returns when the user navigates back. This
            requires ``key`` to be set. If ``bind="query-params"`` is also set,
            the binding takes precedence: the value is stored in the URL, so it
            persists across page switches regardless of the ``persist_state``
            scope.

        Returns
        -------
        int
            The currently selected page (1-indexed).

        Examples
        --------
        Basic usage with paginated content:

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st

           page = st.pagination(num_pages=10)
           st.write(f"Showing page {page}")

        .. output::
           https://doc-pagination.streamlit.app/
           height: 200px

        Paginated dataframe:

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st
           import pandas as pd

           df = pd.DataFrame({"A": range(100), "B": range(100, 200)})
           rows_per_page = 10
           total_pages = (len(df) + rows_per_page - 1) // rows_per_page

           # Use placeholders to show dataframe above pagination
           dataframe_slot = st.empty()
           with st.container(horizontal_alignment="right"):
               page = st.pagination(num_pages=total_pages)

           start_idx = (page - 1) * rows_per_page
           end_idx = start_idx + rows_per_page
           dataframe_slot.dataframe(df.iloc[start_idx:end_idx])

        .. output::
           https://doc-pagination-dataframe.streamlit.app/
           height: 450px

        """
        ctx = get_script_run_ctx()
        return self._pagination(
            num_pages=num_pages,
            default=default,
            max_visible_pages=max_visible_pages,
            width=width,
            key=key,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            bind=bind,
            persist_state=persist_state,
            ctx=ctx,
        )

    def _pagination(
        self,
        num_pages: int,
        *,
        default: int,
        max_visible_pages: int | None,
        width: Width,
        key: Key | None,
        on_change: WidgetCallback | None,
        args: WidgetArgs | None,
        kwargs: WidgetKwargs | None,
        disabled: bool,
        bind: BindOption,
        persist_state: PersistStateOption,
        ctx: ScriptRunContext | None,
    ) -> int:

        key = to_key(key)

        # Validate num_pages
        if (
            not isinstance(num_pages, int)
            or isinstance(num_pages, bool)
            or num_pages < 1
        ):
            raise StreamlitAPIException(
                f"`num_pages` must be an integer of at least 1. Got {num_pages}."
            )

        # Validate default
        if (
            not isinstance(default, int)
            or isinstance(default, bool)
            or default < 1
            or default > num_pages
        ):
            raise StreamlitAPIException(
                f"`default` must be between 1 and `num_pages` ({num_pages}). "
                f"Got {default}."
            )

        # Validate max_visible_pages
        if max_visible_pages is not None and (
            not isinstance(max_visible_pages, int)
            or isinstance(max_visible_pages, bool)
            or max_visible_pages < 0
        ):
            raise StreamlitAPIException(
                f"`max_visible_pages` must be a non-negative integer or None. "
                f"Got {max_visible_pages}."
            )

        check_widget_policies(self.dg, key, on_change, default_value=default)

        element_id = compute_and_register_element_id(
            "pagination",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            num_pages=num_pages,
            default=default,
            max_visible_pages=max_visible_pages,
            width=width,
        )

        # Build the proto
        proto = PaginationProto()
        proto.id = element_id
        proto.num_pages = num_pages
        proto.default = default
        if max_visible_pages is not None:
            proto.max_visible_pages = max_visible_pages
        proto.disabled = disabled
        proto.form_id = current_form_id(self.dg)

        # Set query param key if bound
        if bind == "query-params" and key is not None:
            proto.query_param_key = str(key)

        serde = PaginationSerde(default=default, num_pages=num_pages)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="int_value",
            bind=bind,
            persist_state=persist_state,
            # Pagination always has a valid page (1 to num_pages), never empty
            clearable=False,
        )

        current_value = widget_state.value

        # Guard against invalid session_state-controlled values that can bypass
        # PaginationSerde.deserialize via register_widget.
        is_valid_current_value = (
            isinstance(current_value, int)
            and not isinstance(current_value, bool)
            and 1 <= current_value <= num_pages
        )
        if not is_valid_current_value:
            current_value = default
            if key is not None:
                get_session_state().reset_state_value(key, current_value)

        if widget_state.value_changed or current_value != widget_state.value:
            proto.value = current_value
            proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, None)

        layout_config = create_layout_config(width=width, allow_content_width=True)

        # has_one_shot_effect ensures the frontend processes the setValue when
        # the value is changed programmatically (e.g., via session_state)
        value_changed = (
            widget_state.value_changed or current_value != widget_state.value
        )

        self.dg._enqueue(
            "pagination",
            proto,
            layout_config=layout_config,
            has_one_shot_effect=value_changed,
        )

        return current_value

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
