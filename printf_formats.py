import streamlit as st

st.title("Number Input Formats")

st.header("Supported and Unsupported Formats")

st.subheader("Supported: d, i, u, f, F, e, E, g, G")
st.subheader("Unsupported: o, x, X, p, a, A, n")

st.subheader("Support breakdown by numeric type")
st.write("Supported for integers: d, i, u")

st.write("Unupported for integers: o, x, X")

st.write("Supported for floats: f, F, e, E, g, G")
st.write("Unsupported for floats: (n/a)")

st.write("Non-int-or-float characters in printf we don't support: p, a, A, n")


# https://docs.microsoft.com/en-us/cpp/c-runtime-library/format-specification-syntax-printf-and-wprintf-functions?view=vs-2019
# Integer types such as short, int, long, long long, and their unsigned variants, are specified by using d, i, o, u, x, and X. Floating-point types such as float, double, and long double, are specified by using a, A, e, E, f, F, g, and G.
#

# These are ALL the formatting options as per printf spec.

#%	Prints a literal % character (this type doesn't accept any flags, width, precision, length fields).
# d, i	int as a signed integer. %d and %i are synonymous for output, but are different when used with scanf() for input (where using %i will interpret a number as hexadecimal if it's preceded by 0x, and octal if it's preceded by 0.)
# u	Print decimal unsigned int.
# f, F	double in normal (fixed-point) notation. f and F only differs in how the strings for an infinite number or NaN are printed (inf, infinity and nan for f; INF, INFINITY and NAN for F).
# e, E	double value in standard form ([-]d.ddd e[+/-]ddd). An E conversion uses the letter E (rather than e) to introduce the exponent. The exponent always contains at least two digits; if the value is zero, the exponent is 00. In Windows, the exponent contains three digits by default, e.g. 1.5e002, but this can be altered by Microsoft-specific _set_output_format function.
# g, G	double in either normal or exponential notation, whichever is more appropriate for its magnitude. g uses lower-case letters, G uses upper-case letters. This type differs slightly from fixed-point notation in that insignificant zeroes to the right of the decimal point are not included. Also, the decimal point is not included on whole numbers.
# x, X	unsigned int as a hexadecimal number. x uses lower-case letters and X uses upper-case.
# o	unsigned int in octal.
# s	null-terminated string.
# c	char (character).
# p	void * (pointer to void) in an implementation-defined format.
# a, A	double in hexadecimal notation, starting with 0x or 0X. a uses lower-case letters, A uses upper-case letters.[4][5] (C++11 iostreams have a hexfloat that works the same).
# n	Print nothing, but writes the number of characters successfully written so far into an integer pointer parameter.
# Java: indicates a platform neutral newline/carriage return.[6]
# Note: This can be utilized in Uncontrolled format string exploits.


# ALSO:
# https://alvinalexander.com/programming/printf-format-cheat-sheet


def display_ni(fmtlist, value=2.456):
    for fmt in fmtlist:
        st.number_input(label=fmt, format=fmt, value=value)


INT_FORMATS = [
    "%d",
    "%i",
    "%u",
]

FLOAT_FORMATS = [
    "%f",
    "%F",
    "%.3f",
    "%e",
    "%E",
    "%g",
    "%G",
]

OTHER_FORMATS = [
    "%x",
    "%X",
    "%o",
    "%O",
]
# ]
# "%F",
# "%E",
# "%G",
# ]
# "%X",
# "%o",
# ]

st.number_input(label="No format supplied (control case)")

display_ni(INT_FORMATS, value=2)

display_ni(FLOAT_FORMATS)

# display_ni(OTHER_FORMATS)      #, value=hex(2))
