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

import React, { createContext, FC, PropsWithChildren, useRef } from "react"

import ReactDOM from "react-dom"

import { useRequiredContext } from "@streamlit/lib/src/hooks/useRequiredContext"

import { WidgetLabel as BaseWidgetLabel, LabelProps } from "./WidgetLabel"

interface LabelContextType {
  portalRef: React.RefObject<HTMLDivElement>
}

const WidgetLabelContext = createContext<LabelContextType | null>(null)

export const WidgetLabelRenderer: FC<PropsWithChildren> = ({ children }) => {
  const portalRef = useRef<HTMLDivElement>(null)

  return (
    <WidgetLabelContext.Provider value={{ portalRef }}>
      <div ref={portalRef} />
      {children}
    </WidgetLabelContext.Provider>
  )
}

export const WidgetLabel: FC<LabelProps> = labelProps => {
  const { portalRef } = useRequiredContext(WidgetLabelContext)

  if (!portalRef.current) {
    return null
  }

  return ReactDOM.createPortal(
    <BaseWidgetLabel {...labelProps} />,
    portalRef.current
  )
}
