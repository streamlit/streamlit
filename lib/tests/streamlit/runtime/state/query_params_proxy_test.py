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

from streamlit.runtime.state.query_params_proxy import QueryParamsProxy


class TestQueryParamsProxy:
    @pytest.fixture
    def proxy(self):
        """Fixture to create a QueryParamsProxy instance."""
        proxy = QueryParamsProxy()
        proxy["test"] = "value"
        return proxy

    def test_get_item(self, proxy):
        assert proxy["test"] == "value"

    def test_set_item(self, proxy):
        assert "test" in proxy

    def test_del_item(self, proxy):
        del proxy["test"]
        assert "test" not in proxy

    def test_len(self, proxy):
        assert len(proxy) == 1

    def test_iter(self, proxy):
        keys = list(iter(proxy))
        assert keys == ["test"]

    def test_contains(self, proxy):
        assert "test" in proxy

    def test_clear(self, proxy):
        proxy.clear()
        assert len(proxy) == 0

    def test_get(self, proxy):
        assert proxy.get("test") == "value"

    def test_get_default(self, proxy):
        assert proxy.get("nonexistent", "bob") == "bob"

    def test_get_all(self, proxy):
        proxy["test"] = ["value1", "value2"]
        assert proxy.get_all("test") == ["value1", "value2"]

    def test_getattr(self, proxy):
        proxy["test"] = "value"
        assert proxy.test == "value"

    def test_setattr(self, proxy):
        proxy.test = "value"
        assert proxy["test"] == "value"

    def test_delattr(self, proxy):
        del proxy.test
        assert "test" not in proxy
