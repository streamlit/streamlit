import hoistNonReactStatics from "hoist-non-react-statics";
import React, { ReactNode } from "react";
import { RenderData, Streamlit, Theme } from "./streamlit";

/**
 * Props passed to custom Streamlit components.
 */
export interface ComponentProps<ArgType=any> {
  /** Named dictionary of arguments passed from Python. */
  args: ArgType;

  /** The component's width. */
  width: number;

  /**
   * True if the component should be disabled.
   * All components get disabled while the app is being re-run,
   * and become re-enabled when the re-run has finished.
   */
  disabled: boolean;

  /** Theme definition dictionary passed from the main client.*/
  theme?: Theme;
}

/**
 * Optional Streamlit React-based component base class.
 *
 * You are not required to extend this base class to create a Streamlit
 * component. If you decide not to extend it, you should implement the
 * `componentDidMount` and `componentDidUpdate` functions in your own class,
 * so that your plugin properly resizes.
 */
export class StreamlitComponentBase<S = {}, ArgType=any> extends React.PureComponent<
  ComponentProps<ArgType>,
  S
> {
  public componentDidMount(): void {
    // After we're rendered for the first time, tell Streamlit that our height
    // has changed.
    Streamlit.setFrameHeight();
  }

  public componentDidUpdate(): void {
    // After we're updated, tell Streamlit that our height may have changed.
    Streamlit.setFrameHeight();
  }
}

/**
 * Wrapper for React-based Streamlit components.
 *
 * Bootstraps the communication interface between Streamlit and the component.
 */
export function withStreamlitConnection<ArgType=any>(
  WrappedComponent: React.ComponentType<ComponentProps>
): React.ComponentType {
  interface WrapperProps {}

  interface WrapperState {
    renderData?: RenderData<ArgType>;
    componentError?: Error;
  }

  class ComponentWrapper extends React.PureComponent<
    WrapperProps,
    WrapperState
  > {
    public constructor(props: WrapperProps) {
      super(props);
      this.state = {
        renderData: undefined,
        componentError: undefined
      };
    }

    /**
     * Error boundary function. This will be called if our wrapped
     * component throws an error. We store the caught error in our state,
     * and display it in the next render().
     */
    public static getDerivedStateFromError = (
      error: Error
    ): Partial<WrapperState> => {
      return { componentError: error };
    };

    public componentDidMount = (): void => {
      // Set up event listeners, and signal to Streamlit that we're ready.
      // We won't render the component until we receive the first RENDER_EVENT.
      Streamlit.events.addEventListener(
        Streamlit.RENDER_EVENT,
        this.onRenderEvent
      );
      Streamlit.setComponentReady();
    };

    public componentDidUpdate = (): void => {
      // If our child threw an error, we display it in render(). In this
      // case, the child won't be mounted and therefore won't call
      // `setFrameHeight` on its own. We do it here so that the rendered
      // error will be visible.
      if (this.state.componentError != null) {
        Streamlit.setFrameHeight();
      }
    };

    public componentWillUnmount = (): void => {
      Streamlit.events.removeEventListener(
        Streamlit.RENDER_EVENT,
        this.onRenderEvent
      );
    };

    /**
     * Streamlit is telling this component to redraw.
     * We save the render data in State, so that it can be passed to the
     * component in our own render() function.
     */
    private onRenderEvent = (event: Event): void => {
      // Update our state with the newest render data
      const renderEvent = event as CustomEvent<RenderData<ArgType>>;
      this.setState({ renderData: renderEvent.detail });
    };

    public render(): ReactNode {
      // If our wrapped component threw an error, display it.
      if (this.state.componentError != null) {
        return (
          <div>
            <h1>Component Error</h1>
            <span>{this.state.componentError.message}</span>
          </div>
        );
      }

      // Don't render until we've gotten our first RENDER_EVENT from Streamlit.
      if (this.state.renderData == null) {
        return null;
      }

      return (
        <WrappedComponent
          width={window.innerWidth}
          disabled={this.state.renderData.disabled}
          args={this.state.renderData.args}
          theme={this.state.renderData.theme}
        />
      );
    }
  }

  return hoistNonReactStatics(ComponentWrapper, WrappedComponent);
}
