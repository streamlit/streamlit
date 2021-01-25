# Copyright 2018-2021 Streamlit Inc.
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

"""A bunch of useful utilities for dealing with types."""

import re
from typing import Tuple, Any

from streamlit import errors


def is_type(obj, fqn_type_pattern):
    """Check type without importing expensive modules.

    Parameters
    ----------
    obj : any
        The object to type-check.
    fqn_type_pattern : str or regex
        The fully-qualified type string or a regular expression.
        Regexes should start with `^` and end with `$`.

    Example
    -------

    To check whether something is a Matplotlib Figure without importing
    matplotlib, use:

    >>> is_type(foo, 'matplotlib.figure.Figure')

    """
    fqn_type = get_fqn_type(obj)
    if isinstance(fqn_type_pattern, str):
        return fqn_type_pattern == fqn_type
    else:
        return fqn_type_pattern.match(fqn_type) is not None


def get_fqn(the_type):
    """Get module.type_name for a given type."""
    module = the_type.__module__
    name = the_type.__qualname__
    return "%s.%s" % (module, name)


def get_fqn_type(obj):
    """Get module.type_name for a given object."""
    return get_fqn(type(obj))


_PANDAS_DF_TYPE_STR = "pandas.core.frame.DataFrame"
_PANDAS_INDEX_TYPE_STR = "pandas.core.indexes.base.Index"
_PANDAS_SERIES_TYPE_STR = "pandas.core.series.Series"
_PANDAS_STYLER_TYPE_STR = "pandas.io.formats.style.Styler"
_NUMPY_ARRAY_TYPE_STR = "numpy.ndarray"

_DATAFRAME_LIKE_TYPES = (
    _PANDAS_DF_TYPE_STR,
    _PANDAS_INDEX_TYPE_STR,
    _PANDAS_SERIES_TYPE_STR,
    _PANDAS_STYLER_TYPE_STR,
    _NUMPY_ARRAY_TYPE_STR,
)

_DATAFRAME_COMPATIBLE_TYPES = (
    dict,
    list,
    type(None),
)  # type: Tuple[type, ...]

_BYTES_LIKE_TYPES = (
    bytes,
    bytearray,
)


def is_dataframe(obj):
    return is_type(obj, _PANDAS_DF_TYPE_STR)


def is_dataframe_like(obj):
    return any(is_type(obj, t) for t in _DATAFRAME_LIKE_TYPES)


def is_dataframe_compatible(obj):
    """True if type that can be passed to convert_anything_to_df."""
    return is_dataframe_like(obj) or type(obj) in _DATAFRAME_COMPATIBLE_TYPES


def is_bytes_like(obj: Any) -> bool:
    """True if the type is considered bytes-like for the purposes of
    protobuf data marshalling."""
    return isinstance(obj, _BYTES_LIKE_TYPES)


def to_bytes(obj: Any) -> bytes:
    """Converts the given object to bytes.

    Only types for which `is_bytes_like` is true can be converted; anything
    else will result in an exception.
    """
    if isinstance(obj, bytes):
        return obj
    elif isinstance(obj, bytearray):
        return bytes(obj)

    raise RuntimeError(f"{obj} is not convertible to bytes")


_SYMPY_RE = re.compile(r"^sympy.*$")


def is_sympy_expession(obj):
    """True if input is a SymPy expression."""
    if not is_type(obj, _SYMPY_RE):
        return False

    try:
        import sympy

        if isinstance(obj, sympy.Expr):
            return True
    except:
        return False


_ALTAIR_RE = re.compile(r"^altair\.vegalite\.v\d+\.api\.\w*Chart$")


def is_altair_chart(obj):
    """True if input looks like an Altair chart."""
    return is_type(obj, _ALTAIR_RE)


def is_keras_model(obj):
    """True if input looks like a Keras model."""
    return (
        is_type(obj, "keras.engine.sequential.Sequential")
        or is_type(obj, "keras.engine.training.Model")
        or is_type(obj, "tensorflow.python.keras.engine.sequential.Sequential")
        or is_type(obj, "tensorflow.python.keras.engine.training.Model")
    )


def is_plotly_chart(obj):
    """True if input looks like a Plotly chart."""
    return (
        is_type(obj, "plotly.graph_objs._figure.Figure")
        or _is_list_of_plotly_objs(obj)
        or _is_probably_plotly_dict(obj)
    )


def is_graphviz_chart(obj):
    """True if input looks like a GraphViz chart."""
    return is_type(obj, "graphviz.dot.Graph") or is_type(obj, "graphviz.dot.Digraph")


def _is_plotly_obj(obj):
    """True if input if from a type that lives in plotly.plotly_objs."""
    the_type = type(obj)
    return the_type.__module__.startswith("plotly.graph_objs")


def _is_list_of_plotly_objs(obj):
    if type(obj) is not list:
        return False
    if len(obj) == 0:
        return False
    return all(_is_plotly_obj(item) for item in obj)


def _is_probably_plotly_dict(obj):
    if not isinstance(obj, dict):
        return False

    if len(obj.keys()) == 0:
        return False

    if any(k not in ["config", "data", "frames", "layout"] for k in obj.keys()):
        return False

    if any(_is_plotly_obj(v) for v in obj.values()):
        return True

    if any(_is_list_of_plotly_objs(v) for v in obj.values()):
        return True

    return False


_FUNCTION_TYPE = type(lambda: 0)


def is_function(x):
    """Return True if x is a function."""
    return type(x) == _FUNCTION_TYPE


def is_namedtuple(x):
    t = type(x)
    b = t.__bases__
    if len(b) != 1 or b[0] != tuple:
        return False
    f = getattr(t, "_fields", None)
    if not isinstance(f, tuple):
        return False
    return all(type(n).__name__ == "str" for n in f)


def is_pandas_styler(obj):
    return is_type(obj, _PANDAS_STYLER_TYPE_STR)


def is_pydeck(obj):
    """True if input looks like a pydeck chart."""
    return is_type(obj, "pydeck.bindings.deck.Deck")


def convert_anything_to_df(df):
    """Try to convert different formats to a Pandas Dataframe.

    Parameters
    ----------
    df : ndarray, Iterable, dict, DataFrame, Styler, None, dict, list, or any

    Returns
    -------
    pandas.DataFrame

    """
    if is_type(df, _PANDAS_DF_TYPE_STR):
        return df

    if is_pandas_styler(df):
        return df.data

    import pandas as pd

    if is_type(df, "numpy.ndarray") and len(df.shape) == 0:
        return pd.DataFrame([])

    # Try to convert to pandas.DataFrame. This will raise an error is df is not
    # compatible with the pandas.DataFrame constructor.
    try:
        return pd.DataFrame(df)

    except ValueError:
        raise errors.StreamlitAPIException(
            """
Unable to convert object of type `%(type)s` to `pandas.DataFrame`.

Offending object:
```py
%(object)s
```"""
            % {
                "type": type(df),
                "object": df,
            }
        )


def ensure_iterable(obj):
    """Try to convert different formats to something iterable. Most inputs
    are assumed to be iterable, but if we have a DataFrame, we can just
    select the first column to iterate over. If the input is not iterable,
    a TypeError is raised.

    Parameters
    ----------
    obj : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame

    Returns
    -------
    iterable

    """
    if is_dataframe(obj):
        return obj.iloc[:, 0]

    try:
        iter(obj)
        return obj
    except:
        raise


def is_old_pandas_version():
    """Return True if `pandas` version is < `1.1.0`."""
    import pandas as pd
    from packaging import version

    return version.parse(pd.__version__) < version.parse("1.1.0")
