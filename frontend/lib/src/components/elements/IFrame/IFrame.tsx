/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
import {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { IFrame as IFrameProto, streamlit } from "@streamlit/protobuf"

import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "~lib/util/IFrameUtil"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import { StyledIframe } from "./styled-components"

/**
 * Return a string property from an element. If the string is
 * null or empty, return undefined instead.
 */
function getNonEmptyString(
  value: string | null | undefined
): string | undefined {
  return isNullOrUndefined(value) || value === "" ? undefined : value
}

export interface IFrameProps {
  element: IFrameProto
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}

interface ContentDimensions {
  width?: number
  height?: number
}

/**
 * Return the iframe document when it is accessible.
 */
function getIframeDocument(
  iframe: HTMLIFrameElement | null
): Document | undefined {
  if (!iframe?.contentWindow) {
    return undefined
  }

  return iframe.contentDocument ?? iframe.contentWindow.document
}

/**
 * Measure the content dimensions of an iframe document.
 */
function getContentDimensions(document: Document): ContentDimensions {
  const { body, documentElement } = document

  const height = Math.ceil(
    Math.max(
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      body?.clientHeight ?? 0,
      documentElement?.scrollHeight ?? 0,
      documentElement?.offsetHeight ?? 0,
      documentElement?.clientHeight ?? 0
    )
  )

  const width = Math.ceil(
    Math.max(
      body?.scrollWidth ?? 0,
      body?.offsetWidth ?? 0,
      body?.clientWidth ?? 0,
      documentElement?.scrollWidth ?? 0,
      documentElement?.offsetWidth ?? 0,
      documentElement?.clientWidth ?? 0
    )
  )

  return {
    height: height > 0 ? height : undefined,
    width: width > 0 ? width : undefined,
  }
}

function IFrame({
  element,
  widthConfig,
  heightConfig,
}: Readonly<IFrameProps>): ReactElement {
  // Either 'src' or 'srcDoc' will be set in our element. If 'src'
  // is set, we're loading a remote URL in the iframe.
  const src = getNonEmptyString(element.src)
  const srcDoc = notNullOrUndefined(src)
    ? undefined
    : getNonEmptyString(element.srcdoc)
  const shouldUseContentWidth = widthConfig?.useContent ?? false
  const shouldUseContentHeight = heightConfig?.useContent ?? false
  const canMeasureContent =
    notNullOrUndefined(srcDoc) &&
    (shouldUseContentWidth || shouldUseContentHeight)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [contentDimensions, setContentDimensions] =
    useState<ContentDimensions>({})

  const disconnectResizeObserver = useCallback((): void => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
  }, [])

  const updateContentDimensions = useCallback((): void => {
    if (!canMeasureContent) {
      return
    }

    const document = getIframeDocument(iframeRef.current)
    if (!document) {
      return
    }

    const nextDimensions = getContentDimensions(document)
    setContentDimensions(prevDimensions => {
      if (
        prevDimensions.height === nextDimensions.height &&
        prevDimensions.width === nextDimensions.width
      ) {
        return prevDimensions
      }

      return nextDimensions
    })
  }, [canMeasureContent])

  const observeContentDimensions = useCallback((): void => {
    disconnectResizeObserver()

    if (!canMeasureContent || typeof ResizeObserver === "undefined") {
      return
    }

    const document = getIframeDocument(iframeRef.current)
    const documentElement = document?.documentElement
    if (!documentElement) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      updateContentDimensions()
    })

    resizeObserver.observe(documentElement)
    if (document.body && document.body !== documentElement) {
      resizeObserver.observe(document.body)
    }

    resizeObserverRef.current = resizeObserver
  }, [canMeasureContent, disconnectResizeObserver, updateContentDimensions])

  const handleLoad = useCallback((): void => {
    updateContentDimensions()
    observeContentDimensions()
  }, [observeContentDimensions, updateContentDimensions])

  useEffect(() => {
    if (!canMeasureContent) {
      disconnectResizeObserver()
      setContentDimensions({})
      return undefined
    }

    const iframe = iframeRef.current
    if (iframe?.contentDocument?.readyState === "complete") {
      updateContentDimensions()
      observeContentDimensions()
    }

    return () => {
      disconnectResizeObserver()
    }
  }, [
    canMeasureContent,
    disconnectResizeObserver,
    observeContentDimensions,
    srcDoc,
    updateContentDimensions,
  ])

  return (
    <StyledIframe
      ref={iframeRef}
      className="stIFrame"
      data-testid="stIFrame"
      allow={DEFAULT_IFRAME_FEATURE_POLICY}
      contentHeight={contentDimensions.height}
      contentWidth={contentDimensions.width}
      disableScrolling={!element.scrolling}
      onLoad={handleLoad}
      src={src}
      srcDoc={srcDoc}
      scrolling={element.scrolling ? "auto" : "no"}
      sandbox={DEFAULT_IFRAME_SANDBOX_POLICY}
      title="st.iframe"
      tabIndex={element.tabIndex ?? undefined}
      useContentHeight={shouldUseContentHeight}
      useContentWidth={shouldUseContentWidth}
    />
  )
}

export default memo(IFrame)
