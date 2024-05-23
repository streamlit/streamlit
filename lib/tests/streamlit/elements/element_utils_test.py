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

import copy
import enum
import os
import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit import config
from streamlit.elements import utils
from streamlit.elements.utils import (
    check_callback_rules,
    check_session_state_rules,
    maybe_coerce_enum,
    maybe_coerce_enum_sequence,
)
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.common import RegisterWidgetResult

SECTION_DESCRIPTIONS = copy.deepcopy(config._section_descriptions)
CONFIG_OPTIONS = copy.deepcopy(config._config_options)


class ElementUtilsTest(unittest.TestCase):
    def setUp(self):
        self.patches = [
            patch.object(
                config, "_section_descriptions", new=copy.deepcopy(SECTION_DESCRIPTIONS)
            ),
            patch.object(config, "_config_options", new=copy.deepcopy(CONFIG_OPTIONS)),
            patch.dict(os.environ),
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

        config._delete_option("_test.tomlTest")

    @patch("streamlit.elements.utils.is_in_form", MagicMock(return_value=False))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_check_callback_rules_not_in_form(self):
        check_callback_rules(None, lambda x: x)

    @patch("streamlit.elements.utils.is_in_form", MagicMock(return_value=True))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_check_callback_rules_in_form(self):
        check_callback_rules(None, None)

    @patch("streamlit.elements.utils.is_in_form", MagicMock(return_value=True))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_check_callback_rules_error(self):
        with pytest.raises(StreamlitAPIException) as e:
            check_callback_rules(None, lambda x: x)

        assert "is not allowed." in str(e.value)

    @patch("streamlit.warning")
    def test_check_session_state_rules_no_key(self, patched_st_warning):
        check_session_state_rules(5, key=None)

        patched_st_warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_no_val(
        self, patched_st_warning, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules(None, key="the key")

        patched_st_warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_no_state_val(
        self, patched_st_warning, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = False
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules(5, key="the key")

        patched_st_warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_prints_warning(
        self, patched_st_warning, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state
        # Reset globale flag:
        utils._shown_default_value_warning = False

        check_session_state_rules(5, key="the key")

        patched_st_warning.assert_called_once()
        args, kwargs = patched_st_warning.call_args
        warning_msg = args[0]
        assert 'The widget with key "the key"' in warning_msg

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_hide_warning_if_state_duplication_disabled(
        self, patched_st_warning, patched_get_session_state
    ):
        config._set_option("global.disableWidgetStateDuplicationWarning", True, "test")

        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules(5, key="the key")

        patched_st_warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.utils.get_session_state")
    def test_check_session_state_rules_writes_not_allowed(
        self, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        with pytest.raises(StreamlitAPIException) as e:
            check_session_state_rules(5, key="the key", writes_allowed=False)

        assert "Values of the widget with key" in str(e.value)

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
