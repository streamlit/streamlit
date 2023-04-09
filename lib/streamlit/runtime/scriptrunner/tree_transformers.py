import ast


class IpywidgetsToStreamlitTransformer(ast.NodeTransformer):
    def __init__(self):
        self.transformed_variables = set()
        self.slider_args_translation = {
            "description": "label",
            "min": "min_value",
            "max": "max_value",
            "value": "value",
            "step": "step",
        }

    def visit_Import(self, node):
        return self._process_import(node)

    def visit_ImportFrom(self, node):
        return self._process_import(node)

    def visit_Assign(self, node):
        if isinstance(node.value, ast.Call) and hasattr(node.value.func, "id"):
            if node.value.func.id == "interactive":
                self.transformed_variables.add(node.targets[0].id)
                return self._process_interactive(node)
        if isinstance(node.value, ast.Call) and hasattr(node.value.func, "attr"):
            if node.value.func.attr == "IntSlider":
                self.transformed_variables.add(node.targets[0].id)
                return self._process_slider(node)
        return super().generic_visit(node)

    def visit_Expr(self, node):
        if (
            isinstance(node.value, ast.Call)
            and isinstance(node.value.func, ast.Attribute)
            and isinstance(node.value.func.value, ast.Call)
            and isinstance(node.value.func.value.func, ast.Name)
            and node.value.func.value.func.id == "get_ipython"
        ):
            return None

        if isinstance(node.value, ast.Call):
            if hasattr(node.value.func, "attr") and node.value.func.attr == "display":
                return self._process_display(node)
            if hasattr(node.value.func, "id") and node.value.func.id == "display":
                return self._process_display(node)
        return node

    def visit_Attribute(self, node):
        if (
            isinstance(node.value, ast.Name)
            and node.value.id == "widgets"
            and node.attr == "IntSlider"
        ):
            return ast.Name(id="st", ctx=ast.Load())
        return node

    def _process_slider(self, node):
        st_slider = ast.Attribute(
            value=ast.Name(id="st", ctx=ast.Load()), attr="slider", ctx=ast.Load()
        )
        st_slider_call = ast.Call(func=st_slider, args=[], keywords=[])

        description_found = False

        for kw in node.value.keywords:
            description_found = kw.arg == "description"
            kw.arg = self.slider_args_translation.get(kw.arg)
            if not kw.arg:
                continue
            st_slider_call.keywords.append(kw)

        if not description_found:
            st_slider_call.keywords.append(
                ast.keyword(arg="label", value=ast.Str(s=""))
            )

        new_assign = ast.Assign(targets=node.targets, value=st_slider_call)
        return new_assign

    def _process_display(self, node):
        if isinstance(node.value.args[0], ast.Name):
            var_name = node.value.args[0].id
            if var_name in self.transformed_variables:
                return None

        st_write = ast.Attribute(
            value=ast.Name(id="st", ctx=ast.Load()),
            attr="write",
            ctx=ast.Load(),
        )
        st_write_call = ast.Call(
            func=st_write, args=node.value.args, keywords=node.value.keywords
        )
        return ast.Expr(value=st_write_call)

    def _process_import(self, node):
        if any(alias.name == "ipywidgets" for alias in node.names):
            return ast.Import(names=[ast.alias(name="streamlit", asname="st")])
        return node

    def _process_interactive(self, node):
        function_name = node.value.args[0].id
        new_statements = []

        for kw in node.value.keywords:
            slider_name = kw.arg
            slider = kw.value
            slider_attr = slider.keywords

            label = ast.Str(s=slider_name + ":")
            keywords = []

            for attr in slider_attr:
                if attr.arg in self.slider_args_translation:
                    keywords.append(
                        ast.keyword(
                            arg=self.slider_args_translation[attr.arg], value=attr.value
                        )
                    )

            slider_call = ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id="st", ctx=ast.Load()),
                    attr="slider",
                    ctx=ast.Load(),
                ),
                args=[label],
                keywords=keywords,
            )

            slider_assign = ast.Assign(
                targets=[ast.Name(id=slider_name, ctx=ast.Store())], value=slider_call
            )
            new_statements.append(slider_assign)

        function_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id=function_name, ctx=ast.Load()),
                args=[
                    ast.Name(id=kw.arg, ctx=ast.Load()) for kw in node.value.keywords
                ],
                keywords=[],
            )
        )

        new_statements.append(function_call)
        return new_statements
