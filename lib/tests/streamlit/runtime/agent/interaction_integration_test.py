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

"""Agent interactions against a real Runtime running temporary scripts.

Scripts that need to be held mid-run wait at ``run_gate``, which the test
opens, so no test depends on how long a run takes.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import re
import textwrap
import threading
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final
from unittest.mock import patch

import pytest

from streamlit.elements.lib import agent_spec
from streamlit.runtime import Runtime, RuntimeConfig
from streamlit.runtime.agent import interaction, snapshot
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_session_storage import MemorySessionStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.scriptrunner import RerunData, ScriptRunner
from streamlit.runtime.websocket_session_manager import WebsocketSessionManager
from tests.streamlit.runtime.agent import run_gate
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Iterable, Iterator
    from pathlib import Path

    from streamlit.runtime.app_session import AppSession
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        UserInfoType,
    )

_HANDLE: Final = re.compile(r"s_[0-9a-f]{32}")

# A run that is expected to time out waits this long; every other run gets the
# default, which no test comes close to.
_SHORT_TIMEOUT: Final = 0.2
_TIMEOUT: Final = 10.0

_COUNTER_SCRIPT: Final = """
import streamlit as st
from tests.streamlit.runtime.agent import run_gate

starts = run_gate.count("starts")
run_gate.wait()
done = run_gate.count("done")
st.session_state.setdefault("runs", 0)
st.session_state.runs += 1
st.text(f"starts={starts} done={done} runs={st.session_state.runs}")
st.button("Go", key="go")
"""

_NAVIGATION_SCRIPT: Final = """
import streamlit as st
from tests.streamlit.runtime.agent import run_gate

run_gate.count("runs")
st.sidebar.selectbox(
    "Region", ["EMEA", "APAC", "AMER"], key="region", bind="query-params"
)

def home():
    st.text("page=home")
    st.page_link(report_page, label="Report", query_params={"quarter": "Q3"})

def report():
    st.text("page=report")
    st.selectbox(
        "Quarter", ["Q1", "Q2", "Q3", "Q4"], key="quarter", bind="query-params"
    )

home_page = st.Page(home, title="Home", default=True)
report_page = st.Page(report, title="Report", url_path="report")
st.navigation([home_page, report_page]).run()
"""

_CONTEXT_SCRIPT: Final = """
import streamlit as st
from tests.streamlit.runtime.agent import run_gate

run_gate.wait()
st.text(f"timezone={st.context.timezone}")
st.text(f"offset={st.context.timezone_offset}")
st.text(f"locale={st.context.locale}")
st.text(f"url={st.context.url}")
st.text(f"embedded={st.context.is_embedded}")
st.text(f"theme={st.context.theme.type}")
st.text(f"cookies={dict(st.context.cookies)}")
for name in ["X-Token", "Cookie", "Authorization", "Proxy-Authorization"]:
    st.text(f"{name}={st.context.headers.get(name)}")
