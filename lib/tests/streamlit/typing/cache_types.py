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

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    import streamlit as st

    @st.cache_data
    def cached_data_fn(arg1: int, arg2: str) -> bool:
        return True

    @st.cache_data(ttl=1)
    def cached_data_fn_with_decorator_args(arg1: int, arg2: str) -> bool:
        return True

    assert_type(cached_data_fn(1, "2"), bool)
    assert_type(cached_data_fn.clear(), None)
    assert_type(cached_data_fn.clear(1), None)
    assert_type(cached_data_fn.clear(1, "2"), None)
    assert_type(cached_data_fn.clear(1, arg2="2"), None)
    assert_type(cached_data_fn.clear(arg1=1), None)
    assert_type(cached_data_fn.clear(arg2="2"), None)
    assert_type(cached_data_fn.clear(arg1=1, arg2="2"), None)

    assert_type(cached_data_fn_with_decorator_args(1, "2"), bool)
    assert_type(cached_data_fn_with_decorator_args.clear(), None)
    assert_type(cached_data_fn_with_decorator_args.clear(1), None)
    assert_type(cached_data_fn_with_decorator_args.clear(1, "2"), None)
    assert_type(cached_data_fn_with_decorator_args.clear(1, arg2="2"), None)
    assert_type(cached_data_fn_with_decorator_args.clear(arg1=1), None)
    assert_type(cached_data_fn_with_decorator_args.clear(arg2="2"), None)
    assert_type(cached_data_fn_with_decorator_args.clear(arg1=1, arg2="2"), None)

    @st.cache_resource
    def cached_resource_fn(arg1: int, arg2: str) -> bool:
        return True

    @st.cache_resource(ttl=1)
    def cached_resource_fn_with_decorator_args(arg1: int, arg2: str) -> bool:
        return True

    assert_type(cached_resource_fn(1, "2"), bool)
    assert_type(cached_resource_fn.clear(), None)
    assert_type(cached_resource_fn.clear(1), None)
    assert_type(cached_resource_fn.clear(1, "2"), None)
    assert_type(cached_resource_fn.clear(1, arg2="2"), None)
    assert_type(cached_resource_fn.clear(arg1=1), None)
    assert_type(cached_resource_fn.clear(arg2="2"), None)
    assert_type(cached_resource_fn.clear(arg1=1, arg2="2"), None)

    assert_type(cached_resource_fn_with_decorator_args(1, "2"), bool)
    assert_type(cached_resource_fn_with_decorator_args.clear(), None)
    assert_type(cached_resource_fn_with_decorator_args.clear(1), None)
    assert_type(cached_resource_fn_with_decorator_args.clear(1, "2"), None)
    assert_type(cached_resource_fn_with_decorator_args.clear(1, arg2="2"), None)
    assert_type(cached_resource_fn_with_decorator_args.clear(arg1=1), None)
    assert_type(cached_resource_fn_with_decorator_args.clear(arg2="2"), None)
    assert_type(cached_resource_fn_with_decorator_args.clear(arg1=1, arg2="2"), None)
