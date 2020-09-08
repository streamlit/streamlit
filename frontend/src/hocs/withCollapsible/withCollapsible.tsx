/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ComponentType, ReactElement, useEffect, useState } from "react"
import { styled } from "styletron-react"
import { colors, variables } from "lib/widgetTheme"

export interface Props {
  collapsible: boolean
  label: string
  collapsed: boolean
}

type ComponentProps = {
  collapsed: boolean
}

export const AnimatedComponentWrapper = styled(
  "div",
  ({ collapsed }: ComponentProps) => ({
    maxHeight: collapsed ? 0 : "100vh",
    overflow: "hidden",
    transitionProperty: "max-height",
    transitionDuration: "0.5s",
    transitionTimingFunction: "ease-in-out",
  })
)

export const StyledHeader = styled("div", ({ collapsed }: ComponentProps) => ({
  display: "flex",
  justifyContent: "space-between",
  cursor: "pointer",
  borderWidth: 0,
  borderBottomWidth: collapsed ? 0 : "1px",
  borderStyle: "solid",
  borderColor: colors.grayLighter,
  marginBottom: variables.spacer,
  transitionProperty: "border-bottom-width",
  transitionDuration: "0.5s",
  transitionTimingFunction: "ease-in-out",
}))

export const StyledToggle = styled("small", {
  color: colors.gray,
})

function withCollapsible(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  const CollapsibleComponent = (props: Props): ReactElement => {
    const {
      collapsible,
      label,
      collapsed: initialCollapsed,
      ...componentProps
    } = props

    const [collapsed, toggleCollapse] = useState<boolean>(initialCollapsed)
    useEffect(() => {
      toggleCollapse(initialCollapsed)
    }, [initialCollapsed])

    const toggle = (): void => toggleCollapse(!collapsed)

    return collapsible ? (
      <>
        <StyledHeader collapsed={collapsed}>
          <div>{label}</div>
          <StyledToggle onClick={toggle}>
            {collapsed ? "Show" : "Hide"}
          </StyledToggle>
        </StyledHeader>
        <AnimatedComponentWrapper collapsed={collapsed}>
          <WrappedComponent {...componentProps} />
        </AnimatedComponentWrapper>
      </>
    ) : (
      <WrappedComponent {...componentProps} />
    )
  }

  return CollapsibleComponent
}

export default withCollapsible
