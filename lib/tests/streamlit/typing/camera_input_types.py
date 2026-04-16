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

# Perform type checking tests for st.camera_input
# The return type is always UploadedFile | None
if TYPE_CHECKING:
    from streamlit.elements.widgets.camera_input import CameraInputMixin
    from streamlit.runtime.uploaded_file_manager import UploadedFile

    camera_input = CameraInputMixin().camera_input

    # =====================================================================
    # st.camera_input return type tests
    # =====================================================================

    # Basic camera input - returns UploadedFile | None
    assert_type(camera_input("Take a picture"), UploadedFile | None)
    assert_type(camera_input("Take a picture", key="my_camera"), UploadedFile | None)
    assert_type(camera_input("Take a picture", key=123), UploadedFile | None)
    assert_type(camera_input("Take a picture", key=None), UploadedFile | None)

    # Camera input with help parameter
    assert_type(
        camera_input("Take a picture", help="Click to capture"), UploadedFile | None
    )
    assert_type(camera_input("Take a picture", help=None), UploadedFile | None)

    # Camera input with disabled parameter
    assert_type(camera_input("Take a picture", disabled=True), UploadedFile | None)
    assert_type(camera_input("Take a picture", disabled=False), UploadedFile | None)

    # Camera input with label_visibility parameter
    assert_type(
        camera_input("Take a picture", label_visibility="visible"), UploadedFile | None
    )
    assert_type(
        camera_input("Take a picture", label_visibility="hidden"), UploadedFile | None
    )
    assert_type(
        camera_input("Take a picture", label_visibility="collapsed"),
        UploadedFile | None,
    )

    # Camera input with width parameter - "stretch" or int (no "content")
    assert_type(camera_input("Take a picture", width="stretch"), UploadedFile | None)
    assert_type(camera_input("Take a picture", width=300), UploadedFile | None)

    # Camera input with on_change callback
    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(
        camera_input("Take a picture", on_change=my_callback), UploadedFile | None
    )
    assert_type(
        camera_input("Take a picture", on_change=callback_with_args, args=(1, "a")),
        UploadedFile | None,
    )
    assert_type(
        camera_input(
            "Take a picture", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        UploadedFile | None,
    )
    assert_type(camera_input("Take a picture", on_change=None), UploadedFile | None)

    # Camera input with all parameters combined
    assert_type(
        camera_input(
            "Full camera input",
            key="full_camera",
            help="Capture a photo",
            on_change=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
            label_visibility="visible",
            width="stretch",
        ),
        UploadedFile | None,
    )
