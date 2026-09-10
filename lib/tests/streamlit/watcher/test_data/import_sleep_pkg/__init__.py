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

"""Parent package that sleeps on import (gh-6404 nested KeyError case).

``import import_sleep_pkg.child`` execs this module first. Do not import at
pytest collection time.
"""

from __future__ import annotations

import time

from tests.streamlit.watcher.test_data import import_sleep_gate

import_sleep_gate.started.set()
time.sleep(import_sleep_gate.sleep_s)
