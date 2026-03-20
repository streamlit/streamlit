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

import { IFrame as IFrameProto } from "@streamlit/protobuf"

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
}

function IFrame({ element }: Readonly<IFrameProps>): ReactElement {
  // Either 'src' or 'srcDoc' will be set in our element. If 'src'
  // is set, we're loading a remote URL in the iframe.
  const src = getNonEmptyString(element.src)
  const srcDoc = notNullOrUndefined(src)
    ? undefined
    : getNonEmptyString(element.srcdoc)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined
  )

  const handleIframeLoad = useCallback((): void => {
    if (!element.contentHeight || !iframeRef.current) {
      return
    }

    try {
      const iframeDoc = iframeRef.current.contentDocument
      if (!iframeDoc) {
        return
      }

      observerRef.current?.disconnect()

      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          const height = entry.borderBoxSize?.[0]?.blockSize ?? 0
          if (height > 0) {
            setContentHeight(height)
          }
        }
      })
      observer.observe(iframeDoc.documentElement)
      observerRef.current = observer
    } catch {
      // Cross-origin access will fail — that's expected for src iframes
    }
  }, [element.contentHeight])

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [])

  const useContentHeight = element.contentHeight && notNullOrUndefined(srcDoc)

  return (
    <StyledIframe
      className="stIFrame"
      data-testid="stIFrame"
      allow={DEFAULT_IFRAME_FEATURE_POLICY}
      ref={iframeRef}
      disableScrolling={!element.scrolling}
      useContentHeight={useContentHeight ?? false}
      measuredHeight={useContentHeight ? contentHeight : undefined}
      src={src}
      srcDoc={srcDoc}
      scrolling={element.scrolling ? "auto" : "no"}
      sandbox={DEFAULT_IFRAME_SANDBOX_POLICY}
      title="st.iframe"
      tabIndex={element.tabIndex ?? undefined}
      onLoad={handleIframeLoad}
    />
  )
}

export default memo(IFrame)
