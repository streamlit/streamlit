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

"""Handle App logos."""

from __future__ import annotations

from typing import Literal

from streamlit import url_util
from streamlit.elements.lib.image_utils import AtomicImage, image_to_url
from streamlit.elements.lib.layout_utils import LayoutConfig
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx


def _invalid_logo_text(field_name: str) -> str:
    return (
        f"The {field_name} passed to st.logo is invalid - See "
        "[documentation](https://docs.streamlit.io/develop/api-reference/media/st.logo) "
        "for more information on valid types"
    )


@gather_metrics("logo")
def logo(
    image: AtomicImage,
    *,  # keyword-only args:
    size: Literal["small", "medium", "large"] = "medium",
    link: str | None = None,
    icon_image: AtomicImage | None = None,
) -> None:
    r"""
    Renders a logo in the upper-left corner of your app and its sidebar.

    If ``st.logo`` is called multiple times within a page, Streamlit will
    render the image passed in the last call. For the most consistent results,
    call ``st.logo`` early in your page script and choose an image that works
    well in both light and dark mode. Avoid empty margins around your image.

    If your logo does not work well for both light and dark mode, consider
    setting the theme and hiding the settings menu from users with the
    `configuration option <https://docs.streamlit.io/develop/api-reference/configuration/config.toml>`_
    ``client.toolbarMode="minimal"``.

    Parameters
    ----------
    image: Anything supported by st.image (except list)
        The image to display in the upper-left corner of your app and its
        sidebar. This can be any of the types supported by |st.image|_ except
        a list. If ``icon_image`` is also provided, then Streamlit will only
        display ``image`` in the sidebar.

        Streamlit scales the image to a max height set by ``size`` and a max
        width to fit within the sidebar.

        .. |st.image| replace:: ``st.image``
        .. _st.image: https://docs.streamlit.io/develop/api-reference/media/st.image

    size: "small", "medium", or "large"
        The size of the image displayed in the upper-left corner of the app and its
        sidebar. The possible values are as follows:

        - ``"small"``: 20px max height
        - ``"medium"`` (default): 24px max height
        - ``"large"``: 32px max height

    link : str or None
        The external URL to open when a user clicks on the logo. The URL must
        start with "\http://" or "\https://". If ``link`` is ``None`` (default),
        the logo will not include a hyperlink.
    icon_image: Anything supported by st.image (except list) or None
        An optional, typically smaller image to replace ``image`` in the
        upper-left corner when the sidebar is closed. This can be any of the
        types supported by ``st.image`` except a list. If ``icon_image`` is
        ``None`` (default), Streamlit will always display ``image`` in the
        upper-left corner, regardless of whether the sidebar is open or closed.
        Otherwise, Streamlit will render ``icon_image`` in the upper-left
        corner of the app when the sidebar is closed.

        Streamlit scales the image to a max height set by ``size`` and a max
        width to fit within the sidebar. If the sidebar is closed, the max
        width is retained from when it was last open.

        For best results, pass a wide or horizontal image to ``image`` and a
        square image to ``icon_image``. Or, pass a square image to ``image``
        and leave ``icon_image=None``.

    Examples
    --------
    A common design practice is to use a wider logo in the sidebar, and a
    smaller, icon-styled logo in your app's main body.

    >>> import streamlit as st
    >>>
    >>> st.logo(
    ...     LOGO_URL_LARGE,
    ...     link="https://streamlit.io/gallery",
    ...     icon_image=LOGO_URL_SMALL,
    ... )

    Try switching logos around in the following example:

    >>> import streamlit as st
    >>>
    >>> HORIZONTAL_RED = "images/horizontal_red.png"
    >>> ICON_RED = "images/icon_red.png"
    >>> HORIZONTAL_BLUE = "images/horizontal_blue.png"
    >>> ICON_BLUE = "images/icon_blue.png"
    >>>
    >>> options = [HORIZONTAL_RED, ICON_RED, HORIZONTAL_BLUE, ICON_BLUE]
    >>> sidebar_logo = st.selectbox("Sidebar logo", options, 0)
    >>> main_body_logo = st.selectbox("Main body logo", options, 1)
    >>>
    >>> st.logo(sidebar_logo, icon_image=main_body_logo)
    >>> st.sidebar.markdown("Hi!")

    .. output::
        https://doc-logo.streamlit.app/
        height: 300px

    """

    ctx = get_script_run_ctx()
    if ctx is None:
        return

    fwd_msg = ForwardMsg()

    try:
        image_url = image_to_url(
            image,
            layout_config=LayoutConfig(width="content"),
            clamp=False,
            channels="RGB",
            output_format="auto",
            image_id="logo",
        )
        fwd_msg.logo.image = image_url
    except Exception as ex:
        raise StreamlitAPIException(_invalid_logo_text("image")) from ex

    if link:
        # Handle external links:
        if url_util.is_url(link, ("http", "https")):
            fwd_msg.logo.link = link
        else:
            raise StreamlitAPIException(
                f"Invalid link: {link} - the link param supports external links only and must "
                f"start with either http:// or https://."
            )

    if icon_image:
        try:
            icon_image_url = image_to_url(
                icon_image,
                layout_config=LayoutConfig(width="content"),
                clamp=False,
                channels="RGB",
                output_format="auto",
                image_id="icon-image",
            )
            fwd_msg.logo.icon_image = icon_image_url
        except Exception as ex:
            raise StreamlitAPIException(_invalid_logo_text("icon_image")) from ex

    def validate_size(size: str) -> str:
        if isinstance(size, str):
            image_size = size.lower()
            valid_sizes = ["small", "medium", "large"]

            if image_size in valid_sizes:
                return image_size

        raise StreamlitAPIException(
            f'The size argument to st.logo must be "small", "medium", or "large". \n'
            f"The argument passed was {size}."
        )

    fwd_msg.logo.size = validate_size(size)

    ctx.enqueue(fwd_msg)
