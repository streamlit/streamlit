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

import { memo, ReactElement, useCallback } from "react"

import JSON5 from "json5"

import { Json as JsonProto } from "@streamlit/protobuf"

import ErrorElement from "~lib/components/shared/ErrorElement/ErrorElement"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme/getColors"
import { ensureError } from "~lib/util/ErrorHandling"
import ReactJson, { type OnCopyProps } from "~lib/util/reactJsonViewCompat"

import JsonPathTooltip from "./JsonPathTooltip"
import { StyledJsonWrapper } from "./styled-components"
import { useJsonTooltip } from "./useJsonTooltip"

export interface JsonProps {
  element: JsonProto
}

/**
 * Functional element representing JSON structured text.
 */
function Json({ element }: Readonly<JsonProps>): ReactElement {
  const theme = useEmotionTheme()
  const { tooltip, handleSelect, clearTooltip } = useJsonTooltip()

  const { copyToClipboard } = useCopyToClipboard()

  const handleCopy = useCallback(
    (copy: OnCopyProps): void => {
      copyToClipboard(JSON.stringify(copy.src))
    },
    [copyToClipboard]
  )

  let bodyObject
  try {
    bodyObject = JSON.parse(element.body)
  } catch (e) {
    const error = ensureError(e)

    try {
      bodyObject = JSON5.parse(element.body)
    } catch {
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

  return (
    <StyledJsonWrapper className="stJson" data-testid="stJson">
      <ReactJson
        src={bodyObject}
        collapsed={element.maxExpandDepth ?? !element.expanded}
        displayDataTypes={false}
        displayObjectSize={false}
        name={false}
        theme={jsonTheme}
        enableClipboard={handleCopy}
        onSelect={handleSelect}
        // @ts-expect-error showComma prop exists at runtime but is missing from type definitions
        showComma={false}
        style={{
          fontFamily: theme.genericFonts.codeFont,
          fontSize: theme.fontSizes.codeFontSize,
          fontWeight: theme.fontWeights.code,
          backgroundColor: theme.colors.bgColor,
          whiteSpace: "pre-wrap", // preserve whitespace
        }}
      />
      {tooltip && (
        <JsonPathTooltip
          top={tooltip.y}
          left={tooltip.x}
          path={tooltip.path}
          clearTooltip={clearTooltip}
        />
      )}
    </StyledJsonWrapper>
  )
}

export default memo(Json)
