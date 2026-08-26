# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

from typing import TYPE_CHECKING, NamedTuple

from streamlit import runtime
from streamlit.delta_generator_singletons import context_dg_stack

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class FormData(NamedTuple):
    """Form data stored on a DeltaGenerator."""

    # The form's unique ID.
    form_id: str


def _current_form(this_dg: DeltaGenerator) -> FormData | None:
    """Find the FormData for the given DeltaGenerator.

    Forms are blocks, and can have other blocks nested inside them.
    To find the current form, we walk up the dg_stack until we find
    a DeltaGenerator that has FormData.
    """
    if not runtime.exists():
        return None

    if this_dg._form_data is not None:
        return this_dg._form_data

    if this_dg == this_dg._main_dg:
        # We were created via an `st.foo` call.
        # Walk up the dg_stack to see if we're nested inside a `with st.form` statement.
        for dg in reversed(context_dg_stack.get()):
            if dg._form_data is not None:
                return dg._form_data
    else:
        # We were created via an `dg.foo` call.
        # Take a look at our parent's form data to see if we're nested inside a form.
        parent = this_dg._parent
        if parent is not None and parent._form_data is not None:
            return parent._form_data

    return None


def current_form_id(dg: DeltaGenerator) -> str:
    """Return the form_id for the current form, or the empty string if we're
    not inside an `st.form` block.

    (We return the empty string, instead of None, because this value is
    assigned to protobuf message fields, and None is not valid.)
    """
    form_data = _current_form(dg)
    if form_data is None:
        return ""
    return form_data.form_id


def is_in_form(dg: DeltaGenerator) -> bool:
    """True if the DeltaGenerator is inside an st.form block."""
    return current_form_id(dg) != ""
