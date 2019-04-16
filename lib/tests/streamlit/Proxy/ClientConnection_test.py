"""ClientConnection unit tests.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import unittest

from streamlit.proxy.ClientConnection import ClientConnection
from streamlit import protobuf

class ClientConnectionTest(unittest.TestCase):
    """Test ClientConnection Class."""

    def test_empty_gets_removed(self):
        """Tests that empty protobufs dont get saved as deltas."""
        num_deltas = 3
        msg = protobuf.ForwardMsg()
        cc = ClientConnection(msg.new_report, 'some_report')

        for i in range(0, num_deltas):
            delta = protobuf.Delta()
            delta.new_element.text.body = 'element %d' % i
            cc._master_queue._deltas.append(delta)
            if i == 1:
                for i in range(0, 10):
                    delta = protobuf.Delta()
                    delta.new_element.empty.unused = True
                    cc._master_queue._deltas.append(delta)

        tuples = cc.serialize_final_report_to_files()
        files = [ filename for (filename, _) in tuples if filename.endswith('.delta')]
        self.assertEqual(num_deltas, len(files))
