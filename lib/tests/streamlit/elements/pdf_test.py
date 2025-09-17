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

"""PDF element unit test."""

import io
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.pdf import _get_pdf_component
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PdfComponentAvailabilityTest(DeltaGeneratorTestCase):
    """Test the PDF component availability check."""

    def test_pdf_component_available(self):
        """Test when PDF component is available."""
        with patch(
            "streamlit.elements.pdf._get_pdf_component", return_value=lambda: None
        ):
            assert _get_pdf_component() is not None

    def test_pdf_component_not_available(self):
        """Test when PDF component is not available."""
        # Import the module so we can access the function through it
        from streamlit.elements import pdf as pdf_module

        with patch.object(pdf_module, "_get_pdf_component", return_value=None):
            assert pdf_module._get_pdf_component() is None

    def test_pdf_component_import_error(self):
        """Test when PDF component import fails - checking behavior."""
        # Simply test that st.pdf raises the appropriate error when component is not available
        with patch("streamlit.elements.pdf._get_pdf_component", return_value=None):
            with pytest.raises(StreamlitAPIException) as exc_info:
                st.pdf(b"dummy pdf data")

            assert "streamlit[pdf]" in str(exc_info.value)
            assert "pip install" in str(exc_info.value)

    def test_pdf_raises_when_component_not_available(self):
        """Test that st.pdf raises an appropriate error when component is not available."""
        with patch("streamlit.elements.pdf._get_pdf_component", return_value=None):
            with pytest.raises(StreamlitAPIException) as exc_info:
                st.pdf("https://example.com/fake.pdf")

            assert "streamlit[pdf]" in str(exc_info.value)
            assert "pip install streamlit[pdf]" in str(exc_info.value)


