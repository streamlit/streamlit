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

from contextlib import contextmanager
from typing import Any

from streamlit import config


@contextmanager
def patch_config_options(config_overrides: dict[str, Any]):
    """A context manager that overrides config options. It can
    also be used as a function decorator.

    Examples
    --------
    >>> with patch_config_options({"server.headless": True}):
    ...     assert config.get_option("server.headless") is True
    ...     # Other test code that relies on these options

    >>> @patch_config_options({"server.headless": True})
    ... def test_my_thing():
    ...     assert config.get_option("server.headless") is True
    """
    # Lazy-load for performance reasons.
    from unittest.mock import patch

    mock_get_option = build_mock_config_get_option(config_overrides)
    with patch.object(config, "get_option", new=mock_get_option):
        yield


def build_mock_config_get_option(overrides_dict):
    orig_get_option = config.get_option

    def mock_config_get_option(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_get_option(name)

    return mock_config_get_option
