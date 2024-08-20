# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import (
    Any,
    Sequence,
)

from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import (
    T,
    check_python_comparable,
)


def check_and_convert_to_indices(
    opt: Sequence[Any], default_values: Sequence[Any] | Any | None
) -> list[int] | None:
    """Perform validation checks and return indices based on the default values."""
    if default_values is None:
        return None

    default_values = convert_anything_to_list(default_values)

    for value in default_values:
        if value not in opt:
            raise StreamlitAPIException(
                f"The default value '{value}' is not part of the options. "
                "Please make sure that every default values also exists in the options."
            )

    return [opt.index(value) for value in default_values]


def convert_to_sequence_and_check_comparable(options: OptionSequence[T]) -> Sequence[T]:
    indexable_options = convert_anything_to_list(options)
    check_python_comparable(indexable_options)
    return indexable_options


def get_default_indices(
    indexable_options: Sequence[T], default: Sequence[Any] | Any | None = None
) -> list[int]:
    default_indices = check_and_convert_to_indices(indexable_options, default)
    default_indices = default_indices if default_indices is not None else []
    return default_indices
