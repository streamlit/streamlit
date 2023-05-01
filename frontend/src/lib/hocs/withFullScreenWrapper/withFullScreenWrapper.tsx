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

import React, { PureComponent, ComponentType, ReactNode } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"

import FullScreenWrapper from "src/lib/components/shared/FullScreenWrapper"

interface Props {
  width: number
  height?: number
}

// Our wrapper takes the wrapped component's props, plus "width", "height?".
// It will pass "isFullScreen" to the wrapped component automatically
// (but the wrapped component is free to ignore that prop).
type WrapperProps<P> = Omit<P & Props, "isFullScreen">

function withFullScreenWrapper<P>(
  WrappedComponent: ComponentType<P>
): ComponentType<WrapperProps<P>> {
  class ComponentWithFullScreenWrapper extends PureComponent<WrapperProps<P>> {
    public static readonly displayName = `withFullScreenWrapper(${
      WrappedComponent.displayName || WrappedComponent.name
    })`

    public render = (): ReactNode => {
      const { width, height } = this.props

      return (
        <FullScreenWrapper width={width} height={height}>
          {({ width, height, expanded }) => (
            // `(this.props as P)` is required due to a TS bug:
            // https://github.com/microsoft/TypeScript/issues/28938#issuecomment-450636046
            <WrappedComponent
              {...(this.props as P)}
              width={width}
              height={height}
              isFullScreen={expanded}
            />
          )}
        </FullScreenWrapper>
      )
    }
  }

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithFullScreenWrapper, WrappedComponent)
}

export default withFullScreenWrapper
