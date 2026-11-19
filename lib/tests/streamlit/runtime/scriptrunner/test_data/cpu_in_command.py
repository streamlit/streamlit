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

"""Spends 0.2 seconds of CPU time inside a tracked command, then waits in user
code.
"""

import time

from streamlit.runtime.metrics_util import gather_metrics


@gather_metrics("burn_cpu")
def burn_cpu() -> None:
    end = time.thread_time() + 0.2
    while time.thread_time() < end:
        pass


burn_cpu()
time.sleep(0.1)
