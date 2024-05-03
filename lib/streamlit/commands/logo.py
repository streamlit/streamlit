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

from typing import TYPE_CHECKING

from streamlit import url_util
from streamlit.elements.image import AtomicImage, WidthBehaviour, image_to_url
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx

if TYPE_CHECKING:
    from PIL import Image


def _invalid_logo_text(field_name: str):
    return f"The {field_name} passed to st.logo is invalid - See [documentation](https://docs.streamlit.io/library/api-reference/layout/st.logo) for more information on valid types"


@gather_metrics("logo")
def logo(
    image: AtomicImage,
    *,  # keyword-only args:
    link: str | None = None,
    icon_image: AtomicImage | None = None,
) -> None:
    """
    Renders logos in the main and sidebar sections of the page

    Parameters
    ----------
    image: Anything supported by st.image or str
        The app logo to be displayed in the top left corner of the sidebar of your app
        (as well as the main section if icon_image param is not provided).
    link : str or None
        The external url to be opened when a user clicks on the logo (must start with
        http:// or https://)
    icon_image: numpy.ndarray, BytesIO, str, or None
        The app logo to be displayed in the top left corner of the main section of your
        app.

    Example
    -------
    >>> import streamlit as st
    >>>
    >>> st.logo(streamlit_full, link="https://streamlit.io/gallery", icon_image=streamlit_small)
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
    except Exception:
        raise StreamlitAPIException(_invalid_logo_text("image"))

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
        except Exception:
            raise StreamlitAPIException(_invalid_logo_text("icon_image"))

    ctx.enqueue(fwd_msg)
