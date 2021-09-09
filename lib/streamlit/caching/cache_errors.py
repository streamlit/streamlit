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

import collections
import enum
import inspect
import types
from typing import Any, List, Callable, Optional

from streamlit import type_util, util
from streamlit.errors import (
    StreamlitAPIWarning,
    StreamlitAPIException,
)


class CacheType(enum.Enum):
    MEMO = "experimental_memo"
    SINGLETON = "experimental_singleton"


class HashReason(enum.Enum):
    CACHING_FUNC_ARGS = "caching_func_args"
    CACHING_FUNC_BODY = "caching_func_body"


class HashStack:
    """Stack of what has been hashed, for debug and circular reference detection.

    This internally keeps 1 stack per thread.

    Internally, this stores the ID of pushed objects rather than the objects
    themselves because otherwise the "in" operator inside __contains__ would
    fail for objects that don't return a boolean for "==" operator. For
    example, arr == 10 where arr is a NumPy array returns another NumPy array.
    This causes the "in" to crash since it expects a boolean.
    """

    def __init__(self):
        self._stack: collections.OrderedDict[int, List[Any]] = collections.OrderedDict()

        # The reason why we're doing this hashing, for debug purposes.
        self.hash_reason: Optional[HashReason] = None

        # Either a function or a code block, depending on whether the reason is
        # due to hashing part of a function (i.e. body, args, output) or an
        # st.Cache codeblock.
        self.hash_source: Optional[Callable[..., Any]] = None

    def __repr__(self) -> str:
        return util.repr_(self)

    def push(self, val: Any):
        self._stack[id(val)] = val

    def pop(self):
        self._stack.popitem()

    def __contains__(self, val: Any):
        return id(val) in self._stack

    def pretty_print(self):
        def to_str(v):
            try:
                return "Object of type %s: %s" % (type_util.get_fqn_type(v), str(v))
            except:
                return "<Unable to convert item to string>"

        return "\n".join(to_str(x) for x in reversed(self._stack.values()))


class UnhashableTypeError(Exception):
    pass


class UnhashableParamError(StreamlitAPIException):
    def __init__(
        self,
        func: types.FunctionType,
        arg_name: Optional[str],
        arg_value: Any,
        orig_exc: BaseException,
    ):
        msg = self._create_message(func, arg_name, arg_value)
        super(UnhashableParamError, self).__init__(msg)
        self.with_traceback(orig_exc.__traceback__)

    @staticmethod
    def _create_message(
        func: types.FunctionType, arg_name: Optional[str], arg_value: Any
    ) -> str:
        arg_name_str = arg_name if arg_name is not None else "(unnamed)"
        arg_type = type_util.get_fqn_type(arg_value)
        func_name = func.__name__
        arg_replacement_name = f"_{arg_name}" if arg_name is not None else "_arg"

        return (
            f"""
Cannot hash argument '{arg_name_str}' (of type `{arg_type}`) in '{func_name}'.

To address this, you can tell @st.memo not to hash this argument by adding a
leading underscore to the argument's name in the function signature:

```
@st.memo
def {func_name}({arg_replacement_name}, ...):
    ...
```
            """
        ).strip("\n")


def _get_failing_lines(code, lineno: int) -> List[str]:
    """Get list of strings (lines of code) from lineno to lineno+3.

    Ideally we'd return the exact line where the error took place, but there
    are reasons why this is not possible without a lot of work, including
    playing with the AST. So for now we're returning 3 lines near where
    the error took place.
    """
    source_lines, source_lineno = inspect.getsourcelines(code)

    start = lineno - source_lineno
    end = min(start + 3, len(source_lines))
    lines = source_lines[start:end]

    return lines


class CacheKeyNotFoundError(Exception):
    pass


class CacheError(Exception):
    pass


class CachedStFunctionWarning(StreamlitAPIWarning):
    def __init__(
        self,
        cache_type: CacheType,
        st_func_name: str,
        cached_func: types.FunctionType,
    ):
        args = {
            "st_func_name": f"`st.{st_func_name}()` or `st.write()`",
            "func_name": _get_cached_func_name_md(cached_func),
            "decorator_name": cache_type.value,
        }

        msg = (
            """
Your script uses %(st_func_name)s to write to your Streamlit app from within
some cached code at %(func_name)s. This code will only be called when we detect
a cache "miss", which can lead to unexpected results.

How to fix this:
* Move the %(st_func_name)s call outside %(func_name)s.
* Or, if you know what you're doing, use `@st.%(decorator_name)s(suppress_st_warning=True)`
to suppress the warning.
            """
            % args
        ).strip("\n")

        super(CachedStFunctionWarning, self).__init__(msg)


def _get_cached_func_name_md(func: types.FunctionType) -> str:
    """Get markdown representation of the function name."""
    if hasattr(func, "__name__"):
        return "`%s()`" % func.__name__
    else:
        return "a cached function"
