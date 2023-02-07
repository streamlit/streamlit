# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from hypothesis import strategies as hst

from streamlit.runtime.state.common import GENERATED_WIDGET_ID_PREFIX
from streamlit.runtime.state.session_state import SessionState, WidgetMetadata

ASCII = list("abcdefghijklmnopqrstuvwxyz0123456789_-")

USER_KEY = hst.one_of(hst.text(alphabet=ASCII, min_size=1), hst.integers().map(str))

NEW_SESSION_STATE = hst.dictionaries(keys=USER_KEY, values=hst.integers())

UNKEYED_WIDGET_IDS = hst.uuids().map(lambda s: f"{GENERATED_WIDGET_ID_PREFIX}-{s}-None")


def as_keyed_widget_id(raw_wid, key):
    return f"{GENERATED_WIDGET_ID_PREFIX}-{raw_wid}-{key}"


def mock_metadata(widget_id: str, default_value: int) -> WidgetMetadata:
    return WidgetMetadata(
        id=widget_id,
        deserializer=lambda x, s: default_value if x is None else x,
        serializer=lambda x: x,
        value_type="int_value",
    )


@hst.composite
def _session_state(draw) -> SessionState:
    state = SessionState()
    new_state = draw(NEW_SESSION_STATE)
    for k, v in new_state.items():
        state[k] = v

    unkeyed_widgets = draw(
        hst.dictionaries(keys=UNKEYED_WIDGET_IDS, values=hst.integers())
    )
    for wid, v in unkeyed_widgets.items():
        state.register_widget(mock_metadata(wid, v), user_key=None)

    widget_key_val_triple = draw(
        hst.lists(hst.tuples(hst.uuids(), USER_KEY, hst.integers()))
    )
    k_wids = {
        key: (as_keyed_widget_id(wid, key), val)
        for wid, key, val in widget_key_val_triple
    }
    for key, (wid, val) in k_wids.items():
        state.register_widget(mock_metadata(wid, val), user_key=key)

    if k_wids:
        session_state_widget_entries = draw(
            hst.dictionaries(
                keys=hst.sampled_from(list(k_wids.keys())),
                values=hst.integers(),
            )
        )
        for k, v in session_state_widget_entries.items():
            state[k] = v

    return state


def _merge_states(a: SessionState, b: SessionState) -> None:
    """Merge 'b' into 'a'."""
    a._new_session_state.update(b._new_session_state)
    a._new_widget_state.update(b._new_widget_state)
    a._old_state.update(b._old_state)
    a._key_id_mapping.update(b._key_id_mapping)


# TODO: don't generate states where there is a k-wid mapping where the key exists but the widget doesn't
@hst.composite
def session_state(draw) -> SessionState:
    state = draw(_session_state())

    state._compact_state()
    # round 2

    state2 = draw(_session_state())

    _merge_states(state, state2)

    return state
