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

import unittest
from unittest.mock import MagicMock

from cachetools import TTLCache

from streamlit.runtime.memory_session_storage import MemorySessionStorage


class MemorySessionStorageTest(unittest.TestCase):
    """Test MemorySessionStorage.

    These tests are intentionally extremely simple to ensure that we don't just end up
    testing cachetools.TTLCache. We try to just verify that we've wrapped TTLCache
    correctly, and in particular we avoid testing cache expiry functionality.
    """

    def test_uses_ttl_cache(self):
        """Verify that the backing cache of a MemorySessionStorage is a TTLCache.

        We do this because we're intentionally avoiding writing tests around cache
        expiry because the cachetools library should do this for us. In the case
        that the backing cache for a MemorySessionStorage ever changes, we'll likely be
        responsible for adding our own tests.
        """
        store = MemorySessionStorage()
        self.assertIsInstance(store._cache, TTLCache)

    def test_get(self):
        store = MemorySessionStorage()
        store._cache["foo"] = "bar"

        self.assertEqual(store.get("foo"), "bar")
        self.assertEqual(store.get("baz"), None)

    def test_save(self):
        store = MemorySessionStorage()
        session_info = MagicMock()
        session_info.session.id = "foo"

        store.save(session_info)
        self.assertEqual(store.get("foo"), session_info)

    def test_delete(self):
        store = MemorySessionStorage()
        store._cache["foo"] = "bar"

        store.delete("foo")
        self.assertEqual(store.get("foo"), None)

    def test_list(self):
        store = MemorySessionStorage()
        store._cache["foo"] = "bar"
        store._cache["baz"] = "qux"

        self.assertEqual(store.list(), ["bar", "qux"])
