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
from pathlib import Path

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitInvalidHeightError, StreamlitInvalidWidthError
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import (
    HeightConfigFields,
    WidthConfigFields,
)


class PdfTest(DeltaGeneratorTestCase):
    """Test ability to marshall PDF protos."""

    def test_pdf_url(self):
        """Test PDF with URL."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        st.pdf(url)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.url == url
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.PIXEL_HEIGHT.value
        )
        assert element.height_config.pixel_height == 500  # default height

    def test_pdf_with_height(self):
        """Test PDF with custom height."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        st.pdf(url, height=600)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.url == url
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.PIXEL_HEIGHT.value
        )
        assert element.height_config.pixel_height == 600

    def test_pdf_with_height_stretch(self):
        """Test PDF with stretch height."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        st.pdf(url, height="stretch")

        element = self.get_delta_from_queue().new_element
        assert element.pdf.url == url
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_STRETCH.value
        )
        assert element.height_config.use_stretch is True

    def test_pdf_with_width_pixels(self):
        """Test PDF with width in pixels."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        st.pdf(url, width=500)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.url == url
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 500

    def test_pdf_with_width_stretch(self):
        """Test PDF with stretch width."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        st.pdf(url, width="stretch")

        element = self.get_delta_from_queue().new_element
        assert element.pdf.url == url
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True

    def test_pdf_with_default_width(self):
        """Test PDF with default width."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        st.pdf(url)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.url == url
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True

    @parameterized.expand(
        [
            "invalid",
            "content",  # content is not allowed for PDF
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_pdf_with_invalid_width(self, width):
        """Test PDF with invalid width values."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        with pytest.raises(StreamlitInvalidWidthError) as e:
            st.pdf(url, width=width)
        assert "Invalid width" in str(e.value)

    @parameterized.expand(
        [
            "invalid",
            "content",  # content is not allowed for PDF
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_pdf_with_invalid_height(self, height):
        """Test PDF with invalid height values."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        with pytest.raises(StreamlitInvalidHeightError) as e:
            st.pdf(url, height=height)
        assert "Invalid height" in str(e.value)

    def test_pdf_with_both_width_and_height(self):
        """Test PDF with both width and height specified."""
        url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        st.pdf(url, width=400, height=300)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.url == url
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.PIXEL_HEIGHT.value
        )
        assert element.height_config.pixel_height == 300
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 400

    def test_pdf_with_bytes_data(self):
        """Test PDF with raw bytes data."""
        # Create some dummy PDF bytes (not a real PDF, but sufficient for testing)
        pdf_bytes = (
            b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n0000000000 65535"
            b"f \ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF"
        )
        st.pdf(pdf_bytes)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.file_data == pdf_bytes
        assert element.pdf.url == ""  # url should be empty when using file_data
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.PIXEL_HEIGHT.value
        )
        assert element.height_config.pixel_height == 500  # default height

    def test_pdf_with_bytesio_data(self):
        """Test PDF with BytesIO data."""
        # Create some dummy PDF bytes
        pdf_bytes = (
            b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n0000000000 65535"
            b"f \ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF"
        )
        pdf_bytesio = io.BytesIO(pdf_bytes)
        st.pdf(pdf_bytesio)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.file_data == pdf_bytes
        assert element.pdf.url == ""  # url should be empty when using file_data
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.PIXEL_HEIGHT.value
        )
        assert element.height_config.pixel_height == 500  # default height

    def test_pdf_with_file_like_object(self):
        """Test PDF with file-like object (simulating UploadedFile)."""

        # Create a mock file-like object
        class MockUploadedFile:
            def __init__(self, data):
                self._data = data

            def read(self):
                return self._data

        pdf_bytes = (
            b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n0000000000 65535"
            b"f \ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF"
        )
        mock_file = MockUploadedFile(pdf_bytes)
        st.pdf(mock_file)

        element = self.get_delta_from_queue().new_element
        assert element.pdf.file_data == pdf_bytes
        assert element.pdf.url == ""  # url should be empty when using file_data
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.PIXEL_HEIGHT.value
        )
        assert element.height_config.pixel_height == 500  # default height

    def test_pdf_with_path_object(self):
        """Test PDF with Path object."""
        # Create a temporary file to test with
        import os
        import tempfile

        pdf_bytes = (
            b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n0000000000 65535"
            b"f \ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF"
        )

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_file.write(pdf_bytes)
            tmp_file_path = tmp_file.name

        try:
            path_obj = Path(tmp_file_path)
            st.pdf(path_obj)

            element = self.get_delta_from_queue().new_element
            assert element.pdf.file_data == pdf_bytes
            assert element.pdf.url == ""  # url should be empty when using file_data
            assert (
                element.height_config.WhichOneof("height_spec")
                == HeightConfigFields.PIXEL_HEIGHT.value
            )
            assert element.height_config.pixel_height == 500  # default height
        finally:
            # Clean up the temporary file
            os.unlink(tmp_file_path)

    def test_pdf_with_local_file_path_string(self):
        """Test PDF with local file path as string."""
        # Create a temporary file to test with
        import os
        import tempfile

        pdf_bytes = (
            b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n0000000000 65535"
            b"f \ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF"
        )

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_file.write(pdf_bytes)
            tmp_file_path = tmp_file.name

        try:
            st.pdf(tmp_file_path)

            element = self.get_delta_from_queue().new_element
            assert element.pdf.file_data == pdf_bytes
            assert element.pdf.url == ""  # url should be empty when using file_data
            assert (
                element.height_config.WhichOneof("height_spec")
                == HeightConfigFields.PIXEL_HEIGHT.value
            )
            assert element.height_config.pixel_height == 500  # default height
        finally:
            # Clean up the temporary file
            os.unlink(tmp_file_path)

    def test_pdf_with_invalid_file_path(self):
        """Test PDF with invalid file path."""
        invalid_path = "/nonexistent/path/to/file.pdf"

        with pytest.raises(ValueError, match="Could not read PDF file"):
            st.pdf(invalid_path)

    def test_pdf_with_unsupported_data_type(self):
        """Test PDF with unsupported data type."""
        unsupported_data = {"not": "supported"}

        with pytest.raises(ValueError, match="Unsupported data type for PDF"):
            st.pdf(unsupported_data)

    def test_pdf_element_id_generation(self):
        """Test that PDF elements get unique IDs when they have different parameters."""
        url1 = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
        url2 = "https://example.com/different.pdf"

        st.pdf(url1)
        element1 = self.get_delta_from_queue().new_element

        st.pdf(url2)
        element2 = self.get_delta_from_queue().new_element

        # Elements should have different IDs when they have different parameters
        assert element1.pdf.id != element2.pdf.id
        assert element1.pdf.id != ""
        assert element2.pdf.id != ""
