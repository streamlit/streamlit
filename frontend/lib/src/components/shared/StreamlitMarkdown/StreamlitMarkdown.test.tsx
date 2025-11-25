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

import React, { ReactElement } from "react"

import { cleanup, screen } from "@testing-library/react"
import { transparentize } from "color2k"
import ReactMarkdown from "react-markdown"

import IsDialogContext from "~lib/components/core/IsDialogContext"
import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render, renderWithContexts } from "~lib/test_util"
import { getMarkdownBgColors } from "~lib/theme/getColors"
import { colors } from "~lib/theme/primitives/colors"

import StreamlitMarkdown, {
  containsEmojiShortcodes,
  containsMathSyntax,
  createAnchorFromText,
  CustomCodeTag,
  CustomCodeTagProps,
  CustomMediaTag,
  CustomPreTag,
  LinkWithTargetBlank,
} from "./StreamlitMarkdown"

// Fixture Generator
const getMarkdownElement = (body: string): ReactElement => {
  const components = {
    a: LinkWithTargetBlank,
  }
  return <ReactMarkdown components={components}>{body}</ReactMarkdown>
}

describe("createAnchorFromText", () => {
  it.each([
    // Basic cases
    ["UPPERCASE", "uppercase"],
    ["some header", "some-header"],
    ["some -24$35-9824  header", "some-24-35-9824-header"],
    ["blah___blah___blah", "blah-blah-blah"],

    // Special characters and symbols
    ["header!@#$%^&*()", "header-and"],
    ["  spaces  everywhere  ", "spaces-everywhere"],
    ["multiple---dashes", "multiple-dashes"],
    ["dots...and,commas", "dots-and-commas"],
    ["emoji 👋 test", "emoji-test"],
    ["mixed_case_UPPER", "mixed-case-upper"],

    // Non-English languages and special characters that we can transliterate and slugify
    ["Présentation", "presentation"],
    ["Привет мир", "privet-mir"],
    ["مرحبا بالعالم", "mrhba-balealm"],
    ["Γεια σας κόσμος", "geia-sas-kosmos"],

    // Languages we are not able to slugify - fallback to hash
    ["안녕하세요", "c40769b7"],
    ["こんにちは世界", "f73d32df"],

    // Empty string
    ["", ""],

    // Edge cases that fallback to hash
    [" ", "aa76e70b"],
    ["###", "3ec1ca7"],
    ["---", "6110bfd"],
    ["___", "647ce586"],
  ])("converts '%s' to '%s'", (input, expected) => {
    expect(createAnchorFromText(input)).toEqual(expected)
  })
})

describe("containsMathSyntax", () => {
  it.each([
    // Valid math syntax - should return true
    { input: "$x + y$", expected: true, description: "simple inline math" },
    {
      input: "$\\frac{1}{2}$",
      expected: true,
      description: "inline math with fraction",
    },
    { input: "$$x + y$$", expected: true, description: "display math" },
    {
      input: "$$\nax^2 + bx + c = 0\n$$",
      expected: true,
      description: "multiline display math",
    },
    {
      input: "text $x$ and $y$ more text",
      expected: true,
      description: "multiple inline math",
    },
    {
      input: "$x^2$",
      expected: true,
      description: "inline math with superscript",
    },
    {
      input: "$\\alpha + \\beta$",
      expected: true,
      description: "inline math with Greek letters",
    },

    // Invalid math syntax - should return false (avoid false positives)
    {
      input: "the price is between $5 and $10",
      expected: false,
      description: "dollar amounts with spaces",
    },
    {
      input: "$ 5 + 10 $",
      expected: false,
      description: "spaces after opening and before closing $",
    },
    {
      input: "$ x + y$",
      expected: false,
      description: "space after opening $",
    },
    {
      input: "$x + y $",
      expected: false,
      description: "space before closing $",
    },
    {
      input: "no math here",
      expected: false,
      description: "no dollar signs",
    },
    { input: "$", expected: false, description: "single dollar sign" },
    {
      input: "just text with $",
      expected: false,
      description: "unclosed dollar sign",
    },
  ])(
    "detects $description correctly",
    ({ input, expected }: { input: string; expected: boolean }) => {
      expect(containsMathSyntax(input)).toBe(expected)
    }
  )
})

