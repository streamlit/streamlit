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

"""E2E test for st.App secrets parameter.

This tests that programmatic secrets can be passed to st.App and are
available via st.secrets within the running Streamlit script.
"""

from __future__ import annotations

import streamlit as st

# Create the ASGI app with programmatic secrets
app = st.App(
    "st_app_secrets_script.py",
    secrets={
        "api_key": "test-api-key-12345",
        "database": {
            "host": "localhost",
            "port": 5432,
        },
        "auth": {
            "client_id": "my-client-id",
            "client_secret": "my-client-secret",
        },
    },
)
