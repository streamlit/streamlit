import hoistNonReactStatics from "hoist-non-react-statics"
import React, { ReactNode } from "react"
import ArrowTable, { ArrowDataframeProto } from "./lib/ArrowTable"

/**
 * Props passed to custom components.
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

interface ArgsDataframe {
  key: string
  value: ArrowDataframeProto
}

/**
 * Component wrapper. Bootstraps the communication interface between
 * Streamlit and the component.
 *
 * Component writers do not need to edit this function.
 */
export function StreamlitComponent(
  WrappedComponent: React.ComponentType<ComponentProps>
): React.ComponentType {
  interface WrapperProps {}

  interface WrapperState {
    readyForFirstRender: boolean
    renderArgs: object
    renderDfs: object
    renderDisabled: boolean
    componentError?: Error
  }

  const TARGET_ORIGIN = "*"

  /** Messages from Component -> Streamlit */
  enum ComponentBackMsgType {
    // A component sends this message when it's ready to receive messages
    // from Streamlit. Streamlit won't send any messages until it gets this.
    // No data.
    COMPONENT_READY = "componentReady",

    // The component has a new widget value. Send it back to Streamlit, which
    // will then re-run the app.
    // Data: { value: any }
    SET_WIDGET_VALUE = "setWidgetValue",

    // The component has a new height for its iframe.
    // Data: { height: number }
    SET_FRAME_HEIGHT = "setFrameHeight",
  }

  /** Messages from Streamlit -> Component */
  enum ComponentForwardMsgType {
    // Sent by Streamlit when the component should re-render.
    // Data: { args: any, disabled: boolean }
    RENDER = "render",
  }

  class ComponentWrapper extends React.PureComponent<
    WrapperProps,
    WrapperState
  > {
    /** The most recent frameHeight we've sent to Streamlit. */
    private frameHeight?: number

    public constructor(props: WrapperProps) {
      super(props)

      this.state = {
        readyForFirstRender: false,
        renderArgs: {},
        renderDfs: {},
        renderDisabled: false,
        componentError: undefined,
      }
    }

    public static getDerivedStateFromError = (
      error: Error
    ): Partial<WrapperState> => {
      return { componentError: error }
    }

    public componentDidMount = (): void => {
      // Set up event listeners, and signal to Streamlit that we're ready.
      // We won't render the component until we receive the first RENDER message.
      window.addEventListener("message", this.onMessageEvent)
      this.sendBackMsg(ComponentBackMsgType.COMPONENT_READY)
    }

    public componentWillUnmount = (): void => {
      window.removeEventListener("message", this.onMessageEvent)
    }

    /**
     * Called by the component when its height has changed. This should be
     * called every time the component changes its DOM - that is, in
     * componentDidMount and componentDidUpdate.
     */
    private updateFrameHeight = (newHeight?: number): void => {
      if (newHeight === undefined) {
        // newHeight is optional. If undefined, it defaults to scrollHeight,
        // which is the entire height of the element minus its border,
        // scrollbar, and margin.
        newHeight = document.body.scrollHeight
      }

      if (this.frameHeight === newHeight) {
        // Don't send a message if our height hasn't changed.
        return
      }

      this.frameHeight = newHeight
      this.sendBackMsg(ComponentBackMsgType.SET_FRAME_HEIGHT, {
        height: this.frameHeight,
      })
    }

    /** Receive a ForwardMsg from the Streamlit app */
    private onMessageEvent = (event: MessageEvent): void => {
      // We only listen for Streamlit messages.
      if (!event.data.hasOwnProperty("isStreamlitMessage")) {
        return
      }

      const type = event.data["type"]
      switch (type) {
        case ComponentForwardMsgType.RENDER:
          this.onRenderMessage(event.data)
          break

        default:
          console.warn(`Unrecognized Streamlit message '${type}`)
          break
      }
    }

    /**
     * Streamlit is telling this component to redraw.
     * We save the render data in State, so that it can be passed to the
     * component in our own render() function.
     */
    private onRenderMessage = (data: any): void => {
      let args = data["args"]
      if (args == null) {
        console.error(
          `Got null args in onRenderMessage. This should never happen`
        )
        args = {}
      }

      const dfs =
        data["dfs"] && data["dfs"].length > 0
          ? this.argsDataframeToObject(data["dfs"])
          : {}

      let disabled = Boolean(data["disabled"])

      // Update our state to prepare for the render!
      this.setState({
        readyForFirstRender: true,
        renderArgs: args,
        renderDfs: dfs,
        renderDisabled: disabled,
      })
    }

    /** Send a BackMsg to the Streamlit app */
    private sendBackMsg = (type: ComponentBackMsgType, data?: any): void => {
      window.parent.postMessage(
        {
          // TODO? StreamlitMessageVersion: some string
          isStreamlitMessage: true,
          type: type,
          ...data,
        },
        TARGET_ORIGIN
      )
    }

    private argsDataframeToObject = (
      argsDataframe: ArgsDataframe[]
    ): object => {
      const argsDataframeArrow = argsDataframe.map(
        ({ key, value }: ArgsDataframe) => [key, this.toArrowTable(value)]
      )
      return Object.fromEntries(argsDataframeArrow)
    }

    private toArrowTable = (df: ArrowDataframeProto): ArrowTable => {
      const { data, index, columns } = df.data
      return new ArrowTable(data, index, columns)
    }

    public render = (): ReactNode => {
      // If our wrapped component threw an error, display it.
      if (this.state.componentError != null) {
        return (
          <div>
            <h1>Component Error</h1>
            <span>{this.state.componentError.message}</span>
          </div>
        )
      }

      // Don't render until we've gotten our first message from Streamlit
      if (!this.state.readyForFirstRender) {
        return null
      }

      const args = {
        ...this.state.renderArgs,
        ...this.state.renderDfs,
      }

      return (
        <WrappedComponent
          width={window.innerWidth}
          disabled={this.state.renderDisabled}
          args={args}
          setWidgetValue={(value: any) =>
            this.sendBackMsg(ComponentBackMsgType.SET_WIDGET_VALUE, { value })
          }
          updateFrameHeight={this.updateFrameHeight}
        />
      )
    }
  }

  return hoistNonReactStatics(ComponentWrapper, WrappedComponent)
}
