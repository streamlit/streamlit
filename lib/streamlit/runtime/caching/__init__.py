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
from typing import Any, Iterator, Union

from google.protobuf.message import Message

from streamlit.deprecation_util import deprecate_object_with_console_warning
from streamlit.proto.Block_pb2 import Block
from streamlit.runtime.caching.cache_data_api import (
    CACHE_DATA_CALL_STACK,
    CACHE_DATA_MESSAGE_CALL_STACK,
    CacheDataAPI,
    _data_caches,
)
from streamlit.runtime.caching.cache_resource_api import (
    CACHE_RESOURCE_CALL_STACK,
    CACHE_RESOURCE_MESSAGE_CALL_STACK,
    CacheResourceAPI,
    _resource_caches,
)
from streamlit.runtime.state.session_state import WidgetMetadata


def save_element_message(
    delta_type: str,
    element_proto: Message,
    invoked_dg_id: str,
    used_dg_id: str,
    returned_dg_id: str,
) -> None:
    """Save the message for an element to a thread-local callstack, so it can
    be used later to replay the element when a cache-decorated function's
    execution is skipped.
    """
    CACHE_DATA_MESSAGE_CALL_STACK.save_element_message(
        delta_type, element_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    CACHE_RESOURCE_MESSAGE_CALL_STACK.save_element_message(
        delta_type, element_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )


def save_block_message(
    block_proto: Block,
    invoked_dg_id: str,
    used_dg_id: str,
    returned_dg_id: str,
) -> None:
    """Save the message for a block to a thread-local callstack, so it can
    be used later to replay the block when a cache-decorated function's
    execution is skipped.
    """
    CACHE_DATA_MESSAGE_CALL_STACK.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    CACHE_RESOURCE_MESSAGE_CALL_STACK.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )


def save_widget_metadata(metadata: WidgetMetadata[Any]) -> None:
    """Save a widget's metadata to a thread-local callstack, so the widget
    can be registered again when that widget is replayed.
    """
    CACHE_DATA_MESSAGE_CALL_STACK.save_widget_metadata(metadata)
    CACHE_RESOURCE_MESSAGE_CALL_STACK.save_widget_metadata(metadata)


def save_media_data(
    image_data: Union[bytes, str], mimetype: str, image_id: str
) -> None:
    CACHE_DATA_MESSAGE_CALL_STACK.save_image_data(image_data, mimetype, image_id)
    CACHE_RESOURCE_MESSAGE_CALL_STACK.save_image_data(image_data, mimetype, image_id)


def maybe_show_cached_st_function_warning(dg, st_func_name: str) -> None:
    CACHE_DATA_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)
    CACHE_RESOURCE_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)


@contextlib.contextmanager
def suppress_cached_st_function_warning() -> Iterator[None]:
    with CACHE_DATA_CALL_STACK.suppress_cached_st_function_warning(), CACHE_RESOURCE_CALL_STACK.suppress_cached_st_function_warning():
        yield


# Explicitly export public symbols
from streamlit.runtime.caching.cache_data_api import (
    get_data_cache_stats_provider as get_data_cache_stats_provider,
)
from streamlit.runtime.caching.cache_resource_api import (
    get_resource_cache_stats_provider as get_resource_cache_stats_provider,
)

# Create and export public API singletons.
cache_data = CacheDataAPI()
cache_resource = CacheResourceAPI()

# Deprecated singletons
# TODO: get final deprecation text before shipping!
MEMO_DEPRECATION_TEXT = "st.experimental_singleton was renamed to st.cache_resource. Please use this new command. The behavior did not change, so you can just replace it. More information here."
SINGLETON_DEPRECATION_TEXT = "st.experimental_memo was renamed to st.cache_data. Please use this new command. The behavior did not change, so you can just replace it. More information here. "

experimental_memo = deprecate_object_with_console_warning(
    cache_data, MEMO_DEPRECATION_TEXT
)
experimental_singleton = deprecate_object_with_console_warning(
    cache_resource, SINGLETON_DEPRECATION_TEXT
)
