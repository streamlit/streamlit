import React from "react"

/**
 * Props passed to custom Streamlit components.
 */
export interface ComponentProps {
  /** The arguments passed to the component instance. */
  args: any

  /** The component's width */
  width: number

  /**
   * True if the component should be disabled.
   * All components get disabled while the app is being re-run,
   * and become re-enabled when the re-run has finished.
   */
  disabled: boolean

  /** Set this component's widget value. */
  setWidgetValue: (value: any) => void

  /**
   * Set the component's height in the Streamlit app. This controls the height
   * of the iframe that the component is rendered into.
   *
   * If newHeight is not specified, then the component's scrollHeight is used.
   * This is a good default for most component that want to occupy the
   * entire iframe.
   */
  updateFrameHeight: (newHeight?: number) => void
}

/**
 * Optional Streamlit component base class.
 *
 * You are not required to extend this base class to create a Streamlit
 * component. If you decide not to extend it, you should implement the
 * `componentDidMount` and `componentDidUpdate` functions in your own class,
 * so that your plugin properly resizes.
 */
export class StreamlitComponent<S = {}> extends React.PureComponent<
  ComponentProps,
  S
> {
  public componentDidMount(): void {
    // After we're rendered for the first time, tell Streamlit that our height
    // has changed.
    this.props.updateFrameHeight()
  }

  public componentDidUpdate(): void {
    // After we're updated, tell Streamlit that our height may have changed.
    this.props.updateFrameHeight()
  }
}
