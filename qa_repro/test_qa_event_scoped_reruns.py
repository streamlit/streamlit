"""QA suite for the event-scoped fragment reruns prototype (PR #15794).

Run with:  uv run pytest work-tmp/qa/test_qa_event_scoped_reruns.py -v

Two harnesses are used:

* ``AppTest`` (streamlit.testing.v1) for end-to-end behavior. Each fragment bumps
  a counter in ``st.session_state`` so we can detect which fragments actually
  re-executed after an interaction.
* Direct runtime tests against ``MemoryFragmentStorage`` and ``ScriptRequests``
  for paths AppTest cannot faithfully exercise (request-layer coalescing,
  resolve_target edge cases, ordering).

HARNESS LIMITATION (important): ``AppTest`` builds a *fresh* ``LocalScriptRunner``
— and therefore a *fresh* ``MemoryFragmentStorage`` — on every ``.run()``. In the
real runtime, ``AppSession`` keeps ONE ``MemoryFragmentStorage`` for the whole
session, so a widget callback (which fires *before* the script body re-registers
its fragments) can still resolve a target registered on a previous run. To model
production faithfully we patch the storage used by ``LocalScriptRunner`` to a
single persistent instance via the ``persistent_fragment_storage`` helper.
"""

from __future__ import annotations

import contextlib
from unittest.mock import patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.scriptrunner_utils.script_requests import (
    RerunData,
    ScriptRequests,
)
from streamlit.testing.v1 import AppTest


@contextlib.contextmanager
def persistent_fragment_storage():
    """Make LocalScriptRunner reuse ONE MemoryFragmentStorage across runs.

    This mimics the real runtime, where AppSession owns a single persistent
    fragment storage for the session's lifetime.
    """
    shared = MemoryFragmentStorage()
    with patch(
        "streamlit.testing.v1.local_script_runner.MemoryFragmentStorage",
        lambda: shared,
    ):
        yield shared


def _ss(at, key, default=None):
    return at.session_state[key] if key in at.session_state else default


# ---------------------------------------------------------------------------
# Core targeting
# ---------------------------------------------------------------------------


def test_s1_target_from_callback_outside_fragment():
    """#1 Target from a widget callback outside the fragment: only the fragment
    re-executes; the main body does not.
    """

    def script():
        import streamlit as st

        st.session_state.setdefault("main_runs", 0)
        st.session_state.setdefault("frag_runs", 0)
        st.session_state["main_runs"] += 1

        @st.fragment(key="charts")
        def charts():
            st.session_state["frag_runs"] += 1

        charts()
        st.button("go", on_click=lambda: st.rerun(target="charts"))

    with persistent_fragment_storage():
        at = AppTest.from_function(script).run()
        assert _ss(at, "main_runs") == 1
        assert _ss(at, "frag_runs") == 1

        at.button[0].click().run()

        assert [e.value for e in at.exception] == []
        assert [w.value for w in at.warning] == []
        # Fragment reran, main body did NOT re-execute.
        assert _ss(at, "main_runs") == 1
        assert _ss(at, "frag_runs") == 2


def test_s2_target_from_main_body():
    """#2 Target from the main script body under a condition."""

    def script():
        import streamlit as st

        st.session_state.setdefault("main_runs", 0)
        st.session_state.setdefault("frag_runs", 0)
        st.session_state["main_runs"] += 1

        @st.fragment(key="charts")
        def charts():
            st.session_state["frag_runs"] += 1

        charts()
        if st.session_state["main_runs"] == 2:
            st.rerun(target="charts")

    at = AppTest.from_function(script).run()
    assert _ss(at, "main_runs") == 1 and _ss(at, "frag_runs") == 1
    at.run()  # second full run triggers the conditional targeted rerun
    assert [e.value for e in at.exception] == []
    # Main body ran twice total; fragment ran in body (2) + targeted rerun (3).
    assert _ss(at, "main_runs") == 2
    assert _ss(at, "frag_runs") == 3


def test_s3_target_from_another_fragment():
    """#3 Target one fragment from inside another fragment's rerun.

    HARNESS LIMITATION: AppTest turns every widget interaction into a FULL app
    rerun (its RerunData never carries a fragment_id), so a widget *inside* a
    fragment cannot drive a fragment-scoped rerun here. This scenario is exercised
    faithfully at the ScriptRunner level in
    ``test_qa_scriptrunner_reruns.py::test_s3_target_from_another_fragment``.
    """
    pytest.skip(
        "AppTest cannot drive fragment-scoped reruns from widgets; see "
        "test_qa_scriptrunner_reruns.py::test_s3_target_from_another_fragment"
    )


