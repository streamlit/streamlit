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

"""page_link unit tests."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitMissingRequiredParameterError,
)
from streamlit.proto.ButtonLikeIconPosition_pb2 import (
    ButtonLikeIconPosition as ProtoButtonLikeIconPosition,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PageLinkTest(DeltaGeneratorTestCase):
    """Test ability to marshall page_link protos."""

    def test_external_http_page(self):
        """Test that it can be called with an external http page link."""
        st.page_link(page="http://example.com", label="HTTP Test")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "HTTP Test"
        assert c.page == "http://example.com"
        assert c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    def test_external_https_page(self):
        """Test that it can be called with an external https page link."""
        st.page_link(page="https://example.com", label="HTTPS Test")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "HTTPS Test"
        assert c.page == "https://example.com"
        assert c.external
        assert not c.disabled

    def test_external_no_label(self):
        """Test that page_link throws on external link with no label."""
        with pytest.raises(StreamlitMissingRequiredParameterError):
            st.page_link(page="http://example.com")

    @parameterized.expand(
        [
            ("backslash_unc", "\\\\server\\share\\page.py"),
            ("forward_slash_unc", "//server/share/page.py"),
            ("forward_then_backslash_unc", "/\\server\\share\\page.py"),
            ("backslash_then_forward_unc", "\\/server/share/page.py"),
            ("extended_unc", "\\\\?\\UNC\\server\\share\\page.py"),
            ("extended_local", "\\\\?\\C:\\app\\page.py"),
            ("device_namespace", "\\\\.\\device\\page.py"),
            ("path_object", Path("\\\\server\\share\\page.py")),
        ]
    )
    @patch("streamlit.env_util.IS_WINDOWS", True)
    def test_rejects_unsafe_windows_paths_before_resolving(
        self, _name: str, page: str | Path
    ) -> None:
        """Windows network/device paths are rejected before filesystem access."""
        with (
            patch("os.path.realpath") as realpath,
            pytest.raises(StreamlitAPIException, match="Network paths"),
        ):
            st.page_link(page)

        realpath.assert_not_called()

    @parameterized.expand(
        [
            ("string", "page\x00.py"),
            ("path_object", Path("page\x00.py")),
        ]
    )
    def test_rejects_null_bytes_before_resolving(
        self, _name: str, page: str | Path
    ) -> None:
        """Null-byte page paths are rejected before filesystem access."""
        with (
            patch("os.path.realpath") as realpath,
            pytest.raises(StreamlitAPIException, match="null bytes"),
        ):
            st.page_link(page)

        realpath.assert_not_called()

    @parameterized.expand(
        [
            ("windows_drive", True, "C:\\app\\page.py"),
            ("parent_relative", True, "../shared/page.py"),
            ("non_windows_double_slash", False, "//server/share/page.py"),
        ]
    )
    def test_allows_paths_accepted_by_the_public_api(
        self, _name: str, is_windows: bool, page: str
    ) -> None:
        """Relative, drive-absolute, and non-Windows double-slash paths resolve."""
        ctx = MagicMock()
        ctx.main_script_path = "/app/main.py"
        ctx.pages_manager.get_pages.return_value = {
            "page": {
                "script_path": "/resolved/page.py",
                "page_name": "Page",
                "page_script_hash": "page-hash",
            }
        }

        with (
            patch("streamlit.env_util.IS_WINDOWS", is_windows),
            patch(
                "streamlit.elements.widgets.button.get_script_run_ctx",
                return_value=ctx,
            ),
            patch(
                "streamlit.elements.widgets.button.normalize_path_join",
                return_value="/unresolved/page.py",
            ),
            patch("os.path.realpath", return_value="/resolved/page.py") as realpath,
        ):
            st.page_link(page)

        # Not assert_called_once_with: the one-time direct-execution warning calls
        # inspect.stack(), which also calls os.path.realpath for loaded modules.
        realpath.assert_any_call("/unresolved/page.py")

    def test_icon(self):
        """Test that it can be called with icon param."""
        st.page_link(page="https://streamlit.io", label="the label", icon="🐶")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.icon == "🐶"
        assert c.icon_position == ProtoButtonLikeIconPosition.LEFT

    def test_icon_position(self):
        """Test that custom icon positions are serialized."""
        st.page_link(
            page="https://streamlit.io",
            label="the label",
            icon="🐶",
            icon_position="right",
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.icon_position == ProtoButtonLikeIconPosition.RIGHT

    def test_disabled(self):
        """Test that it can be called with disabled param."""
        st.page_link(page="https://streamlit.io", label="the label", disabled=True)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.disabled

    def test_help(self):
        """Test that it can be called with help param."""
        st.page_link(
            page="https://streamlit.io", label="the label", help="Some help text"
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.help == "Some help text"

    def test_query_params(self):
        """Test that it can be called with query_params param."""
        st.page_link(
            page="https://streamlit.io",
            label="the label",
            query_params={"foo": "bar", "baz": [1, 2]},
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.query_string == "foo=bar&baz=1&baz=2"

    def test_query_params_list_of_tuples(self):
        """Test that it can be called with query_params as list of tuples."""
        st.page_link(
            page="https://streamlit.io",
            label="the label",
            query_params=[("foo", "bar"), ("baz", "1"), ("baz", "2")],
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.query_string == "foo=bar&baz=1&baz=2"

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_label(self):
        """Test that st.page_link accepts an st.Page, but does not uses its title"""
        page = st.Page("foo.py", title="Bar Test")
        st.page_link(page=page, label="Foo Test")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Foo Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_without_label(self):
        """Test that st.page_link accepts an st.Page, but will use its title if necessary"""
        page = st.Page("foo.py", title="Bar Test")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_url_path(self):
        """Test that st.page_link accepts an st.Page, but will use the url_path if necessary"""
        page = st.Page("foo.py", title="Bar Test", url_path="bar")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "bar"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_icon_passed_to_page_link_takes_precedence(self):
        """Test that st.page_link icon param overrides page icon"""
        page = st.Page("foo.py", title="Bar Test", icon="🎈")
        st.page_link(page=page, icon="🌟")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == "🌟"  # Icon parameter of st.page_link takes precedence
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_icon(self):
        """Test that st.page_link accepts an st.Page, will use its icon"""
        page = st.Page("foo.py", title="Bar Test", icon="🎈")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == "🎈"
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_none_icon(self):
        """Test that st.page_link handles None icon from Page correctly."""
        # None icon defaults to empty string in Page
        page = st.Page("foo.py", title="Bar Test", icon=None)
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""  # None icon should become empty string (default st st.Page)
        assert c.help == ""

    def test_external_streamlit_page(self):
        """Test that st.page_link works with an external Page object."""
        page = st.Page("https://docs.streamlit.io", title="Docs", icon="📖")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Docs"
        assert c.page == "https://docs.streamlit.io"
        assert c.external
        assert c.icon == "📖"
        assert not c.disabled

    def test_external_streamlit_page_with_label_override(self):
        """Test that st.page_link label overrides an external Page title."""
        page = st.Page("https://docs.streamlit.io", title="Docs")
        st.page_link(page=page, label="Custom Label")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Custom Label"
        assert c.page == "https://docs.streamlit.io"
        assert c.external

    @parameterized.expand([("",), ("   ",)])
    def test_empty_or_whitespace_icon_for_external_page_means_no_icon(
        self, icon: str
    ) -> None:
        """st.page_link treats empty or whitespace-only icon as no icon."""
        st.page_link(page="https://example.com", label="Test", icon=icon)
        c = self.get_delta_from_queue().new_element.page_link
        assert c.icon == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_empty_icon_suppresses_page_icon(self) -> None:
        """st.page_link(icon="") must not fall back to the Page icon."""
        page = st.Page("foo.py", title="Bar Test", icon="🎈")
        st.page_link(page=page, icon="")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.icon == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_mismatched_file_path_raises(self):
        """Linking to an ``st.Page`` whose file path does not match the page
        registered under the same ``url_path`` raises.

        Regression coverage for https://github.com/streamlit/streamlit/issues/10572.
        """
        st.navigation([st.Page("page1.py", url_path="foo")])

        bad_page = st.Page("other.py", url_path="foo")
        with pytest.raises(StreamlitAPIException, match=r"different page is "):
            st.page_link(bad_page)

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_inferred_url_path_mismatch_raises(self):
        """Linking to ``st.Page("foo.py")`` (url_path inferred as ``foo``)
        raises when a different file is registered under ``url_path="foo"``."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        with pytest.raises(StreamlitAPIException, match=r"different page is "):
            st.page_link(st.Page("foo.py"))

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_callable_with_file_registered_raises(self):
        """Linking to a callable-based ``st.Page`` raises when the registered
        page sharing its ``url_path`` is file-based."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        def some_callable() -> None:
            pass

        with pytest.raises(StreamlitAPIException, match=r"is a callable"):
            st.page_link(st.Page(some_callable, url_path="foo"))

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_matching_source_does_not_raise(self):
        """An ``st.Page`` whose source matches the registered page is accepted
        by validation."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        matching = st.Page("page1.py", url_path="foo")
        st.page_link(matching)

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_unregistered_url_path_does_not_raise(self):
        """If no page with the given ``url_path`` is registered (no hash
        collision), validation is skipped — preserving previous behavior for
        apps that don't use ``st.navigation``."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        st.page_link(st.Page("other.py", url_path="bar"))


@patch("pathlib.Path.is_file", MagicMock(return_value=True))
class PageLinkHelpInheritanceTest(DeltaGeneratorTestCase):
    """st.page_link inherits the linked page's help unless help is passed."""

    def setUp(self) -> None:
        super().setUp()
        # The test context has no main script, so st.navigation resolves page
        # files against the working directory. Resolve page_link paths there too.
        patcher = patch(
            "streamlit.elements.widgets.button.get_main_script_directory",
            return_value=str(self.script_run_ctx.pages_manager.main_script_parent),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    @parameterized.expand(
        [
            ("file", "foo.py", False),
            ("external_url", "https://docs.streamlit.io", True),
        ]
    )
    def test_page_object_help_is_inherited(
        self, _name: str, page_source: str, is_external: bool
    ) -> None:
        """An omitted help takes the Page's help, for file and external pages."""
        page = st.Page(page_source, title="Foo", help="Net revenue by **region**.")
        st.page_link(page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.external is is_external
        assert c.help == "Net revenue by **region**."

    @parameterized.expand(
        [
            ("explicit", "Opens revenue with the current filters."),
            ("empty", ""),
        ]
    )
    def test_passed_help_wins_over_page_help(self, _name: str, help: str) -> None:
        """A passed help replaces the Page's help; help="" shows no tooltip."""
        page = st.Page("foo.py", title="Foo", help="Page help.")
        st.page_link(page, help=help)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.help == help

    def test_external_url_string_inherits_nothing(self) -> None:
        """An external URL string has no page to inherit help from, even when a
        registered page links to the same URL."""
        st.navigation(
            [
                st.Page("page1.py"),
                st.Page("https://docs.streamlit.io", title="Docs", help="The docs."),
            ]
        )
        st.page_link("https://docs.streamlit.io", label="Docs")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.external
        assert c.help == ""

    def test_registered_path_inherits_help(self) -> None:
        """A path to a page passed to st.navigation takes that page's help,
        including a hidden page's."""
        st.navigation(
            [
                st.Page("page1.py", help="First page."),
                st.Page("page2.py", visibility="hidden", help="Hidden page."),
            ]
        )
        st.page_link("page2.py")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "page2"
        assert c.help == "Hidden page."

    def test_registered_path_with_passed_help(self) -> None:
        """A passed help, including "", wins over the registered page's help."""
        st.navigation([st.Page("page1.py", help="First page.")])
        st.page_link("page1.py", help="")
        st.page_link("page1.py", help="Local help.")

        assert self.get_delta_from_queue(-2).new_element.page_link.help == ""
        assert self.get_delta_from_queue(-1).new_element.page_link.help == "Local help."

    def test_shared_script_inherits_from_the_first_registered_page(self) -> None:
        """When pages share a script, label and help both come from the first
        registered page with that script."""
        st.navigation(
            [
                st.Page("shared.py", title="Revenue", url_path="a", help="Revenue."),
                st.Page("shared.py", title="Costs", url_path="b", help="Costs."),
            ]
        )
        st.page_link("shared.py")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Revenue"
        assert c.help == "Revenue."

    def test_registry_entry_without_help_inherits_nothing(self) -> None:
        """The default single-page registry has no help key, so no tooltip."""
        ctx = MagicMock()
        ctx.main_script_path = "/app/main.py"
        ctx.pages_manager.get_pages.return_value = {
            "page1": {
                "script_path": "/app/page1.py",
                "page_name": "Page 1",
                "page_script_hash": "hash123",
            }
        }

        with (
            patch(
                "streamlit.elements.widgets.button.get_script_run_ctx",
                return_value=ctx,
            ),
            patch("os.path.realpath", return_value="/app/page1.py"),
        ):
            st.page_link("page1.py")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.page_script_hash == "hash123"
        assert c.help == ""
