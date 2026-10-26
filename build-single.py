"""Build a fully self-contained HTML launcher. Python is for development only."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parent
version = (root / 'VERSION').read_text(encoding='utf-8').strip()
assert re.fullmatch(r'v\d+\.\d+\.\d+', version), f'VERSION 格式应为 v主.次.修订，实际为 {version!r}'
pages = {}
for name in ('spider', 'tetris'):
    source = (root / 'gamebox' / (name + '.html')).read_text(encoding='utf-8')
    # The embedded pages must never navigate to another file.
    source, count = re.subn(r'href="index.html"', 'href="#" onclick="parent.postMessage(\'gamebox-home\', \'*\'); return false;"', source)
    assert count == 1, (name, count)
    pages[name] = source

home = (root / 'gamebox' / 'index.html').read_text(encoding='utf-8')
# 版本只在 VERSION；页脚是唯一需要写版本的地方，构建时注入。
home, footer = re.subn(r'<footer>游戏盒子</footer>',
                       f'<footer>游戏盒子 {version}</footer>', home)
assert footer == 1, f'首页页脚应恰好一处，实际 {footer}'
for name in pages:
    home = home.replace(f'href="{name}.html"', f'href="#" data-game="{name}"')
home = home.replace('<style>', '<style>body.playing{overflow:hidden}body.playing main{display:none}#game-frame{position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff}#game-frame[hidden]{display:none}')
home = home.replace('<footer>', '<details class="note"><summary>怎么打开和游玩</summary><p>把本文件放在桌面上，双击，用 Microsoft Edge 打开即可。<br>蜘蛛纸牌：鼠标拖牌；有空列不能发牌。关闭后不保存进度。<br>俄罗斯方块：方向键移动和旋转，空格落到底，P 暂停。<br>返回首页或关闭页面会结束当前这一局。</p></details><footer>')
data = json.dumps(pages, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
script = '''<iframe id="game-frame" title="小游戏" hidden allow="fullscreen"></iframe>
<script>
const games = __GAMES__;
const frame = document.getElementById('game-frame');
let lastButton = null;
document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  lastButton = button;
  document.body.classList.add('playing');
  frame.hidden = false;
  frame.srcdoc = games[button.dataset.game];
  frame.focus();
}));
window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.data !== 'gamebox-home') return;
  frame.srcdoc = '';
  frame.hidden = true;
  document.body.classList.remove('playing');
  if (lastButton) lastButton.focus();
});
</script>'''.replace('__GAMES__', data)
home = home.replace('</body>', script + '</body>')

output = root / '游戏盒子.html'
output.write_text(home, encoding='utf-8')
print(f'Built {output.name} {version}: {output.stat().st_size} bytes')
