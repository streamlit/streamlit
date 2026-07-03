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

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import click
import pytest

from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    DeferredFileResponsePayload,
)
from streamlit.runtime.backend_operation_handler import (
    BackendOperationDispatcher,
    DeferredFileHandler,
    DismissSkillsNudgeHandler,
    InstallSkillsHandler,
    connection_locality,
)
from streamlit.web import skills

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


@pytest.fixture(autouse=True)
def _default_loopback_connection() -> Iterator[None]:
    """Default the skills-nudge connection-locality gate to ``"loopback"`` so the
    install/dismiss handler tests exercise their action paths. Tests that probe
    the non-loopback refusal override this with their own patch."""
    with patch(
        "streamlit.runtime.backend_operation_handler.connection_locality",
        return_value="loopback",
    ):
        yield


def _create_deferred_file_request(
    *,
    request_id: str = "request-id",
    session_id: str = "session-id",
    file_id: str = "file-id",
) -> BackendOperationRequest:
    request = BackendOperationRequest()
    request.request_id = request_id
    request.session_id = session_id
    request.deferred_file.file_id = file_id
    return request


def test_dispatch_returns_error_without_payload() -> None:
    """Test that requests without payloads are rejected."""
    dispatcher = BackendOperationDispatcher()
    request = BackendOperationRequest(request_id="request-id", session_id="session-id")

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert response.request_id == "request-id"
    assert response.error_msg == "No payload specified in request"
    assert not response.HasField("deferred_file")


def test_dispatch_returns_error_without_registered_handler() -> None:
    """Test that unregistered payload types are rejected."""
    dispatcher = BackendOperationDispatcher()
    request = _create_deferred_file_request()

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert response.request_id == "request-id"
    assert "No handler registered" in response.error_msg
    assert not response.HasField("deferred_file")


def test_dispatch_calls_registered_handler() -> None:
    """Test that registered handlers receive matching requests."""

    class Handler:
        called_with: tuple[BackendOperationRequest, str] | None = None

        async def handle(
            self,
            request: BackendOperationRequest,
            session_id: str,
        ) -> BackendOperationResponse:
            self.called_with = (request, session_id)
            return BackendOperationResponse(
                request_id=request.request_id,
                deferred_file=DeferredFileResponsePayload(url="/media/generated"),
            )

    dispatcher = BackendOperationDispatcher()
    handler = Handler()
    request = _create_deferred_file_request()
    dispatcher.register("deferred_file", handler)

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert handler.called_with == (request, "session-id")
    assert response.request_id == "request-id"
    assert response.deferred_file.url == "/media/generated"
    assert response.error_msg == ""


def test_dispatch_returns_error_when_handler_fails() -> None:
    """Test that handler exceptions become error responses."""

    class FailingHandler:
        async def handle(
            self,
            _request: BackendOperationRequest,
            _session_id: str,
        ) -> BackendOperationResponse:
            raise RuntimeError("handler failed")

    dispatcher = BackendOperationDispatcher()
    dispatcher.register("deferred_file", FailingHandler())
    request = _create_deferred_file_request()

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert response.request_id == "request-id"
    assert response.error_msg == "Failed to process backend operation"
    assert not response.HasField("deferred_file")


def test_deferred_file_handler_returns_generated_url() -> None:
    """Test that deferred file requests execute via the media file manager."""
    media_file_mgr = MagicMock()
    media_file_mgr.execute_deferred.return_value = "/media/generated"
    handler = DeferredFileHandler(lambda: media_file_mgr)

    response = asyncio.run(
        handler.handle(_create_deferred_file_request(file_id="file-123"), "session-id")
    )

    media_file_mgr.execute_deferred.assert_called_once_with("file-123")
    assert response.request_id == "request-id"
    assert response.deferred_file.url == "/media/generated"
    assert response.error_msg == ""


