# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from parameterized import parameterized

from streamlit.platform import post_parent_message
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PlatformTest(DeltaGeneratorTestCase):
    """Tests the platform module functions"""

    @parameterized.expand(["Hello", '{"name":"foo", "type":"bar"}'])
    def test_post_parent_message(self, message: str):
        post_parent_message(message)
        c = self.get_message_from_queue().parent_message
        self.assertEqual(c.message, message)