describe("containsEmojiShortcodes", () => {
  it.each([
    // Valid emoji shortcodes - should return true
    { input: ":smile:", expected: true, description: "basic emoji shortcode" },
    { input: ":+1:", expected: true, description: "thumbs up emoji" },
    { input: ":-1:", expected: true, description: "thumbs down emoji" },
    {
      input: ":joy:",
      expected: true,
      description: "emoji with word characters",
    },
    {
      input: ":face_with_tears_of_joy:",
      expected: true,
      description: "emoji with underscores",
    },
    {
      input: ":custom-emoji:",
      expected: true,
      description: "emoji with hyphens",
    },
    {
      input: ":emoji_name-123:",
      expected: true,
      description: "emoji with underscores, hyphens, and numbers",
    },
    {
      input: "text :smile: more text",
      expected: true,
      description: "emoji within text",
    },
    {
      input: ":smile: :joy:",
      expected: true,
      description: "multiple emojis",
    },
    // Numbers
    { input: ":100:", expected: true, description: "numbers only" },
    { input: ":1234:", expected: true, description: "multi-digit numbers" },
    {
      input: ":2nd_place_medal:",
      expected: true,
      description: "starts with number (2nd)",
    },
    // Hyphens in various positions
    { input: ":e-mail:", expected: true, description: "hyphen in middle" },
    { input: ":t-rex:", expected: true, description: "hyphen after letter" },
    {
      input: ":non-potable_water:",
      expected: true,
      description: "hyphen and underscore",
    },
    {
      input: ":8ball:",
      expected: true,
      description: "starts with digit followed by letters",
    },
    // Clock emojis
    { input: ":clock1:", expected: true, description: "clock emoji" },
    {
      input: ":clock12:",
      expected: true,
      description: "clock emoji double digit",
    },
    {
      input: ":clock1030:",
      expected: true,
      description: "clock emoji with minutes",
    },
    // Country codes and special formats
    { input: ":cn:", expected: true, description: "short country code" },
    { input: ":uk:", expected: true, description: "country code uk" },
    { input: ":us:", expected: true, description: "country code us" },
    // More complex patterns from the actual emoji list
    {
      input: ":slightly_smiling_face:",
      expected: true,
      description: "long underscore name",
    },
    {
      input: ":woman_health_worker:",
      expected: true,
      description: "multiple underscores",
    },
    {
      input: ":+1: and :-1:",
      expected: true,
      description: "both special chars",
    },

    // Invalid shortcodes - should return false
    {
      input: ":material/search:",
      expected: false,
      description: "material icon (excluded)",
    },
    {
      input: ":streamlit:",
      expected: false,
      description: "streamlit logo (excluded)",
    },
    {
      input: "no emoji here",
      expected: false,
      description: "no colons",
    },
    { input: ":", expected: false, description: "single colon" },
    {
      input: ":unclosed",
      expected: false,
      description: "unclosed shortcode",
    },
    {
      input: "text with : colons",
      expected: false,
      description: "colons without emoji pattern",
    },
  ])(
    "detects $description correctly",
    ({ input, expected }: { input: string; expected: boolean }) => {
      expect(containsEmojiShortcodes(input)).toBe(expected)
    }
  )
})

describe("linkReference", () => {
  it("renders a link with _blank target", () => {
    const body = "Some random URL like [Streamlit](https://streamlit.io/)"
    render(getMarkdownElement(body))
    expect(screen.getByText("Streamlit")).toHaveAttribute(
      "href",
      "https://streamlit.io/"
    )
    expect(screen.getByText("Streamlit")).toHaveAttribute("target", "_blank")
  })

  it("renders a link without title", () => {
    const body =
      "Everybody loves [The Internet Archive](https://archive.org/)."
    render(getMarkdownElement(body))
    const link = screen.getByText("The Internet Archive")
    expect(link).toHaveAttribute("href", "https://archive.org/")
    expect(link).not.toHaveAttribute("title")
  })

  it("renders a link containing a title", () => {
    const body =
      "My favorite search engine is " +
      '[Duck Duck Go](https://duckduckgo.com/ "The best search engine for privacy").'
    render(getMarkdownElement(body))
    const link = screen.getByText("Duck Duck Go")
    expect(link).toHaveAttribute("href", "https://duckduckgo.com/")
    expect(link).toHaveAttribute("title", "The best search engine for privacy")
  })

  it("renders a link containing parentheses", () => {
    const body =
      "Here's a link containing parentheses [Yikes](http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx)"
    render(getMarkdownElement(body))
    const link = screen.getByText("Yikes")
    expect(link instanceof HTMLAnchorElement).toBe(true)
    expect(link).toHaveAttribute(
      "href",
      "http://msdn.microsoft.com/en-us/library/aa752574(VS.85).aspx"
    )
  })

  it("does not render a link if only [text] and no (href)", () => {
    const body = "Don't convert to a link if only [text] and missing (href)"
    render(getMarkdownElement(body))
    const element = screen.getByText("text", { exact: false })
    expect(element).toHaveTextContent(
      "Don't convert to a link if only [text] and missing (href)"
    )
    expect(element instanceof HTMLAnchorElement).toBe(false)
  })
})

