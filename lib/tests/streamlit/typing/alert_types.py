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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.alert import AlertMixin

    alert = AlertMixin()

    assert_type(alert.error("Something went wrong"), DeltaGenerator)
    assert_type(
        alert.error("Something went wrong", title="Heads up", icon="🚨"),
        DeltaGenerator,
    )
    assert_type(alert.error("Something went wrong", title=None), DeltaGenerator)
    assert_type(alert.error("Something went wrong", width="stretch"), DeltaGenerator)
    assert_type(alert.error("Something went wrong", width=320), DeltaGenerator)

    assert_type(alert.warning("Pay attention"), DeltaGenerator)
    assert_type(
        alert.warning("Pay attention", title="Careful", icon="⚠️"),
        DeltaGenerator,
    )
    assert_type(alert.warning("Pay attention", title=None), DeltaGenerator)

    assert_type(alert.info("FYI"), DeltaGenerator)
    assert_type(alert.info("FYI", title="Heads up", icon="👉🏻"), DeltaGenerator)
    assert_type(alert.info("FYI", title=None), DeltaGenerator)

    assert_type(alert.success("Done"), DeltaGenerator)
    assert_type(alert.success("Done", title="All set", icon="✅"), DeltaGenerator)
    assert_type(alert.success("Done", title=None), DeltaGenerator)
