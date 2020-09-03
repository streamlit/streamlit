import types
import json as json
import numpy as np

from typing import cast, Any, List, Tuple, Type

from streamlit import type_util
from streamlit.errors import StreamlitAPIException

# Special methods:

HELP_TYPES = (
    types.BuiltinFunctionType,
    types.BuiltinMethodType,
    types.FunctionType,
    types.MethodType,
    types.ModuleType,
)  # type: Tuple[Type[Any], ...]


class WriteMixin:
    def write(self, *args, **kwargs):
        """Write arguments to the app.

        This is the Swiss Army knife of Streamlit commands: it does different
        things depending on what you throw at it. Unlike other Streamlit commands,
        write() has some unique properties:

        1. You can pass in multiple arguments, all of which will be written.
        2. Its behavior depends on the input types as follows.
        3. It returns None, so it's "slot" in the App cannot be reused.

        Parameters
        ----------
        *args : any
            One or many objects to print to the App.

            Arguments are handled as follows:

            - write(string)     : Prints the formatted Markdown string, with
                support for LaTeX expression and emoji shortcodes.
                See docs for st.markdown for more.
            - write(data_frame) : Displays the DataFrame as a table.
            - write(error)      : Prints an exception specially.
            - write(func)       : Displays information about a function.
            - write(module)     : Displays information about the module.
            - write(dict)       : Displays dict in an interactive widget.
            - write(obj)        : The default is to print str(obj).
            - write(mpl_fig)    : Displays a Matplotlib figure.
            - write(altair)     : Displays an Altair chart.
            - write(keras)      : Displays a Keras model.
            - write(graphviz)   : Displays a Graphviz graph.
            - write(plotly_fig) : Displays a Plotly figure.
            - write(bokeh_fig)  : Displays a Bokeh figure.
            - write(sympy_expr) : Prints SymPy expression using LaTeX.

        unsafe_allow_html : bool
            This is a keyword-only argument that defaults to False.

            By default, any HTML tags found in strings will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, *we strongly advise* against it*. It is hard to write secure
            HTML, so by using this argument you may be compromising your users'
            security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

            **Also note that `unsafe_allow_html` is a temporary measure and may be
            removed from Streamlit at any time.**

            If you decide to turn on HTML anyway, we ask you to please tell us your
            exact use case here:
            https://discuss.streamlit.io/t/96 .

            This will help us come up with safe APIs that allow you to do what you
            want.

        Example
        -------

        Its simplest use case is to draw Markdown-formatted text, whenever the
        input is a string:

        >>> write('Hello, *World!* :sunglasses:')

        ..  output::
            https://share.streamlit.io/0.50.2-ZWk9/index.html?id=Pn5sjhgNs4a8ZbiUoSTRxE
            height: 50px

        As mentioned earlier, `st.write()` also accepts other data formats, such as
        numbers, data frames, styled data frames, and assorted objects:

        >>> st.write(1234)
        >>> st.write(pd.DataFrame({
        ...     'first column': [1, 2, 3, 4],
        ...     'second column': [10, 20, 30, 40],
        ... }))

        ..  output::
            https://share.streamlit.io/0.25.0-2JkNY/index.html?id=FCp9AMJHwHRsWSiqMgUZGD
            height: 250px

        Finally, you can pass in multiple arguments to do things like:

        >>> st.write('1 + 1 = ', 2)
        >>> st.write('Below is a DataFrame:', data_frame, 'Above is a dataframe.')

        ..  output::
            https://share.streamlit.io/0.25.0-2JkNY/index.html?id=DHkcU72sxYcGarkFbf4kK1
            height: 300px

        Oh, one more thing: `st.write` accepts chart objects too! For example:

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
            https://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
            height: 200px

        """
        # Import dynamically, to resolve circular dependency
        from streamlit.delta_generator import DeltaGenerator

        # Cast self to DeltaGenerator, to resolve mypy type issues
        dg = cast(DeltaGenerator, self)
        string_buffer = []  # type: List[str]
        unsafe_allow_html = kwargs.get("unsafe_allow_html", False)

        # This bans some valid cases like: e = st.empty(); e.write("a", "b").
        # BUT: 1) such cases are rare, 2) this rule is easy to understand,
        # and 3) this rule should be removed once we have st.container()
        if not dg._is_top_level and len(args) > 1:
            raise StreamlitAPIException(
                "Cannot replace a single element with multiple elements.\n\n"
                "The `write()` method only supports multiple elements when "
                "inserting elements rather than replacing. That is, only "
                "when called as `st.write()` or `st.sidebar.write()`."
            )

        def flush_buffer():
            if string_buffer:
                dg.markdown(
                    " ".join(string_buffer), unsafe_allow_html=unsafe_allow_html,
                )
                string_buffer[:] = []

        for arg in args:
            # Order matters!
            if isinstance(arg, str):
                string_buffer.append(arg)
            elif type_util.is_dataframe_like(arg):
                flush_buffer()
                if len(np.shape(arg)) > 2:
                    dg.text(arg)
                else:
                    dg.dataframe(arg)
            elif isinstance(arg, Exception):
                flush_buffer()
                dg.exception(arg)
            elif isinstance(arg, HELP_TYPES):
                flush_buffer()
                dg.help(arg)
            elif type_util.is_altair_chart(arg):
                flush_buffer()
                dg.altair_chart(arg)
            elif type_util.is_type(arg, "matplotlib.figure.Figure"):
                flush_buffer()
                dg.pyplot(arg)
            elif type_util.is_plotly_chart(arg):
                flush_buffer()
                dg.plotly_chart(arg)
            elif type_util.is_type(arg, "bokeh.plotting.figure.Figure"):
                flush_buffer()
                dg.bokeh_chart(arg)
            elif type_util.is_graphviz_chart(arg):
                flush_buffer()
                dg.graphviz_chart(arg)
            elif type_util.is_sympy_expession(arg):
                flush_buffer()
                dg.latex(arg)
            elif type_util.is_keras_model(arg):
                from tensorflow.python.keras.utils import vis_utils

                flush_buffer()
                dot = vis_utils.model_to_dot(arg)
                dg.graphviz_chart(dot.to_string())
            elif isinstance(arg, (dict, list)):
                flush_buffer()
                dg.json(arg)
            elif type_util.is_namedtuple(arg):
                flush_buffer()
                dg.json(json.dumps(arg._asdict()))
            elif type_util.is_pydeck(arg):
                flush_buffer()
                dg.pydeck_chart(arg)
            else:
                string_buffer.append("`%s`" % str(arg).replace("`", "\\`"))

        flush_buffer()
