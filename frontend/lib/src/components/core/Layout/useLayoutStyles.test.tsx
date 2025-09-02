import React, { ReactNode } from "react"
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

import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Element, IAlert, streamlit } from "@streamlit/protobuf"

import { FlexContextProvider } from "./FlexContext"
import { useLayoutStyles, UseLayoutStylesShape } from "./useLayoutStyles"
import { Direction, MinFlexElementWidth } from "./utils"

function withFlexContextProvider(direction: Direction) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <FlexContextProvider direction={direction}>
        {children}
      </FlexContextProvider>
    )
  }
}

class MockElement implements Element {
  widthConfig?: streamlit.WidthConfig | null

  heightConfig?: streamlit.HeightConfig | null

  type?: "imgs" | "textArea" | "iframe" | "deckGlJsonChart" | "arrowDataFrame"

  constructor(props: Partial<MockElement> = {}) {
    Object.assign(this, props)
  }

  toJSON(): MockElement {
    return this
  }
}

const getDefaultStyles = (
  overrides: Partial<UseLayoutStylesShape>
): UseLayoutStylesShape => {
  const defaults = {
    width: "auto" as const,
    height: "auto" as const,
    overflow: "visible" as const,
  }
  return { ...defaults, ...overrides }
}

describe("#useLayoutStyles", () => {
  describe("with an element", () => {
    describe("that has useContainerWidth set to a falsy value", () => {
      const useContainerWidth = false

      it.each([
        [undefined, getDefaultStyles({})],
        [0, getDefaultStyles({})],
        [-100, getDefaultStyles({})],
        [NaN, getDefaultStyles({})],
        [100, getDefaultStyles({ width: "100px" })],
      ])("and with a width value of %s, returns %o", (width, expected) => {
        const element = new MockElement()
        const subElement = { width, useContainerWidth }
        const { result } = renderHook(() =>
          useLayoutStyles({ element, subElement })
        )
        expect(result.current).toEqual(expected)
      })
    })

    describe('that has useContainerWidth set to "true"', () => {
      const useContainerWidth = true

      it.each([
        [undefined, getDefaultStyles({ width: "100%" })],
        [0, getDefaultStyles({ width: "100%" })],
        [-100, getDefaultStyles({ width: "100%" })],
        [NaN, getDefaultStyles({ width: "100%" })],
        [100, getDefaultStyles({ width: "100%" })],
      ])("and with a width value of %s, returns %o", (width, expected) => {
        const element = new MockElement()
        const subElement = { width, useContainerWidth }
        const { result } = renderHook(() =>
          useLayoutStyles({ element, subElement })
        )
        expect(result.current).toEqual(expected)
      })
    })

    describe("that has widthConfig set", () => {
      it.each([
        [
          new streamlit.WidthConfig({ useStretch: true }),
          false,
          getDefaultStyles({ width: "100%" }),
        ],
        [
          new streamlit.WidthConfig({ useStretch: true }),
          true,
          getDefaultStyles({ width: "100%" }),
        ],
        [
          new streamlit.WidthConfig({ useContent: true }),
          false,
          getDefaultStyles({ width: "fit-content" }),
        ],
        [
          new streamlit.WidthConfig({ useContent: true }),
          true,
          getDefaultStyles({ width: "100%" }),
        ],
        [
          new streamlit.WidthConfig({ pixelWidth: 100 }),
          false,
          getDefaultStyles({ width: "100px" }),
        ],
        [
          new streamlit.WidthConfig({ pixelWidth: 100 }),
          true,
          getDefaultStyles({ width: "100%" }),
        ],
      ])(
        "and with a widthConfig value of %o and useContainerWidth %s, returns %o",
        (widthConfig, useContainerWidth, expected) => {
          const element = new MockElement({ widthConfig })
          const subElement = { useContainerWidth }
          const { result } = renderHook(() =>
            useLayoutStyles({ element, subElement })
          )
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("that has widthConfig set to invalid pixelWidth values", () => {
      it.each([
        [0, false, getDefaultStyles({})],
        [-100, false, getDefaultStyles({})],
        [NaN, false, getDefaultStyles({})],
        [100, false, getDefaultStyles({ width: "100px" })],
        [0, true, getDefaultStyles({ width: "100%" })],
        [-100, true, getDefaultStyles({ width: "100%" })],
        [NaN, true, getDefaultStyles({ width: "100%" })],
        [100, true, getDefaultStyles({ width: "100%" })],
      ])(
        "and with a pixelWidth value of %s and useContainerWidth %s, returns %o",
        (pixelWidth, useContainerWidth, expected) => {
          const element = new MockElement({
            widthConfig: new streamlit.WidthConfig({ pixelWidth }),
          })
          const subElement = { useContainerWidth }
          const { result } = renderHook(() =>
            useLayoutStyles({ element, subElement })
          )
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("with variations on element", () => {
      it.each([
        [
          { widthConfig: undefined, useContainerWidth: false },
          getDefaultStyles({}),
        ],
        [
          { widthConfig: undefined, useContainerWidth: true },
          getDefaultStyles({ width: "100%" }),
        ],
      ])("and with element %o, returns %o", (props, expected) => {
        const element = new MockElement({
          widthConfig: props.widthConfig,
        })
        const subElement = { useContainerWidth: props.useContainerWidth }
        const { result } = renderHook(() =>
          useLayoutStyles({ element, subElement })
        )
        expect(result.current).toEqual(expected)
      })
    })

    describe("with width included along with widthConfig", () => {
      it.each([
        [
          {
            widthConfig: new streamlit.WidthConfig({ useStretch: true }),
            width: 100,
          },
          false,
          getDefaultStyles({ width: "100%" }),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ useContent: true }),
            width: 100,
          },
          false,
          getDefaultStyles({ width: "fit-content" }),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ pixelWidth: 200 }),
            width: 100,
          },
          false,
          getDefaultStyles({ width: "200px" }),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ pixelWidth: 200 }),
            width: 100,
          },
          true,
          getDefaultStyles({ width: "100%" }),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ pixelWidth: 0 }),
            width: 100,
          },
          false,
          getDefaultStyles({}),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ pixelWidth: -100 }),
            width: 100,
          },
          false,
          getDefaultStyles({}),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ pixelWidth: NaN }),
            width: 100,
          },
          false,
          getDefaultStyles({}),
        ],
      ])(
        "and with element props %o and useContainerWidth %s, returns %o",
        (props, useContainerWidth, expected) => {
          const element = new MockElement({
            widthConfig: props.widthConfig,
          })

          const subElement = {
            width: props.width,
            useContainerWidth,
          }

          const { result } = renderHook(() =>
            useLayoutStyles({ element, subElement })
          )
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("with width defined on subElement but element.widthConfig is null or undefined", () => {
      it.each([
        [100, false, null, getDefaultStyles({ width: "100px" })],
        [200, false, null, getDefaultStyles({ width: "200px" })],
        [100, true, null, getDefaultStyles({ width: "100%" })],
        [0, false, null, getDefaultStyles({})],
        [-100, false, null, getDefaultStyles({})],
        [100, false, undefined, getDefaultStyles({ width: "100px" })],
        [200, false, undefined, getDefaultStyles({ width: "200px" })],
        [100, true, undefined, getDefaultStyles({ width: "100%" })],
        [0, false, undefined, getDefaultStyles({})],
        [-100, false, undefined, getDefaultStyles({})],
      ])(
        "and with a width value of %s, useContainerWidth %s, and widthConfig %s, returns %o",
        (width, useContainerWidth, widthConfig, expected) => {
          const element = new MockElement({
            widthConfig,
          })

          const subElement = {
            width,
            useContainerWidth,
          }

          const { result } = renderHook(() =>
            useLayoutStyles({ element, subElement })
          )
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("that has heightConfig set", () => {
      it.each([
        [
          new streamlit.HeightConfig({ useStretch: true }),
          getDefaultStyles({ height: "100%" }),
        ],
        [
          new streamlit.HeightConfig({ useContent: true }),
          getDefaultStyles({}),
        ],
        [
          new streamlit.HeightConfig({ pixelHeight: 100 }),
          getDefaultStyles({
            height: "100px",
            overflow: "auto",
            flex: "0 0 100px",
          }),
        ],
      ])(
        "and with a heightConfig value of %o, returns %o",
        (heightConfig, expected) => {
          const element = new MockElement({ heightConfig })
          const { result } = renderHook(() => useLayoutStyles({ element }), {
            wrapper: withFlexContextProvider(Direction.VERTICAL),
          })
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("that has heightConfig set to invalid pixelHeight values", () => {
      it.each([
        [0, getDefaultStyles({})],
        [-100, getDefaultStyles({})],
        [NaN, getDefaultStyles({})],
      ])(
        "and with a pixelHeight value of %s, returns %o",
        (pixelHeight, expected) => {
          const element = new MockElement({
            heightConfig: new streamlit.HeightConfig({ pixelHeight }),
          })
          const { result } = renderHook(() => useLayoutStyles({ element }))
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("with height defined on subElement but element.heightConfig is null or undefined", () => {
      it.each([
        [
          100,
          null,
          getDefaultStyles({
            height: "100px",
            overflow: "auto",
            flex: "0 0 100px",
          }),
        ],
        [
          200,
          null,
          getDefaultStyles({
            height: "200px",
            overflow: "auto",
            flex: "0 0 200px",
          }),
        ],
        [0, null, getDefaultStyles({})],
        [-100, null, getDefaultStyles({})],
        [NaN, null, getDefaultStyles({})],
        [
          100,
          undefined,
          getDefaultStyles({
            height: "100px",
            overflow: "auto",
            flex: "0 0 100px",
          }),
        ],
        [
          200,
          undefined,
          getDefaultStyles({
            height: "200px",
            overflow: "auto",
            flex: "0 0 200px",
          }),
        ],
        [0, undefined, getDefaultStyles({})],
        [-100, undefined, getDefaultStyles({})],
        [NaN, undefined, getDefaultStyles({})],
      ])(
        "and with a height value of %s and heightConfig %s, returns %o",
        (height, heightConfig, expected) => {
          const element = new MockElement({ heightConfig })
          const subElement = { height }
          const { result } = renderHook(
            () => useLayoutStyles({ element, subElement }),
            {
              wrapper: withFlexContextProvider(Direction.VERTICAL),
            }
          )
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("with height included in subElement", () => {
      it.each([
        [undefined, getDefaultStyles({})],
        [0, getDefaultStyles({})],
        [-100, getDefaultStyles({})],
        [NaN, getDefaultStyles({})],
        [
          100,
          getDefaultStyles({
            height: "100px",
            overflow: "auto",
            flex: "0 0 100px",
          }),
        ],
      ])("and with a height value of %s, returns %o", (height, expected) => {
        const element = new MockElement()
        const subElement = { height }
        const { result } = renderHook(
          () => useLayoutStyles({ element, subElement }),
          {
            wrapper: withFlexContextProvider(Direction.VERTICAL),
          }
        )
        expect(result.current).toEqual(expected)
      })
    })

    describe("with height included along with heightConfig", () => {
      it.each([
        [
          {
            heightConfig: new streamlit.HeightConfig({ useStretch: true }),
            height: 100,
          },
          getDefaultStyles({ height: "100%" }),
        ],
        [
          {
            heightConfig: new streamlit.HeightConfig({ useContent: true }),
            height: 100,
          },
          getDefaultStyles({}),
        ],
        [
          {
            heightConfig: new streamlit.HeightConfig({ pixelHeight: 200 }),
            height: 100,
          },
          getDefaultStyles({
            height: "200px",
            overflow: "auto",
            flex: "0 0 200px",
          }),
        ],
        [
          {
            heightConfig: new streamlit.HeightConfig({ pixelHeight: 0 }),
            height: 100,
          },
          getDefaultStyles({}),
        ],
        [
          {
            heightConfig: new streamlit.HeightConfig({ pixelHeight: -100 }),
            height: 100,
          },
          getDefaultStyles({}),
        ],
        [
          {
            heightConfig: new streamlit.HeightConfig({ pixelHeight: NaN }),
            height: 100,
          },
          getDefaultStyles({}),
        ],
      ])("and with element props %o, returns %o", (props, expected) => {
        const element = new MockElement({ heightConfig: props.heightConfig })
        const subElement = { height: props.height }
        const { result } = renderHook(
          () => useLayoutStyles({ element, subElement }),
          {
            wrapper: withFlexContextProvider(Direction.VERTICAL),
          }
        )
        expect(result.current).toEqual(expected)
      })
    })

    describe("with both width and height configurations", () => {
      it.each([
        [
          {
            widthConfig: new streamlit.WidthConfig({ pixelWidth: 200 }),
            heightConfig: new streamlit.HeightConfig({ pixelHeight: 300 }),
          },
          getDefaultStyles({
            width: "200px",
            height: "300px",
            overflow: "auto",
            flex: "0 0 300px",
          }),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ useStretch: true }),
            heightConfig: new streamlit.HeightConfig({ useStretch: true }),
          },
          getDefaultStyles({ width: "100%", height: "100%" }),
        ],
        [
          {
            widthConfig: new streamlit.WidthConfig({ useContent: true }),
            heightConfig: new streamlit.HeightConfig({ useContent: true }),
          },
          getDefaultStyles({ width: "fit-content", height: "auto" }),
        ],
      ])("and with element props %o, returns %o", (props, expected) => {
        const element = new MockElement(props)
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.VERTICAL),
        })
        expect(result.current).toEqual(expected)
      })
    })

    describe("with both width and height in subElement", () => {
      it.each([
        [
          { width: 200, height: 300 },
          getDefaultStyles({
            width: "200px",
            height: "300px",
            overflow: "auto",
            flex: "0 0 300px",
          }),
        ],
        [
          { width: 0, height: 100 },
          getDefaultStyles({
            width: "auto",
            height: "100px",
            overflow: "auto",
            flex: "0 0 100px",
          }),
        ],
        [
          { width: 100, height: 0 },
          getDefaultStyles({ width: "100px", height: "auto" }),
        ],
      ])(
        "and with subElement props %o, returns %o",
        (subElementProps, expected) => {
          const element = new MockElement()
          const { result } = renderHook(
            () => useLayoutStyles({ element, subElement: subElementProps }),
            {
              wrapper: withFlexContextProvider(Direction.VERTICAL),
            }
          )
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("with widthConfig on the subElement (using type assertions)", () => {
      it.each([
        [
          {
            subElementWidthConfig: new streamlit.WidthConfig({
              useStretch: true,
            }),
          },
          getDefaultStyles({ width: "100%", height: "auto" }),
        ],
        [
          {
            subElementWidthConfig: new streamlit.WidthConfig({
              useContent: true,
            }),
          },
          getDefaultStyles({ width: "fit-content", height: "auto" }),
        ],
        [
          {
            subElementWidthConfig: new streamlit.WidthConfig({
              pixelWidth: 150,
            }),
          },
          getDefaultStyles({ width: "150px", height: "auto" }),
        ],
      ])(
        "and with subElement widthConfig %o, returns %o",
        (props, expected) => {
          const element = new MockElement()

          // Use type assertion to bypass TypeScript checks
          const subElement = {
            widthConfig: props.subElementWidthConfig,
          } as IAlert

          const { result } = renderHook(() =>
            useLayoutStyles({
              element,
              subElement,
            })
          )
          expect(result.current).toEqual(expected)
        }
      )
    })

    describe("flex property behavior with direction context", () => {
      it("should include flex for vertical direction with pixel height", () => {
        const element = new MockElement({
          heightConfig: new streamlit.HeightConfig({ pixelHeight: 250 }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.VERTICAL),
        })
        expect(result.current.flex).toBe("0 0 250px")
      })

      it("should include flex for horizontal direction with pixel width", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ pixelWidth: 120 }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.HORIZONTAL),
        })
        expect(result.current.flex).toBe("0 0 120px")
      })

      it("should not include flex for vertical direction with pixel width", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ pixelWidth: 120 }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.VERTICAL),
        })
        expect(result.current.flex).toBeUndefined()
      })

      it("should not include flex for vertical direction with stretch height", () => {
        const element = new MockElement({
          heightConfig: new streamlit.HeightConfig({ useStretch: true }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.VERTICAL),
        })
        expect(result.current.flex).toBeUndefined()
      })

      it("should not include flex for horizontal direction with pixel height", () => {
        const element = new MockElement({
          heightConfig: new streamlit.HeightConfig({ pixelHeight: 250 }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.HORIZONTAL),
        })
        expect(result.current.flex).toBeUndefined()
      })

      it("should include flex for horizontal direction with stretch width", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ useStretch: true }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.HORIZONTAL),
        })
        expect(result.current.flex).toBe("1 1 fit-content")
      })

      it("should not include flex for vertical direction with content height", () => {
        const element = new MockElement({
          heightConfig: new streamlit.HeightConfig({ useContent: true }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.VERTICAL),
        })
        expect(result.current.flex).toBeUndefined()
      })

      it("should include flex for horizontal direction with content width", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ useContent: true }),
        })
        const { result } = renderHook(() => useLayoutStyles({ element }), {
          wrapper: withFlexContextProvider(Direction.HORIZONTAL),
        })
        expect(result.current.flex).toBe("0 0 fit-content")
      })
    })

    describe("minStretchBehavior behavior", () => {
      it("should use provided minStretchBehavior value", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ useStretch: true }),
        })
        const minStretchBehavior: MinFlexElementWidth = "14rem"
        const { result } = renderHook(
          () => useLayoutStyles({ element, minStretchBehavior }),
          {
            wrapper: withFlexContextProvider(Direction.HORIZONTAL),
          }
        )
        expect(result.current.flex).toBe("1 1 14rem")
      })

      it("should use default fit-content when minStretchBehavior is undefined", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ useStretch: true }),
        })
        const minStretchBehavior: MinFlexElementWidth = undefined
        const { result } = renderHook(
          () => useLayoutStyles({ element, minStretchBehavior }),
          {
            wrapper: withFlexContextProvider(Direction.HORIZONTAL),
          }
        )
        expect(result.current.flex).toBe("1 1 fit-content")
      })

      it("should not affect non-stretch width configurations", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ useContent: true }),
        })
        const minStretchBehavior: MinFlexElementWidth = "14rem"
        const { result } = renderHook(
          () => useLayoutStyles({ element, minStretchBehavior }),
          {
            wrapper: withFlexContextProvider(Direction.HORIZONTAL),
          }
        )
        expect(result.current.flex).toBe("0 0 fit-content")
      })

      it("should not affect vertical direction even with stretch width", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ useStretch: true }),
        })
        const minStretchBehavior: MinFlexElementWidth = "14rem"
        const { result } = renderHook(
          () => useLayoutStyles({ element, minStretchBehavior }),
          {
            wrapper: withFlexContextProvider(Direction.VERTICAL),
          }
        )
        expect(result.current.flex).toBeUndefined()
      })

      it("should not affect pixel width configurations", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ pixelWidth: 200 }),
        })
        const minStretchBehavior: MinFlexElementWidth = "14rem"
        const { result } = renderHook(
          () => useLayoutStyles({ element, minStretchBehavior }),
          {
            wrapper: withFlexContextProvider(Direction.HORIZONTAL),
          }
        )
        expect(result.current.flex).toBe("0 0 200px")
      })
    })

    describe("with styleOverrides", () => {
      it("applies style overrides to computed styles", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ pixelWidth: 200 }),
          heightConfig: new streamlit.HeightConfig({ pixelHeight: 300 }),
        })

        const styleOverrides = {
          width: "50%",
          height: "150px",
          overflow: "hidden",
          flex: "0 0 150px",
        }

        const { result } = renderHook(() =>
          useLayoutStyles({ element, styleOverrides })
        )

        expect(result.current).toEqual({
          width: "50%",
          height: "150px",
          overflow: "hidden",
          flex: "0 0 150px",
        })
      })

      it("partially overrides computed styles", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ pixelWidth: 200 }),
          heightConfig: new streamlit.HeightConfig({ pixelHeight: 300 }),
        })

        const styleOverrides = {
          width: "75%",
        }

        const { result } = renderHook(
          () => useLayoutStyles({ element, styleOverrides }),
          {
            wrapper: withFlexContextProvider(Direction.VERTICAL),
          }
        )

        expect(result.current).toEqual({
          width: "75%",
          height: "300px",
          overflow: "auto",
          flex: "0 0 300px",
        })
      })

      it("handles empty styleOverrides", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ pixelWidth: 100 }),
        })

        const styleOverrides = {}

        const { result } = renderHook(() =>
          useLayoutStyles({ element, styleOverrides })
        )

        expect(result.current).toEqual({
          width: "100px",
          height: "auto",
          overflow: "visible",
        })
      })

      it("handles undefined styleOverrides", () => {
        const element = new MockElement({
          widthConfig: new streamlit.WidthConfig({ pixelWidth: 100 }),
        })

        const { result } = renderHook(() =>
          useLayoutStyles({ element, styleOverrides: undefined })
        )

        expect(result.current).toEqual({
          width: "100px",
          height: "auto",
          overflow: "visible",
        })
      })
    })
  })
})
