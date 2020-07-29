# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from streamlit.delta_generator import _enqueue_message
from streamlit.proto import ForwardMsg_pb2
from streamlit.elements import image_proto


def set_page_config(
    page_title=None, page_icon=None, layout="centered", initial_sidebar_state="auto"
):
    """
    TODO docstring

    Set the page favicon to the specified image or emoji.
    You can use the same image parameters as `st.image`, like URLs or numpy arrays.
    You can also use an emoji as a favicon, either directly or with a shortcode [1].
    Favicon emojis are loaded from a CDN, courtesy of Twitter and MaxCDN [2].
    [1] https://www.webfx.com/tools/emoji-cheat-sheet/
    [2] https://twemoji.twitter.com/
    Note: This is a beta feature. See
    https://docs.streamlit.io/en/latest/pre_release_features.html for more
    information.
    Parameters
    ----------
    image : numpy.ndarray, [numpy.ndarray], BytesIO, str, or [str]
        Monochrome image of shape (w,h) or (w,h,1)
        OR a color image of shape (w,h,3)
        OR an RGBA image of shape (w,h,4)
        OR a URL to fetch the image from
        OR an emoji like '🦈'
        OR an emoji shortcode like ':shark:'
    Example
    -------
    >>> st.beta_set_favicon('https://docs.streamlit.io/en/latest/_static/logomark_website.png')
    """

    msg = ForwardMsg_pb2.ForwardMsg()

    if page_title:
        msg.page_config_changed.title = page_title

    if page_icon:
        msg.page_config_changed.favicon = image_proto.image_to_url(
            page_icon,
            width=-1,  # Always use full width for favicons
            clamp=False,
            channels="RGB",
            format="JPEG",
            image_id="favicon",
            allow_emoji=True,
        )

    if layout:
        msg.page_config_changed.layout = layout

    if initial_sidebar_state:
        msg.page_config_changed.initial_sidebar_state = initial_sidebar_state

    _enqueue_message(msg)