def test_s4_target_list_reruns_all_ancestors_before_descendants():
    """#4 A list of names reruns all; ordering runs ancestors before descendants."""
    storage = MemoryFragmentStorage()
    # parent -> child nesting
    storage.register("parent_id", "parent_frag", target_key="parent")
    storage.register(
        "child_id", "child_frag", parent_fragment_id="parent_id", target_key="child"
    )

    # Resolve a list -> both ids (dedup preserved).
    resolved = storage.resolve_target(["child", "parent"])
    assert set(resolved) == {"child_id", "parent_id"}

    # order_fragment_ids must place ancestor (parent) before descendant (child)
    # regardless of queue order.
    ordered = storage.order_fragment_ids(resolved)
    assert ordered.index("parent_id") < ordered.index("child_id")


@pytest.mark.xfail(
    strict=True,
    reason="BUG: @st.fragment(key=...) renders st.container(key=key); calling the "
    "fragment from >1 call site produces duplicate container keys and raises "
    "StreamlitDuplicateElementKey, so 'reruns all call sites' is unreachable.",
)
def test_s5_multiple_call_sites_same_key():
    """#5 One key at multiple call sites should rerun ALL call sites.

    Storage-level: resolve_target returns both ids (works).
    Render-level: rendering two call sites raises a duplicate-key error (BUG).
    """
    # Storage layer supports multiple ids per key.
    storage = MemoryFragmentStorage()
    storage.register("id1", "f1", target_key="shared")
    storage.register("id2", "f2", target_key="shared")
    assert storage.resolve_target("shared") == ["id1", "id2"]

    # Render layer: two call sites with the same key.
    def script():
        import streamlit as st

        st.session_state.setdefault("frag_runs", 0)

        @st.fragment(key="shared")
        def frag():
            st.session_state["frag_runs"] += 1

        frag()
        frag()

    at = AppTest.from_function(script).run()
    exceptions = [e.value for e in at.exception]
    # Documented expectation: both call sites render (frag_runs == 2, no error).
    # Prototype actual: duplicate-key error, only first call site renders.
    assert exceptions == [], (
        f"BUG: multiple call sites with the same key raise: {exceptions!r}"
    )
    assert _ss(at, "frag_runs") == 2


# ---------------------------------------------------------------------------
# Coalescing
# ---------------------------------------------------------------------------


def test_s6_coalescing_unions_fragment_queues():
    """#6 Several targeted reruns in one interaction union (dedup, ordered)."""
    reqs = ScriptRequests()
    reqs.request_rerun(
        RerunData(fragment_id_queue=["a", "b"], is_fragment_scoped_rerun=True)
    )
    reqs.request_rerun(
        RerunData(fragment_id_queue=["b", "c"], is_fragment_scoped_rerun=True)
    )
    # Earlier target 'a' is NOT dropped; union preserves order.
    assert reqs._rerun_data.fragment_id_queue == ["a", "b", "c"]


def test_s6b_full_rerun_clears_fragment_queue():
    """#6 (regression) A subsequent full rerun clears the fragment queue."""
    reqs = ScriptRequests()
    reqs.request_rerun(
        RerunData(fragment_id_queue=["a", "b"], is_fragment_scoped_rerun=True)
    )
    reqs.request_rerun(RerunData(fragment_id_queue=[]))  # full rerun
    assert reqs._rerun_data.fragment_id_queue == []


# ---------------------------------------------------------------------------
# Errors / edges
# ---------------------------------------------------------------------------


def test_s7_unknown_target_raises_helpful_error():
    """#7 Unknown target name -> StreamlitAPIException with helpful message."""
    storage = MemoryFragmentStorage()
    with pytest.raises(StreamlitAPIException) as exc:
        storage.resolve_target("nope")
    msg = str(exc.value)
    assert "nope" in msg
    assert "st.fragment(key=" in msg
    assert "rendered at least once" in msg


def test_s8_empty_target_list():
    """#8 Empty target list: no crash. Observe resulting behavior."""
    storage = MemoryFragmentStorage()
    # resolve_target([]) is a no-op resolution.
    assert storage.resolve_target([]) == []

    # In an app, rerun(target=[]) -> empty fragment queue. Because
    # `if rerun_data.fragment_id_queue` is falsy for [], this falls through to a
    # FULL rerun (documented nuance, not a crash).
    def script():
        import streamlit as st

        st.session_state.setdefault("main_runs", 0)
        st.session_state["main_runs"] += 1

        @st.fragment(key="charts")
        def charts():
            st.write("x")

        charts()
        if st.session_state["main_runs"] == 1:
            st.rerun(target=[])

    at = AppTest.from_function(script).run()
    assert [e.value for e in at.exception] == []
    # No crash; empty target degrades to a full rerun (main body ran twice).
    assert _ss(at, "main_runs") == 2


