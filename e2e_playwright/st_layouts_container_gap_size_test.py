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

from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key

GAPS = [
    None,
    "xxsmall",
    "xsmall",
    "small",
    "medium",
    "large",
    "xlarge",
    "xxlarge",
]


def test_layouts_container_gap_size(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for each top-level container in st_layouts_container_gap_size.py."""
    for gap in GAPS:
        gap_name = str(gap).lower()

        container_keys = [
            f"container-horizontal-gap-{gap_name}",
            f"container-vertical-gap-{gap_name}",
        ]

        for key in container_keys:
            locator = get_element_by_key(app, key)
            assert_snapshot(locator, name=f"st_layouts_container_gap_size-{key}")
