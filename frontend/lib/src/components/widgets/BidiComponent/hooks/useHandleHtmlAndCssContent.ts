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

import React, { useEffect, useMemo, useRef } from "react"

import { BidiComponentContext } from "~lib/components/widgets/BidiComponent/BidiComponentContext"
import { handleError } from "~lib/components/widgets/BidiComponent/utils/error"
import { LOG } from "~lib/components/widgets/BidiComponent/utils/logger"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

/**
 * Inject HTML content including script tags
 *
 * Security model
 * ----------------
 * This hook injects HTML and CSS authored by users or third parties as part of
 * a Custom Component v2 instance. Streamlit does not sanitize or validate this
 * content and makes no guarantees about what is injected. It executes with
 * normal DOM privileges.
 *
 * If you need to render untrusted input safely, do not use this hook without
 * implementing your own sanitization/escaping strategy.
 */
const injectHtmlContent = (html: string, container: HTMLElement): void => {
  try {
    const range = document.createRange()
    const fragment = range.createContextualFragment(html)
    container.appendChild(fragment)
  } catch (error) {
    LOG.warn(
      "createContextualFragment failed, falling back to innerHTML",
      error
    )
    container.innerHTML = html
  }
}

/**
 * Handle and render CCv2-provided HTML and CSS into `containerRef`.
 *
 * Purpose
 * -------
 * Renders the HTML string and either inline CSS or a linked CSS file for a
 * Custom Component v2 instance. Manages element lifecycle and error propagation
 * while minimizing unnecessary re-renders.
 *
 * Security model
 * --------------
 * - Accepts author-supplied HTML (which may include <script> tags) and CSS.
 *   Streamlit does not sanitize or validate this content.
 * - Injected content runs with the normal DOM privileges of the current page or
 *   shadow root. Use only with trusted component bundles or sanitize the
 *   content yourself before passing it here.
 *
 * When to use
 * -----------
 * - In CCv2 to mount a component's HTML/CSS assets into the provided container.
 *
 * When NOT to use
 * ---------------
 * - Outside of the CCv2 lifecycle.
 * - For arbitrary or end-user-supplied content that must be sandboxed or
 *   sanitized.
 *
 * @param containerRef - Parent `HTMLElement` or `ShadowRoot` to append the
 *   content container into.
 * @param setError - Callback used to surface processing or load errors.
 * @param skip - When true, skip injecting/updating content for this effect
 *   cycle.
 * @returns A ref to the div that contains the injected HTML/CSS.
 */
export const useHandleHtmlAndCssContent = ({
  containerRef,
  setError,
  skip = false,
}: {
  containerRef: React.RefObject<HTMLElement | ShadowRoot>
  setError: (error: Error) => void
  skip?: boolean
}): React.MutableRefObject<HTMLDivElement | null> => {
  const contentRef = useRef<HTMLDivElement | null>(null)

  const {
    htmlContent: html,
    cssContent,
    cssSourcePath,
    componentName,
    componentRegistry: { getBidiComponentURL },
  } = useRequiredContext(BidiComponentContext)

  /**
   * Calculate this in a useMemo to reduce unnecessary re-runs of the useEffect
   */
  const cssLinkHref = useMemo(() => {
    if (!cssSourcePath) {
      return undefined
    }

    return getBidiComponentURL(componentName, cssSourcePath)
  }, [componentName, cssSourcePath, getBidiComponentURL])

  useEffect(() => {
    if (skip) {
      return
    }

    const parent = containerRef.current
    if (!parent) {
      return
    }

    try {
      if (contentRef.current && contentRef.current.parentNode === parent) {
        parent.removeChild(contentRef.current)
      }

      contentRef.current = document.createElement("div")

      if (html) {
        const htmlDiv = document.createElement("div")
        // SECURITY NOTE: `html` is authored by users/third parties; we do not sanitize it.
        injectHtmlContent(html, htmlDiv)
        contentRef.current.appendChild(htmlDiv)
      }

      if (cssContent) {
        const styleElement = document.createElement("style")
        styleElement.textContent = cssContent
        contentRef.current.appendChild(styleElement)
      } else if (cssLinkHref) {
        const linkElement = document.createElement("link")
        linkElement.href = cssLinkHref
        linkElement.rel = "stylesheet"
        linkElement.onerror = () => {
          handleError(
            new Error(`Failed to load CSS from ${cssLinkHref}`),
            setError
          )
        }
        contentRef.current.appendChild(linkElement)
      }

      parent.appendChild(contentRef.current)
    } catch (error) {
      handleError(error, setError, "Failed to process HTML/CSS content")
    }
  }, [html, cssContent, containerRef, cssLinkHref, setError, skip])

  return contentRef
}
