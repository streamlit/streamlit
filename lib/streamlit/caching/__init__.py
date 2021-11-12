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
import contextlib
from typing import Iterator

from .memo_decorator import MEMO_CALL_STACK, _memo_caches
from .singleton_decorator import SINGLETON_CALL_STACK, _singleton_caches


def maybe_show_cached_st_function_warning(dg, st_func_name: str) -> None:
    MEMO_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)
    SINGLETON_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)


@contextlib.contextmanager
def suppress_cached_st_function_warning() -> Iterator[None]:
    with MEMO_CALL_STACK.suppress_cached_st_function_warning(), SINGLETON_CALL_STACK.suppress_cached_st_function_warning():
        yield


def clear_singleton_cache() -> None:
    _singleton_caches.clear_all()


def clear_memo_cache() -> None:
    _memo_caches.clear_all()


# Explicitly export public symobls
from .memo_decorator import (
    memo as memo,
    get_memo_stats_provider as get_memo_stats_provider,
)
from .singleton_decorator import (
    singleton as singleton,
    get_singleton_stats_provider as get_singleton_stats_provider,
)
