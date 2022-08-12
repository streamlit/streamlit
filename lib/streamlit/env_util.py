import os
import platform
import re
import sys


_system = platform.system()
IS_WINDOWS = _system == "Windows"
IS_DARWIN = _system == "Darwin"
IS_LINUX_OR_BSD = (_system == "Linux") or ("BSD" in _system)


def is_pex():
    """Return if streamlit running in pex.

    Pex modifies sys.path so the pex file is the first path and that's
    how we determine we're running in the pex file.
    """
    if re.match(r".*pex$", sys.path[0]):
        return True
    return False


def is_repl():
    """Return True if running in the Python REPL."""
    import inspect

    root_frame = inspect.stack()[-1]
    filename = root_frame[1]  # 1 is the filename field in this tuple.

    if filename.endswith(os.path.join("bin", "ipython")):
        return True

    # <stdin> is what the basic Python REPL calls the root frame's
    # filename, and <string> is what iPython sometimes calls it.
    if filename in ("<stdin>", "<string>"):
        return True

    return False


def is_executable_in_path(name):
    """Check if executable is in OS path."""
    from distutils.spawn import find_executable

    return find_executable(name) is not None
