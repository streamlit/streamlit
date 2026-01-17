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

import { FC, memo, useEffect, useMemo, useRef } from "react"

import dompurify, { SANITIZE_HTML_BASE_OPTIONS } from "./dompurifyHooks"
import HtmlContainer from "./HtmlContainer"

export interface HtmlWithJsProps {
  body: string
}

/**
 * Local sanitizer for the "unsafe allow JavaScript" path.
 *
 * - Based on the shared HTML profile `SANITIZE_HTML_BASE_OPTIONS`.
 * - Extends allow-lists to keep <script>/<style> and common script attributes
 *   (ADD_TAGS/ADD_ATTR).
 */
const SANITIZE_HTML_ALLOW_SCRIPTS_OPTIONS = {
  ...SANITIZE_HTML_BASE_OPTIONS,
  ADD_TAGS: ["script", "style"],
  ADD_ATTR: [
    "src",
    "type",
    "async",
    "defer",
    "nonce",
    "crossorigin",
    "referrerpolicy",
    "integrity",
  ],
}

/**
 * Sanitizes an HTML string while retaining <script> and related attributes.
 * Intended only for the unsafeAllowJavascript path where scripts are executed
 * programmatically after insertion.
 */
function sanitizeHtmlStringAllowingScripts(html: string): string {
  return dompurify.sanitize(html, SANITIZE_HTML_ALLOW_SCRIPTS_OPTIONS)
}

const HtmlWithJs: FC<HtmlWithJsProps> = ({ body }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const sanitizedBody = useMemo(
    () => sanitizeHtmlStringAllowingScripts(body),
    [body]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    // Inject sanitized HTML. Our DOMPurify hooks will add rel="noopener noreferrer"
    // to links with target="_blank" for security.
    container.innerHTML = sanitizedBody

    // Execute scripts: Cloning <script> elements causes the browser to run them.
    const scripts = Array.from(
      container.querySelectorAll<HTMLScriptElement>("script")
    )

    scripts.forEach(oldScript => {
      const newScript = document.createElement("script")

      // Copy attributes (type, src, async, defer, nonce, etc.).
      for (const { name, value } of Array.from(oldScript.attributes)) {
        try {
          newScript.setAttribute(name, value)
        } catch {
          // Best-effort - ignore invalid attributes.
        }
      }

      if (!oldScript.src) {
        newScript.textContent = oldScript.textContent
      }

      // Replace to trigger JS execution.
      oldScript.parentNode?.replaceChild(newScript, oldScript)
    })

    // Cleanup on dependency change.
    return () => {
      container.innerHTML = ""
    }
  }, [sanitizedBody])

  return <HtmlContainer ref={containerRef} />
}

export default memo(HtmlWithJs)
