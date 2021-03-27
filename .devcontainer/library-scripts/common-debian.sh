#!/usr/bin/env bash
#-------------------------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
#-------------------------------------------------------------------------------------------------------------
#
# Docs: https://github.com/microsoft/vscode-dev-containers/blob/master/script-library/docs/common.md
#
# Syntax: ./common-debian.sh [install zsh flag] [username] [user UID] [user GID] [upgrade packages flag] [install Oh My *! flag]

INSTALL_ZSH=${1:-"true"}
USERNAME=${2:-"automatic"}
USER_UID=${3:-"automatic"}
USER_GID=${4:-"automatic"}
UPGRADE_PACKAGES=${5:-"true"}
INSTALL_OH_MYS=${6:-"true"}

set -e

if [ "$(id -u)" -ne 0 ]; then
    echo -e 'Script must be run as root. Use sudo, su, or add "USER root" to your Dockerfile before running this script.'
    exit 1
fi

# Ensure that login shells get the correct path if the user updated the PATH using ENV.
rm -f /etc/profile.d/00-restore-env.sh
echo "export PATH=${PATH//$(sh -lc 'echo $PATH')/\$PATH}" > /etc/profile.d/00-restore-env.sh
chmod +x /etc/profile.d/00-restore-env.sh

# If in automatic mode, determine if a user already exists, if not use vscode
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    USERNAME=""
    POSSIBLE_USERS=("vscode" "node" "codespace" "$(awk -v val=1000 -F ":" '$3==val{print $1}' /etc/passwd)")
    for CURRENT_USER in ${POSSIBLE_USERS[@]}; do
        if id -u ${CURRENT_USER} > /dev/null 2>&1; then
            USERNAME=${CURRENT_USER}
            break
        fi
    done
    if [ "${USERNAME}" = "" ]; then
        USERNAME=vscode
    fi
elif [ "${USERNAME}" = "none" ]; then
    USERNAME=root
    USER_UID=0
    USER_GID=0
fi

# Load markers to see which steps have already run
MARKER_FILE="/usr/local/etc/vscode-dev-containers/common"
if [ -f "${MARKER_FILE}" ]; then
    echo "Marker file found:"
    cat "${MARKER_FILE}"
    source "${MARKER_FILE}"
fi

# Ensure apt is in non-interactive to avoid prompts
export DEBIAN_FRONTEND=noninteractive

# Function to call apt-get if needed
apt-get-update-if-needed()
{
    if [ ! -d "/var/lib/apt/lists" ] || [ "$(ls /var/lib/apt/lists/ | wc -l)" = "0" ]; then
        echo "Running apt-get update..."
        apt-get update
    else
        echo "Skipping apt-get update."
    fi
}

# Run install apt-utils to avoid debconf warning then verify presence of other common developer tools and dependencies
if [ "${PACKAGES_ALREADY_INSTALLED}" != "true" ]; then
    apt-get-update-if-needed

    PACKAGE_LIST="apt-utils \
        git \
        openssh-client \
        gnupg2 \
        iproute2 \
        procps \
        lsof \
        htop \
        net-tools \
        psmisc \
        curl \
        wget \
        rsync \
        ca-certificates \
        unzip \
        zip \
        nano \
        vim-tiny \
        less \
        jq \
        lsb-release \
        apt-transport-https \
        dialog \
        libc6 \
        libgcc1 \
        libkrb5-3 \
        libgssapi-krb5-2 \
        libicu[0-9][0-9] \
        liblttng-ust0 \
        libstdc++6 \
        zlib1g \
        locales \
        sudo \
        ncdu \
        man-db \
        strace"

    # Install libssl1.1 if available
    if [[ ! -z $(apt-cache --names-only search ^libssl1.1$) ]]; then
        PACKAGE_LIST="${PACKAGE_LIST}       libssl1.1"
    fi
    
    # Install appropriate version of libssl1.0.x if available
    LIBSSL=$(dpkg-query -f '${db:Status-Abbrev}\t${binary:Package}\n' -W 'libssl1\.0\.?' 2>&1 || echo '')
    if [ "$(echo "$LIBSSL" | grep -o 'libssl1\.0\.[0-9]:' | uniq | sort | wc -l)" -eq 0 ]; then
        if [[ ! -z $(apt-cache --names-only search ^libssl1.0.2$) ]]; then
            # Debian 9
            PACKAGE_LIST="${PACKAGE_LIST}       libssl1.0.2"
        elif [[ ! -z $(apt-cache --names-only search ^libssl1.0.0$) ]]; then
            # Ubuntu 18.04, 16.04, earlier
            PACKAGE_LIST="${PACKAGE_LIST}       libssl1.0.0"
        fi
    fi

    echo "Packages to verify are installed: ${PACKAGE_LIST}"
    apt-get -y install --no-install-recommends ${PACKAGE_LIST} 2> >( grep -v 'debconf: delaying package configuration, since apt-utils is not installed' >&2 )
        
    PACKAGES_ALREADY_INSTALLED="true"
fi

