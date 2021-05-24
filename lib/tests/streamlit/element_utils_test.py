# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit.elements.utils import check_callback_rules, check_session_state_rules
from streamlit.errors import StreamlitAPIException


class ElementUtilsTest(unittest.TestCase):
    @patch("streamlit.elements.utils.is_in_form", return_value=False)
    @patch("streamlit._is_running_with_streamlit", new=True)
    def test_check_callback_rules_not_in_form(self, _):
        check_callback_rules(None, lambda x: x)

    @patch("streamlit.elements.utils.is_in_form", return_value=True)
    @patch("streamlit._is_running_with_streamlit", new=True)
    def test_check_callback_rules_in_form(self, _):
        check_callback_rules(None, None)

    @patch("streamlit.elements.utils.is_in_form", return_value=True)
    @patch("streamlit._is_running_with_streamlit", new=True)
    def test_check_callback_rules_error(self, _):
        with pytest.raises(StreamlitAPIException) as e:
            check_callback_rules(None, lambda x: x)

        assert (
            str(e.value)
            == "Callbacks are not allowed on widgets in forms; put them on the form submit button instead."
        )

    @patch("streamlit.warning")
    def test_check_session_state_rules_no_key(self, patched_st_warning):
        check_session_state_rules("the label", 5, key=None)

        patched_st_warning.assert_not_called()

    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_no_val(
        self, patched_st_warning, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules("the label", None, key="the key")

        patched_st_warning.assert_not_called()

    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_no_state_val(
        self, patched_st_warning, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_value.return_value = False
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules("the label", 5, key="the key")

        patched_st_warning.assert_not_called()

    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_prints_warning(
        self, patched_st_warning, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules("the label", 5, key="the key")

        patched_st_warning.assert_called_once_with(
            'The widget with key "the key" was created with a default value,'
            " but it also had its value set via the session_state api."
            " The results of doing this are undefined behavior."
        )
