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

from unittest.mock import MagicMock

import pytest

from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.lib.skeleton_placeholder import SkeletonPlaceholder
from streamlit.errors import NoSessionContext
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto


def _make_skeleton_placeholder() -> SkeletonPlaceholder:
    """Build a ``SkeletonPlaceholder`` with a mocked parent/DeltaGenerator.

    Returns
    -------
    SkeletonPlaceholder
        A placeholder whose internal ``_dg`` is the ``MagicMock`` returned by
        ``parent._enqueue``, allowing delegation and context-manager behavior to
        be tested without a live runtime.
    """
    parent = MagicMock()
    return SkeletonPlaceholder(parent, SkeletonProto(), None)


def test_getattr_private_attribute_raises_attribute_error() -> None:
    """`__getattr__` raises ``AttributeError`` for unknown underscore attributes."""
    placeholder = _make_skeleton_placeholder()

    # Use a variable (not a string literal) so ruff does not rewrite the
    # getattr call into direct attribute access.
    private_name = "_nonexistent_private"
    with pytest.raises(AttributeError):
        getattr(placeholder, private_name)


def test_getattr_delegates_public_attribute_to_delta_generator() -> None:
    """`__getattr__` delegates non-underscore attributes to the internal ``_dg``."""
    placeholder = _make_skeleton_placeholder()
    placeholder._dg.some_public_attribute = "delegated-value"

    assert placeholder.some_public_attribute == "delegated-value"


def test_dir_returns_delta_generator_members() -> None:
    """`__dir__` exposes the ``DeltaGenerator`` interface for autocompletion."""
    placeholder = _make_skeleton_placeholder()

    assert placeholder.__dir__() == dir(DeltaGenerator)


def test_enter_without_session_context_returns_self_without_timer() -> None:
    """`__enter__` returns self and starts no timer when there is no session context.

    When ``_transient`` raises ``NoSessionContext`` (i.e. not running inside a
    script thread), the context manager must swallow the error and skip the
    delayed-skeleton timer.
    """
    placeholder = _make_skeleton_placeholder()
    placeholder._dg._transient.side_effect = NoSessionContext("no session")

    result = placeholder.__enter__()

    assert result is placeholder
    assert placeholder._timer is None
