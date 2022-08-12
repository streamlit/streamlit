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

        assert "is not allowed." in str(e.value)

    @patch("streamlit.warning")
    def test_check_session_state_rules_no_key(self, patched_st_warning):
        check_session_state_rules(5, key=None)

        patched_st_warning.assert_not_called()

    @patch("streamlit._is_running_with_streamlit", new=True)
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

    @patch("streamlit._is_running_with_streamlit", new=True)
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

    @patch("streamlit._is_running_with_streamlit", new=True)
    @patch("streamlit.elements.utils.get_session_state")
    @patch("streamlit.warning")
    def test_check_session_state_rules_prints_warning(
        self, patched_st_warning, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        check_session_state_rules(5, key="the key")

        patched_st_warning.assert_called_once()
        args, kwargs = patched_st_warning.call_args
        warning_msg = args[0]
        assert 'The widget with key "the key"' in warning_msg

    @patch("streamlit._is_running_with_streamlit", new=True)
    @patch("streamlit.elements.utils.get_session_state")
    def test_check_session_state_rules_writes_not_allowed(
        self, patched_get_session_state
    ):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        with pytest.raises(StreamlitAPIException) as e:
            check_session_state_rules(5, key="the key", writes_allowed=False)

        assert "cannot be set using st.session_state" in str(e.value)
