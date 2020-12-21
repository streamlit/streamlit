# Copyright 2018-2020 Streamlit Inc.
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

from typing import cast, Optional, NamedTuple

import streamlit
from streamlit.proto import Block_pb2


class FormData(NamedTuple):
    """Form data stored on a DeltaGenerator."""

    submit_button_label: str
    submit_button_key: Optional[str]


class FormMixin:
    def beta_form(self, submit_label="Submit", key=None) -> "DeltaGenerator":
        block_proto = Block_pb2.Block()
        block_dg = self.dg._block(block_proto)
        # Attach the form's button info to the newly-created block's
        # delta generator. The block will create its submit button when it
        # exits.
        block_dg._form_data = FormData(submit_label, key)
        return block_dg

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
