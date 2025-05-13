# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

import contextlib
import errno
import io
import os
from pathlib import Path
from typing import IO, TYPE_CHECKING, Any, Final

from streamlit import env_util, errors
from streamlit.string_util import is_binary_string

if TYPE_CHECKING:
    from collections.abc import Generator

# Configuration and credentials are stored inside the ~/.streamlit folder
CONFIG_FOLDER_NAME: Final = ".streamlit"

# If enableStaticServing is enabled, static file served from the ./static folder
APP_STATIC_FOLDER_NAME: Final = "static"


def get_encoded_file_data(
    data: bytes, encoding: str = "auto"
) -> io.StringIO | io.BytesIO:
    """Coerce bytes to a BytesIO or a StringIO.

    Parameters
    ----------
    data : bytes
    encoding : str

    Returns
    -------
    BytesIO or StringIO
        If the file's data is in a well-known textual format (or if the encoding
        parameter is set), return a StringIO. Otherwise, return BytesIO.

    """
    if encoding == "auto":
        # If the file does not look like a pure binary file, assume
        # it's utf-8. It would be great if we could guess it a little
        # more smartly here, but it is what it is!
        data_encoding = None if is_binary_string(data) else "utf-8"
    else:
        data_encoding = encoding

    if data_encoding:
        return io.StringIO(data.decode(data_encoding))

    return io.BytesIO(data)


@contextlib.contextmanager
def streamlit_read(path: str, binary: bool = False) -> Generator[IO[Any], None, None]:
    """Opens a context to read this file relative to the streamlit path.

    For example:

    with streamlit_read('foo.txt') as foo:
        ...

    opens the file `.streamlit/foo.txt`

    path   - the path to write to (within the streamlit directory)
    binary - set to True for binary IO
    """
    filename = get_streamlit_file_path(path)
    if os.stat(filename).st_size == 0:
        raise errors.Error(f'Read zero byte file: "{filename}"')

    mode = "r"
    if binary:
        mode += "b"
    with open(os.path.join(CONFIG_FOLDER_NAME, path), mode) as handle:
        yield handle


@contextlib.contextmanager
def streamlit_write(path: str, binary: bool = False) -> Generator[IO[Any], None, None]:
    """Opens a file for writing within the streamlit path, and
    ensuring that the path exists.

    For example:

        with streamlit_write('foo/bar.txt') as bar:
            ...

    opens the file .streamlit/foo/bar.txt for writing,
    creating any necessary directories along the way.

    path   - the path to write to (within the streamlit directory)
    binary - set to True for binary IO
    """
    mode = "w"
    if binary:
        mode += "b"
    path = get_streamlit_file_path(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, mode) as handle:
            yield handle
    except OSError as e:
        msg = [f"Unable to write file: {os.path.abspath(path)}"]
        if e.errno == errno.EINVAL and env_util.IS_DARWIN:
            msg.append(
                "Python is limited to files below 2GB on OSX. "
                "See https://bugs.python.org/issue24658"
            )
        raise errors.Error("\n".join(msg))


def get_static_dir() -> str:
    """Get the folder where static HTML/JS/CSS files live."""
    dirname = os.path.dirname(os.path.normpath(__file__))
    return os.path.normpath(os.path.join(dirname, "static"))


def get_app_static_dir(main_script_path: str) -> str:
    """Get the folder where app static files live."""
    static_dir = Path(main_script_path).parent / APP_STATIC_FOLDER_NAME
    return os.path.abspath(static_dir)


def get_streamlit_file_path(*filepath: str) -> str:
    """Return the full path to a file in ~/.streamlit.

    This doesn't guarantee that the file (or its directory) exists.
    """
    home = Path.home()
    if home is None:
        raise RuntimeError("No home directory.")

    return str(home / CONFIG_FOLDER_NAME / Path(*filepath))


def get_project_streamlit_file_path(*filepath: str) -> str:
    """Return the full path to a filepath in ${CWD}/.streamlit.

    This doesn't guarantee that the file (or its directory) exists.
    """
    return str(Path.cwd() / CONFIG_FOLDER_NAME / Path(*filepath))


def file_is_in_folder_glob(filepath: str, folderpath_glob: str) -> bool:
    """Test whether a file is in some folder with globbing support.

    Parameters
    ----------
    filepath : str
        A file path.
    folderpath_glob: str
        A path to a folder that may include globbing.

    """
    # Make the glob always end with "/*" so we match files inside subfolders of
    # folderpath_glob.
    if not folderpath_glob.endswith("*"):
        if folderpath_glob.endswith("/"):
            folderpath_glob += "*"
        else:
            folderpath_glob += "/*"

    import fnmatch

    file_dir = os.path.dirname(filepath) + "/"
    return fnmatch.fnmatch(file_dir, folderpath_glob)


def get_directory_size(directory: str) -> int:
    """Return the size of a directory in bytes."""
    total_size = 0
    for dirpath, _, filenames in os.walk(directory):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            total_size += os.path.getsize(fp)
    return total_size


def file_in_pythonpath(filepath: str) -> bool:
    """Test whether a filepath is in the same folder of a path specified in the PYTHONPATH env variable.


    Parameters
    ----------
    filepath : str
        An absolute file path.

    Returns
    -------
    boolean
        True if contained in PYTHONPATH, False otherwise. False if PYTHONPATH is not defined or empty.

    """
    pythonpath = os.environ.get("PYTHONPATH", "")
    if len(pythonpath) == 0:
        return False

    absolute_paths = [os.path.abspath(path) for path in pythonpath.split(os.pathsep)]
    return any(
        file_is_in_folder_glob(os.path.normpath(filepath), path)
        for path in absolute_paths
    )


def normalize_path_join(*args: str) -> str:
    """Return the normalized path of the joined path.

    Parameters
    ----------
    *args : str
        The path components to join.

    Returns
    -------
    str
        The normalized path of the joined path.
    """
    return os.path.normpath(os.path.join(*args))


def get_main_script_directory(main_script: str) -> str:
    """Return the full path to the main script directory.

    Parameters
    ----------
    main_script : str
        The main script path. The path can be an absolute path or a relative
        path.

    Returns
    -------
    str
        The full path to the main script directory.
    """
    main_script_path = normalize_path_join(os.getcwd(), main_script)

    return os.path.dirname(main_script_path)
