"""홈·운영가이드 공통 확정 대진 데이터로 단톡방 PNG를 출력합니다."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
source = (ROOT/'public/cup-ops/knockout-fixtures.js').read_text()
data = json.loads(source.split('export const knockoutSchedule = ', 1)[1].rstrip().removesuffix(';'))
W,H=1080,1740
im=Image.new('RGB',(W,H),'#0D1B2A'); d=ImageDraw.Draw(im)
fonts=Path('/Users/seok/Library/Fonts')
def text(x,y,value,size=30,color='#FFFFFF',bold=False):
    font=ImageFont.truetype(str(fonts/('Paperlogy-7Bold.ttf' if bold else 'Paperlogy-5Medium.ttf')),size)
    assert d.textbbox((0,0),value,font=font)[2] <= W-x-48, value
    d.text((x,y),value,font=font,fill=color)
text(56,48,'FAIRGROUND CUP 1ST',30,'#8ED9D1',True)
text(56,100,'순위결정전 대진표',62,bold=True)
text(56,185,'2026.10.03  ·  A구장 단일 코트',30)
text(56,235,'출전팀은 시작 5분 전까지 A구장 앞 집합',28,'#8ED9D1')
y=300
for f in data['fixtures']:
    d.rounded_rectangle((48,y,1032,y+133),radius=16,fill='#19314A')
    accent='#8ED9D1' if f['slot']<15 else '#FFE500'
    text(72,y+17,f"{f['slot']}경기 · {f['stage']}",25,accent,True)
    text(745,y+17,f['time'],24)
    if 'homeRank' in f:
        text(72,y+51,f["homeRank"]+' · '+f['home'],29,bold=True)
        text(72,y+85,'vs  '+f["awayRank"]+' · '+f['away'],29,bold=True)
    else:
        text(72,y+57,f['home']+'  vs  '+f['away'],34,bold=True)
    text(760,y+109,f"{f['reportTime']} 집합",17,'#B9C9DA')
    y+=151
text(56,1530,'조별 최종 순위',26,'#8ED9D1',True)
text(56,1574,'A조  ①관심점  ②수박  ③LEGACY  ④ROOT B',25)
text(56,1617,'B조  ①사랑점  ②BOB FS  ③흰둥이  ④ROOT A',25)
text(56,1670,'시각은 예정이며 실제 진행은 현장 안내를 따릅니다.',23,'#B9C9DA')
out=ROOT/'public/cup-ops/assets/knockout-schedule-20261003.png';im.save(out,optimize=True)
print(out)
