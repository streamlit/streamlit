/**
 * Tests for sprintf.ts - vendored from sprintf.js with thousand separator support.
 * Test cases derived from: https://github.com/alexei/sprintf.js/blob/master/test/test.js
 * and https://github.com/alexei/sprintf.js/blob/master/test/test_validation.js
 */

import { describe, expect, it } from "vitest"

import { sprintf } from "./sprintfjs.js"

describe("sprintf", () => {
  const pi = 3.141592653589793

  describe("simple placeholders", () => {
    it.each([
      // Escaped percent
      ["%%", [], "%"],
      // Binary
      ["%b", [2], "10"],
      ["%b", [5], "101"],
      // Character
      ["%c", [65], "A"],
      // Decimal/Integer
      ["%d", [2], "2"],
      ["%i", [2], "2"],
      ["%d", ["2"], "2"],
      ["%i", ["2"], "2"],
      ["%d", [-42], "-42"],
      // JSON
      ["%j", [{ foo: "bar" }], '{"foo":"bar"}'],
      ["%j", [["foo", "bar"]], '["foo","bar"]'],
      // Exponential
      ["%e", [2], "2e+0"],
      // Unsigned
      ["%u", [2], "2"],
      ["%u", [-2], "4294967294"],
      // Float
      ["%f", [2.2], "2.2"],
      ["%f", [3.14159], "3.14159"],
      // General (shortest representation)
      ["%g", [pi], "3.141592653589793"],
      // Octal
      ["%o", [8], "10"],
      ["%o", [-8], "37777777770"],
      // String
      ["%s", ["%s"], "%s"],
      ["%s", ["hello"], "hello"],
      // Hexadecimal
      ["%x", [255], "ff"],
      ["%x", [-255], "ffffff01"],
      ["%X", [255], "FF"],
      ["%X", [-255], "FFFFFF01"],
      // Boolean
      ["%t", [true], "true"],
      ["%.1t", [true], "t"],
      ["%t", ["true"], "true"],
      ["%t", [1], "true"],
      ["%t", [false], "false"],
      ["%.1t", [false], "f"],
      ["%t", [""], "false"],
      ["%t", [0], "false"],
      // Type
      ["%T", [undefined], "undefined"],
      ["%T", [null], "null"],
      ["%T", [true], "boolean"],
      ["%T", [42], "number"],
      ["%T", ["This is a string"], "string"],
      ["%T", [Math.log], "function"],
      ["%T", [[1, 2, 3]], "array"],
      ["%T", [{ foo: "bar" }], "object"],
      ["%T", [/<('[^']*'|[^'>])*>/], "regexp"],
      // valueOf
      ["%v", [true], "true"],
      ["%v", [42], "42"],
      ["%v", ["This is a string"], "This is a string"],
      ["%v", [[1, 2, 3]], "1,2,3"],
      ["%v", [{ foo: "bar" }], "[object Object]"],
    ])("formats '%s' with %j to '%s'", (format, args, expected) => {
      expect(sprintf(format, ...args)).toBe(expected)
    })
  })

  describe("complex placeholders - sign", () => {
    it.each([
      ["%d", [2], "2"],
      ["%d", [-2], "-2"],
      ["%+d", [2], "+2"],
      ["%+d", [-2], "-2"],
      ["%i", [2], "2"],
      ["%i", [-2], "-2"],
      ["%+i", [2], "+2"],
      ["%+i", [-2], "-2"],
      ["%f", [2.2], "2.2"],
      ["%f", [-2.2], "-2.2"],
      ["%+f", [2.2], "+2.2"],
      ["%+f", [-2.2], "-2.2"],
      ["%+.1f", [-2.34], "-2.3"],
      ["%+.1f", [-0.01], "-0.0"],
      ["%.6g", [pi], "3.14159"],
      ["%.3g", [pi], "3.14"],
      ["%.1g", [pi], "3"],
      ["%+010d", [-123], "-000000123"],
      ["%+'_10d", [-123], "______-123"],
      ["%f %f", [-234.34, 123.2], "-234.34 123.2"],
    ])("formats '%s' with %j to '%s'", (format, args, expected) => {
      expect(sprintf(format, ...args)).toBe(expected)
    })
  })

  describe("complex placeholders - padding", () => {
    it.each([
      ["%05d", [-2], "-0002"],
      ["%05i", [-2], "-0002"],
      ["%5s", ["<"], "    <"],
      ["%05s", ["<"], "0000<"],
      ["%'_5s", ["<"], "____<"],
      ["%-5s", [">"], ">    "],
      ["%0-5s", [">"], ">0000"],
      ["%'_-5s", [">"], ">____"],
      ["%5s", ["xxxxxx"], "xxxxxx"],
      ["%02u", [1234], "1234"],
      ["%8.3f", [-10.23456], " -10.235"],
      ["%f %s", [-12.34, "xxx"], "-12.34 xxx"],
      ["%2j", [{ foo: "bar" }], '{\n  "foo": "bar"\n}'],
      ["%2j", [["foo", "bar"]], '[\n  "foo",\n  "bar"\n]'],
    ])("formats '%s' with %j to '%s'", (format, args, expected) => {
      expect(sprintf(format, ...args)).toBe(expected)
    })
  })

  describe("complex placeholders - precision", () => {
    it.each([
      ["%.1f", [2.345], "2.3"],
      ["%.2f", [3.14159], "3.14"],
      ["%5.5s", ["xxxxxx"], "xxxxx"],
      ["%5.1s", ["xxxxxx"], "    x"],
      ["%.2e", [1234.5], "1.23e+3"],
      ["%.4f", [0.123456], "0.1235"],
      ["%.4g", [0.123456], "0.1235"],
    ])("formats '%s' with %j to '%s'", (format, args, expected) => {
      expect(sprintf(format, ...args)).toBe(expected)
    })
  })

  describe("thousand separator (comma flag)", () => {
    it.each([
      // Basic integer formatting
      ["%,d", [1000], "1,000"],
      ["%,d", [1234567], "1,234,567"],
      ["%,d", [999], "999"],
      ["%,d", [0], "0"],

      // Negative numbers
      ["%,d", [-1000], "-1,000"],
      ["%,d", [-1234567], "-1,234,567"],

      // Float formatting
      ["%,f", [1234567.89], "1,234,567.89"],
      ["%,.2f", [1234567.89], "1,234,567.89"],
      ["%,.0f", [1234567.89], "1,234,568"],
      ["%,.3f", [1234.5678], "1,234.568"],

      // Small numbers (no separators needed)
      ["%,d", [123], "123"],
      ["%,.2f", [0.12], "0.12"],

      // Combined with sign flag
      ["%+,d", [1234567], "+1,234,567"],
      ["%+,d", [-1234567], "-1,234,567"],

      // Combined with width
      ["%,15d", [1234567], "      1,234,567"],
      ["%-,15d", [1234567], "1,234,567      "],
      ["%,10.2f", [1234.56], "  1,234.56"],

      // Combined with zero padding (total width includes separators)
      ["%0,10d", [1234], "000001,234"],

      // Very large numbers
      ["%,d", [1234567890123], "1,234,567,890,123"],

      // Scientific notation (separator applies to mantissa)
      ["%,e", [1234567], "1.234567e+6"],
      ["%,.2e", [1234567], "1.23e+6"],

      // With text around
      ["$%,d", [1234567], "$1,234,567"],
      ["%,d items", [1234567], "1,234,567 items"],
      ["$%,.2f USD", [1234.56], "$1,234.56 USD"],

      // Custom pad character with thousand separator (legacy syntax)
      ["%'_,.2f", [1234567.89], "1_234_567.89"],
      ["%'_,d", [1234567], "1_234_567"],
      ["%'*,d", [1234567], "1*234*567"],
      ["%'.,d", [1234567], "1.234.567"],
      ["%' ,d", [1234567], "1 234 567"],

      // Unsigned integers
      ["%,u", [1234567], "1,234,567"],
      ["%,u", [999], "999"],

      // Separator flag with non-numeric types (flag captured but not applied)
      ["%,s", ["hello"], "hello"],
      ["%,t", [true], "true"],
      ["%,T", [42], "number"],

      // Separator flag with hex/octal/binary (not applied - non-decimal)
      ["%,x", [1234567], "12d687"],
      ["%,X", [1234567], "12D687"],
      ["%,o", [1234567], "4553207"],
      ["%,b", [255], "11111111"],
    ])("formats '%s' with %j to '%s'", (format, args, expected) => {
      expect(sprintf(format, ...args)).toBe(expected)
    })
  })

  describe("thousand separator (underscore flag)", () => {
    it.each([
      // Basic integer formatting (mirrors Python's f"{x:_}")
      ["%_d", [1000], "1_000"],
      ["%_d", [1234567], "1_234_567"],
      ["%_d", [999], "999"],
      ["%_d", [0], "0"],

      // Negative numbers
      ["%_d", [-1000], "-1_000"],
      ["%_d", [-1234567], "-1_234_567"],

      // Float formatting
      ["%_f", [1234567.89], "1_234_567.89"],
      ["%_.2f", [1234567.89], "1_234_567.89"],
      ["%_.0f", [1234567.89], "1_234_568"],
      ["%_.3f", [1234.5678], "1_234.568"],

      // Small numbers (no separators needed)
      ["%_d", [123], "123"],
      ["%_.2f", [0.12], "0.12"],

      // Combined with sign flag
      ["%+_d", [1234567], "+1_234_567"],
      ["%+_d", [-1234567], "-1_234_567"],

      // Combined with width
      ["%_15d", [1234567], "      1_234_567"],
      ["%-_15d", [1234567], "1_234_567      "],
      ["%_10.2f", [1234.56], "  1_234.56"],

      // Combined with zero padding
      ["%0_10d", [1234], "000001_234"],

      // Very large numbers
      ["%_d", [1234567890123], "1_234_567_890_123"],

      // With text around
      ["$%_d", [1234567], "$1_234_567"],
      ["%_d items", [1234567], "1_234_567 items"],
      ["$%_.2f USD", [1234.56], "$1_234.56 USD"],

      // Unsigned integers
      ["%_u", [1234567], "1_234_567"],
      ["%_u", [999], "999"],

      // Separator flag with non-numeric types (flag captured but not applied)
      ["%_s", ["hello"], "hello"],
      ["%_t", [true], "true"],
      ["%_T", [42], "number"],

      // Separator flag with hex/octal/binary (not applied - non-decimal)
      ["%_x", [1234567], "12d687"],
      ["%_X", [1234567], "12D687"],
      ["%_o", [1234567], "4553207"],
      ["%_b", [255], "11111111"],
    ])("formats '%s' with %j to '%s'", (format, args, expected) => {
      expect(sprintf(format, ...args)).toBe(expected)
    })
  })

  describe("positional arguments", () => {
    it("supports positional arguments", () => {
      expect(sprintf("%2$s %1$s", "world", "hello")).toBe("hello world")
    })

    it("supports complex positional arguments", () => {
      expect(sprintf("%2$s %3$s a %1$s", "cracker", "Polly", "wants")).toBe(
        "Polly wants a cracker"
      )
    })
  })

  describe("named arguments", () => {
    it("supports named arguments", () => {
      expect(sprintf("%(name)s is %(age)d", { name: "Alice", age: 30 })).toBe(
        "Alice is 30"
      )
    })

    it("supports Hello world example", () => {
      expect(sprintf("Hello %(who)s!", { who: "world" })).toBe("Hello world!")
    })

    it("handles nested property access", () => {
      expect(sprintf("%(x.y)s", { x: { y: "nested" } })).toBe("nested")
    })

    it("does not throw for expression which evaluates to undefined", () => {
      expect(() => sprintf("%(x.y)s", { x: {} })).not.toThrow()
    })
  })

  describe("callbacks", () => {
    it("supports functions that return values", () => {
      expect(sprintf("%s", () => "foobar")).toBe("foobar")
    })
  })

  describe("edge cases", () => {
    it("handles multiple format specifiers", () => {
      expect(sprintf("%d + %d = %d", 1, 2, 3)).toBe("1 + 2 = 3")
    })

    it("handles escaped percent", () => {
      expect(sprintf("100%% complete")).toBe("100% complete")
    })

    it("throws for invalid format", () => {
      expect(() => sprintf("%z", 42)).toThrow()
    })

    it("throws for mixing named and positional arguments", () => {
      // sprintf.js throws when mixing named (%(name)s) with positional arguments
      expect(() => sprintf("%(name)s %d", { name: "test" }, 42)).toThrow()
    })

    it("throws own Error when expression evaluation would raise TypeError", () => {
      expect(() => sprintf("%(x.y)s", {})).toThrow(/\[sprintf\]/)
    })

    it("does not throw when accessing properties on the prototype", () => {
      class C {
        get x(): number {
          return 2
        }
      }
      const c = new C()
      expect(() => sprintf("%(x)s", c)).not.toThrow()
    })
  })

  describe("validation - SyntaxError for invalid placeholders", () => {
    it.each([
      ["%"],
      ["%A"],
      ["%s%"],
      ["%(s"],
      ["%)s"],
      ["%$s"],
      ["%()s"],
      ["%(12)s"],
    ])("throws SyntaxError for '%s'", format => {
      expect(() => sprintf(format)).toThrow(SyntaxError)
    })
  })

  describe("validation - TypeError for invalid numeric arguments", () => {
    const numericSpecifiers = [
      "b",
      "c",
      "d",
      "i",
      "e",
      "f",
      "g",
      "u",
      "x",
      "X",
    ]

    it.each(numericSpecifiers)(
      "throws TypeError for %%%s with non-numeric value",
      specifier => {
        const format = `%${specifier}`
        expect(() => sprintf(format)).toThrow(TypeError)
        expect(() => sprintf(format, "str")).toThrow(TypeError)
        expect(() => sprintf(format, {})).toThrow(TypeError)
      }
    )

    it.each(numericSpecifiers)(
      "does not throw TypeError for %%%s with implicitly castable values",
      specifier => {
        const format = `%${specifier}`
        expect(() => sprintf(format, true)).not.toThrow()
        expect(() => sprintf(format, [1])).not.toThrow()
        expect(() => sprintf(format, "200")).not.toThrow()
        expect(() => sprintf(format, null)).not.toThrow()
      }
    )
  })

  describe("cache consistency", () => {
    it("should not throw Error for cache edge cases", () => {
      // Redefine object properties to ensure they don't affect the cache
      sprintf("hasOwnProperty")
      sprintf("constructor")
      expect(() => sprintf("%s", "caching...")).not.toThrow()
      expect(() => sprintf("%s", "crash?")).not.toThrow()
    })
  })
})