class PdfTest(DeltaGeneratorTestCase):
    """Test ability to marshall PDF protos."""

    # Dummy PDF bytes for testing (not a real PDF, but sufficient for testing)
    DUMMY_PDF_BYTES = (
        b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n0000000000 65535"
        b"f \ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF"
    )

    def test_pdf_url(self):
        """Test PDF with URL."""
        # Use a fake URL to avoid dependency on external resources
        url = "https://example.com/fake-document.pdf"
        st.pdf(url)

        element = self.get_delta_from_queue().new_element
        assert element.component_instance.component_name == "streamlit_pdf.pdf_viewer"

        # Parse the JSON args to check the parameters
        json_args = json.loads(element.component_instance.json_args)
        assert json_args["file"] == url
        assert json_args["height"] == "500"  # Height is converted to string
        assert json_args["key"] is None

    def test_pdf_with_height(self):
        """Test PDF with custom height."""
        url = "https://example.com/fake-document.pdf"
        st.pdf(url, height=600)

        element = self.get_delta_from_queue().new_element
        assert element.component_instance.component_name == "streamlit_pdf.pdf_viewer"

        json_args = json.loads(element.component_instance.json_args)
        assert json_args["file"] == url
        assert json_args["height"] == "600"  # Height is converted to string

    def test_pdf_with_height_stretch(self):
        """Test PDF with stretch height."""
        url = "https://example.com/fake-document.pdf"
        st.pdf(url, height="stretch")

        element = self.get_delta_from_queue().new_element
        assert element.component_instance.component_name == "streamlit_pdf.pdf_viewer"

        json_args = json.loads(element.component_instance.json_args)
        assert json_args["file"] == url
        assert (
            json_args["height"] == "stretch"
        )  # stretch is passed as "stretch" to component

    def test_pdf_with_bytes_data(self):
        """Test PDF with raw bytes data."""
        st.pdf(self.DUMMY_PDF_BYTES)

        element = self.get_delta_from_queue().new_element
        assert element.component_instance.component_name == "streamlit_pdf.pdf_viewer"

        # Check that bytes are uploaded to media storage and passed as URL
        json_args = json.loads(element.component_instance.json_args)
        assert json_args["file"].startswith("/media/")  # Media URL
        assert json_args["height"] == "500"

    def test_pdf_with_bytesio_data(self):
        """Test PDF with BytesIO data."""
        pdf_bytesio = io.BytesIO(self.DUMMY_PDF_BYTES)
        st.pdf(pdf_bytesio)

        element = self.get_delta_from_queue().new_element
        assert element.component_instance.component_name == "streamlit_pdf.pdf_viewer"

        # Check that bytes are uploaded to media storage and passed as URL
        json_args = json.loads(element.component_instance.json_args)
        assert json_args["file"].startswith("/media/")  # Media URL
        assert json_args["height"] == "500"

    def test_pdf_with_file_like_object(self):
        """Test PDF with file-like object (simulating UploadedFile)."""

        # Create a mock file-like object
        class MockUploadedFile:
            def __init__(self, data):
                self._data = data

            def read(self):
                return self._data

        mock_file = MockUploadedFile(self.DUMMY_PDF_BYTES)
        st.pdf(mock_file)

        element = self.get_delta_from_queue().new_element
        assert element.component_instance.component_name == "streamlit_pdf.pdf_viewer"

        # Check that bytes are uploaded to media storage and passed as URL
        json_args = json.loads(element.component_instance.json_args)
        assert json_args["file"].startswith("/media/")  # Media URL
        assert json_args["height"] == "500"

    def test_pdf_with_path_object(self):
        """Test PDF with Path object."""
        # Create a temporary file to test with
        import os
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_file.write(self.DUMMY_PDF_BYTES)
            tmp_file_path = tmp_file.name

        try:
            path_obj = Path(tmp_file_path)
            st.pdf(path_obj)

            element = self.get_delta_from_queue().new_element
            assert (
                element.component_instance.component_name == "streamlit_pdf.pdf_viewer"
            )

            json_args = json.loads(element.component_instance.json_args)
            # For file paths, the content is uploaded to media storage
            assert json_args["file"].startswith("/media/")  # Media URL
            assert json_args["height"] == "500"
        finally:
            # Clean up the temporary file
            os.unlink(tmp_file_path)

    def test_pdf_with_local_file_path_string(self):
        """Test PDF with local file path as string."""
        # Create a temporary file to test with
        import os
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_file.write(self.DUMMY_PDF_BYTES)
            tmp_file_path = tmp_file.name

        try:
            st.pdf(tmp_file_path)

            element = self.get_delta_from_queue().new_element
            assert (
                element.component_instance.component_name == "streamlit_pdf.pdf_viewer"
            )

            json_args = json.loads(element.component_instance.json_args)
            # For file paths, the content is uploaded to media storage
            assert json_args["file"].startswith("/media/")  # Media URL
            assert json_args["height"] == "500"
        finally:
            # Clean up the temporary file
            os.unlink(tmp_file_path)

    def test_pdf_with_invalid_file_path(self):
        """Test PDF with invalid file path."""
        invalid_path = "/nonexistent/path/to/file.pdf"

        with pytest.raises(
            StreamlitAPIException, match=f"Unable to read file '{invalid_path}'"
        ):
            st.pdf(invalid_path)

    def test_pdf_with_none_data(self):
        """Test PDF with None data."""
        with pytest.raises(StreamlitAPIException, match="The PDF data cannot be None"):
            st.pdf(None)

    def test_pdf_with_unsupported_data_type(self):
        """Test PDF with unsupported data type."""
        unsupported_data = {"not": "supported"}

        with pytest.raises(
            StreamlitAPIException, match="Unsupported data type for PDF"
        ):
            st.pdf(unsupported_data)

    @parameterized.expand(
        [
            "invalid",
            "content",  # content is not allowed for PDF
            -100,
            0,
            100.5,
        ]
    )
    def test_pdf_with_invalid_height(self, height):
        """Test PDF with invalid height values."""
        url = "https://example.com/fake-document.pdf"
        with pytest.raises(StreamlitAPIException) as e:
            st.pdf(url, height=height)
        assert "Invalid height" in str(e.value)

    def test_pdf_element_id_generation(self):
        """Test that PDF elements get unique IDs when they have different parameters."""
        url1 = "https://example.com/document1.pdf"
        url2 = "https://example.com/document2.pdf"

        st.pdf(url1)
        element1 = self.get_delta_from_queue().new_element

        st.pdf(url2)
        element2 = self.get_delta_from_queue().new_element

        # Elements should have different IDs when they have different parameters
        assert element1.component_instance.id != element2.component_instance.id
        assert element1.component_instance.id != ""
        assert element2.component_instance.id != ""

    def test_pdf_with_key(self):
        """Test PDF with custom key."""
        url = "https://example.com/fake-document.pdf"
        st.pdf(url, key="test_key")

        element = self.get_delta_from_queue().new_element
        assert element.component_instance.component_name == "streamlit_pdf.pdf_viewer"

        json_args = json.loads(element.component_instance.json_args)
        assert json_args["key"] == "test_key"

    def test_pdf_height_as_integer_gets_stringified(self):
        """Test that integer height values are converted to strings for the component."""
        url = "https://example.com/fake-document.pdf"
        st.pdf(url, height=450)

        element = self.get_delta_from_queue().new_element
        json_args = json.loads(element.component_instance.json_args)
        # Component should receive height as string
        assert json_args["height"] == "450"
        assert isinstance(json_args["height"], str)
