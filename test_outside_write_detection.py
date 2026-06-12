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

"""Standalone validation of the ``_is_outside_container_write`` detection logic
proposed in ``specs/2026-06-03-outside-container-writes/tech-spec.md``.

This script exercises the (revised) detection pseudocode and the wrapper
redirect flow against *real* ``DeltaGenerator`` and ``RunningCursor`` objects
from the Streamlit runtime. No Streamlit server is started — the objects are
constructed directly.

Run with::

    python test_outside_write_detection.py

Exits 0 if all scenarios pass, 1 otherwise.

----------------------------------------------------------------------------
FINDINGS
----------------------------------------------------------------------------
All 6 scenarios PASS against the real runtime objects. The key insight the
revised pseudocode gets right (and the earlier buggy version got wrong):

    The ancestor walk must compare ``ancestor._id`` against the WRAPPER DG ids
    (the registry *values*), NOT against the outside-container ids (which form
    part of the registry *keys*).

If the check compared against the outside-container ids instead, Scenario 2
(second write to the same outside container) would incorrectly return False:
the outside container is its own ancestor, so its id would be "found" in the
key set and the write would never be redirected through the wrapper —
reintroducing the stale-cursor bug the spec is designed to fix.
"""

from __future__ import annotations

import sys

from streamlit.cursor import LockedCursor, RunningCursor
from streamlit.delta_generator import DeltaGenerator, _is_inside_fragment_path
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState

MAIN = RootContainer.MAIN


# ---------------------------------------------------------------------------
# Detection logic — adapted from the tech-spec pseudocode to operate on real
# DeltaGenerator objects and a plain dict standing in for
# FragmentStorage._outside_wrappers.
# ---------------------------------------------------------------------------

# Simulated FragmentStorage._outside_wrappers: keyed by (fragment_id, dg._id)
# where dg is the *outside container*; values are the wrapper DeltaGenerators.
_outside_wrappers: dict[tuple[str, str], DeltaGenerator] = {}


def _outside_wrapper_values_for(fragment_id: str) -> list[DeltaGenerator]:
    """Return the wrapper DGs (registry *values*) for the given fragment."""
    return [
        wrapper
        for (frag_id, _outside_id), wrapper in _outside_wrappers.items()
        if frag_id == fragment_id
    ]


def _is_outside_container_write(dg: DeltaGenerator) -> bool:
    """Revised detection logic from the tech spec.

    Returns True if a write to ``dg`` targets a container outside the current
    fragment's delta path and is not already inside one of this fragment's
    wrapper blocks.
    """
    ts = ThreadState.get()
    if not ts.fragment_id or not ts.delta_path:
        return False

    # Root-container DGs (st.sidebar, st._main) are managed by ctx.cursors and
    # must not be wrapped.
    if dg._is_top_level:
        return False

    cursor_path = tuple(dg._cursor.delta_path) if dg._cursor else ()
    if _is_inside_fragment_path(cursor_path, ts.delta_path):
        return False

    # The DG is outside the fragment's delta path, but it may already be inside
    # a wrapper belonging to this fragment. Walk the DG's ancestor chain and
    # compare against the WRAPPER DG ids (registry *values*), NOT the outside
    # container ids (part of the keys). This is the bug the reviewer caught.
    wrapper_dg_ids = {
        wrapper._id for wrapper in _outside_wrapper_values_for(ts.fragment_id)
    }
    for ancestor in dg._ancestors:
        if ancestor._id in wrapper_dg_ids:
            return False  # already inside this fragment's wrapper

    return True


def _get_or_create_outside_wrapper(
    dg: DeltaGenerator, fragment_id: str
) -> DeltaGenerator:
    """Minimal wrapper creation: emit a transparent block on the outside
    container and register it in the wrapper dict.

    Returns a cached wrapper if one already exists for (fragment_id, dg._id).
    """
    key = (fragment_id, dg._id)
    if key in _outside_wrappers:
        return _outside_wrappers[key]

    parent_cursor = dg._cursor
    assert parent_cursor is not None, "outside container must have a cursor"

    # The wrapper block occupies the next slot inside the outside container, so
    # its children's cursor lives one level deeper: parent_path extended by the
    # wrapper's index within the outside container.
    wrapper_index = parent_cursor.index
    wrapper_parent_path = (*parent_cursor.parent_path, wrapper_index)

    # Inherit the cursor type from the outside container (LockedCursor for
    # st.empty(), RunningCursor otherwise) per the spec.
    if parent_cursor.is_locked:
        wrapper_cursor: LockedCursor | RunningCursor = LockedCursor(
            root_container=dg._root_container,
            parent_path=wrapper_parent_path,
            index=0,
        )
    else:
        wrapper_cursor = RunningCursor(
            root_container=dg._root_container,
            parent_path=wrapper_parent_path,
        )

    wrapper = DeltaGenerator(
        root_container=dg._root_container,
        cursor=wrapper_cursor,
        parent=dg,
        block_type="transparent",
    )
    _outside_wrappers[key] = wrapper
    return wrapper


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


def _make_root_main_dg() -> DeltaGenerator:
    """A top-level main DG (st._main): _provided_cursor is None."""
    return DeltaGenerator(root_container=MAIN, cursor=None, parent=None)


