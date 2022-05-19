import time
from typing import Optional

from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.snowflake_demo import SnowflakeConfig, SnowflakeDemo

SCRIPT_PATH = "snowflake_test_script.py"
SCRIPT_STRING = open(SCRIPT_PATH).read()


class ExampleMessageContext:
    """Example AsyncMessageContext implementation. The Snowflake implementation
    should write each ForwardMsg to the session's websocket.
    """

    def __init__(self, id: str):
        self._id = id

    def write_forward_msg(self, msg_bytes: bytes) -> None:
        msg = ForwardMsg()
        msg.ParseFromString(msg_bytes)
        print(f"Got ForwardMsg: {msg.WhichOneof('type')} (id={self._id})")

    def on_complete(self, err: Optional[BaseException] = None) -> None:
        if err is None:
            print(f"Async operation complete! (id={self._id})")
        else:
            print(f"Async operation error: {err} (id={self._id})")

    def flush_system_logs(self, msg: Optional[str] = None) -> None:
        if msg is not None:
            print(msg)


def create_rerun_msg() -> bytes:
    msg = BackMsg()
    msg.rerun_script.query_string = ""
    return msg.SerializeToString()


# Start Streamlit
config = SnowflakeConfig(SCRIPT_PATH, {})
demo = SnowflakeDemo(config)
demo.start()

# Add a session
session_id = demo.create_session(
    ctx=ExampleMessageContext(id="new_session"),
    snowpark_session=None,
)

# Send a BackMsg (these will arrive from the frontend - you shouldn't
# need to construct them manually, just pass them on to the appropriate
# session)
demo.handle_backmsg(
    session_id, create_rerun_msg(), ExampleMessageContext(id="rerun_back_msg")
)

time.sleep(3)

# Close the session
demo.session_closed(session_id)

print("stopping...")
demo.stop()
