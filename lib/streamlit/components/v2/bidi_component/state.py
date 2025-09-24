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

    The state is stored in a dictionary-like object that supports both key and
    attribute notation. States cannot be programmatically changed or set through
    Session State.

    Attributes
    ----------
    value
        The current value of the component instance returned from the frontend,
        or the default value if not yet set. This is a dictionary containing
        the actual state key-value pairs.
    """

    value: dict[str, Any]


class BidiComponentResult(AttributeDictionary):
    """Rich return object for ``st.bidi_component``.

    It behaves like a regular :class:`dict` *and* allows attribute-style
    access to its keys, mirroring the behaviour of
    :class:`streamlit.util.AttributeDictionary`. It surfaces both trigger and
    state values as top-level entries so they can be accessed via either key or
    attribute access.
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
                # always be returned, but trigger values may be transient.
                **trigger_vals,
                **state_vals,
            }
        )


def unwrap_component_state(raw_state: Any) -> dict[str, Any]:
    """Return the inner mapping of a valid :class:`BidiComponentState`.

    A valid component state **must** be a mapping that contains exactly one key:
    ``"value"``, whose associated value is itself a mapping holding the actual
    per-key state entries produced by the frontend.

    Any other shape is considered invalid and will be treated as an empty
    mapping. This strictness ensures we never silently accept malformed data
    that could mask bugs elsewhere in the stack.

    Parameters
    ----------
    raw_state
        The value retrieved from Session State.

    Returns
    -------
    dict[str, Any]
        The *inner* state mapping if the input adheres to the expected
        structure; otherwise, an empty ``dict``.

    """

    if (
        isinstance(raw_state, dict)
        and set(raw_state.keys()) == {"value"}
        and isinstance(raw_state["value"], dict)
    ):
        # Shallow-copy to decouple from the original reference.
        return dict(raw_state["value"])

    # Any deviation from the expected schema is regarded as invalid.
    return {}
