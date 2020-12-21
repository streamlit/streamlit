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


def current_form_id(dg: "streamlit.delta_generator.DeltaGenerator") -> str:
    """Return the form_id for the current form, or the empty string if  we're
    not inside an `st.form` block.

    (We return the empty string, instead of None, because this value is
    assigned to protobuf message fields, and None is not valid.)
    """
    form_data = dg._active_dg._form_data
    if form_data is None:
        return ""
    return form_data.form_id


class FormData(NamedTuple):
    """Form data stored on a DeltaGenerator."""

    # The form's unique ID.
    form_id: str
    # The label for the submit button that's automatically created for a form.
    submit_button_label: str
    # The optional key for the submit button.
    submit_button_key: Optional[str]


class FormMixin:
    def beta_form(self, submit_label="Submit", key=None):
        """TODO

        Parameters
        ----------
        submit_label
        key

        Returns
        -------

        """
        block_proto = Block_pb2.Block()
        block_dg = self.dg._block(block_proto)
        # Attach the form's button info to the newly-created block's
        # DeltaGenerator. The block will create its submit button when it
        # exits.
        form_id = "todo_form_id"
        block_dg._form_data = FormData(form_id, submit_label, key)
        return block_dg

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
