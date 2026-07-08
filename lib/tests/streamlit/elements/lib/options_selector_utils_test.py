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

import enum
import unittest
from typing import Any, cast

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

from streamlit.elements.lib.options_selector_utils import (
    _coerce_enum,
    check_and_convert_to_indices,
    convert_to_sequence_and_check_comparable,
    create_mappings,
    get_default_indices,
    index_,
    maybe_coerce_enum,
    maybe_coerce_enum_sequence,
    resolve_value_against_options,
    validate_and_sync_multiselect_value_with_options,
    validate_and_sync_range_value_with_options,
    validate_and_sync_value_with_options,
    validate_select_widget_filter_mode,
)
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.SelectWidgetFilterMode_pb2 import (
    SelectWidgetFilterMode as ProtoSelectWidgetFilterMode,
)
from streamlit.runtime.state.common import RegisterWidgetResult
from tests.testutil import patch_config_options


class TestCheckAndConvertToIndices:
    def test_check_and_convert_to_indices_none_default(self):
        res = check_and_convert_to_indices(["a"], None)
        assert res is None

    def test_check_and_convert_to_indices_single_default(self):
        res = check_and_convert_to_indices(["a", "b"], "a")
        assert res == [0]

    def test_check_and_convert_to_indices_default_is_numpy_array(self):
        res = check_and_convert_to_indices(["a", "b"], np.array(["b"]))
        assert res == [1]

    def test_check_and_convert_to_indices_default_is_tuple(self):
        res = check_and_convert_to_indices(["a", "b"], ("b",))
        assert res == [1]

    def test_check_and_convert_to_indices_default_is_set(self):
        res = check_and_convert_to_indices(
            ["a", "b"],
            set(
                "b",
            ),
        )
        assert res == [1]

    def test_check_and_convert_to_indices_default_not_in_opts(self):
        with pytest.raises(StreamlitAPIException):
            check_and_convert_to_indices(["a", "b"], "c")


class TestTransformOptions:
    def test_transform_options(self):
        options = ["a", "b", "c"]

        indexable_options = convert_to_sequence_and_check_comparable(options)
        formatted_options = [f"transformed_{option}" for option in indexable_options]
        default_indices = get_default_indices(indexable_options, "b")

        assert indexable_options == options
        for option in options:
            assert f"transformed_{option}" in formatted_options

        assert default_indices == [1]

    def test_transform_options_default_format_func(self):
        options = [5, 6, 7]

        indexable_options = convert_to_sequence_and_check_comparable(options)
        formatted_options = [str(option) for option in indexable_options]
        default_indices = get_default_indices(indexable_options, 7)

        assert indexable_options == options
        for option in options:
            assert f"{option}" in formatted_options

        assert default_indices == [2]


class TestValidateSelectWidgetFilterMode:
    @pytest.mark.parametrize(
        ("mode", "command", "expected"),
        [
            (
                "fuzzy",
                "st.selectbox",
                ProtoSelectWidgetFilterMode.FILTER_MODE_FUZZY,
            ),
            (
                "contains",
                "st.selectbox",
                ProtoSelectWidgetFilterMode.FILTER_MODE_CONTAINS,
            ),
            (
                "prefix",
                "st.multiselect",
                ProtoSelectWidgetFilterMode.FILTER_MODE_PREFIX,
            ),
            (
                None,
                "st.multiselect",
                ProtoSelectWidgetFilterMode.FILTER_MODE_NONE,
            ),
        ],
    )
    def test_validates_known_modes(
        self, mode: str | None, command: str, expected: int
    ) -> None:
        """Test that known filter modes map to the expected protobuf values."""
        assert (
            validate_select_widget_filter_mode(
                mode,
                accept_new_options=False,
                command=command,
            )
            == expected
        )

    def test_rejects_unhashable_values_with_value_error(self):
        with pytest.raises(StreamlitValueError, match=r"Invalid `filter_mode` value"):
            validate_select_widget_filter_mode(
                cast("Any", []),
                accept_new_options=False,
                command="st.selectbox",
            )


