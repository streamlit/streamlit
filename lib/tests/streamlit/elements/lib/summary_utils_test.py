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

"""Unit tests for streamlit.elements.lib.summary_utils."""

from __future__ import annotations

import pandas as pd
import pytest

from streamlit.elements.lib.summary_utils import (
    convert_summary_config_to_json,
    process_summary_config,
)
from streamlit.errors import StreamlitAPIException


class TestProcessSummaryConfig:
    """Tests for process_summary_config function."""

    def test_returns_empty_dict_when_none(self):
        """Test that None input returns empty dict."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        result = process_summary_config(None, df)
        assert result == {}

    def test_valid_summary_with_column_name(self):
        """Test valid summary config with column names."""
        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        result = process_summary_config({"a": "sum", "b": "average"}, df)
        assert result == {"a": {"type": "sum"}, "b": {"type": "average"}}

    def test_valid_summary_with_column_index(self):
        """Test valid summary config with column indices."""
        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        result = process_summary_config({0: "sum", 1: "max"}, df)
        assert result == {"a": {"type": "sum"}, "b": {"type": "max"}}

    def test_mixed_column_names_and_indices(self):
        """Test valid summary config with mixed column names and indices."""
        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        result = process_summary_config({"a": "sum", 1: "max"}, df)
        assert result == {"a": {"type": "sum"}, "b": {"type": "max"}}

    def test_count_works_on_text_columns(self):
        """Test that count works on text columns."""
        df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"]})
        result = process_summary_config({"name": "count"}, df)
        assert result == {"name": {"type": "count"}}

    def test_sum_fails_on_text_columns(self):
        """Test that sum raises error for text columns."""
        df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"name": "sum"}, df)
        assert 'Cannot compute "sum"' in str(exc_info.value)
        assert "non-numeric data" in str(exc_info.value)

    def test_average_fails_on_text_columns(self):
        """Test that average raises error for text columns."""
        df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"name": "average"}, df)
        assert 'Cannot compute "average"' in str(exc_info.value)

    def test_min_fails_on_text_columns(self):
        """Test that min raises error for text columns."""
        df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"name": "min"}, df)
        assert 'Cannot compute "min"' in str(exc_info.value)

    def test_max_fails_on_text_columns(self):
        """Test that max raises error for text columns."""
        df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"name": "max"}, df)
        assert 'Cannot compute "max"' in str(exc_info.value)

    def test_invalid_column_name_raises_error(self):
        """Test that invalid column name raises error."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"nonexistent": "sum"}, df)
        assert 'Column "nonexistent" not found' in str(exc_info.value)
        assert '"a"' in str(exc_info.value)  # Available columns listed

    def test_invalid_column_index_raises_error(self):
        """Test that out-of-range column index raises error."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({5: "sum"}, df)
        assert "Column index 5 is out of range" in str(exc_info.value)

    def test_negative_column_index_raises_error(self):
        """Test that negative column index raises error."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({-1: "sum"}, df)
        assert "Column index -1 is out of range" in str(exc_info.value)

    def test_invalid_summary_type_raises_error(self):
        """Test that invalid summary type raises error."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"a": "invalid"}, df)  # type: ignore
        assert 'Invalid summary type "invalid"' in str(exc_info.value)

    def test_all_valid_summary_types(self):
        """Test all valid summary types work for numeric columns."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        for summary_type in ["count", "sum", "average", "min", "max"]:
            result = process_summary_config({"a": summary_type}, df)  # type: ignore
            assert result == {"a": {"type": summary_type}}

    def test_all_without_default(self):
        """Test 'all' without default uses 'count' as default."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        result = process_summary_config({"a": "all"}, df)
        assert result == {"a": {"type": "all", "default": "count"}}

    def test_all_with_default(self):
        """Test 'all:sum' parses correctly."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        result = process_summary_config({"a": "all:sum"}, df)
        assert result == {"a": {"type": "all", "default": "sum"}}

    def test_all_with_empty_default(self):
        """Test 'all:' uses 'count' as default."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        result = process_summary_config({"a": "all:"}, df)
        assert result == {"a": {"type": "all", "default": "count"}}

    def test_all_fails_on_text_columns(self):
        """Test that 'all' raises error for text columns."""
        df = pd.DataFrame({"name": ["Alice", "Bob", "Charlie"]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"name": "all"}, df)
        assert 'Cannot use "all"' in str(exc_info.value)
        assert "non-numeric data" in str(exc_info.value)

    def test_all_with_invalid_default_raises_error(self):
        """Test that 'all:invalid' raises error."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        with pytest.raises(StreamlitAPIException) as exc_info:
            process_summary_config({"a": "all:invalid"}, df)
        assert 'Invalid default summary type "invalid"' in str(exc_info.value)


class TestConvertSummaryConfigToJson:
    """Tests for convert_summary_config_to_json function."""

    def test_empty_config_returns_empty_string(self):
        """Test that empty config returns empty string."""
        result = convert_summary_config_to_json({})
        assert result == ""

    def test_valid_config_returns_json(self):
        """Test that valid config returns proper JSON."""
        result = convert_summary_config_to_json(
            {"a": {"type": "sum"}, "b": {"type": "average"}}
        )
        assert result == '{"a": {"type": "sum"}, "b": {"type": "average"}}'

    def test_single_column_config(self):
        """Test single column config."""
        result = convert_summary_config_to_json({"revenue": {"type": "sum"}})
        assert result == '{"revenue": {"type": "sum"}}'

    def test_all_config_returns_json(self):
        """Test that 'all' config returns proper JSON."""
        result = convert_summary_config_to_json(
            {"revenue": {"type": "all", "default": "sum"}}
        )
        assert result == '{"revenue": {"type": "all", "default": "sum"}}'