describe("StreamlitMarkdown", () => {
  let bgColors: ReturnType<typeof getMarkdownBgColors>
  let backgroundColorMapping: Map<string, string>

  beforeAll(() => {
    // Use the actual implementation to get background colors
    bgColors = getMarkdownBgColors(mockTheme.emotion)

    backgroundColorMapping = new Map([
      ["red", bgColors.redbg],
      ["orange", bgColors.orangebg],
      ["yellow", bgColors.yellowbg],
      ["blue", bgColors.bluebg],
      ["green", bgColors.greenbg],
      ["violet", bgColors.violetbg],
      ["gray", bgColors.graybg],
      ["grey", bgColors.graybg],
    ])
  })

  it("renders header anchors when isInSidebar is false", () => {
    const source = "# header"
    render(
      <IsSidebarContext.Provider value={false}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsSidebarContext.Provider>
    )
    expect(
      screen.getByTestId("stHeadingWithActionElements")
    ).toBeInTheDocument()
  })

  it("renders header anchors when isInDialog is false", () => {
    const source = "# header"
    render(
      <IsDialogContext.Provider value={false}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsDialogContext.Provider>
    )
    expect(
      screen.getByTestId("stHeadingWithActionElements")
    ).toBeInTheDocument()
  })

  it("passes props properly", async () => {
    const source =
      "<a class='nav_item' href='//0.0.0.0:8501/?p=some_page' target='_self'>Some Page</a>"
    render(<StreamlitMarkdown source={source} allowHTML={true} />)
    const link = await screen.findByText("Some Page")
    expect(link).toHaveAttribute("href", "//0.0.0.0:8501/?p=some_page")
    expect(link).toHaveAttribute("target", "_self")
  })

  it("doesn't render header anchors when isInSidebar is true", () => {
    const source = "# header"
    render(
      <IsSidebarContext.Provider value={true}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsSidebarContext.Provider>
    )
    expect(
      screen.queryByTestId("stHeadingWithActionElements")
    ).not.toBeInTheDocument()
  })

  it("doesn't render header anchors when isInDialog is true", () => {
    const source = "# header"
    render(
      <IsDialogContext.Provider value={true}>
        <StreamlitMarkdown source={source} allowHTML={false} />
      </IsDialogContext.Provider>
    )
    expect(
      screen.queryByTestId("stHeadingWithActionElements")
    ).not.toBeInTheDocument()
  })

  it("propagates header attributes to custom header", async () => {
    const source = '<h1 data-test="lol">alsdkjhflaf</h1>'
    render(<StreamlitMarkdown source={source} allowHTML />)
    const h1 = await screen.findByRole("heading")
    expect(h1).toHaveAttribute("data-test", "lol")
  })

  it("displays captions correctly", () => {
    const source = "hello this is a caption"
    render(<StreamlitMarkdown allowHTML={false} source={source} isCaption />)
    const caption = screen.getByTestId("stCaptionContainer")
    expect(caption).toHaveTextContent("hello this is a caption")
  })

  // Valid Markdown - italics, bold, strikethrough, code, links, emojis, shortcodes
  const validCases = [
    { input: "*Italicized Text*", tag: "em", expected: "Italicized Text" },
    { input: "**Bold Text**", tag: "strong", expected: "Bold Text" },
    {
      input: "~Strikethough Text~",
      tag: "del",
      expected: "Strikethough Text",
    },
    { input: "`Code Block`", tag: "code", expected: "Code Block" },
    { input: "[Link Text](www.example.com)", tag: "a", expected: "Link Text" },
    { input: "🐶", tag: "p", expected: "🐶" },
    { input: ":joy:", tag: "p", expected: "😂" },
    { input: ":material/search:", tag: "span", expected: "search" },
  ]

  test.each(validCases)(
    "renders valid markdown when isLabel is true - $tag",
    async ({ input, tag, expected }) => {
      render(<StreamlitMarkdown source={input} allowHTML={false} isLabel />)
      // Use findByText for emoji shortcodes since remark-emoji is lazy-loaded
      const markdownText =
        input === ":joy:"
          ? await screen.findByText(expected)
          : screen.getByText(expected)
      expect(markdownText).toBeInTheDocument()

      const expectedTag = markdownText.nodeName.toLowerCase()
      expect(expectedTag).toEqual(tag)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    }
  )

  it("renders streamlit logo in markdown when isLabel is true", () => {
    render(
      <StreamlitMarkdown source={":streamlit:"} allowHTML={false} isLabel />
    )
    const image = screen.getByRole("img")
    expect(image).toHaveAttribute("alt", "Streamlit logo")
  })

  it("renders streamlit logo with allowHTML=true", async () => {
    render(<StreamlitMarkdown source={":streamlit:"} allowHTML={true} />)
    const image = await screen.findByRole("img")
    expect(image).toHaveAttribute("alt", "Streamlit logo")
    expect(image).toHaveStyle("display: inline-block")
    expect(image).toHaveStyle("user-select: none")
  })

  it("renders material icons with allowHTML=true", async () => {
    const source = `:material/search: Icon`
    render(<StreamlitMarkdown source={source} allowHTML={true} />)
    const markdown = await screen.findByText("search")
    const tagName = markdown.nodeName.toLowerCase()
    expect(tagName).toBe("span")
    expect(markdown).toHaveStyle("font-family: Material Symbols Rounded")
  })

  // Typographical symbol replacements
  const symbolReplacementCases = [
    { input: "a -> b", tag: "p", expected: "a → b" },
    { input: "a <- b", tag: "p", expected: "a ← b" },
    { input: "a <-> b", tag: "p", expected: "a ↔ b" },
    { input: "a -- b", tag: "p", expected: "a — b" },
    { input: "a >= b", tag: "p", expected: "a ≥ b" },
    { input: "a <= b", tag: "p", expected: "a ≤ b" },
    { input: "a ~= b", tag: "p", expected: "a ≈ b" },
    {
      input: "[Link ->](https://example.com/arrow->)",
      tag: "a",
      expected: "Link ->",
    },
    { input: "`Code ->`", tag: "code", expected: "Code ->" },
  ]

  test.each(symbolReplacementCases)(
    "replaces symbols with nicer typographical symbols - $input",
    ({ input, tag, expected }) => {
      render(<StreamlitMarkdown source={input} allowHTML={false} isLabel />)
      const markdownText = screen.getByText(expected)
      expect(markdownText).toBeInTheDocument()

      const expectedTag = markdownText.nodeName.toLowerCase()
      expect(expectedTag).toEqual(tag)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    }
  )

  // Invalid Markdown - images, table elements, headings, unordered/ordered lists, task lists, horizontal rules, & blockquotes
  const table = `| Syntax | Description |
  | ----------- | ----------- |
  | Header      | Title       |
  | Paragraph   | Text        |`
  const tableText = "Syntax Description Header Title Paragraph Text"
  const horizontalRule = `

  ---

  Horizontal rule
  `

  const invalidCases = [
    { input: table, tag: "table", expected: tableText },
    { input: table, tag: "thead", expected: tableText },
    { input: table, tag: "tbody", expected: tableText },
    { input: table, tag: "tr", expected: tableText },
    { input: table, tag: "th", expected: tableText },
    { input: table, tag: "td", expected: tableText },
    { input: "# Heading 1", tag: "h1", expected: "Heading 1" },
    { input: "## Heading 2", tag: "h2", expected: "Heading 2" },
    { input: "### Heading 3", tag: "h3", expected: "Heading 3" },
    { input: "#### Heading 4", tag: "h4", expected: "Heading 4" },
    { input: "##### Heading 5", tag: "h5", expected: "Heading 5" },
    { input: "###### Heading 6", tag: "h6", expected: "Heading 6" },
    { input: "- List Item 1", tag: "ul", expected: "List Item 1" },
    { input: "- List Item 1", tag: "li", expected: "List Item 1" },
    { input: "1. List Item 1", tag: "ol", expected: "List Item 1" },
    { input: "1. List Item 1", tag: "li", expected: "List Item 1" },
    {
      input: "- [ ] Task List Item 1",
      tag: "input",
      expected: "Task List Item 1",
    },
    { input: horizontalRule, tag: "hr", expected: "Horizontal rule" },
    { input: "> Blockquote", tag: "blockquote", expected: "Blockquote" },
  ]

  test.each(invalidCases)(
    "does NOT render invalid markdown when isLabel is true - $tag",
    ({ input, tag, expected }) => {
      render(<StreamlitMarkdown source={input} allowHTML={false} isLabel />)
      const markdownText = screen.getByText(expected)
      expect(markdownText).toBeInTheDocument()

      const expectedTag = markdownText.nodeName.toLowerCase()
      expect(expectedTag).not.toEqual(tag)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    }
  )

  it("doesn't render links when disableLinks is true", () => {
    // Valid markdown further restricted with buttons to eliminate links
    const source = "[Link text](www.example.com)"
    render(
      <StreamlitMarkdown
        source={source}
        allowHTML={false}
        isLabel
        disableLinks
      />
    )
    const tag = screen.getByText("Link text")
    expect(tag instanceof HTMLAnchorElement).toBe(false)
  })

  it("renders smaller text sizing when isToast is true", () => {
    const source = "Here is some toast text"
    render(<StreamlitMarkdown source={source} allowHTML={false} isToast />)

    const textTag = screen.getByText("Here is some toast text")
    expect(textTag).toBeInTheDocument()

    // Use the smaller font size for the markdown container
    const markdownContainer = screen.getByTestId("stMarkdownContainer")
    expect(markdownContainer).toHaveStyle("font-size: 0.875rem")
  })

  it("renders regular text sizing when largerLabel is true", () => {
    const source = "Here is some checkbox label text"
    render(
      <StreamlitMarkdown
        source={source}
        allowHTML={false}
        isLabel
        largerLabel
      />
    )

    const textTag = screen.getByText("Here is some checkbox label text")
    expect(textTag).toHaveStyle("font-size: inherit")
  })

  it("renders bold label text when boldLabel is true", () => {
    const source = "Here is some checkbox label text"
    render(
      <StreamlitMarkdown
        source={source}
        allowHTML={false}
        isLabel
        boldLabel
        largerLabel
      />
    )

    const textTag = screen.getByText("Here is some checkbox label text")
    expect(textTag).toHaveStyle("font-weight: 600")
  })

  it("colours text properly", () => {
    const grayTextColor = transparentize(colors.gray85, 0.4)

    const colorMapping = new Map([
      ["red", colors.red90],
      ["orange", colors.orange95],
      ["yellow", colors.yellow115],
      ["blue", colors.blue90],
      ["green", colors.green90],
      ["violet", colors.purple90],
      ["gray", grayTextColor],
      ["grey", grayTextColor],
      ["rainbow", "rgba(0, 0, 0, 0)"],
    ])

    colorMapping.forEach(function (style, color) {
      const source = `:${color}[text]`
      render(<StreamlitMarkdown source={source} allowHTML={false} />)
      const markdown = screen.getByText("text")
      const tagName = markdown.nodeName.toLowerCase()
      expect(tagName).toBe("span")
      expect(markdown).toHaveStyle(`color: ${style}`)
      expect(markdown).toHaveClass("stMarkdownColoredText")

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    })
  })

  it("properly adds custom material icon", () => {
    const source = `:material/search: Icon`
    render(<StreamlitMarkdown source={source} allowHTML={false} />)
    const markdown = screen.getByText("search")
    const tagName = markdown.nodeName.toLowerCase()
    expect(tagName).toBe("span")
    expect(markdown).toHaveStyle(`font-family: Material Symbols Rounded`)
    expect(markdown).toHaveStyle(`user-select: none`)
    expect(markdown).toHaveStyle(`vertical-align: bottom`)
    expect(markdown).toHaveAttribute("translate", "no")
  })

  it("does not remove unknown directive", () => {
    const source = `test :foo test:test :`
    render(<StreamlitMarkdown source={source} allowHTML={false} />)
    const markdown = screen.getByText("test :foo test:test :")
    expect(markdown).toBeInTheDocument()
  })

  it("properly adds background colors", () => {
    backgroundColorMapping.forEach(function (style, color) {
      const source = `:${color}-background[text]`
      render(<StreamlitMarkdown source={source} allowHTML={false} />)
      const markdown = screen.getByText("text")
      const tagName = markdown.nodeName.toLowerCase()
      expect(tagName).toBe("span")
      expect(markdown).toHaveStyle(`background-color: ${style}`)

      // Removes rendered StreamlitMarkdown component before next case run
      cleanup()
    })
  })

  it("properly adds rainbow background color", () => {
    const { redbg, orangebg, yellowbg, greenbg, bluebg, violetbg, purplebg } =
      bgColors
    const rainbowGradient = `linear-gradient(to right, ${redbg}, ${orangebg}, ${yellowbg}, ${greenbg}, ${bluebg}, ${violetbg}, ${purplebg})`

    const source = `:rainbow-background[text]`
    render(<StreamlitMarkdown source={source} allowHTML={false} />)
    const markdown = screen.getByText("text")
    const tagName = markdown.nodeName.toLowerCase()
    expect(tagName).toBe("span")
    expect(markdown).toHaveStyle(`background: ${rainbowGradient}`)
  })

  it("renders small text properly", () => {
    const source = `:small[text]`
    render(<StreamlitMarkdown source={source} allowHTML={false} />)
    const markdown = screen.getByText("text")
    const tagName = markdown.nodeName.toLowerCase()
    expect(tagName).toBe("span")
    expect(markdown).toHaveStyle(
      `font-size: ${mockTheme.emotion.fontSizes.sm}`
    )
  })
})

