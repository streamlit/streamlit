import React, { ReactElement } from "react"
import { useTheme } from "@emotion/react"
import JSON5 from "json5"
import ReactJson from "react-json-view"
import ErrorElement from "src/components/shared/ErrorElement"

import { Json as JsonProto } from "src/autogen/proto"
import { hasLightBackgroundColor, Theme } from "src/theme"
import { ensureError } from "src/lib/ErrorHandling"

export interface JsonProps {
  width: number
  element: JsonProto
}

/**
 * Functional element representing JSON structured text.
 */
export default function Json({ width, element }: JsonProps): ReactElement {
  const styleProp = { width }
  const theme: Theme = useTheme()

  let bodyObject
  try {
    bodyObject = JSON.parse(element.body)
  } catch (e) {
    const error = ensureError(e)
    try {
      bodyObject = JSON5.parse(element.body)
    } catch (json5Error) {
      // If content fails to parse as Json, rebuild the error message
      // to show where the problem occurred.
      const pos = parseInt(error.message.replace(/[^0-9]/g, ""), 10)
      error.message += `\n${element.body.substr(0, pos + 1)} ← here`
      return <ErrorElement name={"Json Parse Error"} message={error.message} />
    }
  }

  // Try to pick a reasonable ReactJson theme based on whether the streamlit
  // theme's background is light or dark.
  const jsonTheme = hasLightBackgroundColor(theme) ? "rjv-default" : "monokai"

  return (
    <div data-testid="stJson" style={styleProp}>
      <ReactJson
        src={bodyObject}
        collapsed={!element.expanded}
        displayDataTypes={false}
        displayObjectSize={false}
        name={false}
        theme={jsonTheme}
        style={{
          fontFamily: theme.genericFonts.codeFont,
          fontSize: theme.fontSizes.sm,
          backgroundColor: theme.colors.bgColor,
        }}
      />
    </div>
  )
}
