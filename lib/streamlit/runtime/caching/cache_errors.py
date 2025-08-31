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

from typing import Any, Callable, Generic, TypeVar

from streamlit import type_util
from streamlit.errors import MarkdownFormattedException, StreamlitAPIException
from streamlit.runtime.caching.cache_type import CacheType, get_decorator_api_name

CACHE_DOCS_URL = "https://docs.streamlit.io/develop/concepts/architecture/caching"


def get_cached_func_name_md(func: Any) -> str:
    """Get markdown representation of the function name."""
    if hasattr(func, "__name__"):
        return f"`{func.__name__}()`"
    if hasattr(type(func), "__name__"):
        return f"`{type(func).__name__}`"
    return f"`{type(func)}`"


def get_return_value_type(return_value: Any) -> str:
    if hasattr(return_value, "__module__") and hasattr(type(return_value), "__name__"):
        return f"`{return_value.__module__}.{type(return_value).__name__}`"
    return get_cached_func_name_md(return_value)


class UnhashableTypeError(Exception):
    pass


class UnhashableParamError(StreamlitAPIException):
    def __init__(
        self,
        cache_type: CacheType,
        func: Callable[..., Any],
        arg_name: str | None,
        arg_value: Any,
        orig_exc: BaseException,
    ) -> None:
        msg = self._create_message(cache_type, func, arg_name, arg_value)
        super().__init__(msg)
        self.with_traceback(orig_exc.__traceback__)

    @staticmethod
    def _create_message(
        cache_type: CacheType,
        func: Callable[..., Any],
        arg_name: str | None,
        arg_value: Any,
    ) -> str:
        arg_name_str = arg_name if arg_name is not None else "(unnamed)"
        arg_type = type_util.get_fqn_type(arg_value)
        func_name = func.__name__ if hasattr(func, "__name__") else "unknown"
        arg_replacement_name = f"_{arg_name}" if arg_name is not None else "_arg"

        return (
            f"""
Cannot hash argument '{arg_name_str}' (of type `{arg_type}`) in '{func_name}'.

To address this, you can tell Streamlit not to hash this argument by adding a
leading underscore to the argument's name in the function signature:

```
@st.{get_decorator_api_name(cache_type)}
def {func_name}({arg_replacement_name}, ...):
    ...
```
            """
        ).strip("\n")


class CacheKeyNotFoundError(Exception):
    pass


class CacheError(Exception):
    pass


class CacheReplayClosureError(StreamlitAPIException):
    def __init__(
        self,
        cache_type: CacheType,
        cached_func: Callable[..., Any],
    ) -> None:
        func_name = get_cached_func_name_md(cached_func)
        decorator_name = get_decorator_api_name(cache_type)

        msg = (
            f"""
While running {func_name}, a streamlit element is called on some layout block
created outside the function. This is incompatible with replaying the cached
effect of that element, because the referenced block might not exist when
the replay happens.

How to fix this:
* Move the creation of $THING inside {func_name}.
* Move the call to the streamlit element outside of {func_name}.
* Remove the `@st.{decorator_name}` decorator from {func_name}.
            """
        ).strip("\n")

        super().__init__(msg)


R = TypeVar("R")


class UnserializableReturnValueError(MarkdownFormattedException, Generic[R]):
    def __init__(self, func: Callable[..., R], return_value: R) -> None:
        MarkdownFormattedException.__init__(
            self,
            f"""
            Cannot serialize the return value (of type {get_return_value_type(return_value)})
            in {get_cached_func_name_md(func)}. `st.cache_data` uses
            [pickle](https://docs.python.org/3/library/pickle.html) to serialize the
            function's return value and safely store it in the cache
            without mutating the original object. Please convert the return value to a
            pickle-serializable type. If you want to cache unserializable objects such
            as database connections or Tensorflow sessions, use `st.cache_resource`
            instead (see [our docs]({CACHE_DOCS_URL}) for differences).""",
        )


class UnevaluatedDataFrameError(StreamlitAPIException):
    """Used to display a message about uncollected dataframe being used."""

    pass
