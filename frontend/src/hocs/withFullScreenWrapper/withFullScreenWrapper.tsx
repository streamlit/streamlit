import React, { PureComponent, ComponentType, ReactNode } from "react"
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
  return class ComponentWithPagination extends PureComponent<
    ReportElementProps
  > {
    render(): ReactNode {
      const { element, index, width, height } = this.props

      return (
        <FullScreenWrapper width={width} height={height}>
          {({ width, height }) => (
            <WrappedComponent
              element={element}
              index={index}
              width={width}
              height={height}
            />
          )}
        </FullScreenWrapper>
      )
    }
  }
}

export default withFullScreenWrapper
