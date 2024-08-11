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

"""Handle App logos"""

from __future__ import annotations

from streamlit import url_util
from streamlit.elements.image import AtomicImage, WidthBehaviour, image_to_url
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx


def _invalid_logo_text(field_name: str):
    return f"The {field_name} passed to st.logo is invalid - See [documentation](https://docs.streamlit.io/develop/api-reference/media/st.logo) for more information on valid types"


@gather_metrics("logo")
def logo(
    image: AtomicImage,
    *,  # keyword-only args:
    link: str | None = None,
    icon_image: AtomicImage | None = None,
) -> None:
    """
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
    image: Anything supported by st.image
        The image to display in the upper-left corner of your app and its
        sidebar. If ``icon_image`` is also provided, then Streamlit will only
        display ``image`` in the sidebar.

        Streamlit scales the image to a height of 24 pixels and a maximum
        width of 240 pixels. Use images with an aspect ratio of 10:1 or less to
        avoid distortion.
    link : str or None
        The external URL to open when a user clicks on the logo. The URL must
        start with "\\http://" or "\\https://". If ``link`` is ``None`` (default),
        the logo will not include a hyperlink.
    icon_image: Anything supported by st.image or None
        An alternate image to replace ``image`` in the upper-left corner of the
        app's main body. If ``icon_image`` is ``None`` (default), Streamlit
        will render ``image`` in the upper-left corner of the app and its
        sidebar. Otherwise, Streamlit will render ``icon_image`` in the
        upper-left corner of the app and ``image`` in the upper-left corner
        of the sidebar.

        Streamlit scales the image to a height of 24 pixels and a maximum
        width of 240 pixels. Use images with an aspect ratio of 10:1 or less to
        avoid distortion.

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
            width=WidthBehaviour.AUTO,
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
                f"Invalid link: {link} - the link param supports external links only and must start with either http:// or https://."
            )

    if icon_image:
        try:
            icon_image_url = image_to_url(
                icon_image,
                width=WidthBehaviour.AUTO,
                clamp=False,
                channels="RGB",
                output_format="auto",
                image_id="icon-image",
            )
            fwd_msg.logo.icon_image = icon_image_url
        except Exception as ex:
            raise StreamlitAPIException(_invalid_logo_text("icon_image")) from ex

    ctx.enqueue(fwd_msg)
