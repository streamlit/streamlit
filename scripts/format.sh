# Go up until you're in the root directory
until [ -d .git ]; do cd ..; done

# Run Prettier on the staged files
yarn --cwd "frontend" pretty-quick --staged

# Run Black on the staged files
git diff --name-only --cached | grep -E "\.pyi?$" | xargs black
