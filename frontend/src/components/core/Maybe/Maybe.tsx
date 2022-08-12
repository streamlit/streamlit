import React from "react"

export interface Props {
  enable: boolean
}

export interface State {}

class Maybe extends React.Component<Props, State> {
  // eslint-disable-next-line class-methods-use-this
  public shouldComponentUpdate(
    nextProps: Readonly<Props>,
    nextState: Readonly<State>,
    nextContext: any
  ): boolean {
    // We have our component update if either props.enable or nextProps.enable
    // is true to ensure that we rerender in the case that an Element is
    // removed by replacing it with an empty one (so goes from enabled->disabled).
    return this.props.enable || nextProps.enable
  }

  public render(): React.ReactNode {
    return this.props.children
  }
}

export default Maybe
