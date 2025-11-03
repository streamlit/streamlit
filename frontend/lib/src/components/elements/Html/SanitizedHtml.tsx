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

import { memo, ReactElement, useMemo } from "react"

import dompurify, { SANITIZE_HTML_BASE_OPTIONS } from "./dompurifyHooks"
import HtmlContainer from "./HtmlContainer"

/**
 * Sanitizes an HTML string for safe rendering (no script execution).
 */
function sanitizeHtmlString(html: string): string {
  return dompurify.sanitize(html, SANITIZE_HTML_BASE_OPTIONS)
}

export interface SanitizedHtmlProps {
  body: string
}
function SanitizedHtml({
  body,
}: Readonly<SanitizedHtmlProps>): ReactElement | null {
  const sanitizedHtml = useMemo(() => sanitizeHtmlString(body), [body])

  if (!sanitizedHtml) {
    return null
  }

  return (
    <HtmlContainer
      // Note: This is an expected usage of dangerouslySetInnerHTML.
      // eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}

export default memo(SanitizedHtml)
