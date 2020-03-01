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

import React, { PureComponent, ComponentType, ReactNode } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"
import { Map as ImmutableMap } from "immutable"

import FullScreenWrapper from "components/shared/FullScreenWrapper"

export interface ReportElementProps {
  width: number
  element: ImmutableMap<string, any>
  height?: number
  index?: number
}

function withFullScreenWrapper(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  class ComponentWithFullScreenWrapper extends PureComponent<
    ReportElementProps
  > {
    static readonly displayName = `withFullScreenWrapper(${WrappedComponent.displayName ||
      WrappedComponent.name})`

    render(): ReactNode {
      const { width, height, ...passThroughProps } = this.props

      return (
        <FullScreenWrapper width={width} height={height}>
          {({ width, height }) => (
            <WrappedComponent
              width={width}
              height={height}
              {...passThroughProps}
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
