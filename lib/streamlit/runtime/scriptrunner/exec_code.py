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

import sys
from typing import TYPE_CHECKING, Any, Literal

from streamlit import util
from streamlit.delta_generator_singletons import (
    context_dg_stack,
    get_default_dg_stack_value,
)
from streamlit.error_util import handle_uncaught_app_exception
from streamlit.errors import FragmentHandledException
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)

if TYPE_CHECKING:
    from collections.abc import Callable
    from types import TracebackType

    from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
    from streamlit.runtime.scriptrunner_utils.script_run_context import ScriptRunContext


class modified_sys_path:  # noqa: N801
    """A context for prepending a directory to sys.path for a second.

    Code inspired by IPython:
    Source: https://github.com/ipython/ipython/blob/master/IPython/utils/syspathcontext.py#L42
    """

    def __init__(self, main_script_path: str) -> None:
        self._main_script_path = main_script_path
        self._added_path = False

    def __repr__(self) -> str:
        return util.repr_(self)

    def __enter__(self) -> None:
        if self._main_script_path not in sys.path:
            sys.path.insert(0, self._main_script_path)
            self._added_path = True

    def __exit__(
        self,
        typ: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        if self._added_path:
            try:
                sys.path.remove(self._main_script_path)
            except ValueError:
                # It's already removed.
                pass

        # Returning False causes any exceptions to be re-raised.
        return False


def exec_func_with_error_handling(
    func: Callable[[], Any], ctx: ScriptRunContext
) -> tuple[
    Any | None,
    bool,
    RerunData | None,
    bool,
    Exception | None,
]:
    """Execute the passed function wrapped in a try/except block.

    This function is called by the script runner to execute the user's script or
    fragment reruns, but also for the execution of fragment code in context of a normal
    app run. This wrapper ensures that handle_uncaught_exception messages show up in the
    correct context.

    Parameters
    ----------
    func : callable
        The function to execute wrapped in the try/except block.
    ctx : ScriptRunContext
        The context in which the script is being run.

    Returns
    -------
    tuple
        A tuple containing:
        - The result of the passed function.
        - A boolean indicating whether the script ran without errors (RerunException and
            StopException don't count as errors).
        - The RerunData instance belonging to a RerunException if the script was
            interrupted by a RerunException.
        - A boolean indicating whether the script was stopped prematurely (False for
            RerunExceptions, True for all other exceptions).
        - The uncaught exception if one occurred, None otherwise
    """
    run_without_errors = True

    # This will be set to a RerunData instance if our execution
    # is interrupted by a RerunException.
    rerun_exception_data: RerunData | None = None

    # If the script stops early, we don't want to remove unseen widgets,
    # so we track this to potentially skip session state cleanup later.
    premature_stop: bool = False

    # The result of the passed function
    result: Any | None = None

    # The uncaught exception if one occurred, None otherwise
    uncaught_exception: Exception | None = None

    try:
        result = func()
    except RerunException as e:
        rerun_exception_data = e.rerun_data

        # Since the script is about to rerun, we may need to reset our cursors/dg_stack
        # so that we write to the right place in the app. For full script runs, this
        # needs to happen in case the same thread reruns our script (a different thread
        # would automatically come with fresh cursors/dg_stack values). For fragments,
        # it doesn't matter either way since the fragment resets these values from its
        # snapshot before execution.
        ctx.cursors.clear()
        context_dg_stack.set(get_default_dg_stack_value())

        # Interruption due to a rerun is usually from `st.rerun()`, which
        # we want to count as a script completion so triggers reset.
        # It is also possible for this to happen if fast reruns is off,
        # but this is very rare.
        premature_stop = False

    except StopException:
        # This is thrown when the script executes `st.stop()`.
        # We don't have to do anything here.
        premature_stop = True
    except FragmentHandledException:
        run_without_errors = False
        premature_stop = True
    except Exception as ex:
        run_without_errors = False
        premature_stop = True
        handle_uncaught_app_exception(ex)
        uncaught_exception = ex

    return (
        result,
        run_without_errors,
        rerun_exception_data,
        premature_stop,
        uncaught_exception,
    )
