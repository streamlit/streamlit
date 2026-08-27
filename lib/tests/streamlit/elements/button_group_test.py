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

"""button_group unit test."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.button_group import (
    ButtonGroupMixin,
    _MultiSelectButtonGroupSerde,
    _SingleSelectButtonGroupSerde,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitDuplicateElementId,
    StreamlitIncompatibleParametersError,
    StreamlitValueError,
)
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.runtime.state.session_state import get_script_run_ctx
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields

if TYPE_CHECKING:
    from collections.abc import Callable


def _failing_format_func(_: object) -> str:
    """Always raise; used to exercise serde ``format_func`` error paths."""
    raise RuntimeError("format failed")


class TestButtonGroupSerde:
    """Tests for the _SingleSelectButtonGroupSerde and _MultiSelectButtonGroupSerde classes."""

    def test_single_select_serialize(self):
        """Test single-select serialization returns formatted string in list."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize("banana")
        assert res == ["Banana"]

    def test_single_select_serialize_none(self):
        """Test single-select serialization of None returns empty list."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize(None)
        assert res == []

    def test_single_select_deserialize(self):
        """Test single-select deserialization returns original option."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Banana"])
        assert res == "banana"

    def test_single_select_deserialize_with_default(self):
        """Test single-select deserialization with default value."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=2,  # cherry
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(None)
        assert res == "cherry"

    def test_single_select_deserialize_explicit_deselection(self):
        """Test single-select explicit deselection (empty list) returns None, not default.

        When the frontend sends an empty list [], it means the user explicitly
        deselected (clicked the selected button to toggle it off). This should
        return None, not the default value.
        """
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=2,  # cherry is default
            format_func=lambda x: x.capitalize(),
        )
        # Empty list = explicit deselection, should return None (not default)
        res = serde.deserialize([])
        assert res is None

    def test_single_select_deserialize_unknown_value(self):
        """Test single-select deserialization of an unrecognised value returns None.

        When the options mapping doesn't contain the received wire value (e.g.
        a stale formatted string left over from a previous format_func), the
        deserializer must not pass that raw string to session_state or callbacks.
        Without a configured default, the correct fallback is None.
        """
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Unknown"])
        assert res is None

    def test_multi_select_serialize(self):
        """Test multi-select serialization returns list of formatted strings."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize(["apple", "cherry"])
        assert res == ["Apple", "Cherry"]

    def test_multi_select_serialize_empty(self):
        """Test multi-select serialization of empty list returns empty list."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize([])
        assert res == []

    def test_multi_select_deserialize(self):
        """Test multi-select deserialization returns list of original options."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Apple", "Cherry"])
        assert res == ["apple", "cherry"]

    def test_multi_select_deserialize_with_default(self):
        """Test multi-select deserialization with default values."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_indices=[0, 2],  # apple, cherry
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(None)
        assert res == ["apple", "cherry"]

    def test_multi_select_deserialize_unknown_value(self):
        """Test multi-select deserialization with unknown value silently drops it.

        Stale wire values that don't exist in the current options mapping (e.g.
        formatted strings from a previous format_func) must be dropped rather
        than passed through to session_state or callbacks. Known valid values in
        the same list are still resolved correctly.
        """
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Apple", "Unknown"])
        assert res == ["apple"]

    def test_single_select_deserialize_stale_value_session_fallback_beats_default(self):
        """Session-state fallback takes priority over configured default for stale values.

        When the user has selected a non-default option (e.g. "B" while default="A")
        and format_func changes, the serde must return the user's live selection ("B"),
        not the configured default ("A"). Returning the default would cause
        _widget_changed("B", "A") to fire the spurious on_change callback.
        """
        options = ["A", "B"]
        formatted_options = ["manzana", "naranja"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=0,  # default is "A"
            format_func=lambda x: {"A": "manzana", "B": "naranja"}[x],
            session_state_fallback="B",  # user had "B" selected (non-default)
        )
        # Frontend sends stale EN string "orange" (for "B"); should return "B", not "A"
        res = serde.deserialize(["orange"])
        assert res == "B", (
            "Expected session_state_fallback ('B') to take priority over default ('A')"
        )

    def test_multi_select_deserialize_stale_values_are_dropped(self):
        """Stale multi-select wire values are dropped; valid values are resolved.

        When format_func changes dynamically, the frontend may send a mix of
        stale formatted strings from the old mapping and strings that happen to
        match the new mapping. Only the valid ones should survive.
        """
        options = ["A", "B", "C"]
        formatted_options = ["manzana", "naranja", "cereza"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "manzana", "B": "naranja", "C": "cereza"}[x],
        )
        # "apple" is a stale EN string; "naranja" is valid in the ES mapping
        res = serde.deserialize(["apple", "naranja"])
        assert res == ["B"]  # Only the valid ES option is returned

    def test_multi_select_deserialize_partial_stale_restores_full_fallback(self):
        """Partial-stale labels restore the full selection instead of truncating.

        Interdependent pills: one selected option's label changes, another's does
        not. The one resolvable label must not truncate the selection, so the stored
        ["A","B"] is restored rather than ["B"] (which would reach on_change as a
        deselection).
        """
        options = ["A", "B"]
        # This run's mapping: A's label changed ("A (1)" -> "A (5)"); B's is stable.
        formatted_options = ["A (5)", "B (2)"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "A (5)", "B": "B (2)"}[x],
            session_state_fallback=["A", "B"],  # user actually had both selected
        )
        # Wire carries A's stale label but B's current one.
        res = serde.deserialize(["A (1)", "B (2)"])
        assert res == ["A", "B"], (
            "Expected the full session-state selection to be restored, not truncated to ['B']"
        )

    def test_multi_select_deserialize_genuine_deselect_ignores_fallback(self):
        """A genuine deselect is honored even when a session-state fallback exists.

        A deselected option is absent from the wire entirely (not a dropped stale
        label), so no entry is dropped and the fallback must not fire. Otherwise
        deselecting A while B stays selected would spuriously restore ["A","B"].
        """
        options = ["A", "B"]
        formatted_options = ["A (5)", "B (2)"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "A (5)", "B": "B (2)"}[x],
            session_state_fallback=["A", "B"],  # last known selection was both
        )
        # User deselected A; the wire carries only B's current, valid label.
        res = serde.deserialize(["B (2)"])
        assert res == ["B"], (
            "Expected the deselect to be honored, not overridden by fallback"
        )

    def test_multi_select_deserialize_deselect_with_stale_label_never_reselects(self):
        """A deselect is honored and never reselects the removed option, even when
        the remaining label goes stale in the same rerun.

        Regression guard: a dropped-stale entry used to restore the full fallback,
        reselecting the deselected pill. Here one stale wire entry but two unresolved
        candidates (stale_count < len(candidates)) signals a deselect, so the
        fallback is not restored; the opaque stale label can't be attributed to an
        option, so the result is empty. Key property: the deselected A never returns.
        """
        options = ["A", "B"]
        # B's label changed this run ("B (2)" -> "B (7)"); the wire still carries the
        # stale "B (2)", so it cannot be resolved against the current mapping.
        formatted_options = ["A (5)", "B (7)"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "A (5)", "B": "B (7)"}[x],
            session_state_fallback=["A", "B"],  # last known selection was both
        )
        # User deselected A AND B's label went stale: wire carries only B's stale
        # label ("B (2)" from the previous mapping). Nothing resolves, and the
        # fallback is not restored because the wire shrank.
        res = serde.deserialize(["B (2)"])
        assert res == [], (
            "Expected the deselect to be honored with no fallback restore; the "
            f"deselected option must never be reselected (got {res!r})"
        )

    def test_multi_select_deserialize_deselect_with_partial_stale_drops_unresolvable(
        self,
    ):
        """A resolvable survivor is kept while a stale sibling is dropped on deselect.

        Three options were selected; A is deselected, B stays resolvable, C goes
        stale. C's opaque label can't be attributed, so it is dropped rather than
        guessed at (guessing could restore the deselected A). Result: just ["B"].
        """
        options = ["A", "B", "C"]
        # C's label changed this run; A and B are stable.
        formatted_options = ["A (1)", "B (1)", "C (9)"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "A (1)", "B": "B (1)", "C": "C (9)"}[x],
            session_state_fallback=["A", "B", "C"],  # all three were selected
        )
        # User deselected A; B stays (resolvable), C's label went stale.
        # Wire: B's current label + C's stale label.
        res = serde.deserialize(["B (1)", "C (2)"])
        assert res == ["B"], (
            "Expected only the resolvable survivor B, with the deselected A never "
            f"reselected (got {res!r})"
        )

    def test_multi_select_deserialize_add_selection_with_stale_label_keeps_both(self):
        """A newly selected option is kept when another label goes stale in the
        same rerun.

        Regression guard: the previous ``len(ui_value) >= len(fallback)`` heuristic
        restored the full fallback on any drop, discarding a same-rerun addition.
        User has ["A"] and selects B while A's label goes stale; only B resolves.
        One stale entry matches one unresolved candidate (A) - no deselect - so A is
        recovered and B kept, yielding ["A","B"] rather than the stale-only ["A"].
        """
        options = ["A", "B"]
        # A's label changed this run ("A (old)" -> "A (new)"); B's is current.
        formatted_options = ["A (new)", "B (1)"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "A (new)", "B": "B (1)"}[x],
            session_state_fallback=["A"],  # only A was previously selected
        )
        # Wire carries A's stale label ("A (old)") plus B's newly selected label.
        res = serde.deserialize(["A (old)", "B (1)"])
        assert res == ["A", "B"], (
            "Expected the newly selected B to be kept alongside the recovered A, "
            f"not discarded by restoring the stale-only fallback (got {res!r})"
        )

    def test_multi_select_deserialize_all_stale_session_fallback_beats_default(self):
        """Session-state fallback takes priority over configured default for multi-select.

        When the user has ["A","B"] selected (default is only ["A"]) and format_func
        changes so all wire values go stale, the serde must return ["A","B"] (the live
        selection), not ["A"] (the configured default). Returning the default would
        cause _widget_changed(["A","B"], ["A"]) to fire a spurious on_change callback.
        """
        options = ["A", "B", "C"]
        formatted_options = ["manzana", "naranja", "cereza"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "manzana", "B": "naranja", "C": "cereza"}[x],
            default_option_indices=[0],  # default is ["A"]
            session_state_fallback=["A", "B"],  # user had A+B selected
        )
        # Both wire values are stale EN strings; should return ["A","B"], not ["A"]
        res = serde.deserialize(["apple", "orange"])
        assert res == ["A", "B"], (
            "Expected session_state_fallback (['A','B']) to take priority over default (['A'])"
        )

    def test_single_select_deserialize_stale_value_no_default_uses_session_fallback(
        self,
    ):
        """Single-select with a stale value, no default, but an active session-state value.

        When format_func changes and no default is configured, the serde falls back
        to the session_state_fallback value so _widget_changed sees no difference
        and suppresses the spurious on_change callback.
        """
        options = ["A", "B"]
        formatted_options = ["manzana", "naranja"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "manzana", "B": "naranja"}[x],
            session_state_fallback="A",  # user had "A" selected; no default
        )
        # Frontend sends stale EN string "apple"; should resolve to "A" via fallback
        res = serde.deserialize(["apple"])
        assert res == "A"

    def test_multi_select_deserialize_all_stale_values_uses_session_fallback(self):
        """Multi-select with all stale values uses session_state_fallback when no default.

        When format_func changes, all selections go stale, and no default is
        configured, the serde falls back to the last known session-state value so
        that _widget_changed sees no difference and suppresses the spurious callback.
        """
        options = ["A", "B", "C"]
        formatted_options = ["manzana", "naranja", "cereza"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: {"A": "manzana", "B": "naranja", "C": "cereza"}[x],
            session_state_fallback=["A", "B"],  # user had A+B selected; no default
        )
        # Both wire values are stale EN strings; none match the ES mapping
        res = serde.deserialize(["apple", "orange"])
        assert res == ["A", "B"]


def get_command_matrix(
    test_args: list[Any], with_st_feedback: bool = False
) -> list[tuple[Any]]:
    """Return a test matrix for the different button group commands and the
    passed arguments.

    If the test args is a list like [("foo", ("a", "b")), ("bar", ("c", "d"))],
    this function returns following test matrix:
    [
        (st.pills, "foo", ("a", "b")),
        (st.pills, "bar", ("c", "d")),
        (st.segmented_control, "foo", ("a", "b")),
        (st.segmented_control, "bar", ("c", "d")),
        (_interal_button_group, "foo", ("a", "b")),
        (_interal_button_group, "bar", ("c", "d")),
    ]

    The pills, segmented_control, and _internal_button_group are wrapped in a lambda to pass default
    arguments that are not shared between them.
    """
    matrix = []

    commands: list[Callable[..., Any]] = [
        lambda *args, **kwargs: st.pills("label", *args, **kwargs),
        lambda *args, **kwargs: st.segmented_control("label", *args, **kwargs),
        lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
            st._main, *args, **kwargs
        ),
    ]
    if with_st_feedback:
        commands.append(lambda *args, **kwargs: st.feedback(*args, **kwargs))

    for command in commands:
        if command is None:
            continue
        if len(test_args) == 0:
            matrix.append((command,))
            continue

        for args in test_args:
            matrix.append((command, *args))
    return matrix


# TODO: Some tests are very similar to the ones in multi_test.py -> maybe we can refactor them and share even more
class ButtonGroupCommandTests(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            (
                st.pills,
                ("label", ["a", "b", "c"]),
                {"help": "    Test help param"},
                ["a", "b", "c"],
                "content",
                ButtonGroupProto.Style.PILLS,
                True,
            ),
            (
                lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
                    st._main, *args, **kwargs
                ),
                (["a", "b", "c"],),
                None,
                ["a", "b", "c"],
                "content",
                ButtonGroupProto.Style.SEGMENTED_CONTROL,
                False,
            ),
        ]
    )
    def test_proto_population(
        self,
        command: Callable[..., None],
        command_args: tuple[Any, ...],
        command_kwargs: dict[str, Any] | None,
        expected_options: list[str],
        option_field: str,
        style: ButtonGroupProto.Style,
        test_label: bool,
    ):
        if command_kwargs is None:
            command_kwargs = {}
        command(*command_args, **command_kwargs)

        delta = self.get_delta_from_queue().new_element.button_group
        assert [
            getattr(option, option_field) for option in delta.options
        ] == expected_options
        assert delta.default == []
        assert delta.click_mode == ButtonGroupProto.ClickMode.SINGLE_SELECT
        assert delta.disabled is False
        assert delta.form_id == ""
        assert delta.style == style

        if test_label:
            assert delta.label == command_args[0]
            assert delta.help == "Test help param"
        assert (
            delta.label_visibility.value
            is LabelVisibility.LabelVisibilityOptions.VISIBLE
        )

    @parameterized.expand(get_command_matrix([("string_key",), (0,), (None,)]))
    def test_key_types(self, command: Callable[..., None], key: str | int | None):
        """Test that the key argument can be passed as expected."""

        command(["a", "b", "c"], key=key)

        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.id.endswith(f"-{key}")

    @parameterized.expand(
        [
            (st.pills, ("label", ["a", "b", "c"])),
            (st.pills, ("label", ["a", "b", "c"]), {"default": "b"}, "b"),
            (
                lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
                    st._main, *args, **kwargs
                ),
                (["a", "b", "c"],),
                {"default": "b"},
                "b",
            ),
            (
                st.pills,
                ("label", ["a", "b", "c"]),
                {"default": "b", "selection_mode": "multi"},
                ["b"],
            ),
            (
                lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
                    st._main, *args, **kwargs
                ),
                (["a", "b", "c"],),
                {"default": "b", "selection_mode": "multi"},
                ["b"],
            ),
        ]
    )
    def test_default_return_value(
        self,
        command: Callable[..., Any],
        command_args: tuple[Any, ...],
        command_kwargs: dict | None = None,
        expected_default: str | None = None,
    ):
        if command_kwargs is None:
            command_kwargs = {}
        res = command(*command_args, **command_kwargs)
        assert res == expected_default

    @parameterized.expand(
        [
            (st.pills, ("label", ["a", "b", "c"])),
        ]
    )
    def test_disabled(self, command: Callable, command_args: tuple[Any, ...]):
        command(*command_args, disabled=True)

        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.disabled is True

    @parameterized.expand(
        [
            (st.segmented_control),
            (st.pills),
        ]
    )
    def test_includes_label_in_id(self, command: Callable):
        command(label="label 1", options=["a", "b", "c"])

        button_group_1 = self.get_delta_from_queue().new_element.button_group

        command(label="label 2", options=["a", "b", "c"])
        button_group_2 = self.get_delta_from_queue().new_element.button_group

        assert button_group_1.id != button_group_2.id

    def test_omitted_label_leaves_proto_label_unset(self) -> None:
        """Omitted labels stay unset so the frontend collapses them."""
        ButtonGroupMixin._internal_button_group(st._main, ["a", "b", "c"])
        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.label == ""
        assert not delta.HasField("label_visibility")

    def test_omitted_label_invalid_visibility_raises(self) -> None:
        """Omitted labels still validate ``label_visibility``."""
        with pytest.raises(
            StreamlitValueError, match=r"Invalid `label_visibility` value"
        ):
            ButtonGroupMixin._internal_button_group(
                st._main,
                ["a", "b"],
                label_visibility="wrong_value",  # type: ignore[arg-type]
            )

    def test_non_string_label_is_coerced(self) -> None:
        """Non-string labels are coerced without collapsing the proto label."""
        st.pills(123, ["a", "b", "c"])  # type: ignore[arg-type]
        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.label == "123"
        assert delta.HasField("label_visibility")

    @parameterized.expand(
        get_command_matrix(
            [
                ((),),
                ([],),
                (np.array([]),),
                (pd.Series(np.array([])),),
                (set(),),
            ]
        )
    )
    def test_no_options(self, command: Callable[..., None], options: Any):
        """Test that it handles no options."""
        command(options)

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == []
        assert [option.content for option in c.options] == []

    @parameterized.expand(
        get_command_matrix(
            [
                (("m", "f"), ["m", "f"]),
                (["male", "female"], ["male", "female"]),
                (np.array(["m", "f"]), ["m", "f"]),
                (pd.Series(np.array(["male", "female"])), ["male", "female"]),
                (pd.DataFrame({"options": ["male", "female"]}), ["male", "female"]),
                (
                    pd.DataFrame(
                        data=[[1, 4, 7], [2, 5, 8], [3, 6, 9]], columns=["a", "b", "c"]
                    ).columns,
                    ["a", "b", "c"],
                ),
            ]
        )
    )
    def test_various_option_types(
        self,
        command: Callable[..., None],
        options: Any,
        proto_options: list[str],
    ):
        """Test that it supports different types of options."""
        command(options)

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == []
        assert [option.content for option in c.options] == proto_options

    @parameterized.expand(
        get_command_matrix(
            [
                (
                    pd.Series(np.array(["green", "blue", "red", "yellow", "brown"])),
                    ["yellow"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [3],
                ),
                (
                    np.array(["green", "blue", "red", "yellow", "brown"]),
                    ["green", "red"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [0, 2],
                ),
                (
                    ("green", "blue", "red", "yellow", "brown"),
                    ["blue"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [1],
                ),
                (
                    ["green", "blue", "red", "yellow", "brown"],
                    ["brown"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [4],
                ),
                (
                    pd.DataFrame({"col1": ["male", "female"], "col2": ["15", "10"]}),
                    ["male", "female"],
                    ["male", "female"],
                    [0, 1],
                ),
            ]
        )
    )
    def test_various_option_types_with_defaults(
        self,
        command: Callable[..., None],
        options: Any,
        defaults: Any,
        proto_options: list[str],
        expected_defaults: list[int],
    ):
        """Test that it supports different types of options and works with defaults."""
        command(options, default=defaults, selection_mode="multi")

        c = self.get_delta_from_queue().new_element.button_group
        assert [option.content for option in c.options] == proto_options
        assert c.default[:] == expected_defaults

    @parameterized.expand(
        get_command_matrix(
            [
                (("Tea", "Water"), [1, 2]),
                # the lambda returns a generator that needs to be fresh
                # for every test run:
                (lambda: (i for i in ("Tea", "Water")), [1, 2]),
                (np.array(["Coffee", "Tea"]), [0, 1]),
                (pd.Series(np.array(["Coffee", "Tea"])), [0, 1]),
                ("Coffee", [0]),
            ]
        )
    )
    def test_default_types(
        self, command: Callable[..., None], defaults: Any, expected: list[Any]
    ):
        if callable(defaults):
            defaults = defaults()

        command(["Coffee", "Tea", "Water"], default=defaults, selection_mode="multi")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == expected
        assert [option.content for option in c.options] == ["Coffee", "Tea", "Water"]

    @parameterized.expand(
        get_command_matrix([(None, []), ([], []), (["Tea", "Water"], [1, 2])])
    )
    def test_defaults_for_multi(
        self, command: Callable[..., None], defaults: Any, expected: list[Any]
    ):
        """Test that valid default can be passed as expected."""
        command(
            ["Coffee", "Tea", "Water"],
            default=defaults,
            selection_mode="multi",
        )
        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == expected
        assert [option.content for option in c.options] == ["Coffee", "Tea", "Water"]

    @parameterized.expand(
        get_command_matrix([(None, []), ([], []), (["Tea"], [1]), ("Coffee", [0])])
    )
    def test_default_for_singleselect(
        self, command: Callable[..., None], defaults: Any, expected: list[Any]
    ):
        """Test that valid default can be passed as expected and that the default can be
        a list or single value."""
        command(
            ["Coffee", "Tea", "Water"],
            default=defaults,
            selection_mode="single",
        )
        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == expected
        assert [option.content for option in c.options] == ["Coffee", "Tea", "Water"]

    @parameterized.expand(get_command_matrix([]))
    def test_default_for_single_select_must_be_single_value(
        self, command: Callable[..., None]
    ):
        """Test that passing multiple values as default for single select raises an
        exception."""
        with pytest.raises(StreamlitAPIException) as exception:
            command(
                ["Coffee", "Tea", "Water"],
                default=["Coffee", "Tea"],
                selection_mode="single",
            )
        assert (
            str(exception.value)
            == "The default argument to `st.pills` must be a single value when "
            "`selection_mode='single'`."
        )

    @parameterized.expand(
        get_command_matrix(
            [
                (["Tea", "Vodka", None], StreamlitAPIException),
                ([1, 2], StreamlitAPIException),
            ]
        )
    )
    def test_invalid_defaults(
        self, command: Callable[..., None], defaults: list, expected: type[Exception]
    ):
        """Test that invalid default trigger the expected exception."""
        with pytest.raises(expected):
            command(["Coffee", "Tea", "Water"], default=defaults)

    @parameterized.expand(
        get_command_matrix(
            [([":material/thumb_up:", ":material/thumb_down:", "foo", 0],)]
        )
    )
    def test_format_func_is_applied(
        self,
        command: Callable[..., None],
        options: list[str],
    ):
        """Test that format_func is applied to the options; since we add '!' its not a
        valid icon anymore."""
        command(options, format_func=lambda x: f"{x}!")
        c = self.get_delta_from_queue().new_element.button_group
        for index, option in enumerate(options):
            assert c.options[index].content == f"{option}!"

    @parameterized.expand(
        [
            (st.pills, ("label", ["a", "b", "c"])),
        ]
    )
    def test_on_change_is_registered(
        self,
        command: Callable[..., None],
        command_args: tuple[str, ...],
    ):
        command(*command_args, on_change=lambda x: x)

        ctx = get_script_run_ctx()
        assert ctx is not None
        session_state = ctx.session_state._state
        widget_id = session_state.get_widget_states()[0].id
        metadata = session_state._new_widget_state.widget_metadata.get(widget_id)
        assert metadata is not None
        assert metadata.callback is not None

    @parameterized.expand(get_command_matrix([]))
    def test_option_starting_with_icon(self, command: Callable[..., None]):
        command(
            [
                "☕ Coffee",
                "🍵 Tea",
                ":material/zoom_in: Water",
                "Earth",
                ":material/zoom_out:",
            ]
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default == []
        assert [option.content for option in c.options] == [
            "Coffee",
            "Tea",
            "Water",
            "Earth",
            "",
        ]
        assert [option.content_icon for option in c.options] == [
            "☕",
            "🍵",
            ":material/zoom_in:",
            "",
            ":material/zoom_out:",
        ]

    @parameterized.expand(
        get_command_matrix(
            [
                ("no-icon Coffee",),
                ("",),
                (":material/foo: Water",),
                (":material/thumb_up Tea",),
            ]
        )
    )
    def test_invalid_icons_are_not_set_to_content_icon_field(
        self, command: Callable[..., None], option: str
    ):
        command([option])

        proto = self.get_delta_from_queue().new_element.button_group
        for proto_option in proto.options:
            assert proto_option.content_icon == ""
            assert proto_option.content == option

    @parameterized.expand(get_command_matrix([]))
    def test_outside_form(self, command: Callable[..., None]):
        """Test that form id is marshalled correctly outside of a form."""
        command(["a", "b", "c"])

        proto = self.get_delta_from_queue().new_element.button_group
        assert proto.form_id == ""

    @parameterized.expand(get_command_matrix([]))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self, command: Callable[..., None]):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            command(["a", "b", "c"])

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        proto = self.get_delta_from_queue(1).new_element.button_group
        assert proto.form_id == form_proto.form.form_id

    @parameterized.expand(get_command_matrix([]))
    def test_inside_column(self, command: Callable[..., None]):
        """Test that button group commands work correctly inside of a column."""

        col1, _ = st.columns(2)

        with col1:
            command(["bar", "baz"])
        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        proto = self.get_delta_from_queue().new_element.button_group

        assert proto.default == []
        assert [option.content for option in proto.options] == ["bar", "baz"]

    @parameterized.expand(get_command_matrix([]))
    def test_default_string(self, command: Callable[..., None]):
        """Test if works when the default value is not a list."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        command(
            arg_options,
            default="some str",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == [0]
        assert [option.content for option in c.options] == proto_options

    @parameterized.expand(get_command_matrix([]))
    def test_invalid_selection_mode(self, command: Callable[..., None]):
        """Test that passing an invalid selection_mode raises an exception."""
        with pytest.raises(StreamlitValueError) as exception:
            command(["a", "b"], selection_mode="foo")
        assert (
            str(exception.value)
            == "Invalid `selection_mode` value. Supported values: 'single', 'multi'."
        )

    @parameterized.expand(get_command_matrix([]))
    def test_widget_state_changed_via_session_state_for_single_select(
        self, command: Callable[..., Any]
    ):
        st.session_state.command_key = "stars"
        val = command(["thumbs", "stars"], key="command_key")
        assert val == "stars"

    @parameterized.expand(get_command_matrix([]))
    def test_widget_state_changed_via_session_state_for_multi_select(
        self, command: Callable[..., Any]
    ):
        st.session_state.command_key = ["stars"]
        val = command(["thumbs", "stars"], key="command_key", selection_mode="multi")
        assert val == ["stars"]

    @parameterized.expand(get_command_matrix([]))
    def test_button_group_with_width(self, command: Callable[..., None]):
        """Test button group widgets with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                command(["a", "b", "c"], width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.button_group.options[0].content == "a"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    @parameterized.expand(get_command_matrix([]))
    def test_button_group_with_invalid_width(self, command: Callable[..., None]):
        """Test button group widgets with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    command(["a", "b", "c"], width=width_value)

                assert expected_error_message in str(exc.value)

    @parameterized.expand(get_command_matrix([]))
    def test_button_group_default_width(self, command: Callable[..., None]):
        """Test that button group widgets default to content width."""
        command(["a", "b", "c"])

        el = self.get_delta_from_queue().new_element
        assert el.button_group.options[0].content == "a"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    @parameterized.expand(get_command_matrix([]))
    def test_button_group_wrap_default(self, command: Callable[..., None]):
        """By default wrap is left unset (auto) so the frontend can resolve it
        based on the layout."""
        command(["a", "b", "c"])
        proto = self.get_delta_from_queue().new_element.button_group
        assert not proto.HasField("wrap")

    @parameterized.expand(
        [
            (command, wrap_value)
            for (command,) in get_command_matrix([])
            for wrap_value in (True, False)
        ]
    )
    def test_button_group_wrap(self, command: Callable[..., None], wrap_value: bool):
        """The wrap parameter is forwarded to the button group proto."""
        command(["a", "b", "c"], wrap=wrap_value)
        proto = self.get_delta_from_queue().new_element.button_group
        assert proto.wrap is wrap_value

    def test_button_group_wrap_excluded_from_id(self):
        """wrap is layout-only and must not change the element id.

        Two otherwise-identical pills that differ only in wrap collide on the
        same auto-generated id, proving wrap is excluded from id computation and
        so preserves widget state when toggled.
        """
        st.pills("same label", ["a", "b", "c"])
        with pytest.raises(StreamlitDuplicateElementId):
            st.pills("same label", ["a", "b", "c"], wrap=False)

    def test_invalid_style(self):
        """Test internal button_group command does not accept invalid style."""

        with pytest.raises(StreamlitValueError) as exception:
            ButtonGroupMixin._internal_button_group(
                st._main, ["a", "b", "c"], style="foo"
            )
        assert (
            str(exception.value)
            == "Invalid `style` value. Supported values: 'pills', 'segmented_control'."
        )

    @parameterized.expand(
        [
            (st.pills, ("label", ["a", "b", "c"]), "pills"),
            (st.segmented_control, ("label", ["a", "b", "c"]), "segmented_control"),
        ]
    )
    def test_duplicate_element_id_error_message(
        self, command: Callable, command_args: tuple[Any, ...], element_name: str
    ):
        with pytest.raises(StreamlitAPIException) as exception:
            # Call two times to trigger the error:
            command(*command_args)
            command(*command_args)

        # Make sure the correct name is used in the error message
        assert element_name in str(exception.value)

    def test_stable_id_with_key_segmented_control(self):
        """Test that the widget ID is stable for segmented_control when a stable key is provided.

        With key_as_main_identity={"click_mode"}, the ID only changes when selection_mode changes.
        Options, format_func, and other params can change without affecting the ID.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.segmented_control(
                label="Label 1",
                key="segmented_control_key",
                help="Help 1",
                disabled=False,
                width="content",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                default="a",
                # These can change without affecting ID (only click_mode matters):
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different params but same key and selection_mode
            st.segmented_control(
                label="Label 2",
                key="segmented_control_key",
                help="Help 2",
                disabled=True,
                width="stretch",
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                default="b",
                # These can change without affecting ID:
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 == id2

    @parameterized.expand(
        [
            # Only selection_mode (click_mode) changes should cause ID changes
            # options and format_func are not in key_as_main_identity for pills/segmented_control
            ("selection_mode", "single", "multi"),
        ]
    )
    def test_whitelisted_stable_key_kwargs_segmented_control(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Test that the widget ID changes for segmented_control when selection_mode changes
        even when the key is provided. Options and format_func changes do NOT cause ID changes.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs: dict[str, object] = {
                "label": "Label",
                "key": "segmented_control_key_1",
                "options": ["a", "b", "c"],
                "selection_mode": "single",
            }

            # Apply first value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value1
            st.segmented_control(**base_kwargs)  # type: ignore[arg-type]
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Apply second value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value2
            st.segmented_control(**base_kwargs)  # type: ignore[arg-type]
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 != id2

    def test_options_change_does_not_change_id_segmented_control(self):
        """Test that changing options does NOT change the widget ID when a key is provided.

        This is the key behavior for dynamic options support - options can change
        without resetting the widget state.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with options ["a", "b"]
            st.segmented_control(
                label="Label",
                key="segmented_control_options_key",
                options=["a", "b"],
                selection_mode="single",
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different options ["x", "y", "z"]
            st.segmented_control(
                label="Label",
                key="segmented_control_options_key",
                options=["x", "y", "z"],
                selection_mode="single",
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id

            # IDs should be the SAME because options is not in key_as_main_identity
            assert id1 == id2

    def test_stable_id_with_key_pills(self):
        """Test that the widget ID is stable for pills when a stable key is provided.

        With key_as_main_identity={"click_mode"}, the ID only changes when selection_mode changes.
        Options, format_func, and other params can change without affecting the ID.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.pills(
                label="Label 1",
                key="pills_key",
                help="Help 1",
                disabled=False,
                width="content",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                default="a",
                # These can change without affecting ID (only click_mode matters):
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different params but same key and selection_mode
            st.pills(
                label="Label 2",
                key="pills_key",
                help="Help 2",
                disabled=True,
                width="stretch",
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                default="b",
                # These can change without affecting ID:
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 == id2

    @parameterized.expand(
        [
            # Only selection_mode (click_mode) changes should cause ID changes
            # options and format_func are not in key_as_main_identity for pills/segmented_control
            ("selection_mode", "single", "multi"),
        ]
    )
    def test_whitelisted_stable_key_kwargs_pills(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Test that the widget ID changes for pills when selection_mode changes even when
        the key is provided. Options and format_func changes do NOT cause ID changes.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs: dict[str, object] = {
                "label": "Label",
                "key": "pills_key_1",
                "options": ["a", "b", "c"],
                "selection_mode": "single",
            }

            # Apply first value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value1
            st.pills(**base_kwargs)  # type: ignore[arg-type]
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Apply second value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value2
            st.pills(**base_kwargs)  # type: ignore[arg-type]
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 != id2

    def test_options_change_does_not_change_id_pills(self):
        """Test that changing options does NOT change the widget ID when a key is provided.

        This is the key behavior for dynamic options support - options can change
        without resetting the widget state.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with options ["a", "b"]
            st.pills(
                label="Label",
                key="pills_options_key",
                options=["a", "b"],
                selection_mode="single",
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different options ["x", "y", "z"]
            st.pills(
                label="Label",
                key="pills_options_key",
                options=["x", "y", "z"],
                selection_mode="single",
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id

            # IDs should be the SAME because options is not in key_as_main_identity
            assert id1 == id2


class TestButtonGroupAppTest:
    """AppTest tests for st.pills and st.segmented_control."""

    def test_pills_with_format_func(self):
        """Test st.pills with format_func works correctly in AppTest.

        This is a regression test for the format_func issue where
        the testing framework would fail on subsequent runs.
        """

        def script():
            import streamlit as st

            st.pills(
                "single pills",
                options=["a", "b", "c"],
                format_func=lambda x: x.upper(),
                key="sp",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # Initial value should be None for single-select
        assert at.button_group("sp").value is None

        # Select a value and run again
        at.button_group("sp").select("a").run()
        assert at.button_group("sp").value == "a"
        assert not at.exception

        # Select a different value - this would fail before the fix
        at.button_group("sp").select("b").run()
        assert at.button_group("sp").value == "b"
        assert not at.exception

    def test_pills_multi_select_with_format_func(self):
        """Test st.pills multi-select with format_func works correctly in AppTest."""

        def script():
            import streamlit as st

            st.pills(
                "multi pills",
                options=[1, 2, 3],
                selection_mode="multi",
                format_func=lambda x: f"Num: {x}",
                key="mp",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # Initial value should be empty list for multi-select
        assert at.button_group("mp").value == []

        # Select multiple values
        at.button_group("mp").select(1).select(2).run()
        assert at.button_group("mp").value == [1, 2]
        assert not at.exception

        # Unselect a value
        at.button_group("mp").unselect(1).run()
        assert at.button_group("mp").value == [2]
        assert not at.exception

    def test_segmented_control_with_format_func(self):
        """Test st.segmented_control with format_func works correctly in AppTest."""

        def script():
            import streamlit as st

            st.segmented_control(
                "segmented",
                options=["x", "y", "z"],
                format_func=lambda x: x.upper(),
                key="sc",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # Initial value should be None
        assert at.button_group("sc").value is None

        # Select a value
        at.button_group("sc").select("x").run()
        assert at.button_group("sc").value == "x"
        assert not at.exception

        # Select a different value - this would fail before the fix
        at.button_group("sc").select("y").run()
        assert at.button_group("sc").value == "y"
        assert not at.exception


class TestDynamicFormatFuncCallback:
    """Integration tests for on_change callback correctness with dynamic format_func.

    Covers GitHub issue #15493: callbacks should receive the original option value,
    not the formatted string, even when format_func changes between reruns.
    """

    def test_callback_not_invoked_after_format_func_change_same_selection(self):
        """on_change must not fire when format_func changes but selection is unchanged.

        When a language switch changes format_func so that the same underlying
        option ("A") is now displayed as "manzana" instead of "apple", the widget
        value hasn't actually changed. The on_change callback must therefore NOT
        be invoked on the rerun that follows the language switch.
        """

        def script():
            import streamlit as st

            lang = st.session_state.get("lang", "en")
            fmt_en = {"A": "apple", "B": "orange"}
            fmt_es = {"A": "manzana", "B": "naranja"}
            fmt = fmt_en if lang == "en" else fmt_es

            if "callback_count" not in st.session_state:
                st.session_state["callback_count"] = 0

            def on_change() -> None:
                st.session_state["callback_count"] += 1
                st.session_state["last_callback_value"] = st.session_state["fruit"]

            st.pills(
                "Fruit",
                ["A", "B"],
                format_func=lambda x: fmt[x],
                default="A",
                key="fruit",
                on_change=on_change,
            )

        # Initial EN run - widget shows "apple" selected, callback never called
        at = AppTest.from_function(script).run()
        assert not at.exception
        assert at.button_group("fruit").value == "A"
        assert at.session_state["callback_count"] == 0

        # Switch language to ES without changing the selection
        at.session_state["lang"] = "es"
        at = at.run()
        assert not at.exception

        # The on_change callback must not have fired - only the format changed
        assert at.session_state["callback_count"] == 0, (
            "on_change fired unexpectedly after a format_func change with no "
            f"selection change (callback_count={at.session_state['callback_count']})"
        )
        assert at.button_group("fruit").value == "A"

    def test_callback_invoked_with_original_option_when_user_changes_selection(self):
        """on_change receives the original option value, not the formatted string."""

        def script():
            import streamlit as st

            lang = st.session_state.get("lang", "es")
            fmt_es = {"A": "manzana", "B": "naranja"}
            fmt = fmt_es if lang == "es" else {"A": "apple", "B": "orange"}

            if "last_callback_value" not in st.session_state:
                st.session_state["last_callback_value"] = None

            def on_change() -> None:
                st.session_state["last_callback_value"] = st.session_state["fruit"]

            st.pills(
                "Fruit",
                ["A", "B"],
                format_func=lambda x: fmt[x],
                default="A",
                key="fruit",
                on_change=on_change,
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # User clicks "naranja" (B) - callback should receive "B", not "naranja"
        at.button_group("fruit").select("B").run()
        assert not at.exception
        assert at.session_state["last_callback_value"] == "B"
        assert at.button_group("fruit").value == "B"

    def test_multi_select_callback_not_invoked_after_format_func_change(self):
        """on_change must not fire for multi-select when format_func changes but
        selection is unchanged.

        Regression test for gh-15493 (multi-select path): when a language switch
        changes format_func so ["A", "B"] are now displayed as ["manzana", "naranja"]
        instead of ["apple", "orange"], the widget value is unchanged. The on_change
        callback must NOT fire on the rerun that follows the language switch.
        """

        def script():
            import streamlit as st

            lang = st.session_state.get("lang", "en")
            fmt_en = {"A": "apple", "B": "orange"}
            fmt_es = {"A": "manzana", "B": "naranja"}
            fmt = fmt_en if lang == "en" else fmt_es

            if "callback_count" not in st.session_state:
                st.session_state["callback_count"] = 0

            def on_change() -> None:
                st.session_state["callback_count"] += 1
                st.session_state["last_callback_value"] = st.session_state["fruits"]

            st.pills(
                "Fruits",
                ["A", "B"],
                format_func=lambda x: fmt[x],
                default=["A", "B"],
                selection_mode="multi",
                key="fruits",
                on_change=on_change,
            )

        # Initial EN run - ["A", "B"] selected, callback never called
        at = AppTest.from_function(script).run()
        assert not at.exception
        assert at.session_state["callback_count"] == 0

        # Switch language to ES without changing the selection
        at.session_state["lang"] = "es"
        at = at.run()
        assert not at.exception

        # The on_change callback must not have fired - only the format changed
        assert at.session_state["callback_count"] == 0, (
            "on_change fired unexpectedly after a multi-select format_func change "
            f"with no selection change (callback_count={at.session_state['callback_count']})"
        )

    def test_non_default_selection_callback_not_invoked_after_format_func_change(self):
        """on_change must not fire when format_func changes and a non-default option is selected.

        Regression test for gh-15493: when the user has selected a non-default
        option (e.g. "B" while default="A") and format_func changes dynamically,
        the deserialized value must remain "B" (via session_state_fallback) so
        that _widget_changed("B", "B") suppresses the spurious callback.
        """

        def script():
            import streamlit as st

            lang = st.session_state.get("lang", "en")
            fmt_en = {"A": "apple", "B": "orange"}
            fmt_es = {"A": "manzana", "B": "naranja"}
            fmt = fmt_en if lang == "en" else fmt_es

            if "callback_count" not in st.session_state:
                st.session_state["callback_count"] = 0

            def on_change() -> None:
                st.session_state["callback_count"] += 1

            st.pills(
                "Fruit",
                ["A", "B"],
                format_func=lambda x: fmt[x],
                default="A",
                key="fruit",
                on_change=on_change,
            )

        # Initial EN run — "A" is selected by default, callback_count=0
        at = AppTest.from_function(script).run()
        assert not at.exception
        assert at.button_group("fruit").value == "A"
        assert at.session_state["callback_count"] == 0

        # User selects "B" (non-default) — callback fires once for the real user action
        at.button_group("fruit").select("B").run()
        assert not at.exception
        assert at.button_group("fruit").value == "B"
        assert at.session_state["callback_count"] == 1

        # Switch language to ES — format_func changes, but the selection ("B") is unchanged
        at.session_state["callback_count"] = 0
        at.session_state["lang"] = "es"
        at = at.run()
        assert not at.exception

        # Callback must NOT fire — only the display string changed, not the selected value
        assert at.session_state["callback_count"] == 0, (
            "on_change fired unexpectedly after a format_func change with a "
            f"non-default selection (callback_count={at.session_state['callback_count']})"
        )
        assert at.button_group("fruit").value == "B", (
            "Selection must remain 'B' after format_func change, "
            f"got {at.button_group('fruit').value!r}"
        )

    def test_multi_select_non_default_selection_callback_not_invoked_after_format_func_change(
        self,
    ):
        """on_change must not fire for multi-select when a non-default combo is selected and
        format_func changes.

        When the user has selected ["A","B"] (while default is only ["A"]) and
        format_func changes, session_state_fallback must return ["A","B"] so that
        _widget_changed(["A","B"], ["A","B"]) suppresses the spurious callback.
        """

        def script():
            import streamlit as st

            lang = st.session_state.get("lang", "en")
            fmt_en = {"A": "apple", "B": "orange"}
            fmt_es = {"A": "manzana", "B": "naranja"}
            fmt = fmt_en if lang == "en" else fmt_es

            if "callback_count" not in st.session_state:
                st.session_state["callback_count"] = 0

            def on_change() -> None:
                st.session_state["callback_count"] += 1

            st.pills(
                "Fruits",
                ["A", "B"],
                format_func=lambda x: fmt[x],
                default=["A"],
                selection_mode="multi",
                key="fruits",
                on_change=on_change,
            )

        # Initial EN run — ["A"] selected by default
        at = AppTest.from_function(script).run()
        assert not at.exception
        assert at.session_state["callback_count"] == 0

        # User adds "B" to the selection — callback fires once for the real user action
        at.button_group("fruits").select("B").run()
        assert not at.exception
        assert sorted(at.button_group("fruits").value) == ["A", "B"]
        assert at.session_state["callback_count"] == 1

        # Switch language to ES — format_func changes, selection is still ["A","B"]
        at.session_state["callback_count"] = 0
        at.session_state["lang"] = "es"
        at = at.run()
        assert not at.exception

        # Callback must NOT fire — only the display strings changed, not the selection
        assert at.session_state["callback_count"] == 0, (
            "on_change fired unexpectedly after a multi-select format_func change "
            f"with a non-default selection (callback_count={at.session_state['callback_count']})"
        )
        assert sorted(at.button_group("fruits").value) == ["A", "B"], (
            "Selection must remain ['A','B'] after format_func change, "
            f"got {at.button_group('fruits').value!r}"
        )

    def test_single_select_no_default_callback_not_invoked_after_format_func_change(
        self,
    ):
        """on_change must not fire for single-select with no default when format_func changes.

        Regression test for gh-15493 (no-default path): when the user has manually
        selected an option and format_func changes, the callback must NOT fire even
        though no default was configured.
        """

        def script():
            import streamlit as st

            lang = st.session_state.get("lang", "en")
            fmt_en = {"A": "apple", "B": "orange"}
            fmt_es = {"A": "manzana", "B": "naranja"}
            fmt = fmt_en if lang == "en" else fmt_es

            if "callback_count" not in st.session_state:
                st.session_state["callback_count"] = 0

            def on_change() -> None:
                st.session_state["callback_count"] += 1

            st.pills(
                "Fruit",
                ["A", "B"],
                format_func=lambda x: fmt[x],
                # No default - user must manually select
                key="fruit",
                on_change=on_change,
            )

        # Initial run - nothing selected
        at = AppTest.from_function(script).run()
        assert not at.exception

        # User clicks option "A" in EN mode
        at.button_group("fruit").select("A").run()
        assert not at.exception
        assert (
            at.session_state["callback_count"] == 1
        )  # callback fired for user selection
        assert at.button_group("fruit").value == "A"

        # Reset callback count, then switch language to ES
        at.session_state["callback_count"] = 0
        at.session_state["lang"] = "es"
        at = at.run()
        assert not at.exception

        # The on_change callback must NOT have fired after the format_func change
        assert at.session_state["callback_count"] == 0, (
            "on_change fired unexpectedly after a no-default format_func change "
            f"(callback_count={at.session_state['callback_count']})"
        )
        assert at.button_group("fruit").value == "A"


class TestDynamicFormatFuncVisualSelection:
    """Selected pills stay highlighted when format_func labels change between reruns.

    Regression coverage for gh-16269 (interdependent labels, e.g. a record count
    that shifts when a parent filter clears) and the language-switch path
    previously handled by ``used_session_state_fallback`` (#15522). The frontend
    tracks selection by label, so the backend must resend ``set_value`` with the
    fresh label when it changes, otherwise the pill looks deselected even though
    the return value is unchanged.
    """

    def test_single_select_resends_new_label_when_format_func_output_changes(self):
        """set_value + fresh raw_values are sent when the selected label changes.

        Simulates the issue #16269 flow: a child pill's label embeds a count
        that changes between reruns while the selection ("D") is unchanged.
        """

        def script():
            import streamlit as st

            count = st.session_state.get("count", 2)
            st.pills(
                "Category B",
                ["D", "E"],
                format_func=lambda x: f"{x} ({count})",
                key="catb",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # User selects "D", displayed as "D (2)".
        at.button_group("catb").select("D").run()
        assert not at.exception
        assert at.button_group("catb").value == "D"

        # The count behind the label changes (as when a parent filter clears),
        # without the user touching this widget.
        at.session_state["count"] = 3
        at = at.run()
        assert not at.exception

        catb = at.button_group("catb")
        # The return value is preserved ...
        assert catb.value == "D"
        # ... and the backend re-pushes the fresh label so the pill stays
        # selected instead of silently deselecting.
        assert catb.proto.set_value is True
        assert list(catb.proto.raw_values) == ["D (3)"]

    def test_multi_select_resends_new_labels_when_format_func_output_changes(self):
        """Multi-select resends fresh labels for every still-selected option."""

        def script():
            import streamlit as st

            count = st.session_state.get("count", 2)
            st.pills(
                "Category B",
                ["D", "E", "F"],
                format_func=lambda x: f"{x} ({count})",
                selection_mode="multi",
                key="catb",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        at.button_group("catb").select("D").select("E").run()
        assert not at.exception
        assert at.button_group("catb").value == ["D", "E"]

        at.session_state["count"] = 3
        at = at.run()
        assert not at.exception

        catb = at.button_group("catb")
        assert catb.value == ["D", "E"]
        assert catb.proto.set_value is True
        assert list(catb.proto.raw_values) == ["D (3)", "E (3)"]

    def test_no_set_value_pushed_when_label_unchanged_on_plain_rerun(self):
        """A plain rerun with an unchanged label must not force set_value.

        Anti-regression guard: the label-change detection must not fire on every
        rerun, which would churn the frontend and re-run set_value effects
        needlessly. When nothing changes, set_value stays False.
        """

        def script():
            import streamlit as st

            # Static label - format_func output never changes between runs.
            st.pills(
                "Category B", ["D", "E"], format_func=lambda x: f"{x}!", key="catb"
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        at.button_group("catb").select("D").run()
        assert not at.exception

        # Plain rerun with no interaction and no label change.
        at = at.run()
        assert not at.exception

        catb = at.button_group("catb")
        assert catb.value == "D"
        assert catb.proto.set_value is False
        assert list(catb.proto.raw_values) == []

    def test_multi_select_no_set_value_pushed_when_labels_unchanged(self):
        """Multi-select plain rerun with unchanged labels must not force set_value.

        Locks in the label-ordering assumption: the fresh serialization of the
        still-selected options must match the order the frontend sent, otherwise
        ``labels_changed`` would fire spuriously on every multi-select rerun.
        """

        def script():
            import streamlit as st

            st.pills(
                "Category B",
                ["D", "E", "F"],
                format_func=lambda x: f"{x}!",
                selection_mode="multi",
                key="catb",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        at.button_group("catb").select("D").select("E").run()
        assert not at.exception
        assert at.button_group("catb").value == ["D", "E"]

        # Plain rerun with no interaction and no label change.
        at = at.run()
        assert not at.exception

        catb = at.button_group("catb")
        assert catb.value == ["D", "E"]
        assert catb.proto.set_value is False
        assert list(catb.proto.raw_values) == []

    def test_no_set_value_pushed_for_empty_selection_on_plain_rerun(self):
        """An empty selection must not force set_value on a plain rerun.

        Boundary guard for the deselected case: with nothing selected the stored
        wire labels are empty, so comparing them against the empty fresh
        serialization must leave ``labels_changed`` False.
        """

        def script():
            import streamlit as st

            count = st.session_state.get("count", 2)
            st.pills(
                "Category B",
                ["D", "E"],
                format_func=lambda x: f"{x} ({count})",
                key="catb",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception
        assert at.button_group("catb").value is None

        # Changing the label count while nothing is selected must not push a value.
        at.session_state["count"] = 3
        at = at.run()
        assert not at.exception

        catb = at.button_group("catb")
        assert catb.value is None
        assert catb.proto.set_value is False
        assert list(catb.proto.raw_values) == []


class PillsBindQueryParamsTest(DeltaGeneratorTestCase):
    """Tests for st.pills bind='query-params' functionality."""

    def test_bind_sets_query_param_key(self):
        """Test that bind='query-params' with a key sets query_param_key in proto."""
        st.pills("label", ["a", "b", "c"], key="my_key", bind="query-params")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"

    def test_bind_without_key_raises_exception(self):
        """Test that bind='query-params' without a key raises an exception."""
        with pytest.raises(StreamlitAPIException, match=r"must have a unique 'key'"):
            st.pills("label", ["a", "b", "c"], bind="query-params")

    def test_no_bind_does_not_set_query_param_key(self):
        """Test that without bind, query_param_key is not set."""
        st.pills("label", ["a", "b", "c"], key="my_key")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == ""

    def test_invalid_bind_value_raises_exception(self):
        """Test that an invalid bind value raises StreamlitValueError."""
        with pytest.raises(StreamlitValueError, match=r"Invalid `bind` value"):
            st.pills("label", ["a", "b"], key="my_key", bind="invalid-value")

    def test_bind_with_format_func(self):
        """Test that bind works with format_func."""
        st.pills(
            "label",
            ["cat", "dog"],
            format_func=str.upper,
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"

    def test_bind_multi_mode(self):
        """Test that bind works with selection_mode='multi'."""
        st.pills(
            "label",
            ["a", "b", "c"],
            selection_mode="multi",
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"


class SegmentedControlBindQueryParamsTest(DeltaGeneratorTestCase):
    """Tests for st.segmented_control bind='query-params' functionality."""

    def test_bind_sets_query_param_key(self):
        """Test that bind='query-params' with a key sets query_param_key in proto."""
        st.segmented_control(
            "label", ["a", "b", "c"], key="my_key", bind="query-params"
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"

    def test_bind_without_key_raises_exception(self):
        """Test that bind='query-params' without a key raises an exception."""
        with pytest.raises(StreamlitAPIException, match=r"must have a unique 'key'"):
            st.segmented_control("label", ["a", "b", "c"], bind="query-params")

    def test_no_bind_does_not_set_query_param_key(self):
        """Test that without bind, query_param_key is not set."""
        st.segmented_control("label", ["a", "b", "c"], key="my_key")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == ""

    def test_bind_multi_mode(self):
        """Test that bind works with selection_mode='multi'."""
        st.segmented_control(
            "label",
            ["a", "b", "c"],
            selection_mode="multi",
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"


class RequiredParameterTest(DeltaGeneratorTestCase):
    """Tests for the required parameter on st.pills and st.segmented_control."""

    @parameterized.expand([(st.pills,), (st.segmented_control,)])
    def test_required_default_is_false(self, command: Callable[..., Any]):
        """Test that required defaults to False."""
        command("label", ["a", "b", "c"])

        c = self.get_delta_from_queue().new_element.button_group
        assert c.required is False

    @parameterized.expand(
        [
            (st.pills, True),
            (st.pills, False),
            (st.segmented_control, True),
            (st.segmented_control, False),
        ]
    )
    def test_required_sets_proto_field(
        self, command: Callable[..., Any], required: bool
    ):
        """Test that the required argument sets the proto field correctly."""
        command("label", ["a", "b", "c"], required=required)

        c = self.get_delta_from_queue().new_element.button_group
        assert c.required is required

    @parameterized.expand([(st.pills,), (st.segmented_control,)])
    def test_required_with_default(self, command: Callable[..., Any]):
        """Test that required works with a default value."""
        command("label", ["a", "b", "c"], default="b", required=True)

        c = self.get_delta_from_queue().new_element.button_group
        assert c.required is True
        assert c.default == [1]

    @parameterized.expand([(st.pills,), (st.segmented_control,)])
    def test_required_with_multi_select_raises_exception(
        self, command: Callable[..., Any]
    ):
        """Test that required=True with selection_mode='multi' raises an exception."""
        with pytest.raises(
            StreamlitIncompatibleParametersError,
            match=r"`required` is only supported for single-select mode",
        ):
            command("label", ["a", "b", "c"], selection_mode="multi", required=True)

    @parameterized.expand([(st.pills,), (st.segmented_control,)])
    def test_required_false_with_multi_select_allowed(
        self, command: Callable[..., Any]
    ):
        """Test that required=False with selection_mode='multi' is allowed."""
        command("label", ["a", "b", "c"], selection_mode="multi", required=False)

        c = self.get_delta_from_queue().new_element.button_group
        assert c.required is False


def test_single_serde_serialize_empty_options_with_value() -> None:
    """Return empty list when options are empty but value is not None.

    Covers the early exit in ``_SingleSelectButtonGroupSerde.serialize`` when
    there are no options to map to formatted wire strings.
    """
    serde = _SingleSelectButtonGroupSerde[str](
        [],
        formatted_options=[],
        formatted_option_to_option_index={},
    )
    assert serde.serialize("anything") == []


def test_single_serde_serialize_format_func_exception() -> None:
    """Fall back to ``str(v)`` when ``format_func`` raises for an unmatched value."""
    serde = _SingleSelectButtonGroupSerde[str](
        ["a", "b"],
        formatted_options=["a", "b"],
        formatted_option_to_option_index={"a": 0, "b": 1},
        format_func=_failing_format_func,
    )
    assert serde.serialize("unknown") == ["unknown"]


def test_single_serde_serialize_value_matched_by_format_func() -> None:
    """Return ``[format_func(v)]`` when ``v`` is not matched by equality.

    After direct option comparison fails, a successful ``format_func`` result
    is sent as the single wire string.
    """
    serde = _SingleSelectButtonGroupSerde[int](
        [1, 2],
        formatted_options=["one", "two"],
        formatted_option_to_option_index={"one": 0, "two": 1},
        format_func=lambda x: f"num:{x}",
    )
    assert serde.serialize(99) == ["num:99"]


def test_multi_serde_serialize_none_returns_empty_list() -> None:
    """Serialize ``None`` for multi-select returns an empty list."""
    serde = _MultiSelectButtonGroupSerde[str](
        ["a", "b"],
        formatted_options=["A", "B"],
        formatted_option_to_option_index={"A": 0, "B": 1},
    )
    assert serde.serialize(None) == []


def test_multi_serde_serialize_format_func_exception() -> None:
    """Append ``str(v)`` when ``format_func`` raises for an unmatched value."""
    serde = _MultiSelectButtonGroupSerde[str](
        ["a", "b"],
        formatted_options=["A", "B"],
        formatted_option_to_option_index={"A": 0, "B": 1},
        format_func=_failing_format_func,
    )
    assert serde.serialize(["a", "not-in-options"]) == ["A", "not-in-options"]


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        (["ghost"], ["LABEL:ghost"]),
        (["a", 42], ["A", "LABEL:42"]),
    ],
)
def test_multi_serde_serialize_value_matched_by_format_func(
    values: list[Any], expected: list[str]
) -> None:
    """Append ``format_func(v)`` when ``v`` is not matched by equality."""
    serde = _MultiSelectButtonGroupSerde[str | int](
        ["a", "b"],
        formatted_options=["A", "B"],
        formatted_option_to_option_index={"A": 0, "B": 1},
        format_func=lambda x: f"LABEL:{x}",
    )
    assert serde.serialize(values) == expected
