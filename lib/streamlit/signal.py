from typing import Any, Optional

import streamlit.session_state as state


class SignalState:
    signal: Optional[str] = None
    signal_value: Optional[Any] = None
    context_value: Optional[Any] = None

    def set(self, signal: str, value: Any, context: Any) -> None:
        self.signal = signal
        self.signal_value = value
        self.context_value = context

    def reset(self) -> None:
        self.set(None, None, None)


# st.signal() -> bool: true if a widget changing activated it, otherwise false
def signal(signal_name: str) -> bool:
    signal_state = get_signal_state()
    if signal_state.signal == signal_name:
        return True
    else:
        return False


# st.signal_value() -> Any: the value associated with the widget trigering the signal, or None if the signal is not set. generally will be the value of the widget
def signal_value() -> Any:
    signal_state = get_signal_state()
    return signal_state.signal_value


# st.signal_context() -> Any: an additional value passed by the widget that triggered the signal
def signal_context() -> Any:
    signal_state = get_signal_state()
    return signal_state.context_value


def get_signal_state() -> SignalState:
    session = state.get_current_session()
    signal_state = session.get_signal_state()
    return signal_state
