"""Poor-man's SASS with zero dependencies for easy use in CI/CD.

This replaces CSS variables with their values, so your CSS can be read by older browsers.

Usage:
  replace_vars.py input.css output.css
"""

import re
import sys


def replace_css_vars(input_filename, output_filename):

    with open(input_filename, "r") as in_file:
        css = in_file.read()

    var_declaration_re = re.compile("(--[^ ]+): ([^;]+);")

    var_declarations = re.findall(var_declaration_re, css)

    for css_var, value in var_declarations:
        css = css.replace(f"var({css_var})", value)

    with open(output_filename, "w") as out_file:
        out_file.write(css)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: replace_vars input.css output.css")
        sys.exit(-1)

    input_filename = sys.argv[1]
    output_filename = sys.argv[2]

    replace_css_vars(input_filename, output_filename)
