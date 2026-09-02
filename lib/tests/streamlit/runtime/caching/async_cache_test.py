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
the awaited result (an inert value) rather than the coroutine object. Coroutines
are driven with ``asyncio.run`` to mirror how a user drives them from a script.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import inspect
import threading
from typing import TYPE_CHECKING, Any

import pytest

import streamlit as st
from streamlit.errors import StreamlitIncompatibleParametersError
from streamlit.testing.v1 import AppTest

if TYPE_CHECKING:
    from collections.abc import Callable

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
        StreamlitIncompatibleParametersError,
        match=r"`refresh_mode='background'` and `async function` cannot be used together",
    ):

        @decorator(ttl=60, refresh_mode="background")
        async def load() -> int:
            return 42


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


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_concurrent_same_key_across_event_loops(
    name: str, decorator: Callable
) -> None:
    """Callers on different threads and event loops share one computation."""
    calls: list[int] = []
    callers_ready = threading.Barrier(2)

    @decorator
    async def load(x: int) -> int:
        calls.append(x)
        await asyncio.sleep(0.05)
        return x * 10

    def invoke() -> int:
        callers_ready.wait()
        return asyncio.run(load(4))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: invoke(), range(2)))

    assert results == [40, 40]
    assert calls == [4]


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_failed_owner_wakes_waiter(name: str, decorator: Callable) -> None:
    """A waiter retries after the owner raises instead of waiting indefinitely."""
    calls = 0

    @decorator
    async def load() -> int:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0)
        if calls == 1:
            raise ValueError("first computation failed")
        return 42

    async def main() -> list[int | BaseException]:
        return await asyncio.gather(load(), load(), return_exceptions=True)

    results = asyncio.run(main())
    assert any(
        isinstance(result, ValueError) and str(result) == "first computation failed"
        for result in results
    )
    assert 42 in results
    assert calls == 2


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_cancelled_owner_wakes_waiter(name: str, decorator: Callable) -> None:
    """A waiter retries after the owner is cancelled."""
    calls = 0

    async def main() -> int:
        first_call_started = asyncio.Event()
        keep_first_call_running = asyncio.Event()

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
        await asyncio.sleep(0)

        owner.cancel()
        with pytest.raises(asyncio.CancelledError):
            await owner

        return await asyncio.wait_for(waiter, timeout=1)

    assert asyncio.run(main()) == 42
    assert calls == 2


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
