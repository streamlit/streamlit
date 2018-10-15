# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())


def unflatten(flat_dict, sep='_'):
    """Converts a flat dict of key-value pairs to a spec tree.

    Example:
        unflatten({
          foo_bar_baz: 123,
          foo_bar_biz: 456,
          x_bonks: 'hi',
        })

        # Returns:
        # {
        #   foo: {
        #     bar: {
        #       baz: 123,
        #       biz: 456,
        #     },
        #   },
        #   x: {
        #     bonks: 'hi'
        #   }
        # }

    Args:
    -----
    flat_dict: Dict
        A flat dict where keys are fully-qualified paths separated by
        underscores.

    Returns:
    --------
    A tree made of dicts inside of dicts.
    """
    out = dict()
    for pathstr, v in flat_dict.items():
        path = pathstr.split(sep)

        prev_dict = None
        curr_dict = out

        for k in path:
            if k not in curr_dict:
                curr_dict[k] = dict()
            prev_dict = curr_dict
            curr_dict = curr_dict[k]

        prev_dict[k] = v

    return out
