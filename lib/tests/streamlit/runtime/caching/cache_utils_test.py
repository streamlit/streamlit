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

from typing import TYPE_CHECKING
from unittest import TestCase
from unittest.mock import patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching.cache_utils import (
    _get_positional_arg_name,
    get_session_id_or_throw,
)
from streamlit.runtime.scriptrunner_utils import script_run_context

if TYPE_CHECKING:
    from collections.abc import Callable
    from typing import Any


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
