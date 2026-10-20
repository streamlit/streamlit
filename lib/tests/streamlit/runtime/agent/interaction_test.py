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

"""Unit tests for the agent session client and request handling."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent import interaction, tree


def _new_session(run_id: str, fragment_ids: list[str] | None = None) -> ForwardMsg:
    msg = ForwardMsg()
    msg.new_session.script_run_id = run_id
    msg.new_session.fragment_ids_this_run.extend(fragment_ids or [])
    return msg


def _markdown(path: list[int], body: str, fragment_id: str = "") -> ForwardMsg:
    msg = ForwardMsg()
    msg.metadata.delta_path[:] = path
    msg.delta.new_element.markdown.body = body
    msg.delta.fragment_id = fragment_id
    return msg


def _block(path: list[int]) -> ForwardMsg:
    msg = ForwardMsg()
    msg.metadata.delta_path[:] = path
    msg.delta.add_block.vertical.SetInParent()
    return msg


def _empty(path: list[int]) -> ForwardMsg:
    msg = ForwardMsg()
    msg.metadata.delta_path[:] = path
    msg.delta.new_element.empty.SetInParent()
    return msg


def _finished(status: ForwardMsg.ScriptFinishedStatus.ValueType) -> ForwardMsg:
    msg = ForwardMsg()
    msg.script_finished = status
    return msg


def _bodies(client: interaction.AgentSessionClient) -> list[str]:
    return [
        msg.delta.new_element.markdown.body
        for msg in client.messages
        if msg.HasField("delta") and msg.delta.new_element.HasField("markdown")
    ]


def _write_all(client: interaction.AgentSessionClient, *msgs: ForwardMsg) -> None:
    for msg in msgs:
        client.write_forward_msg(msg)


def test_client_accumulates_a_run_after_its_lifecycle_messages() -> None:
    """A run's deltas accumulate in order, after the standing messages."""
    client = interaction.AgentSessionClient()
    _write_all(
        client,
        _new_session("r1"),
        _markdown([0, 0], "a"),
        _markdown([0, 1], "b"),
        _finished(ForwardMsg.FINISHED_SUCCESSFULLY),
    )

    types = [msg.WhichOneof("type") for msg in client.messages]
    assert types == ["new_session", "script_finished", "delta", "delta"]
    assert _bodies(client) == ["a", "b"]


def test_client_replaces_an_element_rewritten_in_place() -> None:
    """An element written twice at one position keeps only its last write."""
    client = interaction.AgentSessionClient()
    _write_all(
        client,
        _new_session("r1"),
        _markdown([0, 0], "chunk 1"),
        _markdown([0, 0], "chunk 1 2"),
        _markdown([0, 1], "after"),
    )

    assert _bodies(client) == ["chunk 1 2", "after"]


def test_client_keeps_only_the_new_child_of_a_rebuilt_container() -> None:
    """A container cleared and rebuilt keeps only the child written after it."""
    client = interaction.AgentSessionClient()
    _write_all(
        client,
        _new_session("r1"),
        _block([0, 0]),
        _markdown([0, 0, 0], "old"),
        _empty([0, 0]),
        _block([0, 0]),
        _markdown([0, 0, 0], "new"),
    )

    root = tree.merge_deltas(client.messages)
    container = root.children[0].children[0]
    bodies = [
        child.element.markdown.body
        for child in container.children.values()
        if child.element is not None
    ]
    assert bodies == ["new"]


def test_client_full_run_drops_older_runs() -> None:
    """A finished full run replaces everything earlier runs emitted."""
    client = interaction.AgentSessionClient()
    _write_all(
        client,
        _new_session("r1"),
        _markdown([0, 0], "first"),
        _markdown([0, 1], "only in first"),
        _finished(ForwardMsg.FINISHED_SUCCESSFULLY),
        _new_session("r2"),
        _markdown([0, 0], "second"),
    )
    # Before the second run finishes, the first run's tail is still standing.
    assert _bodies(client) == ["first", "only in first", "second"]

    client.write_forward_msg(_finished(ForwardMsg.FINISHED_SUCCESSFULLY))

    assert _bodies(client) == ["second"]


def test_client_fragment_run_leaves_the_rest_of_the_page() -> None:
    """A fragment run replaces only its own fragment's deltas."""
    client = interaction.AgentSessionClient()
    _write_all(
        client,
        _new_session("r1"),
        _markdown([0, 0], "app"),
        _markdown([0, 1], "fragment v1", fragment_id="frag"),
        _markdown([0, 2], "other fragment", fragment_id="other"),
        _finished(ForwardMsg.FINISHED_SUCCESSFULLY),
        _new_session("r2", fragment_ids=["frag"]),
        _markdown([0, 1], "fragment v2", fragment_id="frag"),
        _finished(ForwardMsg.FINISHED_FRAGMENT_RUN_SUCCESSFULLY),
    )

    assert _bodies(client) == ["app", "other fragment", "fragment v2"]


