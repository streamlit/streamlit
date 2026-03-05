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
from typing import Any
from urllib.parse import parse_qs, urlparse

from parameterized import parameterized

from streamlit import url_util

GITHUB_URLS = [
    (
        "https://github.com/aritropaul/streamlit/blob/b72adbcf00c91775db14e739e2ea33d6df9079c3/lib/streamlit/cli.py",
        "https://github.com/aritropaul/streamlit/raw/b72adbcf00c91775db14e739e2ea33d6df9079c3/lib/streamlit/cli.py",
    ),
    (
        "https://github.com/streamlit/streamlit/blob/develop/e2e_playwright/st_video.py",
        "https://github.com/streamlit/streamlit/raw/develop/e2e_playwright/st_video.py",
    ),
    (
        "https://github.com/text2gene/text2gene/blob/master/sbin/clinvar.hgvs_citations.sql",
        "https://github.com/text2gene/text2gene/raw/master/sbin/clinvar.hgvs_citations.sql",
    ),
    (
        "https://github.com/mekarpeles/math.mx/blob/master/README.md",
        "https://github.com/mekarpeles/math.mx/raw/master/README.md",
    ),
]

GIST_URLS = [
    (
        "https://gist.github.com/nthmost/b521b80fbd834e67b3f5e271e9548232",
        "https://gist.github.com/nthmost/b521b80fbd834e67b3f5e271e9548232/raw",
    ),
    (
        "https://gist.github.com/scottyallen/1888e058261fc21f184f6be192bbe131",
        "https://gist.github.com/scottyallen/1888e058261fc21f184f6be192bbe131/raw",
    ),
    (
        "https://gist.github.com/tvst/faf057abbedaccaa70b48216a1866cdd",
        "https://gist.github.com/tvst/faf057abbedaccaa70b48216a1866cdd/raw",
    ),
]

INVALID_URLS = [
    "blah",
    "google.com",
    "http://homestarrunner.com",
    "https://somethinglikegithub.com/withablob",
    "gist.github.com/nothing",
    "https://raw.githubusercontent.com/streamlit/streamlit/develop/e2e_playwright/st_video.py",
    "streamlit.io/raw/blob",
]


class GitHubUrlTest(unittest.TestCase):
    def test_github_url_is_replaced(self):
        for target, processed in GITHUB_URLS:
            assert url_util.process_gitblob_url(target) == processed

    def test_gist_url_is_replaced(self):
        for target, processed in GIST_URLS:
            assert url_util.process_gitblob_url(target) == processed

    def test_nonmatching_url_is_not_replaced(self):
        for url in INVALID_URLS:
            assert url == url_util.process_gitblob_url(url)


class UrlUtilTest(unittest.TestCase):
    @parameterized.expand(
        [
            # Valid URLs:
            ("http://www.cwi.nl:80/%7Eguido/Python.html", True),
            ("https://stackoverflow.com", True),
            ("mailto:test@example.com", True),
            ("data:image/svg+xml;base64,PHN2ZyB4aHcvMjAwMC9zdmci", True),
            ("data:application/pdf;base64,PHN2ZyB4aHcvMjAwMC9zdmci", True),
            ("http://127.0.0.1", True),  # IP as domain
            ("https://[::1]", True),  # IPv6 address in URL
            # Invalid URLs:
            ("/data/Python.html", False),
            ("www.streamlit.io", False),  # Missing scheme
            (532, False),
            ("dkakasdkjdjakdjadjfalskdjfalk", False),
            ("mailto:", False),
            ("ftp://example.com/resource", False),  # Unsupported scheme
            ("https:///path/to/resource", False),  # Missing netloc
        ]
    )
    def test_is_url(self, url: Any, expected_value: bool):
        """Test the is_url utility function."""
        assert (
            url_util.is_url(url, ("http", "https", "data", "mailto")) == expected_value
        )

    @parameterized.expand(
        [
            ("http://example.com", ("http",), True),
            ("mailto:test@example.com", ("http", "https"), False),
            ("mailto:test@example.com", ("http", "mailto"), True),
            ("https://example.com", ("http",), False),
            ("https://example.com", ("https",), True),
            ("data:image/png;base64,abc123", ("data",), True),
            ("data:image/png;base64,abc123", ("http", "https", "mailto"), False),
            ("https://example.com", ("http", "https", "mailto"), True),
            ("http://example.com", None, True),  # None schema == use default
            ("https://example.com", None, True),  # None schema == use default
            ("data:image/png;base64,abc123", None, False),  # None schema == use default
            ("mailto:test@example.com", None, False),  # None schema == use default
        ]
    )
    def test_is_url_limits_schema(
        self,
        url: str,
        allowed_schemas: tuple[url_util.UrlSchema, ...] | None,
        expected_value: bool,
    ):
        """Test that is_ur applies the allowed schema parameter."""

        if allowed_schemas is None:
            assert url_util.is_url(url) == expected_value
        else:
            assert url_util.is_url(url, allowed_schemas) == expected_value


