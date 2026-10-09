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

"""The error the agent API answers a request with when it refuses it."""

from __future__ import annotations

from typing import Any


class AgentRequestError(Exception):
    """A request the interface refuses.

    Usually nothing has executed. Two cases have: ``run_timed_out``, whose run
    is still going, and a creating call whose ``page`` could only be judged
    after the app ran, because the page list did not exist before. A creating
    call that fails after its session exists carries ``session_id``, so the
    caller can continue with that session rather than strand it. ``code`` is
    one of ``protocol.ERROR_CATALOG``'s keys, which decides the HTTP status.
    """

    def __init__(
        self,
        code: str,
        message: str,
        *,
        session_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.session_id = session_id
        # Machine-readable fields for errors whose remedy is a choice from a
        # list, so a client does not have to parse the message to recover.
        self.details = details or {}
