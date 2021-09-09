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
from typing import Any, Dict, List, Callable, Optional

from streamlit import type_util, util
from streamlit.errors import (
    StreamlitAPIWarning,
    StreamlitAPIException,
    MarkdownFormattedException,
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


class InternalHashError(MarkdownFormattedException):
    """Exception in Streamlit hashing code (i.e. not a user error). If
    this exception is thrown, it means there's a bug in Streamlit!
    """

    def __init__(
        self,
        cache_type: CacheType,
        hash_stack: HashStack,
        orig_exc: BaseException,
        failed_obj: Any,
    ):
        args = self._get_error_message_args(
            cache_type, hash_stack, orig_exc, failed_obj
        )

        # This needs to have zero indentation otherwise %(hash_stack)s will
        # render incorrectly in Markdown.
        msg = (
            """
%(orig_exception_desc)s

While caching %(object_part)s %(object_desc)s, Streamlit encountered an
object of type `%(failed_obj_type_str)s`, which it does not know how to hash.

**In this specific case, it's very likely you found a Streamlit bug so please
[file a bug report here.]
(https://github.com/streamlit/streamlit/issues/new/choose)**

In the meantime, you can try bypassing this error by registering a custom
hash function via the `hash_funcs` keyword in @st.cache(). For example:

```
@st.%(decorator_name)s(hash_funcs={%(failed_obj_type_str)s: my_hash_func})
def my_func(...):
    ...
```

If you don't know where the object of type `%(failed_obj_type_str)s` is coming
from, try looking at the hash chain below for an object that you do recognize,
then pass that to `hash_funcs` instead:

```
%(hash_stack)s
```

Please see the `hash_funcs` [documentation]
(https://docs.streamlit.io/en/stable/caching.html#the-hash-funcs-parameter)
for more details.
            """
            % args
        ).strip("\n")

        super(InternalHashError, self).__init__(msg)
        self.with_traceback(orig_exc.__traceback__)

    @staticmethod
    def _get_error_message_args(
        cache_type: CacheType,
        hash_stack: HashStack,
        orig_exc: BaseException,
        failed_obj: Any,
    ) -> Dict[str, Any]:
        hash_reason = hash_stack.hash_reason
        hash_source = hash_stack.hash_source
        failed_obj_type_str = type_util.get_fqn_type(failed_obj)

        object_part: str = ""

        if hash_source is None or hash_reason is None:
            object_desc = "something"
            object_part = ""

        else:
            if hasattr(hash_source, "__name__"):
                object_desc = "`%s()`" % hash_source.__name__
            else:
                object_desc = "a function"

            if hash_reason is HashReason.CACHING_FUNC_ARGS:
                object_part = "the arguments of"
            elif hash_reason is HashReason.CACHING_FUNC_BODY:
                object_part = "the body of"

        return {
            "orig_exception_desc": str(orig_exc),
            "failed_obj_type_str": failed_obj_type_str,
            "hash_stack": hash_stack.pretty_print(),
            "object_desc": object_desc,
            "object_part": object_part,
            "decorator_name": cache_type.value,
        }


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


class UnhashableTypeError(StreamlitAPIException):
    """Raised when we're unable to hash an object."""

    def __init__(self, failed_obj: Any):
        super(UnhashableTypeError, self).__init__()
        self.failed_obj = failed_obj


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
