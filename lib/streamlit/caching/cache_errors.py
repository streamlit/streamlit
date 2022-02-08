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

import enum
import types
from typing import Any, Optional

from streamlit import type_util
from streamlit.errors import (
    StreamlitAPIWarning,
    StreamlitAPIException,
)


class CacheType(enum.Enum):
    MEMO = "experimental_memo"
    SINGLETON = "experimental_singleton"


class UnhashableTypeError(Exception):
    pass


class UnhashableParamError(StreamlitAPIException):
    def __init__(
        self,
        cache_type: CacheType,
        func: types.FunctionType,
        arg_name: Optional[str],
        arg_value: Any,
        orig_exc: BaseException,
    ):
        msg = self._create_message(cache_type, func, arg_name, arg_value)
        super().__init__(msg)
        self.with_traceback(orig_exc.__traceback__)

    @staticmethod
    def _create_message(
        cache_type: CacheType,
        func: types.FunctionType,
        arg_name: Optional[str],
        arg_value: Any,
    ) -> str:
        arg_name_str = arg_name if arg_name is not None else "(unnamed)"
        arg_type = type_util.get_fqn_type(arg_value)
        func_name = func.__name__
        arg_replacement_name = f"_{arg_name}" if arg_name is not None else "_arg"

        return (
            f"""
Cannot hash argument '{arg_name_str}' (of type `{arg_type}`) in '{func_name}'.

To address this, you can tell Streamlit not to hash this argument by adding a
leading underscore to the argument's name in the function signature:

```
@st.{cache_type.value}
def {func_name}({arg_replacement_name}, ...):
    ...
```
            """
        ).strip("\n")


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
            "func_name": self._get_cached_func_name_md(cached_func),
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

        super().__init__(msg)

    @staticmethod
    def _get_cached_func_name_md(func: types.FunctionType) -> str:
        """Get markdown representation of the function name."""
        if hasattr(func, "__name__"):
            return "`%s()`" % func.__name__
        else:
            return "a cached function"
