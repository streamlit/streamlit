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

import contextlib
from typing import Iterator

from google.protobuf.message import Message

from streamlit.proto.Block_pb2 import Block
from streamlit.runtime.caching.memo_decorator import (
    MEMO_CALL_STACK,
    MEMO_MESSAGES_CALL_STACK,
    MemoAPI,
    _memo_caches,
)
from streamlit.runtime.caching.singleton_decorator import (
    SINGLETON_CALL_STACK,
    SINGLETON_MESSAGE_CALL_STACK,
    SingletonAPI,
    _singleton_caches,
)


def save_element_message(
    delta_type: str,
    element_proto: Message,
    invoked_dg_id: str,
    used_dg_id: str,
    returned_dg_id: str,
) -> None:
    MEMO_MESSAGES_CALL_STACK.save_element_message(
        delta_type, element_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    SINGLETON_MESSAGE_CALL_STACK.save_element_message(
        delta_type, element_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )


def save_block_message(
    block_proto: Block,
    invoked_dg_id: str,
    used_dg_id: str,
    returned_dg_id: str,
) -> None:
    MEMO_MESSAGES_CALL_STACK.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    SINGLETON_MESSAGE_CALL_STACK.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )


def maybe_show_cached_st_function_warning(dg, st_func_name: str) -> None:
    MEMO_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)
    SINGLETON_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)


@contextlib.contextmanager
def suppress_cached_st_function_warning() -> Iterator[None]:
    with MEMO_CALL_STACK.suppress_cached_st_function_warning(), SINGLETON_CALL_STACK.suppress_cached_st_function_warning():
        yield


# Explicitly export public symbols
from streamlit.runtime.caching.memo_decorator import (
    get_memo_stats_provider as get_memo_stats_provider,
)
from streamlit.runtime.caching.singleton_decorator import (
    get_singleton_stats_provider as get_singleton_stats_provider,
)

# Create and export public API singletons.
memo = MemoAPI()
singleton = SingletonAPI()
