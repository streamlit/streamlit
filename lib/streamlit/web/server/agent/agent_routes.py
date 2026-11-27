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

"""HTTP routes for the agent JSON interact endpoint."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from streamlit import config
from streamlit.logger import get_logger
from streamlit.web.server.agent.agent_interact import (
    AgentInteractError,
    interact,
    parse_interact_request,
)
from streamlit.web.server.request_locality import is_direct_loopback
from streamlit.web.server.starlette.starlette_routes import (
    ROUTE_AGENT_INTERACT,
    _with_base,
)

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response
    from starlette.routing import BaseRoute

    from streamlit.runtime import Runtime

_LOGGER = get_logger(__name__)


def create_agent_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create the loopback-only agent interact route."""
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    async def _interact_endpoint(request: Request) -> Response:
        if not config.get_option("server.enableAgentApi"):
            return JSONResponse({"error": "not_found"}, status_code=404)

        client_host = request.client.host if request.client is not None else None
        if not is_direct_loopback(client_host):
            return JSONResponse(
                {
                    "error": "loopback_only",
                    "message": "The agent API is only available to loopback peers.",
                },
                status_code=403,
            )

        try:
            raw = await request.body()
            body: object = {} if not raw else json.loads(raw)
        except Exception:
            return JSONResponse(
                {
                    "error": "invalid_request",
                    "message": "Request body must be valid JSON.",
                },
                status_code=400,
            )
        try:
            parsed = parse_interact_request(body)
            snapshot = await interact(runtime, parsed, remote_ip=client_host)
        except AgentInteractError as exc:
            return JSONResponse(
                {"error": exc.code, "message": exc.message},
                status_code=exc.http_status,
            )
        except Exception:
            _LOGGER.exception("Agent interact failed")
            return JSONResponse(
                {"error": "internal_error", "message": "Agent interact failed."},
                status_code=500,
            )
        return JSONResponse(snapshot)

    return [
        Route(
            _with_base(ROUTE_AGENT_INTERACT, base_url),
            _interact_endpoint,
            methods=["POST"],
        )
    ]
