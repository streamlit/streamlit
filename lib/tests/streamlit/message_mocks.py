"""Shared protobuf message mocking utilities."""

from streamlit import RootContainer
from streamlit.cursor import make_delta_path
from streamlit.elements import legacy_data_frame
from streamlit.elements.arrow import Data
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


def create_dataframe_msg(df: Data, id: int = 1) -> ForwardMsg:
    """Create a mock legacy_data_frame ForwardMsg."""
    msg = ForwardMsg()
    msg.metadata.delta_path[:] = make_delta_path(RootContainer.SIDEBAR, (), id)
    legacy_data_frame.marshall_data_frame(df, msg.delta.new_element.data_frame)
    return msg


def create_script_finished_message(
    status: "ForwardMsg.ScriptFinishedStatus.ValueType",
) -> ForwardMsg:
    """Create a script_finished ForwardMsg."""
    msg = ForwardMsg()
    msg.script_finished = status
    return msg
