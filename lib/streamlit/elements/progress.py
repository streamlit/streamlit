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

from typing import TYPE_CHECKING, Optional, Union, cast

from typing_extensions import TypeAlias

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Progress_pb2 import Progress as ProgressProto
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


# Currently, equates to just float, but we can't use `numbers.Real` due to
# https://github.com/python/mypy/issues/3186
FloatOrInt: TypeAlias = Union[int, float]


def _get_value(value):
    if isinstance(value, int):
        if 0 <= value <= 100:
            return value
        else:
            raise StreamlitAPIException(
                "Progress Value has invalid value [0, 100]: %d" % value
            )

    elif isinstance(value, float):
        if 0.0 <= value <= 1.0:
            return int(value * 100)
        else:
            raise StreamlitAPIException(
                "Progress Value has invalid value [0.0, 1.0]: %f" % value
            )
    else:
        raise StreamlitAPIException(
            "Progress Value has invalid type: %s" % type(value).__name__
        )


def _get_text(label: str) -> Optional[str]:
    if label is None:
        return None
    if isinstance(label, str):
        return clean_text(label)
    raise TypeError(
        f"Progress Text is of type {str(type(label))}, which is not an accepted type."
        "Text only accepts: str. Please convert the text to an accepted type."
    )


class ProgressMixin:
    def progress(
        self, value: FloatOrInt, text: Optional[str] = None
    ) -> "DeltaGenerator":
        """Display a progress bar.

        Parameters
        ----------
        value : int or float
            0 <= value <= 100 for int

            0.0 <= value <= 1.0 for float

        text : str or None
            A message to display above the progress bar.
            The text can optionally contain Markdown and supports the
            following elements: Bold, Italics, Strikethroughs, Inline Code, Emojis,
            and Links.

        Example
        -------
        Here is an example of a progress bar increasing over time:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> my_bar = st.progress(0)
        >>>
        >>> for percent_complete in range(100):
        ...     time.sleep(0.1)
        ...     my_bar.progress(percent_complete + 1)

        """
        # TODO: standardize numerical type checking across st.* functions.
        progress_proto = ProgressProto()
        progress_proto.value = _get_value(value)
        text = _get_text(text)
        if text is not None:
            progress_proto.text = text
        return self.dg._enqueue("progress", progress_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
