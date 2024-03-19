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

import React, { ReactElement, useState, useEffect } from "react"
import { Html as HtmlProto } from "@streamlit/lib/src/proto"
import DOMPurify from "dompurify"

export interface HtmlProps {
  element: HtmlProto
}

const sanitizeString = (html: string): string => {
  const sanitizationOptions = {
    // Default to permit HTML, SVG and MathML, this limits to HTML only
    USE_PROFILES: { html: true },
    // glue elements like style, script or others to document.body and prevent unintuitive browser behavior in several edge-cases
    FORCE_BODY: true,
  }
  return DOMPurify.sanitize(html, sanitizationOptions)
}

/**
 * HTML code to insert into the page.
 */
export default function Html({ element }: HtmlProps): ReactElement {
  const { body } = element
  const [sanitizedHtml, setSanitizedHtml] = useState(sanitizeString(body))

  useEffect(() => {
    if (sanitizeString(body) !== sanitizedHtml) {
      setSanitizedHtml(sanitizeString(body))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

  return sanitizedHtml ? (
    <div
      className="stHtml"
      data-testid="stHtml"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  ) : (
    <></>
  )
}
