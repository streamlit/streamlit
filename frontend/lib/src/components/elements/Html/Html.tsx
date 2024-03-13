/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  ReactElement,
  createElement,
  useState,
  useEffect,
  useRef,
} from "react"
import DOMPurify from "dompurify"

import { Html as HtmlProto } from "@streamlit/lib/src/proto"
export interface HtmlProps {
  element: HtmlProto
  scriptRunId: string
}

const sanitizeString = (html: string, unsafeScript: boolean): string => {
  const sanitizationOptions = {
    // Default to permit HTML, SVG and MathML, this limits to HTML only
    USE_PROFILES: { html: true },
    // glue elements like style, script or others to document.body and prevent unintuitive browser behavior in several edge-cases
    FORCE_BODY: true,
    // Allow script tags if unsafeScript is true
    ADD_TAGS: unsafeScript ? ["script"] : [],
  }
  return DOMPurify.sanitize(html, sanitizationOptions)
}

const appendContent = (
  divRef: React.RefObject<HTMLDivElement>,
  content: string
): void => {
  if (!divRef.current) throw new Error("Cannot append content to null divRef.")

  const slotHtml = document.createRange().createContextualFragment(content)
  divRef.current.innerHTML = ""
  divRef.current.appendChild(slotHtml)
}

/**
 * HTML code to insert into the page.
 */
export default function Html({
  element,
  scriptRunId,
}: HtmlProps): ReactElement {
  const { body, unsafeScripts } = element
  const [sanitizedHtml, setSanitizedHtml] = useState<string>()
  const [firstRun, setFirstRun] = useState(true)
  const divRef = useRef(null)

  // Update if html string changes
  useEffect(() => {
    const htmlContent = sanitizeString(body, unsafeScripts)
    if (htmlContent !== sanitizedHtml) {
      appendContent(divRef, htmlContent)
      setSanitizedHtml(htmlContent)
    }
    if (firstRun) {
      setFirstRun(false)
    }
  }, [unsafeScripts, body])

  // Must re-append to allow script execution outside initial mount
  useEffect(() => {
    const newSanitized = sanitizeString(body, unsafeScripts)
    if (unsafeScripts && newSanitized === sanitizedHtml && !firstRun) {
      appendContent(divRef, newSanitized)
    }
  }, [scriptRunId])

  return createElement("div", { ref: divRef })
}
