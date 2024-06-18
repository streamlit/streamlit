# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, Any

from streamlit.runtime.caching.cache_data_api import (
    CACHE_DATA_MESSAGE_REPLAY_CTX,
    CacheDataAPI,
    get_data_cache_stats_provider,
)
from streamlit.runtime.caching.cache_errors import CACHE_DOCS_URL
from streamlit.runtime.caching.cache_resource_api import (
    CACHE_RESOURCE_MESSAGE_REPLAY_CTX,
    CacheResourceAPI,
    get_resource_cache_stats_provider,
)
from streamlit.runtime.caching.legacy_cache_api import cache as _cache

if TYPE_CHECKING:
    from google.protobuf.message import Message

    from streamlit.proto.Block_pb2 import Block
    from streamlit.runtime.state.common import WidgetMetadata


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
    CACHE_DATA_MESSAGE_REPLAY_CTX.save_element_message(
        delta_type, element_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    CACHE_RESOURCE_MESSAGE_REPLAY_CTX.save_element_message(
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
    CACHE_DATA_MESSAGE_REPLAY_CTX.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    CACHE_RESOURCE_MESSAGE_REPLAY_CTX.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )


def save_widget_metadata(metadata: WidgetMetadata[Any]) -> None:
    """Save a widget's metadata to a thread-local callstack, so the widget
    can be registered again when that widget is replayed.
    """
    CACHE_DATA_MESSAGE_REPLAY_CTX.save_widget_metadata(metadata)
    CACHE_RESOURCE_MESSAGE_REPLAY_CTX.save_widget_metadata(metadata)


def save_media_data(image_data: bytes | str, mimetype: str, image_id: str) -> None:
    CACHE_DATA_MESSAGE_REPLAY_CTX.save_image_data(image_data, mimetype, image_id)
    CACHE_RESOURCE_MESSAGE_REPLAY_CTX.save_image_data(image_data, mimetype, image_id)


# Create and export public API singletons.
cache_data = CacheDataAPI(decorator_metric_name="cache_data")
cache_resource = CacheResourceAPI(decorator_metric_name="cache_resource")
# TODO(lukasmasuch): This is the legacy cache API name which is deprecated
# and it should be removed in the future.
cache = _cache

# Deprecated singletons
_MEMO_WARNING = (
    f"`st.experimental_memo` is deprecated. Please use the new command `st.cache_data` instead, "
    f"which has the same behavior. More information [in our docs]({CACHE_DOCS_URL})."
)

experimental_memo = CacheDataAPI(
    decorator_metric_name="experimental_memo", deprecation_warning=_MEMO_WARNING
)

_SINGLETON_WARNING = (
    f"`st.experimental_singleton` is deprecated. Please use the new command `st.cache_resource` instead, "
    f"which has the same behavior. More information [in our docs]({CACHE_DOCS_URL})."
)

experimental_singleton = CacheResourceAPI(
    decorator_metric_name="experimental_singleton",
    deprecation_warning=_SINGLETON_WARNING,
)


__all__ = [
    "cache",
    "CACHE_DOCS_URL",
    "save_element_message",
    "save_block_message",
    "save_widget_metadata",
    "save_media_data",
    "get_data_cache_stats_provider",
    "get_resource_cache_stats_provider",
    "cache_data",
    "cache_resource",
    "experimental_memo",
    "experimental_singleton",
]
