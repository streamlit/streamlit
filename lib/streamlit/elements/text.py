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

from typing import cast, TYPE_CHECKING

from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.string_util import clean_text
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


class TextMixin:
    @gather_metrics
    def text(self, body: "SupportsStr") -> "DeltaGenerator":
        """Write fixed-width and preformatted text.

        Parameters
        ----------
        body : str
            The string to display.

        Example
        -------
        >>> st.text('This is some text.')

        """
        text_proto = TextProto()
        text_proto.body = clean_text(body)
        return self.dg._enqueue("text", text_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
