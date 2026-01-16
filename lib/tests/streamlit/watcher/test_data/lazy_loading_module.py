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

"""Test module that simulates lazy-loading behavior like pulumi-aws.

Some packages (e.g., pulumi-aws) override __getattribute__ to implement
lazy loading. When hasattr() or getattr() is called on such modules,
the custom __getattribute__ triggers full initialization, causing
significant memory and performance overhead.

See https://github.com/streamlit/streamlit/issues/13530
"""

import types


class _LazyLoadingModule(types.ModuleType):
    """A module that tracks attribute accesses via __getattribute__.

    This simulates packages like pulumi-aws that use __getattribute__
    to implement lazy loading of submodules.
    """

    def __init__(self, name: str):
        super().__init__(name)
        # Store the real __file__ in __dict__ directly
        object.__setattr__(self, "__dict__", {"__file__": "/fake/path/module.py"})
        # Track how many times __getattribute__ is called
        object.__setattr__(self, "_getattribute_call_count", 0)

    def __getattribute__(self, name: str):
        # Don't count internal dunder access needed for module functionality
        if name not in {"__class__", "__dict__", "_getattribute_call_count"}:
            count = object.__getattribute__(self, "_getattribute_call_count")
            object.__setattr__(self, "_getattribute_call_count", count + 1)

        # Simulate lazy loading - in real modules like pulumi-aws,
        # this would trigger loading of submodules
        return object.__getattribute__(self, name)


LazyLoadingModule = _LazyLoadingModule("LazyLoadingModule")
