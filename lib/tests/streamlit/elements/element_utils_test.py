# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import pytest

from streamlit import errors
from streamlit.elements.lib.utils import (
    maybe_coerce_enum,
    maybe_coerce_enum_sequence,
    _coerce_enum,
)
from streamlit.runtime.state.common import RegisterWidgetResult
from tests.testutil import patch_config_options


class ElementUtilsTest(unittest.TestCase):
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
        # Different values are coercable by default
        assert _coerce_enum(EnumAOrig.A, EnumADiffValues) is EnumADiffValues.A

    def test_coerce_enum_not_coercable(
        self,
        EnumAOrig,
        EnumADiffMembers,
        EnumAExtraMembers,
        EnumADiffQualname,
        EnumB,
    ):
        # Things that are not coercable
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
        with pytest.raises(errors.StreamlitAPIException):
            _coerce_enum(EnumAOrig.A, EnumAEqual)
