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

from __future__ import annotations

import io
from pathlib import Path
from typing import TYPE_CHECKING, Union, cast

from typing_extensions import TypeAlias

from streamlit import url_util
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.proto.Pdf_pb2 import Pdf as PdfProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import (
        HeightWithoutContent,
        WidthWithoutContent,
    )

PdfData: TypeAlias = Union[str, Path, bytes, io.BytesIO]


class PdfMixin:
    @gather_metrics("pdf")
    def pdf(
        self,
        data: PdfData,
        *,
        height: HeightWithoutContent = 500,
        width: WidthWithoutContent = "stretch",
    ) -> DeltaGenerator:
        """Display a PDF viewer.

        Parameters
        ----------
        data : str, Path, bytes, or BytesIO
            The PDF file to show. This can be one of the following:
            - A URL (string) for a hosted PDF file.
            - A path to a local PDF file.
            - A file-like object, e.g. a file opened with `open` or an `UploadedFile` returned by `st.file_uploader`.
            - Raw bytes data.
        height : int or "stretch"
            Height of the PDF viewer. Can be "stretch" for full height or an integer for pixel height.
        width : int or "stretch"
            Desired width of the PDF viewer. Can be "stretch" for full width or an integer for pixel width.

        Returns
        -------
        DeltaGenerator
            A DeltaGenerator object for chaining.

        Example
        -------
        >>> st.pdf("https://example.com/sample.pdf")
        >>> st.pdf("https://example.com/sample.pdf", width=500)
        """
        # Validate height and width parameters
        validate_height(height, allow_content=False)
        validate_width(width, allow_content=False)

        # Compute element ID first, like other elements do
        element_id = compute_and_register_element_id(
            "pdf",
            user_key=None,
            form_id=current_form_id(self.dg),
            dg=self.dg,
            data=str(data) if isinstance(data, (str, Path)) else "binary_data",
            height=height,
            width=width,
        )

        pdf_proto = PdfProto()
        pdf_proto.id = element_id

        # Create layout config for both width and height
        layout_config = LayoutConfig(width=width, height=height)

        _marshall_pdf(
            pdf_proto,
            data,
        )

        return self.dg._enqueue("pdf", pdf_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _marshall_pdf(
    proto: PdfProto,
    data: PdfData,
) -> None:
    """Marshall a PDF protobuf element."""

    # Handle the PDF data
    if isinstance(data, Path):
        data = str(data)  # Convert Path to string

    if isinstance(data, str):
        if url_util.is_url(data, allowed_schemas=("http", "https")):
            # It's a URL
            proto.url = data
        else:
            # It's a local file path - read and set as file_data
            try:
                with open(data, "rb") as f:
                    file_data = f.read()
                proto.file_data = file_data
            except Exception:
                raise ValueError(
                    "Could not read PDF file. Please check the URL or the file path."
                )
    elif isinstance(data, bytes):
        # Handle raw bytes - set directly as file_data
        proto.file_data = data
    elif hasattr(data, "read") and hasattr(data, "getvalue"):
        # Handle BytesIO and similar - set as file_data
        file_data = data.getvalue()
        proto.file_data = file_data
    elif hasattr(data, "read"):
        # Handle other file-like objects (including UploadedFile) - set as file_data
        file_data = data.read()
        proto.file_data = file_data
    else:
        raise ValueError(f"Unsupported data type for PDF: {type(data)}")