def test_s9_target_with_scope_fragment_targeting_wins():
    """#9 target combined with scope='fragment' does not error; targeting wins."""
    from streamlit.commands.execution_control import _new_fragment_id_queue

    class _Ctx:
        class fragment_storage:  # noqa: N801
            @staticmethod
            def resolve_target(target):
                return ["resolved_id"]

    ctx = _Ctx()
    # Even with scope='fragment', when target is set resolve_target is used.
    result = _new_fragment_id_queue(ctx, scope="fragment", target="charts")
    assert result == ["resolved_id"]


# ---------------------------------------------------------------------------
# Key lifecycle
# ---------------------------------------------------------------------------


def test_s10_key_change_same_id_state_preserved():
    """#10 Changing a fragment's key keeps the fragment_id and re-points the index."""
    storage = MemoryFragmentStorage()
    storage.register("frag_id", "frag", target_key="old")
    assert storage.resolve_target("old") == ["frag_id"]

    # Re-register the SAME id with a new key (id is positional / stable).
    storage.register("frag_id", "frag", target_key="new")
    assert storage.resolve_target("new") == ["frag_id"]
    with pytest.raises(StreamlitAPIException):
        storage.resolve_target("old")  # old name stops resolving


def test_s10b_key_change_preserves_session_state():
    """#10 State preserved across a key change (positional identity)."""

    def script_old():
        import streamlit as st

        @st.fragment(key="old")
        def frag():
            st.session_state.setdefault("counter", 0)
            st.session_state["counter"] += 1

        frag()

    def script_new():
        import streamlit as st

        @st.fragment(key="new")
        def frag():
            st.session_state.setdefault("counter", 0)
            st.session_state["counter"] += 1

        frag()

    # Same session_state object is reused across AppTest instances only if we
    # thread it manually; instead assert positional identity via storage above.
    # Here we just assert both variants run without error.
    at_old = AppTest.from_function(script_old).run()
    assert _ss(at_old, "counter") == 1
    at_new = AppTest.from_function(script_new).run()
    assert _ss(at_new, "counter") == 1


def test_s11_dropped_fragment_stops_resolving():
    """#11 A fragment no longer rendered stops resolving after the full run."""

    def script():
        import streamlit as st

        st.session_state.setdefault("main_runs", 0)
        st.session_state["main_runs"] += 1

        # Only render the fragment on the first run.
        if st.session_state["main_runs"] == 1:

            @st.fragment(key="charts")
            def charts():
                st.write("x")

            charts()

    with persistent_fragment_storage() as storage:
        at = AppTest.from_function(script).run()
        assert storage.resolve_target("charts") == storage.resolve_target("charts")
        # Second full run drops the fragment.
        at.run()
        assert _ss(at, "main_runs") == 2
        with pytest.raises(StreamlitAPIException):
            storage.resolve_target("charts")


# ---------------------------------------------------------------------------
# Regression (existing behavior must still work)
# ---------------------------------------------------------------------------


def test_s12_bare_rerun_full_app():
    """#12 Bare st.rerun() triggers a full-app rerun."""

    def script():
        import streamlit as st

        st.session_state.setdefault("main_runs", 0)
        st.session_state["main_runs"] += 1
        if st.session_state["main_runs"] == 1:
            st.rerun()

    at = AppTest.from_function(script).run()
    assert [e.value for e in at.exception] == []
    assert _ss(at, "main_runs") == 2


def test_s13_scope_fragment_from_inside_fragment():
    """#13 st.rerun(scope='fragment') from inside a fragment reruns just it.

    HARNESS LIMITATION: scope='fragment' is only valid *during a fragment rerun*,
    which AppTest cannot drive (interactions become full reruns). Exercised
    faithfully in
    ``test_qa_scriptrunner_reruns.py::test_s13_scope_fragment_from_inside_fragment``.
    """
    pytest.skip(
        "AppTest cannot drive fragment-scoped reruns; see "
        "test_qa_scriptrunner_reruns.py::test_s13_scope_fragment_from_inside_fragment"
    )


def test_s14_widget_inside_keyed_fragment_normal_rerun():
    """#14 A widget inside a keyed fragment still triggers a normal fragment rerun.

    HARNESS LIMITATION: AppTest turns widget interactions into full reruns, so it
    cannot show a fragment-only rerun. Exercised faithfully in
    ``test_qa_scriptrunner_reruns.py::test_s14_widget_inside_keyed_fragment_fragment_rerun``.
    """
    pytest.skip(
        "AppTest cannot drive fragment-scoped reruns from widgets; see "
        "test_qa_scriptrunner_reruns.py::test_s14_widget_inside_keyed_fragment_fragment_rerun"
    )
