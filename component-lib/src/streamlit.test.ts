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

import { Streamlit, Theme } from "./streamlit";
import { ArrowTable } from "./ArrowTable";
import { EXAMPLE_DF } from "./mock_data";
import { tick } from "./test_utils";

describe("Streamlit", () => {
  test("setComponentReady register listeners only once", () => {
    jest.spyOn(window, "addEventListener");

    Streamlit.setComponentReady();
    Streamlit.setComponentReady();

    expect(jest.mocked(window.addEventListener).mock.calls).toHaveLength(1);
  });

  test("setComponentReady sends message to parent window", () => {
    jest.spyOn(window.parent, "postMessage");

    Streamlit.setComponentReady();
    Streamlit.setComponentReady();

    expect(jest.mocked(window.parent.postMessage).mock.calls).toEqual([
      [
        {
          apiVersion: 1,
          isStreamlitMessage: true,
          type: "streamlit:componentReady",
        },
        "*",
      ],
      [
        {
          apiVersion: 1,
          isStreamlitMessage: true,
          type: "streamlit:componentReady",
        },
        "*",
      ],
    ]);
  });

  test("setFrameHeight sends height to parent window", () => {
    jest.spyOn(window.parent, "postMessage");
    Object.defineProperty(document.body, "scrollHeight", {
      value: 42,
      configurable: true,
    });

    Streamlit.setFrameHeight();

    expect(jest.mocked(window.parent.postMessage).mock.calls[0]).toEqual([
      {
        height: 42,
        isStreamlitMessage: true,
        type: "streamlit:setFrameHeight",
      },
      "*",
    ]);
    // @ts-expect-error
    delete document.body.scrollHeight;
  });

  test("setFrameHeight sends height to parent window only if changed", () => {
    jest.spyOn(window.parent, "postMessage");
    let scrollHeight = 42;
    Object.defineProperty(document.body, "scrollHeight", {
      get: () => scrollHeight,
      configurable: true,
    });

    Streamlit.setFrameHeight();
    expect(jest.mocked(window.parent.postMessage).mock.calls).toHaveLength(1);

    // Assert that the value is not sent again if height does not change
    Streamlit.setFrameHeight();
    expect(jest.mocked(window.parent.postMessage).mock.calls).toHaveLength(1);

    // Ensure that the NEW value is sent again
    scrollHeight = 420;
    Streamlit.setFrameHeight();
    expect(jest.mocked(window.parent.postMessage).mock.calls).toHaveLength(2);
    expect(
      jest.mocked(window.parent.postMessage).mock.calls[1][0].height
    ).toEqual(scrollHeight);
  });

  test("setComponentValue should support arrowTable", () => {
    jest.spyOn(window.parent, "postMessage");

    const table = new ArrowTable(
      EXAMPLE_DF.data,
      EXAMPLE_DF.index,
      EXAMPLE_DF.columns
    );
    Streamlit.setComponentValue(table);

    expect(jest.mocked(window.parent.postMessage).mock.calls).toHaveLength(1);

    const parentMessage = jest.mocked(window.parent.postMessage).mock
      .calls[0][0];
    // Assert content of message except value. The value is too complex for
    // a simple assertion, so we will validate it separately
    const value = parentMessage.value;
    delete parentMessage.value;
    expect(parentMessage).toEqual({
      dataType: "dataframe",
      isStreamlitMessage: true,
      type: "streamlit:setComponentValue",
    });
    // Assert that the table has the expected characteristic.
    const newTable = new ArrowTable(value.data, value.index, value.columns);
    expect(newTable.rows).toEqual(6);
    expect(newTable.columns).toEqual(4);
    expect(newTable.headerRows).toEqual(1);
    expect(newTable.headerColumns).toEqual(1);
  });

  test("setComponentValue should support JSON values", () => {
    jest.spyOn(window.parent, "postMessage");
    Streamlit.setComponentValue("123");

    expect(jest.mocked(window.parent.postMessage).mock.calls).toHaveLength(1);

    expect(jest.mocked(window.parent.postMessage).mock.calls[0]).toEqual([
      {
        dataType: "json",
        isStreamlitMessage: true,
        type: "streamlit:setComponentValue",
        value: "123",
      },
      "*",
    ]);
  });

  test("setComponentValue should support array buffers", () => {
    jest.spyOn(window.parent, "postMessage");
    const value = new Uint8Array([1, 2]).buffer;
    Streamlit.setComponentValue(value);

    expect(jest.mocked(window.parent.postMessage).mock.calls).toHaveLength(1);
    expect(jest.mocked(window.parent.postMessage).mock.calls[0]).toEqual([
      {
        dataType: "bytes",
        isStreamlitMessage: true,
        type: "streamlit:setComponentValue",
        value: new Uint8Array([1, 2]),
      },
      "*",
    ]);
  });

  test("setComponentValue should support typed arrays", () => {
    jest.spyOn(window.parent, "postMessage");
    const value = new Uint8Array([1, 2]);
    Streamlit.setComponentValue(value);

    expect(jest.mocked(window.parent.postMessage).mock.calls).toHaveLength(1);
    expect(jest.mocked(window.parent.postMessage).mock.calls[0]).toEqual([
      {
        dataType: "bytes",
        isStreamlitMessage: true,
        type: "streamlit:setComponentValue",
        value: new Uint8Array([1, 2]),
      },
      "*",
    ]);
  });

  test("data from the parent frame is received and propagated as an event", async () => {
    const streamlitEventsListener = jest.fn();
    Streamlit.events.addEventListener(
      "streamlit:render",
      streamlitEventsListener
    );
    Streamlit.setComponentReady();

    window.postMessage({ type: "streamlit:render", args: {} }, "*");
    await tick();

    expect(streamlitEventsListener.mock.calls).toHaveLength(1);
    const renderEvent = streamlitEventsListener.mock.calls[0][0];
    expect(renderEvent.detail).toEqual({
      args: {},
      disabled: false,
      theme: undefined,
    });
  });

  test("The parent frame can set the theme", async () => {
    const streamlitEventsListener = jest.fn();
    Streamlit.events.addEventListener(
      "streamlit:render",
      streamlitEventsListener
    );
    Streamlit.setComponentReady();

    const theme: Theme = {
      base: "red",
      primaryColor: "blue",
      backgroundColor: "green",
      secondaryBackgroundColor: "purple",
      textColor: "black",
      font: "Courier New",
    };

    window.postMessage(
      { type: "streamlit:render", args: {}, theme: theme },
      "*"
    );
    await tick();

    expect(streamlitEventsListener.mock.calls).toHaveLength(1);
    const renderEvent = streamlitEventsListener.mock.calls[0][0];
    expect(renderEvent.detail.theme).toEqual(theme);

    expect(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--primary-color"
      )
    ).toEqual(theme.primaryColor);
    expect(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--background-color"
      )
    ).toEqual(theme.backgroundColor);
    expect(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--secondary-background-color"
      )
    ).toEqual(theme.secondaryBackgroundColor);
    expect(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--text-color"
      )
    ).toEqual(theme.textColor);

    expect(
      document.getElementById(Streamlit.INJECTED_STYLE_ELEMENT_ID)
    ).toBeInstanceOf(HTMLStyleElement);
    expect(
      document.querySelectorAll(`style#${Streamlit.INJECTED_STYLE_ELEMENT_ID}`)
    ).toHaveLength(1);

    window.postMessage(
      { type: "streamlit:render", args: {}, theme: theme },
      "*"
    );
    await tick();

    expect(
      document.querySelectorAll(`style#${Streamlit.INJECTED_STYLE_ELEMENT_ID}`)
    ).toHaveLength(1);
  });

  test("The parent frame can sent plain arguments", async () => {
    const streamlitEventsListener = jest.fn();
    Streamlit.events.addEventListener(
      "streamlit:render",
      streamlitEventsListener
    );
    Streamlit.setComponentReady();

    window.postMessage(
      {
        type: "streamlit:render",
        args: { textValue: "smile", numberValue: 42 },
      },
      "*"
    );
    await tick();

    expect(streamlitEventsListener.mock.calls).toHaveLength(1);
    const renderEvent = streamlitEventsListener.mock.calls[0][0];
    expect(renderEvent.detail.args).toEqual({
      numberValue: 42,
      textValue: "smile",
    });
  });

  test("The parent frame can sent dataframe", async () => {
    const streamlitEventsListener = jest.fn();
    Streamlit.events.addEventListener(
      "streamlit:render",
      streamlitEventsListener
    );
    Streamlit.setComponentReady();

    window.postMessage(
      {
        type: "streamlit:render",
        args: {},
        dfs: [
          {
            key: "first-df",
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

    expect(streamlitEventsListener.mock.calls).toHaveLength(1);
    const renderEvent = streamlitEventsListener.mock.calls[0][0];
    const arrowTable = renderEvent.detail.args["first-df"];
    expect(arrowTable.rows).toEqual(6);
    expect(arrowTable.columns).toEqual(4);
    expect(arrowTable.headerRows).toEqual(1);
    expect(arrowTable.headerColumns).toEqual(1);
  });

  test("The parent frame can disable component", async () => {
    const streamlitEventsListener = jest.fn();
    Streamlit.events.addEventListener(
      "streamlit:render",
      streamlitEventsListener
    );
    Streamlit.setComponentReady();

    window.postMessage(
      { type: "streamlit:render", args: {}, disabled: true },
      "*"
    );
    await tick();

    expect(streamlitEventsListener.mock.calls).toHaveLength(1);
    const renderEvent = streamlitEventsListener.mock.calls[0][0];
    expect(renderEvent.detail.disabled).toEqual(true);
  });
});