const getCustomCodeTagProps = (
  props: Partial<CustomCodeTagProps> = {}
): CustomCodeTagProps => ({
  children: `import streamlit as st

st.write("Hello")
`,
  ...props,
})

describe("CustomCodeTag Element", () => {
  it("should render without crashing", async () => {
    const props = getCustomCodeTagProps()
    render(<CustomCodeTag {...props} />)

    const stCode = await screen.findByTestId("stCode")
    expect(stCode).toBeInTheDocument()
  })

  it("should render as plaintext", async () => {
    const props = getCustomCodeTagProps({ className: "language-plaintext" })
    render(<CustomCodeTag {...props} />)

    const stCode = await screen.findByTestId("stCode")
    expect(stCode.innerHTML.indexOf(`class="language-plaintext"`)).not.toBe(-1)
  })

  it("should render copy button when code block has content", async () => {
    const props = getCustomCodeTagProps({
      children: "i am not empty",
    })
    render(<CustomCodeTag {...props} />)
    const copyButton = await screen.findByTitle("Copy to clipboard")

    expect(copyButton).not.toBeNull()
  })

  it("should not render copy button when code block is empty", async () => {
    const props = getCustomCodeTagProps({
      children: "",
    })
    render(<CustomCodeTag {...props} />)

    // Wait for the component to load
    await screen.findByTestId("stCode")

    // queryBy returns null vs. error
    const copyButton = screen.queryByRole("button")

    expect(copyButton).toBeNull()
  })

  it("should render inline", () => {
    const props = getCustomCodeTagProps({ inline: true })
    const { baseElement } = render(<CustomCodeTag {...props} />)
    const codeWithoutClass = baseElement.innerHTML.replace(
      /class="(.*)"/,
      'class="foo"'
    )

    expect(codeWithoutClass).toBe(
      '<div><code class="foo">' +
        "import streamlit as st\n\n" +
        'st.write("Hello")\n' +
        "</code></div>"
    )
  })

  it.each([
    [null, ""],
    [undefined, ""],
    ["null", "null"],
    ["undefined", "undefined"],
  ])("renders children '%s' as '%s'", (children, expected) => {
    const props = getCustomCodeTagProps({ children })
    render(<CustomCodeTag {...props} />)
    expect(screen.getByTestId("stCode")).toHaveTextContent(expected)
  })
})

