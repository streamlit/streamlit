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

import ElementFullscreenWrapper from "~lib/components/shared/ElementFullscreen/ElementFullscreenWrapper"

function withFullScreenWrapper<P extends object>(
  WrappedComponent: ComponentType<React.PropsWithChildren<P>>
): ComponentType<React.PropsWithChildren<P>> {
  const ComponentWithFullScreenWrapper = (props: P): ReactElement => {
    return (
      <ElementFullscreenWrapper>
        <WrappedComponent {...props}></WrappedComponent>
      </ElementFullscreenWrapper>
    )
  }
  ComponentWithFullScreenWrapper.displayName = `withFullScreenWrapper(${
    WrappedComponent.displayName || WrappedComponent.name
  })`

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithFullScreenWrapper, WrappedComponent)
}

export default withFullScreenWrapper