def test_client_keeps_the_app_when_a_callback_reruns_a_fragment() -> None:
    """A full run that a callback's `st.rerun(scope="fragment")` interrupts
    emits nothing, so the fragment run that follows keeps the earlier app.
    """
    client = interaction.AgentSessionClient()
    _write_all(
        client,
        _new_session("r1"),
        _markdown([0, 0], "app"),
        _markdown([0, 1], "fragment v1", fragment_id="frag"),
        _finished(ForwardMsg.FINISHED_SUCCESSFULLY),
        _new_session("r2"),
        _finished(ForwardMsg.FINISHED_EARLY_FOR_RERUN),
        _new_session("r3", fragment_ids=["frag"]),
        _markdown([0, 1], "fragment v2", fragment_id="frag"),
        _finished(ForwardMsg.FINISHED_FRAGMENT_RUN_SUCCESSFULLY),
    )

    assert _bodies(client) == ["app", "fragment v2"]


def test_client_compile_error_prunes_the_previous_page() -> None:
    """A compile error drops the page whose script no longer runs."""
    client = interaction.AgentSessionClient()
    _write_all(
        client,
        _new_session("r1"),
        _markdown([0, 0], "old page"),
        _finished(ForwardMsg.FINISHED_SUCCESSFULLY),
        _new_session("r2"),
        _finished(ForwardMsg.FINISHED_WITH_COMPILE_ERROR),
    )

    assert _bodies(client) == []


def test_client_keeps_the_latest_message_per_type_and_session_event() -> None:
    """Only the latest lifecycle message of a type stays, and session events
    are kept per event, so a disk change cannot hide a compile error.
    """
    client = interaction.AgentSessionClient()
    compile_error = ForwardMsg()
    compile_error.session_event.script_compilation_exception.message = "bad"
    changed_on_disk = ForwardMsg()
    changed_on_disk.session_event.script_changed_on_disk = True
    _write_all(
        client,
        _new_session("r1"),
        _finished(ForwardMsg.FINISHED_SUCCESSFULLY),
        _new_session("r2"),
        _finished(ForwardMsg.FINISHED_WITH_COMPILE_ERROR),
        compile_error,
        changed_on_disk,
    )

    messages = client.messages
    new_sessions = [msg for msg in messages if msg.HasField("new_session")]
    finishes = [msg for msg in messages if msg.HasField("script_finished")]
    events = [msg for msg in messages if msg.HasField("session_event")]
    assert [msg.new_session.script_run_id for msg in new_sessions] == ["r2"]
    assert [msg.script_finished for msg in finishes] == [
        ForwardMsg.FINISHED_WITH_COMPILE_ERROR
    ]
    assert compile_error in events
    assert changed_on_disk in events


def test_client_records_query_string_updates_until_the_next_interaction() -> None:
    """`page_info_changed` sets `query_string_update`; a new interaction clears it."""
    client = interaction.AgentSessionClient()
    msg = ForwardMsg()
    msg.page_info_changed.query_string = "region=Europe"
    client.write_forward_msg(msg)

    assert client.query_string_update == "region=Europe"

    client.begin_interaction()

    assert client.query_string_update is None


@pytest.mark.parametrize(
    ("status", "advances"),
    [
        (ForwardMsg.FINISHED_SUCCESSFULLY, True),
        (ForwardMsg.FINISHED_FRAGMENT_RUN_SUCCESSFULLY, True),
        (ForwardMsg.FINISHED_WITH_COMPILE_ERROR, True),
        (ForwardMsg.FINISHED_EARLY_FOR_RERUN, False),
    ],
)
def test_client_finished_at_advances_only_when_a_run_settles(
    status: ForwardMsg.ScriptFinishedStatus.ValueType, advances: bool
) -> None:
    """`finished_at` follows runs that end a chain, not ones cut short by a rerun."""
    with patch.object(interaction.time, "monotonic", return_value=100.0):
        client = interaction.AgentSessionClient()
    with patch.object(interaction.time, "monotonic", return_value=200.0):
        client.write_forward_msg(_finished(status))

    assert client.finished_at == (200.0 if advances else 100.0)


def test_client_write_forward_msg_swallows_and_logs_a_failure() -> None:
    """A buffering failure is logged instead of raised into the runtime loop."""
    client = interaction.AgentSessionClient()
    with (
        patch.object(client, "_write", side_effect=RuntimeError("boom")),
        patch.object(interaction._LOGGER, "exception") as log_exception,
    ):
        client.write_forward_msg(_new_session("r1"))

    log_exception.assert_called_once()


def test_request_context_withholds_credentials_and_cookies() -> None:
    """Cookie and proxy credentials never reach `st.context`, in any case."""
    client = interaction.AgentSessionClient()
    assert client.client_context is None

    client.request_context = interaction._RequestContext(
        [
            ("X-Token", "t"),
            ("COOKIE", "session=secret"),
            ("Authorization", "Bearer secret"),
            ("proxy-authorization", "Basic secret"),
            ("x-token", "repeated"),
        ]
    )

    context = client.client_context
    assert context is not None
    assert list(context.headers) == [("X-Token", "t"), ("x-token", "repeated")]
    assert context.cookies == {}
    assert context.remote_ip is None
