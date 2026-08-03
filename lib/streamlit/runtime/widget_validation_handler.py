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

"""Backend operation handler for server-side widget validation requests."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    WidgetValidationResponsePayload,
)
from streamlit.runtime.backend_operation_handler import BackendOperationHandler

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
    from streamlit.runtime.widget_validator_manager import WidgetValidatorManager

_LOGGER: Final = get_logger(__name__)

# Maximum time a single validation callable may run before it is treated as
# failed. Matches the timeout documented in the text-input-validation spec.
#
# Note: the timeout only stops *waiting* for the result — because Python threads
# can't be force-killed, a validator that blocks indefinitely keeps occupying a
# worker thread. Validators run on the event loop's default executor via
# ``asyncio.to_thread``, which is shared runtime-wide with other backend
# operations (deferred downloads, dataframe chunks, etc.), so app authors should
# avoid unbounded blocking calls in a validator (the docstring steers them
# toward catching failures and returning a message instead).
_VALIDATION_TIMEOUT_SECONDS: Final = 10.0

# Shown when a validation callable exceeds ``_VALIDATION_TIMEOUT_SECONDS``.
_TIMEOUT_MESSAGE: Final = "Validation timed out. Please try again."


class WidgetValidationHandler(BackendOperationHandler):
    """Handles ``widget_validation`` backend operation requests.

    Runs the session's registered validation callable in a worker thread (so a
    slow validator doesn't block the event loop), enforces a timeout, and
    returns whether the value is valid along with an optional error message.
    """

    def __init__(self, get_validator_mgr: Callable[[], WidgetValidatorManager]) -> None:
        self._get_validator_mgr = get_validator_mgr

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        payload = request.widget_validation
        validator_id = payload.validator_id
        value = payload.value

        try:
            outcome = await asyncio.wait_for(
                asyncio.to_thread(
                    self._get_validator_mgr().run_validation,
                    session_id,
                    validator_id,
                    value,
                ),
                timeout=_VALIDATION_TIMEOUT_SECONDS,
            )
        except (TimeoutError, asyncio.TimeoutError):
            # The validator ran longer than the allowed budget. We can't kill
            # the worker thread, but its (now stale) result is discarded and the
            # value is rejected with a timeout message.
            _LOGGER.warning(
                "Server-side validation for %s timed out after %.0fs",
                validator_id,
                _VALIDATION_TIMEOUT_SECONDS,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                widget_validation=WidgetValidationResponsePayload(
                    is_valid=False,
                    error_message=_TIMEOUT_MESSAGE,
                ),
            )

        return BackendOperationResponse(
            request_id=request.request_id,
            widget_validation=WidgetValidationResponsePayload(
                is_valid=outcome.is_valid,
                error_message=outcome.error_message,
            ),
        )
