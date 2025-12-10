# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Property-based tests for tag_input widget."""

from hypothesis import given, settings
from hypothesis import strategies as st

from streamlit.elements.widgets.tag_input import _validate_tags


# Strategy for generating whitespace-only strings
whitespace_chars = st.sampled_from([" ", "\t", "\n", "\r", "\f", "\v"])
whitespace_strings = st.text(alphabet=" \t\n\r\f\v", min_size=0, max_size=20)


# Strategy for generating valid (non-whitespace) tags
valid_tag = st.text(min_size=1, max_size=50).filter(
    lambda s: s and not s.isspace()
)


@given(
    whitespace_tag=whitespace_strings,
    existing_tags=st.lists(valid_tag, min_size=0, max_size=10),
)
@settings(max_examples=100)
def test_whitespace_tag_rejection(whitespace_tag: str, existing_tags: list[str]):
    """
    **Feature: tag-input, Property 5: Whitespace Tag Rejection**

    *For any* string composed entirely of whitespace characters (spaces, tabs,
    newlines), attempting to add it as a tag SHALL be rejected, and the tag
    list SHALL remain unchanged.

    **Validates: Requirements 2.4**
    """
    # Create a list with existing valid tags plus the whitespace tag
    tags_with_whitespace = existing_tags + [whitespace_tag]

    # Validate the tags
    result = _validate_tags(
        tags_with_whitespace,
        max_tags=None,
        allow_duplicates=True,
    )

    # The whitespace tag should be rejected - it should not appear in the result
    # The result should only contain the valid existing tags
    # (Note: we use allow_duplicates=True to avoid duplicate filtering affecting the test)

    # Check that the whitespace tag is not in the result
    if whitespace_tag == "" or whitespace_tag.isspace():
        assert whitespace_tag not in result, (
            f"Whitespace tag '{repr(whitespace_tag)}' should have been rejected"
        )

    # The result should have the same valid tags as the input (minus whitespace)
    expected_valid_tags = [t for t in existing_tags if t and not t.isspace()]
    assert result == expected_valid_tags, (
        f"Expected {expected_valid_tags}, got {result}"
    )
