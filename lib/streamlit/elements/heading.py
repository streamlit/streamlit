# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from enum import Enum
from typing import TYPE_CHECKING, Optional, Union, cast

from typing_extensions import Literal

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Heading_pb2 import Heading as HeadingProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text
from streamlit.type_util import SupportsStr

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class HeadingProtoTag(Enum):
    TITLE_TAG = "h1"
    HEADER_TAG = "h2"
    SUBHEADER_TAG = "h3"


Anchor = Optional[Union[str, Literal[False]]]
Divider = Optional[Union[bool, str]]


class HeadingMixin:
    @gather_metrics("header")
    def header(
        self,
        body: SupportsStr,
        anchor: Anchor = None,
        *,  # keyword-only arguments:
        help: Optional[str] = None,
        divider: Divider = False,
    ) -> "DeltaGenerator":
        """Display text in header formatting.

        Parameters
        ----------
        body : str
            The text to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text, using the syntax ``:color[text to be colored]``,
              where ``color`` needs to be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.

        anchor : str or False
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.
            If False, the anchor is not shown in the UI.

        help : str
            An optional tooltip that gets displayed next to the header.

        divider : bool or “blue”, “green”, “orange”, “red”, “violet”, “gray”/"grey", or “rainbow”
            Shows a colored divider below the header. If True, successive
            headers will cycle through divider colors. That is, the first
            header will have a blue line, the second header will have a
            green line, and so on. If a string, the color can be set to one of
            the following: blue, green, orange, red, violet, gray/grey, or
            rainbow.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.header('This is a header with a divider', divider='rainbow')
        >>> st.header('_Streamlit_ is :blue[cool] :sunglasses:')

        .. output::
           https://doc-header.streamlit.app/
           height: 220px

        """
        return self.dg._enqueue(
            "heading",
            HeadingMixin._create_heading_proto(
                tag=HeadingProtoTag.HEADER_TAG,
                body=body,
                anchor=anchor,
                help=help,
                divider=divider,
            ),
        )

    @gather_metrics("subheader")
    def subheader(
        self,
        body: SupportsStr,
        anchor: Anchor = None,
        *,  # keyword-only arguments:
        help: Optional[str] = None,
        divider: Divider = False,
    ) -> "DeltaGenerator":
        """Display text in subheader formatting.

        Parameters
        ----------
        body : str
            The text to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text, using the syntax ``:color[text to be colored]``,
              where ``color`` needs to be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.

        anchor : str or False
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.
            If False, the anchor is not shown in the UI.

        help : str
            An optional tooltip that gets displayed next to the subheader.

        divider : bool or “blue”, “green”, “orange”, “red”, “violet”, “gray”/"grey", or “rainbow”
            Shows a colored divider below the header. If True, successive
            headers will cycle through divider colors. That is, the first
            header will have a blue line, the second header will have a
            green line, and so on. If a string, the color can be set to one of
            the following: blue, green, orange, red, violet, gray/grey, or
            rainbow.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.subheader('This is a subheader with a divider', divider='rainbow')
        >>> st.subheader('_Streamlit_ is :blue[cool] :sunglasses:')

        .. output::
           https://doc-subheader.streamlit.app/
           height: 220px

        """
        return self.dg._enqueue(
            "heading",
            HeadingMixin._create_heading_proto(
                tag=HeadingProtoTag.SUBHEADER_TAG,
                body=body,
                anchor=anchor,
                help=help,
                divider=divider,
            ),
        )

    @gather_metrics("title")
    def title(
        self,
        body: SupportsStr,
        anchor: Anchor = None,
        *,  # keyword-only arguments:
        help: Optional[str] = None,
    ) -> "DeltaGenerator":
        """Display text in title formatting.

        Each document should have a single `st.title()`, although this is not
        enforced.

        Parameters
        ----------
        body : str
            The text to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text, using the syntax ``:color[text to be colored]``,
              where ``color`` needs to be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.

        anchor : str or False
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.
            If False, the anchor is not shown in the UI.

        help : str
            An optional tooltip that gets displayed next to the title.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.title('This is a title')
        >>> st.title('_Streamlit_ is :blue[cool] :sunglasses:')

        .. output::
           https://doc-title.streamlit.app/
           height: 220px

        """
        return self.dg._enqueue(
            "heading",
            HeadingMixin._create_heading_proto(
                tag=HeadingProtoTag.TITLE_TAG, body=body, anchor=anchor, help=help
            ),
        )

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

    @staticmethod
    def _handle_divider_color(divider):
        if divider is True:
            return "auto"
        valid_colors = [
            "blue",
            "green",
            "orange",
            "red",
            "violet",
            "gray",
            "grey",
            "rainbow",
        ]
        if divider in valid_colors:
            return divider
        else:
            raise StreamlitAPIException(
                f"Divider parameter has invalid value: `{divider}`. Please choose from: {', '.join(valid_colors)}."
            )

    @staticmethod
    def _create_heading_proto(
        tag: HeadingProtoTag,
        body: SupportsStr,
        anchor: Anchor = None,
        help: Optional[str] = None,
        divider: Divider = False,
    ) -> HeadingProto:
        proto = HeadingProto()
        proto.tag = tag.value
        proto.body = clean_text(body)
        if divider:
            proto.divider = HeadingMixin._handle_divider_color(divider)
        if anchor is not None:
            if anchor is False:
                proto.hide_anchor = True
            elif isinstance(anchor, str):
                proto.anchor = anchor
            elif anchor is True:  # type: ignore
                raise StreamlitAPIException(
                    "Anchor parameter has invalid value: %s. "
                    "Supported values: None, any string or False" % anchor
                )
            else:
                raise StreamlitAPIException(
                    "Anchor parameter has invalid type: %s. "
                    "Supported values: None, any string or False"
                    % type(anchor).__name__
                )

        if help:
            proto.help = help
        return proto
