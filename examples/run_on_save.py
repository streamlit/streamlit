# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from random import random
import os
import platform
import streamlit as st
import time

st.title("Test of run-on-save")
secs_to_wait = 5

"""
How to test this:
"""

st.info(
    """
    **First of all, make sure you're running the dev version of Streamlit** or
    that this file lives outside the Streamlit distribution. Otherwise, changes
    to this file may be ignored!
"""
)

"""
1. If run-on-save is on, make sure the page changes every few seconds. Then
   turn run-on-save off in the settigns menu and check (2).
2. If run-on-save is off, make sure "Rerun"/"Always rerun" buttons appear in
   the status area. Click "Always rerun" and check (1).
"""

st.write("This should change every ", secs_to_wait, " seconds: ", random())

# Sleep for 5s (rather than, say, 1s) because on the first run we need to make
# sure Streamlit is fully initialized before the timer below expires. This can
# take several seconds.
status = st.empty()
for i in range(secs_to_wait, 0, -1):
    time.sleep(1)
    status.text("Sleeping %ss..." % i)

status.text("Touching %s" % __file__)

platform_system = platform.system()

if platform_system == "Linux":
    cmd = (
        "sed -i "
        "'s/^# MODIFIED AT:.*/# MODIFIED AT: %(time)s/' %(file)s"
        " && touch %(file)s"
        % {  # sed on Linux modifies a different file.
            "time": time.time(),
            "file": __file__,
        }
    )

elif platform_system == "Darwin":
    cmd = "sed -i bak " "'s/^# MODIFIED AT:.*/# MODIFIED AT: %s/' %s" % (
        time.time(),
        __file__,
    )

elif platform_system == "Windows":
    raise NotImplementedError("Windows not supported")

else:
    raise Exception("Unknown platform")

os.system(cmd)

status.text("Touched %s" % __file__)

# MODIFIED AT: 1586542219.90599
