# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Unit test of ReportQueue.py."""

import unittest

from streamlit.ReportQueue import ReportQueue
from streamlit.elements import data_frame_proto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


# For the messages below, we don't really care about their contents so much as
# their general type.

INIT_MSG = ForwardMsg()
INIT_MSG.initialize.config.sharing_enabled = True

TEXT_DELTA_MSG1 = ForwardMsg()
TEXT_DELTA_MSG1.delta.new_element.text.body = 'text1'

TEXT_DELTA_MSG2 = ForwardMsg()
TEXT_DELTA_MSG2.delta.new_element.text.body = 'text2'

DF_DELTA_MSG = ForwardMsg()
data_frame_proto.marshall_data_frame(
    {'col1': [0, 1, 2], 'col2': [10, 11, 12]},
    DF_DELTA_MSG.delta.new_element.data_frame)

ADD_ROWS_MSG = ForwardMsg()
data_frame_proto.marshall_data_frame(
    {'col1': [3, 4, 5], 'col2': [13, 14, 15]},
    ADD_ROWS_MSG.delta.add_rows.data)


class ReportQueueTest(unittest.TestCase):

    def test_simple_enqueue(self):
        rq = ReportQueue()
        self.assertTrue(rq.is_empty())

        rq.enqueue(INIT_MSG)

        self.assertFalse(rq.is_empty())
        queue = rq.flush()
        self.assertTrue(rq.is_empty())
        self.assertEqual(len(queue), 1)
        self.assertTrue(queue[0].initialize.config.sharing_enabled)

    def test_enqueue_two(self):
        rq = ReportQueue()
        self.assertTrue(rq.is_empty())

        rq.enqueue(INIT_MSG)

        TEXT_DELTA_MSG1.delta.id = 0
        rq.enqueue(TEXT_DELTA_MSG1)

        queue = rq.flush()
        self.assertEqual(len(queue), 2)
        self.assertTrue(queue[0].initialize.config.sharing_enabled)
        self.assertEqual(queue[1].delta.id, 0)
        self.assertEqual(queue[1].delta.new_element.text.body, 'text1')

    def test_enqueue_three(self):
        rq = ReportQueue()
        self.assertTrue(rq.is_empty())

        rq.enqueue(INIT_MSG)

        TEXT_DELTA_MSG1.delta.id = 0
        rq.enqueue(TEXT_DELTA_MSG1)

        TEXT_DELTA_MSG2.delta.id = 1
        rq.enqueue(TEXT_DELTA_MSG2)

        queue = rq.flush()
        self.assertEqual(len(queue), 3)
        self.assertTrue(queue[0].initialize.config.sharing_enabled)
        self.assertEqual(queue[1].delta.id, 0)
        self.assertEqual(queue[1].delta.new_element.text.body, 'text1')
        self.assertEqual(queue[2].delta.id, 1)
        self.assertEqual(queue[2].delta.new_element.text.body, 'text2')

    def test_replace_element(self):
        rq = ReportQueue()
        self.assertTrue(rq.is_empty())

        rq.enqueue(INIT_MSG)

        TEXT_DELTA_MSG1.delta.id = 0
        rq.enqueue(TEXT_DELTA_MSG1)

        TEXT_DELTA_MSG2.delta.id = 0
        rq.enqueue(TEXT_DELTA_MSG2)

        queue = rq.flush()
        self.assertEqual(len(queue), 2)
        self.assertTrue(queue[0].initialize.config.sharing_enabled)
        self.assertEqual(queue[1].delta.id, 0)
        self.assertEqual(queue[1].delta.new_element.text.body, 'text2')

    def test_simple_add_rows(self):
        rq = ReportQueue()
        self.assertTrue(rq.is_empty())

        rq.enqueue(INIT_MSG)

        TEXT_DELTA_MSG1.delta.id = 0
        rq.enqueue(TEXT_DELTA_MSG1)

        DF_DELTA_MSG.delta.id = 1
        rq.enqueue(DF_DELTA_MSG)

        ADD_ROWS_MSG.delta.id = 1
        rq.enqueue(ADD_ROWS_MSG)

        queue = rq.flush()
        self.assertEqual(len(queue), 3)
        self.assertTrue(queue[0].initialize.config.sharing_enabled)
        self.assertEqual(queue[1].delta.id, 0)
        self.assertEqual(queue[1].delta.new_element.text.body, 'text1')
        self.assertEqual(queue[2].delta.id, 1)
        col0 = queue[2].delta.new_element.data_frame.data.cols[0].int64s.data
        col1 = queue[2].delta.new_element.data_frame.data.cols[1].int64s.data
        self.assertEqual(col0, [0, 1, 2, 3, 4, 5])
        self.assertEqual(col1, [10, 11, 12, 13, 14, 15])

    def test_add_rows_rerun(self):
        rq = ReportQueue()
        self.assertTrue(rq.is_empty())

        rq.enqueue(INIT_MSG)

        # Simulate rerun
        for i in range(2):
            TEXT_DELTA_MSG1.delta.id = 0
            rq.enqueue(TEXT_DELTA_MSG1)

            DF_DELTA_MSG.delta.id = 1
            rq.enqueue(DF_DELTA_MSG)

            ADD_ROWS_MSG.delta.id = 1
            rq.enqueue(ADD_ROWS_MSG)

        queue = rq.flush()
        self.assertEqual(len(queue), 3)
        self.assertTrue(queue[0].initialize.config.sharing_enabled)
        self.assertEqual(queue[1].delta.id, 0)
        self.assertEqual(queue[1].delta.new_element.text.body, 'text1')
        self.assertEqual(queue[2].delta.id, 1)
        col0 = queue[2].delta.new_element.data_frame.data.cols[0].int64s.data
        col1 = queue[2].delta.new_element.data_frame.data.cols[1].int64s.data
        self.assertEqual(col0, [0, 1, 2, 3, 4, 5])
        self.assertEqual(col1, [10, 11, 12, 13, 14, 15])
