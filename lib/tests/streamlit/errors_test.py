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

"""Unit tests for streamlit/errors.py."""

from __future__ import annotations

from streamlit.errors import (
    BidiComponentUnserializableDataError,
    LocalizableStreamlitException,
    StreamlitAPIException,
    StreamlitAPIWarning,
    StreamlitMixedNumericTypesError,
    StreamlitModuleNotFoundError,
    StreamlitPageNotFoundError,
)


class TestStreamlitAPIException:
    """Tests for StreamlitAPIException."""

    def test_repr(self) -> None:
        """Test that __repr__ returns a string representation with class name."""
        exc = StreamlitAPIException("test message")
        result = repr(exc)
        assert "StreamlitAPIException" in result


class TestStreamlitAPIWarning:
    """Tests for StreamlitAPIWarning."""

    def test_repr(self) -> None:
        """Test that __repr__ returns a string representation with class name."""
        warning = StreamlitAPIWarning("test warning")
        result = repr(warning)
        assert "StreamlitAPIWarning" in result

    def test_tacked_on_stack(self) -> None:
        """Test that tacked_on_stack is captured on initialization."""
        warning = StreamlitAPIWarning("test warning")
        assert warning.tacked_on_stack is not None
        assert len(warning.tacked_on_stack) > 0


class TestStreamlitModuleNotFoundError:
    """Tests for StreamlitModuleNotFoundError."""

    def test_message_format(self) -> None:
        """Test that the error message includes the module name."""
        error = StreamlitModuleNotFoundError("pandas")
        assert "pandas" in str(error)
        assert "requires module" in str(error)


class TestLocalizableStreamlitException:
    """Tests for LocalizableStreamlitException."""

    def test_exec_kwargs_property(self) -> None:
        """Test that exec_kwargs property returns the kwargs used in formatting."""
        error = LocalizableStreamlitException(
            "Error with {param1} and {param2}",
            param1="value1",
            param2="value2",
        )
        assert error.exec_kwargs == {"param1": "value1", "param2": "value2"}


class TestStreamlitMixedNumericTypesError:
    """Tests for StreamlitMixedNumericTypesError."""

    def test_with_value_only(self) -> None:
        """Test error message when only value is provided."""
        error = StreamlitMixedNumericTypesError(
            value=1.0, min_value=None, max_value=None, step=None
        )
        assert "value" in str(error).lower()
        assert "float" in str(error).lower()

    def test_with_min_value(self) -> None:
        """Test error message when min_value is provided."""
        error = StreamlitMixedNumericTypesError(
            value=1.0, min_value=1, max_value=None, step=None
        )
        assert "min_value" in str(error)
        assert "int" in str(error)

    def test_with_max_value(self) -> None:
        """Test error message when max_value is provided."""
        error = StreamlitMixedNumericTypesError(
            value=1.0, min_value=None, max_value=10, step=None
        )
        assert "max_value" in str(error)

    def test_with_step(self) -> None:
        """Test error message when step is provided."""
        error = StreamlitMixedNumericTypesError(
            value=1.0, min_value=None, max_value=None, step=0.5
        )
        assert "step" in str(error)

    def test_with_all_params(self) -> None:
        """Test error message when all params are provided."""
        # Note: min_value=0 is falsy, so we use 1 to ensure it's included in message
        error = StreamlitMixedNumericTypesError(
            value=1.0, min_value=1, max_value=10, step=0.5
        )
        message = str(error)
        assert "value" in message.lower()
        assert "min_value" in message
        assert "max_value" in message
        assert "step" in message

    def test_with_min_literal(self) -> None:
        """Test error message when value is 'min' literal."""
        error = StreamlitMixedNumericTypesError(
            value="min", min_value=0, max_value=10, step=None
        )
        # The value "min" has type str, so value_type will be str
        assert "str" in str(error)


class TestStreamlitPageNotFoundError:
    """Tests for StreamlitPageNotFoundError."""

    def test_with_pages_directory(self) -> None:
        """Test error message when uses_pages_directory is True."""
        error = StreamlitPageNotFoundError(
            page="my_page.py",
            main_script_directory="/path/to/app",
            uses_pages_directory=True,
        )
        message = str(error)
        assert "my_page.py" in message
        assert "pages/" in message
        assert "app" in message  # directory basename

    def test_without_pages_directory(self) -> None:
        """Test error message when uses_pages_directory is False."""
        error = StreamlitPageNotFoundError(
            page="my_page.py",
            main_script_directory="/path/to/app",
            uses_pages_directory=False,
        )
        message = str(error)
        assert "my_page.py" in message
        assert "st.Page" in message
        assert "st.navigation" in message


class TestBidiComponentUnserializableDataError:
    """Tests for BidiComponentUnserializableDataError."""

    def test_error_message(self) -> None:
        """Test that the error message is correctly formatted."""
        error = BidiComponentUnserializableDataError()
        message = str(error)
        assert "data" in message.lower()
        assert "serializ" in message.lower()
