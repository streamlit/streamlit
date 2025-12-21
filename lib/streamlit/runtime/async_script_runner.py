
from __future__ import annotations

import asyncio
import sys
import types
import threading
from timeit import default_timer as timer
import textwrap

from streamlit.runtime.scriptrunner.script_runner import ScriptRunner, ScriptRunnerEvent, _log_if_error, _clean_problem_modules
from streamlit.logger import get_logger
from streamlit.runtime.scriptrunner.exec_code import (
    exec_func_with_error_handling,
    modified_sys_path,
)
from streamlit import config, runtime, util
from streamlit.runtime.pages_manager import PagesManager
from streamlit.errors import FragmentStorageKeyError
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import (
    create_page_profile_message,
    to_microseconds,
)
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.runtime.scriptrunner_utils.script_requests import ScriptRequestType
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)

_LOGGER = get_logger(__name__)

class AsyncScriptRunner(ScriptRunner):
    """Experimental ScriptRunner that supports asyncio top-level execution."""

    def _run_script(self, rerun_data):
        if not self._is_in_script_thread():
            raise RuntimeError(
                "ScriptRunner._run_script must be called from the script thread."
            )

        while True:
            _LOGGER.debug("Running script %s (Async)", rerun_data)
            start_time = timer()
            prep_time = 0

            if not rerun_data.fragment_id_queue:
                runtime.get_instance().media_file_mgr.clear_session_refs()

            self._pages_manager.set_script_intent(
                rerun_data.page_script_hash, rerun_data.page_name
            )
            active_script = self._pages_manager.get_initial_active_script(
                rerun_data.page_script_hash
            )
            main_page_info = self._pages_manager.get_main_page()

            page_script_hash = (
                active_script["page_script_hash"]
                if active_script is not None
                else main_page_info["page_script_hash"]
            )

            ctx = self._get_script_run_ctx()
            previous_page_script_hash = ctx.page_script_hash
            if previous_page_script_hash != page_script_hash:
                widget_ids = set()
                if (
                    rerun_data.widget_states is not None
                    and rerun_data.widget_states.widgets is not None
                ):
                    widget_ids = {w.id for w in rerun_data.widget_states.widgets}
                self._session_state.on_script_finished(widget_ids)

            fragment_ids_this_run = rerun_data.fragment_id_queue or None

            ctx.reset(
                query_string=rerun_data.query_string,
                page_script_hash=page_script_hash,
                fragment_ids_this_run=fragment_ids_this_run,
                cached_message_hashes=rerun_data.cached_message_hashes,
                context_info=rerun_data.context_info,
            )

            self.on_event.send(
                self,
                event=ScriptRunnerEvent.SCRIPT_STARTED,
                page_script_hash=page_script_hash,
                fragment_ids_this_run=fragment_ids_this_run,
                pages=self._pages_manager.get_pages(),
            )

            try:
                if active_script is not None:
                    script_path = active_script["script_path"]
                else:
                    script_path = main_page_info["script_path"]
                    msg = ForwardMsg()
                    msg.page_not_found.page_name = rerun_data.page_name
                    ctx.enqueue(msg)

                # Get Code - we don't strictly need bytecode if we are reading source,
                # but we call it to ensure script exists and is cached.
                _ = self._script_cache.get_bytecode(script_path)

            except Exception as ex:
                _LOGGER.exception("Script compilation error", exc_info=ex)
                self._session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY] = False
                self.on_event.send(
                    self,
                    event=ScriptRunnerEvent.SCRIPT_STOPPED_WITH_COMPILE_ERROR,
                    exception=ex,
                )
                return

            module = self._new_module("__main__")
            sys.modules["__main__"] = module
            module.__dict__["__file__"] = script_path

            def code_to_exec(
                module=module,
                ctx=ctx,
                rerun_data=rerun_data,
                script_path=script_path
            ) -> None:
                with (
                    modified_sys_path(self._main_script_path),
                    self._set_execing_flag(),
                ):
                    if rerun_data.widget_states is not None:
                        self._session_state.on_script_will_rerun(
                            rerun_data.widget_states
                        )

                    ctx.on_script_start()

                    if rerun_data.fragment_id_queue:
                         # Fallback to sync execution for fragments for now (simplification)
                         # Or we could apply async logic to fragments too if they were async functions.
                         # For prototype, we assume Fragments are standard sync.
                        for fragment_id in rerun_data.fragment_id_queue:
                            try:
                                wrapped_fragment = self._fragment_storage.get(
                                    fragment_id
                                )
                                wrapped_fragment()
                            except FragmentStorageKeyError:
                                if not rerun_data.is_auto_rerun:
                                    _LOGGER.warning(f"Couldn't find fragment {fragment_id}")
                            except (RerunException, StopException):
                                raise
                            except Exception:
                                pass

                    else:
                        if PagesManager.uses_pages_directory:
                            # Fallback to sync MPA v1
                            # _mpa_v1(self._main_script_path)
                            # But wait, we can't import private _mpa_v1 from script_runner easily?
                            # It was defined at module level.
                            from streamlit.runtime.scriptrunner.script_runner import _mpa_v1
                            _mpa_v1(self._main_script_path)
                        else:
                            # ASYNC EXECUTION LOGIC
                            try:
                                with open(script_path, "r", encoding="utf-8") as f:
                                    source = f.read()

                                # Wrap source in async function
                                wrapped_source = "import asyncio\nimport streamlit as st\nasync def __async_main__():\n"
                                wrapped_source += textwrap.indent(source, "    ")

                                # Exec the definition to create the function in the module
                                exec(wrapped_source, module.__dict__)

                                # Run the async function
                                asyncio.run(module.__dict__["__async_main__"]())

                            except Exception as e:
                                raise e

                        self._fragment_storage.clear(
                            new_fragment_ids=ctx.new_fragment_ids
                        )

                    self._session_state.maybe_check_serializable()
                    self._maybe_handle_execution_control_request()

            prep_time = timer() - start_time
            (
                _,
                run_without_errors,
                rerun_exception_data,
                premature_stop,
                uncaught_exception,
            ) = exec_func_with_error_handling(code_to_exec, ctx)

            self._session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY] = run_without_errors

            if rerun_exception_data:
                finished_event = ScriptRunnerEvent.SCRIPT_STOPPED_FOR_RERUN
            elif rerun_data.fragment_id_queue:
                finished_event = ScriptRunnerEvent.FRAGMENT_STOPPED_WITH_SUCCESS
            else:
                finished_event = ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS

            if ctx.gather_usage_stats:
                try:
                    ctx.enqueue(
                        create_page_profile_message(
                            commands=ctx.tracked_commands,
                            exec_time=to_microseconds(timer() - start_time),
                            prep_time=to_microseconds(prep_time),
                            uncaught_exception=(
                                type(uncaught_exception).__name__
                                if uncaught_exception
                                else None
                            ),
                        )
                    )
                except Exception as ex:
                    _LOGGER.debug("Failed to create page profile", exc_info=ex)
            self._on_script_finished(ctx, finished_event, premature_stop)

            _log_if_error(_clean_problem_modules)

            if rerun_exception_data is not None:
                rerun_data = rerun_exception_data
            else:
                break
