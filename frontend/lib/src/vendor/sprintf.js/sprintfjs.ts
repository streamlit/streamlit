/**
 * sprintf.js - JavaScript sprintf implementation
 *
 * Based on sprintf.js by Alexandru Mărășteanu (https://github.com/alexei/sprintf.js)
 * Original license: BSD-3-Clause
 *
 * Modifications by Streamlit:
 * - Converted to TypeScript
 * - Added thousand separator support via `,` and `_` flags (e.g., "%,d" or "%_d")
 *   This mirrors Python's format mini-language: f"{x:,}" or f"{x:_}"
 */

import { isNullOrUndefined } from "@streamlit/utils"

interface Placeholder {
  placeholder: string
  param_no?: string
  keys?: string[]
  sign?: string
  pad_char?: string
  align?: string
  thousand_sep?: string
  width?: string
  precision?: string
  type: string
}

type ParseTree = Array<string | Placeholder>

const re = {
  not_type: /[^T]/,
  not_primitive: /[^v]/,
  number: /[diefg]/,
  decimal_number: /[diefgu]/, // Types that support thousand separators
  numeric_arg: /[bcdiefguxX]/,
  json: /[j]/,
  text: /^[^\x25]+/,
  modulo: /^\x25{2}/,
  // Added (,|_)? capture group for thousand separator flag after alignment flag
  placeholder:
    /^\x25(?:([1-9]\d*)\$|\(([^)]+)\))?(\+)?(0|'[^$])?(-)?(,|_)?(\d+)?(?:\.(\d+))?([b-gijostTuvxX])/,
  key: /^([a-z_][a-z_\d]*)/i,
  key_access: /^\.([a-z_][a-z_\d]*)/i,
  index_access: /^\[(\d+)\]/,
  sign: /^[+-]/,
}

const sprintfCache: Record<string, ParseTree> = Object.create(null)

/**
 * Adds thousand separators to a numeric string.
 *
 * @param numStr - The numeric string (may include sign and decimal)
 * @param separator - The separator character (default: ",")
 * @returns The string with thousand separators added to the integer part
 */
function addThousandSeparators(numStr: string, separator = ","): string {
  // Handle sign
  let sign = ""
  let rest = numStr

  if (rest.startsWith("-") || rest.startsWith("+")) {
    sign = rest[0]
    rest = rest.slice(1)
  }

  // Split integer and decimal parts
  const dotIndex = rest.indexOf(".")
  let intPart: string
  let decPart: string | undefined

  if (dotIndex !== -1) {
    intPart = rest.slice(0, dotIndex)
    decPart = rest.slice(dotIndex) // includes the dot
  } else {
    intPart = rest
  }

  // Add separators to integer part (every 3 digits from the right)
  // Uses regex: insert separator before every group of 3 digits not at the start
  const intWithSeps = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator)

  return sign + intWithSeps + (decPart ?? "")
}

function sprintfFormat(parseTree: ParseTree, argv: unknown[]): string {
  let cursor = 1
  const treeLength = parseTree.length
  let output = ""

  for (let i = 0; i < treeLength; i++) {
    const node = parseTree[i]

    if (typeof node === "string") {
      output += node
      continue
    }

    const ph = node
    let arg: unknown

    if (ph.keys) {
      // keyword argument
      arg = argv[cursor]
      for (let k = 0; k < ph.keys.length; k++) {
        if (isNullOrUndefined(arg)) {
          throw new Error(
            `[sprintf] Cannot access property "${ph.keys[k]}" of undefined value "${ph.keys[k - 1]}"`
          )
        }
        arg = (arg as Record<string, unknown>)[ph.keys[k]]
      }
    } else if (ph.param_no) {
      // positional argument (explicit)
      arg = argv[parseInt(ph.param_no, 10)]
    } else {
      // positional argument (implicit)
      arg = argv[cursor++]
    }

    if (
      re.not_type.test(ph.type) &&
      re.not_primitive.test(ph.type) &&
      typeof arg === "function"
    ) {
      arg = (arg as () => unknown)()
    }

    if (
      re.numeric_arg.test(ph.type) &&
      typeof arg !== "number" &&
      isNaN(arg as number)
    ) {
      throw new TypeError(
        `[sprintf] expecting number but found ${Object.prototype.toString.call(arg)}`
      )
    }

    let isPositive = true
    if (re.number.test(ph.type)) {
      isPositive = (arg as number) >= 0
    }

    let argStr: string

    switch (ph.type) {
      case "b":
        argStr = parseInt(String(arg), 10).toString(2)
        break
      case "c":
        argStr = String.fromCharCode(parseInt(String(arg), 10))
        break
      case "d":
      case "i":
        argStr = String(parseInt(String(arg), 10))
        break
      case "j":
        argStr = JSON.stringify(arg, null, ph.width ? parseInt(ph.width) : 0)
        break
      case "e":
        argStr = ph.precision
          ? parseFloat(String(arg)).toExponential(parseInt(ph.precision, 10))
          : parseFloat(String(arg)).toExponential()
        break
      case "f":
        argStr = ph.precision
          ? parseFloat(String(arg)).toFixed(parseInt(ph.precision, 10))
          : String(parseFloat(String(arg)))
        break
      case "g":
        argStr = ph.precision
          ? String(
              Number((arg as number).toPrecision(parseInt(ph.precision, 10)))
            )
          : String(parseFloat(String(arg)))
        break
      case "o":
        argStr = (parseInt(String(arg), 10) >>> 0).toString(8)
        break
      case "s":
        argStr = String(arg)
        argStr = ph.precision
          ? argStr.substring(0, parseInt(ph.precision, 10))
          : argStr
        break
      case "t":
        argStr = String(!!arg)
        argStr = ph.precision
          ? argStr.substring(0, parseInt(ph.precision, 10))
          : argStr
        break
      case "T":
        argStr = Object.prototype.toString.call(arg).slice(8, -1).toLowerCase()
        argStr = ph.precision
          ? argStr.substring(0, parseInt(ph.precision, 10))
          : argStr
        break
      case "u":
        argStr = String(parseInt(String(arg), 10) >>> 0)
        break
      case "v":
        argStr = String((arg as { valueOf(): unknown }).valueOf())
        argStr = ph.precision
          ? argStr.substring(0, parseInt(ph.precision, 10))
          : argStr
        break
      case "x":
        argStr = (parseInt(String(arg), 10) >>> 0).toString(16)
        break
      case "X":
        argStr = (parseInt(String(arg), 10) >>> 0).toString(16).toUpperCase()
        break
      default:
        argStr = String(arg)
    }

    if (re.json.test(ph.type)) {
      output += argStr
    } else {
      let sign = ""
      if (re.number.test(ph.type) && (!isPositive || ph.sign)) {
        sign = isPositive ? "+" : "-"
        argStr = argStr.replace(re.sign, "")
      }

      // Apply thousand separators if `,` or `_` flag is set and it's a decimal numeric type
      // - `_` flag: use underscore as separator (e.g., %_d → 1_234_567)
      // - `,` flag with custom pad char: use pad char as separator (e.g., %'*,d → 1*234*567)
      // - `,` flag alone: use comma as separator (e.g., %,d → 1,234,567)
      if (ph.thousand_sep && re.decimal_number.test(ph.type)) {
        let separator: string
        if (ph.thousand_sep === "_") {
          separator = "_"
        } else if (ph.pad_char?.startsWith("'")) {
          separator = ph.pad_char.charAt(1)
        } else {
          separator = ","
        }
        argStr = addThousandSeparators(argStr, separator)
      }

      const padCharacter = ph.pad_char
        ? ph.pad_char === "0"
          ? "0"
          : ph.pad_char.charAt(1)
        : " "
      const width = ph.width ? parseInt(ph.width, 10) : 0
      const padLength = width - (sign + argStr).length
      const pad = width && padLength > 0 ? padCharacter.repeat(padLength) : ""

      output += ph.align
        ? sign + argStr + pad
        : padCharacter === "0"
          ? sign + pad + argStr
          : pad + sign + argStr
    }
  }

  return output
}

