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

import math

from streamlit.runtime.caching.ttl_cleanup_cache import TTLCleanupCache


def fake_timer() -> float:
    return 1234


class TestTTLCleanupCache:
    def test_releases_when_hits_size(self):
        """Unit test for on_release.

        Tests that on_release is called when entries are removed from the cache due to
        hitting the size limit.
        """
        released_items = []

        def on_release(item: int) -> None:
            released_items.append(item)

        maxsize = 5

        test_cache = TTLCleanupCache(
            maxsize=maxsize, ttl=120, timer=fake_timer, on_release=on_release
        )

        # Add a few elements to the cache.
        for i in range(maxsize):
            test_cache[i] = i + 10

        # No items released yet.
        assert released_items == []
        # Access the third item.
        assert test_cache[2] == 12

        # Add three more items. The first, second, and fourth items should be released.
        for i in range(3):
            test_cache[i + 10] = i + 20

        assert released_items == [10, 11, 13]
        assert test_cache[2] == 12
        assert test_cache[4] == 14
        assert test_cache[10] == 20
        assert test_cache[11] == 21
        assert test_cache[12] == 22

    def test_releases_when_hits_ttl(self):
        """Unit test for on_release.

        Tests that on_release is called when entries are removed from the cache due to
        hitting the TTL.
        """
        released_items = []

        def on_release(item: int) -> None:
            released_items.append(item)

        test_cache = TTLCleanupCache(
            maxsize=500, ttl=0, timer=fake_timer, on_release=on_release
        )

        # Add a few elements to the cache.
        for i in range(5):
            test_cache[i] = i + 10

        # Cache should have released all but the last item. This is an implementation
        # quirk: It releases prior to write, and doesn't check TTL expiration on write.
        assert released_items == [10, 11, 12, 13]

        # Validate that the cache doesn't have the last item, either.
        assert 4 not in test_cache
        # Validate the last item was not released on read. This is a cache quirk: Items
        # are not removed on read.
        assert released_items == [10, 11, 12, 13]

        # Manually expire, and validate the last item will be removed.
        test_cache.expire()
        assert released_items == [10, 11, 12, 13, 14]

    def test_clear_calls_on_release(self):
        """Tests that clear() will call release() on all elements."""
        released_items = []

        def on_release(item: int) -> None:
            released_items.append(item)

        test_cache = TTLCleanupCache(
            maxsize=math.inf, ttl=math.inf, timer=fake_timer, on_release=on_release
        )

        # Add a few elements to the cache.
        for i in range(5):
            test_cache[i] = i + 10

        # No items released yet.
        assert released_items == []
        test_cache.clear()

        assert released_items == [i + 10 for i in range(5)]

    def test_safe_del_calls_release(self):
        """Tests that safe_del() will call release() on elements."""
        released_items = []

        def on_release(item: int) -> None:
            released_items.append(item)

        test_cache = TTLCleanupCache(
            maxsize=math.inf, ttl=math.inf, timer=fake_timer, on_release=on_release
        )

        # Add a few elements to the cache.
        for i in range(5):
            test_cache[i] = i + 10

        # No items released yet.
        assert released_items == []

        test_cache.safe_del(1)
        test_cache.safe_del(3)
        assert released_items == [11, 13]
        assert list(test_cache.keys()) == [0, 2, 4]
