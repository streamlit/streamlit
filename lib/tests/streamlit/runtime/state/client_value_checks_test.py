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

"""Client values the server refuses, sent as a forged browser message.

``AppTest._run(widget_state=...)`` sends exactly the given states through the
real script runner, the way a browser message reaches the session.
"""

from __future__ import annotations

import datetime as dt
import logging
import math
from typing import TYPE_CHECKING, Any

import pytest

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.state import widget_checks
from streamlit.testing.v1 import AppTest
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Iterator


def forged(element_id: str, **field: Any) -> WidgetStates:
    """A browser message with one state, such as ``forged(id, string_value="x")``.

    An array field takes its items in a ``data`` dict:
    ``forged(id, double_array_value={"data": [1.0]})``.
    """
    return forged_many(WidgetState(id=element_id, **field))


def forged_many(*states: WidgetState) -> WidgetStates:
    """A browser message with the given states, in order."""
    return WidgetStates(widgets=list(states))


@pytest.fixture
def refusal_logs() -> Iterator[list[str]]:
    """Collect the refusal messages widget_checks logs at warning level."""
    collected: list[str] = []

    class _Collector(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            if record.levelno >= logging.WARNING:
                collected.append(record.getMessage())

    logger = logging.getLogger(widget_checks.__name__)
    handler = _Collector()
    logger.addHandler(handler)
    try:
        yield collected
    finally:
        logger.removeHandler(handler)


def _button_app() -> None:
    import streamlit as st

    def on_click() -> None:
        st.session_state.calls = st.session_state.get("calls", 0) + 1

    clicked = st.button("Go", key="go", on_click=on_click)
    st.write(f"clicked={clicked}")


def test_a_forged_field_does_not_fire_a_button(refusal_logs: list[str]) -> None:
    """A button sent text instead of a click returns False and runs no on_click."""
    at = AppTest.from_function(_button_app).run()

    at._run(widget_state=forged(at.button[0].id, string_value="x"))

    assert at.markdown[0].value == "clicked=False"
    assert "calls" not in at.session_state
    assert len(refusal_logs) == 1
    assert "(wrong_type)" in refusal_logs[0]


def _slider_app() -> None:
    import streamlit as st

    def on_change() -> None:
        st.session_state.changes = st.session_state.get("changes", 0) + 1

    st.slider("Level", 0, 100, 10, key="level", on_change=on_change)


def test_a_refused_value_keeps_the_previous_value_and_resyncs() -> None:
    """A refused slider value keeps the previous value, re-syncs, and never sticks."""
    at = AppTest.from_function(_slider_app).run()
    at.slider[0].set_value(30).run()
    assert at.session_state.changes == 1

    at._run(widget_state=forged(at.slider[0].id, string_value="x"))

    assert at.slider[0].value == 30
    assert at.slider[0].proto.set_value is True
    assert at.session_state.changes == 1
    # The next run does not raise on the refused value.
    at.run()
    assert not at.exception
    assert at.slider[0].value == 30
    assert at.slider[0].proto.set_value is False


def test_a_refused_value_resyncs_a_widget_at_its_default() -> None:
    """The browser is told the server's value even when it is the default."""
    at = AppTest.from_function(_slider_app).run()

    at._run(widget_state=forged(at.slider[0].id, string_value="x"))

    assert at.slider[0].value == 10
    assert at.slider[0].proto.set_value is True
    assert "changes" not in at.session_state


def _chat_app() -> None:
    import streamlit as st

    prompt = st.chat_input("Say", accept_file=True, file_type=["txt"], key="chat")
    if prompt:
        st.write(f"got {prompt.text}")


def test_a_disallowed_upload_is_dropped_without_raising() -> None:
    """A chat file with a disallowed name is refused instead of raising in the app."""
    at = AppTest.from_function(_chat_app).run()
    chat = at.chat_input[0]
    # Bypass AppTest's own file name check, as a forged message would.
    chat._value = "hi"
    chat._files = [("file-id", "payload.exe", b"x", "application/octet-stream")]

    at.run()

    assert not at.exception
    assert not at.markdown


def _restored_app() -> None:
    import streamlit as st

    def on_change() -> None:
        st.session_state.callbacks = st.session_state.get("callbacks", 0) + 1

    st.text_input("Name", key="name", on_change=on_change)
    st.selectbox("Pick", ["a", "b", "c"], key="pick", on_change=on_change)
    st.checkbox("Agree", key="agree", on_change=on_change)
    st.slider("Level", 0, 10, 5, key="level", on_change=on_change)
    st.write(f"clicked={st.button('Go', key='go', on_click=on_change)}")


def test_a_new_session_keeps_the_browser_values_it_is_sent() -> None:
    """A browser's map resent to a new session restores values without callbacks.

    A violating entry falls back to the default and re-syncs, and a trigger in
    the map is dropped.
    """
    first = AppTest.from_function(_restored_app).run()
    first.text_input[0].input("Ann")
    first.selectbox[0].select("b")
    first.checkbox[0].check()
    first.run()
    restored = {state.id: state for state in first._tree.get_widget_states().widgets}
    level_id = first.slider[0].id
    restored[level_id] = WidgetState(id=level_id, string_value="forged")
    button_id = first.button[0].id
    restored[button_id] = WidgetState(id=button_id, trigger_value=True)

    fresh = AppTest.from_function(_restored_app)
    fresh._run(widget_state=forged_many(*restored.values()))

    assert fresh.text_input[0].value == "Ann"
    assert fresh.selectbox[0].value == "b"
    assert fresh.checkbox[0].value is True
    assert fresh.slider[0].value == 5
    assert fresh.slider[0].proto.set_value is True
    assert fresh.text_input[0].proto.set_value is False
    assert fresh.markdown[0].value == "clicked=False"
    assert "callbacks" not in fresh.session_state


def _self_disabling_app() -> None:
    import streamlit as st

    def lock() -> None:
        st.session_state.locked = True

    locked = st.session_state.get("locked", False)
    clicked = st.button("Submit", key="submit", on_click=lock, disabled=locked)
    agreed = st.checkbox("Agree", key="agree", on_change=lock, disabled=locked)
    st.write(f"clicked={clicked} agreed={agreed}")


def test_a_self_disabling_button_returns_true() -> None:
    """A click was legal when it was made, so it counts in the run it causes."""
    at = AppTest.from_function(_self_disabling_app).run()

    at.button[0].click().run()

    assert at.markdown[0].value == "clicked=True agreed=False"
    assert at.button[0].disabled is True


def test_a_widget_disabled_in_its_own_callback_keeps_the_value() -> None:
    """A value sent while the widget was enabled is kept when its callback disables it."""
    at = AppTest.from_function(_self_disabling_app).run()

    at.checkbox[0].check().run()

    assert at.markdown[0].value == "clicked=False agreed=True"
    assert at.checkbox[0].disabled is True


def _unlockable_app() -> None:
    import streamlit as st

    def unlock() -> None:
        st.session_state.unlocked = True

    def on_change() -> None:
        st.session_state.changes = st.session_state.get("changes", 0) + 1

    st.button("Unlock", key="unlock", on_click=unlock)
    st.checkbox(
        "Agree",
        key="agree",
        on_change=on_change,
        disabled=not st.session_state.get("unlocked", False),
    )


def test_a_widget_disabled_when_shown_is_refused_after_it_is_enabled() -> None:
    """The check uses the run the client saw, even if this run enables the widget."""
    at = AppTest.from_function(_unlockable_app).run()

    at._run(
        widget_state=forged_many(
            WidgetState(id=at.button[0].id, trigger_value=True),
            WidgetState(id=at.checkbox[0].id, bool_value=True),
        )
    )

    assert at.checkbox[0].disabled is False
    assert at.checkbox[0].value is False
    assert at.checkbox[0].proto.set_value is True
    assert "changes" not in at.session_state


def _disabled_slider_app() -> None:
    import streamlit as st

    st.slider("Level", 0, 100, 10, key="level", disabled=True)


def test_a_wrong_type_for_a_disabled_widget_does_not_stick_the_session() -> None:
    """A forged field for a disabled widget is refused without raising, then or later."""
    at = AppTest.from_function(_disabled_slider_app).run()

    at._run(widget_state=forged(at.slider[0].id, string_value="x"))
    at.run()

    assert not at.exception
    assert at.slider[0].value == 10


def _labels(*labels: str) -> dict[str, list[str]]:
    """A ``string_array_value`` for ``forged``."""
    return {"data": list(labels)}


# The key of each widget in the option apps, which its callback records.
_OPTION_KEYS = {"selectbox": "pick", "radio": "size", "multiselect": "tags"}


def _option_app() -> None:
    import streamlit as st

    def on_change(name: str) -> None:
        st.session_state.calls = [*st.session_state.get("calls", []), name]

    st.selectbox(
        "Pick", ["a", "b", "c"], key="pick", on_change=on_change, args=["pick"]
    )
    st.radio("Size", ["S", "M", "L"], key="size", on_change=on_change, args=["size"])
    st.multiselect(
        "Tags",
        ["x", "y", "z"],
        max_selections=2,
        key="tags",
        on_change=on_change,
        args=["tags"],
    )


@pytest.mark.parametrize(
    ("widget", "field"),
    [
        ("selectbox", {"string_value": "zzz"}),
        ("radio", {"string_value": "XL"}),
        ("multiselect", {"string_array_value": _labels("x", "q")}),
        # Over `max_selections`, which no longer raises for a client value.
        ("multiselect", {"string_array_value": _labels("x", "y", "z")}),
        ("multiselect", {"string_array_value": _labels("y", "y")}),
    ],
)
def test_a_value_outside_the_options_is_refused(
    widget: str, field: dict[str, Any]
) -> None:
    """A forged choice runs no callback, keeps the previous value, and re-syncs."""
    at = AppTest.from_function(_option_app).run()
    at.selectbox[0].select("b")
    at.radio[0].set_value("M")
    at.multiselect[0].select("y")
    at.run()
    assert at.session_state.calls == ["pick", "size", "tags"]

    at._run(widget_state=forged(at.get(widget)[0].id, **field))

    assert not at.exception
    assert at.session_state.calls == ["pick", "size", "tags"]
    assert at.selectbox[0].value == "b"
    assert at.radio[0].value == "M"
    assert at.multiselect[0].value == ["y"]
    assert at.get(widget)[0].proto.set_value is True


@pytest.mark.parametrize(
    ("widget", "field", "expected"),
    [
        ("selectbox", {"string_value": "c"}, "c"),
        ("radio", {"string_value": "L"}, "L"),
        ("multiselect", {"string_array_value": _labels("z", "x")}, ["z", "x"]),
    ],
)
def test_one_of_the_options_is_accepted(
    widget: str, field: dict[str, Any], expected: Any
) -> None:
    """A legal choice runs its callback once, and then passes as unchanged."""
    at = AppTest.from_function(_option_app).run()

    at._run(widget_state=forged(at.get(widget)[0].id, **field))

    assert at.get(widget)[0].value == expected
    assert at.session_state.calls == [_OPTION_KEYS[widget]]
    at.run()
    assert at.session_state.calls == [_OPTION_KEYS[widget]]


def _shared_label_app() -> None:
    import streamlit as st

    def on_change(name: str) -> None:
        st.session_state.calls = [*st.session_state.get("calls", []), name]

    def parity(number: int) -> str:
        return "odd" if number % 2 else "even"

    for widget, key in [
        ("selectbox", "pick"),
        ("radio", "size"),
        ("multiselect", "tags"),
    ]:
        getattr(st, widget)(
            widget,
            [1, 2, 3],
            format_func=parity,
            key=key,
            on_change=on_change,
            args=[key],
        )


@pytest.mark.parametrize(
    ("widget", "field", "expected"),
    [
        # Selectbox and radio resolve a shared label to its last option.
        ("selectbox", {"string_value": "odd"}, 3),
        ("radio", {"string_value": "odd"}, 3),
        # A multiselect resolves it to the first, also for "Select all", which
        # lists the shared label once per option.
        ("multiselect", {"string_array_value": _labels("odd")}, [1]),
        (
            "multiselect",
            {"string_array_value": _labels("odd", "even", "odd")},
            [1, 2, 1],
        ),
    ],
)
def test_a_shared_label_is_accepted(
    widget: str, field: dict[str, Any], expected: Any
) -> None:
    """A browser sends a shared format_func label as shown, so it is kept."""
    at = AppTest.from_function(_shared_label_app).run()

    at._run(widget_state=forged(at.get(widget)[0].id, **field))

    assert at.get(widget)[0].value == expected
    assert at.session_state.calls == [_OPTION_KEYS[widget]]
    assert at.get(widget)[0].proto.set_value is False


def test_a_shared_label_repeated_past_its_options_is_refused() -> None:
    """A label is listed at most as often as options show it."""
    at = AppTest.from_function(_shared_label_app).run()

    at._run(
        widget_state=forged(
            at.multiselect[0].id, string_array_value=_labels("odd", "odd", "odd")
        )
    )

    assert at.multiselect[0].value == []
    assert "calls" not in at.session_state


def test_a_new_session_keeps_a_shared_label() -> None:
    """A browser map with shared labels, resent to a new session, keeps them."""
    first = AppTest.from_function(_shared_label_app).run()
    first.selectbox[0].set_value(1)
    first.multiselect[0].set_value([1, 3])
    first.run()
    restored = first._tree.get_widget_states()

    fresh = AppTest.from_function(_shared_label_app)
    fresh._run(widget_state=restored)

    # Each label resolves as it does for a browser.
    assert fresh.selectbox[0].value == 3
    assert fresh.multiselect[0].value == [1, 1]
    assert "calls" not in fresh.session_state


def _new_option_app() -> None:
    import streamlit as st

    def on_change() -> None:
        st.session_state.changes = st.session_state.get("changes", 0) + 1

    st.selectbox(
        "City",
        ["Paris", "Berlin"],
        accept_new_options=True,
        key="city",
        on_change=on_change,
    )
    st.multiselect(
        "Tags", ["a", "b"], accept_new_options=True, key="tags", on_change=on_change
    )


@pytest.mark.parametrize(
    ("widget", "field", "expected"),
    [
        # The browser sends typed text as it is, untrimmed.
        ("selectbox", {"string_value": " Rome "}, " Rome "),
        ("multiselect", {"string_array_value": _labels("a", "new")}, ["a", "new"]),
    ],
)
def test_accept_new_options_takes_new_text(
    widget: str, field: dict[str, Any], expected: Any
) -> None:
    """With accept_new_options, any non-empty text is legal."""
    at = AppTest.from_function(_new_option_app).run()

    at._run(widget_state=forged(at.get(widget)[0].id, **field))

    assert at.get(widget)[0].value == expected
    assert at.session_state.changes == 1


@pytest.mark.parametrize(
    ("widget", "field"),
    [
        ("selectbox", {"string_value": ""}),
        ("multiselect", {"string_array_value": _labels("new", "new")}),
    ],
)
def test_accept_new_options_refuses_empty_or_repeated_text(
    widget: str, field: dict[str, Any]
) -> None:
    """Empty text is no option, and a new option can be listed once."""
    at = AppTest.from_function(_new_option_app).run()

    at._run(widget_state=forged(at.get(widget)[0].id, **field))

    assert at.selectbox[0].value == "Paris"
    assert at.multiselect[0].value == []
    assert "changes" not in at.session_state


def _narrowing_app() -> None:
    import streamlit as st

    def narrow() -> None:
        st.session_state.narrow = True

    options = ["a", "b"] if st.session_state.get("narrow") else ["a", "b", "c"]
    st.selectbox("Pick", options, key="pick", on_change=narrow)


def test_a_choice_is_checked_against_the_options_the_user_saw() -> None:
    """Options the click itself removes are reconciled after the callback runs."""
    at = AppTest.from_function(_narrowing_app).run()

    at._run(widget_state=forged(at.selectbox[0].id, string_value="c"))

    assert at.session_state.narrow is True
    assert at.selectbox[0].options == ["a", "b"]
    assert at.selectbox[0].value == "a"
    assert at.selectbox[0].proto.set_value is True


def _widget_id(at: AppTest, key: str) -> str:
    """The element ID of the widget with ``key``, also for a container."""
    widget_id = at.session_state._state._state.get_widget_id_from_key(key)
    assert widget_id is not None
    return widget_id


def _choice_app() -> None:
    import streamlit as st

    def on_change(name: str) -> None:
        st.session_state.calls = [*st.session_state.get("calls", []), name]

    st.select_slider(
        "Level",
        ["a", "b", "c", "d"],
        value=("b", "c"),
        key="level",
        on_change=on_change,
        args=["level"],
    )
    st.pills("Pill", ["a", "b"], key="pill", on_change=on_change, args=["pill"])
    st.segmented_control(
        "Segments",
        ["a", "b", "c"],
        selection_mode="multi",
        key="segments",
        on_change=on_change,
        args=["segments"],
    )
    st.feedback("thumbs", key="thumbs", on_change=on_change, args=["thumbs"])
    st.tabs(["A", "B"], key="tab", on_change=on_change, args=["tab"])
    st.menu_button("Menu", ["x", "y"], key="menu", on_click=on_change, args=["menu"])


# A legal value other than the default for each value widget in _choice_app.
_LEGAL_CHOICES: dict[str, dict[str, Any]] = {
    "level": {"string_array_value": _labels("a", "d")},
    "pill": {"string_array_value": _labels("b")},
    "segments": {"string_array_value": _labels("c")},
    "thumbs": {"string_value": "0"},
    "tab": {"string_value": "B"},
}


def _choose_legal_values(at: AppTest) -> None:
    at._run(
        widget_state=forged_many(
            *(
                WidgetState(id=_widget_id(at, key), **field)
                for key, field in _LEGAL_CHOICES.items()
            )
        )
    )
    assert at.session_state.calls == list(_LEGAL_CHOICES)


def _chosen_values(at: AppTest) -> dict[str, Any]:
    return {key: at.session_state[key] for key in _LEGAL_CHOICES}


@pytest.mark.parametrize(
    ("key", "field", "resyncs"),
    [
        ("level", {"string_array_value": _labels("b", "zzz")}, True),
        # A range is two labels, lower end first.
        ("level", {"string_array_value": _labels("d", "b")}, True),
        ("level", {"string_array_value": _labels("b")}, True),
        ("level", {"string_array_value": _labels("a", "b", "c")}, True),
        # The empty label a browser sends for an index past the options.
        ("level", {"string_array_value": _labels("")}, True),
        # A keyed button group reads a label it cannot resolve as the
        # selection it holds, which keeps a relabel quiet, so it is unchanged.
        ("pill", {"string_array_value": _labels("zzz")}, False),
        ("pill", {"string_array_value": _labels("a", "b")}, True),
        ("segments", {"string_array_value": _labels("a", "zzz")}, True),
        ("segments", {"string_array_value": _labels("a", "a")}, True),
        ("thumbs", {"string_value": "7"}, True),
        # Text that int() reads but the browser never sends.
        ("thumbs", {"string_value": "+1"}, True),
        # Tabs have no channel to tell the browser.
        ("tab", {"string_value": "C"}, False),
    ],
)
def test_a_choice_outside_the_options_is_refused(
    key: str, field: dict[str, Any], resyncs: bool
) -> None:
    """A forged choice runs no callback and keeps every previous value."""
    at = AppTest.from_function(_choice_app).run()
    _choose_legal_values(at)
    chosen = _chosen_values(at)

    at._run(widget_state=forged(_widget_id(at, key), **field))

    assert not at.exception
    assert at.session_state.calls == list(_LEGAL_CHOICES)
    assert _chosen_values(at) == chosen
    if key != "tab":
        assert at.get_by_key(key).proto.set_value is resyncs


def test_a_menu_click_on_an_unknown_option_is_no_click() -> None:
    """A trigger for an option the menu never showed fires nothing."""
    at = AppTest.from_function(_choice_app).run()

    at._run(
        widget_state=forged(
            _widget_id(at, "menu"), string_trigger_value={"data": "zzz"}
        )
    )

    assert "calls" not in at.session_state
    assert at.menu_button[0].value is None


@pytest.mark.parametrize(
    ("key", "url_value", "expected_value", "expected_param"),
    [
        # An unknown end of a range falls back to that end's default, and
        # the URL is corrected.
        ("level", ["a", "zzz"], ("a", "c"), ["a", "c"]),
        ("level", ["zzz", "a"], ("a", "b"), ["a", "b"]),
        # A repaired value that equals the default clears the param.
        ("level", ["zzz", "c"], ("b", "c"), None),
        # A reversed range is sorted; a wrong number of labels clears the param.
        ("level", ["d", "a"], ("a", "d"), ["a", "d"]),
        ("level", "a", ("b", "c"), None),
        ("level", ["a", "b", "c"], ("b", "c"), None),
        ("pill", "zzz", None, None),
        # Unknown items are filtered from a multi-select array.
        ("segments", ["a", "zzz"], ["a"], "a"),
        ("thumbs", "7", None, None),
        ("tab", "C", "A", None),
        ("tab", "B", "B", "B"),
    ],
)
def test_a_bound_url_value_outside_the_options_is_repaired_or_cleared(
    key: str,
    url_value: str | list[str],
    expected_value: Any,
    expected_param: str | list[str] | None,
) -> None:
    """A link is checked against the options, as a browser value is."""
    script = (
        "import streamlit as st\n"
        "st.select_slider('Level', ['a', 'b', 'c', 'd'], value=('b', 'c'), "
        "key='level', bind='query-params')\n"
        "st.pills('Pill', ['a', 'b'], key='pill', bind='query-params')\n"
        "st.segmented_control('Segments', ['a', 'b', 'c'], selection_mode='multi', "
        "key='segments', bind='query-params')\n"
        "st.feedback('thumbs', key='thumbs', bind='query-params')\n"
        "st.tabs(['A', 'B'], key='tab', on_change='rerun', bind='query-params')\n"
    )
    at = AppTest.from_string(script)
    at.query_params[key] = url_value
    at.run()

    assert not at.exception
    assert at.session_state[key] == expected_value
    assert at.query_params.get(key) == expected_param


def _language_app() -> None:
    import streamlit as st

    def on_change(name: str) -> None:
        st.session_state.calls = [*st.session_state.get("calls", []), name]

    labels = (
        {"A": "manzana", "B": "naranja"}
        if st.session_state.get("lang") == "es"
        else {"A": "apple", "B": "orange"}
    )
    st.pills(
        "Keyed",
        ["A", "B"],
        format_func=labels.get,
        key="keyed",
        on_change=on_change,
        args=["keyed"],
    )
    st.pills(
        "Keyed multi",
        ["A", "B"],
        format_func=labels.get,
        selection_mode="multi",
        key="keyed_multi",
        on_change=on_change,
        args=["keyed_multi"],
    )
    st.pills("Keyless", ["A", "B"], format_func=labels.get, default="B")
    st.segmented_control(
        "Keyless multi",
        ["A", "B"],
        format_func=labels.get,
        selection_mode="multi",
        default=["A"],
    )


def test_a_language_switch_keeps_pills_without_a_refusal(
    refusal_logs: list[str],
) -> None:
    """Relabeled pills keep their selection, and a stale echo is not refused.

    A browser can still send the old labels once the server holds the new
    ones. The stale-label recovery reads that echo as the held value.
    """
    at = AppTest.from_function(_language_app).run()
    keyed_id = at.button_group[0].id
    keyed_multi_id = at.button_group[1].id
    at._run(
        widget_state=forged_many(
            WidgetState(id=keyed_id, string_array_value=_labels("orange")),
            WidgetState(
                id=keyed_multi_id, string_array_value=_labels("apple", "orange")
            ),
        )
    )
    assert at.session_state.calls == ["keyed", "keyed_multi"]

    with patch_config_options({"global.e2eTest": True}):
        at.session_state["lang"] = "es"
        at.run()
        # The old labels again, as a browser that has not applied the relabel.
        at._run(
            widget_state=forged_many(
                WidgetState(id=keyed_id, string_array_value=_labels("orange")),
                WidgetState(
                    id=keyed_multi_id, string_array_value=_labels("apple", "orange")
                ),
            )
        )

    assert not at.exception
    assert at.session_state.calls == ["keyed", "keyed_multi"]
    assert [group.value for group in at.button_group] == ["B", ["A", "B"], "B", ["A"]]
    assert at.button_group[0].options == ["manzana", "naranja"]
    assert refusal_logs == []


def _numbers(*values: float) -> dict[str, list[float]]:
    """A ``double_array_value`` for ``forged``."""
    return {"data": list(values)}


def _send_legal_values(at: AppTest, legal: dict[str, dict[str, Any]]) -> None:
    """Change each widget in ``legal`` away from its default, as a browser does."""
    at._run(
        widget_state=forged_many(
            *(
                WidgetState(id=_widget_id(at, key), **field)
                for key, field in legal.items()
            )
        )
    )
    assert at.session_state.calls == list(legal)


def _assert_refused_and_resynced(
    at: AppTest, key: str, field: dict[str, Any], legal: dict[str, dict[str, Any]]
) -> None:
    """Send ``field`` for ``key``, and check that nothing changed but a re-sync."""
    held = {name: at.session_state[name] for name in legal}

    at._run(widget_state=forged(_widget_id(at, key), **field))

    assert not at.exception
    assert at.session_state.calls == list(legal)
    assert {name: at.session_state[name] for name in legal} == held
    assert at.get_by_key(key).proto.set_value is True


def _bounded_app() -> None:
    import streamlit as st

    def on_change(name: str) -> None:
        st.session_state.calls = [*st.session_state.get("calls", []), name]

    st.number_input("Count", 0, 10, 5, key="count", on_change=on_change, args=["count"])
    st.number_input(
        "Ratio", 0.0, 1.0, 0.5, key="ratio", on_change=on_change, args=["ratio"]
    )
    st.slider("Level", 0, 100, 10, key="level", on_change=on_change, args=["level"])
    st.slider("Span", 0, 100, (20, 80), key="span", on_change=on_change, args=["span"])
    st.pagination(5, key="page", on_change=on_change, args=["page"])


# A legal value other than the default for each widget in _bounded_app, in the
# field the browser sends it in.
_LEGAL_BOUNDED: dict[str, dict[str, Any]] = {
    "count": {"int_value": 7},
    "ratio": {"double_value": 0.25},
    "level": {"double_array_value": _numbers(30.0)},
    "span": {"double_array_value": _numbers(30.0, 60.0)},
    "page": {"int_value": 3},
}


@pytest.mark.parametrize(
    ("key", "field"),
    [
        ("count", {"int_value": 11}),
        ("count", {"int_value": -1}),
        # The int and double fields accept each other, but not a fraction.
        ("count", {"double_value": 8.5}),
        ("count", {"double_value": 1e9}),
        ("ratio", {"double_value": math.nan}),
        ("ratio", {"double_value": math.inf}),
        ("ratio", {"double_value": 1.5}),
        ("level", {"double_array_value": _numbers(101.0)}),
        ("level", {"double_array_value": _numbers(40.5)}),
        ("level", {"double_array_value": _numbers(math.nan)}),
        ("level", {"double_array_value": _numbers(30.0, 40.0)}),
        ("span", {"double_array_value": _numbers(60.0, 30.0)}),
        ("span", {"double_array_value": _numbers(50.0)}),
        ("span", {"double_array_value": _numbers(10.0, 20.0, 30.0)}),
        ("page", {"int_value": 0}),
        ("page", {"int_value": 6}),
        ("page", {"double_value": 2.5}),
    ],
)
def test_a_value_outside_the_bounds_or_shape_is_refused(
    key: str, field: dict[str, Any]
) -> None:
    """A forged number runs no callback, keeps the previous value, and re-syncs."""
    at = AppTest.from_function(_bounded_app).run()
    _send_legal_values(at, _LEGAL_BOUNDED)

    _assert_refused_and_resynced(at, key, field, _LEGAL_BOUNDED)


@pytest.mark.parametrize(
    ("key", "field", "expected"),
    [
        # AppTest and the agent API send an integer input's value as a double.
        ("count", {"double_value": 10.0}, 10),
        ("count", {"int_value": 0}, 0),
        ("level", {"double_array_value": _numbers(100.0)}, 100),
        # An empty range has equal ends.
        ("span", {"double_array_value": _numbers(50.0, 50.0)}, (50, 50)),
        ("page", {"int_value": 5}, 5),
    ],
)
def test_a_value_within_the_bounds_is_accepted(
    key: str, field: dict[str, Any], expected: Any
) -> None:
    """Values at the bounds, in either numeric field, run the callback."""
    at = AppTest.from_function(_bounded_app).run()

    at._run(widget_state=forged(_widget_id(at, key), **field))

    assert at.session_state.calls == [key]
    assert at.session_state[key] == expected


def test_a_fraction_that_truncates_to_the_held_value_changes_nothing() -> None:
    """A conversion can map a forged value onto the held one, which is unchanged.

    The browser never sends a fraction, so there is nothing to re-sync.
    """
    at = AppTest.from_function(_bounded_app).run()
    _send_legal_values(at, _LEGAL_BOUNDED)

    at._run(widget_state=forged(_widget_id(at, "count"), double_value=7.5))

    assert at.session_state.calls == list(_LEGAL_BOUNDED)
    assert at.session_state.count == 7
    assert at.number_input(key="count").proto.set_value is False


@pytest.mark.parametrize(
    ("key", "url_value", "expected_value", "expected_param"),
    [
        # An integer input still truncates a fraction, and the URL is corrected.
        ("count", "2.9", 2, "2"),
        ("count", "1e9", 5, None),
        ("count", "inf", 5, None),
        ("count", "nan", 5, None),
        ("ratio", "0.75", 0.75, "0.75"),
        ("ratio", "1.5", 0.5, None),
        ("level", "101", 10, None),
        ("level", ["40", "50"], 10, None),
        # A reversed range is sorted, as the browser sends it.
        ("span", ["80", "30"], (30, 80), ["30", "80"]),
        ("span", "50", (20, 80), None),
        ("page", "0", 1, None),
        ("page", "6", 1, None),
        ("page", "3", 3, "3"),
    ],
)
def test_a_bound_url_value_outside_the_bounds_is_cleared(
    key: str,
    url_value: str | list[str],
    expected_value: Any,
    expected_param: str | list[str] | None,
) -> None:
    """A link is checked against the bounds, as a browser value is."""
    script = (
        "import streamlit as st\n"
        "st.number_input('Count', 0, 10, 5, key='count', bind='query-params')\n"
        "st.number_input('Ratio', 0.0, 1.0, 0.5, key='ratio', bind='query-params')\n"
        "st.slider('Level', 0, 100, 10, key='level', bind='query-params')\n"
        "st.slider('Span', 0, 100, (20, 80), key='span', bind='query-params')\n"
        "st.pagination(5, key='page', bind='query-params')\n"
    )
    at = AppTest.from_string(script)
    at.query_params[key] = url_value
    at.run()

    assert not at.exception
    assert at.session_state[key] == expected_value
    assert at.query_params.get(key) == expected_param


def _temporal_app() -> None:
    import datetime as dt

    import streamlit as st

    def on_change(name: str) -> None:
        st.session_state.calls = [*st.session_state.get("calls", []), name]

    st.date_input(
        "Day",
        dt.date(2026, 1, 15),
        min_value=dt.date(2026, 1, 1),
        max_value=dt.date(2026, 12, 31),
        key="day",
        on_change=on_change,
        args=["day"],
    )
    st.date_input(
        "Trip",
        (dt.date(2026, 3, 1), dt.date(2026, 3, 5)),
        min_value=dt.date(2026, 1, 1),
        max_value=dt.date(2026, 12, 31),
        key="trip",
        on_change=on_change,
        args=["trip"],
    )
    st.datetime_input(
        "When",
        dt.datetime(2026, 1, 15, 9, 30),
        min_value=dt.datetime(2026, 1, 1),
        max_value=dt.datetime(2026, 12, 31, 23, 59),
        key="when",
        on_change=on_change,
        args=["when"],
    )
    st.time_input(
        "Alarm", dt.time(7, 0), key="alarm", on_change=on_change, args=["alarm"]
    )


# A legal value other than the default for each widget in _temporal_app.
_LEGAL_TEMPORAL: dict[str, dict[str, Any]] = {
    "day": {"string_array_value": _labels("2026-02-01")},
    "trip": {"string_array_value": _labels("2026-04-01", "2026-04-10")},
    "when": {"string_array_value": _labels("2026-02-01T10:15")},
    "alarm": {"string_value": "08:15"},
}


@pytest.mark.parametrize(
    ("key", "field"),
    [
        ("day", {"string_array_value": _labels("2027-01-01")}),
        ("day", {"string_array_value": _labels("2025-12-31")}),
        # The legacy layout is only read from links.
        ("day", {"string_array_value": _labels("2026/02/02")}),
        ("day", {"string_array_value": _labels("2026-2-2")}),
        ("day", {"string_array_value": _labels("2026-02-02", "2026-02-03")}),
        ("day", {"string_array_value": _labels("not-a-date")}),
        ("trip", {"string_array_value": _labels("2026-04-10", "2026-04-01")}),
        (
            "trip",
            {"string_array_value": _labels("2026-04-01", "2026-04-02", "2026-04-03")},
        ),
        ("trip", {"string_array_value": _labels("2026-04-01", "2027-01-01")}),
        ("when", {"string_array_value": _labels("2027-01-01T00:00")}),
        ("when", {"string_array_value": _labels("2026/02/02, 10:15")}),
        ("when", {"string_array_value": _labels("2026-02-01T10:15:00")}),
        (
            "when",
            {"string_array_value": _labels("2026-02-03T10:15", "2026-02-04T10:15")},
        ),
        ("alarm", {"string_value": "9:15"}),
        ("alarm", {"string_value": "25:00"}),
    ],
)
def test_a_date_or_time_outside_its_layout_or_bounds_is_refused(
    key: str, field: dict[str, Any]
) -> None:
    """A forged date or time runs no callback, keeps the previous value, and re-syncs."""
    at = AppTest.from_function(_temporal_app).run()
    _send_legal_values(at, _LEGAL_TEMPORAL)

    _assert_refused_and_resynced(at, key, field, _LEGAL_TEMPORAL)


@pytest.mark.parametrize(
    ("key", "field", "expected"),
    [
        # A range may hold only its start, as while picking.
        (
            "trip",
            {"string_array_value": _labels("2026-04-01")},
            (dt.date(2026, 4, 1),),
        ),
        (
            "day",
            {"string_array_value": _labels("2026-12-31")},
            dt.date(2026, 12, 31),
        ),
        (
            "when",
            {"string_array_value": _labels("2026-12-31T23:59")},
            dt.datetime(2026, 12, 31, 23, 59),
        ),
        # Seconds are accepted for any step, and dropped for a minute step.
        ("alarm", {"string_value": "08:15:30"}, dt.time(8, 15)),
    ],
)
def test_a_date_or_time_the_browser_sends_is_accepted(
    key: str, field: dict[str, Any], expected: Any
) -> None:
    """Partial ranges, bounds, and both time layouts run the callback."""
    at = AppTest.from_function(_temporal_app).run()

    at._run(widget_state=forged(_widget_id(at, key), **field))

    assert at.session_state.calls == [key]
    assert at.session_state[key] == expected


@pytest.mark.parametrize(
    ("key", "url_value", "expected_value", "expected_param"),
    [
        # Old links in the legacy layouts keep working, and are corrected.
        ("day", "2026/02/02", dt.date(2026, 2, 2), "2026-02-02"),
        ("day", "2027-01-01", dt.date(2026, 1, 15), None),
        ("day", "not-a-date", dt.date(2026, 1, 15), None),
        # A reversed range is sorted, as the browser sends it.
        (
            "trip",
            ["2026-04-10", "2026-04-01"],
            (dt.date(2026, 4, 1), dt.date(2026, 4, 10)),
            ["2026-04-01", "2026-04-10"],
        ),
        (
            "trip",
            ["2026-04-01", "2026-04-02", "2026-04-03"],
            (dt.date(2026, 3, 1), dt.date(2026, 3, 5)),
            None,
        ),
        ("trip", "2026-04-01", (dt.date(2026, 4, 1),), "2026-04-01"),
        (
            "when",
            "2026/02/01, 10:15",
            dt.datetime(2026, 2, 1, 10, 15),
            "2026-02-01T10:15",
        ),
        ("when", "2027-01-01T00:00", dt.datetime(2026, 1, 15, 9, 30), None),
        ("alarm", "8:15", dt.time(8, 15), "08:15"),
        ("alarm", "25:00", dt.time(7, 0), None),
    ],
)
def test_a_bound_url_date_or_time_is_repaired_or_cleared(
    key: str,
    url_value: str | list[str],
    expected_value: Any,
    expected_param: str | list[str] | None,
) -> None:
    """A link is read in any layout it used to be read in, then checked."""
    script = (
        "import datetime as dt\n"
        "import streamlit as st\n"
        "st.date_input('Day', dt.date(2026, 1, 15), min_value=dt.date(2026, 1, 1), "
        "max_value=dt.date(2026, 12, 31), key='day', bind='query-params')\n"
        "st.date_input('Trip', (dt.date(2026, 3, 1), dt.date(2026, 3, 5)), "
        "min_value=dt.date(2026, 1, 1), max_value=dt.date(2026, 12, 31), "
        "key='trip', bind='query-params')\n"
        "st.datetime_input('When', dt.datetime(2026, 1, 15, 9, 30), "
        "min_value=dt.datetime(2026, 1, 1), max_value=dt.datetime(2026, 12, 31, 23, 59), "
        "key='when', bind='query-params')\n"
        "st.time_input('Alarm', dt.time(7, 0), key='alarm', bind='query-params')\n"
    )
    at = AppTest.from_string(script)
    at.query_params[key] = url_value
    at.run()

    assert not at.exception
    assert at.session_state[key] == expected_value
    assert at.query_params.get(key) == expected_param


def _color_app() -> None:
    import streamlit as st

    def on_change(name: str) -> None:
        st.session_state.calls = [*st.session_state.get("calls", []), name]

    st.color_picker(
        "Color", "#00FF00", key="color", on_change=on_change, args=["color"]
    )


_LEGAL_COLOR: dict[str, dict[str, Any]] = {"color": {"string_value": "#123456"}}


@pytest.mark.parametrize(
    "color",
    ["red", "#12345", "#ffffff\n", "##123456", "654321", "#12345g"],
)
def test_a_color_the_picker_never_sends_is_refused(color: str) -> None:
    """A malformed color runs no callback, keeps the previous one, and re-syncs."""
    at = AppTest.from_function(_color_app).run()
    _send_legal_values(at, _LEGAL_COLOR)

    _assert_refused_and_resynced(at, "color", {"string_value": color}, _LEGAL_COLOR)


@pytest.mark.parametrize("color", ["#abc", "#ABCDEF", "#00FF00"])
def test_a_color_in_either_case_and_length_is_accepted(color: str) -> None:
    """#rgb and #rrggbb in either case pass, and so does the author's value."""
    at = AppTest.from_function(_color_app).run()
    _send_legal_values(at, _LEGAL_COLOR)

    at._run(widget_state=forged(_widget_id(at, "color"), string_value=color))

    assert at.session_state.calls == ["color", "color"]
    assert at.session_state.color == color


@pytest.mark.parametrize(
    ("url_value", "expected_value", "expected_param"),
    [
        # A link may leave out the "#", and the URL is corrected.
        ("ff0000", "#ff0000", "#ff0000"),
        ("#abc", "#abc", "#abc"),
        ("red", "#00FF00", None),
        # Matched in full, so a trailing newline no longer seeds.
        ("#ffffff\n", "#00FF00", None),
    ],
)
def test_a_bound_url_color_is_normalized_or_cleared(
    url_value: str, expected_value: str, expected_param: str | None
) -> None:
    """A link is checked with the picker's validator after the "#" is added."""
    at = AppTest.from_string(
        "import streamlit as st\n"
        "st.color_picker('Color', '#00FF00', key='color', bind='query-params')\n"
    )
    at.query_params["color"] = url_value
    at.run()

    assert not at.exception
    assert at.session_state.color == expected_value
    assert at.query_params.get("color") == expected_param
