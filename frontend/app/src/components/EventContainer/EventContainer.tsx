/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { ToasterContainer, toaster, PLACEMENT } from "baseui/toast"

export interface EventContainerProps {
  toastAdjustment: boolean
  scriptRunId: string
  children?: ReactNode
}

function EventContainer({
  toastAdjustment,
  scriptRunId,
  children,
}: EventContainerProps): ReactElement {
  useEffect(() => {
    // Ensure all toasts cleared on script re-run
    toaster.getRef()?.clearAll()
  }, [scriptRunId])

  return (
    <>
      <ToasterContainer
        placement={PLACEMENT.bottomRight}
        autoHideDuration={4 * 1000} // in milliseconds
        overrides={{
          Root: {
            style: {
              // If deployed in Community Cloud, move toasts up to avoid blocking Manage App button
              bottom: toastAdjustment ? "45px" : "0px",
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
