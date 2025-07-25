# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Tests for the on_dismiss parameter in st.dialog"""

from unittest.mock import MagicMock, patch

import pytest

from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.dialog_decorator import dialog_decorator
from streamlit.elements.lib.dialog import Dialog
from streamlit.errors import StreamlitAPIException
from streamlit.testing.v1 import AppTest


class TestDialogOnDismiss:
    """Tests for the on_dismiss parameter functionality in st.dialog"""

    def test_on_dismiss_ignore_default(self):
        """Test that on_dismiss defaults to 'ignore'"""
        with patch("streamlit.elements.lib.dialog.get_script_run_ctx"):
            dg = DeltaGenerator()
            dialog = Dialog._create(dg, "Test Dialog")

            assert not dialog._is_dismiss_activated
            assert dialog._on_dismiss_callback is None
            assert dialog._element_id is None

    def test_on_dismiss_rerun(self):
        """Test on_dismiss='rerun' functionality"""
        with patch("streamlit.elements.lib.dialog.get_script_run_ctx") as mock_ctx:
            mock_ctx.return_value = MagicMock()
            with patch(
                "streamlit.elements.lib.dialog.compute_and_register_element_id"
            ) as mock_compute_id:
                mock_compute_id.return_value = "test-dialog-id"
                with patch(
                    "streamlit.elements.lib.dialog.register_widget"
                ) as mock_register:
                    dg = DeltaGenerator()
                    dialog = Dialog._create(dg, "Test Dialog", on_dismiss="rerun")

                    assert dialog._is_dismiss_activated
                    assert dialog._on_dismiss_callback is None
                    assert dialog._element_id == "test-dialog-id"
                    mock_register.assert_called_once()

    def test_on_dismiss_callback(self):
        """Test on_dismiss with callback function"""

        def test_callback():
            pass

        with patch("streamlit.elements.lib.dialog.get_script_run_ctx") as mock_ctx:
            mock_ctx.return_value = MagicMock()
            with patch(
                "streamlit.elements.lib.dialog.compute_and_register_element_id"
            ) as mock_compute_id:
                mock_compute_id.return_value = "test-dialog-id"
                with patch(
                    "streamlit.elements.lib.dialog.register_widget"
                ) as mock_register:
                    dg = DeltaGenerator()
                    dialog = Dialog._create(dg, "Test Dialog", on_dismiss=test_callback)

                    assert dialog._is_dismiss_activated
                    assert dialog._on_dismiss_callback is test_callback
                    assert dialog._element_id == "test-dialog-id"
                    mock_register.assert_called_once()

    def test_invalid_on_dismiss_value(self):
        """Test invalid on_dismiss parameter raises error"""
        dg = DeltaGenerator()
        with pytest.raises(StreamlitAPIException) as exc_info:
            Dialog._create(dg, "Test Dialog", on_dismiss="invalid")

        assert "You have passed invalid to `on_dismiss`" in str(exc_info.value)
        assert "But only 'ignore', 'rerun', or a callable is supported" in str(
            exc_info.value
        )

    def test_dialog_decorator_on_dismiss_ignore(self):
        """Test dialog decorator with on_dismiss='ignore'"""

        @dialog_decorator("Test Dialog", on_dismiss="ignore")
        def test_dialog():
            pass

        # Should not raise any exception
        assert callable(test_dialog)

    def test_dialog_decorator_on_dismiss_rerun(self):
        """Test dialog decorator with on_dismiss='rerun'"""

        @dialog_decorator("Test Dialog", on_dismiss="rerun")
        def test_dialog():
            pass

        # Should not raise any exception
        assert callable(test_dialog)

    def test_dialog_decorator_on_dismiss_callback(self):
        """Test dialog decorator with callback function"""

        def callback():
            pass

        @dialog_decorator("Test Dialog", on_dismiss=callback)
        def test_dialog():
            pass

        # Should not raise any exception
        assert callable(test_dialog)

    def test_dialog_decorator_invalid_on_dismiss(self):
        """Test dialog decorator with invalid on_dismiss raises error"""
        with pytest.raises(StreamlitAPIException) as exc_info:

            @dialog_decorator("Test Dialog", on_dismiss="invalid")
            def test_dialog():
                pass

        assert "You have passed invalid to `on_dismiss`" in str(exc_info.value)

    def test_dialog_widget_registration_parameters(self):
        """Test that dialog widget registration uses correct parameters"""
        with patch("streamlit.elements.lib.dialog.get_script_run_ctx") as mock_ctx:
            mock_ctx.return_value = MagicMock()
            with patch(
                "streamlit.elements.lib.dialog.compute_and_register_element_id"
            ) as mock_compute_id:
                mock_compute_id.return_value = "test-dialog-id"
                with patch(
                    "streamlit.elements.lib.dialog.register_widget"
                ) as mock_register:
                    dg = DeltaGenerator()
                    Dialog._create(dg, "Test Dialog", on_dismiss="rerun", key="my_key")

                    # Check compute_and_register_element_id was called with correct params
                    mock_compute_id.assert_called_once_with(
                        "dialog",
                        user_key="my_key",
                        form_id="",  # Dialogs are not compatible with forms
                        dg=dg,
                        title="Test Dialog",
                        dismissible=True,
                        width="small",
                        on_dismiss="rerun",
                    )

                    # Check register_widget was called with correct params
                    call_args = mock_register.call_args
                    assert call_args[0][0] == "test-dialog-id"  # element_id
                    assert (
                        call_args[1]["on_change_handler"] is None
                    )  # no callback for "rerun"
                    assert call_args[1]["value_type"] == "trigger_value"

    def test_dialog_widget_registration_with_callback(self):
        """Test widget registration parameters when callback is provided"""

        def test_callback():
            pass

        with patch("streamlit.elements.lib.dialog.get_script_run_ctx") as mock_ctx:
            mock_ctx.return_value = MagicMock()
            with patch(
                "streamlit.elements.lib.dialog.compute_and_register_element_id"
            ) as mock_compute_id:
                mock_compute_id.return_value = "test-dialog-id"
                with patch(
                    "streamlit.elements.lib.dialog.register_widget"
                ) as mock_register:
                    dg = DeltaGenerator()
                    Dialog._create(dg, "Test Dialog", on_dismiss=test_callback)

                    # Check register_widget was called with callback
                    call_args = mock_register.call_args
                    assert call_args[1]["on_change_handler"] is test_callback

    def test_dialog_protobuf_id_field(self):
        """Test that dialog protobuf gets id field when on_dismiss is activated"""
        with patch("streamlit.elements.lib.dialog.get_script_run_ctx") as mock_ctx:
            mock_ctx.return_value = MagicMock()
            with patch(
                "streamlit.elements.lib.dialog.compute_and_register_element_id"
            ) as mock_compute_id:
                mock_compute_id.return_value = "test-dialog-id"
                with patch("streamlit.elements.lib.dialog.register_widget"):
                    with patch.object(DeltaGenerator, "_block") as mock_block:
                        mock_dialog = MagicMock()
                        mock_block.return_value = mock_dialog

                        dg = DeltaGenerator()
                        Dialog._create(dg, "Test Dialog", on_dismiss="rerun")

                        # Check that _block was called and the proto has the id set
                        mock_block.assert_called_once()
                        call_args = mock_block.call_args
                        block_proto = call_args[1]["block_proto"]
                        assert block_proto.dialog.id == "test-dialog-id"

    def test_dialog_protobuf_no_id_field_when_ignore(self):
        """Test that dialog protobuf doesn't get id field when on_dismiss='ignore'"""
        with patch("streamlit.elements.lib.dialog.get_script_run_ctx"):
            with patch.object(DeltaGenerator, "_block") as mock_block:
                mock_dialog = MagicMock()
                mock_block.return_value = mock_dialog

                dg = DeltaGenerator()
                Dialog._create(dg, "Test Dialog", on_dismiss="ignore")

                # Check that _block was called and the proto doesn't have id set
                mock_block.assert_called_once()
                call_args = mock_block.call_args
                block_proto = call_args[1]["block_proto"]
                assert block_proto.dialog.id == ""  # Default empty string


