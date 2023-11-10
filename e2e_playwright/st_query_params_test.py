# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

single_key_dict = {"x": "y", "z": "a"}


@pytest.mark.parametrize(
    "app_with_params", [{"query_params": single_key_dict}], indirect=True
)
def test_app_with_params(app_with_params: Page):
    assert app_with_params.get_by_text("x") != None
    # checking if this works
    assert app_with_params.get_by_text("bob") != None


multiple_key_dict = {"x": "y", "a": "b"}


@pytest.mark.parametrize(
    "app_with_params", [{"query_params": multiple_key_dict}], indirect=True
)
def test_app_with_params(app_with_params: Page):
    for key, value in multiple_key_dict.items():
        assert app_with_params.get_by_text(key) != None
        assert app_with_params.get_by_text(value) != None


list_val_dict = {"x": ["y", "z", 1, 2.3]}


@pytest.mark.parametrize(
    "app_with_params", [{"query_params": list_val_dict}], indirect=True
)
def test_app_with_params(app_with_params: Page):
    for key, value in list_val_dict.items():
        assert app_with_params.get_by_text(key) != None
        for query_param_value in value:
            assert app_with_params.get_by_text(query_param_value) != None
