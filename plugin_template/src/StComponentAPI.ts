// The developer-facing API for custom components.

export interface StComponentProps {
  /** The arguments passed to the component instance. */
  args: any;

  /** The component's width */
  width: number;

  /**
   * True if the component should be disabled.
   * All components get disabled while the app is being re-run,
   * and become re-enabled when the re-run has finished.
   */
  disabled: boolean;

  /** Set this component's widget value. */
  setWidgetValue: (value: any) => void;

  /**
   * Set the component's height in the Streamlit app. This controls the height
   * of the iframe that the component is rendered into.
   *
   * If newHeight is not specified, then the component's scrollHeight is used.
   * This is a good default for most component that want to occupy the
   * entire iframe.
   */
  updateFrameHeight: (newHeight?: number) => void;
}
