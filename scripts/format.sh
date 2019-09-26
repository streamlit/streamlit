# Go up until you're in the root directory
until [ -d .git ]; do cd ..; done

# Run Prettier on the staged files
yarn --cwd "frontend" pretty-quick --staged

# If Black is installed, run it on the staged files.  (Black requires
# Python 3.6+, but you can reformat Python 2 code with it).
# "--diff-filter=ACMR" only lists files that are [A]dded, [C]opied, [M]odified,
# or [R]enamed; we don't want to try to format files that have been deleted.
if command -v "black" > /dev/null; then
  git diff --diff-filter=ACMR --name-only --cached | grep -E "\.pyi?$" | xargs black
fi
