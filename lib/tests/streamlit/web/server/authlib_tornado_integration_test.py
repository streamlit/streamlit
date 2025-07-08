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

"""Unit tests for authlib_tornado_integration.py."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock

from streamlit.runtime.secrets import AttrDict
from streamlit.web.server.authlib_tornado_integration import TornadoIntegration


class TornadoIntegrationTest(unittest.TestCase):
    def test_load_basic_config(self):
        basic_config_mock = MagicMock(
            config={
                "google": {
                    "client_id": "GOOGLE_CLIENT_ID",
                    "client_secret": "GOOGLE_CLIENT_SECRET",
                    "something": "else",
                },
                "okta": {
                    "client_id": "OKTA_CLIENT_ID",
                    "client_secret": "OKTA_CLIENT_SECRET",
                },
            }
        )

        prepared_google_config = TornadoIntegration.load_config(
            basic_config_mock, "google", ["client_id", "client_secret"]
        )
        prepared_okta_config = TornadoIntegration.load_config(
            basic_config_mock, "okta", ["client_id", "client_secret"]
        )

        assert prepared_google_config == {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "GOOGLE_CLIENT_SECRET",
        }
        assert prepared_okta_config == {
            "client_id": "OKTA_CLIENT_ID",
            "client_secret": "OKTA_CLIENT_SECRET",
        }

    def test_load_config_with_client_kwargs(self):
        config_mock = MagicMock(
            config={
                "google": {
                    "client_id": "GOOGLE_CLIENT_ID",
                    "client_secret": "GOOGLE_CLIENT_SECRET",
                    "something": "else",
                    "client_kwargs": AttrDict(
                        {"prompt": "consent", "scope": "openid email profile"}
                    ),
                },
            }
        )

        prepared_google_config = TornadoIntegration.load_config(
            config_mock, "google", ["client_id", "client_secret", "client_kwargs"]
        )

        assert prepared_google_config == {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "GOOGLE_CLIENT_SECRET",
            "client_kwargs": {"prompt": "consent", "scope": "openid email profile"},
        }

    def test_load_config_with_attr_dict(self):
        config_mock = MagicMock(
            config=AttrDict(
                {
                    "google": AttrDict(
                        {
                            "client_id": "GOOGLE_CLIENT_ID",
                            "client_secret": "GOOGLE_CLIENT_SECRET",
                            "something": "else",
                            "client_kwargs": AttrDict(
                                {"prompt": "consent", "scope": "openid email profile"}
                            ),
                        }
                    ),
                }
            )
        )

        prepared_google_config = TornadoIntegration.load_config(
            config_mock, "google", ["client_id", "client_secret", "client_kwargs"]
        )

        assert prepared_google_config == {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "GOOGLE_CLIENT_SECRET",
            "client_kwargs": {"prompt": "consent", "scope": "openid email profile"},
        }
