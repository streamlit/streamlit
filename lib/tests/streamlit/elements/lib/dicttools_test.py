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

import unittest
from typing import Any

import pytest
from parameterized import parameterized

from streamlit.elements.lib.dicttools import remove_none_values, unflatten


class DictToolsTest(unittest.TestCase):
    @parameterized.expand(
        [
            ({}, {}),
            ({"a": 1, "b": 2}, {"a": 1, "b": 2}),
            ({"a": 1, "b": None}, {"a": 1}),
            ({"a": 1, "b": {"c": None}}, {"a": 1, "b": {}}),
            ({"a": 1, "b": {"c": 2}}, {"a": 1, "b": {"c": 2}}),
            ({"a": 1, "b": {"c": None, "d": 3}}, {"a": 1, "b": {"d": 3}}),
        ]
    )
    def test_remove_none_values(self, input: dict[str, Any], expected: dict[str, Any]):
        """Test remove_none_values."""

        assert remove_none_values(input) == expected, (
            f"Expected {input} to be transformed into {expected}."
        )


@pytest.mark.parametrize(
    ("flat_dict", "expected"),
    [
        ({}, {}),
        ({"foo": 1}, {"foo": 1}),
        ({"foo_bar": 1}, {"foo": {"bar": 1}}),
        (
            {"foo_bar_baz": 123, "foo_bar_biz": 456, "x_bonks": "hi"},
            {"foo": {"bar": {"baz": 123, "biz": 456}}, "x": {"bonks": "hi"}},
        ),
        # Iterables of dicts are recursed into; iterables of non-dicts are passed through.
        (
            {"items": [{"a_b": 1}, {"a_c": 2}]},
            {"items": [{"a": {"b": 1}}, {"a": {"c": 2}}]},
        ),
        ({"values": [1, 2, 3]}, {"values": [1, 2, 3]}),
    ],
    ids=["empty", "flat", "single_split", "nested", "list_of_dicts", "list_of_scalars"],
)
def test_unflatten_without_encodings(
    flat_dict: dict[str, Any], expected: dict[str, Any]
) -> None:
    """Unflatten produces a nested tree from underscore-separated keys."""
    assert unflatten(flat_dict) == expected


@pytest.mark.parametrize(
    ("flat_dict", "encodings", "expected"),
    [
        (
            {"foo_bar_baz": 123, "x_bonks": "hi"},
            {"x"},
            {
                "foo": {"bar": {"baz": 123}},
                "encoding": {"x": {"bonks": "hi"}},
            },
        ),
        (
            {"x_value": 1, "y_value": 2, "other_value": 3},
            {"x", "y"},
            {
                "encoding": {"x": {"value": 1}, "y": {"value": 2}},
                "other": {"value": 3},
            },
        ),
    ],
    ids=["single_encoding", "multiple_encodings_share_key"],
)
def test_unflatten_moves_keys_into_encoding(
    flat_dict: dict[str, Any],
    encodings: set[str],
    expected: dict[str, Any],
) -> None:
    """Keys listed in ``encodings`` are grouped under an auto-created ``encoding`` key."""
    assert unflatten(flat_dict, encodings=encodings) == expected


def test_unflatten_default_encodings_does_not_create_encoding_key() -> None:
    """Without an ``encodings`` argument, no ``encoding`` key is added."""
    assert "encoding" not in unflatten({"foo_bar": 1})
