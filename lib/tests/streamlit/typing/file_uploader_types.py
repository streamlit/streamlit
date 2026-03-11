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

# Perform type checking tests for st.file_uploader
# The return type depends on the accept_multiple_files parameter:
# - accept_multiple_files=False (default) -> returns UploadedFile | None
# - accept_multiple_files=True or "directory" -> returns list[UploadedFile]
if TYPE_CHECKING:
    from streamlit.elements.widgets.file_uploader import FileUploaderMixin
    from streamlit.runtime.uploaded_file_manager import UploadedFile

    file_uploader = FileUploaderMixin().file_uploader

    # =====================================================================
    # Basic return type tests based on accept_multiple_files parameter
    # =====================================================================

    # Default (accept_multiple_files=False) returns UploadedFile | None
    assert_type(file_uploader("Upload a file"), UploadedFile | None)
    assert_type(
        file_uploader("Upload a file", accept_multiple_files=False), UploadedFile | None
    )

    # With accept_multiple_files=True returns list[UploadedFile]
    assert_type(
        file_uploader("Upload files", accept_multiple_files=True), list[UploadedFile]
    )

    # With accept_multiple_files="directory" returns list[UploadedFile]
    assert_type(
        file_uploader("Upload directory", accept_multiple_files="directory"),
        list[UploadedFile],
    )

    # =====================================================================
    # Test type parameter (positional or keyword)
    # =====================================================================

    # Type as positional argument (single file)
    assert_type(file_uploader("Upload CSV", "csv"), UploadedFile | None)
    assert_type(file_uploader("Upload CSV", "csv", False), UploadedFile | None)
    assert_type(file_uploader("Upload CSV", "csv", True), list[UploadedFile])

    # Type as keyword argument (single file)
    assert_type(file_uploader("Upload CSV", type="csv"), UploadedFile | None)
    assert_type(file_uploader("Upload CSV", type=["csv", "xlsx"]), UploadedFile | None)
    assert_type(file_uploader("Upload CSV", type=None), UploadedFile | None)

    # Type as keyword with accept_multiple_files (multiple files)
    assert_type(
        file_uploader("Upload files", type="csv", accept_multiple_files=True),
        list[UploadedFile],
    )
    assert_type(
        file_uploader("Upload files", type=["jpg", "png"], accept_multiple_files=True),
        list[UploadedFile],
    )

    # Type as positional with accept_multiple_files as keyword
    assert_type(
        file_uploader("Upload files", "csv", accept_multiple_files=True),
        list[UploadedFile],
    )
    assert_type(
        file_uploader("Upload files", ["jpg", "png"], accept_multiple_files=True),
        list[UploadedFile],
    )

    # Directory upload with type filter
    assert_type(
        file_uploader(
            "Upload images", type=["jpg", "png"], accept_multiple_files="directory"
        ),
        list[UploadedFile],
    )
    assert_type(
        file_uploader("Upload images", ["jpg", "png"], "directory"), list[UploadedFile]
    )

    # =====================================================================
    # Test key parameter (str or int)
    # =====================================================================

    assert_type(file_uploader("Upload", key="my_uploader"), UploadedFile | None)
    assert_type(file_uploader("Upload", key=123), UploadedFile | None)
    assert_type(file_uploader("Upload", key=None), UploadedFile | None)
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, key="my_uploader"),
        list[UploadedFile],
    )

    # =====================================================================
    # Test help parameter
    # =====================================================================

    assert_type(
        file_uploader("Upload", help="Select a file to upload"), UploadedFile | None
    )
    assert_type(file_uploader("Upload", help=None), UploadedFile | None)
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, help="Select files"),
        list[UploadedFile],
    )

    # =====================================================================
    # Test max_upload_size parameter (keyword-only)
    # =====================================================================

    assert_type(file_uploader("Upload", max_upload_size=100), UploadedFile | None)
    assert_type(file_uploader("Upload", max_upload_size=None), UploadedFile | None)
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, max_upload_size=50),
        list[UploadedFile],
    )

    # =====================================================================
    # Test disabled parameter (keyword-only)
    # =====================================================================

    assert_type(file_uploader("Upload", disabled=True), UploadedFile | None)
    assert_type(file_uploader("Upload", disabled=False), UploadedFile | None)
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, disabled=True),
        list[UploadedFile],
    )

    # =====================================================================
    # Test label_visibility parameter (keyword-only)
    # =====================================================================

    assert_type(
        file_uploader("Upload", label_visibility="visible"), UploadedFile | None
    )
    assert_type(file_uploader("Upload", label_visibility="hidden"), UploadedFile | None)
    assert_type(
        file_uploader("Upload", label_visibility="collapsed"), UploadedFile | None
    )
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, label_visibility="hidden"),
        list[UploadedFile],
    )

    # =====================================================================
    # Test width parameter (keyword-only)
    # =====================================================================

    assert_type(file_uploader("Upload", width="stretch"), UploadedFile | None)
    assert_type(file_uploader("Upload", width=300), UploadedFile | None)
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, width="stretch"),
        list[UploadedFile],
    )
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, width=500),
        list[UploadedFile],
    )

    # =====================================================================
    # Test callback parameters (on_change, args, kwargs)
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(file_uploader("Upload", on_change=my_callback), UploadedFile | None)
    assert_type(
        file_uploader("Upload", on_change=callback_with_args, args=(1, "a")),
        UploadedFile | None,
    )
    assert_type(
        file_uploader(
            "Upload", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        UploadedFile | None,
    )
    assert_type(file_uploader("Upload", on_change=None), UploadedFile | None)
    assert_type(
        file_uploader("Upload", accept_multiple_files=True, on_change=my_callback),
        list[UploadedFile],
    )
    assert_type(
        file_uploader(
            "Upload",
            accept_multiple_files=True,
            on_change=callback_with_args,
            args=(1, "test"),
        ),
        list[UploadedFile],
    )

    # =====================================================================
    # Test with all parameters combined (single file)
    # =====================================================================

    assert_type(
        file_uploader(
            "Upload file",
            type=["csv", "xlsx"],
            accept_multiple_files=False,
            key="full_uploader",
            help="Upload a CSV or Excel file",
            on_change=my_callback,
            args=None,
            kwargs=None,
            max_upload_size=100,
            disabled=False,
            label_visibility="visible",
            width="stretch",
        ),
        UploadedFile | None,
    )

    # =====================================================================
    # Test with all parameters combined (multiple files)
    # =====================================================================

    assert_type(
        file_uploader(
            "Upload files",
            type=["jpg", "jpeg", "png"],
            accept_multiple_files=True,
            key="multi_uploader",
            help="Upload image files",
            on_change=my_callback,
            args=None,
            kwargs=None,
            max_upload_size=50,
            disabled=False,
            label_visibility="visible",
            width=400,
        ),
        list[UploadedFile],
    )

    # =====================================================================
    # Test with all parameters combined (directory upload)
    # =====================================================================

    assert_type(
        file_uploader(
            "Upload directory",
            type=["py", "txt"],
            accept_multiple_files="directory",
            key="dir_uploader",
            help="Upload a directory of files",
            on_change=my_callback,
            args=None,
            kwargs=None,
            max_upload_size=200,
            disabled=False,
            label_visibility="collapsed",
            width="stretch",
        ),
        list[UploadedFile],
    )

    # =====================================================================
    # Test type as positional with all other parameters
    # =====================================================================

    assert_type(
        file_uploader(
            "Upload PDF",
            "pdf",  # type as positional
            False,  # accept_multiple_files as positional
            "pdf_uploader",  # key as positional
            "Upload a PDF file",  # help as positional
            my_callback,  # on_change as positional
            None,  # args as positional
            None,  # kwargs as positional
            max_upload_size=25,
            disabled=False,
            label_visibility="visible",
            width="stretch",
        ),
        UploadedFile | None,
    )

    assert_type(
        file_uploader(
            "Upload PDFs",
            "pdf",  # type as positional
            True,  # accept_multiple_files=True as positional
            "pdfs_uploader",  # key as positional
            "Upload PDF files",  # help as positional
            my_callback,  # on_change as positional
            None,  # args as positional
            None,  # kwargs as positional
            max_upload_size=100,
            disabled=False,
            label_visibility="visible",
            width="stretch",
        ),
        list[UploadedFile],
    )
