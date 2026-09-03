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

"""Tests for async-aware @st.cache_data and @st.cache_resource.

These cover decorating coroutine functions (``async def``): the decorator caches
the awaited result rather than the coroutine object. Coroutines are driven with
``asyncio.run`` to mirror how a user drives them from a script.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import inspect
import threading
from typing import TYPE_CHECKING, Any

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.runtime.caching import cache_utils
from streamlit.testing.v1 import AppTest

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Callable

# Both cache decorators, so shared behavior can be parametrized across them.
CACHE_DECORATORS: list[tuple[str, Any]] = [
    ("cache_data", st.cache_data),
    ("cache_resource", st.cache_resource),
]


@pytest.fixture(autouse=True)
def _clear_caches() -> Any:
    """Clear both caches around every test so entries don't leak between tests."""
    st.cache_data.clear()
    st.cache_resource.clear()
    yield
    st.cache_data.clear()
    st.cache_resource.clear()


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_background_refresh_raises(name: str, decorator: Callable) -> None:
    """Coroutine functions reject background refresh at decoration time."""
    with pytest.raises(
        StreamlitValueError,
        match=(
            r'Invalid `refresh_mode` value\. Supported values: "foreground"\. '
            r"Background refresh is not supported for coroutine functions "
            r'\(`async def`\)\. Use `refresh_mode="foreground"` instead\.'
        ),
    ):

        @decorator(ttl=60, refresh_mode="background")
        async def load() -> int:
            return 42


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_generator_function_raises_at_decoration_time(
    name: str, decorator: Callable
) -> None:
    """Async-generator functions are rejected with actionable guidance."""
    with pytest.raises(
        StreamlitAPIException,
        match=(
            r"Async-generator functions cannot be cached.*streams that are one-shot "
            r"iterators.*Consume the async generator and return a materialized result "
            r"from an ordinary coroutine function"
        ),
    ) as exc_info:

        @decorator
        async def stream() -> AsyncIterator[int]:
            yield 42

    assert exc_info.value.error_id == "async-generator-function-not-cacheable"


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_first_call_runs_then_cached(name: str, decorator: Callable) -> None:
    """The body runs on the first await and is skipped (cached) on the second."""
    calls: list[int] = []

    @decorator
    async def load(x: int) -> int:
        calls.append(x)
        await asyncio.sleep(0)
        return x * 10

    assert asyncio.run(load(2)) == 20
    assert asyncio.run(load(2)) == 20
    assert calls == [2]


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_body_runs_once_across_repeated_awaits(
    name: str, decorator: Callable
) -> None:
    """Repeated awaits with the same args run the body exactly once."""
    calls: list[int] = []

    @decorator
    async def load(x: int) -> int:
        calls.append(x)
        await asyncio.sleep(0)
        return x

    async def main() -> list[int]:
        # Await the same key several times sequentially.
        return [await load(7), await load(7), await load(7)]

    assert asyncio.run(main()) == [7, 7, 7]
    assert calls == [7]


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_concurrent_same_key_shares_computation(
    name: str, decorator: Callable
) -> None:
    """Concurrent same-loop callers await one shared same-key computation."""
    calls: list[int] = []

    @decorator
    async def load(x: int) -> int:
        calls.append(x)
        await asyncio.sleep(0)
        return x * 10

    async def main() -> list[int]:
        return await asyncio.gather(load(3), load(3), load(3))

    assert asyncio.run(main()) == [30, 30, 30]
    assert calls == [3]


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_concurrent_same_key_across_event_loops(
    name: str, decorator: Callable, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Callers on different threads and event loops share one computation."""
    calls: list[int] = []
    waiter_registered = threading.Event()
    original_claim = cache_utils.Cache.claim_async_compute

    def tracking_claim(
        cache: cache_utils.Cache[Any], value_key: str
    ) -> tuple[concurrent.futures.Future[None], bool]:
        claim = original_claim(cache, value_key)
        if not claim[1]:
            waiter_registered.set()
        return claim

    monkeypatch.setattr(cache_utils.Cache, "claim_async_compute", tracking_claim)

    @decorator
    async def load(x: int) -> int:
        calls.append(x)
        assert waiter_registered.wait(timeout=1)
        return x * 10

    def invoke() -> int:
        return asyncio.run(load(4))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(invoke)
        second = executor.submit(invoke)
        results = [first.result(timeout=2), second.result(timeout=2)]

    assert results == [40, 40]
    assert calls == [4]


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_failed_owner_wakes_waiter(
    name: str, decorator: Callable, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A waiter retries after the owner raises instead of waiting indefinitely."""
    calls = 0

    async def main() -> list[int | BaseException]:
        owner_started = asyncio.Event()
        waiter_registered = asyncio.Event()
        allow_owner_failure = asyncio.Event()
        original_claim = cache_utils.Cache.claim_async_compute

        def tracking_claim(
            cache: cache_utils.Cache[Any], value_key: str
        ) -> tuple[concurrent.futures.Future[None], bool]:
            claim = original_claim(cache, value_key)
            if not claim[1]:
                waiter_registered.set()
            return claim

        monkeypatch.setattr(cache_utils.Cache, "claim_async_compute", tracking_claim)

        @decorator
        async def load() -> int:
            nonlocal calls
            calls += 1
            if calls == 1:
                owner_started.set()
                await allow_owner_failure.wait()
                raise ValueError("first computation failed")
            return 42

        owner = asyncio.create_task(load())
        await owner_started.wait()
        waiter = asyncio.create_task(load())
        await waiter_registered.wait()
        allow_owner_failure.set()
        return await asyncio.gather(owner, waiter, return_exceptions=True)

    results = asyncio.run(main())
    assert any(
        isinstance(result, ValueError) and str(result) == "first computation failed"
        for result in results
    )
    assert 42 in results
    assert calls == 2


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_cancelled_owner_wakes_waiter(
    name: str, decorator: Callable, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A waiter retries after the owner is cancelled."""
    calls = 0

    async def main() -> int:
        first_call_started = asyncio.Event()
        keep_first_call_running = asyncio.Event()
        waiter_registered = asyncio.Event()
        original_claim = cache_utils.Cache.claim_async_compute

        def tracking_claim(
            cache: cache_utils.Cache[Any], value_key: str
        ) -> tuple[concurrent.futures.Future[None], bool]:
            claim = original_claim(cache, value_key)
            if not claim[1]:
                waiter_registered.set()
            return claim

        monkeypatch.setattr(cache_utils.Cache, "claim_async_compute", tracking_claim)

        @decorator
        async def load() -> int:
            nonlocal calls
            calls += 1
            if calls == 1:
                first_call_started.set()
                await keep_first_call_running.wait()
            return 42

        owner = asyncio.create_task(load())
        await first_call_started.wait()
        waiter = asyncio.create_task(load())
        await waiter_registered.wait()

        owner.cancel()
        with pytest.raises(asyncio.CancelledError):
            await owner

        return await waiter

    assert asyncio.run(main()) == 42
    assert calls == 2


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_cancelled_waiter_does_not_cancel_shared_compute(
    name: str, decorator: Callable, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cancelling one waiter leaves the owner and other waiters running."""
    calls = 0

    async def main() -> list[int]:
        owner_started = asyncio.Event()
        allow_owner_to_finish = asyncio.Event()
        two_waiters_registered = asyncio.Event()
        waiter_count = 0
        original_claim = cache_utils.Cache.claim_async_compute

        def tracking_claim(
            cache: cache_utils.Cache[Any], value_key: str
        ) -> tuple[concurrent.futures.Future[None], bool]:
            nonlocal waiter_count
            claim = original_claim(cache, value_key)
            if not claim[1]:
                waiter_count += 1
                if waiter_count == 2:
                    two_waiters_registered.set()
            return claim

        monkeypatch.setattr(cache_utils.Cache, "claim_async_compute", tracking_claim)

        @decorator
        async def load() -> int:
            nonlocal calls
            calls += 1
            owner_started.set()
            await allow_owner_to_finish.wait()
            return 42

        owner = asyncio.create_task(load())
        await owner_started.wait()
        cancelled_waiter = asyncio.create_task(load())
        surviving_waiter = asyncio.create_task(load())
        await two_waiters_registered.wait()

        cancelled_waiter.cancel()
        with pytest.raises(asyncio.CancelledError):
            await cancelled_waiter

        allow_owner_to_finish.set()
        return await asyncio.gather(owner, surviving_waiter)

    assert asyncio.run(main()) == [42, 42]
    assert calls == 1


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_whole_cache_clear_invalidates_in_flight_async_write(
    name: str, decorator: Callable
) -> None:
    """A pre-clear computation returns to its owner but does not repopulate."""

    async def main() -> tuple[int, int, int]:
        computation_started = asyncio.Event()
        allow_computation_to_finish = asyncio.Event()
        calls = 0

        @decorator
        async def load() -> int:
            nonlocal calls
            calls += 1
            if calls == 1:
                computation_started.set()
                await allow_computation_to_finish.wait()
            return calls

        owner = asyncio.create_task(load())
        await computation_started.wait()
        load.clear()
        allow_computation_to_finish.set()

        owner_result = await owner
        later_result = await load()
        return owner_result, later_result, calls

    assert asyncio.run(main()) == (1, 2, 2)


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_key_clear_only_invalidates_matching_in_flight_async_write(
    name: str, decorator: Callable
) -> None:
    """A key clear discards that key's old write without affecting another key."""

    async def main() -> tuple[list[int], int, int, dict[int, int]]:
        started = {1: asyncio.Event(), 2: asyncio.Event()}
        allow_computations_to_finish = asyncio.Event()
        calls = {1: 0, 2: 0}

        @decorator
        async def load(key: int) -> int:
            calls[key] += 1
            if calls[key] == 1:
                started[key].set()
                await allow_computations_to_finish.wait()
            return key * 10 + calls[key]

        owners = [asyncio.create_task(load(1)), asyncio.create_task(load(2))]
        await asyncio.gather(*(event.wait() for event in started.values()))
        load.clear(1)
        allow_computations_to_finish.set()

        owner_results = await asyncio.gather(*owners)
        matching_key_result = await load(1)
        unrelated_key_result = await load(2)
        return owner_results, matching_key_result, unrelated_key_result, calls

    assert asyncio.run(main()) == ([11, 21], 12, 21, {1: 2, 2: 1})


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_waiter_retries_after_in_flight_async_write_is_cleared(
    name: str, decorator: Callable, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A waiter wakes after the invalidated owner and becomes the retry owner."""

    async def main() -> tuple[list[int], int]:
        computation_started = asyncio.Event()
        allow_computation_to_finish = asyncio.Event()
        waiter_registered = asyncio.Event()
        calls = 0
        original_claim = cache_utils.Cache.claim_async_compute

        def tracking_claim(
            cache: cache_utils.Cache[Any], value_key: str
        ) -> tuple[concurrent.futures.Future[None], bool]:
            claim = original_claim(cache, value_key)
            if not claim[1]:
                waiter_registered.set()
            return claim

        monkeypatch.setattr(cache_utils.Cache, "claim_async_compute", tracking_claim)

        @decorator
        async def load() -> int:
            nonlocal calls
            calls += 1
            if calls == 1:
                computation_started.set()
                await allow_computation_to_finish.wait()
            return calls

        owner = asyncio.create_task(load())
        await computation_started.wait()
        waiter = asyncio.create_task(load())
        await asyncio.wait_for(waiter_registered.wait(), timeout=1)

        load.clear()
        allow_computation_to_finish.set()
        results = await asyncio.gather(owner, waiter)
        return results, calls

    assert asyncio.run(main()) == ([1, 2], 2)


@pytest.mark.timeout(5)
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_clear_is_atomic_with_async_foreground_write(
    name: str, decorator: Callable, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A clear starting after token validation still removes the pending write."""
    write_token_validated = threading.Event()
    allow_write_to_continue = threading.Event()
    clear_reached_storage = threading.Event()
    calls = 0

    @decorator
    async def load() -> int:
        nonlocal calls
        calls += 1
        return calls

    cache = load._info.get_function_cache(load._function_key)
    original_is_current = cache._invalidation_token_is_current
    validation_calls = 0
    validation_call_under_storage_lock = 2 if name == "cache_data" else 1

    def pause_after_validation(
        value_key: str, invalidation_token: cache_utils.CacheInvalidationToken
    ) -> bool:
        nonlocal validation_calls
        is_current = original_is_current(value_key, invalidation_token)
        validation_calls += 1
        if validation_calls == validation_call_under_storage_lock:
            write_token_validated.set()
            assert allow_write_to_continue.wait(timeout=1)
        return is_current

    original_clear = cache._clear

    def track_storage_clear(key: str | None = None) -> None:
        clear_reached_storage.set()
        original_clear(key)

    monkeypatch.setattr(cache, "_invalidation_token_is_current", pause_after_validation)
    monkeypatch.setattr(cache, "_clear", track_storage_clear)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        owner = executor.submit(asyncio.run, load())
        assert write_token_validated.wait(timeout=1)
        clear = executor.submit(load.clear)
        assert clear_reached_storage.wait(timeout=1)
        allow_write_to_continue.set()
        assert owner.result(timeout=1) == 1
        clear.result(timeout=1)

    assert asyncio.run(load()) == 2
    assert calls == 2


@pytest.mark.timeout(5)
def test_invalidated_async_resource_is_not_released_before_owner_returns() -> None:
    """An invalidated resource remains live for the owner that computed it."""
    released: list[object] = []

    async def main() -> object:
        computation_started = asyncio.Event()
        allow_computation_to_finish = asyncio.Event()

        @st.cache_resource(on_release=released.append)
        async def load() -> object:
            computation_started.set()
            await allow_computation_to_finish.wait()
            return object()

        owner = asyncio.create_task(load())
        await computation_started.wait()
        load.clear()
        allow_computation_to_finish.set()
        return await owner

    owner_value = asyncio.run(main())
    assert owner_value is not None
    assert released == []


@pytest.mark.timeout(5)
def test_invalidated_async_data_result_does_not_require_serialization() -> None:
    """An invalidated value can return to its owner without being serialized."""

    async def main() -> Callable[[], int]:
        computation_started = asyncio.Event()
        allow_computation_to_finish = asyncio.Event()

        @st.cache_data
        async def load() -> Callable[[], int]:
            computation_started.set()
            await allow_computation_to_finish.wait()
            return lambda: 42

        owner = asyncio.create_task(load())
        await computation_started.wait()
        load.clear()
        allow_computation_to_finish.set()
        return await owner

    assert asyncio.run(main())() == 42


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_different_args_produce_different_entries(
    name: str, decorator: Callable
) -> None:
    """Different args are cached separately and each runs the body once."""
    calls: list[int] = []

    @decorator
    async def load(x: int) -> int:
        calls.append(x)
        await asyncio.sleep(0)
        return x + 1

    assert asyncio.run(load(1)) == 2
    assert asyncio.run(load(2)) == 3
    # A repeat of an existing arg is a hit and does not re-run the body.
    assert asyncio.run(load(1)) == 2
    assert calls == [1, 2]


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_call_returns_awaitable(name: str, decorator: Callable) -> None:
    """Calling a decorated coroutine function returns an awaitable, not the value."""

    @decorator
    async def load() -> int:
        await asyncio.sleep(0)
        return 42

    awaitable = load()
    assert inspect.isawaitable(awaitable)
    assert asyncio.run(awaitable) == 42


def test_cache_data_async_does_not_raise_unserializable() -> None:
    """cache_data caches the awaited result, not the (unpicklable) coroutine.

    Previously this raised ``UnserializableReturnValueError`` because the decorator
    tried to pickle the returned coroutine object.
    """

    @st.cache_data
    async def load() -> dict[str, str]:
        await asyncio.sleep(0)
        return {"env": "prod"}

    assert asyncio.run(load()) == {"env": "prod"}
    assert asyncio.run(load()) == {"env": "prod"}


def test_cache_resource_async_does_not_raise_coroutine_reuse() -> None:
    """cache_resource re-serves the awaited result without re-awaiting a coroutine.

    Previously the second access raised
    ``RuntimeError: cannot reuse already awaited coroutine`` because the coroutine
    object itself was cached and awaited again.
    """

    @st.cache_resource
    async def load() -> dict[str, str]:
        await asyncio.sleep(0)
        return {"env": "prod"}

    assert asyncio.run(load()) == {"env": "prod"}
    assert asyncio.run(load()) == {"env": "prod"}


def test_cache_resource_async_returns_same_object() -> None:
    """cache_resource returns the identical cached object across awaits."""

    @st.cache_resource
    async def load() -> list[int]:
        await asyncio.sleep(0)
        return [1, 2, 3]

    first = asyncio.run(load())
    second = asyncio.run(load())
    assert first is second


def test_cache_data_async_returns_copies() -> None:
    """cache_data returns an equal-but-distinct copy of the awaited result."""

    @st.cache_data
    async def load() -> list[int]:
        await asyncio.sleep(0)
        return [1, 2, 3]

    first = asyncio.run(load())
    second = asyncio.run(load())
    assert first == second
    # cache_data serializes results, so each caller gets its own copy.
    assert first is not second


def test_async_underscore_arg_is_not_hashed() -> None:
    """Underscore-prefixed args are excluded from the key, as for sync functions."""
    calls: list[int] = []

    @st.cache_data
    async def load(_conn: object, n: int) -> int:
        calls.append(n)
        await asyncio.sleep(0)
        return n

    assert asyncio.run(load(object(), 5)) == 5
    # A different _conn but the same n is still a cache hit (body not re-run).
    assert asyncio.run(load(object(), 5)) == 5
    assert calls == [5]


def test_async_max_entries_still_evicts() -> None:
    """The max_entries option still bounds the async cache and evicts old entries."""
    calls: list[int] = []

    @st.cache_data(max_entries=1)
    async def load(x: int) -> int:
        calls.append(x)
        await asyncio.sleep(0)
        return x

    assert asyncio.run(load(1)) == 1
    # Adding a second entry evicts the first (max_entries=1).
    assert asyncio.run(load(2)) == 2
    # Re-accessing the evicted entry recomputes it.
    assert asyncio.run(load(1)) == 1
    assert calls == [1, 2, 1]


def test_sync_function_path_is_unchanged() -> None:
    """Sync cached functions still return values directly, not awaitables."""

    @st.cache_data
    def load(x: int) -> int:
        return x + 1

    result = load(1)
    assert result == 2
    assert not inspect.isawaitable(result)


def test_async_cached_value_survives_script_rerun() -> None:
    """A rerun reads the awaited value without recomputing the coroutine."""
    app = AppTest.from_file("test_data/async_cache_rerun.py").run()
    assert [text.value for text in app.text] == ["result: 42", "calls: 1"]

    app.run()
    assert [text.value for text in app.text] == ["result: 42", "calls: 1"]
