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

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

import { WidgetLabel as BaseWidgetLabel, LabelProps } from "./WidgetLabel"

interface LabelContextType {
  labelProps: LabelProps | null
  setLabelProps: React.Dispatch<React.SetStateAction<LabelProps | null>>
}

const WidgetLabelContext = createContext<LabelContextType | null>(null)

export const WidgetLabelRenderer = ({
  children,
}: {
  children: ReactNode
}): React.ReactElement => {
  const [labelProps, setLabelProps] = useState<LabelProps | null>(null)

  return (
    <WidgetLabelContext.Provider value={{ labelProps, setLabelProps }}>
      {labelProps && (
        <BaseWidgetLabel {...labelProps}>
          {labelProps.children}
        </BaseWidgetLabel>
      )}
      {children}
    </WidgetLabelContext.Provider>
  )
}

export const WidgetLabel = ({
  label,
  children,
  disabled,
  htmlFor,
  labelVisibility,
}: LabelProps): null => {
  const context = useContext(WidgetLabelContext)

  if (!context) {
    throw new Error("WidgetLabel must be used within a WidgetLabelRenderer")
  }

  const { setLabelProps } = context

  useEffect(() => {
    const newLabelProps = {
      label,
      children,
      disabled,
      htmlFor,
      labelVisibility,
    }
    setLabelProps(newLabelProps)

    return () => {
      setLabelProps(null)
    }
  }, [label, children, disabled, htmlFor, labelVisibility, setLabelProps])

  return null
}
