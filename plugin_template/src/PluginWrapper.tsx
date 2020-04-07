import hoistNonReactStatics from "hoist-non-react-statics";
import React, { ComponentType, ReactNode } from "react";
import { Streamlit } from "./StComponentAPI";

// TODO: Figure this out
const TARGET_ORIGIN = "*";

/** Messages from Plugin -> Streamlit */
enum PluginBackMsgType {
  // A plugin sends this message when it's ready to receive messages
  // from Streamlit. Streamlit won't send any messages until it gets this.
  // No data.
  PLUGIN_READY = "pluginReady",

  // The plugin has a new widget value. Send it back to Streamlit, which
  // will then re-run the app.
  // Data: { value: any }
  SET_WIDGET_VALUE = "setWidgetValue"
}

/** Messages from Streamlit -> Plugin */
enum PluginForwardMsgType {
  // Sent by Streamlit when the plugin should re-render.
  // Data: { args: any, disabled: boolean }
  RENDER = "render"
}

interface Props {}

interface State {
  readyForFirstRender: boolean;
  renderArgs: any;
  renderDisabled: boolean;
}

function StreamlitPlugin(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  /**
   * Plugin wrapper. Bootstraps the communication interface between
   * Streamlit and the plugin.
   *
   * Plugin writers *do not* edit this class.
   */
  class PluginWrapper extends React.PureComponent<Props, State> {
    private readonly streamlitAPI: Streamlit;

    public constructor(props: Props) {
      super(props);

      this.state = {
        readyForFirstRender: false,
        renderArgs: {},
        renderDisabled: false
      };

      // Build the API that the plugin uses to communicate to Streamlit.
      // We send our back messages
      this.streamlitAPI = {
        setWidgetValue: value =>
          this.sendBackMsg(PluginBackMsgType.SET_WIDGET_VALUE, { value })
      };
    }

    public componentDidMount = (): void => {
      // Set up event listeners, and signal to Streamlit that we're ready.
      // We won't render the plugin until we receive the first RENDER message.
      window.addEventListener("message", this.onMessageEvent);
      this.sendBackMsg(PluginBackMsgType.PLUGIN_READY);
    };

    public componentWillUnmount = (): void => {
      window.removeEventListener("message", this.onMessageEvent);
    };

    /** Receive a ForwardMsg from the Streamlit app */
    private onMessageEvent = (event: MessageEvent): void => {
      // We only listen for Streamlit messages.
      if (!event.data.hasOwnProperty("isStreamlitMessage")) {
        return;
      }

      const type = event.data["type"];
      switch (type) {
        case PluginForwardMsgType.RENDER:
          this.onRenderMessage(event.data);
          break;

        default:
          console.warn(`Unrecognized Streamlit message '${type}`);
      }
    };

    /**
     * Streamlit is telling this plugin to redraw.
     * We save the render data in State, so that it can be passed to the
     * plugin in our own render() function.
     */
    private onRenderMessage = (data: any): void => {
      let args = data["args"];
      if (args == null) {
        console.error(
          `Got null args in onRenderMessage. This should never happen`
        );
        args = {};
      }

      let disabled = Boolean(data["disabled"]);

      // Update our state to prepare for the render!
      this.setState({
        readyForFirstRender: true,
        renderArgs: args,
        renderDisabled: disabled
      });
    };

    /** Send a BackMsg to the Streamlit app */
    private sendBackMsg = (type: PluginBackMsgType, data?: any): void => {
      console.log(`PluginWrapper.sendBackMsg: ${type}, ${data}`);
      window.parent.postMessage(
        {
          // TODO? StreamlitMessageVersion: some string
          isStreamlitMessage: true,
          type: type,
          ...data
        },
        TARGET_ORIGIN
      );
    };

    public render = (): ReactNode => {
      if (!this.state.readyForFirstRender) {
        // Don't render until we've gotten our first message from Streamlit
        return null;
      }

      return (
        <WrappedComponent
          st={this.streamlitAPI}
          width={window.innerWidth}
          disabled={this.state.renderDisabled}
          args={this.state.renderArgs}
        />
      );
    };
  }

  return hoistNonReactStatics(PluginWrapper, WrappedComponent);
}

export default StreamlitPlugin;
