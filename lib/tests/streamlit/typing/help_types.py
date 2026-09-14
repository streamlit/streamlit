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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.help import HelpMixin

    # Named st_help to avoid shadowing the builtin help().
    st_help = HelpMixin().help

    def _sample_fn() -> None:
        pass

    class _SampleClass:
        pass

    # =====================================================================
    # st.help return type tests
    # =====================================================================

    # No arguments uses the default object and returns DeltaGenerator
    assert_type(st_help(), DeltaGenerator)

    # obj accepts any value
    assert_type(st_help(_sample_fn), DeltaGenerator)
    assert_type(st_help(_SampleClass), DeltaGenerator)
    assert_type(st_help(_SampleClass()), DeltaGenerator)
    assert_type(st_help("a string"), DeltaGenerator)
    assert_type(st_help(42), DeltaGenerator)
    assert_type(st_help(None), DeltaGenerator)

    # Width is keyword-only: "stretch" or an int (not "content")
    assert_type(st_help(width="stretch"), DeltaGenerator)
    assert_type(st_help(_sample_fn, width="stretch"), DeltaGenerator)
    assert_type(st_help(_sample_fn, width=300), DeltaGenerator)

    # All parameters combined
    assert_type(st_help(_SampleClass(), width=400), DeltaGenerator)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch" or int)
    st_help(_sample_fn, width="invalid")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # "content" is accepted by some sibling commands but NOT by st.help
    st_help(_sample_fn, width="content")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing width as a positional argument (should be keyword-only)
    st_help(_sample_fn, "stretch")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
