/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ComponentProps,
  StreamlitComponentBase,
  withStreamlitConnection,
} from "./StreamlitReact";
import * as React from "react";
import { render } from "@testing-library/react";
import { tick } from "./test_utils";
import { EXAMPLE_DF } from "./mock_data";
import { ArrowTable } from "./ArrowTable";
import { Streamlit } from "./streamlit";

class StaticComponent extends StreamlitComponentBase {
  render() {
    return <>Static component</>;
  }
}

describe("StreamlitReact", () => {
  test("the component should be empty initially", () => {
    const StreamlitComponent = withStreamlitConnection(StaticComponent);
    expect(document.body.innerHTML).toEqual("");

    render(<StreamlitComponent />);

    expect(document.body.innerHTML).toEqual("<div></div>");
  });

  test("the component should be visible after initialization", async () => {
    const StreamlitComponent = withStreamlitConnection(StaticComponent);
    expect(document.body.innerHTML).toEqual("");

    const { getByText } = render(<StreamlitComponent />);
    window.postMessage({ type: "streamlit:render", args: {} }, "*");
    await tick();

    expect(getByText("Static component")).toBeInTheDocument();
  });

  test("the component should receive arguments from the parent frame", async () => {
    interface ComponentArgument {
      firstArg: string;
    }

    class ComponentWithArguments extends StreamlitComponentBase<
      {},
      ComponentArgument
    > {
      render(): JSX.Element {
        return <p>{this.props.args.firstArg}</p>;
      }
    }

    const Component = withStreamlitConnection(ComponentWithArguments);
    const { getByText } = render(<Component />);
    window.postMessage(
      { type: "streamlit:render", args: { firstArg: "Argument text 123" } },
      "*"
    );
    await tick();

    expect(getByText("Argument text 123")).toBeInTheDocument();
  });

  test("the component should receive dataframe from the parent frame", async () => {
    interface ComponentArgument {
      firstArg: ArrowTable;
    }
    class DataframeComponent extends StreamlitComponentBase<ComponentArgument> {
      render() {
        const firstArg = this.props.args.firstArg;
        const { content } = firstArg.getCell(1, 1);
        return <>{String(content)}</>;
      }
    }

    const Component = withStreamlitConnection(DataframeComponent);
    const { getByText } = render(<Component />);

    window.postMessage(
      {
        type: "streamlit:render",
        args: {},
        dfs: [
          {
            key: "firstArg",
            value: {
              data: {
                data: EXAMPLE_DF.data,
                index: EXAMPLE_DF.index,
                columns: EXAMPLE_DF.columns,
              },
            },
          },
        ],
      },
      "*"
    );
    await tick();

    expect(getByText("Jason")).toBeInTheDocument();
  });

  test("the component error should be visible", async () => {
    class BrokenComponent extends StreamlitComponentBase {
      render(): React.ReactNode {
        throw new Error("Error in component");
      }
    }
    jest.spyOn(console, "error").mockImplementation(() => {});

    const Component = withStreamlitConnection(BrokenComponent);
    const { getByText } = render(<Component />);
    window.postMessage(
      {
        type: "streamlit:render",
        args: {},
      },
      "*"
    );
    await tick();

    expect(getByText("Component Error")).toBeInTheDocument();
    expect(getByText("Error in component")).toBeInTheDocument();
    expect(jest.mocked(console.error).mock.calls).toHaveLength(2);
  });

  test("the component should update the frame height initially", async () => {
    jest.spyOn(Streamlit, "setFrameHeight");

    const Component = withStreamlitConnection(StaticComponent);
    const { getByText } = render(<Component />);
    window.postMessage(
      {
        type: "streamlit:render",
        args: {},
      },
      "*"
    );
    await tick();

    expect(jest.mocked(Streamlit.setFrameHeight).mock.calls).toHaveLength(1);
    expect(getByText("Static component")).toBeInTheDocument();
  });

  test("the component should update the frame height after updating the arguments", async () => {
    jest.spyOn(Streamlit, "setFrameHeight");

    const Component = withStreamlitConnection(StaticComponent);
    render(<Component />);
    for (const value of [1, 2, 3]) {
      window.postMessage(
        {
          type: "streamlit:render",
          args: { value },
        },
        "*"
      );
      await tick();
    }

    expect(jest.mocked(Streamlit.setFrameHeight).mock.calls).toHaveLength(3);
  });
});
