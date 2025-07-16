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

import React, { memo, ReactElement, useMemo } from "react"

import dompurify from "dompurify"

import { Html as HtmlProto } from "@streamlit/protobuf"

import { StyledHtml } from "./styled-components"

export interface HtmlProps {
  element: HtmlProto
}

// preserve target=_blank and set security attributes (see https://github.com/cure53/DOMPurify/issues/317)
const TEMPORARY_ATTRIBUTE = "data-temp-href-target"
dompurify.addHook("beforeSanitizeAttributes", function (node) {
  if (
    node instanceof HTMLElement &&
    node.hasAttribute("target") &&
    node.getAttribute("target") === "_blank"
  ) {
    node.setAttribute(TEMPORARY_ATTRIBUTE, "_blank")
  }
})
dompurify.addHook("afterSanitizeAttributes", function (node) {
  if (node instanceof HTMLElement && node.hasAttribute(TEMPORARY_ATTRIBUTE)) {
    node.setAttribute("target", "_blank")
    // according to https://html.spec.whatwg.org/multipage/links.html#link-type-noopener,
    // noreferrer implies noopener, but we set it just to be sure in case some browsers
    // do not implement the spec accordingly.
    node.setAttribute("rel", "noopener noreferrer")
    node.removeAttribute(TEMPORARY_ATTRIBUTE)
  }
})

const sanitizeString = (html: string): string => {
  const sanitizationOptions = {
    // Default to permit HTML, SVG and MathML, this limits to HTML only
    USE_PROFILES: { html: true },
    // glue elements like style, script or others to document.body and prevent unintuitive browser behavior in several edge-cases
    FORCE_BODY: true,
  }
  return dompurify.sanitize(html, sanitizationOptions)
}

/**
 * HTML code to insert into the page.
 */
function Html({ element }: Readonly<HtmlProps>): ReactElement {
  const { body } = element

  const sanitizedHtml = useMemo(() => sanitizeString(body), [body])

  return (
    <>
      {sanitizedHtml && (
        <StyledHtml
          className="stHtml"
          data-testid="stHtml"
          // TODO: Update to match React best practices
          // eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      )}
    </>
  )
}

export default memo(Html)