class TestIndexMethod(unittest.TestCase):
    @parameterized.expand(
        [
            (np.array([1, 2, 3, 4, 5]), 5, 4),
            # This one will have 0.15000000000000002 because of floating point precision
            (np.arange(0.0, 0.25, 0.05), 0.15, 3),
            ([0, 1, 2, 3], 3, 3),
            ([0.1, 0.2, 0.3], 0.2, 1),
            ([0.1, 0.2, None], None, 2),
            ([0.1, 0.2, float("inf")], float("inf"), 2),
            (["He", "ello w", "orld"], "He", 0),
            (list(np.arange(0.0, 0.25, 0.05)), 0.15, 3),
        ]
    )
    def test_successful_index_(self, input, find_value, expected_index):
        actual_index = index_(input, find_value)
        assert actual_index == expected_index

    @parameterized.expand(
        [
            (np.array([1, 2, 3, 4, 5]), 6),
            (np.arange(0.0, 0.25, 0.05), 0.1500002),
            ([0, 1, 2, 3], 3.00001),
            ([0.1, 0.2, 0.3], 0.3000004),
            ([0.1, 0.2, 0.3], None),
            (["He", "ello w", "orld"], "world"),
            (list(np.arange(0.0, 0.25, 0.05)), 0.150002),
        ]
    )
    def test_unsuccessful_index_(self, input_options, find_value):
        with pytest.raises(ValueError, match=f"{find_value} is not in iterable"):
            index_(input_options, find_value)

    def test_index_list(self):
        assert index_([1, 2, 3, 4], 1) == 0
        assert index_([1, 2, 3, 4], 4) == 3

    def test_index_list_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_([1, 2, 3, 4], 5)

    def test_index_tuple(self):
        assert index_((1, 2, 3, 4), 1) == 0
        assert index_((1, 2, 3, 4), 4) == 3

    def test_index_tuple_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_((1, 2, 3, 4), 5)

    def test_index_numpy_array(self):
        assert index_(np.array([1, 2, 3, 4]), 1) == 0
        assert index_(np.array([1, 2, 3, 4]), 4) == 3

    def test_index_numpy_array_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_(np.array([1, 2, 3, 4]), 5)

    def test_index_pandas_series(self):
        assert index_(pd.Series([1, 2, 3, 4]), 1) == 0
        assert index_(pd.Series([1, 2, 3, 4]), 4) == 3

    def test_index_pandas_series_fails(self):
        with pytest.raises(ValueError, match="5 is not in iterable"):
            index_(pd.Series([1, 2, 3, 4]), 5)


