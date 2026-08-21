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

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest import TestCase
from unittest.mock import MagicMock, patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_utils
from streamlit.runtime.caching.cache_utils import (
    BoundCachedFunc,
    Cache,
    CachedFunc,
    CachedFuncInfo,
    _get_positional_arg_name,
    get_session_id_or_throw,
)
from streamlit.runtime.scriptrunner_utils import script_run_context
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Callable


@pytest.fixture(autouse=True)
def _reset_multiplier_warnings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Isolate the warn-once set so a failed test cannot leak into later ones."""
    monkeypatch.setattr(
        cache_utils, "_warned_background_refresh_ttl_multipliers", set()
    )


def test_background_refresh_ttl_multiplier_defaults_to_two() -> None:
    """The default background-refresh TTL multiplier is 2.0."""
    assert cache_utils._get_background_refresh_ttl_multiplier() == 2.0


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        pytest.param(3, 3.0, id="integer"),
        pytest.param(3.5, 3.5, id="float"),
        pytest.param("4.5", 4.5, id="float_string"),
    ],
)
def test_background_refresh_ttl_multiplier_accepts_numeric_representations(
    value: object, expected: float
) -> None:
    """Quoted and unquoted TOML numbers must produce the same multiplier.

    ``config.get_option`` returns the raw parsed value rather than coercing it to
    the declared type.
    """
    with patch_config_options({"runner.cacheBackgroundRefreshTTLMultiplier": value}):
        assert cache_utils._get_background_refresh_ttl_multiplier() == expected


@pytest.mark.parametrize(
    "value",
    [
        pytest.param(True, id="bool_true"),
        pytest.param(None, id="none"),
        pytest.param("not-a-number", id="text"),
        pytest.param(float("nan"), id="nan"),
        pytest.param(float("inf"), id="infinity"),
        pytest.param(1, id="one"),
        pytest.param(0, id="zero"),
        pytest.param(-1, id="negative"),
    ],
)
def test_background_refresh_ttl_multiplier_falls_back_for_invalid_values(
    value: object,
) -> None:
    """Malformed values fall back to 2.0 and warn, rather than breaking cache creation."""
    with (
        patch.object(cache_utils._LOGGER, "warning") as mock_warning,
        patch_config_options({"runner.cacheBackgroundRefreshTTLMultiplier": value}),
    ):
        assert cache_utils._get_background_refresh_ttl_multiplier() == 2.0

    mock_warning.assert_called_once()


def test_background_refresh_ttl_multiplier_warns_once_per_invalid_value() -> None:
    """One bad value can be read for many cache creations, so it must not flood the log."""
    with (
        patch.object(cache_utils._LOGGER, "warning") as mock_warning,
        patch_config_options(
            {"runner.cacheBackgroundRefreshTTLMultiplier": "bad-repeat"}
        ),
    ):
        assert cache_utils._get_background_refresh_ttl_multiplier() == 2.0
        assert cache_utils._get_background_refresh_ttl_multiplier() == 2.0

    mock_warning.assert_called_once_with(
        "Ignoring runner.cacheBackgroundRefreshTTLMultiplier=%s: %s Falling "
        "back to the default multiplier of %s.",
        "'bad-repeat'",
        "it must be a finite number greater than 1.0 and produce a finite "
        "hard-expiration TTL.",
        2.0,
    )


def test_background_refresh_ttl_multiplier_overflow_uses_default() -> None:
    """A finite multiplier that overflows ``ttl * multiplier`` falls back to the default."""
    with (
        patch.object(cache_utils._LOGGER, "warning") as mock_warning,
        patch_config_options({"runner.cacheBackgroundRefreshTTLMultiplier": 1e308}),
    ):
        assert cache_utils._get_background_refresh_hard_ttl(10) == 20

    mock_warning.assert_called_once_with(
        "Ignoring runner.cacheBackgroundRefreshTTLMultiplier=%s: %s Falling "
        "back to the default multiplier of %s.",
        "1e+308",
        "ttl * multiplier overflows to infinity.",
        2.0,
    )


def test_multiplier_does_not_affect_foreground_caches() -> None:
    """The multiplier only applies to refresh_mode="background"."""
    with patch_config_options({"runner.cacheBackgroundRefreshTTLMultiplier": 4.0}):
        assert cache_utils.get_hard_ttl_seconds("foreground", 100) == 100


def function_for_testing(
    pos_one: int, pos_two: int, _scope: str, pos_three: int
) -> str:
    """Dummy function for testing function caches."""
    return f"{pos_one}-{pos_two}-{_scope}-{pos_three}"


class GetSessionIdOrThrowTest(TestCase):
    def test_returns_session_when_ctx_set(self):
        """A session ID should be returned when there is a context."""
        fake_session_id = "abcd"
        with patch.object(script_run_context, "get_script_run_ctx") as mock_get_ctx:
            mock_get_ctx.return_value.session_id = fake_session_id
            assert get_session_id_or_throw() == fake_session_id

    def test_raises_exception_when_ctx_unset(self):
        """An exception should be thrown when there is no context."""
        with patch.object(script_run_context, "get_script_run_ctx") as mock_get_ctx:
            mock_get_ctx.return_value = None
            with pytest.raises(StreamlitAPIException):
                get_session_id_or_throw()


def _func_positional(first: int, second: str, third: float) -> None:
    pass


def _func_with_kwonly(a: int, *, kwonly: str) -> None:
    pass


def _func_with_varargs(a: int, *args: str) -> None:
    pass


@pytest.mark.parametrize(
    ("func", "arg_index", "expected"),
    [
        (_func_positional, 0, "first"),
        (_func_positional, 1, "second"),
        (_func_positional, 2, "third"),
        (_func_positional, -1, None),
        (_func_positional, 3, None),
        (_func_with_kwonly, 0, "a"),
        (_func_with_kwonly, 1, None),
        (_func_with_varargs, 0, "a"),
        (_func_with_varargs, 1, None),
    ],
    ids=[
        "first_positional",
        "second_positional",
        "third_positional",
        "negative_index",
        "out_of_range",
        "before_kwonly",
        "kwonly_param",
        "before_varargs",
        "varargs_param",
    ],
)
def test_get_positional_arg_name(
    func: Callable[..., Any], arg_index: int, expected: str | None
) -> None:
    """Returns the parameter name for positional args, None otherwise."""
    assert _get_positional_arg_name(func, arg_index) == expected


def _placeholder_func() -> None:
    """Stand-in for a cached function in tests that only need a reference."""


def _make_info() -> CachedFuncInfo[[], None]:
    return CachedFuncInfo(func=_placeholder_func, hash_funcs=None, show_spinner=False)


@pytest.mark.parametrize(
    "call",
    [
        lambda: Cache().read_result("k"),
        lambda: Cache().write_result("k", "v", []),
        lambda: Cache()._clear(key=None),
        lambda: _make_info().cache_type,
        lambda: _make_info().cached_message_replay_ctx,
        lambda: _make_info().get_function_cache("function_key"),
    ],
    ids=[
        "Cache.read_result",
        "Cache.write_result",
        "Cache._clear",
        "CachedFuncInfo.cache_type",
        "CachedFuncInfo.cached_message_replay_ctx",
        "CachedFuncInfo.get_function_cache",
    ],
)
def test_abstract_members_raise_not_implemented(call: Callable[[], Any]) -> None:
    """Abstract members of the base ``Cache`` / ``CachedFuncInfo`` classes raise."""
    with pytest.raises(NotImplementedError):
        call()


def _build_cached_func() -> CachedFunc[..., Any]:
    info = MagicMock(spec=CachedFuncInfo)
    info.func = _placeholder_func
    info.cache_type = MagicMock(name="cache_type")
    return CachedFunc(info)


def test_cached_func_repr_and_descriptor_protocol() -> None:
    """``CachedFunc.__repr__`` includes the wrapped function, and ``__get__``
    on the class (instance is ``None``) returns ``self``."""
    cached_func = _build_cached_func()

    assert "CachedFunc:" in repr(cached_func)
    assert cached_func.__get__(None, owner=object) is cached_func


def test_bound_cached_func_repr_includes_instance_and_function() -> None:
    """``BoundCachedFunc.__repr__`` includes both the wrapped function and the
    bound instance for easy debugging when inspecting cached methods."""

    class _Sentinel:
        def __repr__(self) -> str:
            return "instance_repr"

    bound = BoundCachedFunc(_build_cached_func(), _Sentinel())
    repr_str = repr(bound)
    assert "BoundCachedFunc:" in repr_str
    assert "instance_repr" in repr_str


def test_cache_clear_only_removes_specified_key() -> None:
    """``Cache.clear(key=...)`` removes the named lock and dispatches to
    ``_clear``; other locks survive and ``clear()`` removes everything."""
    cleared_keys: list[str | None] = []

    class _ConcreteCache(Cache[Any]):
        def _clear(self, key: str | None = None) -> None:
            cleared_keys.append(key)

    cache = _ConcreteCache()
    cache.compute_value_lock("keep_me")
    cache.compute_value_lock("remove_me")

    cache.clear(key="remove_me")
    assert "remove_me" not in cache._value_locks
    assert "keep_me" in cache._value_locks
    assert cleared_keys == ["remove_me"]

    cache.clear()
    assert cache._value_locks == {}
    assert cleared_keys == ["remove_me", None]
