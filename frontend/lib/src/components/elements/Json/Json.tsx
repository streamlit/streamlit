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

import {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import JSON5 from "json5"
import { Copy } from "react-feather"
import ReactJson, { OnCopyProps, OnSelectProps } from "react-json-view"

import { Json as JsonProto } from "@streamlit/protobuf"

import ErrorElement from "~lib/components/shared/ErrorElement"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme"
import { ensureError } from "~lib/util/ErrorHandling"

import {
  StyledCopyButton,
  StyledJsonWrapper,
  StyledPathText,
  StyledPathTooltip,
} from "./styled-components"

export interface JsonProps {
  element: JsonProto
}

interface TooltipState {
  isVisible: boolean
  path: string
  x: number
  y: number
}

const INITIAL_TOOLTIP_STATE: TooltipState = {
  isVisible: false,
  path: "",
  x: 0,
  y: 0,
}

/**
 * Converts a namespace array from react-json-view into a JSON path string.
 * Handles both object keys and array indices.
 */
function formatJsonPath(namespace: Array<string | null>): string {
  if (namespace.length === 0) {
    return "$"
  }

  return namespace.reduce<string>((path, key, index) => {
    if (key === null) {
      return path
    }
    // Check if key is a numeric array index
    const isArrayIndex = /^\d+$/.test(key)
    if (isArrayIndex) {
      return `${path}[${key}]`
    }
    // Check if key needs bracket notation (contains special chars or starts with number)
    const needsBrackets = /[^a-zA-Z0-9_$]/.test(key) || /^\d/.test(key)
    if (needsBrackets) {
      return `${path}["${key}"]`
    }
    // Use dot notation
    return index === 0 || path === "" ? key : `${path}.${key}`
  }, "")
}

/**
 * Functional element representing JSON structured text.
 */
function Json({ element }: Readonly<JsonProps>): ReactElement {
  const theme = useEmotionTheme()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP_STATE)

  const { copyToClipboard } = useCopyToClipboard()

  const handleCopy = useCallback(
    (copy: OnCopyProps): void => {
      copyToClipboard(JSON.stringify(copy.src))
    },
    [copyToClipboard]
  )

  const handleSelect = useCallback((select: OnSelectProps): void => {
    // Get the mouse position from the most recent click event
    const mouseEvent = window.event as MouseEvent | undefined
    const x = mouseEvent?.clientX ?? 0
    const y = mouseEvent?.clientY ?? 0

    // namespace contains the path to the parent, we need to add the current key (name)
    const fullNamespace = [...select.namespace, select.name]
    const path = formatJsonPath(fullNamespace)

    setTooltip({
      isVisible: true,
      path,
      x,
      y,
    })
  }, [])

  const handleCopyPath = useCallback((): void => {
    copyToClipboard(tooltip.path)
    // Hide tooltip after copying
    setTooltip(INITIAL_TOOLTIP_STATE)
  }, [copyToClipboard, tooltip.path])

  const hideTooltip = useCallback((): void => {
    setTooltip(INITIAL_TOOLTIP_STATE)
  }, [])

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!tooltip.isVisible) {
      return
    }

    const handleClickOutside = (event: MouseEvent): void => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        hideTooltip()
      }
    }

    // Use a small delay to avoid immediate closing from the same click
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener("click", handleClickOutside)
    }
  }, [tooltip.isVisible, hideTooltip])

  // Close tooltip on Escape key
  useEffect(() => {
    if (!tooltip.isVisible) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        hideTooltip()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [tooltip.isVisible, hideTooltip])

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
        style={{
          fontFamily: theme.genericFonts.codeFont,
          fontSize: theme.fontSizes.codeFontSize,
          fontWeight: theme.fontWeights.code,
          backgroundColor: theme.colors.bgColor,
          whiteSpace: "pre-wrap", // preserve whitespace
        }}
      />
      <StyledPathTooltip
        ref={tooltipRef}
        isVisible={tooltip.isVisible}
        style={{
          left: tooltip.x,
          top: tooltip.y + 10,
        }}
        data-testid="stJsonPathTooltip"
      >
        <StyledPathText>{tooltip.path}</StyledPathText>
        <StyledCopyButton
          onClick={handleCopyPath}
          title="Copy path to clipboard"
          aria-label="Copy path to clipboard"
        >
          <Copy size={14} />
        </StyledCopyButton>
      </StyledPathTooltip>
    </StyledJsonWrapper>
  )
}

export default memo(Json)
