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

import { FC, memo, useEffect, useRef, useState } from "react"

import ErrorElement from "~lib/components/shared/ErrorElement/ErrorElement"
import { BidiComponentContext } from "~lib/components/widgets/BidiComponent/BidiComponentContext"
import { useHandleHtmlAndCssContent } from "~lib/components/widgets/BidiComponent/hooks/useHandleHtmlAndCssContent"
import { useHandleJsContent } from "~lib/components/widgets/BidiComponent/hooks/useHandleJsContent"
import { handleError } from "~lib/components/widgets/BidiComponent/utils/error"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

import { StyledBidiComponentWrapper } from "./styled-components"

/**
 * Isolated BidiComponent: encapsulates content in a Shadow DOM to avoid style
 * and DOM leakage. Initializes a shadow root, then delegates HTML/CSS/JS
 * handling to hooks. Errors are surfaced via the ErrorElement.
 */
export const IsolatedComponent: FC = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null)
  const shadowRootRef = useRef<ShadowRoot | null>(null)
  const [isShadowRootReady, setIsShadowRootReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { id } = useRequiredContext(BidiComponentContext)

  // Set up Shadow DOM
  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    try {
      // Don't try to attach a shadow root if the element already has one
      if (containerRef.current.shadowRoot) {
        shadowRootRef.current = containerRef.current.shadowRoot
        // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO: Do not set state in effect
        setIsShadowRootReady(true)
        return
      }

      shadowRootRef.current = containerRef.current.attachShadow({
        mode: "open",
      })
      setIsShadowRootReady(true)
    } catch (err) {
      handleError(err, setError, "Failed to create shadow DOM")
    }
  }, [id])

  const skip = !isShadowRootReady || !!error

  useHandleHtmlAndCssContent({ containerRef: shadowRootRef, setError, skip })
  useHandleJsContent({ containerRef: shadowRootRef, setError, skip })

  if (error) {
    return (
      <ErrorElement
        name="BidiComponent Error"
        message={error.message}
        stack={error.stack}
      />
    )
  }

  return (
    <StyledBidiComponentWrapper
      ref={containerRef}
      data-testid="stBidiComponentIsolated"
    />
  )
})
