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

from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg as ForwardProto
from streamlit.proto.NewSession_pb2 import CustomThemeConfig
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx


@gather_metrics("set_theme")
def set_theme(
    *,
    base: str | None = None,
    primary_color: str | None = None,
    background_color: str | None = None,
    secondary_background_color: str | None = None,
    text_color: str | None = None,
) -> None:
    """
    Update the app's theme at runtime for the current user session.

    This allows dynamic, per-session theming without restarting the app.
    Only parameters explicitly provided in a call are sent to the frontend;
    unspecified parameters are completed from the base theme defaults, which
    may reset any previous overrides for those fields.

    Parameters
    ----------
    base : "light", "dark", or None
        The base theme to use. If ``None`` (default), the base theme is not
        changed.

    primary_color : str or None
        The accent color used for interactive elements like buttons, sliders,
        and links. Should be a valid CSS color string (e.g., ``"#FF4B4B"``).

    background_color : str or None
        The main background color of the app. Should be a valid CSS color
        string.

    secondary_background_color : str or None
        The background color used for secondary content areas like the
        sidebar and some containers. Should be a valid CSS color string.

    text_color : str or None
        The default text color. Should be a valid CSS color string.

    Example
    -------
    >>> import streamlit as st
    >>>
    >>> st.set_theme(
    ...     base="light",
    ...     primary_color="#FF4B4B",
    ...     background_color="#FFFFFF",
    ...     secondary_background_color="#F0F2F6",
    ...     text_color="#31333F",
    ... )
    """
    # Validate base early, before checking if we have any params to send.
    base_map = {
        "light": CustomThemeConfig.BaseTheme.LIGHT,
        "dark": CustomThemeConfig.BaseTheme.DARK,
    }
    if base is not None and base not in base_map:
        raise StreamlitAPIException(
            f'"{base}" is an invalid value for base. '
            f"Allowed values are {list(base_map.keys())}."
        )

    # Return early if no params are provided to avoid enqueuing an empty
    # ForwardMsg with no type set, which would break the frontend dispatcher.
    if all(
        p is None
        for p in [base, primary_color, background_color,
                  secondary_background_color, text_color]
    ):
        return

    msg = ForwardProto()
    theme_msg = msg.theme_changed

    if base is not None:
        theme_msg.base = base_map[base]

    if primary_color is not None:
        theme_msg.primary_color = primary_color

    if background_color is not None:
        theme_msg.background_color = background_color

    if secondary_background_color is not None:
        theme_msg.secondary_background_color = secondary_background_color

    if text_color is not None:
        theme_msg.text_color = text_color

    ctx = get_script_run_ctx()
    if ctx is None:
        return
    ctx.enqueue(msg)
