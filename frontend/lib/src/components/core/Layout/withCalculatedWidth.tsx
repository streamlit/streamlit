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
import React, { ComponentType, ReactElement } from "react"

import hoistNonReactStatics from "hoist-non-react-statics"

import { Box } from "~lib/components/shared/Base/styled-components"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"

/**
 * HOC that wraps a component and passes its width as a prop. Should only be
 * used in legacy components that require the width prop.
 */
export const withCalculatedWidth = <P extends { width?: number }>(
  WrappedComponent: ComponentType<React.PropsWithChildren<P>>
): ComponentType<Omit<P, "width">> => {
  const EnhancedComponent = (props: Omit<P, "width">): ReactElement => {
    const [width, elementRef] = useCalculatedWidth()

    return (
      <Box ref={elementRef}>
        <WrappedComponent {...(props as P)} width={width} />
      </Box>
    )
  }
  EnhancedComponent.displayName = `withCalculatedWidth(${
    WrappedComponent.displayName || WrappedComponent.name
  })`

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(EnhancedComponent, WrappedComponent)
}
