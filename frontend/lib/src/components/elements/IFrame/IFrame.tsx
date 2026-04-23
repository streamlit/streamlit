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
 * Default height fallback when height="content" is used with URLs.
 * Cross-origin restrictions prevent measuring content height for external URLs,
 * so we fall back to a reasonable default.
 */
const DEFAULT_URL_HEIGHT_FALLBACK = "25rem"

/**
 * JavaScript snippet injected into srcdoc for auto-sizing measurement.
 * Measures document dimensions and posts them to the parent window.
 * Re-measures on DOM mutations, window resize, and load events.
 * Uses Math.ceil() on getBoundingClientRect to handle fractional pixels correctly.
 */
const AUTO_SIZE_SCRIPT = `<script>
(function() {
  var lastW = 0, lastH = 0;
  function sendSize() {
    // Guard against malformed HTML (e.g., <frameset>) or script running before body init
    if (!document.body) return;
    // Use getBoundingClientRect for accurate fractional pixel measurement,
    // then ceil to avoid scrollbars from sub-pixel rounding
    var rect = document.body.getBoundingClientRect();
    var w = Math.ceil(Math.max(
      rect.width,
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    ));
    var h = Math.ceil(Math.max(
      rect.height,
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    ));
    if (w !== lastW || h !== lastH) {
      lastW = w; lastH = h;
      // Note: postMessage with '*' broadcasts to any origin, but this is safe because:
      // 1. This script only runs inside srcdoc (same-origin, sandboxed)
      // 2. The payload is just dimension integers
      // 3. The frontend receiver validates event.source === iframe.contentWindow
      window.parent.postMessage({type: '${IFRAME_SIZE_MESSAGE_TYPE}', width: w, height: h}, '*');
    }
  }
  // Send initial size after DOM is ready
  if (document.readyState === 'complete') {
    sendSize();
  } else {
    window.addEventListener('load', sendSize);
  }
  // Re-measure on DOM changes
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(sendSize).observe(document.body, {
      childList: true, subtree: true, attributes: true, characterData: true
    });
  }
  // Re-measure on resize and image/font loading
  window.addEventListener('resize', sendSize);
  document.addEventListener('load', sendSize, true);
})();
</script>`

/** Inject the auto-size measurement script into HTML content. */
function injectAutoSizeScript(html: string): string {
  return html + AUTO_SIZE_SCRIPT
}

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
  const rawSrcDoc = notNullOrUndefined(src)
    ? undefined
    : getNonEmptyString(element.srcdoc)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [contentDimensions, setContentDimensions] =
    useState<ContentDimensions>({ width: null, height: null })

  // Determine if we should use content-based sizing
  const useContentWidth = widthConfig?.useContent ?? false
  const useContentHeight = heightConfig?.useContent ?? false
  const shouldMeasureContent =
    notNullOrUndefined(rawSrcDoc) && (useContentWidth || useContentHeight)

  // Inject the auto-size script when content measurement is enabled
  // When shouldMeasureContent is true, rawSrcDoc is guaranteed to be defined (non-null)
  // because shouldMeasureContent requires notNullOrUndefined(rawSrcDoc) above
  const srcDoc = shouldMeasureContent
    ? injectAutoSizeScript(rawSrcDoc)
    : rawSrcDoc

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

  // Derive content-based dimensions when measurement is enabled
  const contentWidth =
    shouldMeasureContent && useContentWidth && contentDimensions.width !== null
      ? `${contentDimensions.width}px`
      : undefined

  // For height: use measured content height for srcdoc, or fallback for URLs
  let contentHeight: string | undefined
  if (useContentHeight) {
    if (shouldMeasureContent && contentDimensions.height !== null) {
      // srcdoc with measured height
      contentHeight = `${contentDimensions.height}px`
    } else if (notNullOrUndefined(src)) {
      // URL: can't measure due to cross-origin, use fallback
      contentHeight = DEFAULT_URL_HEIGHT_FALLBACK
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
      width={contentWidth}
      height={contentHeight}
    />
  )
}

export default memo(IFrame)
