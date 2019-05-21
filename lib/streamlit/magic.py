# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import ast


def add_magic(code):
    """Modifies the code to support magic Streamlit commands.

    Parameters
    ----------
    code : str
        The Python code.

    Returns
    -------
    ast.Module
        The syntax tree for the code.

    """
    tree = ast.parse(code)
    return _modify_ast(tree, True)


def _modify_ast(tree, is_root):
    """Modify AST so you can use Streamlit without Streamlit calls."""

    for i, node in enumerate(tree.body):
        st_write = None

        # Parse the contents of functions
        if type(node) is ast.FunctionDef:
            node = _modify_ast(node, is_root=False)

        # Convert expression nodes to st.write
        if type(node) is ast.Expr:
            node.value = _get_st_write_from_expr(node, i)

    if is_root:
        # Import Streamlit so we can use it in the st_write's above.
        # IMPORTANT: This breaks Python 2 due to line numbering issues.
        _insert_import_statement(tree)

    ast.fix_missing_locations(tree)

    return tree


def _insert_import_statement(tree):
    """Insert Streamlit import statement at the top(ish) of the tree."""

    st_import = _build_st_import_statement()

    # If the 0th node is already an import statement, put the Streamlit
    # import below that, so we don't break "from __future__ import".
    if tree.body and type(tree.body[0]) in (ast.ImportFrom, ast.Import):
        tree.body.insert(1, st_import)

    # If the 0th node is a docstring and the 1st is an import statement,
    # put the Streamlit import below those, so we don't break "from
    # __future__ import".
    elif (len(tree.body) > 1
            and (
                type(tree.body[0]) is ast.Expr and
                type(tree.body[0].value) is ast.Str
            )
            and type(tree.body[1]) in (ast.ImportFrom, ast.Import)):
        tree.body.insert(2, st_import)

    else:
        tree.body.insert(0, st_import)


def _build_st_import_statement():
    """Build AST node for `import streamlit as __streamlit__`."""
    return ast.Import(
        names=[ast.alias(
            name='streamlit',
            asname='__streamlit__',
        )],
    )


def _build_st_write_call(nodes):
    """Build AST node for `__streamlit__._transparent_write(*nodes)`."""
    return ast.Call(
        func=ast.Attribute(
            attr='_transparent_write',
            value=ast.Name(id='__streamlit__', ctx=ast.Load()),
            ctx=ast.Load(),
        ),
        args=nodes,
        keywords=[],
        kwargs=None,
        starargs=None,
    )


def _get_st_write_from_expr(node, i):
    # Don't change function calls
    if type(node.value) is ast.Call:
        return None

    # Don't change Docstring nodes
    if type(node.value) is ast.Str:
        if i == 0:
            return None

    # If 1-element tuple, call st.write on the 0th element (rather than the
    # whole tuple). This allows us to add a comma at the end of a statement
    # to turn it into an expression that should be st-written. Ex:
    # "np.random.randn(1000, 2),"
    if (type(node.value) is ast.Tuple and
            len(node.value.elts) == 1):
        args = node.value.elts
        st_write = _build_st_write_call(args)

    # st.write all strings.
    elif type(node.value) is ast.Str:
        args = [node.value]
        st_write = _build_st_write_call(args)

    # st.write all variables, and also print the variable's name.
    elif type(node.value) is ast.Name:
        args = [
            ast.Str(s='**%s**' % node.value.id),
            node.value
        ]
        st_write = _build_st_write_call(args)

    # st.write everything else
    else:
        args = [node.value]
        st_write = _build_st_write_call(args)

    return st_write