"""


@pytest.fixture
def options() -> Iterator[dict[str, Any]]:
    """Config overrides, read at every lookup, so a test can change them."""
    overrides: dict[str, Any] = {
        "server.fileWatcherType": "none",
        "server.agentRunTimeout": _TIMEOUT,
        "server.agentSessionTTL": 900,
        "server.agentMaxSessions": 100,
    }
    with patch_config_options(overrides):
        yield overrides


@pytest.fixture(autouse=True)
def _open_gate() -> Iterator[None]:
    run_gate.reset()
    yield
    run_gate.opened.set()


@dataclass
class _App:
    """A started Runtime on one script, with an agent session registry."""

    runtime: Runtime
    registry: interaction.AgentSessionRegistry
    options: dict[str, Any]
    # Every response body the build produced, in order.
    bodies: list[bytes] = field(default_factory=list)

    def _encode(self, document: dict[str, Any]) -> bytes:
        body = json.dumps(document).encode("utf-8")
        self.bodies.append(body)
        return body

    async def call(
        self,
        request: dict[str, Any] | None = None,
        *,
        run_timeout: float = _TIMEOUT,
        user_info: UserInfoType | None = None,
        headers: Iterable[tuple[str, str]] = (),
    ) -> dict[str, Any]:
        # `interact` reads the timeout before it first suspends, so a value set
        # here applies to this call alone, even with other calls in flight.
        self.options["server.agentRunTimeout"] = run_timeout
        body = await interaction.interact(
            self.runtime,
            self.registry,
            {} if request is None else request,
            user_info={} if user_info is None else user_info,
            headers=headers,
            encode=self._encode,
        )
        document: dict[str, Any] = json.loads(body)
        return document

    async def refused(
        self, request: dict[str, Any] | None = None, **kwargs: Any
    ) -> AgentRequestError:
        with pytest.raises(AgentRequestError) as raised:
            await self.call(request, **kwargs)
        return raised.value

    async def call_opening_gate(
        self, request: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        """Send ``request``, and open the run gate once the call has started."""
        call = asyncio.create_task(self.call(request, **kwargs))
        await asyncio.sleep(0)
        run_gate.opened.set()
        return await call

    def app_session(self, handle: str) -> AppSession:
        return self.registry.app_session(self.registry._sessions[handle])

    async def settled(self, handle: str) -> None:
        async with asyncio.timeout(5):
            await self.app_session(handle).wait_until_settled()


@contextlib.asynccontextmanager
async def _running_app(
    tmp_path: Path, options: dict[str, Any], script: str
) -> AsyncGenerator[_App, None]:
    main_script = tmp_path / "app.py"
    main_script.write_text(textwrap.dedent(script))
    Runtime._instance = None
    runtime = Runtime(
        RuntimeConfig(
            script_path=str(main_script),
            media_file_storage=MemoryMediaFileStorage("/media"),
            uploaded_file_manager=MemoryUploadedFileManager("/_stcore/upload_file"),
            cache_storage_manager=MemoryCacheStorageManager(),
            session_manager_class=WebsocketSessionManager,
            session_storage=MemorySessionStorage(),
        )
    )
    await runtime.start()
    app = _App(runtime, interaction.AgentSessionRegistry(runtime), options)
    try:
        yield app
    finally:
        run_gate.opened.set()
        for handle in list(app.registry._sessions):
            app.registry.close(handle)
        if app.registry._sweeper is not None:
            app.registry._sweeper.cancel()
        runtime.stop()
        await runtime.stopped
        Runtime._instance = None


def _nodes(document: dict[str, Any]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    pending = [document["tree"]]
    while pending:
        node = pending.pop()
        found.append(node)
        pending.extend(reversed(node.get("children") or []))
    return found


def _texts(document: dict[str, Any]) -> list[str]:
    return [
        node["props"]["body"] for node in _nodes(document) if node["type"] == "text"
    ]


def _keyed(document: dict[str, Any], key: str) -> dict[str, Any]:
    matches = [node for node in _nodes(document) if node.get("key") == key]
    assert len(matches) == 1, matches
    return matches[0]


def _counts(document: dict[str, Any]) -> dict[str, int]:
    """The `starts=1 done=1 runs=1` line of the counter script."""
    line = next(text for text in _texts(document) if text.startswith("starts="))
    return {name: int(number) for name, number in re.findall(r"(\w+)=(\d+)", line)}


def _context_lines(document: dict[str, Any]) -> dict[str, str]:
    return dict(text.split("=", 1) for text in _texts(document))


@pytest.mark.anyio
async def test_creating_call_runs_the_app_and_a_rerun_keeps_state(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """A creating call returns a described snapshot; a rerun keeps session state."""
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        first = await app.call()
        second = await app.call({"session_id": first["session_id"]})

    assert _HANDLE.fullmatch(first["session_id"])
    assert first["status"] == "ready"
    # Described elements prove the session records for the agent API.
    assert "undescribed_types" not in first
    assert _keyed(first, "go")["type"] == "button"
    assert _counts(first) == {"starts": 1, "done": 1, "runs": 1}
    assert second["session_id"] == first["session_id"]
    assert _counts(second) == {"starts": 2, "done": 2, "runs": 2}


@pytest.mark.anyio
async def test_the_response_waits_for_the_last_run_of_a_chain(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """A chain of reruns settles once, after its last run, however slow the
    gaps between runs are.
    """
    script = """
    import streamlit as st
    from streamlit.runtime.scriptrunner import RerunData
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    st.session_state.setdefault("runs", 0)
    st.session_state.runs += 1
    st.text(f"runs={st.session_state.runs}")
    if st.session_state.runs == 1:
        st.rerun()
    if st.session_state.runs == 2:
        # Queued after the last yield point: this run finishes successfully,
        # and the runner picks the rerun up once it is done.
        ctx = get_script_run_ctx()
        ctx.script_requests.request_rerun(
            RerunData(
                query_string=ctx.query_string,
                page_script_hash=ctx.page_script_hash,
            )
        )
    """
    original_run_script = ScriptRunner._run_script

    def slow_later_runs(runner: ScriptRunner, rerun_data: RerunData) -> None:
        if run_gate.count("runs") > 1:
            time.sleep(0.2)
        original_run_script(runner, rerun_data)

    with patch.object(ScriptRunner, "_run_script", slow_later_runs):
        async with _running_app(tmp_path, options, script) as app:
            document = await app.call()

    assert _texts(document) == ["runs=3"]
    assert document["status"] == "ready"


@pytest.mark.anyio
async def test_a_timed_out_run_is_collected_and_never_restarted(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """The timeout state table: collect by `session_id` or the same request,
    refuse a different one while the run goes, hand a finished result over
    once, and discard it for a different request, which starts from the query
    string the discarded run left.
    """
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        run_gate.close()
        timed_out = await app.refused(run_timeout=_SHORT_TIMEOUT)
        assert timed_out.code == "run_timed_out"
        assert "only `session_id`" in timed_out.message
        handle = timed_out.session_id
        assert handle is not None
        assert _HANDLE.fullmatch(handle)

        busy = await app.refused({"session_id": handle, "query_params": {"q": ["1"]}})
        assert busy.code == "session_busy"

        # A run longer than two timeouts finishes on the third call, as one run.
        again = await app.refused({"session_id": handle}, run_timeout=_SHORT_TIMEOUT)
        assert again.code == "run_timed_out"
        first = await app.call_opening_gate({"session_id": handle})
        assert _counts(first) == {"starts": 1, "done": 1, "runs": 1}

        # The same request again collects as well.
        run_gate.close()
        same = {"session_id": handle, "query_params": {"q": ["2"]}}
        assert (await app.refused(same, run_timeout=_SHORT_TIMEOUT)).code == (
            "run_timed_out"
        )
        collected = await app.call_opening_gate(same)
        assert _counts(collected) == {"starts": 2, "done": 2, "runs": 2}
        assert collected["query_params"] == {"q": ["2"]}

        # A finished result is handed over without another run, and only once.
        run_gate.close()
        await app.refused({"session_id": handle}, run_timeout=_SHORT_TIMEOUT)
        run_gate.opened.set()
        await app.settled(handle)
        held = await app.call({"session_id": handle}, run_timeout=_SHORT_TIMEOUT)
        assert _counts(held) == {"starts": 3, "done": 3, "runs": 3}
        assert _counts(await app.call({"session_id": handle}))["starts"] == 4

        # A different request discards a finished result and runs.
        run_gate.close()
        await app.refused({"session_id": handle}, run_timeout=_SHORT_TIMEOUT)
        run_gate.opened.set()
        await app.settled(handle)
        other = await app.call({"session_id": handle, "query_params": {"q": ["3"]}})
        assert _counts(other) == {"starts": 6, "done": 6, "runs": 6}

        # A request that leaves `query_params` out keeps the discarded run's.
        run_gate.close()
        await app.refused(
            {"session_id": handle, "query_params": {"q": ["4"]}},
            run_timeout=_SHORT_TIMEOUT,
        )
        run_gate.opened.set()
        await app.settled(handle)
        kept = await app.call({"session_id": handle, "context": {"locale": "de-DE"}})
        assert _counts(kept) == {"starts": 8, "done": 8, "runs": 8}
        assert kept["query_params"] == {"q": ["4"]}


@pytest.mark.anyio
async def test_a_client_leaving_during_the_wait_is_collected_by_its_retry(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """A cancelled wait counts as a timeout: the retry collects the one run."""
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        handle = (await app.call())["session_id"]
        run_gate.close()
        left = asyncio.create_task(app.call({"session_id": handle}))
        assert await asyncio.to_thread(run_gate.reached.wait, 5)
        left.cancel()
        with pytest.raises(asyncio.CancelledError):
            await left

        collected = await app.call_opening_gate({"session_id": handle})

    assert _counts(collected) == {"starts": 2, "done": 2, "runs": 2}


@pytest.mark.anyio
async def test_a_creating_call_whose_client_leaves_closes_its_session(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """Nobody received the handle, so the session and its run end at once
    rather than holding a slot until the TTL.
    """
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        run_gate.close()
        left = asyncio.create_task(app.call())
        assert await asyncio.to_thread(run_gate.reached.wait, 5)
        [session] = app.registry._sessions.values()
        left.cancel()
        with pytest.raises(asyncio.CancelledError):
            await left

        assert app.registry._sessions == {}
        assert app.runtime.get_app_session(session.app_session_id) is None


@pytest.mark.anyio
async def test_a_client_leaving_during_the_build_hands_its_result_to_the_retry(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """The session stays claimed while an abandoned build finishes. A retry
    whose own timeout passes first is told the run timed out; the next waits
    for the build and returns its bytes without building again, and a
    different request meanwhile is refused.
    """
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        handle = (await app.call())["session_id"]
        build_started = threading.Event()
        build_may_finish = threading.Event()
        real_build = snapshot.build_snapshot

        def slow_build(**kwargs: Any) -> snapshot.Snapshot:
            build_started.set()
            assert build_may_finish.wait(5)
            return real_build(**kwargs)

        with patch.object(
            interaction.snapshot, "build_snapshot", side_effect=slow_build
        ) as build:
            left = asyncio.create_task(
                app.call({"session_id": handle, "query_params": {"q": ["left"]}})
            )
            assert await asyncio.to_thread(build_started.wait, 5)
            left.cancel()
            early = await app.refused(
                {"session_id": handle}, run_timeout=_SHORT_TIMEOUT
            )
            assert early.code == "run_timed_out"
            assert early.session_id == handle
            retry = asyncio.create_task(app.call({"session_id": handle}))
            await asyncio.sleep(0.05)

            busy = await app.refused(
                {"session_id": handle, "query_params": {"q": ["other"]}}
            )
            assert busy.code == "session_busy"
            assert not left.done()
            assert not retry.done()

            build_may_finish.set()
            with pytest.raises(asyncio.CancelledError):
                await left
            collected = await retry

        assert build.call_count == 1
        assert collected["query_params"] == {"q": ["left"]}
        assert _counts(collected)["starts"] == 2
        assert app.bodies[-1] == json.dumps(collected).encode("utf-8")
        assert len(app.bodies) == 2


@pytest.mark.anyio
async def test_two_requests_on_one_session_run_once(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """Of two concurrent requests on a session, one runs and one is refused."""
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        handle = (await app.call())["session_id"]
        results = await asyncio.gather(
            app.call({"session_id": handle}),
            app.call({"session_id": handle}),
            return_exceptions=True,
        )

    documents = [result for result in results if isinstance(result, dict)]
    errors = [result for result in results if isinstance(result, AgentRequestError)]
    assert [error.code for error in errors] == ["session_busy"]
    assert len(documents) == 1
    assert run_gate.value("starts") == 2


@pytest.mark.anyio
async def test_a_creating_call_lands_on_a_named_page_with_bound_values(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """`page` and `query_params` on a creating call open a parameterized page."""
    async with _running_app(tmp_path, options, _NAVIGATION_SCRIPT) as app:
        document = await app.call(
            {"page": "report", "query_params": {"region": ["APAC"], "quarter": ["Q2"]}}
        )

    assert document["page"]["url_path"] == "report"
    assert "page=report" in _texts(document)
    assert _keyed(document, "region")["value"] == "APAC"
    assert _keyed(document, "quarter")["value"] == "Q2"
    assert run_gate.value("runs") == 1


@pytest.mark.anyio
async def test_an_unknown_page_on_a_creating_call_still_hands_back_the_session(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """The page list only exists after the run, so the error comes after it,
    with the new session and the pages; the session stays usable.
    """
    async with _running_app(tmp_path, options, _NAVIGATION_SCRIPT) as app:
        error = await app.refused({"page": "nope"})
        assert error.code == "unknown_page"
        assert error.session_id is not None
        assert run_gate.value("runs") == 1
        follow_up = await app.call({"session_id": error.session_id})

    assert [page["url_path"] for page in error.details["pages"]] == [
        page["url_path"] for page in follow_up["pages"]
    ]
    assert "report" in [page["url_path"] for page in follow_up["pages"]]
    assert "page=home" in _texts(follow_up)


@pytest.mark.anyio
async def test_an_unknown_page_later_is_refused_before_anything_runs(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """Once the page list is known, an unknown page never reaches the app."""
    async with _running_app(tmp_path, options, _NAVIGATION_SCRIPT) as app:
        document = await app.call()
        error = await app.refused({"session_id": document["session_id"], "page": "x"})

    assert error.code == "unknown_page"
    assert error.details == {"pages": document["pages"]}
    assert error.session_id is None
    assert run_gate.value("runs") == 1


@pytest.mark.anyio
async def test_following_a_page_link(tmp_path: Path, options: dict[str, Any]) -> None:
    """A page link's `page` and `query_params` are a request as they stand."""
    async with _running_app(tmp_path, options, _NAVIGATION_SCRIPT) as app:
        home = await app.call()
        link = next(node for node in _nodes(home) if node["type"] == "page_link")
        report = await app.call(
            {
                "session_id": home["session_id"],
                "page": link["props"]["page"],
                "query_params": link["props"]["query_params"],
            }
        )

    assert report["page"]["url_path"] == "report"
    assert _keyed(report, "quarter")["value"] == "Q3"


