import asyncio

import streamlit
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import Runtime, RuntimeConfig, SessionClient

SCRIPT_PATH = "runtime_example_script.py"


class ExampleClient(SessionClient):
    """Example SessionClient implementation. The Snowflake implementation
    should write each ForwardMsg to the session's websocket.
    """

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        print(f"ExampleClient got ForwardMsg: {msg.WhichOneof('type')}")


def create_rerun_msg() -> BackMsg:
    msg = BackMsg()
    msg.rerun_script.query_string = ""
    return msg


async def main():
    print(f"Starting Runtime Example")

    streamlit._is_running_with_streamlit = True

    config = RuntimeConfig(SCRIPT_PATH, "")
    runtime = Runtime(config)

    async def example_app():
        # Add a session
        session_id = runtime.create_session(ExampleClient(), {})

        # Send a BackMsg (these will arrive from the frontend - you shouldn't
        # need to construct them manually, just pass them on to the appropriate
        # session)
        runtime.handle_backmsg(session_id, create_rerun_msg())

        print("Sleeping for 10...")
        await asyncio.sleep(10)

        # Close the session
        runtime.close_session(session_id)

        print("stopping...")
        runtime.stop()

    # Run two tasks in parallel: the first task runs the Runtime,
    # and the second creates a session, waits a few seconds, and then shuts
    # down the Runtime. This demonstrates how to we run and communicate with
    # the Streamlit Runtime without needing to create an additional thread.
    await asyncio.wait(
        [asyncio.create_task(runtime.run()), asyncio.create_task(example_app())],
        return_when=asyncio.FIRST_EXCEPTION,
    )


asyncio.run(main())
