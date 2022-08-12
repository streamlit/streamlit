from dataclasses import dataclass
import os
from typing import List

from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

LOGGER = get_logger(__name__)


@dataclass(init=False)
class SessionData:
    """
    Contains parameters related to running a script, and also houses
    the ForwardMsgQueue that is used to deliver messages to a connected browser.
    """

    main_script_path: str
    script_folder: str
    name: str
    command_line: str
    _browser_queue: ForwardMsgQueue

    def __init__(self, main_script_path: str, command_line: str):
        """Constructor.

        Parameters
        ----------
        main_script_path : str
            Path of the Python file from which this app is generated.

        command_line : string
            Command line as input by the user

        """
        basename = os.path.basename(main_script_path)

        self.main_script_path = os.path.abspath(main_script_path)
        self.script_folder = os.path.dirname(self.main_script_path)
        self.name = str(os.path.splitext(basename)[0])

        # The browser queue contains messages that haven't yet been
        # delivered to the browser. Periodically, the server flushes
        # this queue and delivers its contents to the browser.
        self._browser_queue = ForwardMsgQueue()

        self.command_line = command_line

    def enqueue(self, msg: ForwardMsg) -> None:
        self._browser_queue.enqueue(msg)

    def clear_browser_queue(self) -> None:
        """Clear all pending ForwardMsgs from our browser queue."""
        self._browser_queue.clear()

    def flush_browser_queue(self) -> List[ForwardMsg]:
        """Clear our browser queue and return the messages it contained.

        The Server calls this periodically to deliver new messages
        to the browser associated with this session.

        Returns
        -------
        list[ForwardMsg]
            The messages that were removed from the queue and should
            be delivered to the browser.

        """
        return self._browser_queue.flush()
