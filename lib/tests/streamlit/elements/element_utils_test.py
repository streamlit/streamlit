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

from streamlit.elements.lib.utils import maybe_coerce_enum, maybe_coerce_enum_sequence
from streamlit.runtime.state.common import RegisterWidgetResult


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
