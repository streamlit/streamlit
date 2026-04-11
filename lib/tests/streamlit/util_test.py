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

import copy
import json
import random
import unittest

import pytest

from streamlit import util
from streamlit.util import AttributeDictionary, ReadOnlyAttributeDictionary


class UtilTest(unittest.TestCase):
    """Test Streamlit utility functions."""

    def test_memoization(self):
        """Test that util.memoize works."""

        def non_memoized_func():
            return random.randint(0, 1000000)

        yes_memoized_func = util.memoize(non_memoized_func)
        assert non_memoized_func() != non_memoized_func()
        assert yes_memoized_func() == yes_memoized_func()

    def test_functools_wraps(self):
        """Test wrap for functools.wraps"""

        import streamlit as st

        @st.cache_data
        def f():
            return True

        assert hasattr(f, "__wrapped__")

    def test_calc_md5_can_handle_bytes_and_strings(self):
        assert util.calc_md5("eventually bytes") == util.calc_md5(b"eventually bytes")


# Pytest-style tests for ReadOnlyAttributeDictionary


class TestReadOnlyAttributeDictionary:
    """Test ReadOnlyAttributeDictionary class."""

    def test_attribute_access(self) -> None:
        """Test that attribute-style access works for reading values."""
        d = ReadOnlyAttributeDictionary({"a": 1, "b": {"c": 2}})
        assert d.a == 1
        assert d.b.c == 2

    def test_dict_access(self) -> None:
        """Test that dict-style access works for reading values."""
        d = ReadOnlyAttributeDictionary({"a": 1, "b": {"c": 2}})
        assert d["a"] == 1
        assert d["b"]["c"] == 2

    def test_isinstance_attribute_dictionary(self) -> None:
        """Test that ReadOnlyAttributeDictionary is an instance of AttributeDictionary."""
        d = ReadOnlyAttributeDictionary({"a": 1})
        assert isinstance(d, AttributeDictionary)
        assert isinstance(d, dict)

    @pytest.mark.parametrize(
        ("operation", "mutation_func"),
        [
            ("setattr", lambda d: setattr(d, "a", 2)),
            ("setitem", lambda d: d.__setitem__("a", 2)),
            ("delitem", lambda d: d.__delitem__("a")),
            ("clear", lambda d: d.clear()),
            ("pop", lambda d: d.pop("a")),
            ("popitem", lambda d: d.popitem()),
            ("setdefault", lambda d: d.setdefault("b", 2)),
            ("update", lambda d: d.update({"b": 2})),
            ("ior", lambda d: d.__ior__({"b": 2})),
            ("nested_setattr", lambda d: setattr(d.selection, "rows", [3, 4])),
            (
                "nested_bracket_setitem",
                lambda d: d["selection"].__setitem__("rows", [3, 4]),
            ),
        ],
        ids=[
            "setattr",
            "setitem",
            "delitem",
            "clear",
            "pop",
            "popitem",
            "setdefault",
            "update",
            "ior",
            "nested_attr",
            "nested_bracket",
        ],
    )
    def test_mutation_raises_typeerror(
        self, operation: str, mutation_func: object
    ) -> None:
        """Test that mutation operations raise TypeError with helpful message."""
        d = ReadOnlyAttributeDictionary({"a": 1, "selection": {"rows": [1, 2]}})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            mutation_func(d)  # type: ignore[operator]

    def test_bracket_access_returns_readonly(self) -> None:
        """Test that bracket access to nested dicts returns ReadOnlyAttributeDictionary."""
        d = ReadOnlyAttributeDictionary({"a": 1, "b": {"c": 2}})
        nested = d["b"]
        assert isinstance(nested, ReadOnlyAttributeDictionary)

    def test_attribute_access_returns_readonly(self) -> None:
        """Test that attribute access to nested dicts returns ReadOnlyAttributeDictionary."""
        d = ReadOnlyAttributeDictionary({"a": 1, "b": {"c": 2}})
        nested = d.b
        assert isinstance(nested, ReadOnlyAttributeDictionary)

    def test_deepcopy(self) -> None:
        """Test that deepcopy works and returns a ReadOnlyAttributeDictionary."""
        original = ReadOnlyAttributeDictionary({"a": 1, "b": {"c": [1, 2, 3]}})
        copied = copy.deepcopy(original)

        assert copied == original
        assert copied is not original
        assert isinstance(copied, ReadOnlyAttributeDictionary)
        # Verify nested objects are also copied
        assert copied["b"] is not original["b"]
        assert copied["b"]["c"] is not original["b"]["c"]

    def test_shallow_copy(self) -> None:
        """Test that shallow copy works and returns a ReadOnlyAttributeDictionary."""
        original = ReadOnlyAttributeDictionary({"a": 1, "b": [1, 2, 3]})
        copied = copy.copy(original)

        assert copied == original
        assert copied is not original
        assert isinstance(copied, ReadOnlyAttributeDictionary)
        # Shallow copy shares nested mutable objects
        assert copied["b"] is original["b"]

    def test_json_serialization(self) -> None:
        """Test that JSON serialization works correctly."""

        d = ReadOnlyAttributeDictionary(
            {"selection": {"rows": [1, 2], "columns": ["a"]}}
        )
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        assert deserialized == {"selection": {"rows": [1, 2], "columns": ["a"]}}
