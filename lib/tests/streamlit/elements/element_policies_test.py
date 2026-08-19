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

import copy
import os
import unittest
from typing import Final
from unittest.mock import MagicMock, patch

import pytest

from streamlit import config
from streamlit.elements.lib.policies import (
    check_cache_replay_rules,
    check_callback_rules,
    check_session_state_rules,
    check_widget_policies,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitValueAssignmentNotAllowedError,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    in_cached_function,
)

_KEY: Final = "the key"


class ElementPoliciesTest(unittest.TestCase):
    pass


class CheckCallbackRulesTest(ElementPoliciesTest):
    @patch("streamlit.elements.lib.policies.is_in_form", MagicMock(return_value=False))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_check_callback_rules_not_in_form(self):
        check_callback_rules(MagicMock(), lambda x: x)

    @patch("streamlit.elements.lib.policies.is_in_form", MagicMock(return_value=True))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_check_callback_rules_in_form(self):
        check_callback_rules(MagicMock(), None)

    @patch("streamlit.elements.lib.policies.is_in_form", MagicMock(return_value=True))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_check_callback_rules_error(self):
        with pytest.raises(StreamlitAPIException) as e:
            check_callback_rules(MagicMock(), lambda x: x)

        assert "is not allowed." in str(e.value)


class CheckSessionStateRules(ElementPoliciesTest):
    @patch("streamlit.elements.lib.policies._LOGGER")
    def test_check_session_state_rules_no_key(self, patched_logger):
        check_session_state_rules(5, key=None)

        patched_logger.warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.lib.policies.get_session_state")
    @patch("streamlit.elements.lib.policies._LOGGER")
    def test_check_session_state_rules_no_val(
        self, patched_logger, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules(None, key=_KEY)

        patched_logger.warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.lib.policies.get_session_state")
    @patch("streamlit.elements.lib.policies._LOGGER")
    def test_check_session_state_rules_no_state_val(
        self, patched_logger, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = False
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules(5, key=_KEY)

        patched_logger.warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.lib.policies.get_session_state")
    @patch("streamlit.elements.lib.policies._LOGGER")
    def test_check_session_state_rules_hide_warning_if_state_duplication_disabled(
        self, patched_logger, patched_get_session_state
    ):
        config._set_option("global.disableWidgetStateDuplicationWarning", True, "test")

        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules(5, key=_KEY)

        patched_logger.warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.lib.policies.get_session_state")
    def test_check_session_state_rules_writes_not_allowed(
        self, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        with pytest.raises(StreamlitValueAssignmentNotAllowedError):
            check_session_state_rules(5, key=_KEY, writes_allowed=False)


class SpecialSessionStatesTest(ElementPoliciesTest):
    SECTION_DESCRIPTIONS = copy.deepcopy(config._section_descriptions)
    CONFIG_OPTIONS = copy.deepcopy(config._config_options)

    def setUp(self):
        self.patches = [
            patch.object(
                config,
                "_section_descriptions",
                new=copy.deepcopy(SpecialSessionStatesTest.SECTION_DESCRIPTIONS),
            ),
            patch.object(
                config,
                "_config_options",
                new=copy.deepcopy(SpecialSessionStatesTest.CONFIG_OPTIONS),
            ),
            patch.dict(os.environ),
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

        config._delete_option("_test.tomlTest")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.lib.policies.get_session_state")
    @patch("streamlit.elements.lib.policies._LOGGER")
    def test_check_session_state_rules_prints_warning(
        self, patched_logger, patched_get_session_state
    ):
        import streamlit.elements.lib.policies as policies_module

        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state
        # Reset global flag:
        policies_module._shown_default_value_warning = False

        check_session_state_rules(5, key=_KEY)

        patched_logger.warning.assert_called_once()
        args, kwargs = patched_logger.warning.call_args
        warning_msg = args[0]
        assert 'The widget with key "%s"' in warning_msg
        assert args[1] == _KEY
        assert kwargs.get("stack_info") is True


class CheckCacheReplayTest(ElementPoliciesTest):
    @patch("streamlit.exception")
    def test_cache_replay_rules_succeeds(self, patched_st_exception):
        check_cache_replay_rules()
        patched_st_exception.assert_not_called()

    @patch("streamlit.exception")
    def test_cache_replay_rules_fails(self, patched_st_exception):
        in_cached_function.set(True)
        check_cache_replay_rules()
        patched_st_exception.assert_called()
        # Reset the global flag to avoid affecting other tests
        in_cached_function.set(False)


@patch("streamlit.elements.lib.policies.check_session_state_rules")
@patch("streamlit.elements.lib.policies.check_callback_rules")
@patch("streamlit.elements.lib.policies.check_cache_replay_rules")
class CheckWidget(ElementPoliciesTest):
    def test_all_relevant_policies_are_called(
        self,
        patched_check_cache_replay_rules,
        patched_check_callback_rules,
        patched_check_session_state_rules,
    ):
        def on_change():
            """Noop"""

        dg = MagicMock()
        key = "my_key"
        default_value = 5
        check_widget_policies(dg, key, on_change, default_value=default_value)
        patched_check_cache_replay_rules.assert_called_once()
        patched_check_callback_rules.assert_called_once_with(dg, on_change)
        patched_check_session_state_rules.assert_called_once_with(
            default_value=default_value, key=key, writes_allowed=True
        )

    def test_check_callback_rules_is_not_called(
        self,
        patched_check_cache_replay_rules,
        patched_check_callback_rules,
        patched_check_session_state_rules,
    ):
        check_widget_policies(
            MagicMock(), None, None, enable_check_callback_rules=False
        )
        patched_check_cache_replay_rules.assert_called_once()
        patched_check_callback_rules.assert_not_called()
        patched_check_session_state_rules.assert_called_once()

    def test_writes_allowed_can_be_disabled(
        self,
        patched_check_cache_replay_rules,
        patched_check_callback_rules,
        patched_check_session_state_rules,
    ):
        dg = MagicMock()
        key = "my_key"
        check_widget_policies(dg, key, None, writes_allowed=False)
        patched_check_cache_replay_rules.assert_called_once()
        patched_check_callback_rules.assert_called_once()
        patched_check_session_state_rules.assert_called_once_with(
            default_value=None, key=key, writes_allowed=False
        )