@pytest.mark.anyio
async def test_a_page_change_keeps_bound_and_embed_parameters(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """Leaving a page keeps a shared widget's value and parameter and the embed
    parameters, and drops the rest, as a browser does.
    """
    async with _running_app(tmp_path, options, _NAVIGATION_SCRIPT) as app:
        report = await app.call(
            {
                "page": "report",
                "query_params": {
                    "region": ["APAC"],
                    "quarter": ["Q2"],
                    "utm": ["ad"],
                    "embed": ["true"],
                },
            }
        )
        home_path = next(
            page["url_path"] for page in report["pages"] if page["title"] == "Home"
        )
        home = await app.call({"session_id": report["session_id"], "page": home_path})

    assert "page=home" in _texts(home)
    assert _keyed(home, "region")["value"] == "APAC"
    # `quarter` is bound to the other page's widget, which the run drops.
    assert home["query_params"] == {"region": ["APAC"], "embed": ["true"]}


@pytest.mark.anyio
async def test_context_and_headers_follow_the_request(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """`context` is held until replaced, browser-only fields read None, and
    each run sees the headers of the request that started it, minus
    credentials.
    """
    async with _running_app(tmp_path, options, _CONTEXT_SCRIPT) as app:
        first = await app.call(
            headers=[
                ("X-Token", "first"),
                ("Cookie", "session=secret"),
                ("Authorization", "Bearer secret"),
                ("Proxy-Authorization", "Basic secret"),
            ]
        )
        handle = first["session_id"]
        stated = await app.call(
            {
                "session_id": handle,
                "context": {"timezone": "Asia/Kolkata", "locale": "de-DE"},
            },
            headers=[("X-Token", "second")],
        )
        kept = await app.call({"session_id": handle})
        replaced = await app.call(
            {"session_id": handle, "context": {"locale": "fr-FR"}}
        )

        # A refused request cannot change what a timed-out run reads.
        run_gate.close()
        await app.refused(
            {"session_id": handle},
            run_timeout=_SHORT_TIMEOUT,
            headers=[("X-Token", "slow")],
        )
        await app.refused(
            {"session_id": handle, "query_params": {"q": ["1"]}},
            headers=[("X-Token", "intruder")],
        )
        collected = await app.call_opening_gate(
            {"session_id": handle}, headers=[("X-Token", "collector")]
        )

    assert _context_lines(first) == {
        "timezone": "None",
        "offset": "None",
        "locale": "None",
        "url": "None",
        "embedded": "None",
        "theme": "None",
        "cookies": "{}",
        "X-Token": "first",
        "Cookie": "None",
        "Authorization": "None",
        "Proxy-Authorization": "None",
    }
    assert _context_lines(stated)["timezone"] == "Asia/Kolkata"
    assert _context_lines(stated)["offset"] == "-330"
    assert _context_lines(stated)["locale"] == "de-DE"
    assert _context_lines(stated)["X-Token"] == "second"
    assert _context_lines(kept)["timezone"] == "Asia/Kolkata"
    assert _context_lines(kept)["X-Token"] == "None"
    assert _context_lines(replaced)["timezone"] == "None"
    assert _context_lines(replaced)["locale"] == "fr-FR"
    assert _context_lines(collected)["X-Token"] == "slow"


@pytest.mark.anyio
async def test_an_edit_applies_on_the_next_interaction_only(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """With `runOnSave` on, an edit still starts no run in an agent session;
    the next interaction runs the new script with session state kept, and an
    edit into a syntax error is reported as an error.
    """
    script = """
    import streamlit as st
    st.session_state.setdefault("count", 0)
    st.session_state.count += 1
    st.text(f"v1 count={st.session_state.count}")
    """
    options["server.runOnSave"] = True
    async with _running_app(tmp_path, options, script) as app:
        first = await app.call()
        handle = first["session_id"]
        app_session = app.app_session(handle)
        main_script = tmp_path / "app.py"

        main_script.write_text(textwrap.dedent(script).replace("v1", "v2"))
        app_session._on_source_file_changed(str(main_script))
        # A rerun would have created a runner, which unsettles at once.
        assert app_session.is_settled
        client = app.registry._sessions[handle].client
        async with asyncio.timeout(5):
            while not any(  # noqa: ASYNC110
                msg.session_event.script_changed_on_disk for msg in client.messages
            ):
                await asyncio.sleep(0.01)
        edited = await app.call({"session_id": handle})

        main_script.write_text("import streamlit as st\nst.text('broken'\n")
        app_session._on_source_file_changed(str(main_script))
        broken = await app.call({"session_id": handle})

    assert _texts(first) == ["v1 count=1"]
    assert _texts(edited) == ["v2 count=2"]
    assert broken["status"] == "error"
    exceptions = [node for node in _nodes(broken) if node["type"] == "exception"]
    assert len(exceptions) == 1
    assert exceptions[0]["props"]["uncaught"] is True
    assert _texts(broken) == []
    assert broken["actions"] == []


@pytest.mark.anyio
async def test_format_funcs_run_with_the_sessions_context_during_the_build(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """A `format_func` that reads session state or `st.context` reports the
    label the run showed, and one that calls `st.write` still reports a value.
    """
    script = """
    import streamlit as st

    st.session_state.setdefault("suffix", "!")

    def label(option):
        return f"{option}{st.session_state.suffix} {st.context.timezone}"

    def noisy(option):
        st.write("side effect")
        return option.upper()

    st.selectbox("Pick", ["a", "b"], key="pick", format_func=label)
    st.selectbox("Loud", ["x", "y"], key="loud", format_func=noisy)
    """
    async with _running_app(tmp_path, options, script) as app:
        document = await app.call({"context": {"timezone": "Europe/Berlin"}})

    assert _keyed(document, "pick")["value"] == "a! Europe/Berlin"
    assert _keyed(document, "loud")["value"] == "X"


@pytest.mark.anyio
async def test_a_creating_call_that_fails_closes_its_session(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """An unexpected failure on a creating call leaves no session behind."""
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        with (
            patch.object(
                interaction.snapshot,
                "build_snapshot",
                side_effect=RuntimeError("boom"),
            ),
            pytest.raises(RuntimeError, match="boom"),
        ):
            await app.call()

        assert app.registry._sessions == {}
        assert app.runtime._session_mgr.num_active_sessions() == 0
        assert agent_spec._agent_session_ids == frozenset()


@pytest.mark.anyio
async def test_invalid_unicode_is_refused_before_a_session_exists(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """A lone surrogate is refused without connecting a session."""
    async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
        with patch.object(app.runtime, "connect_session") as connect_session:
            error = await app.refused({"page": "\ud800"})

    assert error.code == "invalid_request"
    connect_session.assert_not_called()


@pytest.mark.anyio
async def test_the_registry_caps_sessions_and_reclaims_idle_ones(
    tmp_path: Path, options: dict[str, Any]
) -> None:
    """A timed-out run still going holds its slot past the TTL while its client
    keeps collecting it. Once the client stops, the timer reclaims the session
    with no request, even though its run never finished, which frees the slot.
    A session only answers its own identity.
    """
    options["server.agentMaxSessions"] = 1
    options["server.agentSessionTTL"] = 0.3
    with patch.object(interaction, "_SWEEP_SECONDS", 0.05):
        async with _running_app(tmp_path, options, _COUNTER_SCRIPT) as app:
            run_gate.close()
            timed_out = await app.refused(run_timeout=_SHORT_TIMEOUT)
            handle = timed_out.session_id
            assert handle is not None
            session_id = app.registry._sessions[handle].app_session_id
            for _ in range(3):
                await asyncio.sleep(0.1)
                retry = await app.refused(
                    {"session_id": handle}, run_timeout=_SHORT_TIMEOUT
                )
                assert retry.code == "run_timed_out"
            full = await app.refused()
            assert full.code == "too_many_sessions"

            async with asyncio.timeout(5):
                # Reclaimed by the timer alone, so there is nothing to await.
                while app.registry._sessions:  # noqa: ASYNC110
                    await asyncio.sleep(0.05)
            assert app.runtime.get_app_session(session_id) is None
            run_gate.opened.set()
            options["server.agentSessionTTL"] = 900
            owner: UserInfoType = {"email": "a@example.com"}
            replacement = (await app.call(user_info=owner))["session_id"]

            stranger = await app.refused(
                {"session_id": replacement}, user_info={"email": "b@example.com"}
            )
            reclaimed = await app.refused({"session_id": handle}, user_info=owner)
            owned = await app.call({"session_id": replacement}, user_info=owner)

    assert stranger.code == "unknown_session"
    assert reclaimed.code == "unknown_session"
    assert owned["session_id"] == replacement
