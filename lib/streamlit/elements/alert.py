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

from typing import TYPE_CHECKING, cast

from streamlit.elements.lib.layout_utils import validate_width
from streamlit.proto.Alert_pb2 import Alert as AlertProto
from streamlit.proto.WidthConfig_pb2 import WidthConfig
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import (
    clean_text,
    extract_leading_icon,
    validate_icon_or_emoji,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import WidthWithoutContent
    from streamlit.type_util import SupportsStr


def _process_alert_body_and_icon(
    body: SupportsStr, icon: str | None
) -> tuple[str, str]:
    """Process body and icon for alert elements.

    If icon is explicitly provided, validates and returns it with cleaned body.
    If icon is None, attempts to extract a leading emoji or material icon from body.

    Returns a tuple of (cleaned_body, validated_icon).
    """
    cleaned_body = clean_text(body)

    if icon is not None:
        return cleaned_body, validate_icon_or_emoji(icon)

    # Try to extract leading icon from body
    extracted_icon, remaining_body = extract_leading_icon(cleaned_body)
    if extracted_icon:
        return remaining_body, extracted_icon

    return cleaned_body, ""


class AlertMixin:
    @gather_metrics("error")
    def error(
        self,
        body: SupportsStr,
        *,  # keyword-only args:
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        """Display error message.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            If ``icon`` is ``None``, and ``body`` begins with an emoji or
            Material icon shortcode, Streamlit will extract it and display it
            slightly enlarged, as if it were passed to ``icon``. If ``body``
            contains multiple icons, or you want to override this behavior,
            you can insert a null Markdown directive like ``:red[]`` before
            your leading icon.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str or None
            An optional emoji or icon to display next to the alert. If ``icon``
            is ``None`` (default), Streamlit attempts to extract a leading
            emoji or Material icon shortcode from ``body``. If found, the icon
            is displayed and removed from the body text. If no leading icon is
            found, no icon is displayed. If ``icon`` is a string, it takes
            precedence over any icon in the body, and the following options
            are valid:

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
            The width of the alert element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.error('This is an error', icon="🚨")

        """
        alert_proto = AlertProto()

        processed_body, processed_icon = _process_alert_body_and_icon(body, icon)
        alert_proto.icon = processed_icon
        alert_proto.body = processed_body
        alert_proto.format = AlertProto.ERROR

        validate_width(width)

        width_config = WidthConfig()

        if isinstance(width, int):
            width_config.pixel_width = width
        else:
            width_config.use_stretch = True

        alert_proto.width_config.CopyFrom(width_config)

        return self.dg._enqueue("alert", alert_proto)

    @gather_metrics("warning")
    def warning(
        self,
        body: SupportsStr,
        *,  # keyword-only args:
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        """Display warning message.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            If ``icon`` is ``None``, and ``body`` begins with an emoji or
            Material icon shortcode, Streamlit will extract it and display it
            slightly enlarged, as if it were passed to ``icon``. If ``body``
            contains multiple icons, or you want to override this behavior,
            you can insert a null Markdown directive like ``:red[]`` before
            your leading icon.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str or None
            An optional emoji or icon to display next to the alert. If ``icon``
            is ``None`` (default), Streamlit attempts to extract a leading
            emoji or Material icon shortcode from ``body``. If found, the icon
            is displayed and removed from the body text. If no leading icon is
            found, no icon is displayed. If ``icon`` is a string, it takes
            precedence over any icon in the body, and the following options
            are valid:

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
            The width of the warning element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.warning('This is a warning', icon="⚠️")

        """
        alert_proto = AlertProto()
        processed_body, processed_icon = _process_alert_body_and_icon(body, icon)
        alert_proto.body = processed_body
        alert_proto.icon = processed_icon
        alert_proto.format = AlertProto.WARNING

        validate_width(width)

        width_config = WidthConfig()

        if isinstance(width, int):
            width_config.pixel_width = width
        else:
            width_config.use_stretch = True

        alert_proto.width_config.CopyFrom(width_config)

        return self.dg._enqueue("alert", alert_proto)

    @gather_metrics("info")
    def info(
        self,
        body: SupportsStr,
        *,  # keyword-only args:
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        """Display an informational message.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            If ``icon`` is ``None``, and ``body`` begins with an emoji or
            Material icon shortcode, Streamlit will extract it and display it
            slightly enlarged, as if it were passed to ``icon``. If ``body``
            contains multiple icons, or you want to override this behavior,
            you can insert a null Markdown directive like ``:red[]`` before
            your leading icon.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str or None
            An optional emoji or icon to display next to the alert. If ``icon``
            is ``None`` (default), Streamlit attempts to extract a leading
            emoji or Material icon shortcode from ``body``. If found, the icon
            is displayed and removed from the body text. If no leading icon is
            found, no icon is displayed. If ``icon`` is a string, it takes
            precedence over any icon in the body, and the following options
            are valid:

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
            The width of the info element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.info('This is a purely informational message', icon="ℹ️")

        """  # noqa: RUF002

        alert_proto = AlertProto()
        processed_body, processed_icon = _process_alert_body_and_icon(body, icon)
        alert_proto.body = processed_body
        alert_proto.icon = processed_icon
        alert_proto.format = AlertProto.INFO

        validate_width(width)

        width_config = WidthConfig()

        if isinstance(width, int):
            width_config.pixel_width = width
        else:
            width_config.use_stretch = True

        alert_proto.width_config.CopyFrom(width_config)

        return self.dg._enqueue("alert", alert_proto)

    @gather_metrics("success")
    def success(
        self,
        body: SupportsStr,
        *,  # keyword-only args:
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        """Display a success message.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            If ``icon`` is ``None``, and ``body`` begins with an emoji or
            Material icon shortcode, Streamlit will extract it and display it
            slightly enlarged, as if it were passed to ``icon``. If ``body``
            contains multiple icons, or you want to override this behavior,
            you can insert a null Markdown directive like ``:red[]`` before
            your leading icon.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str or None
            An optional emoji or icon to display next to the alert. If ``icon``
            is ``None`` (default), Streamlit attempts to extract a leading
            emoji or Material icon shortcode from ``body``. If found, the icon
            is displayed and removed from the body text. If no leading icon is
            found, no icon is displayed. If ``icon`` is a string, it takes
            precedence over any icon in the body, and the following options
            are valid:

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
            The width of the success element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.success('This is a success message!', icon="✅")

        """
        alert_proto = AlertProto()
        processed_body, processed_icon = _process_alert_body_and_icon(body, icon)
        alert_proto.body = processed_body
        alert_proto.icon = processed_icon
        alert_proto.format = AlertProto.SUCCESS

        validate_width(width)

        width_config = WidthConfig()

        if isinstance(width, int):
            width_config.pixel_width = width
        else:
            width_config.use_stretch = True

        alert_proto.width_config.CopyFrom(width_config)

        return self.dg._enqueue("alert", alert_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
