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

"""The codes the agent API answers a refused request with, and their statuses."""

from __future__ import annotations

from typing import Any, Final, Literal, TypeAlias

AgentErrorCode: TypeAlias = Literal[
    "invalid_request",
    "request_too_large",
    "invalid_value",
    "not_a_value",
    "not_a_trigger",
    "missing_form_submit",
    "cross_dialog_batch",
    "cross_form_batch",
    "unsupported_element",
    "unknown_key",
    "unknown_session",
    "unknown_page",
    "not_on_page",
    "disabled_widget",
    "session_busy",
    "wait_timed_out",
    "internal_error",
    "not_available",
    "host_not_allowed",
    "origin_not_allowed",
    "too_many_sessions",
]

# Every failure the route can report, as code -> (HTTP status, meaning).
#
# Most are refusals before any app code runs. The exceptions are
# `wait_timed_out`, whose run continues, and `unknown_page` on a creating
# call, judged after the run. A run that raised is not one of them: it is a 200
# with `status: "error"`.
ERROR_CATALOG: Final[dict[AgentErrorCode, tuple[int, str]]] = {
    "invalid_request": (
        400,
        (
            "The request is malformed: an unknown field, a field of the wrong "
            "type or format, text that is not valid Unicode, `widget_state` or "
            "`trigger` on a creating call, navigation combined with widget "
            "changes, or a web page's request without `Content-Type: "
            "application/json`."
        ),
    ),
    "request_too_large": (
        413,
        "The body is larger than `server.maxWidgetStateSize`.",
    ),
    "invalid_value": (
        400,
        (
            "A value the element cannot take: of the wrong JSON type, outside "
            "its options or over its selection limit, or one the widget cannot "
            "read. The message lists the legal options where there are some."
        ),
    ),
    "not_a_value": (
        400,
        "The element is a trigger: fire it with `trigger`.",
    ),
    "not_a_trigger": (
        400,
        "The element holds a value: set it through `widget_state`.",
    ),
    "missing_form_submit": (
        400,
        (
            "Fields of an `st.form` were sent without one of its submit "
            "triggers, so they would change nothing."
        ),
    ),
    "cross_dialog_batch": (
        400,
        (
            "Widgets in an open `st.dialog` were combined with widgets outside "
            "it or in a fragment inside it. Send each region's widgets on "
            "their own."
        ),
    ),
    "cross_form_batch": (
        400,
        (
            "One request cannot span two forms, or mix a form's fields with "
            "other controls."
        ),
    ),
    "unsupported_element": (
        400,
        (
            "The element is on the page but cannot be driven here: it is "
            "display-only, takes input JSON cannot express (uploads), or its "
            "`support` field says why."
        ),
    ),
    "unknown_key": (
        404,
        (
            "No element with that key exists in this session. Keys come from "
            "the latest snapshot and are never constructed."
        ),
    ),
    "unknown_session": (
        404,
        (
            "The `session_id` does not exist or has expired. Omit it to start a "
            "new session."
        ),
    ),
    "unknown_page": (
        404,
        "No page has that `url_path`. The response's `pages` lists the available ones.",
    ),
    "not_on_page": (
        409,
        (
            "The element exists in this session but cannot be used now: it may "
            "be on a page you left, appear only after another control changes, "
            "be in a closed dialog, or be left from a script that failed to "
            "compile."
        ),
    ),
    "disabled_widget": (
        409,
        "The element is on the page but disabled; it accepts nothing until the app enables it.",
    ),
    "session_busy": (
        409,
        (
            "The session already has an interaction in flight, or a timed-out "
            "run is still going. Collect that run by sending only `session_id`."
        ),
    ),
    # 202 rather than 504: the request was accepted and its run is still going,
    # and gateways and HTTP clients retry 502-504 on their own. A retried
    # creating call would start another session and another run, and lose the
    # `session_id` this response carries.
    "wait_timed_out": (
        202,
        (
            "Not a failure: the run outlasted `server.agentWaitTimeout` and is "
            "still going. Send only `session_id` to collect it."
        ),
    ),
    "internal_error": (
        500,
        (
            "The interaction could not be completed. The cause is logged "
            "server-side and not returned."
        ),
    ),
    "not_available": (
        403,
        "The agent API is off. The operator enables it with `server.enableAgentApi`.",
    ),
    "host_not_allowed": (
        403,
        "The request's `Host` is not in `server.allowedHosts`.",
    ),
    "origin_not_allowed": (
        403,
        (
            "Sent by a web page whose `Origin` is not in "
            "`server.corsAllowedOrigins`. Programmatic clients send no `Origin`."
        ),
    ),
    "too_many_sessions": (
        429,
        (
            "The server already holds `server.agentMaxSessions` sessions. Reuse "
            "a `session_id`, or retry once idle ones expire."
        ),
    ),
}


def error_status(code: AgentErrorCode) -> int:
    """Return the HTTP status for an error code.

    Raises
    ------
    KeyError
        If ``code`` is not in ``ERROR_CATALOG``.
    """
    status, _ = ERROR_CATALOG[code]
    return status


class AgentRequestError(Exception):
    """A request the agent API refuses.

    Usually nothing has executed. Two cases have: ``wait_timed_out``, whose run
    is still going, and a creating call whose ``page`` could only be judged
    after the app ran, because the page list did not exist before. A creating
    call that fails after its session exists carries ``session_id``, so the
    caller can continue with that session rather than strand it. ``code`` is
    one of ``ERROR_CATALOG``'s keys, which decides the HTTP status.
    """

    def __init__(
        self,
        code: AgentErrorCode,
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
