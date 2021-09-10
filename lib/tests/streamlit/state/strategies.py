from itertools import islice
from streamlit.state.session_state import (
    SessionState,
    GENERATED_WIDGET_KEY_PREFIX,
    WStates,
)
from hypothesis import strategies as hst

ascii = list("abcdefghijklmnopqrstuvwxyz0123456789_-")

user_key = hst.one_of(hst.text(alphabet=ascii, min_size=1), hst.integers().map(str))

new_session_state = hst.dictionaries(keys=user_key, values=hst.integers())

unkeyed_widget_ids = hst.uuids().map(
    lambda s: f"{GENERATED_WIDGET_KEY_PREFIX}-{s}-None"
)


def keyed_widget_ids(draw, key):
    uuid = draw(hst.uuids())
    return f"{GENERATED_WIDGET_KEY_PREFIX}-{uuid}-{key}"


# TODO: make some of them serialized
@hst.composite
def new_wstates(draw):
    wstate_raw = draw(hst.dictionaries(keys=unkeyed_widget_ids, values=hst.integers()))
    wstates = WStates()
    for k, v in wstate_raw.items():
        wstates.set_from_value(k, v)
    return wstates


def as_keyed_widget_id(raw_wid, key):
    return f"{GENERATED_WIDGET_KEY_PREFIX}-{raw_wid}-{key}"


# TODO: don't generate states where there is a k-wid mapping where the key exists but the widget doesn't
@hst.composite
def session_state(draw):
    # generate session state items
    new_state = draw(new_session_state)
    # generate two pools of widget ids, one paired with keys
    unkeyed_widgets = draw(
        hst.dictionaries(keys=unkeyed_widget_ids, values=hst.integers())
    )
    widget_key_pairs = draw(hst.lists(hst.tuples(hst.uuids(), user_key)))
    # generate widgets and session state entries for the latter
    k_wids = {key: as_keyed_widget_id(wid, key) for wid, key in widget_key_pairs}
    keyed_widget_id = list(k_wids.values())
    if k_wids.keys():
        session_state_widget_entries = draw(
            hst.dictionaries(
                keys=hst.sampled_from(list(k_wids.keys())),
                values=hst.integers(),
                min_size=1,
            )
        )
    else:
        session_state_widget_entries = {}

    if keyed_widget_id:
        keyed_widgets = draw(
            hst.dictionaries(
                keys=hst.sampled_from(keyed_widget_id),
                values=hst.integers(),
                min_size=1,
            )
        )
    else:
        keyed_widgets = {}
    wstate_raw = {**unkeyed_widgets, **keyed_widgets}
    wstates = WStates()
    for k, v in wstate_raw.items():
        wstates.set_from_value(k, v)
    state = SessionState(
        new_session_state={**new_state, **session_state_widget_entries},
        new_widget_state=wstates,
        key_id_mapping=k_wids,
    )
    return state
