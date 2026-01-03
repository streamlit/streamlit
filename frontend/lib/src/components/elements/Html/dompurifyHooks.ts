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

/**
 * Centralized DOMPurify instance and hooks used across HTML-rendering components.
 */
import dompurify from "dompurify"

/**
 * We temporarily store target="_blank" on links before attribute sanitization
 * and re-apply it afterwards together with a safe rel value.
 *
 * Why: Opening links in a new tab (target="_blank") can enable
 * reverse-tabnabbing unless rel includes "noopener" (and usually "noreferrer").
 * DOMPurify does not add such attributes by default. Using hooks, we can
 * preserve the author's intent while enforcing safe defaults.
 *
 * Implementation detail: We stash the intent in a temporary data- attribute.
 * DOMPurify allows data-* attributes by default (ALLOW_DATA_ATTR: true), so the
 * marker survives the attribute pass and can be observed in the after-hook.
 *
 * @see https://github.com/cure53/DOMPurify/issues/317
 */
const TEMPORARY_ATTRIBUTE = "data-temp-href-target"

/**
 * Preserve links with target="_blank" across sanitization and enforce
 * rel="noopener noreferrer" afterwards for security.
 */
dompurify.addHook("beforeSanitizeAttributes", function (node): void {
  if (
    node instanceof HTMLElement &&
    node.hasAttribute("target") &&
    node.getAttribute("target") === "_blank"
  ) {
    node.setAttribute(TEMPORARY_ATTRIBUTE, "_blank")
  }
})

dompurify.addHook("afterSanitizeAttributes", function (node): void {
  if (node instanceof HTMLElement && node.hasAttribute(TEMPORARY_ATTRIBUTE)) {
    node.setAttribute("target", "_blank")
    // according to https://html.spec.whatwg.org/multipage/links.html#link-type-noopener,
    // noreferrer implies noopener, but we set it just to be sure in case some browsers
    // do not implement the spec accordingly.
    node.setAttribute("rel", "noopener noreferrer")
    node.removeAttribute(TEMPORARY_ATTRIBUTE)
  }
})

/**
 * Shared DOMPurify sanitization options used for safe rendering.
 *
 * @see https://github.com/cure53/DOMPurify
 */
export const SANITIZE_HTML_BASE_OPTIONS = {
  // Restrict sanitization to the HTML profile (no SVG/MathML)
  USE_PROFILES: { html: true },
  // Parse inside a <body> context to avoid cross-browser reparenting/hoisting quirks
  FORCE_BODY: true,
}

export default dompurify
