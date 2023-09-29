/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"

import { DocString as DocStringProto } from "@streamlit/lib/src/proto"
import DocString, { DocStringProps, Member } from "./DocString"
import { render } from "@streamlit/lib/src/test_util"

const getProps = (
  elementProps: Partial<DocStringProto> = {}
): DocStringProps => ({
  element: DocStringProto.create({
    name: "st.balloons",
    value: "streamlit.balloons()",
    docString: "docstring",
    type: "method",
    ...elementProps,
  }),
  width: 0,
})

describe("DocString Element", () => {
  const props = getProps()

  it("renders without crashing", () => {
    render(<DocString {...props} />)
    expect(screen.getByTestId("stDocstring")).toBeInTheDocument()
  })

  it("should render a doc-string", () => {
    render(<DocString {...props} />)
    expect(screen.getByTestId("stDocstring-Doc")).toHaveTextContent(
      props.element.docString
    )
  })

  it("should render 'no docs' text when empty", () => {
    const props = getProps({
      docString: undefined,
    })
    render(<DocString {...props} />)

    expect(screen.getByTestId("stDocstring-Doc")).toHaveTextContent(
      "No docs available"
    )
  })

  describe("doc-header", () => {
    it("should render a name", () => {
      render(<DocString {...props} />)
      expect(screen.getByTestId("stDocstringName")).toHaveTextContent(
        "st.balloons"
      )
    })

    it("should render value", () => {
      render(<DocString {...props} />)
      expect(screen.getByTestId("stDocstringValue")).toHaveTextContent(
        "streamlit.balloons()"
      )
    })

    it("should render a type", () => {
      render(<DocString {...props} />)
      expect(screen.getByTestId("stDocstringType")).toHaveTextContent("method")
    })

    describe("should render empty when", () => {
      const props = getProps({
        name: undefined,
        value: undefined,
        type: undefined,
      })

      it("there's no name", () => {
        render(<DocString {...props} />)
        expect(screen.queryByTestId("stDocstringName")).not.toBeInTheDocument()
      })

      it("there's no value", () => {
        render(<DocString {...props} />)
        expect(
          screen.queryByTestId("stDocstringValue")
        ).not.toBeInTheDocument()
      })

      it("there's no type", () => {
        render(<DocString {...props} />)
        expect(screen.queryByTestId("stDocstringType")).not.toBeInTheDocument()
      })
    })

    // Testing cases that we expect to happen (won't test every combination)
    it("should render a type and value when there's no name", () => {
      const props = getProps({
        name: undefined,
      })
      render(<DocString {...props} />)

      expect(screen.queryByTestId("stDocstringName")).not.toBeInTheDocument()

      expect(screen.getByTestId("stDocstringType")).toHaveTextContent("method")
      expect(screen.getByTestId("stDocstringValue")).toHaveTextContent(
        "streamlit.balloons()"
      )
    })

    // Testing cases that we expect to happen (won't test every combination)
    it("should render a name and type when there's no value", () => {
      const props = getProps({
        value: undefined,
      })
      render(<DocString {...props} />)

      expect(screen.queryByTestId("stDocstringValue")).not.toBeInTheDocument()

      expect(screen.getByTestId("stDocstringName")).toHaveTextContent(
        "st.balloons"
      )
      expect(screen.getByTestId("stDocstringType")).toHaveTextContent("method")
    })
  })

  describe("members table", () => {
    it("should render no members when there are none", () => {
      render(<DocString {...props} />)
      expect(
        screen.queryByTestId("stDocstringMembersTable")
      ).not.toBeInTheDocument()
    })

    it("should render members", () => {
      const props = getProps({
        members: [
          {
            name: "member1",
            value: "value1",
            type: "type1",
          },
          {
            name: "member2",
            value: "value2",
            type: "type2",
          },
        ],
      })
      render(<DocString {...props} />)

      expect(screen.getByTestId("stDocstringMembersTable")).toBeInTheDocument()
      expect(screen.getAllByTestId("stMember")).toHaveLength(2)
    })
  })
})

describe("Member Element", () => {
  it("should render value-oriented members", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
        value: "value1",
      },
    }

    render(<Member {...props} />)

    expect(screen.getByTestId("stMemberDocValue")).toHaveTextContent("value1")
    expect(screen.getByTestId("stMemberDocName")).toHaveTextContent("member1")
    expect(screen.getByTestId("stMemberDocType")).toHaveTextContent("type1")
  })

  it("should render doc-oriented members", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
        docString: "docstring1",
      },
    }

    render(<Member {...props} />)

    expect(screen.getByTestId("stMemberDocName")).toHaveTextContent("member1")
    expect(screen.getByTestId("stMemberDocType")).toHaveTextContent("type1")
    expect(screen.getByTestId("stMemberDocString")).toHaveTextContent(
      "docstring1"
    )
  })

  it("should prefer value over doc", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
        value: "value1",
        docString: "docstring1",
      },
    }

    render(<Member {...props} />)

    expect(screen.getByTestId("stMemberDocValue")).toHaveTextContent("value1")
    expect(screen.getByTestId("stMemberDocName")).toHaveTextContent("member1")
    expect(screen.getByTestId("stMemberDocType")).toHaveTextContent("type1")
    expect(screen.queryByTestId("stMemberDocString")).not.toBeInTheDocument()
    expect(screen.queryByText("docstring1")).not.toBeInTheDocument()
  })

  it("should tell you when there are no docs", () => {
    const props = {
      member: {
        name: "member1",
        type: "type1",
      },
    }

    render(<Member {...props} />)

    expect(screen.getByTestId("stMemberDocString")).toHaveTextContent(
      "No docs available"
    )
  })

  it("should only show type if present", () => {
    const props = {
      member: {
        name: "member1",
      },
    }

    render(<Member {...props} />)

    expect(screen.queryByTestId("stMemberDocType")).not.toBeInTheDocument()
  })
})
