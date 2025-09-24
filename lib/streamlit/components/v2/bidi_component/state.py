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

from typing import Any, TypedDict

from streamlit.util import AttributeDictionary


class BidiComponentState(TypedDict, total=False):
    """
    The schema for the state of a bidirectional component.

    The state is a flat dictionary-like object (key -> value) that supports
    both key and attribute notation via :class:`AttributeDictionary`.
    """

    # Flat mapping of state key -> value
    # (kept empty to reflect open set of keys)


class BidiComponentResult(AttributeDictionary):
    """Rich return object for ``st._bidi_component``.

    It behaves like a regular :class:`dict` *and* allows attribute-style
    access to its keys, mirroring the behaviour of
    :class:`streamlit.util.AttributeDictionary`. It surfaces both trigger and
    state values as top-level entries so they can be accessed via either key or
    attribute access.

    Parameters
    ----------
    state_vals : dict[str, Any] or None
        A dictionary of state values from the component.
    trigger_vals : dict[str, Any] or None
        A dictionary of trigger values from the component.
    """

    def __init__(
        self,
        state_vals: dict[str, Any] | None = None,
        trigger_vals: dict[str, Any] | None = None,
    ) -> None:
        if state_vals is None:
            state_vals = {}
        if trigger_vals is None:
            trigger_vals = {}

        super().__init__(
            {
                # The order here matters, because all stateful values will
                # always be returned, but trigger values may be transient. This
                # mirrors presentation behavior in
                # `make_bidi_component_presenter`.
                **trigger_vals,
                **state_vals,
            }
        )


def unwrap_component_state(raw_state: Any) -> dict[str, Any]:
    """Return flat mapping when given a dict; otherwise, empty dict.

    The new canonical state is flat, so this is effectively an identity for
    dict inputs and a guard for other types.
    """

    return dict(raw_state) if isinstance(raw_state, dict) else {}