def _make_container_dg(
    parent: DeltaGenerator,
    parent_path: tuple[int, ...],
    *,
    index: int = 0,
    locked: bool = False,
) -> DeltaGenerator:
    """A container DG (like st.container()) with a provided cursor.

    The cursor's delta_path is ``[MAIN, *parent_path, index]`` and points at
    where the container's next child element goes.
    """
    if locked:
        cursor: LockedCursor | RunningCursor = LockedCursor(
            root_container=MAIN, parent_path=parent_path, index=index
        )
    else:
        cursor = RunningCursor(root_container=MAIN, parent_path=parent_path)
        cursor._index = index
    return DeltaGenerator(
        root_container=MAIN, cursor=cursor, parent=parent, block_type="vertical"
    )


_results: list[tuple[str, bool, str]] = []


def _check(name: str, condition: bool, message: str) -> None:
    """Record a PASS/FAIL result without aborting the whole run."""
    _results.append((name, condition, message))
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}")
    if not condition:
        print(f"       {message}")


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------


def run_scenarios() -> None:
    fragment_id = "frag_a"
    # Fragment block lives at delta_path (MAIN, 1) — writes inside the fragment
    # have cursor paths starting with (MAIN, 1).
    fragment_delta_path: tuple[int, ...] = (MAIN, 1)

    ThreadState.initialize(
        fragment_id=fragment_id, delta_path=fragment_delta_path
    )
    _outside_wrappers.clear()

    main_dg = _make_root_main_dg()

    # Outside container created on the main script at index 3 of MAIN. Its
    # child-cursor delta_path is (MAIN, 3, 0) — clearly outside (MAIN, 1).
    outside_dg = _make_container_dg(main_dg, parent_path=(3,), index=0)

    # --- Scenario 1: first write to outside container -> True --------------
    result1 = _is_outside_container_write(outside_dg)
    _check(
        "Scenario 1: first write to outside container -> True",
        result1 is True,
        f"expected True, got {result1!r} "
        f"(cursor_path={tuple(outside_dg._cursor.delta_path)}, "
        f"fragment_path={fragment_delta_path})",
    )

    # --- Scenario 2: second write to same outside container -> True --------
    # Register a wrapper for the outside container, then re-check. The revised
    # logic must still return True because the wrapper DG (a *child* of the
    # outside container) is not an ancestor of the outside container itself.
    wrapper = _get_or_create_outside_wrapper(outside_dg, fragment_id)
    assert (fragment_id, outside_dg._id) in _outside_wrappers, (
        "wrapper should be registered under (fragment_id, outside_dg._id)"
    )
    result2 = _is_outside_container_write(outside_dg)
    _check(
        "Scenario 2: second write to same outside container -> True",
        result2 is True,
        f"expected True, got {result2!r}. The bug: if the ancestor walk "
        f"compared against outside-container ids (registry keys) instead of "
        f"wrapper DG ids (values), outside_dg would be found as its own "
        f"ancestor and this would wrongly return False.",
    )

    # --- Scenario 3: write to DG inside the wrapper -> False ---------------
    # A nested DG whose parent chain includes the wrapper DG.
    nested_in_wrapper = _make_container_dg(
        wrapper,
        parent_path=(*wrapper._cursor.parent_path, wrapper._cursor.index),
        index=0,
    )
    result3 = _is_outside_container_write(nested_in_wrapper)
    _check(
        "Scenario 3: write to DG inside the wrapper -> False",
        result3 is False,
        f"expected False, got {result3!r}. The ancestor walk should find the "
        f"wrapper DG id {wrapper._id} in the nested DG's ancestor chain.",
    )

    # --- Scenario 4: write to main-script nested container -> True ---------
    # inner = outside.container() on the main script: parent is `outside`, NOT
    # the wrapper. Must NOT be treated as wrapped.
    inner = _make_container_dg(
        outside_dg, parent_path=(3, 0), index=0
    )
    result4 = _is_outside_container_write(inner)
    _check(
        "Scenario 4: write to main-script nested container -> True",
        result4 is True,
        f"expected True, got {result4!r}. A pre-existing nested container "
        f"(parent is the outside container, not the wrapper) must not be "
        f"mistaken for a wrapped DG.",
    )

    # --- Scenario 5: write inside fragment's own scope -> False ------------
    # cursor path is a prefix match for the fragment's delta_path.
    inside_fragment = _make_container_dg(
        main_dg, parent_path=(1,), index=0
    )  # delta_path (MAIN, 1, 0) starts with (MAIN, 1)
    assert _is_inside_fragment_path(
        tuple(inside_fragment._cursor.delta_path), fragment_delta_path
    ), "sanity: cursor path should be inside the fragment path"
    result5 = _is_outside_container_write(inside_fragment)
    _check(
        "Scenario 5: write inside fragment's own scope -> False",
        result5 is False,
        f"expected False, got {result5!r} "
        f"(cursor_path={tuple(inside_fragment._cursor.delta_path)}, "
        f"fragment_path={fragment_delta_path})",
    )

    # --- Scenario 6: top-level DG (st.sidebar, st._main) -> False ----------
    top_level = _make_root_main_dg()  # _provided_cursor is None
    assert top_level._is_top_level, "sanity: root main DG must be top-level"
    result6 = _is_outside_container_write(top_level)
    _check(
        "Scenario 6: top-level DG (st.sidebar, st._main) -> False",
        result6 is False,
        f"expected False, got {result6!r}. Top-level DGs must be skipped "
        f"because their cursors are managed by ctx.cursors.",
    )


def main() -> int:
    print("Validating _is_outside_container_write detection logic\n")
    run_scenarios()

    print()
    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"{passed}/{total} scenarios passed")

    if passed != total:
        print("\nFAILURES:")
        for name, ok, message in _results:
            if not ok:
                print(f"  - {name}: {message}")
        return 1
    print("All scenarios passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
