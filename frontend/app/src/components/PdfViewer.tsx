/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState } from "react"
import { Document, Page } from "react-pdf"
import { pdfOptions } from "../utils/pdfjs-config"

// Import required CSS for annotations and text layer
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

interface PdfViewerProps {
  file: string | File | null
  width?: number
  height?: number
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  file,
  width = 600,
  height = 800,
}) => {
  const [numPages, setNumPages] = useState<number>()
  const [pageNumber, setPageNumber] = useState<number>(1)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }): void => {
    setNumPages(numPages)
  }

  const goToPrevPage = (): void => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = (): void => {
    setPageNumber(prev => Math.min(prev + 1, numPages || 1))
  }

  if (!file) {
    return <div>No PDF file selected</div>
  }

  return (
    <div style={{ textAlign: "center" }}>
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        options={pdfOptions}
        loading={<div>Loading PDF...</div>}
        error={<div>Failed to load PDF file.</div>}
      >
        <Page
          pageNumber={pageNumber}
          width={width}
          height={height}
          renderAnnotationLayer={true}
          renderTextLayer={true}
        />
      </Document>

      {numPages && (
        <div style={{ marginTop: "10px" }}>
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            style={{ marginRight: "10px" }}
          >
            Previous
          </button>
          <span>
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            style={{ marginLeft: "10px" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
