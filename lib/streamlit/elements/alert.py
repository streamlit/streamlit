# Copyright 2018-2022 Streamlit Inc.
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

from typing import cast, Optional, TYPE_CHECKING

from streamlit.proto.Alert_pb2 import Alert as AlertProto
from streamlit.errors import StreamlitAPIException
from .utils import clean_text
import re

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr

PAGE_ICON_REGEX = re.compile(
    "(^[\U0001F1E0-\U0001F1FF"
    "\U0001F300-\U0001F5FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251])[_-]*"
)

# Function to check the icon parameter on the alert.
# We check if what's been added is a valid emoji,
# and default to an empty string if not.
def check_emoji(emoji):
    extracted_emoji = re.search(PAGE_ICON_REGEX, emoji)
    if extracted_emoji is not None:
        return clean_text(str(extracted_emoji.group(1)))
    else:
        raise StreamlitAPIException(f'The value "{emoji}" is not a valid emoji. Shortcodes are not allowed, please use a single character instead.')

class AlertMixin:
    def error(
        self,
        body: "SupportsStr",
        *, # keyword-only args: 
        icon: Optional[str] = "",
        ) -> "DeltaGenerator":
        """Display error message.

        Parameters
        ----------
        icon : str
            An optional string, that adds an emoji to the alert.
            The default is an empty string.
            This argument can only be supplied by keyword.
        body : str
            The error text to display.

        Example
        -------
        >>> st.error('This is an error', icon=":rotating_light:")

        """
        alert_proto = AlertProto()
        alert_proto.icon = check_emoji(icon)
        alert_proto.body = clean_text(body)
        alert_proto.format = AlertProto.ERROR
        return self.dg._enqueue("alert", alert_proto)

    def warning(
        self,
        body: "SupportsStr",
        *, # keyword-only args:
        icon: Optional[str] = ""
        ) -> "DeltaGenerator":
        """Display warning message.

        Parameters
        ----------
        icon : str
            An optional string, that adds an emoji to the alert.
            The default is an empty string.
            This argument can only be supplied by keyword.

        body : str
            The warning text to display.

        Example
        -------
        >>> st.warning('This is a warning', icon=":warning:")

        """
        alert_proto = AlertProto()
        alert_proto.body = clean_text(body)
        alert_proto.icon = check_emoji(icon)
        alert_proto.format = AlertProto.WARNING
        return self.dg._enqueue("alert", alert_proto)

    def info(
        self,
        body: "SupportsStr",
        *, # keyword-only args:
        icon: Optional[str] = ""
        ) -> "DeltaGenerator":
        """Display an informational message.

        Parameters
        ----------
        icon : str
            An optional string, that adds an emoji to the alert.
            The default is an empty string.
            This argument can only be supplied by keyword.

        body : str
            The info text to display.

        Example
        -------
        >>> st.info('This is a purely informational message', icon=":information_source:")

        """

        alert_proto = AlertProto()
        alert_proto.body = clean_text(body)
        alert_proto.icon = check_emoji(icon)
        alert_proto.format = AlertProto.INFO
        return self.dg._enqueue("alert", alert_proto)

    def success(
        self,
        body: "SupportsStr",
        *, # keyword-only args:
        icon: Optional[str] = ""
        ) -> "DeltaGenerator":
        """Display a success message.

        Parameters
        ----------
        icon : str
            An optional string, that adds an emoji to the alert.
            The default is an empty string.
            This argument can only be supplied by keyword.

        body : str
            The success text to display.

        Example
        -------
        >>> st.success('This is a success message!', icon:":white_check_mark:")

        """
        alert_proto = AlertProto()
        alert_proto.body = clean_text(body)
        alert_proto.icon = check_emoji(icon)
        alert_proto.format = AlertProto.SUCCESS
        return self.dg._enqueue("alert", alert_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
