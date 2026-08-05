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

"""Shared E2E harness for the skills-install surfaces.

Both the startup nudge toast (``skills_nudge_test``) and the in-error callout
(``skills_install_callout_test``) need the same precondition: a temp HOME with
an AI-agent harness present but no Streamlit skills installed, running the app
from an isolated project dir so skill detection can't pick up the developer's /
CI's real checkout. This helper builds that setup once so the two tests don't
duplicate it.
"""

from __future__ import annotations

import os
import shutil
from types import SimpleNamespace
from typing import TYPE_CHECKING

from e2e_playwright.conftest import start_app_server

if TYPE_CHECKING:
    import pytest

    from e2e_playwright.conftest import AsyncSubprocess


def start_agent_home_app_server(
    app_port: int,
    request: pytest.FixtureRequest,
    tmp_path_factory: pytest.TempPathFactory,
    *,
    home_prefix: str,
    project_prefix: str,
) -> AsyncSubprocess:
    """Start the app in a temp HOME with an agent harness present but no skills.

    Creates a temp HOME containing a ``.claude`` agent-config dir (the "agent
    present" signal) and empty credentials (so non-headless startup never
    prompts), copies the test's app script into an ISOLATED temp project dir,
    and starts the server non-headless with that HOME. The result is the
    deterministic "agent present, no skills installed" state that makes the
    server recommend the skills install — the precondition for both the nudge
    toast and the in-error callout.

    Skill detection scans the app dir, its git root, and the nearest
    agent-config ancestor; isolating the project keeps the only signal coming
    from the temp HOME, so the tests never depend on the real checkout.

    ``home_prefix`` / ``project_prefix`` just name the temp dirs per caller.
    Returns the started ``AsyncSubprocess`` (the caller yields and terminates it).
    """
    home = tmp_path_factory.mktemp(home_prefix)
    # An agent harness is considered "present" when its home config dir exists.
    (home / ".claude").mkdir()
    # Pre-seed empty credentials so non-headless startup never prompts.
    streamlit_dir = home / ".streamlit"
    streamlit_dir.mkdir()
    (streamlit_dir / "credentials.toml").write_text('[general]\nemail = ""\n')

    # Copy the app script into an isolated project dir and point a shim module at
    # it; start_app_server resolves the script purely from ``__file__``.
    project = tmp_path_factory.mktemp(project_prefix)
    assert request.module.__file__ is not None
    source_script = request.module.__file__.replace("_test.py", ".py")
    shutil.copy(source_script, project / os.path.basename(source_script))
    isolated_module = SimpleNamespace(
        __file__=str(project / os.path.basename(request.module.__file__))
    )

    return start_app_server(
        app_port,
        isolated_module,  # type: ignore[arg-type]
        # Appended last so they override the headless default in conftest.
        extra_args=["--server.headless", "false"],
        extra_env={"HOME": str(home)},
    )
