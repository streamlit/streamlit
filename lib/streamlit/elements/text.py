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

from typing import TYPE_CHECKING, cast

from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text
from streamlit.util import validate_align_option

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr, TextAlignOption


class TextMixin:
    @gather_metrics("text")
    def text(self, body: "SupportsStr", align: "TextAlignOption" = "left") -> "DeltaGenerator":
        """Write fixed-width and preformatted text.

        Parameters
        ----------
        body : str
            The string to display.
        align : {'left', 'center', 'right', 'justify'}, optional, default="left"
            The horizontal alignment option inside a block element. The default option is selected if the provided one is not on a list.

        Example
        -------
        >>> st.text('This is some text.')

        """
        text_proto = TextProto()
        text_proto.body = clean_text(body)
        text_proto.align = validate_align_option(align)
        return self.dg._enqueue("text", text_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