# Get to latest versions of all packages
if [ "${UPGRADE_PACKAGES}" = "true" ]; then
    apt-get-update-if-needed
    apt-get -y upgrade --no-install-recommends
    apt-get autoremove -y
fi

# Ensure at least the en_US.UTF-8 UTF-8 locale is available.
# Common need for both applications and things like the agnoster ZSH theme.
if [ "${LOCALE_ALREADY_SET}" != "true" ] && ! grep -o -E '^\s*en_US.UTF-8\s+UTF-8' /etc/locale.gen > /dev/null; then
    echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen 
    locale-gen
    LOCALE_ALREADY_SET="true"
fi

# Create or update a non-root user to match UID/GID.
if id -u ${USERNAME} > /dev/null 2>&1; then
    # User exists, update if needed
    if [ "${USER_GID}" != "automatic" ] && [ "$USER_GID" != "$(id -G $USERNAME)" ]; then 
        groupmod --gid $USER_GID $USERNAME 
        usermod --gid $USER_GID $USERNAME
    fi
    if [ "${USER_UID}" != "automatic" ] && [ "$USER_UID" != "$(id -u $USERNAME)" ]; then 
        usermod --uid $USER_UID $USERNAME
    fi
else
    # Create user
    if [ "${USER_GID}" = "automatic" ]; then
        groupadd $USERNAME
    else
        groupadd --gid $USER_GID $USERNAME
    fi
    if [ "${USER_UID}" = "automatic" ]; then 
        useradd -s /bin/bash --gid $USERNAME -m $USERNAME
    else
        useradd -s /bin/bash --uid $USER_UID --gid $USERNAME -m $USERNAME
    fi
fi

# Add add sudo support for non-root user
if [ "${USERNAME}" != "root" ] && [ "${EXISTING_NON_ROOT_USER}" != "${USERNAME}" ]; then
    echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME
    chmod 0440 /etc/sudoers.d/$USERNAME
    EXISTING_NON_ROOT_USER="${USERNAME}"
fi

# ** Shell customization section **
if [ "${USERNAME}" = "root" ]; then 
    USER_RC_PATH="/root"
else
    USER_RC_PATH="/home/${USERNAME}"
fi

# .bashrc/.zshrc snippet
RC_SNIPPET="$(cat << EOF
export USER=\$(whoami)
if [[ "\${PATH}" != *"\$HOME/.local/bin"* ]]; then export PATH="\${PATH}:\$HOME/.local/bin"; fi
EOF
)"

# code shim, it fallbacks to code-insiders if code is not available
cat << 'EOF' > /usr/local/bin/code
#!/bin/sh

get_in_path_except_current() {
    which -a "$1" | grep -A1 "$0" | grep -v "$0"
}

code="$(get_in_path_except_current code)"

if [ -n "$code" ]; then
    exec "$code" "$@"
elif [ "$(command -v code-insiders)" ]; then
    exec code-insiders "$@"
else
    echo "code or code-insiders is not installed" >&2
    exit 127
fi
EOF
chmod +x /usr/local/bin/code

# Codespaces themes - partly inspired by https://github.com/ohmyzsh/ohmyzsh/blob/master/themes/robbyrussell.zsh-theme
CODESPACES_BASH="$(cat \
<<EOF
#!/usr/bin/env bash
prompt() {
    if [ "\$?" != "0" ]; then
        local arrow_color=\${bold_red}
    else
        local arrow_color=\${reset_color}
    fi
    if [ ! -z "\${GITHUB_USER}" ]; then
        local USERNAME="@\${GITHUB_USER}"
    else
        local USERNAME="\\u"
    fi
    local cwd="\$(pwd | sed "s|^\${HOME}|~|")"
    PS1="\${green}\${USERNAME} \${arrow_color}➜\${reset_color} \${bold_blue}\${cwd}\${reset_color} \$(scm_prompt_info)\${white}$ \${reset_color}"
    
    # Prepend Python virtual env version to prompt
    if [[ -n \$VIRTUAL_ENV ]]; then
        if [ -z "\${VIRTUAL_ENV_DISABLE_PROMPT:-}" ]; then
            PS1="(\`basename \"\$VIRTUAL_ENV\"\`) \${PS1:-}"
        fi
    fi
}

SCM_THEME_PROMPT_PREFIX="\${reset_color}\${cyan}(\${bold_red}"
SCM_THEME_PROMPT_SUFFIX="\${reset_color} "
SCM_THEME_PROMPT_DIRTY=" \${bold_yellow}✗\${reset_color}\${cyan})"
SCM_THEME_PROMPT_CLEAN="\${reset_color}\${cyan})"
SCM_GIT_SHOW_MINIMAL_INFO="true"
safe_append_prompt_command prompt
EOF
)"
CODESPACES_ZSH="$(cat \
<<EOF
prompt() {
    if [ ! -z "\${GITHUB_USER}" ]; then
        local USERNAME="@\${GITHUB_USER}"
    else
        local USERNAME="%n"
    fi
    PROMPT="%{\$fg[green]%}\${USERNAME} %(?:%{\$reset_color%}➜ :%{\$fg_bold[red]%}➜ )"
    PROMPT+='%{\$fg_bold[blue]%}%~%{\$reset_color%} \$(git_prompt_info)%{\$fg[white]%}$ %{\$reset_color%}'
}
ZSH_THEME_GIT_PROMPT_PREFIX="%{\$fg_bold[cyan]%}(%{\$fg_bold[red]%}"
ZSH_THEME_GIT_PROMPT_SUFFIX="%{\$reset_color%} "
ZSH_THEME_GIT_PROMPT_DIRTY=" %{\$fg_bold[yellow]%}✗%{\$fg_bold[cyan]%})"
ZSH_THEME_GIT_PROMPT_CLEAN="%{\$fg_bold[cyan]%})"
prompt
EOF
)"

