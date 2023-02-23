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

"""Unit tests for InMemoryCacheStorageWrapper"""
import unittest

from parameterized import parameterized

from streamlit.runtime.caching.storage import CacheStorage, CacheStorageContext
from streamlit.runtime.caching.storage.dummy_cache_storage import DummyCacheStorage
from streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper import (
    InMemoryCacheStorageWrapper,
)
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorage,
)

context = CacheStorageContext(
    function_key="func-key",
    function_display_name="func-display-name",
    persist="disk",
)
local_disk_cache_storage = LocalDiskCacheStorage(context)
dummy_cache_storage = DummyCacheStorage()


class InMemoryCacheStorageWrapperTest(unittest.TestCase):
    """Unit tests for InMemoryCacheStorageWrapper"""

    @parameterized.expand([(local_disk_cache_storage,), (dummy_cache_storage,)])
    def test_in_memory_cache_storage_wrapper_works_with_any_storage(
        self, storage: CacheStorage
    ):
        """
        InMemoryCacheStorageWrapper should work with any storage without raising
        an exception
        """
        InMemoryCacheStorageWrapper(persist_storage=storage, context=context)
