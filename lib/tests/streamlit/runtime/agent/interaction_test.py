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

from datetime import datetime
from typing import TYPE_CHECKING, Any, Final
from unittest.mock import patch

import pytest

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent import interaction, tree
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.state.query_params import QueryParams

if TYPE_CHECKING:
    from streamlit.source_util import PageInfo


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


def _refusal(request: dict[str, Any]) -> AgentRequestError:
    with pytest.raises(AgentRequestError) as raised:
        interaction._validate_request_shape(request)
    return raised.value


@pytest.mark.parametrize(
    "request_body",
    [
        {"widget_state": {"region": "Europe"}},
        {"trigger": {"key": "submit"}},
        {"session_id": "s_1", "pages": "home"},
    ],
)
def test_validate_refuses_unknown_fields(request_body: dict[str, Any]) -> None:
    """Fields this API does not take, setting widgets included, are refused."""
    error = _refusal(request_body)

    assert error.code == "invalid_request"
    assert "Unknown request fields" in error.message


@pytest.mark.parametrize(
    ("request_body", "fragment"),
    [
        ({"session_id": 1}, "`session_id` must be a string"),
        ({"page": 3}, "`page` must be a string"),
        ({"query_params": ["a"]}, "`query_params` must be an object"),
        ({"query_params": {"a": "1"}}, "must be a list of strings"),
        ({"query_params": {"a": [1]}}, "must be a list of strings"),
        ({"context": "Europe/Berlin"}, "`context` must be an object"),
        ({"context": {"theme": "dark"}}, "Unknown `context` fields: theme"),
    ],
)
def test_validate_refuses_wrong_types(
    request_body: dict[str, Any], fragment: str
) -> None:
    """A field of the wrong type is refused before anything runs."""
    error = _refusal(request_body)

    assert error.code == "invalid_request"
    assert fragment in error.message


@pytest.mark.parametrize(
    "request_body",
    [
        {"page": "\ud800"},
        {"query_params": {"q": ["ok", "\udfff"]}},
        {"query_params": {"\ud800": ["x"]}},
        {"context": {"locale": "de-DE", "\ud83d": "x"}},
    ],
)
def test_validate_refuses_text_that_is_not_unicode(
    request_body: dict[str, Any],
) -> None:
    """A lone surrogate in any key or value is refused."""
    error = _refusal(request_body)

    assert error.code == "invalid_request"
    assert "not valid Unicode" in error.message


def test_validate_accepts_a_full_request() -> None:
    """Every field this API takes passes when well formed."""
    interaction._validate_request_shape(
        {
            "session_id": "s_1",
            "page": "report",
            "query_params": {"q": ["1", ""], "empty": []},
            "context": {"timezone": "Europe/Berlin", "locale": "de-DE"},
        }
    )


def test_encode_query_params_keeps_blank_values() -> None:
    """Repeated and blank values are encoded as given."""
    assert (
        interaction._encode_query_params({"q": ["a", "b"], "blank": [""], "none": []})
        == "q=a&q=b&blank="
    )


def test_parse_context_refuses_a_timezone_in_the_wrong_case() -> None:
    """Only exact IANA names pass, even where the filesystem would find another."""
    with pytest.raises(AgentRequestError) as raised:
        interaction._parse_context({"timezone": "europe/berlin"})

    assert raised.value.code == "invalid_request"


@pytest.mark.parametrize(
    ("timezone", "offset"),
    [
        # JavaScript's getTimezoneOffset: minutes behind UTC.
        ("Asia/Kolkata", -330),
        # Newfoundland Standard Time, in January.
        ("America/St_Johns", 210),
    ],
)
def test_parse_context_derives_the_offset_from_the_timezone(
    timezone: str, offset: int
) -> None:
    """The offset is derived from the zone, the way a browser reports it."""
    january = datetime(2026, 1, 15, 12, 0)
    with patch.object(interaction, "datetime") as fake_datetime:
        fake_datetime.now.side_effect = lambda tz: january.replace(tzinfo=tz)
        info = interaction._parse_context({"timezone": timezone})

    assert info.timezone == timezone
    assert info.timezone_offset == offset
    assert not info.HasField("locale")


@pytest.mark.parametrize(
    ("locale", "accepted"),
    [
        ("de-DE", True),
        ("zh-Hans-CN", True),
        ("en_US.UTF-8", False),
        ("e", False),
        # 64 characters, then 65.
        ("ab" + "-abcdefg" * 7 + "-abcde", True),
        ("ab" + "-abcdefg" * 7 + "-abcdef", False),
    ],
)
def test_parse_context_accepts_only_language_tags(locale: str, accepted: bool) -> None:
    """A locale must look like a BCP 47 tag of at most 64 characters."""
    if accepted:
        assert interaction._parse_context({"locale": locale}).locale == locale
    else:
        with pytest.raises(AgentRequestError):
            interaction._parse_context({"locale": locale})


