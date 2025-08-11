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

import React, { ReactElement, ReactNode } from "react"

import { PLACEMENT, ToasterContainer } from "baseui/toast"

import { useEmotionTheme } from "@streamlit/lib"

export interface EventContainerProps {
  children?: ReactNode
}

function EventContainer({
  children,
}: Readonly<EventContainerProps>): ReactElement {
  const theme = useEmotionTheme()

  return (
    <>
      <ToasterContainer
        placement={PLACEMENT.topRight}
        // Default autoHideDuration ( in milliseconds), can be adapted by the user
        // in the Toast.tsx component
        autoHideDuration={4 * 1000}
        overrides={{
          Root: {
            style: {
              // Avoids blocking the header
              top: theme.sizes.headerHeight,
              zIndex: theme.zIndices.toast,
            },
            props: {
              "data-testid": "stToastContainer",
              className: "stToastContainer",
            },
          },
        }}
      />
      {children}
    </>
  )
}

export default EventContainer
