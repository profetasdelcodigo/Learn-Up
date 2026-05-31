import sys
import re

file_path = sys.argv[1]
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if "git-rebase-todo" in file_path:
    content = re.sub(r'^pick ', 'reword ', content, flags=re.MULTILINE)
else:
    # It's COMMIT_EDITMSG
    content = re.sub(r'^.*Co-Authored-By: Claude.*$\n?', '', content, flags=re.MULTILINE | re.IGNORECASE)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