def _page(url_pathname: str | None, name: str = "", icon: str = "") -> PageInfo:
    info: PageInfo = {
        "script_path": f"{url_pathname or 'main'}.py",
        "page_script_hash": "h",
    }
    if url_pathname is not None:
        info["url_pathname"] = url_pathname
    if name:
        info["page_name"] = name
    if icon:
        info["icon"] = icon
    return info


_NAVIGATION_PAGES: Final[dict[str, PageInfo]] = {
    "home_hash": _page("", "Home"),
    "report_hash": _page("report", "Report", ":material/table:"),
}


@pytest.mark.parametrize(
    ("page", "page_hash"),
    [
        ("report", "report_hash"),
        ("/report/", "report_hash"),
        ("/report", "report_hash"),
        ("", "home_hash"),
    ],
)
def test_resolve_page_finds_a_known_url_path(page: str, page_hash: str) -> None:
    """A listed page resolves to its hash, with surrounding slashes ignored, and
    `""` names the default page.
    """
    resolved = interaction._resolve_page(
        _NAVIGATION_PAGES, page, can_defer=False, listed=[]
    )

    assert resolved == (page_hash, "")


def test_resolve_page_defers_only_on_a_creating_call_before_navigation() -> None:
    """Before any page is declared, a creating call hands the path on."""
    default_only = {"main_hash": _page(None)}

    assert interaction._resolve_page(
        default_only, "/report", can_defer=True, listed=[]
    ) == ("", "report")
    with pytest.raises(AgentRequestError) as raised:
        interaction._resolve_page(default_only, "report", can_defer=False, listed=[])
    assert raised.value.code == "unknown_page"


def test_resolve_page_refuses_an_unknown_page_once_pages_are_declared() -> None:
    """With declared pages, an unknown path is refused even on a creating call,
    listing the pages derived from the page list.
    """
    with pytest.raises(AgentRequestError) as raised:
        interaction._resolve_page(_NAVIGATION_PAGES, "nope", can_defer=True, listed=[])

    assert raised.value.code == "unknown_page"
    assert raised.value.details == {
        "pages": [
            {"url_path": "", "title": "Home"},
            {"url_path": "report", "title": "Report", "icon": ":material/table:"},
        ]
    }


def test_resolve_page_refusal_lists_the_last_snapshots_pages() -> None:
    """The refusal reports pages as the last snapshot listed them."""
    listed = [{"url_path": "report", "title": "Quarterly report"}]
    with pytest.raises(AgentRequestError) as raised:
        interaction._resolve_page(
            _NAVIGATION_PAGES, "nope", can_defer=False, listed=listed
        )

    assert raised.value.details == {"pages": listed}


def test_page_change_keeps_embed_and_bound_parameters_only() -> None:
    """Embed parameters (any case) and widget-bound ones survive a page change."""
    bindings = QueryParams()
    bindings.bind_widget(
        param_key="region", widget_id="w1", value_type="string_value", script_hash=""
    )

    query_string = interaction._query_string_for_page_change(
        bindings, "EMBED=true&region=Europe&utm=ad&embed_options=light&blank="
    )

    assert query_string == "EMBED=true&region=Europe&embed_options=light"


def _session(**fields: Any) -> interaction.AgentSession:
    return interaction.AgentSession(
        handle="s_test",
        session_id="internal",
        client=interaction.AgentSessionClient(),
        user_info={},
        **fields,
    )


def _pending(action: dict[str, Any]) -> interaction._Interaction:
    return interaction._Interaction(
        action=action, query_string="", unverified_page=None
    )


def test_collects_only_a_retry_of_the_timed_out_interaction() -> None:
    """Only `session_id`, or the same action fields, collect a timed-out run."""
    action = {"page": "report", "query_params": {"q": ["1"]}}
    session = _session(timed_out=_pending(action))

    assert interaction._collects(session, {"session_id": "s_test"})
    assert interaction._collects(session, {"session_id": "s_test", **action})
    assert not interaction._collects(session, {"session_id": "s_test", "page": "x"})
    assert not interaction._collects(_session(), {"session_id": "s_test"})


def test_idle_since_follows_the_timeout_state_table() -> None:
    """Busy sessions and timed-out runs still going are never idle."""
    with patch.object(interaction.time, "monotonic", return_value=10.0):
        session = _session(last_used=5.0)

    assert interaction._idle_since(session, settled=True) == 10.0
    session.last_used = 20.0
    assert interaction._idle_since(session, settled=True) == 20.0

    session.busy = True
    assert interaction._idle_since(session, settled=True) is None

    session.busy = False
    session.timed_out = _pending({})
    assert interaction._idle_since(session, settled=False) is None
    assert interaction._idle_since(session, settled=True) == 20.0


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [
        (0, "0 seconds"),
        (1, "1 second"),
        (2, "2 seconds"),
        (45, "45 seconds"),
        (60, "1 minute"),
        (90, "90 seconds"),
        (900, "15 minutes"),
    ],
)
def test_duration_phrases_whole_minutes_and_singulars(
    seconds: float, expected: str
) -> None:
    """Error messages name a limit in whole minutes where it is one."""
    assert interaction._duration(seconds) == expected
