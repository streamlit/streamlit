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
import platform
import subprocess
import threading
import uuid

from typing import Optional

from streamlit import file_util
from streamlit import util

_ETC_MACHINE_ID_PATH = "/etc/machine-id"
_DBUS_MACHINE_ID_PATH = "/var/lib/dbus/machine-id"


def _get_machine_id():
    """Get the machine ID

    This is a unique identifier for a user for tracking metrics in Segment,
    that is broken in different ways in some Linux distros and Docker images.
    - at times just a hash of '', which means many machines map to the same ID
    - at times a hash of the same string, when running in a Docker container
    - we run a sudo command, which is weird and bad in all sorts of ways

    We'll track multiple IDs in Segment for a few months after which
    we'll remove this one. The goal is to determine a ratio between them
    that we can use to normalize our metrics.

    """
    if (
        platform.system() == "Linux"
        and os.path.isfile(_ETC_MACHINE_ID_PATH) == False
        and os.path.isfile(_DBUS_MACHINE_ID_PATH) == False
    ):
        subprocess.run(["sudo", "dbus-uuidgen", "--ensure"])

    machine_id = str(uuid.getnode())
    if os.path.isfile(_ETC_MACHINE_ID_PATH):
        with open(_ETC_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    elif os.path.isfile(_DBUS_MACHINE_ID_PATH):
        with open(_DBUS_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    return machine_id


def _get_machine_id_v3() -> str:
    """Get the machine ID

    This is a unique identifier for a user for tracking metrics in Segment,
    that is broken in different ways in some Linux distros and Docker images.
    - at times just a hash of '', which means many machines map to the same ID
    - at times a hash of the same string, when running in a Docker container

    This is a replacement for _get_machine_id() that doesn't try to use `sudo`
    when there is no machine-id file, because it isn't available in all enviroments
    and is a bad break in the user flow even when it is usable.

    We'll track multiple IDs in Segment for a few months after which
    we'll drop the others. The goal is to determine a ratio between them
    that we can use to normalize our metrics.

    """

    machine_id = str(uuid.getnode())
    if os.path.isfile(_ETC_MACHINE_ID_PATH):
        with open(_ETC_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    elif os.path.isfile(_DBUS_MACHINE_ID_PATH):
        with open(_DBUS_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    return machine_id


def _get_stable_random_id():
    """Get a stable random ID

    This is a unique identifier for a user for tracking metrics in Segment.
    Instead of relying on a hardware address in the container or host we'll
    generate a UUID and store it in the Streamlit hidden folder.

    """
    filepath = file_util.get_streamlit_file_path(".stable_random_id")
    stable_id = None

    if os.path.exists(filepath):
        with file_util.streamlit_read(filepath) as input:
            stable_id = input.read()

    if not stable_id:
        stable_id = str(uuid.uuid4())
        with file_util.streamlit_write(filepath) as output:
            output.write(stable_id)

    return stable_id


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
        self.installation_id_v1 = str(uuid.uuid5(uuid.NAMESPACE_DNS, _get_machine_id()))
        self.installation_id_v2 = str(
            uuid.uuid5(uuid.NAMESPACE_DNS, _get_stable_random_id())
        )
        self.installation_id_v3 = str(
            uuid.uuid5(uuid.NAMESPACE_DNS, _get_machine_id_v3())
        )

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def installation_id(self):
        return self.installation_id_v3
