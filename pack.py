"""Build and package the release zip: the single-file build plus the usage note.

The zip deliberately contains nothing else - no dev scripts, no browser
dependencies, no folder-version fallback.
"""
from pathlib import Path
import subprocess
import sys
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(root / 'build-single.py')], check=True)
version = (root / 'VERSION').read_text(encoding='utf-8').strip()
output = root / f'游戏盒子-{version}.zip'
files = {
    '游戏盒子/游戏盒子.html': root / '游戏盒子.html',
    '游戏盒子/使用说明.txt': root / 'gamebox' / '使用说明.txt',
}
for path in files.values():
    assert path.is_file(), f'缺少交付文件：{path}'
with ZipFile(output, 'w', ZIP_DEFLATED) as z:
    for arcname, path in files.items():
        z.write(path, arcname)
with ZipFile(output) as z:
    assert z.testzip() is None
    names = z.namelist()
    assert len(names) == len(set(names)) == len(files), names
print(f'{output.name}: {output.stat().st_size} bytes, {len(files)} files, ZIP CRC check passed')
