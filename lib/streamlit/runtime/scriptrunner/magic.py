# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import ast

from typing_extensions import Final

from streamlit import config

# When a Streamlit app is magicified, we insert a `magic_funcs` import near the top of
# its module's AST:
# import streamlit.runtime.scriptrunner.magic_funcs as __streamlitmagic__
MAGIC_MODULE_NAME: Final = "__streamlitmagic__"


def add_magic(code, script_path):
    """Modifies the code to support magic Streamlit commands.

    Parameters
    ----------
    code : str
        The Python code.
    script_path : str
        The path to the script file.

    Returns
    -------
    ast.Module
        The syntax tree for the code.

    """
    # Pass script_path so we get pretty exceptions.
    tree = ast.parse(code, script_path, "exec")

    file_ends_in_semicolon = _does_file_end_in_semicolon(tree, code)

    return _modify_ast_subtree(
        tree, is_root=True, file_ends_in_semicolon=file_ends_in_semicolon
    )


def _modify_ast_subtree(
    tree, body_attr="body", is_root=False, file_ends_in_semicolon=False
):
    """Parses magic commands and modifies the given AST (sub)tree."""

    body = getattr(tree, body_attr)

    for i, node in enumerate(body):
        node_type = type(node)

        # Recursively parses the content of the statements
        # `with`, `for` and `while`, as well as function definitions.
        # Also covers their async counterparts
        if (
            node_type is ast.FunctionDef
            or node_type is ast.With
            or node_type is ast.For
            or node_type is ast.While
            or node_type is ast.AsyncFunctionDef
            or node_type is ast.AsyncWith
            or node_type is ast.AsyncFor
        ):
            _modify_ast_subtree(node)

        # Recursively parses methods in a class.
        elif node_type is ast.ClassDef:
            for inner_node in node.body:
                if type(inner_node) in {ast.FunctionDef, ast.AsyncFunctionDef}:
                    _modify_ast_subtree(inner_node)

        # Recursively parses the contents of try statements,
        # all their handlers (except and else) and the finally body
        elif node_type is ast.Try:
            for j, inner_node in enumerate(node.handlers):
                node.handlers[j] = _modify_ast_subtree(inner_node)
            finally_node = _modify_ast_subtree(node, body_attr="finalbody")
            node.finalbody = finally_node.finalbody
            _modify_ast_subtree(node)

        # Recursively parses if blocks, as well as their else/elif blocks
        # (else/elif are both mapped to orelse)
        # it intentionally does not parse the test expression.
        elif node_type is ast.If:
            _modify_ast_subtree(node)
            _modify_ast_subtree(node, "orelse")

        # Convert standalone expression nodes to st.write
        elif node_type is ast.Expr:
            value = _get_st_write_from_expr(
                node,
                i,
                parent_type=type(tree),
                is_root=is_root,
                is_last_expr=(i == len(body) - 1),
                file_ends_in_semicolon=file_ends_in_semicolon,
            )
            if value is not None:
                node.value = value

    if is_root:
        # Import Streamlit so we can use it in the new_value above.
        _insert_import_statement(tree)

    ast.fix_missing_locations(tree)

    return tree


def _insert_import_statement(tree):
    """Insert Streamlit import statement at the top(ish) of the tree."""

    st_import = _build_st_import_statement()

    # If the 0th node is already an import statement, put the Streamlit
    # import below that, so we don't break "from __future__ import".
    if tree.body and type(tree.body[0]) in {ast.ImportFrom, ast.Import}:
        tree.body.insert(1, st_import)

    # If the 0th node is a docstring and the 1st is an import statement,
    # put the Streamlit import below those, so we don't break "from
    # __future__ import".
    elif (
        len(tree.body) > 1
        and (
            type(tree.body[0]) is ast.Expr
            and _is_string_constant_node(tree.body[0].value)
        )
        and type(tree.body[1]) in {ast.ImportFrom, ast.Import}
    ):
        tree.body.insert(2, st_import)

    else:
        tree.body.insert(0, st_import)