def test_deferred_file_handler_returns_error_response() -> None:
    """Test that deferred file execution errors are returned to the caller."""
    media_file_mgr = MagicMock()
    media_file_mgr.execute_deferred.side_effect = RuntimeError("download failed")
    handler = DeferredFileHandler(lambda: media_file_mgr)

    response = asyncio.run(
        handler.handle(_create_deferred_file_request(file_id="file-123"), "session-id")
    )

    media_file_mgr.execute_deferred.assert_called_once_with("file-123")
    assert response.request_id == "request-id"
    assert response.error_msg == "Failed to generate file for download"
    assert not response.HasField("deferred_file")


def _install_skills_request(
    *, request_id: str = "request-id", session_id: str = "session-id"
) -> BackendOperationRequest:
    request = BackendOperationRequest(request_id=request_id, session_id=session_id)
    request.install_skills.SetInParent()
    return request


def _dismiss_nudge_request(
    *, request_id: str = "request-id", session_id: str = "session-id"
) -> BackendOperationRequest:
    request = BackendOperationRequest(request_id=request_id, session_id=session_id)
    request.dismiss_skills_nudge.SetInParent()
    return request


def test_install_skills_handler_installs_in_project_mode() -> None:
    """A successful install returns a payload, a summary, and clears the cache."""
    install_result = skills._InstallResult(
        installed=[".agents/skills/foo", ".claude/skills/foo"]
    )
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch.object(skills, "detect_installed_agents", return_value=["claude"]),
        patch(
            "streamlit.web.skills.install_skills", return_value=install_result
        ) as mock_install,
        patch.object(skills, "clear_installed_skills_cache") as mock_clear,
    ):
        response = asyncio.run(
            InstallSkillsHandler(lambda: "/app/dir").handle(
                _install_skills_request(), "session-id"
            )
        )

    # Install resolves its root from the app dir so it lands in the tree the
    # nudge detected against (not the server's cwd).
    mock_install.assert_called_once_with(
        global_mode=False, yes=True, app_dir="/app/dir"
    )
    # The cache is invalidated so a later session doesn't re-show the nudge.
    mock_clear.assert_called_once()
    assert response.request_id == "request-id"
    assert response.HasField("install_skills")
    # The result is summarized into a user-facing detail message for the toast.
    assert (
        response.install_skills.detail == "Installed to .agents/skills, .claude/skills."
    )
    assert response.error_msg == ""


def test_install_skills_handler_reports_failure() -> None:
    """Install failures are returned via the response's error message."""
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch.object(skills, "detect_installed_agents", return_value=["claude"]),
        patch(
            "streamlit.web.skills.install_skills",
            side_effect=click.ClickException("No skills found"),
        ),
    ):
        response = asyncio.run(
            InstallSkillsHandler(lambda: "/app/dir").handle(
                _install_skills_request(), "session-id"
            )
        )

    assert response.error_msg == "No skills found"
    assert not response.HasField("install_skills")


def test_install_skills_handler_refuses_without_agent_harness() -> None:
    """The install ACTION is gated on safety, not the nudge's display predicate:
    with no agent harness present (and not headless) the request is anomalous,
    so the install is refused and never attempted.
    """
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch.object(skills, "detect_installed_agents", return_value=[]),
        patch("streamlit.web.skills.install_skills") as mock_install,
    ):
        response = asyncio.run(
            InstallSkillsHandler(lambda: "/app/dir").handle(
                _install_skills_request(), "session-id"
            )
        )

    mock_install.assert_not_called()
    assert response.error_msg == "Skills install is not available in this environment."
    assert not response.HasField("install_skills")


def test_install_skills_handler_refuses_non_loopback_connection() -> None:
    """The install is refused when the browser is not on a direct-loopback
    connection (Docker/VM/tunnel), even with an agent present and not headless,
    so a shared/deployed-ish app can never trigger a filesystem write."""
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch.object(skills, "detect_installed_agents", return_value=["claude"]),
        patch(
            "streamlit.runtime.backend_operation_handler.connection_locality",
            return_value="private",
        ),
        patch("streamlit.web.skills.install_skills") as mock_install,
    ):
        response = asyncio.run(
            InstallSkillsHandler(lambda: "/app/dir").handle(
                _install_skills_request(), "session-id"
            )
        )

    mock_install.assert_not_called()
    assert response.error_msg == "Skills install is not available in this environment."
    assert not response.HasField("install_skills")


