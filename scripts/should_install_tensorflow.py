# Used by our Makefile to check if Python.version <= 3.9
# There are surely better ways to do this, but Make is a beast I can't tame.

import os
import sys
from pathlib import Path

is_docker = Path("/.dockerenv").exists() or "IS_DOCKER" in os.environ
is_m1_mac = (os.uname().sysname, os.uname().machine) == ("Darwin", "arm64")
is_python_39_or_earlier = (sys.version_info.major, sys.version_info.minor) <= (3, 9)

if is_python_39_or_earlier and not is_m1_mac and not is_docker:
    print("true")
else:
    print("false")
