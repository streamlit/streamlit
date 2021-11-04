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

import os
import threading
import uuid

from typing import Optional

from streamlit import util

_ETC_MACHINE_ID_PATH = "/etc/machine-id"
_DBUS_MACHINE_ID_PATH = "/var/lib/dbus/machine-id"


def _get_machine_id_v3() -> str:
    """Get the machine ID

    This is a unique identifier for a user for tracking metrics in Segment,
    that is broken in different ways in some Linux distros and Docker images.
    - at times just a hash of '', which means many machines map to the same ID
    - at times a hash of the same string, when running in a Docker container
    """

    machine_id = str(uuid.getnode())
    if os.path.isfile(_ETC_MACHINE_ID_PATH):
        with open(_ETC_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    elif os.path.isfile(_DBUS_MACHINE_ID_PATH):
        with open(_DBUS_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    return machine_id


class Installation:
    _instance_lock = threading.Lock()
    _instance = None  # type: Optional[Installation]

    @classmethod
    def instance(cls) -> "Installation":
        """Returns the singleton Installation"""
        # We use a double-checked locking optimization to avoid the overhead
        # of acquiring the lock in the common case:
        # https://en.wikipedia.org/wiki/Double-checked_locking
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = Installation()
        return cls._instance

    def __init__(self):
        self.installation_id_v3 = str(
            uuid.uuid5(uuid.NAMESPACE_DNS, _get_machine_id_v3())
        )

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def installation_id(self):
        return self.installation_id_v3
