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

"""Which widgets count as rendered after each way a script run ends.

``AppTest``'s runner inherits ``ScriptRunner._run_script``, so these runs take
the real page-change cleanup, and its ``_on_script_finished`` mirrors the
script runner's.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.testing.v1 import AppTest

if TYPE_CHECKING:
    from pathlib import Path


def _rendered(at: AppTest) -> set[str]:
    return set(at.session_state._state._state._new_widget_state.rendered_ids)


def _stopping_app() -> None:
    import streamlit as st

    stop = st.checkbox("Stop", key="stop")
    if stop:
        st.stop()
    st.text_input("Name", key="name")


def test_a_run_that_calls_stop_forgets_the_widgets_after_it() -> None:
    """st.stop() leaves the later widgets unrendered, and their values kept."""
    at = AppTest.from_function(_stopping_app).run()
    at.text_input(key="name").input("Ada").run()
    name_id = at.text_input(key="name").id
    assert name_id in _rendered(at)

    at.checkbox(key="stop").check().run()

    assert name_id not in _rendered(at)
    assert at.session_state["name"] == "Ada"


def _raising_app() -> None:
    import streamlit as st

    if st.checkbox("Fail", key="fail"):
        raise RuntimeError("boom")
    st.text_input("Name", key="name")


def test_an_uncaught_exception_forgets_the_widgets_after_it() -> None:
    """An exception in the body ends the run early, like st.stop()."""
    at = AppTest.from_function(_raising_app).run()
    name_id = at.text_input(key="name").id

    at.checkbox(key="fail").check().run()

    assert at.exception
    assert name_id not in _rendered(at)


def _raising_callback_app() -> None:
    import streamlit as st

    def boom() -> None:
        raise RuntimeError("boom")

    st.button("Boom", key="boom", on_click=boom)
    st.text_input("Name", key="name")


def test_a_raising_callback_forgets_no_rendered_widget() -> None:
    """A callback that raises stops the run before anything registers."""
    at = AppTest.from_function(_raising_callback_app).run()
    before = _rendered(at)

    at.button(key="boom").click().run()

    assert at.exception
    assert _rendered(at) == before


def _write_pages(tmp_path: Path) -> Path:
    main_script = tmp_path / "main.py"
    other_page = tmp_path / "pages" / "other.py"
    other_page.parent.mkdir()
    main_script.write_text(
        'import streamlit as st\nst.button("Delete", key="delete")\n',
        encoding="utf-8",
    )
    other_page.write_text(
        'import streamlit as st\nst.text_input("Search", key="search")\n',
        encoding="utf-8",
    )
    return main_script


def test_a_page_change_forgets_the_previous_page_and_adds_no_client_id(
    tmp_path: Path,
) -> None:
    """The page-change message prunes but never adds; the new page's run prunes the rest."""
    at = AppTest.from_file(_write_pages(tmp_path)).run()
    delete_id = at.button(key="delete").id

    at.switch_page("pages/other.py")
    at._run(
        widget_state=WidgetStates(
            widgets=[
                WidgetState(id=delete_id, trigger_value=False),
                WidgetState(id="$$ID-forged-None", string_value="x"),
            ]
        )
    )

    assert _rendered(at) == {at.text_input(key="search").id}
