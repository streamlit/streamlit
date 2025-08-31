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

import React, { memo } from "react"

import styled from "@emotion/styled"
import { TextCellEntry } from "@glideapps/glide-data-grid"
import { getLuminance } from "color2k"
import JSON5 from "json5"
import ReactJson from "react-json-view"

import { isNullOrUndefined } from "@streamlit/utils"

import { toJsonString } from "~lib/components/widgets/DataFrame/columns/utils"

const StyledJsonWrapper = styled.div(({ theme }) => ({
  overflowY: "auto",
  padding: theme.spacing.sm,
  ".react-json-view .copy-icon svg": {
    // Make the copy icon responsive to the root font size.
    fontSize: `0.9em !important`,
    marginRight: `${theme.spacing.threeXS} !important`,
    verticalAlign: "middle !important",
  },
}))

interface JsonViewerProps {
  jsonValue: string | object | undefined | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  theme: any
}

/**
 * A component to be used in cell overlay (editor) that is able to display
 * JSON values in a nice JSON-viewer.
 *
 * If the value cannot be parsed into a JSON object, the value will be displayed
 * as raw text.
 **/
export const JsonViewer: React.FC<JsonViewerProps> = ({
  jsonValue,
  theme,
}) => {
  let parsedJson = undefined

  if (jsonValue) {
    // Try to parse the JSON value.
    try {
      parsedJson =
        typeof jsonValue === "string"
          ? JSON5.parse(jsonValue)
          : JSON5.parse(JSON5.stringify(jsonValue))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Keep the parsed JSON as undefined.
      parsedJson = undefined
    }
  }

  if (isNullOrUndefined(parsedJson)) {
    // If the provided value cannot be parsed into a JSON object
    // or is empty/null/undefined, display the value as raw text
    // or just empty string.
    return (
      <TextCellEntry
        highlight={true}
        autoFocus={false}
        disabled={true}
        value={toJsonString(jsonValue) ?? ""}
        onChange={() => undefined}
      />
    )
  }

  return (
    <StyledJsonWrapper data-testid="stJsonColumnViewer">
      <ReactJson
        src={parsedJson}
        collapsed={2}
        theme={getLuminance(theme.bgCell) > 0.5 ? "rjv-default" : "monokai"}
        displayDataTypes={false}
        displayObjectSize={false}
        name={false}
        enableClipboard={true}
        style={{
          fontFamily: theme.fontFamily,
          fontSize: theme.baseFontStyle,
          backgroundColor: theme.bgCell,
          whiteSpace: "pre-wrap", // preserve whitespace
        }}
      />
    </StyledJsonWrapper>
  )
}

export default memo(JsonViewer)
