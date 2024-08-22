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

from authlib.integrations.base_client import FrameworkIntegration


class TornadoIntegration(FrameworkIntegration):
    def update_token(self, token, refresh_token=None, access_token=None):
        """We do not support token refresh, since we obtain and operate user
        identity tokens"""

    @staticmethod
    def load_config(oauth, name, params):
        """Configure Authlib integration with provider parameters
        specified in secrets.toml
        """
        if not oauth.config:
            return {}

        prepared_config = {}
        for key in params:
            value = oauth.config.get(name, {}).get(key, None)
            if value is not None:
                prepared_config[key] = value
        return prepared_config
