import parser, { Parser, Eat, Tokenizer } from "remark-parse"
import { DateTimeHandler } from "lib/DateTime"
import { Datetime } from "autogen/proto"
function dates() {
  //@ts-ignore
  var Parser = this.Parser
  var tokenizers = Parser.prototype.inlineTokenizers
  var methods = Parser.prototype.inlineMethods

  tokenizers.datetime = tokenizeDatetimes as Tokenizer
  // Run it just before `text`.
  methods.splice(methods.indexOf("text"), 0, "datetime")
}

tokenizeDatetimes.notInLink = true
tokenizeDatetimes.locator = locateDate

function locateDate(value: string, fromIndex: number) {
  return value.indexOf("{@", fromIndex)
}

function tokenizeDatetimes(eat: Eat, value: string, silent: boolean) {
  var match = /{@datetime: (.*)}(.*$)/.exec(value)
  if (match) {
    if (silent) {
      return true
    }

    const date = Datetime.fromObject(JSON.parse(match[1]))
    console.log(JSON.parse(match[1]), date)
    // Reconstruct markdown
    const markdownParts = [
      { type: "inlineCode", value: DateTimeHandler.dateToString(date) },
    ]
    if (match.index) {
      markdownParts.unshift({
        type: "text",
        value: value.substring(0, match.index),
      })
    }
    if (match[2]) {
      markdownParts.push({ type: "text", value: match[2] })
    }

    return eat(value)({
      type: "root",
      children: markdownParts,
    })
  }
}

export default dates
