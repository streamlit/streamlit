from unittest.mock import MagicMock, patch
import unittest

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.errors import StreamlitAPIException
from streamlit.report_thread import ReportContext


class ReportContextTest(unittest.TestCase):
    def test_set_page_config_immutable(self):
        """st.set_page_config must be called at most once"""

        fake_enqueue = lambda msg: None
        ctx = ReportContext("TestSessionID", fake_enqueue, "", None, None, None)

        msg = ForwardMsg()
        msg.page_config_changed.title = "foo"

        ctx.enqueue(msg)
        with self.assertRaises(StreamlitAPIException):
            ctx.enqueue(msg)

    def test_set_page_config_first(self):
        """st.set_page_config must be called before other st commands"""

        fake_enqueue = lambda msg: None
        ctx = ReportContext("TestSessionID", fake_enqueue, "", None, None, None)

        markdown_msg = ForwardMsg()
        markdown_msg.delta.new_element.markdown.body = "foo"

        msg = ForwardMsg()
        msg.page_config_changed.title = "foo"

        ctx.enqueue(markdown_msg)
        with self.assertRaises(StreamlitAPIException):
            ctx.enqueue(msg)

    def test_set_page_config_reset(self):
        """st.set_page_config should be allowed after a rerun"""

        fake_enqueue = lambda msg: None
        ctx = ReportContext("TestSessionID", fake_enqueue, "", None, MagicMock(), None)

        msg = ForwardMsg()
        msg.page_config_changed.title = "foo"

        ctx.enqueue(msg)
        ctx.reset()
        try:
            ctx.enqueue(msg)
        except StreamlitAPIException:
            self.fail("set_page_config should have succeeded after reset!")
