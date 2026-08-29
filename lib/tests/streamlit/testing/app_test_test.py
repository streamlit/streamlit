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

from pathlib import Path

import pytest

from streamlit.runtime.pages_manager import PagesManager
from streamlit.testing.v1 import AppTest


def test_smoke():
    def script():
        import streamlit as st

        st.radio("radio", options=["a", "b", "c"], key="r")
        st.radio("default index", options=["a", "b", "c"], index=2)

    at = AppTest.from_function(script).run()
    assert at.radio
    assert at.radio[0].value == "a"
    assert at.radio(key="r").value == "a"
    assert at.radio.values == ["a", "c"]

    r = at.radio[0].set_value("b")
    assert r.index == 1
    assert r.value == "b"
    at = r.run()
    assert at.radio[0].value == "b"
    assert at.radio.values == ["b", "c"]


def test_from_file_str():
    script = AppTest.from_file("../test_data/widgets_script.py")
    script.run()


def test_from_file_path():
    script = AppTest.from_file(Path("../test_data/widgets_script.py"))
    script.run()


def test_from_file_resolves_relative_path_from_calling_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Verify relative paths resolve against the calling file, not the CWD."""
    cwd_script = tmp_path / "test_data/main.py"
    cwd_script.parent.mkdir()
    cwd_script.write_text(
        'import streamlit as st\nst.text("wrong main page")\n', encoding="utf-8"
    )
    monkeypatch.chdir(tmp_path)

    at = AppTest.from_file("test_data/main.py").run()

    assert at.text[0].value == "main page"


def test_from_file_raises_immediately_for_missing_script():
    """Verify from_file raises immediately when the script is missing."""
    missing_script = Path(__file__).parent / "test_data/missing.py"

    with pytest.raises(FileNotFoundError) as exc_info:
        AppTest.from_file("test_data/missing.py")

    assert str(missing_script.resolve()) in str(exc_info.value)


def test_get_query_params():
    def script():
        import streamlit as st

        st.write(st.query_params)

    at = AppTest.from_function(script).run()
    assert at.json[0].value == "{}"
    at.query_params["foo"] = 5
    at.query_params["bar"] = "baz"
    at.run()
    assert at.json[0].value == '{"foo": "5", "bar": "baz"}'


def test_set_query_params():
    def script():
        import streamlit as st

        st.query_params["foo"] = "bar"

    at = AppTest.from_function(script).run()
    # parse.parse_qs puts everything in lists
    assert at.query_params["foo"] == ["bar"]


def test_secrets():
    def script():
        import streamlit as st

        st.write(st.secrets["foo"])

    at = AppTest.from_function(script)
    at.secrets["foo"] = "bar"
    at.run()
    assert at.markdown[0].value == "bar"
    assert at.secrets["foo"] == "bar"


def test_7636_regression():
    def repro():
        import streamlit as st

        st.container()

    at = AppTest.from_function(repro).run()

    repr(at)


def test_widget_added_removed():
    """
    Test that the value of a widget persists, disappears, and resets
    appropriately, as the widget is added and removed from the script execution.
    """

    def script():
        import streamlit as st

        cb = st.radio("radio emulating a checkbox", options=["off", "on"], key="cb")
        if cb == "on":
            st.radio("radio", options=["a", "b", "c"], key="conditional")

    at = AppTest.from_function(script).run()
    assert len(at.radio) == 1
    with pytest.raises(KeyError):
        at.radio(key="conditional")

    at.radio(key="cb").set_value("on").run()
    assert len(at.radio) == 2
    assert at.radio(key="conditional").value == "a"

    at.radio(key="conditional").set_value("c").run()
    assert len(at.radio) == 2
    assert at.radio(key="conditional").value == "c"

    at.radio(key="cb").set_value("off").run()
    assert len(at.radio) == 1
    with pytest.raises(KeyError):
        at.radio(key="conditional")

    at.radio(key="cb").set_value("on").run()
    assert len(at.radio) == 2
    assert at.radio(key="conditional").value == "a"


def test_query_narrowing():
    def script():
        import streamlit as st

        st.text("1")
        with st.expander("open"):
            st.text("2")
            st.text("3")
        st.text("4")

    at = AppTest.from_function(script).run()
    assert at.text.len == 4
    # querying elements via a block only returns the elements in that block
    assert at.expander[0].text.len == 2


def test_out_of_order_blocks() -> None:
    # Regression test for #7711
    def script():
        import streamlit as st

        container = st.container()
        with container:
            st.markdown("BarFoo")

            def button_one_clicked(cont):
                cont.info("Hi!")
                cont.markdown("FooBar")

            st.button("one", on_click=button_one_clicked, args=[container])

    at = AppTest.from_function(script).run()

    at.button[0].click().run()

    assert at.markdown.len == 2
    assert at.info[0].value == "Hi!"
    assert at.markdown.values == ["FooBar", "BarFoo"]


def test_from_function_kwargs():
    def script(foo, baz):
        import streamlit as st

        st.text(foo)
        st.text(baz)
        return foo

    at = AppTest.from_function(script, args=("bar",), kwargs={"baz": "baz"}).run()
    assert at.text.values == ["bar", "baz"]


def test_trigger_recursion():
    # Regression test for #7768
    def code():
        import time

        import streamlit as st

        if st.button(label="Submit"):
            time.sleep(1)
            st.rerun()

    at = AppTest.from_function(code).run()
    # The script run should finish instead of recurring and timing out
    at.button[0].click().run()


def test_switch_page_uses_paths_relative_to_main_script():
    """Verify page paths are resolved relative to the main script."""
    at = AppTest.from_file("test_data/main.py").run()
    assert at.text[0].value == "main page"

    at.switch_page("pages/page1.py").run()
    assert at.text[0].value == "page 1"

    invalid_page_path = "test_data/pages/page1.py"
    with pytest.raises(ValueError, match="relative to the main script") as exc_info:
        at.switch_page(invalid_page_path)

    expected_path = (Path(__file__).parent / "test_data" / invalid_page_path).resolve()
    assert str(expected_path) in str(exc_info.value)


def test_switch_page_preserves_main_script_for_page_links(tmp_path: Path):
    """Verify switched pages resolve page links from the main script."""
    main_script = tmp_path / "main.py"
    page_script = tmp_path / "pages/register.py"
    page_script.parent.mkdir()
    main_script.write_text(
        'import streamlit as st\nst.page_link("pages/register.py", label="Register")\n',
        encoding="utf-8",
    )
    page_script.write_text(
        'import streamlit as st\nst.page_link("main.py", label="Main")\n'
        'st.text("register page")\n',
        encoding="utf-8",
    )

    at = AppTest.from_file(main_script).run()
    at.switch_page("pages/register.py").run()

    assert not at.exception
    assert at.text[0].value == "register page"


def test_switch_page_widgets():
    at = AppTest.from_file("test_data/main.py").run()
    at.slider[0].set_value(5).run()
    assert at.slider[0].value == 5

    at.switch_page("pages/page1.py").run()
    assert not at.slider
    at.switch_page("main.py").run()
    assert at.slider[0].value == 0


def test_navigation_with_callable_pages():
    """Test st.navigation renders callable pages correctly.

    Regression test for https://github.com/streamlit/streamlit/issues/9446
    """

    def script():
        import streamlit as st

        def page1():
            st.title("Page 1 Title")
            st.write("Content from page 1")

        def page2():
            st.title("Page 2 Title")
            st.write("Content from page 2")

        st.write("Header from main app")
        pg = st.navigation(
            [
                st.Page(page1, title="Page 1"),
                st.Page(page2, title="Page 2"),
            ]
        )
        pg.run()

    at = AppTest.from_function(script).run()

    assert at.title[0].value == "Page 1 Title"
    assert "Header from main app" in at.markdown.values
    assert "Content from page 1" in at.markdown.values


def test_v2_custom_component():
    """Test AppTest can run apps that use st.components.v2 custom components.

    Regression test for https://github.com/streamlit/streamlit/issues/14274
    """

    def script():
        import streamlit as st
        from streamlit.components.v2 import component

        _my_component = component(
            "my_test_component",
            html='<div id="root">hello</div>',
        )

        st.title("Test")
        _my_component(key="test", data={"text": "hello"})

    at = AppTest.from_function(script).run()
    assert not at.exception, [e.message for e in at.exception]
    assert at.title[0].value == "Test"


def test_navigation_resets_pages_manager_state():
    """Test AppTest resets PagesManager.uses_pages_directory before running.

    Regression test for https://github.com/streamlit/streamlit/issues/9446
    """

    original_value = PagesManager.uses_pages_directory
    PagesManager.uses_pages_directory = True

    try:

        def script():
            import streamlit as st

            def page1():
                st.title("Navigation Page")
                st.write("Page content")

            pg = st.navigation([st.Page(page1, title="Page 1")])
            pg.run()

        at = AppTest.from_function(script).run()

        assert at.title[0].value == "Navigation Page"
        assert "Page content" in at.markdown.values
    finally:
        PagesManager.uses_pages_directory = original_value


def test_dynamic_widget_does_not_duplicate_on_rerun() -> None:
    """Dynamically adding an element before an existing widget should not
    leave stale widgets in the AppTest tree after a rerun.

    Regression test for https://github.com/streamlit/streamlit/issues/12566
    """

    def script():
        import streamlit as st

        if "_string_value" not in st.session_state:
            st.session_state._string_value = "string1"

        if st.session_state.get("_bool_value", False):
            with st.container(key="k_container"):
                st.html("<style>color: red;</style>")

        with st.container():
            st.text_input("Text", value=st.session_state._string_value)

            if st.button("Button", key="k_button"):
                st.session_state._string_value = "string2"
                st.session_state._bool_value = True
                st.rerun()

    at = AppTest.from_function(script).run()
    assert len(at.text_input) == 1
    assert at.text_input[0].value == "string1"

    at = at.button(key="k_button").click().run()
    assert len(at.text_input) == 1
    assert at.text_input[0].value == "string2"

    # A subsequent run with no interaction should not raise KeyError from
    # stale widget ids left over in the previous run's tree.
    at = at.run()
    assert len(at.text_input) == 1
    assert at.text_input[0].value == "string2"


def test_removed_widget_does_not_persist_on_rerun() -> None:
    """A widget removed during a rerun should not remain in the AppTest tree.

    Regression test for https://github.com/streamlit/streamlit/issues/9128
    """

    def script():
        import streamlit as st

        if "started" not in st.session_state:
            st.session_state.started = False

        if not st.session_state.started:
            with st.status("Starting", expanded=True) as status:
                question_1 = status.text_input("Start", key="question_1")

                if len(question_1) > 5:
                    st.write("ok: started")
                    st.session_state.started = True
                    st.rerun()
        else:
            st.status("Started", state="complete", expanded=False)

            with st.status("Question 2", expanded=True) as status:
                question_2 = status.text_input("Question 2", key="question_2")

                if len(question_2) > 5:
                    st.write("ok: stopping")
                    st.stop()

    at = AppTest.from_function(script).run()
    assert at.session_state.started is False
    assert len(at.text_input) == 1
    assert at.text_input[0].key == "question_1"

    at = at.text_input(key="question_1").set_value("aaaaaa").run()
    assert at.session_state.started is True
    assert len(at.text_input) == 1
    with pytest.raises(KeyError):
        at.text_input(key="question_1")
    assert at.text_input[0].key == "question_2"

    at = at.text_input(key="question_2").set_value("bbbbbb").run()
    assert len(at.text_input) == 1
    assert at.text_input(key="question_2").value == "bbbbbb"


def test_sidebar_widgets_removed_when_not_rendered() -> None:
    """Widgets omitted on a rerun must leave the sidebar tree.

    Regression test for https://github.com/streamlit/streamlit/issues/9814
    """

    def script():
        import streamlit as st

        st.session_state.setdefault("logged_in", False)
        if st.session_state.logged_in:
            if st.sidebar.button("Logout"):
                st.session_state.logged_in = False
                st.rerun()
        elif st.button("Login"):
            st.session_state.logged_in = True
            st.rerun()

    at = AppTest.from_function(script).run()
    assert len(at.sidebar.button) == 0
    assert len(at.button) == 1

    at = at.button[0].click().run()
    assert (len(at.button), len(at.sidebar.button)) == (1, 1)

    at = at.sidebar.button[0].click().run()
    assert (len(at.button), len(at.sidebar.button)) == (1, 0)


def test_run_tolerates_unimplemented_elements() -> None:
    """Apps that use unimplemented commands must still run and stay inspectable."""

    def script():
        import streamlit as st

        st.progress(40, text="halfway")
        st.html("<b>hi</b>")
        st.balloons()
        st.page_link("https://example.com", label="Example")
        st.title("still works")

    at = AppTest.from_function(script).run()
    assert not at.exception
    assert at.title[0].value == "still works"
    assert len(at.get("progress")) == 1
    assert at.get("progress")[0].value == 40
    assert at.get("html")[0].value == "<b>hi</b>"
    assert at.get("page_link")[0].value == "Example"


def test_switch_page_respects_custom_url_path(tmp_path: Path) -> None:
    """switch_page must use the navigation page hash, not the filename slug.

    Regression test for https://github.com/streamlit/streamlit/issues/16611
    """
    (tmp_path / "home.py").write_text(
        'import streamlit as st\nst.text("home page")\n', encoding="utf-8"
    )
    (tmp_path / "other.py").write_text(
        'import streamlit as st\nst.text("other page")\n', encoding="utf-8"
    )
    (tmp_path / "app.py").write_text(
        "import streamlit as st\n"
        "pg = st.navigation([\n"
        "    st.Page('home.py', title='Home'),\n"
        "    st.Page('other.py', title='Other', url_path='custom'),\n"
        "])\n"
        "pg.run()\n",
        encoding="utf-8",
    )

    at = AppTest.from_file(tmp_path / "app.py").run()
    assert at.text[0].value == "home page"

    at.switch_page("other.py").run()
    assert not at.exception
    assert at.text[0].value == "other page"


def test_switch_page_unknown_navigation_page_raises(tmp_path: Path) -> None:
    """Unknown navigation files must raise instead of opening the default page."""
    (tmp_path / "home.py").write_text(
        'import streamlit as st\nst.text("home page")\n', encoding="utf-8"
    )
    (tmp_path / "orphan.py").write_text(
        'import streamlit as st\nst.text("orphan page")\n', encoding="utf-8"
    )
    (tmp_path / "app.py").write_text(
        "import streamlit as st\n"
        "pg = st.navigation([st.Page('home.py', title='Home')])\n"
        "pg.run()\n",
        encoding="utf-8",
    )

    at = AppTest.from_file(tmp_path / "app.py").run()
    with pytest.raises(ValueError, match="navigation page"):
        at.switch_page("orphan.py")


def test_switch_page_rejects_unregistered_file_in_callable_navigation(
    tmp_path: Path,
) -> None:
    """Callable-only navigation must not silently open the default page."""
    (tmp_path / "orphan.py").write_text(
        'import streamlit as st\nst.text("orphan page")\n', encoding="utf-8"
    )
    (tmp_path / "app.py").write_text(
        "import streamlit as st\n"
        "def home():\n"
        "    st.text('home page')\n"
        "pg = st.navigation([st.Page(home, title='Home')])\n"
        "pg.run()\n",
        encoding="utf-8",
    )

    at = AppTest.from_file(tmp_path / "app.py").run()
    assert at.text[0].value == "home page"
    with pytest.raises(ValueError, match="navigation page"):
        at.switch_page("orphan.py")


def test_switch_page_does_not_match_callable_url_path_slug(tmp_path: Path) -> None:
    """A file slug must not steal a callable page that hashes the same url_path."""
    (tmp_path / "settings.py").write_text(
        'import streamlit as st\nst.text("file settings")\n', encoding="utf-8"
    )
    (tmp_path / "app.py").write_text(
        "import streamlit as st\n"
        "def home():\n"
        "    st.text('home page')\n"
        "def settings():\n"
        "    st.text('callable settings')\n"
        "pg = st.navigation([\n"
        "    st.Page(home, title='Home'),\n"
        "    st.Page(settings, title='Settings'),\n"
        "])\n"
        "pg.run()\n",
        encoding="utf-8",
    )

    at = AppTest.from_file(tmp_path / "app.py").run()
    assert at.text[0].value == "home page"
    with pytest.raises(ValueError, match="navigation page"):
        at.switch_page("settings.py")


def test_switch_page_keeps_navigation_registry_after_failed_run(
    tmp_path: Path,
) -> None:
    """A run that fails before st.navigation must not erase the last registry."""
    (tmp_path / "orphan.py").write_text(
        'import streamlit as st\nst.text("orphan page")\n', encoding="utf-8"
    )
    (tmp_path / "app.py").write_text(
        "import streamlit as st\n"
        "if st.session_state.get('fail'):\n"
        "    raise RuntimeError('boom')\n"
        "def home():\n"
        "    st.text('home page')\n"
        "pg = st.navigation([st.Page(home, title='Home')])\n"
        "pg.run()\n",
        encoding="utf-8",
    )

    at = AppTest.from_file(tmp_path / "app.py").run()
    assert at.text[0].value == "home page"
    at.session_state["fail"] = True
    at.run()
    assert at.exception
    with pytest.raises(ValueError, match="navigation page"):
        at.switch_page("orphan.py")


def test_switch_page_drops_registry_when_navigation_is_skipped(
    tmp_path: Path,
) -> None:
    """A successful run that skips st.navigation must not keep the old pages."""
    (tmp_path / "orphan.py").write_text(
        'import streamlit as st\nst.text("orphan page")\n', encoding="utf-8"
    )
    (tmp_path / "app.py").write_text(
        "import streamlit as st\n"
        "if st.session_state.get('plain'):\n"
        "    st.text('plain page')\n"
        "else:\n"
        "    def home():\n"
        "        st.text('home page')\n"
        "    pg = st.navigation([st.Page(home, title='Home')])\n"
        "    pg.run()\n",
        encoding="utf-8",
    )

    at = AppTest.from_file(tmp_path / "app.py").run()
    assert at.text[0].value == "home page"
    at.session_state["plain"] = True
    at.run()
    assert at.text[0].value == "plain page"
    at.switch_page("orphan.py")
