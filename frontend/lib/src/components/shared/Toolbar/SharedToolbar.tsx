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
  useEffect,
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

export const useSetToolbarProps = (props: ToolbarProps): void => {
  const [, setProps] = useRequiredContext(ToolbarContext)

  useEffect(() => {
    setProps(props)

    return () => {
      setProps(null)
    }
  }, [props, setProps])
}

/**
 * Simple wrapper around `useSetToolbarProps` to set if the element should have
 * a fullscreen button. Only utilize standalone if you don't need to set any
 * other toolbar props.
 *
 * @param hasFullscreen true (default) if the element should have a fullscreen
 * button
 */
export const useHasFullscreen = (hasFullscreen = true): void => {
  const { expand, collapse, expanded } = useRequiredContext(
    WidgetFullscreenContext
  )

  useSetToolbarProps(
    useMemo(
      () => ({
        onExpand: expand,
        onCollapse: collapse,
        isFullScreen: expanded,
        disableFullscreenMode: !hasFullscreen,
      }),
      [collapse, expand, expanded, hasFullscreen]
    )
  )
}

type ToolbarRendererContextShape = {
  portalRef: React.RefObject<HTMLDivElement>
}

const ToolbarRendererContext =
  createContext<ToolbarRendererContextShape | null>(null)
ToolbarRendererContext.displayName = "ToolbarRendererContext"

export const ToolbarRenderer: FC<PropsWithChildren> = ({ children }) => {
  const [toolbarProps] = useRequiredContext(ToolbarContext)
  const portalRef = useRef<HTMLDivElement>(null)

  return (
    <ToolbarRendererContext.Provider value={{ portalRef }}>
      <StyledContentWrapper>
        {toolbarProps && (
          <Toolbar target={StyledContentWrapper} {...toolbarProps}>
            <div ref={portalRef} />
          </Toolbar>
        )}
        {children}
      </StyledContentWrapper>
    </ToolbarRendererContext.Provider>
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
