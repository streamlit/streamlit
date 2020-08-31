/** Messages from Component -> Streamlit */
export enum ComponentMessageType {
  // A component sends this message when it's ready to receive messages
  // from Streamlit. Streamlit won't send any messages until it gets this.
  // Data: { apiVersion: number }
  COMPONENT_READY = "streamlit:componentReady",

  // The component has a new value. Send it back to Streamlit, which
  // will then re-run the app.
  // Data: { value: any }
  SET_COMPONENT_VALUE = "streamlit:setComponentValue",

  // The component has a new height for its iframe.
  // Data: { height: number }
  SET_FRAME_HEIGHT = "streamlit:setFrameHeight",
}

/** Messages from Streamlit -> Component */
export enum StreamlitMessageType {
  // Sent by Streamlit when the component should re-render.
  // Data: {
  //  args: any,     // JSON dictionary object
  //  dfs: any[],    // list of {name: string, df: ArrowTable} pairs
  //  bytes: any[],  // list of {name: string, bytes: UInt8Array} pairs
  //  disabled: boolean
  // }
  RENDER = "streamlit:render",
}
