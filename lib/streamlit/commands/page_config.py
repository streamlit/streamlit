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

from streamlit.report_thread import get_report_ctx
from streamlit.proto import ForwardMsg_pb2
from streamlit.proto import PageConfig_pb2
from streamlit.elements import image_proto
from streamlit.errors import StreamlitAPIException


def beta_set_page_config(
    page_title=None, page_icon=None, layout="centered", initial_sidebar_state="auto"
):
    """
    Configures the default settings of the page.

    .. note::
        This must be the first Streamlit command used in your app, and must only
        be set once.

        This is a beta feature. See
        https://docs.streamlit.io/en/latest/api.html#pre-release-features for more
        information.

    Parameters
    ----------
    page_title: str or None
        The page title, shown in the browser tab. If None, defaults to the
        filename of the script ("app.py" would show "app • Streamlit").
    page_icon : Anything supported by st.image or str or None
        The page favicon.
        Besides the types supported by `st.image` (like URLs or numpy arrays),
        you can pass in an emoji as a string ("🦈") or a shortcode (":shark:").
        Emoji icons are courtesy of Twemoji and loaded from MaxCDN.
    layout: "centered" or "wide"
        How the page content should be laid out. Defaults to "centered",
        which constrains the elements into a centered column of fixed width;
        "wide" uses the entire screen.
    initial_sidebar_state: "auto" or "expanded" or "collapsed"
        How the sidebar should start out. Defaults to "auto",
        which hides the sidebar on mobile-sized devices, and shows it otherwise.
        "expanded" shows the sidebar initially; "collapsed" hides it.

    Example
    -------
    >>> st.beta_set_page_config(
    ...     page_title="Ex-stream-ly Cool App",
    ...     page_icon="🧊",
    ...     layout="wide",
    ...     initial_sidebar_state="expanded",
    ... )
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
            output_format="JPEG",
            image_id="favicon",
            allow_emoji=True,
        )

    if layout == "centered":
        layout = PageConfig_pb2.PageConfig.CENTERED
    elif layout == "wide":
        layout = PageConfig_pb2.PageConfig.WIDE
    else:
        raise StreamlitAPIException(
            f'`layout` must be "centered" or "wide" (got "{layout}")'
        )
    msg.page_config_changed.layout = layout

    if initial_sidebar_state == "auto":
        initial_sidebar_state = PageConfig_pb2.PageConfig.AUTO
    elif initial_sidebar_state == "expanded":
        initial_sidebar_state = PageConfig_pb2.PageConfig.EXPANDED
    elif initial_sidebar_state == "collapsed":
        initial_sidebar_state = PageConfig_pb2.PageConfig.COLLAPSED
    else:
        raise StreamlitAPIException(
            '`initial_sidebar_state` must be "auto" or "expanded" or "collapsed" '
            + f'(got "{initial_sidebar_state}")'
        )

    msg.page_config_changed.initial_sidebar_state = initial_sidebar_state

    ctx = get_report_ctx()
    if ctx is None:
        return
    ctx.enqueue(msg)
