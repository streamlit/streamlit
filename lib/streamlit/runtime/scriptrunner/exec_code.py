# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, Any, Callable

from streamlit.error_util import handle_uncaught_app_exception
from streamlit.runtime.scriptrunner.exceptions import RerunException, StopException

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner.script_requests import RerunData
    from streamlit.runtime.scriptrunner.script_run_context import ScriptRunContext


def exec_func_with_error_handling(
    func: Callable[[], None],
    ctx: ScriptRunContext,
    *,
    reraise_rerun_exception: bool = False,
) -> tuple[Any | None, bool, RerunData | None, bool]:
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
    reraise_rerun_exception : bool, default False
        If True, an occuring RerunException will be raised instead of handled. This can
        be used if this function is called outside of the script_run context and we want
        the script_runner to react on the rerun exception.

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
    """

    # Avoid circular imports
    from streamlit.delta_generator import dg_stack, get_default_dg_stack

    run_without_errors = True

    # This will be set to a RerunData instance if our execution
    # is interrupted by a RerunException.
    rerun_exception_data: RerunData | None = None

    # Saving and restoring our original cursors/dg_stack is needed
    # specifically to handle the case where a RerunException is raised while
    # running a fragment. In this case, we need to restore both to their states
    # at the start of the script run to ensure that we write to the correct
    # places in the app during the rerun (without this, ctx.cursors and dg_stack
    # will still be set to the snapshots they were restored from when running
    # the fragment).
    original_cursors = ctx.cursors
    original_dg_stack = dg_stack.get()

    # If the script stops early, we don't want to remove unseen widgets,
    # so we track this to potentially skip session state cleanup later.
    premature_stop: bool = False

    # The result of the passed function
    result: Any | None = None

    try:
        result = func()
    except RerunException as e:
        if reraise_rerun_exception:
            raise e

        rerun_exception_data = e.rerun_data
        if rerun_exception_data.fragment_id_queue:
            # This is a fragment-specific rerun, so we need to restore the stack
            ctx.cursors = original_cursors
            dg_stack.set(original_dg_stack)
        else:
            # If it is a full-app rerun, the stack needs to be refreshed.
            # We should land here when `st.rerun` is called from within a
            # fragment. Since we re-use the same thread, we have to clear the
            # stack or otherwise we might render the main app in the old
            # fragment's dg_stack.
            ctx.cursors.clear()
            dg_stack.set(get_default_dg_stack())
        # Interruption due to a rerun is usually from `st.rerun()`, which
        # we want to count as a script completion so triggers reset.
        # It is also possible for this to happen if fast reruns is off,
        # but this is very rare.
        premature_stop = False

    except StopException:
        # This is thrown when the script executes `st.stop()`.
        # We don't have to do anything here.
        premature_stop = True

    except Exception as ex:
        run_without_errors = False
        uncaught_exception = ex
        handle_uncaught_app_exception(uncaught_exception)
        premature_stop = True

    return result, run_without_errors, rerun_exception_data, premature_stop
