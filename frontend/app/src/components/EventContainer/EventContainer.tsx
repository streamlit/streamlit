/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { ReactElement, ReactNode, useEffect } from "react"

import { PLACEMENT, toaster, ToasterContainer } from "baseui/toast"
import { useTheme } from "@emotion/react"

import { EmotionTheme } from "@streamlit/lib"

export interface EventContainerProps {
  scriptRunId: string
  children?: ReactNode
}

function EventContainer({
  scriptRunId,
  children,
}: EventContainerProps): ReactElement {
  const { sizes }: EmotionTheme = useTheme()

  useEffect(() => {
    // Ensure all toasts cleared on script re-run
    toaster.getRef()?.clearAll()
  }, [scriptRunId])

  return (
    <>
      <ToasterContainer
        placement={PLACEMENT.topRight}
        autoHideDuration={4 * 1000} // in milliseconds
        overrides={{
          Root: {
            style: {
              // Avoids blocking the header
              top: sizes.headerHeight,
              // Toasts overlap chatInput container
              zIndex: 100,
            },
            props: {
              "data-testid": "toastContainer",
            },
          },
        }}
      />
      {children}
    </>
  )
}

export default EventContainer
