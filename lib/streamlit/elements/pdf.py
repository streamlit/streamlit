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
from typing import TYPE_CHECKING, Any, Union, cast

from typing_extensions import TypeAlias

from streamlit import url_util
from streamlit.elements.lib.layout_utils import validate_height
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import HeightWithoutContent

PdfData: TypeAlias = Union[str, Path, bytes, io.BytesIO]


# Check if the custom PDF component is available
def _is_pdf_component_available() -> bool:
    """Check if the pdf-viewer component is installed."""
    try:
        import streamlit_pdf  # type: ignore # noqa: F401

        return True
    except ImportError:
        return False


def _get_pdf_component() -> Any:
    """Get the PDF custom component if available."""
    try:
        import streamlit_pdf  # type: ignore

        # Return the pdf_viewer function directly
        return streamlit_pdf.pdf_viewer
    except Exception:
        return None


class PdfMixin:
    @gather_metrics("pdf")  # type: ignore
    def pdf(
        self,
        data: PdfData,
        *,
        height: HeightWithoutContent = 500,
        key: str | None = None,
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

        Returns
        -------
        DeltaGenerator
            A DeltaGenerator object for chaining.

        Example
        -------
        >>> st.pdf("https://example.com/sample.pdf")
        >>> st.pdf("https://example.com/sample.pdf", height=600)
        """
        # Validate height parameter
        validate_height(height, allow_content=False)

        # Check if custom PDF component is available
        if _is_pdf_component_available():
            pdf_component = _get_pdf_component()
            if pdf_component is not None:
                return self._call_pdf_component(pdf_component, data, height, key)

        # Show warning if component is not available
        return self._show_pdf_warning()

    def _call_pdf_component(
        self,
        pdf_component: Any,
        data: PdfData,
        height: HeightWithoutContent,
        key: str | None,
    ) -> DeltaGenerator:
        """Call the custom PDF component with the provided data."""
        # Convert data to the format expected by pdf_viewer component
        file_param: str | bytes

        if isinstance(data, (str, Path)):
            data_str = str(data)
            if url_util.is_url(data_str, allowed_schemas=("http", "https")):
                # It's a URL - pass directly
                file_param = data_str
            else:
                # It's a local file path - pass as string, component will handle reading
                file_param = data_str
        elif isinstance(data, bytes):
            # Pass bytes directly
            file_param = data
        elif hasattr(data, "read") and hasattr(data, "getvalue"):
            # Handle BytesIO and similar
            file_param = data.getvalue()
        elif hasattr(data, "read"):
            # Handle other file-like objects
            file_param = data.read()
        else:
            raise ValueError(f"Unsupported data type for PDF: {type(data)}")

        # Convert height to appropriate format
        if height == "stretch":
            component_height = 500  # Default height when stretch
        else:
            component_height = height

        # Call the custom component with correct parameter names
        result = pdf_component(
            file=file_param,
            height=component_height,
            key=key,
        )
        return cast("DeltaGenerator", result)

    def _show_pdf_warning(self) -> DeltaGenerator:
        """Raise an exception that the PDF component is not available."""
        raise StreamlitAPIException(
            "The PDF viewer requires the `streamlit-pdf` component to be installed.\n\n"
            "Please run `pip install streamlit-pdf` to install it.\n\n"
            "For more information, see the Streamlit PDF documentation at "
            "https://docs.streamlit.io."
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
