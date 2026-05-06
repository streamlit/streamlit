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

import { FC, memo, useCallback } from "react"

import { JsonEditor as JsonEditorProto } from "@streamlit/protobuf"

import ErrorElement from "~lib/components/shared/ErrorElement/ErrorElement"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme/getColors"
import { ensureError } from "~lib/util/ErrorHandling"
import ReactJson, {
  type InteractionProps,
  type OnCopyProps,
} from "~lib/util/reactJsonViewCompat"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { StyledJsonEditorWrapper } from "./styled-components"

export interface Props {
  disabled: boolean
  element: JsonEditorProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/**
 * The value is stored as a JSON string.
 */
type JsonEditorValue = string

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: JsonEditorProto
): JsonEditorValue | undefined => {
  return widgetMgr.getStringValue(element)
}

const getDefaultStateFromProto = (
  element: JsonEditorProto
): JsonEditorValue => {
  return element.default
}

const getCurrStateFromProto = (element: JsonEditorProto): JsonEditorValue => {
  return element.value ?? element.default
}

const updateWidgetMgrState = (
  element: JsonEditorProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<JsonEditorValue>,
  fragmentId: string | undefined
): void => {
  widgetMgr.setStringValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

const JsonEditor: FC<Props> = ({
  element,
  disabled,
  widgetMgr,
  fragmentId,
}) => {
  const theme = useEmotionTheme()
  const { copyToClipboard } = useCopyToClipboard()

  const [value, setValueWithSource] = useBasicWidgetState<
    JsonEditorValue,
    JsonEditorProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
  })

  const handleCopy = useCallback(
    (copy: OnCopyProps): void => {
      copyToClipboard(JSON.stringify(copy.src))
    },
    [copyToClipboard]
  )

  const handleChange = useCallback(
    (interaction: InteractionProps): void => {
      const newJsonString = JSON.stringify(interaction.updated_src)
      setValueWithSource({ value: newJsonString, fromUi: true })
    },
    [setValueWithSource]
  )

  // Parse the JSON value for display
  let bodyObject
  try {
    bodyObject = JSON.parse(value)
  } catch (e) {
    const error = ensureError(e)
    // Show position where parsing failed
    const pos = parseInt(error.message.replace(/[^0-9]/g, ""), 10)
    error.message += `\n${value.substring(0, pos + 1)} ← here`
    return <ErrorElement name={"Json Parse Error"} message={error.message} />
  }

  // Pick a ReactJson theme based on whether the streamlit theme's background
  // is light or dark.
  const jsonTheme = hasLightBackgroundColor(theme) ? "rjv-default" : "monokai"

  return (
    <StyledJsonEditorWrapper
      className="stJsonEditor"
      data-testid="stJsonEditor"
      $height={element.height}
    >
      <ReactJson
        src={bodyObject}
        collapsed={false}
        displayDataTypes={false}
        displayObjectSize={false}
        name={false}
        theme={jsonTheme}
        enableClipboard={handleCopy}
        onEdit={disabled ? false : handleChange}
        onAdd={disabled ? false : handleChange}
        onDelete={disabled ? false : handleChange}
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
    </StyledJsonEditorWrapper>
  )
}

export default memo(JsonEditor)
