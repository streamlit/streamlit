from streamlit import snowflake_demo
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.snowflake_demo import SnowflakeConfig, SnowflakeSessionCtx, SnowflakeSessionMessageQueue

SCRIPT_PATH = "snowflake_test_script.py"


class ExampleMessageQueue(SnowflakeSessionMessageQueue):
    """Example MessageQueue implementation. The Snowflake implementation
    should write each ForwardMsg to the session's websocket.
    """
    def push_forward_msg(self, msg: ForwardMsg) -> None:
        print(msg)


def create_rerun_msg() -> BackMsg:
    msg = BackMsg()
    msg.rerun_script.query_string = ""
    return msg


# Start Streamlit
config = SnowflakeConfig(script_path=SCRIPT_PATH)
snowflake_demo.start(config)

# Add a session
ctx = SnowflakeSessionCtx(queue=ExampleMessageQueue())
snowflake_demo.session_created(ctx)

# Send a BackMsg (these will arrive from the frontend - you shouldn't
# need to construct them manually, just pass them on to the appropriate
# session)
snowflake_demo.handle_backmsg(ctx, create_rerun_msg())

# Close the session
snowflake_demo.session_closed(ctx)
