"""This package contains all functions which the user can use to
create new elements in a Report."""

import sys

for salutation in ['hello', 'goodbye', 'fancy_']:
    def wrapper(salutation):
        def salute():
            print(salutation, 'world')
        salute.__name__ = salutation
        salute.__doc__ = 'Prints ' + salutation
        return salute
    setattr(sys.modules[__name__], salutation, wrapper(salutation))
