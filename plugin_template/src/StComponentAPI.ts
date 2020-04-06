// The developer-facing API for custom components.

/** Interfaces with the Streamlit API. */
export interface Streamlit {
  /** Set this component's widget value. */
  setWidgetValue: (value: any) => void;
}

export interface StComponentProps {
  /** The arguments passed to the component instance. */
  args: any;

  /** The element's width */
  width: number;

  /** Streamlit API interface. */
  st: Streamlit;
}
