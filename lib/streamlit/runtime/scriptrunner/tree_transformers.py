import ast


class IpywidgetsToStreamlitTransformer(ast.NodeTransformer):
    def __init__(self):
        self.transformed_variables = set()

    def visit_Import(self, node):
        if any(alias.name == "ipywidgets" for alias in node.names):
            return ast.Import(names=[ast.alias(name="streamlit", asname="st")])
        return node

    def visit_ImportFrom(self, node):
        if node.module == "ipywidgets":
            return ast.Import(names=[ast.alias(name="streamlit", asname="st")])
        return node

    def visit_Assign(self, node):
        if isinstance(node.value, ast.Call) and hasattr(node.value.func, "id"):
            if node.value.func.id == "interactive":
                self.transformed_variables.add(node.targets[0].id)
                return self.process_interactive(node)
        if isinstance(node.value, ast.Call) and hasattr(node.value.func, "attr"):
            if node.value.func.attr == "IntSlider":
                self.transformed_variables.add(node.targets[0].id)
                return self.process_IntSlider(node)
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
            if hasattr(node.value.func, "id") and node.value.func.id == "display":
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
        return node

    def visit_Attribute(self, node):
        if (
            isinstance(node.value, ast.Name)
            and node.value.id == "widgets"
            and node.attr == "IntSlider"
        ):
            return ast.Name(id="st", ctx=ast.Load())
        return node

    def process_IntSlider(self, node):
        st_slider = ast.Attribute(
            value=ast.Name(id="st", ctx=ast.Load()), attr="slider", ctx=ast.Load()
        )
        st_slider_call = ast.Call(func=st_slider, args=[], keywords=[])

        description_found = False
        supported_args = {"value", "min", "max", "step", "description"}

        for kw in node.value.keywords:
            if kw.arg not in supported_args:
                continue

            if kw.arg == "description":
                kw.arg = "label"
                description_found = True
            elif kw.arg == "min":
                kw.arg = "min_value"
            elif kw.arg == "max":
                kw.arg = "max_value"
            elif kw.arg == "step":
                kw.arg = "step"

            st_slider_call.keywords.append(kw)

        if not description_found:
            st_slider_call.keywords.append(
                ast.keyword(arg="label", value=ast.Str(s=""))
            )

        new_assign = ast.Assign(targets=node.targets, value=st_slider_call)
        return new_assign

    def process_interactive(self, node):
        function_name = node.value.args[0].id
        new_statements = []

        for kw in node.value.keywords:
            slider_name = kw.arg
            slider = kw.value
            slider_attr = slider.keywords

            label = ast.Str(s=slider_name + ":")
            min_value = None
            max_value = None
            step = None
            value = None

            for attr in slider_attr:
                if attr.arg == "min":
                    min_value = attr.value
                elif attr.arg == "max":
                    max_value = attr.value
                elif attr.arg == "step":
                    step = attr.value
                elif attr.arg == "value":
                    value = attr.value

            slider_call = ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id="st", ctx=ast.Load()),
                    attr="slider",
                    ctx=ast.Load(),
                ),
                args=[label],
                keywords=[
                    ast.keyword(arg="min_value", value=min_value),
                    ast.keyword(arg="max_value", value=max_value),
                    ast.keyword(arg="step", value=step),
                    ast.keyword(arg="value", value=value),
                ],
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