class TestEnumCoercion:
    """Test class for Enum Coercion feature."""

    @pytest.fixture
    def EnumAOrig(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumAEqual(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumADiffMembers(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            D = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumADiffValues(self):
        class EnumA(enum.Enum):
            A = "1"
            B = "2"
            C = "3"

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumAExtraMembers(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()
            D = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumADiffQualname(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumA.__qualname__ = "foobar.EnumA"
        return EnumA

    @pytest.fixture
    def EnumB(self):
        class EnumB(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumB.__qualname__ = "__main__.EnumB"
        return EnumB

    def test_enum_uniqueness(
        self,
        EnumAOrig,
        EnumAEqual,
        EnumADiffMembers,
        EnumADiffValues,
        EnumADiffQualname,
        EnumB,
        EnumAExtraMembers,
    ):
        """A preliminary check, to ensure testing the others makes sense."""
        assert all(
            EnumAOrig.A not in enum
            for enum in (
                EnumAEqual,
                EnumADiffMembers,
                EnumADiffValues,
                EnumADiffQualname,
                EnumAExtraMembers,
                EnumB,
            )
        )
        assert EnumAOrig.A.value == EnumAEqual.A.value
        assert EnumAOrig.__qualname__ == EnumAEqual.__qualname__

    def test_coerce_enum_coercable(
        self,
        EnumAOrig,
        EnumAEqual,
        EnumADiffValues,
    ):
        assert _coerce_enum(EnumAOrig.A, EnumAEqual) is EnumAEqual.A
        # Different values are coercible by default
        assert _coerce_enum(EnumAOrig.A, EnumADiffValues) is EnumADiffValues.A

    def test_coerce_enum_not_coercable(
        self,
        EnumAOrig,
        EnumADiffMembers,
        EnumAExtraMembers,
        EnumADiffQualname,
        EnumB,
    ):
        # Things that are not coercible
        assert _coerce_enum(EnumAOrig.A, EnumADiffMembers) is EnumAOrig.A
        assert _coerce_enum(EnumAOrig.A, EnumAExtraMembers) is EnumAOrig.A
        assert _coerce_enum(EnumAOrig.A, EnumB) is EnumAOrig.A
        assert _coerce_enum(EnumAOrig.A, EnumADiffQualname) is EnumAOrig.A

    def test_coerce_enum_noop(self, EnumAOrig):
        assert _coerce_enum(EnumAOrig.A, EnumAOrig) is EnumAOrig.A

    def test_coerce_enum_errors(self, EnumAOrig, EnumAEqual):
        with pytest.raises(ValueError, match="Expected an EnumMeta"):
            _coerce_enum(EnumAOrig.A, EnumAEqual.A)
        with pytest.raises(ValueError, match="Expected an Enum"):
            _coerce_enum(EnumAOrig, EnumAEqual)

    @patch_config_options({"runner.enumCoercion": "off"})
    def test_coerce_enum_config_off(self, EnumAOrig, EnumAEqual):
        assert _coerce_enum(EnumAOrig.A, EnumAEqual) is EnumAOrig.A

    @patch_config_options({"runner.enumCoercion": "nameAndValue"})
    def test_coerce_enum_config_name_and_value(
        self, EnumAOrig, EnumAEqual, EnumADiffValues
    ):
        assert _coerce_enum(EnumAOrig.A, EnumAEqual) is EnumAEqual.A
        assert _coerce_enum(EnumAOrig.A, EnumADiffValues) is EnumAOrig.A

    @patch_config_options({"runner.enumCoercion": "badValue"})
    def test_coerce_enum_bad_config_value(self, EnumAOrig, EnumAEqual):
        with pytest.raises(StreamlitAPIException):
            _coerce_enum(EnumAOrig.A, EnumAEqual)

    def test_maybe_coerce_enum(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumAOrig = EnumA

        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumAEqual = EnumA
        EnumAEqualList = [EnumAEqual.A, EnumAEqual.C, EnumAEqual.B]

        int_result = RegisterWidgetResult(1, False)
        intlist_result = RegisterWidgetResult([1, 2, 3], False)

        single_result = RegisterWidgetResult(EnumAOrig.A, False)
        single_coerced = RegisterWidgetResult(EnumAEqual.A, False)

        tuple_result = RegisterWidgetResult((EnumAOrig.A, EnumAOrig.C), True)
        tuple_coerced = RegisterWidgetResult((EnumAEqual.A, EnumAEqual.C), True)

        list_result = RegisterWidgetResult([EnumAOrig.A, EnumAOrig.C], True)
        list_coerced = RegisterWidgetResult([EnumAEqual.A, EnumAEqual.C], True)

        assert maybe_coerce_enum(single_result, EnumAEqual, []) == single_coerced
        assert (
            maybe_coerce_enum(single_result, EnumAEqualList, EnumAEqualList)
            == single_coerced
        )
        assert (
            maybe_coerce_enum(single_result, EnumAEqualList, [EnumAEqual.A])
            == single_coerced
        )
        assert maybe_coerce_enum(single_result, [1, 2, 3], []) is single_result
        assert maybe_coerce_enum(int_result, EnumAEqual, []) is int_result
        assert (
            maybe_coerce_enum(
                single_result, EnumAEqualList, [EnumAEqual.A, EnumAOrig.B]
            )
            is single_result
        )

        assert maybe_coerce_enum_sequence(tuple_result, EnumAEqual, []) == tuple_coerced
        assert (
            maybe_coerce_enum_sequence(tuple_result, EnumAEqualList, EnumAEqualList)
            == tuple_coerced
        )
        assert (
            maybe_coerce_enum_sequence(tuple_result, EnumAEqualList, [EnumAEqual.A])
            == tuple_coerced
        )
        assert maybe_coerce_enum_sequence(list_result, EnumAEqual, []) == list_coerced
        assert (
            maybe_coerce_enum_sequence(list_result, EnumAEqualList, EnumAEqualList)
            == list_coerced
        )
        assert (
            maybe_coerce_enum_sequence(list_result, EnumAEqualList, [EnumAEqual.A])
            == list_coerced
        )
        assert maybe_coerce_enum_sequence(list_result, [1, 2, 3], []) is list_result
        assert maybe_coerce_enum_sequence(tuple_result, [1, 2, 3], []) is tuple_result
        assert (
            maybe_coerce_enum_sequence(intlist_result, EnumAEqual, []) is intlist_result
        )
        assert (
            maybe_coerce_enum_sequence(
                list_result, EnumAEqualList, [EnumAEqual.A, EnumAOrig.B]
            )
            is list_result
        )
        assert (
            maybe_coerce_enum_sequence(
                tuple_result, EnumAEqualList, [EnumAEqual.A, EnumAOrig.B]
            )
            is tuple_result
        )

    def test_maybe_coerce_enum_preserves_incoming_serialized_value(self):
        """Coercing an Enum value must not drop other RegisterWidgetResult fields.

        Otherwise the wire label needed for the identity-dependent format_func
        fallback is lost for Enum selectboxes.
        """

        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()

        result = RegisterWidgetResult(EnumA.A, False, incoming_serialized_value="A")
        coerced = maybe_coerce_enum(result, EnumA, list(EnumA))
        assert coerced.value is EnumA.A
        assert coerced.incoming_serialized_value == "A"

    def test_maybe_coerce_enum_sequence_preserves_incoming_serialized_value(self):
        """Coercing an Enum sequence must not drop other RegisterWidgetResult fields."""

        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()

        result = RegisterWidgetResult([EnumA.A], False, incoming_serialized_value="A")
        coerced = maybe_coerce_enum_sequence(result, EnumA, list(EnumA))
        assert coerced.value == [EnumA.A]
        assert coerced.incoming_serialized_value == "A"


class TestCreateMappings:
    """Test class for create_mappings utility function."""

    def test_create_mappings_with_default_format_func(self):
        # Using default str format_func
        options = ["apple", "banana", "cherry"]
        formatted_options, mapping = create_mappings(options)

        # Check formatted options
        assert formatted_options == ["apple", "banana", "cherry"]

        # Check mapping
        assert mapping == {"apple": 0, "banana": 1, "cherry": 2}

    def test_create_mappings_with_custom_format_func(self):
        # Using a custom format function
        options = ["apple", "banana", "cherry"]

        formatted_options, mapping = create_mappings(
            options, lambda x: f"fruit-{x.upper()}"
        )

        # Check formatted options
        assert formatted_options == ["fruit-APPLE", "fruit-BANANA", "fruit-CHERRY"]

        # Check mapping
        assert mapping == {"fruit-APPLE": 0, "fruit-BANANA": 1, "fruit-CHERRY": 2}

    def test_create_mappings_with_numeric_options(self):
        # Test with numeric options
        options = [1, 2, 3, 4]
        formatted_options, mapping = create_mappings(options)

        # Check formatted options
        assert formatted_options == ["1", "2", "3", "4"]

        # Check mapping
        assert mapping == {"1": 0, "2": 1, "3": 2, "4": 3}

    def test_create_mappings_with_mixed_types(self):
        # Test with a mix of types
        options = [1, "two", 3.0, None]
        formatted_options, mapping = create_mappings(options)

        # Check formatted options
        assert formatted_options == ["1", "two", "3.0", "None"]

        # Check mapping
        assert mapping == {"1": 0, "two": 1, "3.0": 2, "None": 3}

    def test_create_mappings_with_empty_list(self):
        # Test with empty list
        options = []
        formatted_options, mapping = create_mappings(options)

        # Check both results are empty
        assert formatted_options == []
        assert mapping == {}


class TestValidateAndSyncValueWithOptions(unittest.TestCase):
    """Test class for validate_and_sync_value_with_options utility function."""

    @parameterized.expand(
        [
            (
                "value_in_options",
                "banana",
                ["apple", "banana", "cherry"],
                0,
                "banana",
                False,
            ),
            ("none_value", None, ["apple", "banana"], 0, None, False),
            (
                "value_not_in_options_resets_to_default",
                "mango",
                ["apple", "banana", "cherry"],
                0,
                "apple",
                True,
            ),
            (
                "value_not_in_options_custom_default_index",
                "mango",
                ["apple", "banana", "cherry"],
                2,
                "cherry",
                True,
            ),
            (
                "value_not_in_options_none_default_index",
                "mango",
                ["apple", "banana"],
                None,
                None,
                True,
            ),
            ("value_not_in_empty_options", "apple", [], 0, None, True),
            ("numeric_value_in_options", 2, [1, 2, 3], 0, 2, False),
            ("numeric_value_not_in_options", 5, [1, 2, 3], 1, 2, True),
            ("float_value_in_options", 0.2, [0.1, 0.2, 0.3], 0, 0.2, False),
        ]
    )
    def test_validate_and_sync_value_with_options(
        self,
        _name: str,
        current_value,
        options: list,
        default_index: int | None,
        expected_value,
        expected_needs_reset: bool,
    ):
        """Test validate_and_sync_value_with_options with various inputs."""
        value, needs_reset = validate_and_sync_value_with_options(
            current_value, options, default_index, None
        )
        assert value == expected_value
        assert needs_reset is expected_needs_reset

    def test_custom_objects_without_eq_using_format_func(self):
        """Test that custom objects without __eq__ work with format_func validation."""
        from copy import deepcopy

        # Custom class without __eq__ implementation
        class MyOption:  # noqa: B903
            def __init__(self, value: str):
                self.value = value

        def format_func(x):
            return x.value

        original_options = [MyOption("a"), MyOption("b"), MyOption("c")]
        deepcopied_value = deepcopy(original_options[1])

        # Without the fix, this would reset because deepcopy creates new instances
        # and == falls back to identity comparison for objects without __eq__
        value, needs_reset = validate_and_sync_value_with_options(
            deepcopied_value,
            original_options,
            0,
            None,
            format_func=format_func,
        )

        # Value should be valid since format_func output matches
        assert value is deepcopied_value
        assert needs_reset is False


class TestValidateAndSyncRangeValueWithOptions(unittest.TestCase):
    """Test class for validate_and_sync_range_value_with_options utility function."""

    @parameterized.expand(
        [
            (
                "both_values_in_options",
                ("banana", "cherry"),
                ["apple", "banana", "cherry"],
                [0],
                ("banana", "cherry"),
                False,
            ),
            (
                "first_value_not_in_options",
                ("mango", "cherry"),
                ["apple", "banana", "cherry"],
                [0],
                ("apple", "cherry"),
                True,
            ),
            (
                "second_value_not_in_options",
                ("apple", "mango"),
                ["apple", "banana", "cherry"],
                [0],
                ("apple", "cherry"),
                True,
            ),
            (
                "both_values_not_in_options",
                ("mango", "papaya"),
                ["apple", "banana", "cherry"],
                [0],
                ("apple", "cherry"),
                True,
            ),
            (
                "numeric_range_in_options",
                (2, 4),
                [1, 2, 3, 4, 5],
                [0],
                (2, 4),
                False,
            ),
            (
                "numeric_range_first_invalid",
                (10, 4),
                [1, 2, 3, 4, 5],
                [0],
                (1, 5),
                True,
            ),
            (
                "two_default_indices",
                ("mango", "papaya"),
                ["apple", "banana", "cherry"],
                [1, 2],
                ("banana", "cherry"),
                True,
            ),
        ]
    )
    def test_validate_and_sync_range_value_with_options(
        self,
        _name: str,
        current_value: tuple,
        options: list,
        default_indices: list[int],
        expected_value: tuple,
        expected_needs_reset: bool,
    ) -> None:
        """Test validate_and_sync_range_value_with_options with various inputs."""
        value, needs_reset = validate_and_sync_range_value_with_options(
            current_value, options, default_indices, None
        )
        assert value == expected_value
        assert needs_reset is expected_needs_reset
        # Negative assertion: if reset expected, value should differ from input
        if expected_needs_reset:
            assert value != current_value

    def test_empty_options_returns_current_value(self) -> None:
        """Test that empty options returns the current value unchanged."""
        current_value = ("a", "b")
        value, needs_reset = validate_and_sync_range_value_with_options(
            current_value, [], [0], None
        )
        assert value == current_value
        assert needs_reset is False

    def test_single_default_index_uses_last_option_as_end(self) -> None:
        """Test that a single default index uses the last option as the end value."""
        current_value = ("invalid", "also_invalid")
        options = ["a", "b", "c", "d", "e"]
        value, needs_reset = validate_and_sync_range_value_with_options(
            current_value,
            options,
            [2],
            None,  # Only start index provided
        )
        # Should use index 2 for start and last index (4) for end
        assert value == ("c", "e")
        assert needs_reset is True

    def test_custom_format_func(self) -> None:
        """Test validation with a custom format function."""
        current_value = (1, 3)
        options = [1, 2, 3, 4, 5]

        # Custom format_func that formats numbers with prefix
        def format_func(x: Any) -> str:
            return f"num_{x}"

        value, needs_reset = validate_and_sync_range_value_with_options(
            current_value, options, [0], None, format_func=format_func
        )
        assert value == (1, 3)
        assert needs_reset is False

    def test_custom_objects_without_eq_using_format_func(self) -> None:
        """Test that custom objects without __eq__ work with format_func validation."""
        from copy import deepcopy

        # Custom class without __eq__ implementation
        class MyOption:  # noqa: B903
            def __init__(self, value: str):
                self.value = value

        def format_func(x):
            return x.value

        original_options = [MyOption("a"), MyOption("b"), MyOption("c")]
        deepcopied_start = deepcopy(original_options[0])
        deepcopied_end = deepcopy(original_options[2])

        value, needs_reset = validate_and_sync_range_value_with_options(
            (deepcopied_start, deepcopied_end),
            original_options,
            [0],
            None,
            format_func=format_func,
        )

        # Value should be valid since format_func output matches
        assert value == (deepcopied_start, deepcopied_end)
        assert needs_reset is False

    def test_format_func_failure_resets_to_default(self) -> None:
        """Test that format_func failure on a value causes reset to default."""

        class MyOption:  # noqa: B903
            def __init__(self, value: str):
                self.value = value

        def format_func(x):
            return x.value  # Will fail on strings

        original_options = [MyOption("a"), MyOption("b"), MyOption("c")]

        # Mix of valid object and invalid string
        value, needs_reset = validate_and_sync_range_value_with_options(
            ("invalid_string", original_options[1]),
            original_options,
            [0],
            None,
            format_func=format_func,
        )

        # Should reset to default because first value is invalid
        assert value == (original_options[0], original_options[2])
        assert needs_reset is True


class TestValidateAndSyncMultiselectValueWithOptions(unittest.TestCase):
    """Test class for validate_and_sync_multiselect_value_with_options utility function."""

    @parameterized.expand(
        [
            (
                "all_values_in_options",
                ["apple", "banana"],
                ["apple", "banana", "cherry"],
                ["apple", "banana"],
                False,
            ),
            (
                "empty_values",
                [],
                ["apple", "banana"],
                [],
                False,
            ),
            (
                "some_values_not_in_options",
                ["apple", "mango", "banana"],
                ["apple", "banana", "cherry"],
                ["apple", "banana"],
                True,
            ),
            (
                "all_values_not_in_options",
                ["mango", "papaya"],
                ["apple", "banana", "cherry"],
                [],
                True,
            ),
            (
                "numeric_values_all_in_options",
                [1, 3],
                [1, 2, 3, 4],
                [1, 3],
                False,
            ),
            (
                "numeric_values_some_not_in_options",
                [1, 5, 3],
                [1, 2, 3, 4],
                [1, 3],
                True,
            ),
        ]
    )
    def test_validate_and_sync_multiselect_value_with_options(
        self,
        _name: str,
        current_values: list,
        options: list,
        expected_values: list,
        expected_needs_reset: bool,
    ):
        """Test validate_and_sync_multiselect_value_with_options with various inputs."""
        values, needs_reset = validate_and_sync_multiselect_value_with_options(
            current_values, options, None
        )
        assert values == expected_values
        assert needs_reset is expected_needs_reset


class TestValidateMultiselectWithCustomObjects(unittest.TestCase):
    """Test class for validating multiselect with custom class objects.

    This tests the fix for https://github.com/streamlit/streamlit/issues/13646
    where custom objects without __eq__ would fail validation after deepcopy.
    """

    def test_custom_objects_without_eq_using_format_func(self):
        """Test that custom objects without __eq__ work with format_func validation."""

        # Custom class without __eq__ implementation
        class MyOption:  # noqa: B903
            def __init__(self, value: str):
                self.value = value

        # Create options and their deepcopied equivalents (simulating what happens
        # after register_widget deepcopies the values)
        from copy import deepcopy

        original_options = [MyOption("a"), MyOption("b"), MyOption("c")]
        deepcopied_values = [
            deepcopy(original_options[0]),
            deepcopy(original_options[1]),
        ]

        # Without the fix, this would fail because deepcopy creates new instances
        # and == falls back to identity comparison for objects without __eq__
        values, needs_reset = validate_and_sync_multiselect_value_with_options(
            deepcopied_values,
            original_options,
            None,
            format_func=lambda x: x.value,  # Compare by .value attribute
        )

        # All values should be valid since they have matching format_func output
        assert len(values) == 2
        assert needs_reset is False

    def test_custom_objects_partial_match_with_format_func(self):
        """Test that only matching custom objects are kept."""

        class MyOption:  # noqa: B903
            def __init__(self, value: str):
                self.value = value

        from copy import deepcopy

        original_options = [MyOption("a"), MyOption("b")]  # "c" is removed
        # Simulate values that include one that's no longer in options
        deepcopied_values = [
            deepcopy(MyOption("a")),
            deepcopy(MyOption("c")),  # This one should be filtered out
        ]

        values, needs_reset = validate_and_sync_multiselect_value_with_options(
            deepcopied_values,
            original_options,
            None,
            format_func=lambda x: x.value,
        )

        # Only "a" should remain, "c" should be filtered out
        assert len(values) == 1
        assert values[0].value == "a"
        assert needs_reset is True

    def test_default_format_func_with_custom_str(self):
        """Test that custom objects with __str__ work with default format_func."""

        class MyOption:
            def __init__(self, value: str):
                self.value = value

            def __str__(self):
                return self.value

        from copy import deepcopy

        original_options = [MyOption("a"), MyOption("b"), MyOption("c")]
        deepcopied_values = [deepcopy(original_options[0])]

        # Using default str format_func
        values, needs_reset = validate_and_sync_multiselect_value_with_options(
            deepcopied_values,
            original_options,
            None,
            # format_func defaults to str
        )

        assert len(values) == 1
        assert needs_reset is False

    def test_format_func_failure_filters_out_value(self):
        """Test that values are filtered out when format_func fails on them.

        This handles the edge case where options changed and the deserializer
        returned a raw string (because the formatted option no longer exists),
        but the format_func can't handle strings (e.g., lambda x: x.attribute).
        """

        class MyOption:  # noqa: B903
            def __init__(self, value: str):
                self.value = value

        # format_func that only works on MyOption objects, not strings
        def format_func(x):
            return x.value

        original_options = [MyOption("b"), MyOption("c")]

        # Simulate a string value that came from an old session where
        # the option no longer exists (deserializer returns raw string)
        current_values = ["old_value", MyOption("b")]

        # The string should be filtered out (format_func fails on it)
        # but MyOption("b") should remain valid
        values, needs_reset = validate_and_sync_multiselect_value_with_options(
            current_values,
            original_options,
            None,
            format_func=format_func,
        )

        # Only MyOption("b") should remain
        assert len(values) == 1
        assert values[0].value == "b"
        assert needs_reset is True


class TestResolveValueAgainstOptions:
    """Tests for the selectbox value resolver (format_func with wire-label fallback)."""

    def test_none_value_returns_unchanged(self) -> None:
        """A None current value is returned as-is without a reset."""
        value, reset = resolve_value_against_options(
            None, ["a", "b"], {"a": 0, "b": 1}, 0, None
        )
        assert value is None
        assert reset is False

    def test_value_in_options_is_kept(self) -> None:
        """A value whose format_func label is in options is kept (no reset)."""
        options = ["a", "b", "c"]
        value, reset = resolve_value_against_options(
            "b", options, {"a": 0, "b": 1, "c": 2}, 0, None
        )
        assert value == "b"
        assert reset is False

    def test_value_not_in_options_resets_to_default(self) -> None:
        """A value whose label is no longer among the options resets to default."""
        options = ["a", "b", "c"]
        value, reset = resolve_value_against_options(
            "z", options, {"a": 0, "b": 1, "c": 2}, 0, None
        )
        assert value == "a"
        assert reset is True

    def test_format_func_raises_wire_label_in_options_returns_current_instance(
        self,
    ) -> None:
        """When format_func raises, a matching wire label keeps the selection.

        The returned object must be the current option instance, not the
        passed-in (potentially stale) value.
        """

        class Stale:  # noqa: B903
            def __init__(self, name: str):
                self.name = name

        options = ["A", "B"]
        stale = Stale("b")
        lookup: dict[Any, str] = {}  # empty -> format_func raises KeyError

        def format_func(x: Any) -> str:
            return lookup[x]

        value, reset = resolve_value_against_options(
            stale,
            options,
            {"a": 0, "b": 1},
            0,
            None,
            format_func,
            incoming_serialized_value="b",
        )
        assert value is options[1]
        assert reset is False

    def test_format_func_raises_wire_label_not_in_options_resets(self) -> None:
        """When format_func raises and the wire label is absent, reset to default.

        Covers the model-swap case: the stored value belongs to a different
        data model, so neither format_func nor its label match the new options.
        """

        class Stale:  # noqa: B903
            def __init__(self, name: str):
                self.name = name

        options = ["X", "Y"]
        stale = Stale("a")
        lookup: dict[Any, str] = {}

        def format_func(x: Any) -> str:
            return lookup[x]

        value, reset = resolve_value_against_options(
            stale,
            options,
            {"x": 0, "y": 1},
            0,
            None,
            format_func,
            incoming_serialized_value="a",
        )
        assert value == "X"
        assert reset is True
        assert value is not stale

    def test_format_func_raises_without_wire_label_resets(self) -> None:
        """When format_func raises and no wire label is available, reset."""

        class Stale:  # noqa: B903
            def __init__(self, name: str):
                self.name = name

        def format_func(x: Any) -> str:
            return x.missing_attr

        value, reset = resolve_value_against_options(
            Stale("a"), ["X", "Y"], {"x": 0, "y": 1}, None, None, format_func
        )
        assert value is None
        assert reset is True
