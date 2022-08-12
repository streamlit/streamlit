// Safari doesn't support the EventTarget class, so we use a shim.
import { EventTarget } from "event-target-shim";
import { ArrowDataframeProto, ArrowTable } from "./ArrowTable";

/** Object defining the currently set theme. */
export interface Theme {
  base: string;
  primaryColor: string;
  backgroundColor: string;
  secondaryBackgroundColor: string;
  textColor: string;
  font: string;
}

/** Data sent in the custom Streamlit render event. */
export interface RenderData<ArgType=any> {
  args: ArgType;
  disabled: boolean;
  theme?: Theme;
}

// Types that Streamlit.setComponentValue accepts
type ComponentValue = ArrowTable | TypedArray | ArrayBuffer | any;

/** Messages from Component -> Streamlit */
enum ComponentMessageType {
  // A component sends this message when it's ready to receive messages
  // from Streamlit. Streamlit won't send any messages until it gets this.
  // Data: { apiVersion: number }
  COMPONENT_READY = "streamlit:componentReady",

  // The component has a new widget value. Send it back to Streamlit, which
  // will then re-run the app.
  // Data: { value: any }
  SET_COMPONENT_VALUE = "streamlit:setComponentValue",

  // The component has a new height for its iframe.
  // Data: { height: number }
  SET_FRAME_HEIGHT = "streamlit:setFrameHeight"
}

/**
 * Streamlit communication API.
 *
 * Components can send data to Streamlit via the functions defined here,
 * and receive data from Streamlit via the `events` property.
 */
export class Streamlit {
  /**
   * The Streamlit component API version we're targeting.
   * There's currently only 1!
   */
  public static readonly API_VERSION = 1;

  public static readonly RENDER_EVENT = "streamlit:render";

  /** Dispatches events received from Streamlit. */
  public static readonly events = new EventTarget();

  private static registeredMessageListener = false;
  private static lastFrameHeight?: number;

  /**
   * Tell Streamlit that the component is ready to start receiving data.
   * Streamlit will defer emitting RENDER events until it receives the
   * COMPONENT_READY message.
   */
  public static setComponentReady = (): void => {
    if (!Streamlit.registeredMessageListener) {
      // Register for message events if we haven't already
      window.addEventListener("message", Streamlit.onMessageEvent);
      Streamlit.registeredMessageListener = true;
    }

    Streamlit.sendBackMsg(ComponentMessageType.COMPONENT_READY, {
      apiVersion: Streamlit.API_VERSION
    });
  };

  /**
   * Report the component's height to Streamlit.
   * This should be called every time the component changes its DOM - that is,
   * when it's first loaded, and any time it updates.
   */
  public static setFrameHeight = (height?: number): void => {
    if (height === undefined) {
      // `height` is optional. If undefined, it defaults to scrollHeight,
      // which is the entire height of the element minus its border,
      // scrollbar, and margin.
      height = document.body.scrollHeight;
    }

    if (height === Streamlit.lastFrameHeight) {
      // Don't bother updating if our height hasn't changed.
      return;
    }

    Streamlit.lastFrameHeight = height;
    Streamlit.sendBackMsg(ComponentMessageType.SET_FRAME_HEIGHT, { height });
  };

  /**
   * Set the component's value. This value will be returned to the Python
   * script, and the script will be re-run.
   *
   * For example:
   *
   * JavaScript:
   * Streamlit.setComponentValue("ahoy!")
   *
   * Python:
   * value = st.my_component(...)
   * st.write(value) # -> "ahoy!"
   *
   * The value must be an ArrowTable, a typed array, an ArrayBuffer, or be
   * serializable to JSON.
   */
  public static setComponentValue = (value: ComponentValue): void => {
    let dataType;
    if (value instanceof ArrowTable) {
      dataType = "dataframe";
      value = value.serialize();
    } else if (isTypedArray(value)) {
      // All typed arrays get sent as Uint8Array, because that's what our
      // protobuf library uses for the "bytes" field type.
      dataType = "bytes";
      value = new Uint8Array(value.buffer);
    } else if (value instanceof ArrayBuffer) {
      dataType = "bytes";
      value = new Uint8Array(value);
    } else {
      dataType = "json";
    }
    Streamlit.sendBackMsg(ComponentMessageType.SET_COMPONENT_VALUE, {
      value,
      dataType
    });
  };

  /** Receive a ForwardMsg from the Streamlit app */
  private static onMessageEvent = (event: MessageEvent): void => {
    const type = event.data["type"];
    switch (type) {
      case Streamlit.RENDER_EVENT:
        Streamlit.onRenderMessage(event.data);
        break;
    }
  };

  /**
   * Handle an untyped Streamlit render event and redispatch it as a
   * StreamlitRenderEvent.
   */
  private static onRenderMessage = <ArgType=any, >(data: {args: ArgType, dfs?: ArgsDataframe[], disabled?: boolean, theme?: Theme}): void => {
    let args = data["args"];
    if (args == null) {
      console.error(
        `Got null args in onRenderMessage. This should never happen`
      );
      args = {} as ArgType;
    }

    // Parse our dataframe arguments with arrow, and merge them into our args dict
    const dataframeArgs =
      data["dfs"] && data["dfs"].length > 0
        ? Streamlit.argsDataframeToObject(data["dfs"])
        : {};

    args = {
      ...args,
      ...dataframeArgs
    };

    const disabled = Boolean(data["disabled"]);
    const theme = data["theme"];
    if (theme) {
      _injectTheme(theme);
    }

    // Dispatch a render event!
    const eventData = { disabled, args, theme };
    const event = new CustomEvent<RenderData<ArgType>>(Streamlit.RENDER_EVENT, {
      detail: eventData
    });
    Streamlit.events.dispatchEvent(event);
  };

  private static argsDataframeToObject = (
    argsDataframe: ArgsDataframe[]
  ): object => {
    const argsDataframeArrow = argsDataframe.map(
      ({ key, value }: ArgsDataframe) => [key, Streamlit.toArrowTable(value)]
    );
    return Object.fromEntries(argsDataframeArrow);
  };

  private static toArrowTable = (df: ArrowDataframeProto): ArrowTable => {
    const { data, index, columns, styler } = df.data;
    return new ArrowTable(data, index, columns, styler);
  };

  /** Post a message to the Streamlit app. */
  private static sendBackMsg = (type: string, data?: any): void => {
    window.parent.postMessage(
      {
        isStreamlitMessage: true,
        type: type,
        ...data
      },
      "*"
    );
  };
}

const _injectTheme = (theme: Theme) => {
  const style = document.createElement("style");
  document.head.appendChild(style);
  style.innerHTML = `
    :root {
      --primary-color: ${theme.primaryColor};
      --background-color: ${theme.backgroundColor};
      --secondary-background-color: ${theme.secondaryBackgroundColor};
      --text-color: ${theme.textColor};
      --font: ${theme.font};
    }

    body {
      background-color: var(--background-color);
      color: var(--text-color);
    }
  `;
};

interface ArgsDataframe {
  key: string;
  value: ArrowDataframeProto;
}

// The TypedArray JavaScript types
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

/** True if the value is a TypedArray. */
function isTypedArray(value: any): value is TypedArray {
  let isBigIntArray = false;
  try {
    isBigIntArray =
      value instanceof BigInt64Array || value instanceof BigUint64Array;
  } catch (e) {
    // Ignore cause Safari does not support this
    // https://caniuse.com/mdn-javascript_builtins_bigint64array
  }

  return (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array ||
    isBigIntArray
  );
}
