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

from streamlit.DeltaGenerator import _enqueue_message
from streamlit.proto import ForwardMsg_pb2
from streamlit.elements import image_proto


def set_favicon(
    image, clamp=False, channels="RGB", format="JPEG",
):
    """Set the page favicon to the specified image or emoji.

    This supports all the same parameters as `st.image` such as numpy arrays
    or URLs.

    You can also use an emoji as a favicon, either directly or with a shortcode [1].
    Emojis are rendered courtesy of Twemoji [2].

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
    clamp : bool
        Clamp image pixel values to a valid range ([0-255] per channel).
        This is only meaningful for byte array images; the parameter is
        ignored for image URLs. If this is not set, and an image has an
        out-of-range value, an error will be thrown.
    channels : 'RGB' or 'BGR'
        If image is an nd.array, this parameter denotes the format used to
        represent color information. Defaults to 'RGB', meaning
        `image[:, :, 0]` is the red channel, `image[:, :, 1]` is green, and
        `image[:, :, 2]` is blue. For images coming from libraries like
        OpenCV you should set this to 'BGR', instead.
    format : 'JPEG' or 'PNG'
        This parameter specifies the image format to use when transferring
        the image data. Defaults to 'JPEG'.

    Example
    -------
    >>> st.beta_set_favicon('https://docs.streamlit.io/en/latest/_static/logomark_website.png')

    """

    msg = ForwardMsg_pb2.ForwardMsg()

    width = -1  # Always use full width for favicons
    msg.update_report_properties.favicon = image_proto.image_to_url(
        image, width, clamp, channels, format, image_id="favicon", allow_emoji=True
    )

    _enqueue_message(msg)
