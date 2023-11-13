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

single_key_dict = {"x": "y"}


@pytest.mark.parametrize(
    "app_with_params", [{"query_params": single_key_dict}], indirect=True
)
def test_app_with_params_single_key(app_with_params: Page):
    assert app_with_params.get_by_text("x") is not None


multiple_key_dict = {"x": "y", "a": "b"}


@pytest.mark.parametrize(
    "app_with_params", [{"query_params": multiple_key_dict}], indirect=True
)
def test_app_with_params_multi_key(app_with_params: Page):
    for key, value in multiple_key_dict.items():
        assert app_with_params.get_by_text(key) is not None
        assert app_with_params.get_by_text(value) is not None


list_val_dict = {"x": ("y", 1, 2.34)}


@pytest.mark.parametrize(
    "app_with_params", [{"query_params": list_val_dict}], indirect=True
)
def test_app_with_params_list_val(app_with_params: Page):
    for key, value in list_val_dict.items():
        assert app_with_params.get_by_text(key) is not None
        for query_param_value in value:
            assert app_with_params.get_by_text(query_param_value) is not None


empty_val_dict = {"x": ""}


@pytest.mark.parametrize(
    "app_with_params", [{"query_params": empty_val_dict}], indirect=True
)
def test_app_with_params_empty_val(app_with_params: Page):
    assert app_with_params.get_by_text("") is not None