def test_install_skills_handler_allows_idempotent_retry_when_already_installed() -> (
    None
):
    """Regression: the action must NOT be gated on "skills already installed".

    A retry after a dropped connection whose first attempt completed
    server-side must succeed (the re-install reports "up to date"), not be
    refused — otherwise a success is surfaced as an unrecoverable error and
    logged as a failed install. So with an agent present and not headless, the
    handler installs even though detection would already report the skills.
    """
    up_to_date = skills._InstallResult(up_to_date=[".agents/skills/foo"])
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch.object(skills, "detect_installed_agents", return_value=["claude"]),
        # Skills already present (the nudge's display predicate would be False)...
        patch.object(
            skills,
            "detect_installed_skills",
            return_value=["app:claude:developing-with-streamlit"],
        ),
        patch(
            "streamlit.web.skills.install_skills", return_value=up_to_date
        ) as mock_install,
        patch.object(skills, "clear_installed_skills_cache"),
    ):
        response = asyncio.run(
            InstallSkillsHandler(lambda: "/app/dir").handle(
                _install_skills_request(), "session-id"
            )
        )

    # ...the retry still runs and reports a clean idempotent success.
    mock_install.assert_called_once_with(
        global_mode=False, yes=True, app_dir="/app/dir"
    )
    assert response.error_msg == ""
    assert response.HasField("install_skills")
    assert response.install_skills.detail == "Skills are already up to date."


def test_install_skills_handler_refuses_in_headless_mode() -> None:
    """End-to-end gate check: with headless on, the handler refuses without
    attempting an install (the nudge is never shown in headless mode).
    """
    with (
        patch("streamlit.config.get_option", return_value=True),
        patch("streamlit.web.skills.install_skills") as mock_install,
    ):
        response = asyncio.run(
            InstallSkillsHandler(lambda: "/app/dir").handle(
                _install_skills_request(), "session-id"
            )
        )

    mock_install.assert_not_called()
    assert response.error_msg == "Skills install is not available in this environment."
    assert not response.HasField("install_skills")


def test_install_skills_handler_runs_real_installer(tmp_path: Path) -> None:
    """End-to-end: the handler runs the real installer and reports where skills
    landed, so a click on the nudge actually creates the symlinks.
    """
    # Skip on systems without symlink support (e.g. Windows without Dev Mode).
    try:
        (tmp_path / ".symlink_probe").symlink_to(tmp_path)
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks not supported on this platform")

    source_dir = tmp_path / "streamlit" / ".agents" / "skills"
    skill_dir = source_dir / "developing-with-streamlit"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("# Test Skill\n", encoding="utf-8")

    project_dir = tmp_path / "project"
    project_dir.mkdir()

    with (
        patch("streamlit.config.get_option", return_value=False),
        patch.object(skills, "detect_installed_agents", return_value=["claude"]),
        patch.object(skills, "_get_source_skills_dir", return_value=source_dir),
        patch("pathlib.Path.cwd", return_value=project_dir),
        # No ~/.claude, so only .agents/skills is targeted.
        patch("pathlib.Path.home", return_value=tmp_path / "home"),
        patch.object(skills, "clear_installed_skills_cache"),
    ):
        response = asyncio.run(
            InstallSkillsHandler(lambda: str(project_dir)).handle(
                _install_skills_request(), "session-id"
            )
        )

    # The symlink was actually created in the project directory (resolved from
    # the app dir the handler was given)...
    installed = project_dir / ".agents" / "skills" / "developing-with-streamlit"
    assert installed.is_symlink()
    # ...and the response reports it back to the nudge for display.
    assert response.error_msg == ""
    assert response.HasField("install_skills")
    assert response.install_skills.detail == "Installed to .agents/skills."


