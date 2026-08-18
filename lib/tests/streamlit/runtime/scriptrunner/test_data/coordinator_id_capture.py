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

"""Records each run's ParallelFragmentCoordinator id so the test can assert
that ScriptRunContext.reset() builds a fresh one per script run.

Calls ``st.rerun()`` exactly once so the script runs twice in a single
``ScriptRunner.start()`` -> ``join()`` cycle (back-to-back
``request_rerun`` calls get coalesced by ``ScriptRequests`` and only
trigger one run)."""

import streamlit as st
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    get_script_run_ctx,
)

ctx = get_script_run_ctx()
st.session_state.setdefault("coordinator_ids", [])
st.session_state["coordinator_ids"].append(id(ctx.parallel_coordinator))

if len(st.session_state["coordinator_ids"]) == 1:
    st.rerun()
