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

from __future__ import annotations

from playwright.sync_api import Locator, expect


def expect_prefixed_markdown(
    locator: Locator,
    expected_prefix: str,
    expected_markdown: str,
    exact_match: bool = False,
) -> None:
    """Find the markdown with the prefix and then ensure that the `expected_markdown` is in the text as well.

    Splitting it into a `filter` and a `to_have_text` check has the advantage that we see the diff in case of a mismatch;
    this would not be the case if we just used the `filter`.

    Only one markdown-element must be returned, otherwise an error is thrown.

    Parameters
    ----------
    locator : Locator
        The locator to search for the markdown element.

    expected_prefix : str
        The prefix of the markdown element.

    expected_markdown : str
        The markdown content that should be found.

    exact_match : bool, optional
        Whether the markdown should exactly match the `expected_markdown`, by default True.
        Otherwise, the `expected_markdown` must be contained in the markdown content.

    """
    selection_text = locator.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected_prefix
    )
    if exact_match:
        expect(selection_text).to_have_text(f"{expected_prefix} {expected_markdown}")
    else:
        expect(selection_text).to_contain_text(expected_markdown)
