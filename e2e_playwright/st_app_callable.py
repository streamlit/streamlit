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

"""E2E fixture for an st.App callable entrypoint."""

import streamlit as st


def main() -> None:
    st.title("Callable st.App")
    st.session_state.call_count = st.session_state.get("call_count", 0) + 1
    st.write(f"Main calls: {st.session_state.call_count}")
    st.button("Rerun callable")


app = st.App(main)

if __name__ == "__main__":
    app.run()
