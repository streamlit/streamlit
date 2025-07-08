# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import dataclasses
import inspect
import types
from collections import ChainMap, UserDict, UserList
from collections.abc import (
    AsyncGenerator,
    Generator,
    ItemsView,
    Iterable,
    KeysView,
    ValuesView,
)
from io import StringIO
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Final,
    cast,
)

from streamlit import dataframe_util, type_util
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import (
    is_mem_address_str,
    max_char_sequence,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

# Special methods:
HELP_TYPES: Final[tuple[type[Any], ...]] = (
    types.BuiltinFunctionType,
    types.BuiltinMethodType,
    types.FunctionType,
    types.MethodType,
    types.ModuleType,
)

_LOGGER: Final = get_logger(__name__)

_TEXT_CURSOR: Final = " ▏"


class StreamingOutput(list[Any]):
    pass


class WriteMixin:
    @gather_metrics("write_stream")
    def write_stream(
        self,
        stream: Callable[..., Any]
        | Generator[Any, Any, Any]
        | Iterable[Any]
        | AsyncGenerator[Any, Any],
    ) -> list[Any] | str:
        """Stream a generator, iterable, or stream-like sequence to the app.

        ``st.write_stream`` iterates through the given sequences and writes all
        chunks to the app. String chunks will be written using a typewriter effect.
        Other data types will be written using ``st.write``.

        Parameters
        ----------
        stream : Callable, Generator, Iterable, OpenAI Stream, or LangChain Stream
            The generator or iterable to stream.

            If you pass an async generator, Streamlit will internally convert
            it to a sync generator.

            .. note::
                To use additional LLM libraries, you can create a wrapper to
                manually define a generator function and include custom output
                parsing.

        Returns
        -------
        str or list
            The full response. If the streamed output only contains text, this
            is a string. Otherwise, this is a list of all the streamed objects.
            The return value is fully compatible as input for ``st.write``.

        Example
        -------
        You can pass an OpenAI stream as shown in our tutorial, `Build a \
        basic LLM chat app <https://docs.streamlit.io/develop/tutorials/llms\
        /build-conversational-apps#build-a-chatgpt-like-app>`_. Alternatively,
        you can pass a generic generator function as input:

        >>> import time
        >>> import numpy as np
        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> _LOREM_IPSUM = \"\"\"
        >>> Lorem ipsum dolor sit amet, **consectetur adipiscing** elit, sed do eiusmod tempor
        >>> incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
        >>> nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        >>> \"\"\"
        >>>
        >>>
        >>> def stream_data():
        >>>     for word in _LOREM_IPSUM.split(" "):
        >>>         yield word + " "
        >>>         time.sleep(0.02)
        >>>
        >>>     yield pd.DataFrame(
        >>>         np.random.randn(5, 10),
        >>>         columns=["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
        >>>     )
        >>>
        >>>     for word in _LOREM_IPSUM.split(" "):
        >>>         yield word + " "
        >>>         time.sleep(0.02)
        >>>
        >>>
        >>> if st.button("Stream data"):
        >>>     st.write_stream(stream_data)

        ..  output::
            https://doc-write-stream-data.streamlit.app/
            height: 550px

        """

        # Just apply some basic checks for common iterable types that should
        # not be passed in here.
        if isinstance(stream, str) or dataframe_util.is_dataframe_like(stream):
            raise StreamlitAPIException(
                "`st.write_stream` expects a generator or stream-like object as input "
                f"not {type(stream)}. Please use `st.write` instead for "
                "this data type."
            )

        stream_container: DeltaGenerator | None = None
        streamed_response: str = ""
        written_content: list[Any] = StreamingOutput()

        def flush_stream_response() -> None:
            """Write the full response to the app."""
            nonlocal streamed_response
            nonlocal stream_container

            if streamed_response and stream_container:
                # Replace the stream_container element the full response
                stream_container.markdown(streamed_response)
                written_content.append(streamed_response)
                stream_container = None
                streamed_response = ""

        # Make sure we have a generator and not just a generator function.
        if inspect.isgeneratorfunction(stream) or inspect.isasyncgenfunction(stream):
            stream = stream()

        # If the stream is an async generator, convert it to a sync generator:
        if inspect.isasyncgen(stream):
            stream = type_util.async_generator_to_sync(stream)

        try:
            iter(stream)  # type: ignore
        except TypeError as exc:
            raise StreamlitAPIException(
                f"The provided input (type: {type(stream)}) cannot be iterated. "
                "Please make sure that it is a generator, generator function or iterable."
            ) from exc

        # Iterate through the generator and write each chunk to the app
        # with a type writer effect.
        for chunk in stream:  # type: ignore
            if type_util.is_openai_chunk(chunk):
                # Try to convert OpenAI chat completion chunk to a string:
                try:
                    if len(chunk.choices) == 0 or chunk.choices[0].delta is None:
                        # The choices list can be empty. E.g. when using the
                        # AzureOpenAI client, the first chunk will always be empty.
                        chunk = ""  # noqa: PLW2901
                    else:
                        chunk = chunk.choices[0].delta.content or ""  # noqa: PLW2901
                except AttributeError as err:
                    raise StreamlitAPIException(
                        "Failed to parse the OpenAI ChatCompletionChunk. "
                        "The most likely cause is a change of the chunk object structure "
                        "due to a recent OpenAI update. You might be able to fix this "
                        "by downgrading the OpenAI library or upgrading Streamlit. Also, "
                        "please report this issue to: https://github.com/streamlit/streamlit/issues."
                    ) from err

            if type_util.is_type(chunk, "langchain_core.messages.ai.AIMessageChunk"):
                # Try to convert LangChain message chunk to a string:
                try:
                    chunk = chunk.content or ""  # noqa: PLW2901
                except AttributeError as err:
                    raise StreamlitAPIException(
                        "Failed to parse the LangChain AIMessageChunk. "
                        "The most likely cause is a change of the chunk object structure "
                        "due to a recent LangChain update. You might be able to fix this "
                        "by downgrading the OpenAI library or upgrading Streamlit. Also, "
                        "please report this issue to: https://github.com/streamlit/streamlit/issues."
                    ) from err

            if isinstance(chunk, str):
                if not chunk:
                    # Empty strings can be ignored
                    continue

                first_text = False
                if not stream_container:
                    stream_container = self.dg.empty()
                    first_text = True
                streamed_response += chunk
                # Only add the streaming symbol on the second text chunk
                stream_container.markdown(
                    streamed_response + ("" if first_text else _TEXT_CURSOR),
                )
            elif callable(chunk):
                flush_stream_response()
                chunk()
            else:
                flush_stream_response()
                self.write(chunk)
                written_content.append(chunk)

        flush_stream_response()

        if not written_content:
            # If nothing was streamed, return an empty string.
            return ""
        if len(written_content) == 1 and isinstance(written_content[0], str):
            # If the output only contains a single string, return it as a string
            return written_content[0]

        # Otherwise return it as a list of write-compatible objects
        return written_content

    @gather_metrics("write")
    def write(self, *args: Any, unsafe_allow_html: bool = False, **kwargs: Any) -> None:
        """Displays arguments in the app.

        This is the Swiss Army knife of Streamlit commands: it does different
        things depending on what you throw at it. Unlike other Streamlit
        commands, ``st.write()`` has some unique properties:

        - You can pass in multiple arguments, all of which will be displayed.
        - Its behavior depends on the input type(s).

        Parameters
        ----------
        *args : any
            One or many objects to display in the app.

            .. list-table:: Each type of argument is handled as follows:
                :header-rows: 1

                * - Type
                  - Handling
                * - ``str``
                  - Uses ``st.markdown()``.
                * - dataframe-like, ``dict``, or ``list``
                  - Uses ``st.dataframe()``.
                * - ``Exception``
                  - Uses ``st.exception()``.
                * - function, module, or class
                  - Uses ``st.help()``.
                * - ``DeltaGenerator``
                  - Uses ``st.help()``.
                * - Altair chart
                  - Uses ``st.altair_chart()``.
                * - Bokeh figure
                  - Uses ``st.bokeh_chart()``.
                * - Graphviz graph
                  - Uses ``st.graphviz_chart()``.
                * - Keras model
                  - Converts model and uses ``st.graphviz_chart()``.
                * - Matplotlib figure
                  - Uses ``st.pyplot()``.
                * - Plotly figure
                  - Uses ``st.plotly_chart()``.
                * - ``PIL.Image``
                  - Uses ``st.image()``.
                * - generator or stream (like ``openai.Stream``)
                  - Uses ``st.write_stream()``.
                * - SymPy expression
                  - Uses ``st.latex()``.
                * - An object with ``._repr_html()``
                  - Uses ``st.html()``.
                * - Database cursor
                  - Displays DB API 2.0 cursor results in a table.
                * - Any
                  - Displays ``str(arg)`` as inline code.

        unsafe_allow_html : bool
            Whether to render HTML within ``*args``. This only applies to
            strings or objects falling back on ``_repr_html_()``. If this is
            ``False`` (default), any HTML tags found in ``body`` will be
            escaped and therefore treated as raw text. If this is ``True``, any
            HTML expressions within ``body`` will be rendered.

            Adding custom HTML to your app impacts safety, styling, and
            maintainability.

            .. note::
                If you only want to insert HTML or CSS without Markdown text,
                we recommend using ``st.html`` instead.

        **kwargs : any
            Keyword arguments. Not used.

        .. deprecated::
            ``**kwargs`` is deprecated and will be removed in a later version.
            Use other, more specific Streamlit commands to pass additional
            keyword arguments.

        Returns
        -------
        None

        Examples
        --------
        Its basic use case is to draw Markdown-formatted text, whenever the
        input is a string:

        >>> import streamlit as st
        >>>
        >>> st.write("Hello, *World!* :sunglasses:")

        ..  output::
            https://doc-write1.streamlit.app/
            height: 150px

        As mentioned earlier, ``st.write()`` also accepts other data formats, such as
        numbers, data frames, styled data frames, and assorted objects:

        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> st.write(1234)
        >>> st.write(
        ...     pd.DataFrame(
        ...         {
        ...             "first column": [1, 2, 3, 4],
        ...             "second column": [10, 20, 30, 40],
        ...         }
        ...     )
        ... )

        ..  output::
            https://doc-write2.streamlit.app/
            height: 350px

        Finally, you can pass in multiple arguments to do things like:

        >>> import streamlit as st
        >>>
        >>> st.write("1 + 1 = ", 2)
        >>> st.write("Below is a DataFrame:", data_frame, "Above is a dataframe.")

        ..  output::
            https://doc-write3.streamlit.app/
            height: 410px

        Oh, one more thing: ``st.write`` accepts chart objects too! For example:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> df = pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"])
        >>> c = (
        ...     alt.Chart(df)
        ...     .mark_circle()
        ...     .encode(x="a", y="b", size="c", color="c", tooltip=["a", "b", "c"])
        ... )
        >>>
        >>> st.write(c)

        ..  output::
            https://doc-vega-lite-chart.streamlit.app/
            height: 300px

        """
        if kwargs:
            _LOGGER.warning(
                'Invalid arguments were passed to "st.write" function. Support for '
                "passing such unknown keywords arguments will be dropped in future. "
                "Invalid arguments were: %s",
                kwargs,
            )

        if len(args) == 1 and isinstance(args[0], str):
            # Optimization: If there is only one arg, and it's a string,
            # we can just call markdown directly and skip the buffer logic.
            # This also prevents unnecessary usage of `st.empty()`.
            # This covers > 80% of all `st.write` uses.
            self.dg.markdown(args[0], unsafe_allow_html=unsafe_allow_html)
            return

        string_buffer: list[str] = []

        # This bans some valid cases like: e = st.empty(); e.write("a", "b").
        # BUT: 1) such cases are rare, 2) this rule is easy to understand,
        # and 3) this rule should be removed once we have st.container()
        if not self.dg._is_top_level and len(args) > 1:
            raise StreamlitAPIException(
                "Cannot replace a single element with multiple elements.\n\n"
                "The `write()` method only supports multiple elements when "
                "inserting elements rather than replacing. That is, only "
                "when called as `st.write()` or `st.sidebar.write()`."
            )

        def flush_buffer() -> None:
            if string_buffer:
                text_content = " ".join(string_buffer)
                # The usage of empty here prevents
                # some grey out effects:
                text_container = self.dg.empty()
                text_container.markdown(
                    text_content,
                    unsafe_allow_html=unsafe_allow_html,
                )
                string_buffer[:] = []

        for arg in args:
            # Order matters!
            if isinstance(arg, str):
                string_buffer.append(arg)
            elif isinstance(arg, StreamingOutput):
                flush_buffer()
                for item in arg:
                    if callable(item):
                        flush_buffer()
                        item()
                    else:
                        self.write(item, unsafe_allow_html=unsafe_allow_html)
            elif isinstance(arg, Exception):
                flush_buffer()
                self.dg.exception(arg)
            elif type_util.is_delta_generator(arg):
                flush_buffer()
                self.dg.help(arg)
            elif dataframe_util.is_dataframe_like(arg):
                flush_buffer()
                self.dg.dataframe(arg)
            elif type_util.is_altair_chart(arg):
                flush_buffer()
                self.dg.altair_chart(arg)
            elif type_util.is_type(arg, "matplotlib.figure.Figure"):
                flush_buffer()
                self.dg.pyplot(arg)
            elif type_util.is_plotly_chart(arg):
                flush_buffer()
                self.dg.plotly_chart(arg)
            elif type_util.is_type(arg, "bokeh.plotting.figure.Figure"):
                flush_buffer()
                self.dg.bokeh_chart(arg)
            elif type_util.is_graphviz_chart(arg):
                flush_buffer()
                self.dg.graphviz_chart(arg)
            elif type_util.is_sympy_expression(arg):
                flush_buffer()
                self.dg.latex(arg)
            elif type_util.is_pillow_image(arg):
                flush_buffer()
                self.dg.image(arg)
            elif type_util.is_keras_model(arg):
                from tensorflow.python.keras.utils import (  # type: ignore
                    vis_utils,
                )

                flush_buffer()
                dot = vis_utils.model_to_dot(arg)
                self.dg.graphviz_chart(dot.to_string())
            elif (
                isinstance(
                    arg,
                    (
                        dict,
                        list,
                        map,
                        enumerate,
                        types.MappingProxyType,
                        UserDict,
                        ChainMap,
                        UserList,
                        ItemsView,
                        KeysView,
                        ValuesView,
                    ),
                )
                or type_util.is_custom_dict(arg)
                or type_util.is_namedtuple(arg)
                or type_util.is_pydantic_model(arg)
            ):
                flush_buffer()
                self.dg.json(arg)
            elif type_util.is_pydeck(arg):
                flush_buffer()
                self.dg.pydeck_chart(arg)
            elif isinstance(arg, StringIO):
                flush_buffer()
                self.dg.markdown(arg.getvalue())
            elif (
                inspect.isgenerator(arg)
                or inspect.isgeneratorfunction(arg)
                or inspect.isasyncgenfunction(arg)
                or inspect.isasyncgen(arg)
                or type_util.is_type(arg, "openai.Stream")
            ):
                flush_buffer()
                self.write_stream(arg)
            elif isinstance(arg, HELP_TYPES) or dataclasses.is_dataclass(arg):
                flush_buffer()
                self.dg.help(arg)
            elif inspect.isclass(arg):
                flush_buffer()
                # We cast arg to type here to appease mypy, due to bug in mypy:
                # https://github.com/python/mypy/issues/12933
                self.dg.help(cast("type", arg))
            elif unsafe_allow_html and type_util.has_callable_attr(arg, "_repr_html_"):
                self.dg.html(arg._repr_html_())
            elif type_util.has_callable_attr(
                arg, "to_pandas"
            ) or type_util.has_callable_attr(arg, "__dataframe__"):
                # This object can very likely be converted to a DataFrame
                # using the to_pandas, to_arrow, or the dataframe interchange
                # protocol.
                flush_buffer()
                self.dg.dataframe(arg)
            else:
                stringified_arg = str(arg)

                if is_mem_address_str(stringified_arg):
                    flush_buffer()
                    self.dg.help(arg)

                elif "\n" in stringified_arg:
                    # With a multi-line string, use a preformatted block
                    # To fully escape backticks, we wrap with backticks larger than
                    # the largest sequence of backticks in the string.
                    backtick_count = max(3, max_char_sequence(stringified_arg, "`") + 1)
                    backtick_wrapper = "`" * backtick_count
                    string_buffer.append(
                        f"{backtick_wrapper}\n{stringified_arg}\n{backtick_wrapper}"
                    )
                else:
                    # With a single-line string, use a preformatted text
                    # To fully escape backticks, we wrap with backticks larger than
                    # the largest sequence of backticks in the string.
                    backtick_count = max_char_sequence(stringified_arg, "`") + 1
                    backtick_wrapper = "`" * backtick_count
                    string_buffer.append(
                        f"{backtick_wrapper}{stringified_arg}{backtick_wrapper}"
                    )

        flush_buffer()

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
