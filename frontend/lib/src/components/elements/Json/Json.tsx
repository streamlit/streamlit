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

import React, { memo, ReactElement, useRef } from "react"

import JSON5 from "json5"
import Clipboard from "clipboard"
import ReactJson from "react-json-view"

import { Json as JsonProto } from "@streamlit/protobuf"

import ErrorElement from "~lib/components/shared/ErrorElement"
import { hasLightBackgroundColor } from "~lib/theme"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { ensureError } from "~lib/util/ErrorHandling"

import { StyledJsonWrapper } from "./styled-components"

export interface JsonProps {
  element: JsonProto
}

/**
 * Functional element representing JSON structured text.
 */
function Json({ element }: Readonly<JsonProps>): ReactElement {
  const theme = useEmotionTheme()

  const elementRef = useRef<HTMLDivElement>(null)

  let bodyObject
  try {
    bodyObject = JSON.parse(element.body)
  } catch (e) {
    const error = ensureError(e)
    try {
      bodyObject = JSON5.parse(element.body)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (json5Error) {
      // If content fails to parse as Json, rebuild the error message
      // to show where the problem occurred.
      const pos = parseInt(error.message.replace(/[^0-9]/g, ""), 10)
      error.message += `\n${element.body.substring(0, pos + 1)} ← here`
      return <ErrorElement name={"Json Parse Error"} message={error.message} />
    }
  }

  // Try to pick a reasonable ReactJson theme based on whether the streamlit
  // theme's background is light or dark.
  const jsonTheme = hasLightBackgroundColor(theme) ? "rjv-default" : "monokai"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const handleCopy = (copy: any): void => {
    // we use ClipboardJS to do the copying, because it allows
    // us to specify a container element. This is necessary because
    // otherwise copying doesn't work in dialogs.
    Clipboard.copy(JSON.stringify(copy.src), {
      container: elementRef.current ?? undefined,
    })
  }

  return (
    <StyledJsonWrapper
      className="stJson"
      data-testid="stJson"
      ref={elementRef}
    >
      <ReactJson
        src={bodyObject}
        collapsed={element.maxExpandDepth ?? !element.expanded}
        displayDataTypes={false}
        displayObjectSize={false}
        name={false}
        theme={jsonTheme}
        enableClipboard={handleCopy}
        style={{
          fontFamily: theme.genericFonts.codeFont,
          fontSize: theme.fontSizes.codeFontSize,
          fontWeight: theme.fontWeights.code,
          backgroundColor: theme.colors.bgColor,
          whiteSpace: "pre-wrap", // preserve whitespace
        }}
      />
    </StyledJsonWrapper>
  )
}

export default memo(Json)
