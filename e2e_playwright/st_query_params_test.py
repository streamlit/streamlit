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
import pytest
from playwright.sync_api import Page

test_dicts = [{"x": "y"}, {"x": "y", "a": "b"}, {"x": ("y", 1, 2.34)}, {"x": ""}]


@pytest.mark.parametrize("app_with_query_params", test_dicts, indirect=True)
def test_app_with_query_params(app_with_query_params: Page):
    page, test_dict = app_with_query_params
    for key, value in test_dict.items():
        assert page.get_by_text(key) is not None

        if isinstance(value, (list, tuple)):
            for item in value:
                assert page.get_by_text(item) is not None
        else:
            assert page.get_by_text(value) is not None