describe("CustomPreTag", () => {
  it("should render without crashing", () => {
    const props = getCustomCodeTagProps()
    render(<CustomPreTag {...props} />)

    const preTag = screen.getByTestId("stMarkdownPre")
    const tagName = preTag.nodeName.toLowerCase()

    expect(preTag).toBeInTheDocument()
    expect(tagName).toBe("div")
    expect(preTag).toHaveTextContent(
      'import streamlit as st st.write("Hello")'
    )
  })
})

describe("CustomMediaTag", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockNode = { tagName: "img" } as any
  const mockProps = {
    src: "test-image.jpg",
    alt: "Test image",
  }

  it.each([
    { resourceCrossOriginMode: "anonymous" },
    { resourceCrossOriginMode: "use-credentials" },
    { resourceCrossOriginMode: undefined },
  ] as const)(
    "should render img element without crossOrigin attribute when window.__streamlit?.BACKEND_BASE_URL is not set",
    ({ resourceCrossOriginMode }) => {
      renderWithContexts(<CustomMediaTag node={mockNode} {...mockProps} />, {
        libConfigContext: {
          resourceCrossOriginMode,
        },
      })

      const imgElement = screen.getByRole("img")

      expect(imgElement).not.toHaveAttribute("crossOrigin")
      expect(imgElement).toHaveAttribute("src", "test-image.jpg")
      expect(imgElement).toHaveAttribute("alt", "Test image")
    }
  )

  describe("with BACKEND_BASE_URL set", () => {
    const originalStreamlit = window.__streamlit

    beforeEach(() => {
      window.__streamlit = {
        BACKEND_BASE_URL: "https://backend.example.com:8080/app",
      }
    })

    afterEach(() => {
      window.__streamlit = originalStreamlit
    })

    it.each([
      {
        tagName: "img",
        expected: "anonymous",
        resourceCrossOriginMode: "anonymous",
        src: "/media/image.jpg",
        extraProps: { alt: "Test image" },
        scenario: "img with relative URL and anonymous mode",
      },
      {
        tagName: "video",
        expected: "use-credentials",
        resourceCrossOriginMode: "use-credentials",
        src: "/media/video.mp4",
        extraProps: { controls: true },
        scenario: "video with relative URL and use-credentials mode",
      },
      {
        tagName: "audio",
        expected: undefined,
        resourceCrossOriginMode: undefined,
        src: "/media/audio.mp3",
        extraProps: { controls: true },
        scenario: "audio with relative URL and undefined mode",
      },
      {
        tagName: "img",
        expected: "anonymous",
        resourceCrossOriginMode: "anonymous",
        src: "https://backend.example.com:8080/media/image.jpg",
        extraProps: { alt: "Test image" },
        scenario:
          "img with same origin as BACKEND_BASE_URL and anonymous mode",
      },
      {
        tagName: "img",
        expected: undefined,
        resourceCrossOriginMode: undefined,
        src: "https://backend.example.com:8080/media/image.jpg",
        extraProps: { alt: "Test image" },
        scenario:
          "img with same origin as BACKEND_BASE_URL and undefined mode",
      },
      {
        tagName: "img",
        expected: undefined,
        resourceCrossOriginMode: "anonymous",
        src: "https://external.example.com/media/image.jpg",
        extraProps: { alt: "Test image" },
        scenario: "img with different hostname than BACKEND_BASE_URL",
      },
      {
        tagName: "video",
        expected: "use-credentials",
        resourceCrossOriginMode: "use-credentials",
        src: "https://backend.example.com:8080/media/video.mp4",
        extraProps: { controls: true },
        scenario:
          "video with same origin as BACKEND_BASE_URL and use-credentials mode",
      },
      {
        tagName: "video",
        expected: undefined,
        resourceCrossOriginMode: "anonymous",
        src: "https://backend.example.com:9000/media/video.mp4",
        extraProps: { controls: true },
        scenario:
          "video with same origin as BACKEND_BASE_URL and different port",
      },
      {
        tagName: "audio",
        expected: undefined,
        resourceCrossOriginMode: "anonymous",
        src: "http://backend.example.com:8080/media/audio.mp3",
        extraProps: { controls: true },
        scenario:
          "audio with same origin as BACKEND_BASE_URL and different protocol",
      },
    ] as const)(
      "should render $tagName element with crossOrigin='$expected' when $scenario",
      ({ tagName, expected, resourceCrossOriginMode, src, extraProps }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = { tagName } as any
        const props = { src, ...extraProps }

        const { container } = renderWithContexts(
          <CustomMediaTag node={node} {...props} />,
          {
            libConfigContext: {
              resourceCrossOriginMode,
            },
          }
        )

        const element =
          tagName === "img"
            ? screen.getByRole("img")
            : container.querySelector(tagName)

        expect(element).toBeTruthy()
        if (expected) {
          expect(element).toHaveAttribute("crossOrigin", expected)
        } else {
          expect(element).not.toHaveAttribute("crossOrigin")
        }
        expect(element).toHaveAttribute("src", src)
      }
    )
  })
})