class NormalizeUrlQueryEncodingTest(unittest.TestCase):
    """Tests for normalize_url_query_encoding function."""

    @parameterized.expand(
        [
            # Unencoded URLs should be properly encoded
            (
                "http://localhost:8501?foo=/* Model Errors */worker",
                "http://localhost:8501?foo=%2F%2A+Model+Errors+%2A%2Fworker",
            ),
            (
                "http://localhost:8501?name=John Doe&filter=test value",
                "http://localhost:8501?name=John+Doe&filter=test+value",
            ),
            # Already encoded URLs should remain unchanged (or normalized)
            (
                "http://localhost:8501?foo=%2F%2A+Model+Errors+%2A%2Fworker",
                "http://localhost:8501?foo=%2F%2A+Model+Errors+%2A%2Fworker",
            ),
            # URLs without query strings should be unchanged
            ("http://localhost:8501", "http://localhost:8501"),
            ("http://localhost:8501/page", "http://localhost:8501/page"),
            ("http://localhost:8501#section", "http://localhost:8501#section"),
            # URLs with fragments should preserve the fragment
            (
                "http://localhost:8501?foo=bar value#section",
                "http://localhost:8501?foo=bar+value#section",
            ),
            # Empty values should be preserved
            (
                "http://localhost:8501?empty=&foo=bar",
                "http://localhost:8501?empty=&foo=bar",
            ),
            # Multiple values for same key should be preserved
            (
                "http://localhost:8501?arr=1&arr=2",
                "http://localhost:8501?arr=1&arr=2",
            ),
            # Special characters in query values
            (
                "http://example.com?q=hello world!",
                "http://example.com?q=hello+world%21",
            ),
            # URLs with paths
            (
                "http://example.com/path/to/page?key=value with spaces",
                "http://example.com/path/to/page?key=value+with+spaces",
            ),
            # Query parameter value containing '=' should be handled
            (
                "http://example.com?formula=a=b",
                "http://example.com?formula=a%3Db",
            ),
        ]
    )
    def test_normalize_url_query_encoding(self, input_url: str, expected_url: str):
        """Test that URLs are properly normalized."""
        assert url_util.normalize_url_query_encoding(input_url) == expected_url

    def test_normalize_preserves_semantics_for_encoded_urls(self):
        """Test that encoding/decoding cycle preserves meaning."""
        # %20 and + both represent spaces - normalization may change one to the other
        # but the decoded value should be the same

        input_url = "http://localhost:8501?name=John%20Doe"
        normalized = url_util.normalize_url_query_encoding(input_url)

        # Parse both and verify the query param values are equivalent
        input_params = parse_qs(urlparse(input_url).query)
        normalized_params = parse_qs(urlparse(normalized).query)

        assert input_params == normalized_params
