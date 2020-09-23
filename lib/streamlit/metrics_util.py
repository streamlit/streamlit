import os
import platform
import subprocess
import threading
import uuid

from typing import Optional

from streamlit import file_util

def _get_machine_id_v1():
    """Get the old machine id"""
    if (
        platform.system() == "Linux"
        and os.path.isfile("/etc/machine-id") == False
        and os.path.isfile("/var/lib/dbus/machine-id") == False
    ):
        print("Generate machine-id")
        subprocess.run(["sudo", "dbus-uuidgen", "--ensure"])

    machine_id = str(uuid.getnode())
    if os.path.isfile("/etc/machine-id"):
        with open("/etc/machine-id", "r") as f:
            machine_id = f.read()

    elif os.path.isfile("/var/lib/dbus/machine-id"):
        with open("/var/lib/dbus/machine-id", "r") as f:
            machine_id = f.read()

    return machine_id

def _get_machine_id_v2():
    """Get the new machine id"""
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
        self._lock = threading.Lock()
        self.installation_id = ""
        self.installation_id_v1 = ""
        self.installation_id_v2 = ""

    def create_ids(self) -> None:
        if not self.installation_id:
            with self._lock:
                self.installation_id_v1 = str(uuid.uuid5(uuid.NAMESPACE_DNS, _get_machine_id_v1()))
                self.installation_id_v2 = str(uuid.uuid5(uuid.NAMESPACE_DNS, _get_machine_id_v2()))
                self.installation_id  = self.installation_id_v2