function sprintfParse(fmt: string): ParseTree {
  if (sprintfCache[fmt]) {
    return sprintfCache[fmt]
  }

  let _fmt = fmt
  let match: RegExpExecArray | null
  const parseTree: ParseTree = []
  let argNames = 0

  while (_fmt) {
    if ((match = re.text.exec(_fmt)) !== null) {
      parseTree.push(match[0])
    } else if ((match = re.modulo.exec(_fmt)) !== null) {
      parseTree.push("%")
    } else if ((match = re.placeholder.exec(_fmt)) !== null) {
      if (match[2]) {
        argNames |= 1
        const fieldList: string[] = []
        let replacementField = match[2]
        let fieldMatch: RegExpExecArray | null

        if ((fieldMatch = re.key.exec(replacementField)) !== null) {
          fieldList.push(fieldMatch[1])
          while (
            (replacementField = replacementField.substring(
              fieldMatch[0].length
            )) !== ""
          ) {
            if ((fieldMatch = re.key_access.exec(replacementField)) !== null) {
              fieldList.push(fieldMatch[1])
            } else if (
              (fieldMatch = re.index_access.exec(replacementField)) !== null
            ) {
              fieldList.push(fieldMatch[1])
            } else {
              throw new SyntaxError(
                "[sprintf] failed to parse named argument key"
              )
            }
          }
        } else {
          throw new SyntaxError("[sprintf] failed to parse named argument key")
        }
        match[2] = fieldList.join(".")
      } else {
        argNames |= 2
      }

      if (argNames === 3) {
        throw new Error(
          "[sprintf] mixing positional and named placeholders is not (yet) supported"
        )
      }

      parseTree.push({
        placeholder: match[0],
        param_no: match[1],
        keys: match[2] ? match[2].split(".") : undefined,
        sign: match[3],
        pad_char: match[4],
        align: match[5],
        thousand_sep: match[6], // NEW: thousand separator flag
        width: match[7],
        precision: match[8],
        type: match[9],
      })
    } else {
      throw new SyntaxError("[sprintf] unexpected placeholder")
    }

    _fmt = _fmt.substring(match[0].length)
  }

  sprintfCache[fmt] = parseTree
  return parseTree
}

/**
 * Format a string using printf-style format specifiers.
 *
 * Supports standard printf specifiers plus:
 * - `,` flag for comma thousand separators (e.g., "%,d" → "1,234,567")
 * - `_` flag for underscore thousand separators (e.g., "%_d" → "1_234_567")
 *
 * @example
 * sprintf("%d", 1234567)      // "1234567"
 * sprintf("%,d", 1234567)     // "1,234,567"
 * sprintf("%_d", 1234567)     // "1_234_567"
 * sprintf("%,.2f", 1234.5)    // "1,234.50"
 * sprintf("%_.2f", 1234.5)    // "1_234.50"
 *
 * @param fmt - The format string
 * @param args - Values to substitute into the format string
 * @returns The formatted string
 */
export function sprintf(fmt: string, ...args: unknown[]): string {
  return sprintfFormat(sprintfParse(fmt), [fmt, ...args])
}
