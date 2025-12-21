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

from playwright.sync_api import Page, expect
from collections.abc import Callable

def test_hello_app_accessibility(app: Page, assert_accessibility: Callable[[], None]):
    """Test that the Hello App is accessible."""
    # The app fixture loads the main hello app by default or we can navigate
    expect(app.get_by_test_id("stAppViewContainer")).toBeVisible()

    # Run accessibility check
    assert_accessibility()
