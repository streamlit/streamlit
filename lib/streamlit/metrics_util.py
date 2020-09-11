import os
import platform
import subprocess
import uuid as _uuid

from streamlit import file_util

def get_machine_id_v1():
    """TODO"""
    if (
        platform.system() == "Linux"
        and os.path.isfile("/etc/machine-id") == False
        and os.path.isfile("/var/lib/dbus/machine-id") == False
    ):
        print("Generate machine-id")
        subprocess.run(["sudo", "dbus-uuidgen", "--ensure"])

    machine_id = str(_uuid.getnode())
    if os.path.isfile("/etc/machine-id"):
        with open("/etc/machine-id", "r") as f:
            machine_id = f.read()

    elif os.path.isfile("/var/lib/dbus/machine-id"):
        with open("/var/lib/dbus/machine-id", "r") as f:
            machine_id = f.read()

    return machine_id

def get_machine_id_v2():
    """TODO"""
    filepath = file_util.get_streamlit_file_path(".stable_random_id")
    stable_id = None

    if os.path.exists(filepath):
        with file_util.streamlit_read(filepath) as input:
            stable_id = input.read()
    
    if not stable_id:
        stable_id = str(_uuid.uuid4())
        with file_util.streamlit_write(filepath) as output:
            output.write(stable_id)

    return stable_id
