import re
with open('index.html') as f:
    content = f.read()
start = content.find('<div class="gallery-grid">')
end = content.find('</div>', start)
gallery = content[start:end]
images = re.findall(r'src="([^"]+)"', gallery)
from collections import Counter
dups = {k:v for k,v in Counter(images).items() if v>1}
for k,v in dups.items():
    print(f'{v}x: {k}')