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

"""Utility functions to use in our tests."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import TYPE_CHECKING

from streamlit import config
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import ScriptRunContext
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.runtime.state import SafeSessionState, SessionState

# Reexport functions that were moved to main codebase
from streamlit.testing.v1.util import (
    build_mock_config_get_option as build_mock_config_get_option,  # noqa: PLC0414
)
from streamlit.testing.v1.util import (
    patch_config_options as patch_config_options,  # noqa: PLC0414
)

if TYPE_CHECKING:
    from snowflake.snowpark import Session


def create_mock_script_run_ctx() -> ScriptRunContext:
    """Create a ScriptRunContext for use in tests.

    Also initializes FragmentThreadState on the current thread's ContextVar,
    mirroring what reset() does in production. This ensures any code path that
    calls ThreadState.get() will find an initialized binding.
    """
    ThreadState.initialize()
    return ScriptRunContext(
        session_id="mock_session_id",
        _enqueue=lambda msg: None,
        query_string="mock_query_string",
        session_state=SafeSessionState(SessionState(), lambda: None),
        uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
        main_script_path="",
        user_info={"email": "mock@example.com"},
        fragment_storage=MemoryFragmentStorage(),
        pages_manager=PagesManager(""),
    )


def build_mock_config_is_manually_set(overrides_dict):
    orig_is_manually_set = config.is_manually_set

    def mock_config_is_manually_set(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_is_manually_set(name)

    return mock_config_is_manually_set


def normalize_md(txt: str) -> str:
    """Replace newlines *inside paragraphs* with spaces.

    Consecutive lines of text are considered part of the same paragraph
    in Markdown. So this function joins those into a single line to make the
    test robust to changes in text wrapping.

    NOTE: This function doesn't attempt to be 100% grammatically correct
    Markdown! It's just supposed to be "correct enough" for tests to pass. For
    example, when we guard "\n\n" from being converted, we really should be
    guarding for RegEx("\n\n+") instead. But that doesn't matter for our tests.
    """
    # Two newlines in a row should NOT be replaced with a space.
    txt = txt.replace("\n\n", "OMG_NEWLINE")

    # Lists should NOT be replaced with a space.
    txt = txt.replace("\n*", "OMG_STAR")
    txt = txt.replace("\n-", "OMG_HYPHEN")

    # Links broken over two lines should not get an extra space.
    txt = txt.replace("]\n(", "OMG_LINK")

    # Convert all remaining newlines into spaces.
    txt = txt.replace("\n", " ")

    # Restore everything else.
    txt = txt.replace("OMG_NEWLINE", "\n\n")
    txt = txt.replace("OMG_STAR", "\n*")
    txt = txt.replace("OMG_HYPHEN", "\n-")
    txt = txt.replace("OMG_LINK", "](")

    return txt.strip()


@contextmanager
def create_snowpark_session() -> Session:
    from snowflake.snowpark import Session

    session = Session.builder.configs(
        {
            "account": os.environ.get("SNOWFLAKE_ACCOUNT"),
            "user": "test_streamlit",
            "password": os.environ.get("SNOWFLAKE_PASSWORD"),
            "role": "testrole_streamlit",
            "warehouse": "testwh_streamlit",
            "database": "testdb_streamlit",
            "schema": "testschema_streamlit",
        }
    ).create()
    try:
        yield session
    finally:
        session.close()


def create_pep649_function(
    base_func: object, string_annotations: dict[str, str]
) -> object:
    """Create a function with PEP 649-style annotations that raise NameError.

    This helper creates a function with a custom __annotate__ that simulates
    PEP 649 deferred annotation behavior: raises NameError when annotations
    are evaluated in VALUE format (like types imported under TYPE_CHECKING).

    Parameters
    ----------
    base_func
        The base function to copy. Its code, globals, name, defaults, and
        closure will be preserved.
    string_annotations
        A dict mapping parameter/return names to their string representations.
        E.g., {"items": "UndefinedType", "return": "None"}

    Returns
    -------
    object
        A new function with a custom __annotate__ that:
        - Raises NameError("name 'UndefinedType' is not defined") for VALUE format
        - Returns string_annotations for STRING format
        - Returns ForwardRef-wrapped values for FORWARDREF format

    Examples
    --------
    >>> def my_func(items: object) -> None:
    ...     pass
    >>> pep649_func = create_pep649_function(
    ...     my_func, {"items": "UndefinedType", "return": "None"}
    ... )
    >>> import inspect
    >>> inspect.signature(pep649_func)  # Raises NameError
    """
    import types

    from annotationlib import Format, ForwardRef

    def annotate_raises(format: Format) -> dict[str, object]:
        """Annotate function that raises NameError like PEP 649 with undefined types."""
        if format == Format.VALUE:
            raise NameError("name 'UndefinedType' is not defined")
        if format == Format.STRING:
            return string_annotations
        # FORWARDREF format
        return {k: ForwardRef(v) for k, v in string_annotations.items()}

    func = types.FunctionType(
        base_func.__code__,  # type: ignore[union-attr]
        base_func.__globals__,  # type: ignore[union-attr]
        base_func.__name__,  # type: ignore[union-attr]
        base_func.__defaults__,  # type: ignore[union-attr]
        base_func.__closure__,  # type: ignore[union-attr]
    )
    func.__annotate__ = annotate_raises  # type: ignore[attr-defined]
    return func
