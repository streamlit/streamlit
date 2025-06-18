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

import React, {
  memo,
  ReactElement,
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react"
import { Document, Page, pdfjs } from "react-pdf"

// Import react-pdf stylesheets for proper text and annotation layer rendering
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

import { IPdf, streamlit } from "@streamlit/protobuf"

import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import Toolbar from "~lib/components/shared/Toolbar"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { withFullScreenWrapper } from "~lib/components/shared/FullScreenWrapper"

import {
  StyledPdfWithToolbar,
  StyledReactPdfContainer,
  StyledReactPdfPage,
} from "./styled-components"

// Configure PDF.js worker to use the worker from node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

export interface PdfProps {
  element: IPdf
  endpoints: StreamlitEndpoints
  widthConfig?: streamlit.IWidthConfig
  disableFullscreenMode?: boolean
}

function Pdf({
  element,
  endpoints,
  widthConfig,
  disableFullscreenMode,
}: Readonly<PdfProps>): ReactElement {
  // Get fullscreen context
  const {
    expanded: isFullScreen,
    width,
    height,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  // State for react-pdf
  const [numPages, setNumPages] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Enhanced page preservation using visible page tracking
  const containerRef = useRef<HTMLDivElement>(null)
  const savedScrollRatio = useRef<number>(0) // Store scroll as ratio of total height
  const isRestoringPosition = useRef<boolean>(false)
  const lastFullScreenState = useRef<boolean>(isFullScreen)

  // Function to calculate which page is currently visible
  const getCurrentScrollRatio = useCallback(() => {
    if (!containerRef.current) return 0
    const container = containerRef.current
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight

    if (scrollHeight <= clientHeight) return 0
    return scrollTop / (scrollHeight - clientHeight)
  }, [])

  // Function to restore scroll position based on ratio
  const restoreScrollRatio = useCallback((ratio: number) => {
    if (!containerRef.current) return
    const container = containerRef.current
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight

    if (scrollHeight > clientHeight) {
      const targetScrollTop = ratio * (scrollHeight - clientHeight)
      container.scrollTop = targetScrollTop
    }
  }, [])

  // Custom fullscreen handlers with improved page preservation
  const handleExpand = () => {
    // Save current scroll ratio before entering fullscreen
    if (containerRef.current) {
      savedScrollRatio.current = getCurrentScrollRatio()
      console.log("Saving scroll ratio:", savedScrollRatio.current)
    }
    if (expand) {
      expand()
    }
  }

  const handleCollapse = () => {
    // Save current scroll ratio before exiting fullscreen
    if (containerRef.current) {
      savedScrollRatio.current = getCurrentScrollRatio()
      console.log("Saving scroll ratio:", savedScrollRatio.current)
    }
    if (collapse) {
      collapse()
    }
  }

  // Effect to restore scroll position when fullscreen state changes
  useEffect(() => {
    // Check if fullscreen state actually changed
    if (
      lastFullScreenState.current !== isFullScreen &&
      !isRestoringPosition.current
    ) {
      isRestoringPosition.current = true

      const attemptRestore = () => {
        if (containerRef.current && savedScrollRatio.current >= 0) {
          restoreScrollRatio(savedScrollRatio.current)
          console.log("Restoring scroll ratio:", savedScrollRatio.current)
        }
      }

      // Multiple restoration attempts with increasing delays
      const timeouts = [0, 100, 250, 500, 750, 1000]
      timeouts.forEach((delay, index) => {
        setTimeout(() => {
          attemptRestore()
          if (index === timeouts.length - 1) {
            isRestoringPosition.current = false
          }
        }, delay)
      })
    }

    lastFullScreenState.current = isFullScreen
  }, [isFullScreen, numPages, restoreScrollRatio])

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
      // For react-pdf, return the raw data wrapped in the expected format
      return { pdfUrl: null, pdfFileData: { data: element.fileData } }
    }
    return { pdfUrl: null, pdfFileData: null }
  }, [element.url, element.fileData, endpoints])

  // Legacy pdfSource for compatibility
  const pdfSource = pdfUrl || (pdfFileData ? "file-data" : "")

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

  // Use react-pdf for rendering
  return (
    <StyledPdfWithToolbar isFullScreen={isFullScreen}>
      <Toolbar
        isFullScreen={isFullScreen}
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        disableFullscreenMode={disableFullscreenMode}
        locked={true}
      />
      <StyledReactPdfContainer
        ref={containerRef}
        className="stPdf"
        data-testid="stPdf"
        widthConfig={widthConfig || undefined}
        isFullScreen={isFullScreen}
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
    </StyledPdfWithToolbar>
  )
}

const PdfWithFullScreenWrapper = withFullScreenWrapper(Pdf)
export default memo(PdfWithFullScreenWrapper)
