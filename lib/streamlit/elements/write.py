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

import dataclasses
import inspect
import json
import types
from io import StringIO
from typing import TYPE_CHECKING, Any, Callable, Final, Generator, Iterable, List, cast

from streamlit import type_util
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.state import QueryParamsProxy, SessionStateProxy
from streamlit.string_util import (
    is_mem_address_str,
    max_char_sequence,
    probably_contains_html_tags,
)
from streamlit.user_info import UserInfoProxy

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

_TEXT_CURSOR: Final = "▕"


class StreamingOutput(List[Any]):
    pass


class WriteMixin:
    @gather_metrics("write_stream")
    def write_stream(
        self, stream: Callable[..., Any] | Generator[Any, Any, Any] | Iterable[Any]
    ) -> list[Any] | str:
        """Stream a generator, iterable, or stream-like sequence to the app.

        ``st.write_stream`` iterates through the given sequences and writes all
        chunks to the app. String chunks will be written using a typewriter effect.
        Other data types will be written using ``st.write``.

        Parameters
        ----------
        stream : Callable, Generator, Iterable, OpenAI Stream, or LangChain Stream
            The generator or iterable to stream.

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
        basic LLM chat app <https://docs.streamlit.io/knowledge-base/tutorials\
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
        if isinstance(stream, str) or type_util.is_dataframe_like(stream):
            raise StreamlitAPIException(
                "`st.write_stream` expects a generator or stream-like object as input "
                f"not {type(stream)}. Please use `st.write` instead for "
                "this data type."
            )

        stream_container: DeltaGenerator | None = None
        streamed_response: str = ""
        written_content: list[Any] = StreamingOutput()

        def flush_stream_response():
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
        stream = stream() if inspect.isgeneratorfunction(stream) else stream

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
                    if len(chunk.choices) == 0:
                        # The choices list can be empty. E.g. when using the
                        # AzureOpenAI client, the first chunk will always be empty.
                        chunk = ""
                    else:
                        chunk = chunk.choices[0].delta.content or ""
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
                    chunk = chunk.content or ""
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
        elif len(written_content) == 1 and isinstance(written_content[0], str):
            # If the output only contains a single string, return it as a string
            return written_content[0]

        # Otherwise return it as a list of write-compatible objects
        return written_content

    @gather_metrics("write")
    def write(self, *args: Any, unsafe_allow_html: bool = False, **kwargs) -> None:
        """Write arguments to the app.

        This is the Swiss Army knife of Streamlit commands: it does different
        things depending on what you throw at it. Unlike other Streamlit commands,
        write() has some unique properties:

        1. You can pass in multiple arguments, all of which will be written.
        2. Its behavior depends on the input types as follows.
        3. It returns None, so its "slot" in the App cannot be reused.

        Parameters
        ----------
        *args : any
            One or many objects to print to the App.

            Arguments are handled as follows:

            - write(string)         : Prints the formatted Markdown string, with
                support for LaTeX expression, emoji shortcodes, and colored text.
                See docs for st.markdown for more.
            - write(data_frame)     : Displays the DataFrame as a table.
            - write(error)          : Prints an exception specially.
            - write(func)           : Displays information about a function.
            - write(module)         : Displays information about the module.
            - write(class)          : Displays information about a class.
            - write(dict)           : Displays dict in an interactive widget.
            - write(mpl_fig)        : Displays a Matplotlib figure.
            - write(generator)      : Streams the output of a generator.
            - write(openai.Stream)  : Streams the output of an OpenAI stream.
            - write(altair)         : Displays an Altair chart.
            - write(PIL.Image)      : Displays an image.
            - write(keras)          : Displays a Keras model.
            - write(graphviz)       : Displays a Graphviz graph.
            - write(plotly_fig)     : Displays a Plotly figure.
            - write(bokeh_fig)      : Displays a Bokeh figure.
            - write(sympy_expr)     : Prints SymPy expression using LaTeX.
            - write(htmlable)       : Prints _repr_html_() for the object if available.
            - write(obj)            : Prints str(obj) if otherwise unknown.

        unsafe_allow_html : bool
            This is a keyword-only argument that defaults to False.

            By default, any HTML tags found in strings will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, *we strongly advise against it*. It is hard to write secure
            HTML, so by using this argument you may be compromising your users'
            security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

        **kwargs : any
            Keyword arguments. Not used.

        .. deprecated::
            ``**kwargs`` is deprecated and will be removed in a later version.
            Use other, more specific Streamlit commands to pass additional
            keyword arguments.


        Example
        -------

        Its basic use case is to draw Markdown-formatted text, whenever the
        input is a string:

        >>> import streamlit as st
        >>>
        >>> st.write('Hello, *World!* :sunglasses:')

        ..  output::
            https://doc-write1.streamlit.app/
            height: 150px

        As mentioned earlier, ``st.write()`` also accepts other data formats, such as
        numbers, data frames, styled data frames, and assorted objects:

        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> st.write(1234)
        >>> st.write(pd.DataFrame({
        ...     'first column': [1, 2, 3, 4],
        ...     'second column': [10, 20, 30, 40],
        ... }))

        ..  output::
            https://doc-write2.streamlit.app/
            height: 350px

        Finally, you can pass in multiple arguments to do things like:

        >>> import streamlit as st
        >>>
        >>> st.write('1 + 1 = ', 2)
        >>> st.write('Below is a DataFrame:', data_frame, 'Above is a dataframe.')

        ..  output::
            https://doc-write3.streamlit.app/
            height: 410px

        Oh, one more thing: ``st.write`` accepts chart objects too! For example:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> c = alt.Chart(df).mark_circle().encode(
        ...     x='a', y='b', size='c', color='c', tooltip=['a', 'b', 'c'])
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

        def flush_buffer():
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
            elif type_util.is_unevaluated_data_object(
                arg
            ) or type_util.is_snowpark_row_list(arg):
                flush_buffer()
                self.dg.dataframe(arg)
            elif type_util.is_dataframe_like(arg):
                import numpy as np

                flush_buffer()
                if len(np.shape(arg)) > 2:
                    self.dg.text(arg)
                else:
                    self.dg.dataframe(arg)
            elif isinstance(arg, Exception):
                flush_buffer()
                self.dg.exception(arg)
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
            elif type_util.is_sympy_expession(arg):
                flush_buffer()
                self.dg.latex(arg)
            elif type_util.is_pillow_image(arg):
                flush_buffer()
                self.dg.image(arg)
            elif type_util.is_keras_model(arg):
                from tensorflow.python.keras.utils import vis_utils

                flush_buffer()
                dot = vis_utils.model_to_dot(arg)
                self.dg.graphviz_chart(dot.to_string())
            elif isinstance(
                arg, (dict, list, SessionStateProxy, UserInfoProxy, QueryParamsProxy)
            ):
                flush_buffer()
                self.dg.json(arg)
            elif type_util.is_namedtuple(arg):
                flush_buffer()
                self.dg.json(json.dumps(arg._asdict()))
            elif type_util.is_pydeck(arg):
                flush_buffer()
                self.dg.pydeck_chart(arg)
            elif isinstance(arg, StringIO):
                flush_buffer()
                self.dg.markdown(arg.getvalue())
            elif (
                inspect.isgenerator(arg)
                or inspect.isgeneratorfunction(arg)
                or type_util.is_type(arg, "openai.Stream")
            ):
                flush_buffer()
                self.write_stream(arg)
            elif isinstance(arg, HELP_TYPES):
                flush_buffer()
                self.dg.help(arg)
            elif dataclasses.is_dataclass(arg):
                flush_buffer()
                self.dg.help(arg)
            elif inspect.isclass(arg):
                flush_buffer()
                # We cast arg to type here to appease mypy, due to bug in mypy:
                # https://github.com/python/mypy/issues/12933
                self.dg.help(cast(type, arg))
            elif (
                hasattr(arg, "_repr_html_")
                and callable(arg._repr_html_)
                and (repr_html := arg._repr_html_())
                and (unsafe_allow_html or not probably_contains_html_tags(repr_html))
            ):
                # We either explicitly allow HTML or infer it's not HTML
                self.dg.markdown(repr_html, unsafe_allow_html=unsafe_allow_html)
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
