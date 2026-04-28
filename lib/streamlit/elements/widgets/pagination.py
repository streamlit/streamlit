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
from streamlit.elements.lib.layout_utils import (
    Width,
    create_layout_config,
)
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Pagination_pb2 import Pagination as PaginationProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import get_session_state, register_widget

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )


@dataclass
class PaginationSerde:
    """Serializer/deserializer for pagination values."""

    default: int
    num_pages: int

    def serialize(self, value: int) -> int:
        return int(value)

    def deserialize(self, ui_value: int | None) -> int:
        if ui_value is None:
            return self.default

        value = int(ui_value)
        if value < 1 or value > self.num_pages:
            return self.default

        return value


def _validate_positive_int(name: str, value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise StreamlitAPIException(f"`{name}` must be an integer greater than 0.")


class PaginationMixin:
    @gather_metrics("pagination")
    def pagination(
        self,
        num_pages: int,
        *,
        default: int = 1,
        key: Key | None = None,
        max_visible_pages: int | None = 7,
        width: Width = "content",
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
    ) -> int:
        """Display a pagination widget.

        A pagination widget displays page-number buttons with previous and next
        arrows. It is commonly used to navigate through large datasets, search
        results, or multi-step content.

        Parameters
        ----------
        num_pages : int
            Total number of pages. This must be at least ``1``.
        default : int
            The page selected when the widget first renders. The default is
            ``1``. This must be between ``1`` and ``num_pages``, inclusive.
        key : str, int, or None
            An optional string or integer to use as the unique key for the
            widget. If this is ``None`` (default), a key will be generated for
            the widget based on the values of the other parameters.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget behavior
            <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a CSS
            class name prefixed with ``st-key-``.
        max_visible_pages : int or None
            Maximum number of page buttons to display, excluding previous and
            next arrows. The default is ``7``. If this is ``None``, all pages
            are eligible to be shown before responsive width reduction is
            applied. If this is ``0``, only the previous and next arrows are
            shown.
        width : "content", "stretch", or int
            The width of the pagination widget. This can be one of the
            following:

            - ``"content"`` (default): The width of the widget matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the widget matches the width of the
              parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.
        on_change : callable
            An optional callback invoked when this pagination widget's value
            changes.
        args : list or tuple
            An optional list or tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        disabled : bool
            An optional boolean that disables the pagination widget if set to
            ``True``. The default is ``False``.

        Returns
        -------
        int
            The currently selected page number, using 1-based indexing.

        Examples
        --------
        Display a pagination widget and show content for the selected page:

        >>> import streamlit as st
        >>>
        >>> page = st.pagination(num_pages=10)
        >>> st.write(f"Showing page {page}")

        .. output::
           https://doc-pagination-basic.streamlit.app/
           height: 200px

        """
        _validate_positive_int("num_pages", num_pages)
        _validate_positive_int("default", default)

        if default > num_pages:
            raise StreamlitAPIException(
                "`default` must be between 1 and `num_pages`, inclusive."
            )

        if max_visible_pages is not None and (
            not isinstance(max_visible_pages, int)
            or isinstance(max_visible_pages, bool)
            or max_visible_pages < 0
        ):
            raise StreamlitAPIException(
                "`max_visible_pages` must be a non-negative integer or None."
            )

        key = to_key(key)
        layout_config = create_layout_config(width=width, allow_content_width=True)

        check_widget_policies(self.dg, key, on_change, default_value=default)

        ctx = get_script_run_ctx()
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

        proto = PaginationProto()
        proto.id = element_id
        proto.num_pages = num_pages
        proto.default = default
        proto.disabled = disabled
        proto.form_id = current_form_id(self.dg)
        if max_visible_pages is not None:
            proto.max_visible_pages = max_visible_pages

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
        )

        current_value = widget_state.value
        value_needs_reset = current_value > num_pages
        if value_needs_reset:
            current_value = default
            if key is not None:
                get_session_state().reset_state_value(key, current_value)

        if value_needs_reset or widget_state.value_changed:
            proto.value = current_value
            proto.set_value = True

        self.dg._enqueue("pagination", proto, layout_config=layout_config)
        return current_value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
