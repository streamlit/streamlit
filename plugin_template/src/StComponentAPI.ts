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
}
