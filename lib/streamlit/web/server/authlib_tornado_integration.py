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

from typing import TYPE_CHECKING, Any

from authlib.integrations.base_client import (
    FrameworkIntegration,
)

from streamlit.runtime.secrets import AttrDict

if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.web.server.oidc_mixin import TornadoOAuth


class TornadoIntegration(FrameworkIntegration):
    def update_token(
        self,
        token: dict[str, Any],
        refresh_token: dict[str, Any] | None = None,
        access_token: dict[str, Any] | None = None,
    ) -> None:
        """We do not support access token refresh, since we obtain and operate only on
        identity tokens. We override this method explicitly to implement all abstract
        methods of base class.
        """

    @staticmethod
    def load_config(  # type: ignore[override]
        oauth: TornadoOAuth, name: str, params: Sequence[str]
    ) -> dict[str, Any]:
        """Configure Authlib integration with provider parameters
        specified in secrets.toml.
        """

        # oauth.config here is an auth section from secrets.toml
        # We parse it here to transform nested AttrDict (for client_kwargs value)
        # to dict so Authlib can work with it under the hood.
        if not oauth.config:
            return {}

        prepared_config = {}
        for key in params:
            value = oauth.config.get(name, {}).get(key, None)
            if isinstance(value, AttrDict):
                # We want to modify client_kwargs further after loading server metadata
                value = value.to_dict()
            if value is not None:
                prepared_config[key] = value
        return prepared_config
