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


def set_page_title(title):
    """Set the page title.

    This title is shown on the browser tab, NOT in the app. Contrast with
    `st.title` which renders a title in-app but does not set the page title.

    Note: This is a beta feature. See
    https://docs.streamlit.io/en/latest/pre_release_features.html for more
    information.

    Parameters
    ----------
    title: str
        The text to set as the page title.

    Example
    -------
    >>> st.beta_set_page_title('Look up! 😉')

    """
    msg = ForwardMsg_pb2.ForwardMsg()
    msg.update_report_properties.title = title
    _enqueue_message(msg)
