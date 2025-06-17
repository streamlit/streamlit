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

import React, { memo, ReactElement, useMemo, useState, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"

// Import react-pdf stylesheets for proper text and annotation layer rendering
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

import { IPdf, streamlit } from "@streamlit/protobuf"

import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"

import {
  StyledPdf,
  StyledReactPdfContainer,
  StyledReactPdfPage,
} from "./styled-components"

// Configure PDF.js worker to use local assets served by the app
pdfjs.GlobalWorkerOptions.workerSrc = "/src/assets/pdf.worker.min.mjs"

export interface PdfProps {
  element: IPdf
  endpoints: StreamlitEndpoints
  widthConfig?: streamlit.IWidthConfig
}

function Pdf({
  element,
  endpoints,
  widthConfig,
}: Readonly<PdfProps>): ReactElement {
  const { useExtModule } = element

  // State for react-pdf
  const [numPages, setNumPages] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  // Determine the PDF source
  const { pdfUrl, pdfFileData } = useMemo((): {
    pdfUrl: string | null
    pdfFileData: { data: Uint8Array } | null
  } => {
    if (element.url) {
      // Handle URL case
      const url = element.url.startsWith("http")
        ? element.url
        : endpoints.buildMediaURL(element.url)
      return { pdfUrl: url, pdfFileData: null }
    } else if (element.fileData) {
      if (useExtModule) {
        // For react-pdf, return the raw data wrapped in the expected format
        return { pdfUrl: null, pdfFileData: { data: element.fileData } }
      } else {
        // For object, create blob URL
        try {
          const blob = new Blob([element.fileData], {
            type: "application/pdf",
          })
          const url = URL.createObjectURL(blob)
          setBlobUrl(url)
          return { pdfUrl: url, pdfFileData: null }
        } catch (error) {
          console.error("Error creating blob:", error)
          return { pdfUrl: null, pdfFileData: null }
        }
      }
    }
    return { pdfUrl: null, pdfFileData: null }
  }, [element.url, element.fileData, endpoints, useExtModule])

  // Legacy pdfSource for compatibility
  const pdfSource = pdfUrl || (pdfFileData ? "file-data" : "")

  // Cleanup blob URL when component unmounts or source changes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  // Use the PDF URL directly for iframe rendering
  const iframePdfUrl = useMemo(() => {
    return pdfUrl || ""
  }, [pdfUrl])

  // Memoize options to prevent re-renders - using local assets
  const options = useMemo(
    () => ({
      cMapUrl: null,
      cMapPacked: false,
      standardFontDataUrl: null,
    }),
    []
  )

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoadError(null) // Clear any previous errors
  }

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error)
    if (error.message.includes("CORS") || error.message.includes("fetch")) {
      setLoadError(
        "CORS Error: This PDF cannot be loaded due to cross-origin restrictions. "
      )
    } else if (error.message.includes("Unexpected server response (0)")) {
      setLoadError(
        "Blob Error: Failed to load PDF from blob data. The uploaded file may be corrupted or not a valid PDF."
      )
    } else {
      setLoadError(`Failed to load PDF: ${error.message}`)
    }
  }

  if (!pdfSource) {
    return (
      <div
        style={{
          padding: "20px",
          color: "#ff4b4b",
          backgroundColor: "#fff2f2",
          border: "1px solid #ffcccb",
          borderRadius: "4px",
          margin: "10px",
        }}
      >
        <strong>Error:</strong> No PDF source provided (URL or file data).
      </div>
    )
  }

  if (useExtModule) {
    // Use react-pdf for rendering
    return (
      <StyledReactPdfContainer
        className="stPdf"
        data-testid="stPdf"
        widthConfig={widthConfig || undefined}
      >
        {loadError ? (
          <div
            style={{
              padding: "20px",
              color: "#ff4b4b",
              backgroundColor: "#fff2f2",
              border: "1px solid #ffcccb",
              borderRadius: "4px",
              margin: "10px",
            }}
          >
            <strong>Error loading PDF:</strong>
            <br />
            {loadError}
          </div>
        ) : (
          <Document
            file={pdfFileData || pdfUrl || undefined}
            options={options}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div style={{ padding: "20px", textAlign: "center" }}>
                Loading PDF...
              </div>
            }
            error={
              <div style={{ padding: "20px", color: "#ff4b4b" }}>
                Failed to load PDF file.
              </div>
            }
          >
            {Array.from(new Array(numPages), (el, index) => (
              <StyledReactPdfPage key={`page_${index + 1}`}>
                <Page
                  pageNumber={index + 1}
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                />
              </StyledReactPdfPage>
            ))}
          </Document>
        )}
      </StyledReactPdfContainer>
    )
  }

  return (
    <StyledPdf
      className="stPdf"
      data-testid="stPdf"
      widthConfig={widthConfig || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <iframe
        src={iframePdfUrl}
        title="PDF Viewer"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          flex: 1,
          minHeight: 0,
        }}
        onError={() => {
          console.error("Failed to load PDF in iframe")
        }}
      />
    </StyledPdf>
  )
}

export default memo(Pdf)
