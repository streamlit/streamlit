# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
from unittest.mock import patch

from tests.interactive_scripts import InteractiveScriptTests


@patch("streamlit.source_util._cached_pages", new=None)
class InteractiveScriptTest(InteractiveScriptTests):
    def test_widgets_script(self):
        script = self.script_from_filename("widgets_script.py")
        sr = script.run()

        # main and sidebar
        assert len(sr) == 2
        main = sr[0]

        # columns live within a horizontal block, + 2 more elements
        assert len(main) == 3

        # 2 columns
        assert len(main[0]) == 2

        # first column has 4 elements
        assert len(main[0][0]) == 4

        radios = sr.get("radio")
        assert radios[0].value == "1"
        assert radios[1].value == "a"

        # iteration follows delta path order, with a block coming before
        # its children, which come before its siblings. main comes before
        # the sidebar
        assert [e.type for e in sr] == [
            "root",
            "main",
            "horizontal",
            "column",
            "checkbox",
            "text",
            "text_area",
            "text",
            "column",
            "radio",
            "text",
            "button",
            "text",
            "sidebar",
            "radio",
        ]

    def test_cached_widget_replay_rerun(self):
        script = self.script_from_string(
            "cached_widget_replay.py",
            """
            import streamlit as st

            @st.experimental_memo(experimental_allow_widgets=True)
            def foo(i):
                options = ["foo", "bar", "baz", "qux"]
                r = st.radio("radio", options, index=i)
                return r


            foo(1)
        """,
        )
        sr = script.run()

        assert len(sr.get("radio")) == 1
        sr2 = sr.run()
        assert len(sr2.get("radio")) == 1

    def test_cached_widget_replay_interaction(self):
        script = self.script_from_string(
            "cached_widget_replay.py",
            """
            import streamlit as st

            @st.experimental_memo(experimental_allow_widgets=True)
            def foo(i):
                options = ["foo", "bar", "baz", "qux"]
                r = st.radio("radio", options, index=i)
                return r


            foo(1)
        """,
        )
        sr = script.run()

        assert len(sr.get("radio")) == 1
        assert sr.get("radio")[0].value == "bar"

        sr2 = sr.get("radio")[0].set_value("qux").run()
        assert sr2.get("radio")[0].value == "qux"

    def test_radio_interaction(self):
        script = self.script_from_string(
            "radio_interaction.py",
            """
            import streamlit as st

            st.radio("radio", options=["a", "b", "c"])
            st.radio("default index", options=["a", "b", "c"], index=2)
            """,
        )
        sr = script.run()
        assert sr.get("radio")
        assert sr.get("radio")[0].value == "a"
        assert sr.get("radio")[1].value == "c"

        r = sr.get("radio")[0].set_value("b")
        assert r._index == 1
        sr2 = r.run()
        assert sr2.get("radio")[0].value == "b"
        assert [s.value for s in sr2.get("radio")] == ["b", "c"]

    def test_widget_key_lookup(self):
        script = self.script_from_string(
            "widget_keys.py",
            """
            import streamlit as st

            st.radio("keyless", options=["a", "b", "c"])
            st.radio("has key", options=["a", "b", "c"], key="r")
            """,
        )
        sr = script.run()
        assert sr.get_widget("r")
        assert sr.get_widget("r") == sr.get("radio")[1]
        assert sr.get_widget("s") is None
