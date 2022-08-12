import tempfile
import shutil
from streamlit import util

# We provide our own context manager for temporary directory that wraps
# tempfile.mkdtemp


class TemporaryDirectory(object):
    """Temporary directory context manager.

    Creates a temporary directory that exists within the context manager scope.
    It returns the path to the created directory.
    Wrapper on top of tempfile.mkdtemp.

    Parameters
    ----------
    suffix : str or None
        Suffix to the filename.
    prefix : str or None
        Prefix to the filename.
    dir : str or None
        Enclosing directory.

    """

    def __init__(self, *args, **kwargs):
        self._args = args
        self._kwargs = kwargs

    def __repr__(self) -> str:
        return util.repr_(self)

    def __enter__(self):
        self._path = tempfile.mkdtemp(*self._args, **self._kwargs)
        return self._path

    def __exit__(self, exc_type, exc_value, exc_traceback):
        shutil.rmtree(self._path)
