# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Tests for refresh_type="background" behavior of st.cache_data and
st.cache_resource.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING
from unittest.mock import Mock, patch

import pytest
from parameterized import parameterized

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import (
    cache_data,
    cache_data_api,
    cache_resource,
    cache_resource_api,
)
from streamlit.runtime.caching.background_refresh import (
    get_background_refresh_coordinator,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase

if TYPE_CHECKING:
    from collections.abc import Callable


def _sync_schedule(refresh_key: object, refresh_fn: Callable[[], None]) -> None:
    """A drop-in replacement that runs refreshes synchronously for tests."""
    refresh_fn()


_BG_PARAMS = [("cache_data", cache_data), ("cache_resource", cache_resource)]


class BackgroundRefreshBehaviorTest(DeltaGeneratorTestCase):
    """Behavior tests for refresh_type="background"."""

    def tearDown(self) -> None:
        cache_data.clear()
        cache_resource.clear()
        # Avoid leaking background threads across tests.
        get_background_refresh_coordinator().shutdown()
        super().tearDown()

    @parameterized.expand(_BG_PARAMS)
    @patch(
        "streamlit.runtime.caching.background_refresh.schedule_background_refresh",
        _sync_schedule,
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_serves_stale_then_refreshes(
        self, _: str, cache_decorator: object, timer: Mock
    ) -> None:
        """A stale entry is returned immediately and refreshed in the background."""
        call_count = [0]

        @cache_decorator(ttl=100, refresh_type="background")
        def foo() -> int:
            call_count[0] += 1
            return call_count[0]

        # First call: compute and cache.
        timer.return_value = 0
        assert foo() == 1
        assert call_count[0] == 1

        # Within ttl: cache hit, no recompute.
        timer.return_value = 50
        assert foo() == 1
        assert call_count[0] == 1

        # After ttl: the stale value is returned immediately, and the (synchronous,
        # for this test) background refresh recomputes the value.
        timer.return_value = 150
        assert foo() == 1
        assert call_count[0] == 2

        # The next call returns the freshly refreshed value without recomputing.
        timer.return_value = 160
        assert foo() == 2
        assert call_count[0] == 2

    @parameterized.expand(_BG_PARAMS)
    @patch(
        "streamlit.runtime.caching.background_refresh.schedule_background_refresh",
        _sync_schedule,
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_no_spinner_on_stale_hit(
        self, _: str, cache_decorator: object, timer: Mock
    ) -> None:
        """Returning a stale value must not show a spinner."""

        @cache_decorator(ttl=100, refresh_type="background", show_spinner=True)
        def foo() -> int:
            return 42

        # First call is a miss and may enqueue a spinner.
        timer.return_value = 0
        assert foo() == 42

        # Clear anything enqueued by the miss (e.g. the spinner).
        self.clear_queue()

        # A stale hit returns immediately and must not enqueue a spinner.
        timer.return_value = 150
        assert foo() == 42
        assert self.forward_msg_queue.is_empty()

    @parameterized.expand(_BG_PARAMS)
    @patch(
        "streamlit.runtime.caching.background_refresh.schedule_background_refresh",
        _sync_schedule,
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_failed_refresh_evicts_and_logs(
        self, _: str, cache_decorator: object, timer: Mock
    ) -> None:
        """A failed background refresh logs a warning and evicts the stale entry."""
        call_count = [0]

        @cache_decorator(ttl=100, refresh_type="background")
        def foo() -> str:
            call_count[0] += 1
            if call_count[0] == 1:
                return "v1"
            raise RuntimeError("boom")

        timer.return_value = 0
        assert foo() == "v1"

        # After ttl: stale value returned, background refresh fails -> warning + evict.
        timer.return_value = 150
        with self.assertLogs(
            "streamlit.runtime.caching.cache_utils", level="WARNING"
        ) as logs:
            assert foo() == "v1"
        assert any("Background refresh failed" in msg for msg in logs.output)
        assert call_count[0] == 2

        # The stale entry was evicted, so the next call recomputes in the
        # foreground and surfaces the error to the user.
        timer.return_value = 160
        with pytest.raises(RuntimeError):
            foo()
        assert call_count[0] == 3

    @parameterized.expand(
        [
            ("cache_data", cache_data, cache_data_api),
            ("cache_resource", cache_resource, cache_resource_api),
        ]
    )
    @patch(
        "streamlit.runtime.caching.background_refresh.schedule_background_refresh",
        _sync_schedule,
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_session_scope_background_refresh(
        self, _: str, cache_decorator: object, cache_module: object, timer: Mock
    ) -> None:
        """Background refresh works with a session-scoped cache."""
        call_count = [0]

        @cache_decorator(ttl=100, refresh_type="background", scope="session")
        def foo() -> int:
            call_count[0] += 1
            return call_count[0]

        with patch.object(
            cache_module, "get_session_id_or_throw", return_value="session-1"
        ):
            timer.return_value = 0
            assert foo() == 1

            # After ttl: stale value served, background refresh recomputes.
            timer.return_value = 150
            assert foo() == 1
            assert call_count[0] == 2

            timer.return_value = 160
            assert foo() == 2

    @patch(
        "streamlit.runtime.caching.background_refresh.schedule_background_refresh",
        _sync_schedule,
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_resource_validate_failure_with_background(self, timer: Mock) -> None:
        """A failed validate on a background-refresh resource cache triggers a
        foreground recompute.
        """
        validate_ok = [True]
        call_count = [0]

        @cache_resource(
            ttl=100,
            refresh_type="background",
            validate=lambda _value: validate_ok[0],
        )
        def foo() -> int:
            call_count[0] += 1
            return call_count[0]

        timer.return_value = 0
        assert foo() == 1
        assert call_count[0] == 1

        # The entry is still fresh, but validate now fails, so it is treated as a
        # miss and recomputed in the foreground.
        validate_ok[0] = False
        timer.return_value = 50
        assert foo() == 2
        assert call_count[0] == 2

    @patch(
        "streamlit.runtime.caching.background_refresh.schedule_background_refresh",
        _sync_schedule,
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_resource_validate_failure_does_not_call_on_release(
        self, timer: Mock
    ) -> None:
        """A failed validate must not call on_release, mirroring the foreground
        path (which deletes the invalid entry without releasing it).
        """
        released: list[int] = []
        validate_ok = [True]
        call_count = [0]

        @cache_resource(
            ttl=100,
            refresh_type="background",
            validate=lambda _value: validate_ok[0],
            on_release=released.append,
        )
        def foo() -> int:
            call_count[0] += 1
            return call_count[0]

        timer.return_value = 0
        assert foo() == 1

        # Validate now fails, so the entry is treated as a miss and recomputed,
        # but on_release must not fire for the invalid entry.
        validate_ok[0] = False
        timer.return_value = 50
        assert foo() == 2
        assert released == []

    @patch(
        "streamlit.runtime.caching.background_refresh.schedule_background_refresh",
        _sync_schedule,
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_resource_background_refresh_releases_replaced_value(
        self, timer: Mock
    ) -> None:
        """A successful background refresh releases the previous resource it
        replaces, matching the foreground behavior where an expired entry is
        released before being recomputed.
        """
        released: list[int] = []
        call_count = [0]

        @cache_resource(ttl=100, refresh_type="background", on_release=released.append)
        def foo() -> int:
            call_count[0] += 1
            return call_count[0]

        timer.return_value = 0
        assert foo() == 1
        # The initial computation has no previous value to release.
        assert released == []

        # After ttl: the stale value (1) is replaced by the refreshed value (2),
        # so the previous resource must be released.
        timer.return_value = 150
        assert foo() == 1
        assert call_count[0] == 2
        assert released == [1]

    @parameterized.expand(_BG_PARAMS)
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_real_background_thread_refresh(
        self, _: str, cache_decorator: object, timer: Mock
    ) -> None:
        """End-to-end test exercising the real background thread pool."""
        call_count = [0]

        @cache_decorator(ttl=100, refresh_type="background")
        def foo() -> int:
            call_count[0] += 1
            return call_count[0]

        timer.return_value = 0
        assert foo() == 1

        # After ttl: stale value returned immediately; refresh runs on a real thread.
        timer.return_value = 150
        assert foo() == 1

        # Wait for the background refresh to recompute the value.
        deadline = time.monotonic() + 5
        while call_count[0] < 2 and time.monotonic() < deadline:
            time.sleep(0.01)
        assert call_count[0] == 2, "Background refresh did not run"

        # The next call returns the freshly refreshed value.
        timer.return_value = 160
        assert foo() == 2
        assert call_count[0] == 2


@pytest.mark.parametrize("cache_decorator", [cache_data, cache_resource])
def test_background_requires_ttl(cache_decorator: object) -> None:
    """refresh_type="background" without a ttl raises a StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException, match="requires a ttl"):

        @cache_decorator(refresh_type="background")
        def foo() -> int:
            return 1


@pytest.mark.parametrize("cache_decorator", [cache_data, cache_resource])
def test_invalid_refresh_type_raises(cache_decorator: object) -> None:
    """An unsupported refresh_type value raises a StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException, match="Unsupported refresh_type"):

        @cache_decorator(ttl=100, refresh_type="eager")
        def foo() -> int:
            return 1


def test_cache_data_background_with_persist_raises() -> None:
    """refresh_type="background" combined with persist raises an exception."""
    with pytest.raises(StreamlitAPIException, match="cannot be used with persist"):

        @cache_data(ttl=100, refresh_type="background", persist="disk")
        def foo() -> int:
            return 1
