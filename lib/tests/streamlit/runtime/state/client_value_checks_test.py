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

import logging
from typing import TYPE_CHECKING, Any

import pytest

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.state import widget_checks
from streamlit.testing.v1 import AppTest

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