def _build_st_import_statement():
    """Build AST node for `import magic_funcs as __streamlitmagic__`."""
    return ast.Import(
        names=[
            ast.alias(
                name="streamlit.runtime.scriptrunner.magic_funcs",
                asname=MAGIC_MODULE_NAME,
            )
        ]
    )


def _build_st_write_call(nodes):
    """Build AST node for `__streamlitmagic__.transparent_write(*nodes)`."""
    return ast.Call(
        func=ast.Attribute(
            attr="transparent_write",
            value=ast.Name(id=MAGIC_MODULE_NAME, ctx=ast.Load()),
            ctx=ast.Load(),
        ),
        args=nodes,
        keywords=[],
        kwargs=None,
        starargs=None,
    )


def _get_st_write_from_expr(
    node, i, parent_type, is_root, is_last_expr, file_ends_in_semicolon
):
    # Don't wrap function calls
    # (Unless the function call happened at the end of the root node, AND
    # magic.displayLastExprIfNoSemicolon is True. This allows us to support notebook-like
    # behavior, where we display the last function in a cell)
    if type(node.value) is ast.Call and not _is_displayable_last_expr(
        is_root, is_last_expr, file_ends_in_semicolon
    ):
        return None

    # Don't wrap DocString nodes
    # (Unless magic.displayRootDocString, in which case we do wrap the root-level
    # docstring with st.write. This allows us to support notebook-like behavior
    # where you can have a cell with a markdown string)
    if _is_docstring_node(
        node.value, i, parent_type
    ) and not _should_display_docstring_like_node_anyway(is_root):
        return None

    # Don't wrap yield nodes
    if type(node.value) is ast.Yield or type(node.value) is ast.YieldFrom:
        return None

    # Don't wrap await nodes
    if type(node.value) is ast.Await:
        return None

    # If tuple, call st.write(*the_tuple). This allows us to add a comma at the end of a
    # statement to turn it into an expression that should be st-written. Ex:
    # "np.random.randn(1000, 2),"
    if type(node.value) is ast.Tuple:
        args = node.value.elts
        st_write = _build_st_write_call(args)

    # st.write all strings.
    elif type(node.value) is ast.Str:
        args = [node.value]
        st_write = _build_st_write_call(args)

    # st.write all variables.
    elif type(node.value) is ast.Name:
        args = [node.value]
        st_write = _build_st_write_call(args)

    # st.write everything else
    else:
        args = [node.value]
        st_write = _build_st_write_call(args)

    return st_write


def _is_string_constant_node(node):
    return type(node) is ast.Constant and type(node.value) is str


def _is_docstring_node(node, node_index, parent_type):
    return (
        node_index == 0
        and _is_string_constant_node(node)
        and parent_type in {ast.FunctionDef, ast.AsyncFunctionDef, ast.Module}
    )


def _does_file_end_in_semicolon(tree, code):
    file_ends_in_semicolon = False

    # Avoid spending time with this operation if magic.displayLastExprIfNoSemicolon is
    # not set.
    if config.get_option("magic.displayLastExprIfNoSemicolon"):
        last_line_num = getattr(tree.body[-1], "end_lineno", None)

        if last_line_num is not None:
            last_line_str = code.split("\n")[last_line_num - 1]
            file_ends_in_semicolon = last_line_str.strip(" ").endswith(";")

    return file_ends_in_semicolon


def _is_displayable_last_expr(is_root, is_last_expr, file_ends_in_semicolon):
    return (
        # This is a "displayable last expression" if...
        # ...it's actually the last expression...
        is_last_expr
        # ...in the root scope...
        and is_root
        # ...it does not end in a semicolon...
        and not file_ends_in_semicolon
        # ...and this config option is telling us to show it
        and config.get_option("magic.displayLastExprIfNoSemicolon")
    )


def _should_display_docstring_like_node_anyway(is_root):
    return config.get_option("magic.displayRootDocString") and is_root
