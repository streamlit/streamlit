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

import { FC, memo, useRef, useState } from "react"

import ErrorElement from "~lib/components/shared/ErrorElement"
import { useHandleHtmlAndCssContent } from "~lib/components/widgets/BidiComponent/hooks/useHandleHtmlAndCssContent"
import { useHandleJsContent } from "~lib/components/widgets/BidiComponent/hooks/useHandleJsContent"

import { StyledBidiComponentWrapper } from "./styled-components"

/**
 * Non-isolated BidiComponent: renders into the regular DOM (no Shadow DOM).
 * Delegates handling of HTML, CSS, and JS content to dedicated hooks and
 * surfaces any errors via the ErrorElement.
 */
export const NonIsolatedComponent: FC = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<Error | null>(null)

  const skip = !!error

  useHandleHtmlAndCssContent({ containerRef, setError, skip })
  useHandleJsContent({ containerRef, setError, skip })

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
      data-testid="stBidiComponentRegular"
    />
  )
})