def test_dismiss_skills_nudge_handler_writes_marker() -> None:
    """Dismissing the nudge persists the marker and acknowledges success."""
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch("streamlit.web.skills.write_nudge_dismissed_marker") as mock_write,
    ):
        response = asyncio.run(
            DismissSkillsNudgeHandler().handle(_dismiss_nudge_request(), "session-id")
        )

    mock_write.assert_called_once_with()
    assert response.request_id == "request-id"
    assert response.error_msg == ""
    assert response.HasField("dismiss_skills_nudge")


def test_dismiss_skills_nudge_handler_refuses_non_loopback_connection() -> None:
    """The dismiss marker is never written from a non-loopback connection
    (mirrors the install gate)."""
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch(
            "streamlit.runtime.backend_operation_handler.connection_locality",
            return_value="other",
        ),
        patch("streamlit.web.skills.write_nudge_dismissed_marker") as mock_write,
    ):
        response = asyncio.run(
            DismissSkillsNudgeHandler().handle(_dismiss_nudge_request(), "session-id")
        )

    mock_write.assert_not_called()
    assert response.error_msg == "Skills nudge is not available in this environment."
    assert not response.HasField("dismiss_skills_nudge")


def test_dismiss_skills_nudge_handler_refuses_in_headless_mode() -> None:
    """The marker is never written in headless mode (mirrors the install gate)."""
    with (
        patch("streamlit.config.get_option", return_value=True),
        patch("streamlit.web.skills.write_nudge_dismissed_marker") as mock_write,
    ):
        response = asyncio.run(
            DismissSkillsNudgeHandler().handle(_dismiss_nudge_request(), "session-id")
        )

    mock_write.assert_not_called()
    assert not response.HasField("dismiss_skills_nudge")
    assert response.error_msg == "Skills nudge is not available in this environment."


def test_dismiss_skills_nudge_handler_reports_failure() -> None:
    """Marker write failures are surfaced as an error response."""
    with (
        patch("streamlit.config.get_option", return_value=False),
        patch(
            "streamlit.web.skills.write_nudge_dismissed_marker",
            side_effect=OSError("disk full"),
        ),
    ):
        response = asyncio.run(
            DismissSkillsNudgeHandler().handle(_dismiss_nudge_request(), "session-id")
        )

    assert response.error_msg == "Failed to save your preference."


@pytest.mark.parametrize(
    ("remote_ip", "expected"),
    [
        ("127.0.0.1", "loopback"),
        ("::1", "loopback"),
        ("10.0.0.5", "private"),
        ("172.17.0.1", "private"),  # Docker bridge gateway
        ("192.168.1.10", "private"),
        ("169.254.1.1", "private"),  # link-local
        ("8.8.8.8", "other"),
        ("2606:4700:4700::1111", "other"),
        ("not-an-ip", "unknown"),
        (None, "unknown"),
    ],
)
def test_connection_locality_classifies_peer_ip(
    remote_ip: str | None, expected: str
) -> None:
    """``connection_locality`` maps the raw websocket peer IP to a coarse class.

    Uses the raw ``remote_ip`` (loopback is "127.0.0.1"/"::1", NOT normalized to
    None like ``st.context.ip_address``), so a genuine loopback dev connection
    is distinguished from Docker/VM/LAN (private) and public (other) peers.
    """
    client = MagicMock()
    client.client_context.remote_ip = remote_ip
    instance = MagicMock()
    instance.get_client.return_value = client
    with (
        patch("streamlit.runtime.exists", return_value=True),
        patch("streamlit.runtime.get_instance", return_value=instance),
    ):
        assert connection_locality("session-id") == expected


def test_connection_locality_unknown_when_runtime_absent() -> None:
    """No running runtime (e.g. ``python app.py`` raw mode) → unknown, no raise."""
    with patch("streamlit.runtime.exists", return_value=False):
        assert connection_locality("session-id") == "unknown"


def test_connection_locality_unknown_when_no_client() -> None:
    """An unknown/closed session (no client) → unknown rather than raising."""
    instance = MagicMock()
    instance.get_client.return_value = None
    with (
        patch("streamlit.runtime.exists", return_value=True),
        patch("streamlit.runtime.get_instance", return_value=instance),
    ):
        assert connection_locality("missing") == "unknown"
