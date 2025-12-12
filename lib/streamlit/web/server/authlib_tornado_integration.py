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

import json
from typing import TYPE_CHECKING, Any

from authlib.integrations.base_client import (
    FrameworkIntegration,
)

from streamlit.runtime.secrets import AttrDict

if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.web.server.oidc_mixin import TornadoOAuth


class TornadoIntegration(FrameworkIntegration):
    """Authlib framework integration for Tornado.

    Tornado doesn't have persistent sessions like Flask/Django, so we override
    the state data methods to use only the cache. This is compatible with both
    older authlib versions and authlib 1.6.6+ which changed to always track
    state in session.
    """

    def _get_cache_data_safe(self, key: str) -> dict[str, Any] | None:
        """Get and decode JSON data from cache with fallback for authlib compatibility.

        This method provides a safe way to retrieve cached data that works across
        different authlib versions. It first tries the parent class's _get_cache_data
        method, and falls back to direct cache access if that method isn't available.
        """
        # Try using authlib's helper method if available (it's a private method,
        # so we check for its existence to maintain compatibility across versions)
        get_cache_data = getattr(self, "_get_cache_data", None)
        if get_cache_data is not None:
            result: dict[str, Any] | None = get_cache_data(key)
            return result

        # Fallback: direct cache access with JSON decoding
        # This mirrors the implementation in FrameworkIntegration._get_cache_data
        value = self.cache.get(key)
        if not value:
            return None
        try:
            parsed: dict[str, Any] = json.loads(value)
            return parsed
        except (TypeError, ValueError):
            return None

    def get_state_data(
        self,
        session: dict[str, Any],  # noqa: ARG002
        state: str,
    ) -> dict[str, Any] | None:
        """Get OAuth state data from cache.

        Overridden to use cache directly without requiring session persistence,
        since Tornado doesn't have persistent sessions across requests.
        The session parameter is unused but required by the parent class signature.
        """
        if not self.cache:
            return None
        key = f"_state_{self.name}_{state}"
        cached_value = self._get_cache_data_safe(key)
        if cached_value:
            return cached_value.get("data")
        return None

    def clear_state_data(
        self,
        session: dict[str, Any],  # noqa: ARG002
        state: str,
    ) -> None:
        """Clear OAuth state data from cache.

        Overridden to use cache directly without requiring session persistence,
        since Tornado doesn't have persistent sessions across requests.
        The session parameter is unused but required by the parent class signature.
        """
        if self.cache:
            key = f"_state_{self.name}_{state}"
            self.cache.delete(key)

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
