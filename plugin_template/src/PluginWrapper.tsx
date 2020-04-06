import React, { ReactNode } from "react";
import Plugin from "./Plugin";

// TODO: Figure this out
const TARGET_ORIGIN = "*";

/** Messages from Plugin -> Streamlit */
enum PluginBackMsgType {
  // A plugin sends this message when it's ready to receive messages
  // from Streamlit. Streamlit won't send any messages until it gets this.
  // No data.
  PLUGIN_READY = "pluginReady"
}

/** Messages from Streamlit -> Plugin */
enum PluginForwardMsgType {
  // Sent by Streamlit when the plugin should re-render.
  // Data: args: any - the args JSON dict sent from the backend
  RENDER = "render"
}

interface Props {}

interface State {
  readyForFirstRender: boolean;
  renderArgs: any;
}

/**
 * Plugin wrapper. Bootstraps the communication interface between
 * Streamlit and the plugin.
 *
 * Plugin writers *do not* edit this class.
 */
class PluginWrapper extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      readyForFirstRender: false,
      renderArgs: {}
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
    if (!("isStreamlitMessage" in event.data)) {
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

  private onRenderMessage = (data: any): void => {
    let args: any = data["args"];
    if (args == null) {
      console.error(
        `Got null args in onRenderMessage. This should never happen`
      );
      args = {};
    }

    // Update our state to prepare for the render!
    this.setState({ readyForFirstRender: true, renderArgs: args });
  };

  /** Send a BackMsg to the Streamlit app */
  private sendBackMsg = (type: PluginBackMsgType, data?: any): void => {
    window.parent.postMessage(
      {
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

    return <Plugin args={this.state.renderArgs} />;
  };
}

export default PluginWrapper;
