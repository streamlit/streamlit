import { Props } from "./WebcamComponent"

const getProps = (props: Partial<Props> = {}): Props => {
  return {
    handleCapture: jest.fn(),
    width: 500,
    disabled: false,
    ...props,
  }
}

describe("Test Webcam Component")
