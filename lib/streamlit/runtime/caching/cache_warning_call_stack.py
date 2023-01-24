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

from __future__ import annotations

import contextlib
import threading
import types
from typing import TYPE_CHECKING, Iterator

from streamlit import util
from streamlit.elements import NONWIDGET_ELEMENTS, WIDGETS
from streamlit.runtime.caching.cache_errors import CachedStFunctionWarning
from streamlit.runtime.caching.cache_type import CacheType

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class CacheWarningCallStack(threading.local):
    """A utility for warning users when they call `st` commands inside
    a cached function. Internally, this is just a counter that's incremented
    when we enter a cache function, and decremented when we exit.

    Data is stored in a thread-local object, so it's safe to use an instance
    of this class across multiple threads.
    """

    def __init__(self, cache_type: CacheType):
        self._cached_func_stack: list[types.FunctionType] = []
        self._suppress_st_function_warning = 0
        self._cache_type = cache_type
        self._allow_widgets: int = 0

    def __repr__(self) -> str:
        return util.repr_(self)

    @contextlib.contextmanager
    def calling_cached_function(self, func: types.FunctionType) -> Iterator[None]:
        self._cached_func_stack.append(func)
        try:
            yield
        finally:
            self._cached_func_stack.pop()

    @contextlib.contextmanager
    def suppress_cached_st_function_warning(self) -> Iterator[None]:
        self._suppress_st_function_warning += 1
        try:
            yield
        finally:
            self._suppress_st_function_warning -= 1
            assert self._suppress_st_function_warning >= 0

    @contextlib.contextmanager
    def maybe_suppress_cached_st_function_warning(
        self, suppress: bool
    ) -> Iterator[None]:
        if suppress:
            with self.suppress_cached_st_function_warning():
                yield
        else:
            yield

    def maybe_show_cached_st_function_warning(
        self,
        dg: "DeltaGenerator",
        st_func_name: str,
    ) -> None:
        """If appropriate, warn about calling st.foo inside @memo.

        DeltaGenerator's @_with_element and @_widget wrappers use this to warn
        the user when they're calling st.foo() from within a function that is
        wrapped in @st.cache.

        Parameters
        ----------
        dg : DeltaGenerator
            The DeltaGenerator to publish the warning to.

        st_func_name : str
            The name of the Streamlit function that was called.

        """
        # There are some elements not in either list, which we still want to warn about.
        # Ideally we will fix this by either updating the lists or creating a better
        # way of categorizing elements.
        if st_func_name in NONWIDGET_ELEMENTS:
            return
        if st_func_name in WIDGETS and self._allow_widgets > 0:
            return

        if len(self._cached_func_stack) > 0 and self._suppress_st_function_warning <= 0:
            cached_func = self._cached_func_stack[-1]
            self._show_cached_st_function_warning(dg, st_func_name, cached_func)

    def _show_cached_st_function_warning(
        self,
        dg: "DeltaGenerator",
        st_func_name: str,
        cached_func: types.FunctionType,
    ) -> None:
        # Avoid infinite recursion by suppressing additional cached
        # function warnings from within the cached function warning.
        with self.suppress_cached_st_function_warning():
            e = CachedStFunctionWarning(self._cache_type, st_func_name, cached_func)
            dg.exception(e)

    @contextlib.contextmanager
    def allow_widgets(self) -> Iterator[None]:
        self._allow_widgets += 1
        try:
            yield
        finally:
            self._allow_widgets -= 1
            assert self._allow_widgets >= 0

    @contextlib.contextmanager
    def maybe_allow_widgets(self, allow: bool) -> Iterator[None]:
        if allow:
            with self.allow_widgets():
                yield
        else:
            yield
