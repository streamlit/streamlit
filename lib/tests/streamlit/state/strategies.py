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

widget_ids = hst.text(alphabet=ascii, min_size=1).map(
    lambda s: f"{GENERATED_WIDGET_KEY_PREFIX}-{s}-None"
)


# TODO: make some of them serialized
@hst.composite
def new_wstates(draw):
    wstate_raw = draw(hst.dictionaries(keys=widget_ids, values=hst.integers()))
    wstates = WStates()
    for k, v in wstate_raw.items():
        wstates.set_from_value(k, v)
    return wstates


# TODO: do two rounds of this, with compacting in between. probably rewritten
@hst.composite
def session_state(draw):
    new_state = draw(new_session_state)
    wstate = draw(new_wstates())
    state = SessionState(new_session_state=new_state, new_widget_state=wstate)

    # make some of the widgets have keys
    kw_num = draw(hst.integers(min_value=0, max_value=min(len(new_state), len(wstate))))
    kw = zip(new_state.keys(), wstate.keys())
    kw = islice(kw, kw_num)
    for k, wid in kw:
        state.set_key_widget_mapping(k, wid)

    return state
