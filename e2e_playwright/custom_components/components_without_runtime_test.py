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

"""
In https://github.com/streamlit/streamlit/issues/8606 we learned that some custom components
run without a started Streamlit process, e.g. for automated tests.
The issue is fixed in https://github.com/streamlit/streamlit/pull/8610 and the tests
are added to capture this kind of failure in the future.
The module is marked with 'no_app_server' as we do not run an app here.
"""

import pytest

# we do not need an app server here
pytestmark = pytest.mark.no_app_server


def test_folium_runs_standalone():
    """Test that _RELEASE can be imported.

    This use-case was reported as being broken in https://github.com/streamlit/streamlit/issues/8606
    """
    from streamlit_folium import _RELEASE

    assert _RELEASE


def test_navigation_bar_runs_standalone():
    """Test that custom components can be run standlone without Streamlit throwing an error.

    This use-case was reported as being broken in https://github.com/streamlit/streamlit/issues/8606
    """
    import subprocess

    result = subprocess.run(
        ["streamlit-navigation-bar"],
        capture_output=True,
        text=True,
    )
    assert result.stdout

    # we install this specific version in the Makefile
    assert result.stdout.strip() == "Streamlit Navigation Bar, version 3.1.2"
