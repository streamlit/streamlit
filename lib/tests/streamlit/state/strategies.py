# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from streamlit.state.session_state import (
    SessionState,
    GENERATED_WIDGET_KEY_PREFIX,
    WidgetMetadata,
)
from hypothesis import strategies as hst

ascii = list("abcdefghijklmnopqrstuvwxyz0123456789_-")

user_key = hst.one_of(hst.text(alphabet=ascii, min_size=1), hst.integers().map(str))

new_session_state = hst.dictionaries(keys=user_key, values=hst.integers())

unkeyed_widget_ids = hst.uuids().map(
    lambda s: f"{GENERATED_WIDGET_KEY_PREFIX}-{s}-None"
)


def as_keyed_widget_id(raw_wid, key):
    return f"{GENERATED_WIDGET_KEY_PREFIX}-{raw_wid}-{key}"


def mock_metadata(widget_id: str, default_value: int) -> WidgetMetadata:
    return WidgetMetadata(
        id=widget_id,
        deserializer=lambda x, s: default_value if x is None else x,
        serializer=lambda x: x,
        value_type="int_value",
    )


@hst.composite
def _session_state(draw):
    state = SessionState()
    new_state = draw(new_session_state)
    for k, v in new_state.items():
        state[k] = v

    unkeyed_widgets = draw(
        hst.dictionaries(keys=unkeyed_widget_ids, values=hst.integers())
    )
    for wid, v in unkeyed_widgets.items():
        state.set_unkeyed_widget_metadata(mock_metadata(wid, v), wid)

    widget_key_val_triple = draw(
        hst.lists(hst.tuples(hst.uuids(), user_key, hst.integers()))
    )
    k_wids = {
        key: (as_keyed_widget_id(wid, key), val)
        for wid, key, val in widget_key_val_triple
    }
    for key, (wid, val) in k_wids.items():
        state.set_keyed_widget_metadata(mock_metadata(wid, val), wid, key)

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


# TODO: don't generate states where there is a k-wid mapping where the key exists but the widget doesn't
@hst.composite
def session_state(draw):
    state = draw(_session_state())

    state.compact_state()
    # round 2

    state2 = draw(_session_state())

    state.update(state2)

    return state
