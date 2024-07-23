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

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Union, cast

from typing_extensions import TypeAlias

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Progress_pb2 import Progress as ProgressProto
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


# Currently, equates to just float, but we can't use `numbers.Real` due to
# https://github.com/python/mypy/issues/3186
FloatOrInt: TypeAlias = Union[int, float]


def _check_float_between(value: float, low: float = 0.0, high: float = 1.0) -> bool:
    """
    Checks given value is 'between' the bounds of [low, high],
    considering close values around bounds are acceptable input

    Notes
    -----
    This check is required for handling values that are slightly above or below the
    acceptable range, for example -0.0000000000021, 1.0000000000000013.
    These values are little off the conventional 0.0 <= x <= 1.0 condition
    due to floating point operations, but should still be considered acceptable input.

    Parameters
    ----------
    value : float
    low : float
    high : float

    """
    return (
        (low <= value <= high)
        or math.isclose(value, low, rel_tol=1e-9, abs_tol=1e-9)
        or math.isclose(value, high, rel_tol=1e-9, abs_tol=1e-9)
    )


def _get_value(value):
    if isinstance(value, int):
        if 0 <= value <= 100:
            return value
        else:
            raise StreamlitAPIException(
                "Progress Value has invalid value [0, 100]: %d" % value
            )

    elif isinstance(value, float):
        if _check_float_between(value, low=0.0, high=1.0):
            return int(value * 100)
        else:
            raise StreamlitAPIException(
                "Progress Value has invalid value [0.0, 1.0]: %f" % value
            )
    else:
        raise StreamlitAPIException(
            "Progress Value has invalid type: %s" % type(value).__name__
        )


def _get_text(text: str | None) -> str | None:
    if text is None:
        return None
    if isinstance(text, str):
        return clean_text(text)
    raise StreamlitAPIException(
        f"Progress Text is of type {str(type(text))}, which is not an accepted type."
        "Text only accepts: str. Please convert the text to an accepted type."
    )


class ProgressMixin:
    def progress(self, value: FloatOrInt, text: str | None = None) -> DeltaGenerator:
        r"""Display a progress bar.

        Parameters
        ----------
        value : int or float
            0 <= value <= 100 for int

            0.0 <= value <= 1.0 for float

        text : str or None
            A message to display above the progress bar. The text can optionally
            contain GitHub-flavored Markdown of the following types: Bold, Italics,
            Strikethroughs, Inline Code, and Links.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        Example
        -------
        Here is an example of a progress bar increasing over time and disappearing when it reaches completion:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> progress_text = "Operation in progress. Please wait."
        >>> my_bar = st.progress(0, text=progress_text)
        >>>
        >>> for percent_complete in range(100):
        ...     time.sleep(0.01)
        ...     my_bar.progress(percent_complete + 1, text=progress_text)
        >>> time.sleep(1)
        >>> my_bar.empty()
        >>>
        >>> st.button("Rerun")

        .. output::
           https://doc-status-progress.streamlit.app/
           height: 220px

        """
        # TODO: standardize numerical type checking across st.* functions.
        progress_proto = ProgressProto()
        progress_proto.value = _get_value(value)
        text = _get_text(text)
        if text is not None:
            progress_proto.text = text
        return self.dg._enqueue("progress", progress_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
