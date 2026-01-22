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

"""Integration tests for query parameter widget binding functionality.

These tests verify end-to-end flows across multiple modules:
- URL value seeds widget on initial load
- Widget value changes update URL
- User interaction takes priority over URL on reruns
- MPA page transition filters/preserves correct params
- Fragment reruns preserve widgets outside fragment
- Conditional widget unmount cleans up URL params

Unit tests for individual functions are in their respective test files:
- query_params_test.py: parse_url_param, bind_widget, unbind_widget, etc.
- session_state_test.py: _handle_query_param_binding
- widgets_test.py: bind parameter validation
"""

from __future__ import annotations

# TODO: Add integration tests for end-to-end query param binding flows.
# These will require more complex test setup with actual script execution
# or mocking multiple components together.
#
# Planned integration tests:
# - test_url_seeds_widget_on_initial_load
# - test_widget_change_updates_url
# - test_user_interaction_takes_priority_on_rerun
# - test_mpa_page_transition_preserves_main_script_params
# - test_mpa_page_transition_filters_other_page_params
# - test_fragment_rerun_preserves_widgets_outside_fragment
# - test_conditional_widget_unmount_cleans_url
# - test_url_auto_correction_on_invalid_value
