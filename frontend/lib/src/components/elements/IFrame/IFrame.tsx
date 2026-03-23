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
import { memo, ReactElement, useEffect, useRef, useState } from "react"

import { IFrame as IFrameProto, streamlit } from "@streamlit/protobuf"

import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "~lib/util/IFrameUtil"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import { StyledIframe } from "./styled-components"

/** Message type for iframe size reporting. */
const IFRAME_SIZE_MESSAGE_TYPE = "streamlit:iframe:setSize"

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
  width: number | null
  height: number | null
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

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [contentDimensions, setContentDimensions] =
    useState<ContentDimensions>({ width: null, height: null })

  // Determine if we should use content-based sizing
  const useContentWidth = widthConfig?.useContent ?? false
  const useContentHeight = heightConfig?.useContent ?? false
  const shouldMeasureContent =
    notNullOrUndefined(srcDoc) && (useContentWidth || useContentHeight)

  // Listen for size messages from the iframe content when content sizing is enabled
  useEffect(() => {
    if (!shouldMeasureContent) {
      // When measurement is disabled, we don't need to listen for messages.
      // Stale dimensions are not a concern because dimensionStyles only uses them
      // when shouldMeasureContent is true (see below).
      return
    }

    const handleMessage = (event: MessageEvent): void => {
      // Verify the message is from our iframe (truthy guard prevents matching when both are null)
      if (event.source && event.source === iframeRef.current?.contentWindow) {
        const data = event.data as {
          type?: string
          width?: number
          height?: number
        }
        // Validate dimensions: must be finite numbers >= 0 to prevent invalid CSS values
        if (
          data?.type === IFRAME_SIZE_MESSAGE_TYPE &&
          typeof data?.width === "number" &&
          typeof data?.height === "number" &&
          Number.isFinite(data.width) &&
          Number.isFinite(data.height) &&
          data.width >= 0 &&
          data.height >= 0
        ) {
          // After validation above, we know width and height are numbers
          const newWidth = data.width
          const newHeight = data.height
          setContentDimensions(prev => {
            if (prev.width === newWidth && prev.height === newHeight) {
              return prev
            }
            return { width: newWidth, height: newHeight }
          })
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [shouldMeasureContent])

  // Derive dimension styles from content measurement.
  // We use inline styles here because the width/height values are dynamic pixel values
  // received via postMessage from the iframe content.
  const dimensionStyles: React.CSSProperties = {}
  if (shouldMeasureContent) {
    if (useContentWidth && contentDimensions.width !== null) {
      dimensionStyles.width = `${contentDimensions.width}px`
    }
    if (useContentHeight && contentDimensions.height !== null) {
      dimensionStyles.height = `${contentDimensions.height}px`
    }
  }

  return (
    <StyledIframe
      ref={iframeRef}
      className="stIFrame"
      data-testid="stIFrame"
      allow={DEFAULT_IFRAME_FEATURE_POLICY}
      disableScrolling={!element.scrolling}
      src={src}
      srcDoc={srcDoc}
      scrolling={element.scrolling ? "auto" : "no"}
      sandbox={DEFAULT_IFRAME_SANDBOX_POLICY}
      title="st.iframe"
      tabIndex={element.tabIndex ?? undefined}
      style={dimensionStyles}
    />
  )
}

export default memo(IFrame)
