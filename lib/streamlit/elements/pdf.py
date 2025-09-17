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


def _get_pdf_component() -> Any | None:
    """Get the PDF custom component if available.

    Returns
    -------
    Any | None
        The pdf_viewer function if the streamlit-pdf component is available,
        None otherwise.
    """
    try:
        import streamlit_pdf  # type: ignore

        return streamlit_pdf.pdf_viewer
    except ImportError:
        return None


class PdfMixin:
    @gather_metrics("pdf")
    def pdf(
        self,
        data: PdfData,
        *,
        height: HeightWithoutContent = 500,
        key: str | None = None,
    ) -> DeltaGenerator:
        """Display a PDF viewer.

        .. Important::

            You must install |streamlit-pdf|_ to use this command. You can
            install it as an extra with Streamlit:

            .. code-block:: shell

                pip install streamlit[pdf]

        .. |streamlit-pdf| replace:: ``streamlit-pdf``
        .. _streamlit-pdf: https://github.com/streamlit/streamlit-pdf

        Parameters
        ----------
        data : str, Path, BytesIO, or bytes
            The PDF file to show. This can be one of the following:

            - A URL (string) for a hosted PDF file.
            - A path to a local PDF file. If you use a relative path, it must
              be relative to the current working directory.
            - A file-like object. For example, this can be an ``UploadedFile``
              from ``st.file_uploader``, or this can be a local file opened
              with ``open()``.
            - Raw bytes data.

        height : int or "stretch"
            The height of the PDF viewer. This can be one of the following:

            - An integer specifying the height in pixels: The viewer has a
              fixed height. If the content is larger than the specified
              height, scrolling is enabled. This is ``500`` by default.
            - ``"stretch"``: The height of the viewer matches the height of
              its content or the height of the parent container, whichever is
              larger. If the viewer is not in a parent container, the height
              of the viewer matches the height of its content.

        Example
        -------
        >>> st.pdf("https://example.com/sample.pdf")
        >>> st.pdf("https://example.com/sample.pdf", height=600)
        """
        # Validate data parameter early
        if data is None:
            raise StreamlitAPIException(
                "The PDF data cannot be None. Please provide a valid PDF file path, URL, "
                "bytes data, or file-like object."
            )

        # Check if custom PDF component is available first
        pdf_component = _get_pdf_component()
        if pdf_component is None:
            return self._show_pdf_warning()

        return self._call_pdf_component(pdf_component, data, height, key)

    def _call_pdf_component(
        self,
        pdf_component: Any,
        data: PdfData,
        height: HeightWithoutContent,
        key: str | None,
    ) -> DeltaGenerator:
        """Call the custom PDF component with the provided data."""
        # Validate height parameter after confirming component is available
        validate_height(height, allow_content=False)

        # Convert data to the format expected by pdf_viewer component
        file_param: str | bytes

        if isinstance(data, (str, Path)):
            data_str = str(data).strip()  # Strip whitespace from URLs
            if url_util.is_url(data_str, allowed_schemas=("http", "https")):
                # It's a URL - pass directly
                file_param = data_str
            else:
                # It's a local file path - read the content as bytes for security
                try:
                    with open(data_str, "rb") as file:
                        file_param = file.read()
                except (FileNotFoundError, PermissionError) as e:
                    raise StreamlitAPIException(
                        f"Unable to read file '{data_str}': {e}"
                    )

        elif isinstance(data, bytes):
            # Pass bytes directly - the component will handle uploading to media storage
            file_param = data
        elif hasattr(data, "read") and hasattr(data, "getvalue"):
            # Handle BytesIO and similar
            file_param = data.getvalue()
        elif hasattr(data, "read"):
            # Handle other file-like objects
            file_param = data.read()
        else:
            # Provide a more helpful error message
            raise StreamlitAPIException(
                f"Unsupported data type for PDF: {type(data).__name__}. "
                f"Please provide a file path (str or Path), URL (str), bytes data, "
                f"or file-like object (such as BytesIO or UploadedFile)."
            )

        # Convert to component-compatible format
        if height == "stretch":
            # For stretch, we need to pass a special value the component understands
            # This maintains compatibility with the component while using standard layout
            component_height = "stretch"
        else:
            component_height = str(height)

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
            "Please run `pip install streamlit[pdf]` to install it.\n\n"
            "For more information, see the Streamlit PDF documentation at "
            "https://docs.streamlit.io/develop/api-reference/media/st.pdf."
            # TODO: Update this URL when docs are updated
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
