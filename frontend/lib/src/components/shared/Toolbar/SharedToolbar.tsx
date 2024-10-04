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
  FC,
  PropsWithChildren,
  useMemo,
  useRef,
} from "react"

import ReactDOM from "react-dom"

import { useRequiredContext } from "@streamlit/lib/src/hooks/useRequiredContext"
import { WidgetFullscreenContext } from "@streamlit/lib/src/components/shared/WidgetFullscreenWrapper"

import Toolbar, {
  ToolbarAction as BaseToolbarAction,
  ToolbarActionProps,
  ToolbarProps,
} from "./Toolbar"
import { StyledContentWrapper } from "./styled-components"

const ToolbarContext = createContext<
  | [
      ToolbarProps | null,
      React.Dispatch<React.SetStateAction<ToolbarProps | null>>
    ]
  | null
>(null)
ToolbarContext.displayName = "ToolbarContext"

export const ToolbarContextProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const value = React.useState<ToolbarProps | null>(null)

  return (
    <ToolbarContext.Provider value={value}>{children}</ToolbarContext.Provider>
  )
}

type ToolbarRendererContextShape = {
  portalRef: React.RefObject<HTMLDivElement>
}

const ToolbarRendererContext =
  createContext<ToolbarRendererContextShape | null>(null)
ToolbarRendererContext.displayName = "ToolbarRendererContext"

export const ToolbarRendererContextProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const portalRef = useRef<HTMLDivElement>(null)

  const value = useMemo(() => ({ portalRef }), [portalRef])

  return (
    <ToolbarRendererContext.Provider value={value}>
      {children}
    </ToolbarRendererContext.Provider>
  )
}

export const ToolbarOutlet: FC<
  PropsWithChildren<
    Pick<ToolbarProps, "disableFullscreenMode" | "locked" | "target">
  >
> = ({ children, disableFullscreenMode, locked, target }) => {
  const { portalRef } = useRequiredContext(ToolbarRendererContext)
  const {
    collapse: onCollapse,
    expand: onExpand,
    expanded: isFullScreen,
  } = useRequiredContext(WidgetFullscreenContext)

  return (
    <StyledContentWrapper>
      <Toolbar
        disableFullscreenMode={disableFullscreenMode}
        isFullScreen={isFullScreen}
        locked={locked}
        onCollapse={onCollapse}
        onExpand={onExpand}
        target={target ?? StyledContentWrapper}
      >
        <div ref={portalRef} />
        {children}
      </Toolbar>
    </StyledContentWrapper>
  )
}

export const ToolbarAction: FC<ToolbarActionProps> = ({
  label,
  onClick,
  icon,
  show_label,
}) => {
  const { portalRef } = useRequiredContext(ToolbarRendererContext)

  if (!portalRef.current) {
    return null
  }

  return ReactDOM.createPortal(
    <BaseToolbarAction
      label={label}
      onClick={onClick}
      icon={icon}
      show_label={show_label}
    />,
    portalRef.current
  )
}
