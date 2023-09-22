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

from streamlit.testing.test_runner import TestRunner


def test_smoke():
    sr = TestRunner.from_string(
        """
        import streamlit as st

        st.radio("radio", options=["a", "b", "c"], key="r")
        st.radio("default index", options=["a", "b", "c"], index=2)
        """
    ).run()
    assert sr.radio

    assert sr.radio[0].value == "a"
    assert sr.radio(key="r").value == "a"
    assert sr.radio.get_widget("r").value == "a"

    assert sr.radio[1].value == "c"
    assert sr.radio.values == ["a", "c"]

    r = sr.radio[0].set_value("b")
    assert r.index == 1
    assert r.value == "b"
    sr2 = r.run()
    assert sr2.radio[0].value == "b"
    assert [s.value for s in sr2.radio] == ["b", "c"]


def test_checkbox():
    script = TestRunner.from_string(
        """
        import streamlit as st

        st.checkbox("defaults")
        st.checkbox("defaulted on", True)
        """,
    )
    sr = script.run()
    assert sr.checkbox
    assert sr.checkbox.values == [False, True]

    sr.checkbox[0].check().run()
    assert sr.checkbox[0].value == True
    assert sr.checkbox[1].value == True

    sr.checkbox[1].uncheck().run()
    assert sr.checkbox[0].value == True
    assert sr.checkbox[1].value == False
