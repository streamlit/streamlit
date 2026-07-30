"""Faithful, browser-free reproduction of streamlit/streamlit#12514.

A live Streamlit server keeps a single ``MemoryFragmentStorage`` on the
``AppSession`` across script runs. When a button *inside* fragment ``a`` is
clicked, the server issues a **fragment-scoped rerun**: ``RerunData`` with
``fragment_id_queue=[<a's id>]``. The ScriptRunner then does NOT execute the
whole script; it looks up ``a``'s registered ``wrapped_fragment`` and runs it,
which calls ``b(1)`` / ``b(2)`` inline via the fragment ``wrap``.

``AppTest`` cannot express this: ``AppTest.run()`` always issues a *full* rerun
(``fragment_ids_this_run=None``), so it never exercises the buggy branch in
``fragment.py`` (the snapshot restore guarded by ``if
ctx.fragment_ids_this_run``).

We reproduce it directly with two ``LocalScriptRunner``s that share one
fragment storage + session state:
  1) a full run to register fragments a, b(1), b(2), and
  2) a fragment-scoped rerun of ``a`` (the button click).

Expected pre-fix (#12514): during the fragment rerun the sibling nested
fragments collide on a single fragment id and write to the same delta path, so
one of the markdowns ("1"/"2") is clobbered.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock

from streamlit.runtime import Runtime
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.dataframe_source_manager import DataframeSourceManager
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import RerunData
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.runtime.state.safe_session_state import SafeSessionState
from streamlit.runtime.state.session_state import SessionState
from streamlit.testing.v1.local_script_runner import (
    LocalScriptRunner,
    require_widgets_deltas,
)

A_ID_FILE = "/workspace/work-tmp/a_fragment_id.txt"
SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "repro_app.py")


def _install_mock_runtime() -> None:
    mock_runtime = MagicMock(spec=Runtime)
    mock_runtime.media_file_mgr = MediaFileManager(
        MemoryMediaFileStorage("/mock/media")
    )
    mock_runtime.dataframe_source_mgr = DataframeSourceManager()
    mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
    Runtime._instance = mock_runtime


def _make_runner(
    storage: MemoryFragmentStorage, session_state: SafeSessionState
) -> LocalScriptRunner:
    script_cache = ScriptCache()
    PagesManager.uses_pages_directory = None
    pages_manager = PagesManager(SCRIPT, script_cache, setup_watcher=False)
    runner = LocalScriptRunner(SCRIPT, session_state, pages_manager)
    # Share one fragment storage across runs, exactly like a live AppSession.
    runner._fragment_storage = storage
    return runner


def _describe_markdowns(runner: LocalScriptRunner) -> tuple[list[str], list[str]]:
    """Return (markdown values, "deltapath=value" strings) from the raw queue."""
    from streamlit.testing.v1.element_tree import parse_tree_from_messages

    values: list[str] = []
    for msg in runner.forward_msgs():
        if not msg.HasField("delta"):
            continue
        delta = msg.delta
        if delta.WhichOneof("type") == "new_element":
            elt = delta.new_element
            if elt.WhichOneof("type") == "markdown":
                dp = list(msg.metadata.delta_path)
                values.append(f"{dp}={elt.markdown.body}")
    tree = parse_tree_from_messages(runner.forward_msgs())
    return [md.value for md in tree.markdown], values


def main() -> int:
    _install_mock_runtime()
    storage = MemoryFragmentStorage()
    session_state = SafeSessionState(SessionState(), lambda: None)

    # --- 1) Initial full run: registers fragments a, b(1), b(2). ---
    if os.path.exists(A_ID_FILE):
        os.remove(A_ID_FILE)
    runner1 = _make_runner(storage, session_state)
    runner1.run(timeout=30)
    initial_tree, initial_raw = _describe_markdowns(runner1)
    print("INITIAL markdown tree values:", initial_tree)
    print("INITIAL markdown deltas:", initial_raw)
    runner1.request_stop()
    runner1.join()

    with open(A_ID_FILE) as f:
        a_id = f.read().strip()
    print("parent fragment `a` id:", a_id)
    print("registered fragment ids:", list(storage._fragments.keys()))

    # --- 2) Fragment-scoped rerun of `a` (simulated button click). ---
    runner2 = _make_runner(storage, session_state)
    runner2.request_rerun(RerunData(fragment_id_queue=[a_id]))
    runner2.start()
    require_widgets_deltas(runner2, timeout=30)
    after_tree, after_raw = _describe_markdowns(runner2)
    print("AFTER-rerun markdown tree values:", after_tree)
    print("AFTER-rerun markdown deltas:", after_raw)
    runner2.request_stop()
    runner2.join()

    Runtime._instance = None

    had_both = {"1", "2"}.issubset(set(initial_tree))
    still_both = {"1", "2"}.issubset(set(after_tree))
    # Also detect the delta-path collision directly.
    after_paths = [d.split("=")[0] for d in after_raw]
    collision = len(after_paths) != len(set(after_paths))

    bug_present = had_both and (not still_both or collision)

    print("---")
    print("initial had both 1 and 2:", had_both)
    print("after has both 1 and 2 (in tree):", still_both)
    print("sibling markdowns share a delta path (collision):", collision)
    print("BUG_PRESENT:", bug_present)
    return 0 if bug_present else 1


if __name__ == "__main__":
    sys.exit(main())