# Adapted Oh My Zsh! install step to work with both "Oh Mys" rather than relying on an installer script
# See https://github.com/ohmyzsh/ohmyzsh/blob/master/tools/install.sh for offical script.
install-oh-my()
{
    local OH_MY=$1
    local OH_MY_INSTALL_DIR="${USER_RC_PATH}/.oh-my-${OH_MY}"
    local TEMPLATE="${OH_MY_INSTALL_DIR}/templates/$2"
    local OH_MY_GIT_URL=$3
    local USER_RC_FILE="${USER_RC_PATH}/.${OH_MY}rc"

    if [ -d "${OH_MY_INSTALL_DIR}" ] || [ "${INSTALL_OH_MYS}" != "true" ]; then
        return 0
    fi

    umask g-w,o-w
    mkdir -p ${OH_MY_INSTALL_DIR}
    git clone --depth=1 \
        -c core.eol=lf \
        -c core.autocrlf=false \
        -c fsck.zeroPaddedFilemode=ignore \
        -c fetch.fsck.zeroPaddedFilemode=ignore \
        -c receive.fsck.zeroPaddedFilemode=ignore \
        ${OH_MY_GIT_URL} ${OH_MY_INSTALL_DIR} 2>&1
    echo -e "$(cat "${TEMPLATE}")\nDISABLE_AUTO_UPDATE=true\nDISABLE_UPDATE_PROMPT=true" > ${USER_RC_FILE}
    if [ "${OH_MY}" = "bash" ]; then
        sed -i -e 's/OSH_THEME=.*/OSH_THEME="codespaces"/g' ${USER_RC_FILE}
        mkdir -p ${OH_MY_INSTALL_DIR}/custom/themes/codespaces
        echo "${CODESPACES_BASH}" > ${OH_MY_INSTALL_DIR}/custom/themes/codespaces/codespaces.theme.sh
    else
        sed -i -e 's/ZSH_THEME=.*/ZSH_THEME="codespaces"/g' ${USER_RC_FILE}
        mkdir -p ${OH_MY_INSTALL_DIR}/custom/themes
        echo "${CODESPACES_ZSH}" > ${OH_MY_INSTALL_DIR}/custom/themes/codespaces.zsh-theme
    fi
    # Shrink git while still enabling updates
    cd ${OH_MY_INSTALL_DIR} 
    git repack -a -d -f --depth=1 --window=1

    if [ "${USERNAME}" != "root" ]; then
        cp -rf ${USER_RC_FILE} ${OH_MY_INSTALL_DIR} /root
        chown -R ${USERNAME}:${USERNAME} ${USER_RC_PATH}
    fi
}

if [ "${RC_SNIPPET_ALREADY_ADDED}" != "true" ]; then
    echo "${RC_SNIPPET}" >> /etc/bash.bashrc
    RC_SNIPPET_ALREADY_ADDED="true"
fi
install-oh-my bash bashrc.osh-template https://github.com/ohmybash/oh-my-bash

# Optionally install and configure zsh and Oh My Zsh!
if [ "${INSTALL_ZSH}" = "true" ]; then
    if ! type zsh > /dev/null 2>&1; then
        apt-get-update-if-needed
        apt-get install -y zsh
    fi
    if [ "${ZSH_ALREADY_INSTALLED}" != "true" ]; then
        echo "${RC_SNIPPET}" >> /etc/zsh/zshrc
        ZSH_ALREADY_INSTALLED="true"
    fi
    install-oh-my zsh zshrc.zsh-template https://github.com/ohmyzsh/ohmyzsh
fi

# Write marker file
mkdir -p "$(dirname "${MARKER_FILE}")"
echo -e "\
    PACKAGES_ALREADY_INSTALLED=${PACKAGES_ALREADY_INSTALLED}\n\
    LOCALE_ALREADY_SET=${LOCALE_ALREADY_SET}\n\
    EXISTING_NON_ROOT_USER=${EXISTING_NON_ROOT_USER}\n\
    RC_SNIPPET_ALREADY_ADDED=${RC_SNIPPET_ALREADY_ADDED}\n\
    ZSH_ALREADY_INSTALLED=${ZSH_ALREADY_INSTALLED}" > "${MARKER_FILE}"

echo "Done!"
