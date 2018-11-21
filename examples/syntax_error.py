# -*- coding: future_fstrings -*-

import streamlit as st
import sys

# # Uncomment this as a block.
# # This tests that errors before the first st call get caught.
# sys.stderr.write('You should not see this line!\n')
# a = not_a_real_variable  # EXPECTED: full-screen exception.

# # Uncomment this as a block.
# # This tests that errors before the first st call get caught.
# if True  # EXPECTED: full-screen exception.

st.title('Syntax error test')

st.info('Uncomment the comment blocks in the source code one at a time.')

st.write('(Some top text)')

# # Uncomment this as a block.
# a = not_a_real_variable  # EXPECTED: inline exception.

# # Uncomment this as a block.
# if True  # EXPECTED: full-screen exception.

# # Uncomment this as a block.
# sys.stderr.write('Hello!\n')  # You should not see this.
# # The line below is a compile-time error. Bad indentation.
#        this_indentation_is_wrong = True  # EXPECTED: full-screen exception.

# # Uncomment this as a block.
# sys.stderr.write(
#     'EXPECTED: this looks like an exception. '
#     'It will be displayed full-screen, sadly.\n')
# sys.exit(-1)

# # Uncomment this as a block.
# sys.stderr.write(
#     'Now, EXPECTED: this does not look like an exception. '
#     'Nothing should be displayed.\n')
# sys.exit(-1)

st.write('(Some bottom text)')
