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

    def test_setattr_raises_typeerror(self) -> None:
        """Test that setting attributes raises TypeError with helpful message."""
        d = ReadOnlyAttributeDictionary({"a": 1})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            d.a = 2

    def test_setitem_raises_typeerror(self) -> None:
        """Test that setting items raises TypeError with helpful message."""
        d = ReadOnlyAttributeDictionary({"a": 1})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            d["a"] = 2

    def test_delitem_raises_typeerror(self) -> None:
        """Test that deleting items raises TypeError."""
        d = ReadOnlyAttributeDictionary({"a": 1})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            del d["a"]

    def test_clear_raises_typeerror(self) -> None:
        """Test that clear() raises TypeError."""
        d = ReadOnlyAttributeDictionary({"a": 1})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            d.clear()

    def test_pop_raises_typeerror(self) -> None:
        """Test that pop() raises TypeError."""
        d = ReadOnlyAttributeDictionary({"a": 1})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            d.pop("a")

    def test_update_raises_typeerror(self) -> None:
        """Test that update() raises TypeError."""
        d = ReadOnlyAttributeDictionary({"a": 1})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            d.update({"b": 2})

    def test_nested_modification_raises_typeerror(self) -> None:
        """Test that modifying nested ReadOnlyAttributeDictionary raises TypeError."""
        d = ReadOnlyAttributeDictionary({"selection": {"rows": [1, 2]}})
        with pytest.raises(TypeError, match="Widget state is read-only"):
            d.selection.rows = [3, 4]

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
        import json

        d = ReadOnlyAttributeDictionary(
            {"selection": {"rows": [1, 2], "columns": ["a"]}}
        )
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        assert deserialized == {"selection": {"rows": [1, 2], "columns": ["a"]}}
