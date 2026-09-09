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

from __future__ import annotations

import unittest

import pytest
from parameterized import parameterized

from streamlit.config_option import ConfigOption


class ConfigOptionTest(unittest.TestCase):
    @parameterized.expand(
        [
            ("missingKey",),
            (".missingSection",),
            ("has spaces",),
            ("_.key"),
            ("section.v_1_name"),
            ("section.another_section.key"),
        ]
    )
    def test_invalid_key(self, key):
        with pytest.raises(
            ValueError,
            match=f'Key "{key}" has invalid format.',
        ):
            ConfigOption(key)

    @parameterized.expand(
        [
            ("section.name", "section", "name"),
            ("section.numbered12", "section", "numbered12"),
            ("numbered1.allowCaps", "numbered1", "allowCaps"),
            ("allowCaps.numbered2", "allowCaps", "numbered2"),
            ("section.subSection.name", "section.subSection", "name"),
        ]
    )
    def test_valid_keys(self, key, section, name):
        c = ConfigOption(key)
        assert section == c.section
        assert name == c.name

    def test_constructor_default_values(self):
        key = "mysection.myName"
        c = ConfigOption(key)
        assert c.section == "mysection"
        assert c.name == "myName"
        assert None is c.description
        assert c.visibility == "visible"

    def test_call(self):
        key = "mysection.myName"
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            """Random docstring."""

        assert c.description == "Random docstring."
        assert someRandomFunction._get_val_func == c._get_val_func

    def test_call_with_missing_docstring(self):
        """Test that missing docstrings default to empty string.

        This supports PYTHONOPTIMIZE=2 where docstrings are stripped.
        """
        key = "mysection.myName"
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            pass

        assert c.description == ""

    def test_value(self):
        my_value = "myValue"

        key = "mysection.myName"
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            """Random docstring."""
            return my_value

        assert my_value == c.value

    def test_set_value(self):
        my_value = "myValue"
        where_defined = "im defined here"

        key = "mysection.myName"
        c = ConfigOption(key)
        c.set_value(my_value, where_defined)

        assert my_value == c.value
        assert where_defined == c.where_defined

    def _assert_deprecation_banner_is_flush_left(self, message: str) -> None:
        """Logged deprecation banners must be flush left.

        A zero-indent line anywhere in the template (e.g. a stray character on
        the first line) makes textwrap.dedent() a no-op, so the rest of the
        banner keeps its source indentation.
        """
        non_empty = [line for line in message.splitlines() if line]
        assert non_empty[0].startswith("═"), (
            f"banner should start at column 0, got {non_empty[0][:40]!r}"
        )
        for line in non_empty:
            assert not line.startswith(" "), f"line still indented: {line!r}"

    @parameterized.expand(
        [
            ("single_line", "dep text"),
            (
                "multi_line",
                """
                Instead of this, you should use either the MAPBOX_API_KEY environment
                variable or PyDeck's `api_keys` argument.
                """,
            ),
        ]
    )
    def test_deprecated_expired(self, _case: str, deprecation_text: str) -> None:
        """Expired options log a flush-left error that the option is unsupported."""
        my_value = "myValue"
        where_defined = "im defined here"

        key = "mysection.myName"

        c = ConfigOption(
            key,
            deprecated=True,
            deprecation_text=deprecation_text,
            expiration_date="2000-01-01",
        )

        with self.assertLogs("streamlit.config_option", level="ERROR") as logs:
            c.set_value(my_value, where_defined)

        message = logs.records[0].getMessage()
        self._assert_deprecation_banner_is_flush_left(message)
        assert "mysection.myName IS NO LONGER SUPPORTED." in message
        assert "Please update im defined here." in message
        for snippet in c.deprecation_text.splitlines():
            if snippet:
                assert snippet in message
        assert c.is_expired()

    @parameterized.expand(
        [
            ("single_line", "dep text"),
            (
                "multi_line",
                """
                Instead of this, you should use either the MAPBOX_API_KEY environment
                variable or PyDeck's `api_keys` argument.
                """,
            ),
        ]
    )
    def test_deprecated_unexpired(self, _case: str, deprecation_text: str) -> None:
        """Unexpired options log a flush-left warning that the option is deprecated."""
        my_value = "myValue"
        where_defined = "im defined here"

        key = "mysection.myName"

        c = ConfigOption(
            key,
            deprecated=True,
            deprecation_text=deprecation_text,
            expiration_date="2100-01-01",
        )

        with self.assertLogs("streamlit.config_option", level="WARNING") as logs:
            c.set_value(my_value, where_defined)

        message = logs.records[0].getMessage()
        self._assert_deprecation_banner_is_flush_left(message)
        assert "mysection.myName IS DEPRECATED." in message
        assert "This option will be removed on or after 2100-01-01." in message
        assert "Please update im defined here." in message
        for snippet in c.deprecation_text.splitlines():
            if snippet:
                assert snippet in message
        assert not c.is_expired()

    def test_replaced_by_unexpired(self):
        c = ConfigOption(
            "mysection.oldName",
            description="My old description",
            replaced_by="mysection.newName",
            expiration_date="2100-01-01",
        )

        assert c.deprecated
        assert not c.is_expired()

    def test_replaced_by_expired(self):
        c = ConfigOption(
            "mysection.oldName",
            description="My old description",
            replaced_by="mysection.newName",
            expiration_date="2000-01-01",
        )

        assert c.deprecated
        assert c.is_expired()
