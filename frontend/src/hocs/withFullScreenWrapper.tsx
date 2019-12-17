import React, { PureComponent, ComponentType } from "react"
import { Map as ImmutableMap } from "immutable"

import FullScreenWrapper from "components/shared/FullScreenWrapper"

interface ReportElementProps {
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
    render() {
      const { element, index, width } = this.props

      return (
        <FullScreenWrapper width={width}>
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
