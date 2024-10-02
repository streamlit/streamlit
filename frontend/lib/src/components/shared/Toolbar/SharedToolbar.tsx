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

import Toolbar, {
  ToolbarAction as BaseToolbarAction,
  ToolbarActionProps,
} from "./Toolbar"
import { StyledContentWrapper } from "./styled-components"

const ToolbarContext = createContext<{
  actions: ToolbarActionProps[]
  setActions: React.Dispatch<React.SetStateAction<ToolbarActionProps[]>>
} | null>(null)

export const ToolbarRenderer: FC<PropsWithChildren> = ({ children }) => {
  const [actions, setActions] = useState<ToolbarActionProps[]>([])

  return (
    <ToolbarContext.Provider value={{ actions, setActions }}>
      <StyledContentWrapper>
        <Toolbar target={StyledContentWrapper}>
          {actions.map((action, index) => (
            <BaseToolbarAction
              key={`${action.label}-${index}`}
              {...action}
            ></BaseToolbarAction>
          ))}
        </Toolbar>
        {children}
      </StyledContentWrapper>
    </ToolbarContext.Provider>
  )
}

export const ToolbarAction = ({
  label,
  onClick,
  icon,
  show_label,
}: ToolbarActionProps): null => {
  const context = useContext(ToolbarContext)

  if (!context) {
    throw new Error("ToolbarAction must be used within a Toolbar")
  }

  const { setActions } = context

  useEffect(() => {
    const newAction = { label, onClick, icon, show_label }
    setActions(prevActions => [...prevActions, newAction])

    return () => {
      setActions(prevActions => prevActions.filter(act => act !== newAction))
    }
  }, [label, onClick, icon, show_label, setActions])

  return null
}
