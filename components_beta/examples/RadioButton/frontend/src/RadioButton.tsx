import { BaseProvider, LightTheme } from "baseui"
import { Radio, RadioGroup } from "baseui/radio"
import React from "react"

import { Client as Styletron } from "styletron-engine-atomic"
import { Provider as StyletronProvider } from "styletron-react"
import {
  ComponentProps,
  withStreamlitConnection,
  StreamlitComponentBase,
  Streamlit,
} from "./streamlit"

// Initialize our Styletron engine
const engine = new Styletron()

// Style overrides for our Radio buttons
const radioOverrides = {
  Root: {
    style: ({ $isFocused }: { $isFocused: boolean }) => ({
      marginBottom: 0,
      marginTop: 0,
      paddingRight: ".53333rem",
      backgroundColor: $isFocused ? "#f0f2f6" : "",
      borderTopLeftRadius: ".25rem",
      borderTopRightRadius: ".25rem",
      borderBottomLeftRadius: ".25rem",
      borderBottomRightRadius: ".25rem",
    }),
  },
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  selectedIndex: number
}

/**
 * Radio Button example, using BaseUI.
 */
class RadioButton extends StreamlitComponentBase<State> {
  public constructor(props: ComponentProps) {
    super(props)

    // Determine our initially selected index
    const options = this.props.args["options"] as string[]
    const defaultValue = this.props.args["default"] as string
    let selectedIndex = 0
    if (options != null && defaultValue != null) {
      selectedIndex = options.indexOf(defaultValue)
      if (selectedIndex < 0) {
        selectedIndex = 0
      }
    }

    this.state = { selectedIndex }
  }

  public render = (): React.ReactNode => {
    const style = { width: this.props.width }
    const label = String(this.props.args["label"])
    let options = this.props.args["options"] as string[]
    let disabled = this.props.disabled

    if (options == null || options.length === 0) {
      options = ["No options to select."]
      disabled = true
    }

    return (
      <StyletronProvider value={engine}>
        <BaseProvider theme={LightTheme}>
          <div style={style}>
            <label>{label}</label>
            <RadioGroup
              onChange={this.onSelectionChanged}
              value={this.state.selectedIndex.toString()}
              disabled={disabled}
            >
              {options.map((option: string, index: number) => (
                <Radio
                  key={index}
                  value={index.toString()}
                  overrides={radioOverrides}
                >
                  {option}
                </Radio>
              ))}
            </RadioGroup>
          </div>
        </BaseProvider>
      </StyletronProvider>
    )
  }

  private onSelectionChanged = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const index = parseInt(e.target.value, 10)
    this.setState({ selectedIndex: index }, () => {
      // Get the option name at the selected index
      const options = this.props.args["options"] as string[]
      const value =
        options != null && index < options.length ? options[index] : null
      // Send our current value to Streamlit!
      Streamlit.setComponentValue(value)
    })
  }
}

export default withStreamlitConnection(RadioButton)