class TestDialogOnDismissIntegration:
    """Integration tests using AppTest for dialog on_dismiss functionality"""

    def test_dialog_on_dismiss_rerun_integration(self):
        """Test dialog on_dismiss='rerun' with AppTest"""

        def script():
            import streamlit as st

            @st.dialog("Test Dialog", on_dismiss="rerun")
            def test_dialog():
                st.write("Dialog content")

            if st.button("Open Dialog"):
                test_dialog()

            if "rerun_count" not in st.session_state:
                st.session_state.rerun_count = 0

            st.session_state.rerun_count += 1
            st.write(f"Rerun count: {st.session_state.rerun_count}")

        # This is a placeholder for actual integration testing
        # Real implementation would require frontend interaction simulation
        at = AppTest.from_function(script)
        at.run()

        # Basic test that the script runs without error
        assert not at.exception

    def test_dialog_on_dismiss_callback_integration(self):
        """Test dialog on_dismiss with callback using AppTest"""

        def script():
            import streamlit as st

            def on_dialog_dismiss():
                st.session_state.callback_executed = True
                st.session_state.dismiss_count = (
                    st.session_state.get("dismiss_count", 0) + 1
                )

            @st.dialog("Test Dialog", on_dismiss=on_dialog_dismiss)
            def test_dialog():
                st.write("Dialog content")

            if st.button("Open Dialog"):
                test_dialog()

            if st.session_state.get("callback_executed"):
                st.success(
                    f"Callback executed {st.session_state.get('dismiss_count', 0)} times!"
                )

        # This is a placeholder for actual integration testing
        at = AppTest.from_function(script)
        at.run()

        # Basic test that the script runs without error
        assert not at.exception
