# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import typing
from typing import Dict, List, Union

import click
import jinja2

PROMPTS_FIELD = "__prompts__"

TypeTemplateConfigValue = Union[str, List[str]]
TypeTemplateConfig = Dict[str, TypeTemplateConfigValue]


def _render_variable(
    result_config: TypeTemplateConfig, env: jinja2.Environment, template_text: str
):
    """Render a variable in the template using Jinja2.

    Parameters
    ----------
    result_config : TypeTemplateConfig
        The result configuration dictionary.
    env : jinja2.Environment
        The Jinja2 environment.
    template_text : str
        The template text to render.

    Returns
    -------
    str
        The rendered variable.

    """
    template = env.from_string(template_text)
    return template.render(cookiecutter=result_config)


def _prompt_list_value(
    result_config: TypeTemplateConfig,
    env: jinja2.Environment,
    prompt: typing.Optional[str],
    config_key: str,
    raw_value: List[str],
):
    """Prompt the user to select a value from a list.

    Parameters
    ----------
    result_config : TypeTemplateConfig
        The result configuration dictionary.
    env : jinja2.Environment
        The Jinja2 environment.
    prompt : typing.Optional[str]
        The prompt message for the user.
    config_key : str
        The configuration key.
    raw_value : List[str]
        The list of values to choose from.

    Returns
    -------
    str
        The selected value.
    """
    choice_options = {
        str(idx): _render_variable(result_config, env, opt)
        for idx, opt in enumerate(raw_value, start=1)
    }
    prompt_text = (
        (prompt or f"Input {config_key}")
        + "\n"
        + "\n".join(f"{idx}. {opt}" for idx, opt in choice_options.items())
        + "\n"
        + f"Select from 1-{len(choice_options)}"
    )

    user_choice = click.prompt(
        prompt_text,
        type=click.Choice(choice_options.keys()),
        default=next(iter(choice_options.keys())),
        show_choices=False,
    )
    return choice_options[user_choice]


def _prompt_str_value(
    result_config: TypeTemplateConfig,
    env: jinja2.Environment,
    prompt: typing.Optional[str],
    config_key: str,
    raw_value: str,
):
    """Prompt the user to enter a string value.

    Parameters
    ----------
    result_config : TypeTemplateConfig
        The result configuration dictionary.
    env : jinja2.Environment
        The Jinja2 environment.
    prompt : typing.Optional[str]
        The prompt message for the user.
    config_key : str
        The configuration key.
    raw_value : str
        The raw value to render or use as the default.

    Returns
    -------
    str
        The entered value.
    """
    rendered_value = _render_variable(result_config, env, raw_value)
    return click.prompt(prompt or f"Input {config_key}", default=rendered_value)


def prepare_config(template_config: TypeTemplateConfig, interactive: bool):
    """Prepare the configuration based on the template config and user inputs.

    Parameters
    ----------
    template_config : TypeTemplateConfig
        The template configuration dictionary.
    interactive : bool
        Whether to prompt the user for input or use defaults.

    Returns
    -------
    TypeTemplateConfig
        The prepared result configuration.
    """
    env = jinja2.Environment(undefined=jinja2.StrictUndefined)

    result_config: TypeTemplateConfig = {}
    prompts: Dict[str, str] = template_config.get(PROMPTS_FIELD, {})

    for config_key, raw_value in template_config.items():
        # Dont render internal fields
        if config_key.startswith("__"):
            continue

        # For cookiecutter compatibility, allow no prompts to be specified.
        prompt = prompts.get(config_key)
        if isinstance(raw_value, list):
            if not len(raw_value) > 0:
                raise RuntimeError(
                    f"Missing value for template config field: {config_key}"
                )
            if interactive:
                computed_value = _prompt_list_value(
                    result_config, env, prompt, config_key, raw_value
                )
            else:
                computed_value = _render_variable(result_config, env, raw_value[0])
            result_config[config_key] = computed_value
        elif isinstance(raw_value, str):
            if interactive:
                computed_value = _prompt_str_value(
                    result_config, env, prompt, config_key, raw_value
                )
            else:
                computed_value = _render_variable(result_config, env, raw_value)
            result_config[config_key] = computed_value
        else:
            raise RuntimeError(
                f"Unsupported config type. Config key={config_key}, Config type name={type(raw_value).__name__}"
            )

    return result_config
