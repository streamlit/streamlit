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

import { FC, memo, useEffect, useRef } from "react"

import HtmlContainer from "./HtmlContainer"

export interface HtmlWithJsProps {
  body: string
}

const HtmlWithJs: FC<HtmlWithJsProps> = ({ body }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    // Reset and inject raw HTML
    container.innerHTML = ""
    container.innerHTML = body

    // Post-process links opened in new tabs for security
    const anchors = container.querySelectorAll<HTMLAnchorElement>(
      'a[target="_blank"]'
    )
    anchors.forEach(a => {
      a.setAttribute("rel", "noopener noreferrer")
    })

    // Execute scripts by cloning them so the browser runs them
    const scripts = Array.from(
      container.querySelectorAll<HTMLScriptElement>("script")
    )

    scripts.forEach(oldScript => {
      const newScript = document.createElement("script")

      // Copy attributes (type, src, async, defer, nonce, etc.)
      for (const { name, value } of Array.from(oldScript.attributes)) {
        try {
          newScript.setAttribute(name, value)
        } catch {
          // Best-effort; ignore invalid attributes
        }
      }

      if (oldScript.src) {
        newScript.src = oldScript.src
      } else {
        newScript.textContent = oldScript.textContent
      }

      // Replace to trigger execution
      oldScript.parentNode?.replaceChild(newScript, oldScript)
    })

    // Cleanup on dependency change
    return () => {
      container.innerHTML = ""
    }
  }, [body])

  return <HtmlContainer ref={containerRef} />
}

export default memo(HtmlWithJs)
