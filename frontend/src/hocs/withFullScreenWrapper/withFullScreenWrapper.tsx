import React, { PureComponent, ComponentType, ReactNode } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"
import { Map as ImmutableMap } from "immutable"

import FullScreenWrapper from "src/components/shared/FullScreenWrapper"

export interface AppElementProps {
  width: number
  element: ImmutableMap<string, any>
  height?: number
  index?: number
}

function withFullScreenWrapper(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  class ComponentWithFullScreenWrapper extends PureComponent<AppElementProps> {
    static readonly displayName = `withFullScreenWrapper(${WrappedComponent.displayName ||
      WrappedComponent.name})`

    render(): ReactNode {
      const { width, height, ...passThroughProps } = this.props

      return (
        <FullScreenWrapper width={width} height={height}>
          {({ width, height, expanded }) => (
            <WrappedComponent
              width={width}
              height={height}
              isFullScreen={expanded}
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
