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
 * Read rendered plain text from a Markdown node, inserting a space where
 * leftover block elements or hard breaks would otherwise concatenate
 * (`onetwo`). CSS generated content is not included in `textContent`.
 */
export function plainTextWithBlockGaps(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll("br").forEach(br => {
    br.replaceWith(document.createTextNode(" "))
  })
  clone.querySelectorAll("p").forEach((paragraph, index) => {
    if (index > 0) {
      paragraph.prepend(document.createTextNode(" "))
    }
  })
  return (clone.textContent ?? "").replaceAll(/\s+/g, " ").trim()
}
