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

import pytest

from tests.script_interactions import InteractiveScriptTests


@patch("streamlit.source_util._cached_pages", new=None)
class CheckboxTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "checkbox_test.py",
            """
            import streamlit as st

            st.checkbox("defaults")
            st.checkbox("defaulted on", True)
            """,
        )
        sr = script.run()
        assert sr.get("checkbox")
        assert sr.get("checkbox")[0].value == False
        assert sr.get("checkbox")[1].value == True

        sr2 = sr.get("checkbox")[0].check().run()
        assert sr2.get("checkbox")[0].value == True
        assert sr2.get("checkbox")[1].value == True

        sr3 = sr2.get("checkbox")[1].uncheck().run()
        assert sr3.get("checkbox")[0].value == True
        assert sr3.get("checkbox")[1].value == False


@pytest.mark.xfail(reason="button does not work correctly with session state")
@patch("streamlit.source_util._cached_pages", new=None)
class ButtonTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "button_test.py",
            """
            import streamlit as st

            st.button("button")
            st.button("second button")
            """,
        )
        sr = script.run()
        assert sr.get("button")[0].value == False
        assert sr.get("button")[1].value == False

        sr2 = sr.get("button")[0].click().run()
        assert sr2.get("button")[0].value == True
        assert sr2.get("button")[1].value == False

        sr3 = sr2.run()
        assert sr3.get("button")[0].value == False
        assert sr3.get("button")[1].value == False
