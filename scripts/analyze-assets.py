import os, re

def walk(d):
    f_list = []
    for r, dirs, files in os.walk(d):
        if 'node_modules' in r or '.expo' in r: continue
        for f in files:
            if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                f_list.append(os.path.join(r, f))
    return f_list

code_files = walk('mobile/src') + walk('mobile/app')
assets = set()

for cf in code_files:
    with open(cf, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    for m in re.findall(r'require\([^)]+assets[^)]+\)', content):
        assets.add((cf, m))

print("Referenced assets in code:")
for cf, a in sorted(assets):
    print(f"  {cf}: {a}")
