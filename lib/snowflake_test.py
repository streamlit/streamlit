import time

from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.snowflake_demo import SnowflakeConfig, SnowflakeSessionCtx, \
    SnowflakeSessionMessageQueue, SnowflakeDemo

SCRIPT_PATH = "snowflake_test_script.py"


class ExampleMessageQueue(SnowflakeSessionMessageQueue):
    """Example MessageQueue implementation. The Snowflake implementation
    should write each ForwardMsg to the session's websocket.
    """
    def write_forward_msg(self, msg: ForwardMsg) -> None:
        print(msg)


def create_rerun_msg() -> BackMsg:
    msg = BackMsg()
    msg.rerun_script.query_string = ""
    return msg


# Start Streamlit
config = SnowflakeConfig(script_path=SCRIPT_PATH)
demo = SnowflakeDemo(config)
demo.start()

# Add a session
ctx = SnowflakeSessionCtx(queue=ExampleMessageQueue())
demo.session_created(ctx)

# Send a BackMsg (these will arrive from the frontend - you shouldn't
# need to construct them manually, just pass them on to the appropriate
# session)
demo.handle_backmsg(ctx, create_rerun_msg())

# Close the session
demo.session_closed(ctx)

time.sleep(10)

print("stopping...")
demo.stop()
