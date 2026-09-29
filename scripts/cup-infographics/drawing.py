"""Shared vector drawing primitives, in top-left 1080 x 2160 coordinates."""
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

WIDTH, HEIGHT = 1080, 2160
MARGIN = 88
CONTENT_WIDTH = WIDTH - 2*MARGIN
PAGE_SCALE = .5
BLUE = '#064AAC'
NAVY = '#122B49'
TEAL = '#087D78'
GRAY = '#52657C'
LINE = '#D7E1EC'
PALE_BLUE = '#EDF4FF'
PALE_TEAL = '#EAF6F2'
WHITE = '#FFFFFF'
BG = '#F8FAFD'


def register_fonts(font_dir):
    for name, filename in [('regular', 'Paperlogy-4Regular.ttf'),
                           ('medium', 'Paperlogy-5Medium.ttf'),
                           ('bold', 'Paperlogy-7Bold.ttf'),
                           ('heavy', 'Paperlogy-9Black.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(Path(font_dir) / filename)))


class Board:
    def __init__(self, canvas, logo):
        self.c = canvas
        self.logo = str(logo)

    def rect(self, x, y, w, h, fill, radius=0, stroke=None):
        c = self.c
        c.setFillColor(HexColor(fill))
        c.setStrokeColor(HexColor(stroke or fill))
        c.setLineWidth(1.5)
        c.roundRect(x, HEIGHT-y-h, w, h, radius,
                    stroke=bool(stroke), fill=1)

    def text(self, content, x, y, size=32, color=NAVY, font='medium',
             align='left', max_width=None):
        content = str(content).replace('–', '-').replace('−', '-')
        width = pdfmetrics.stringWidth(content, font, size)
        if max_width is not None and width > max_width:
            raise ValueError(f'Text overflows {width:.1f}>{max_width}: {content}')
        self.c.setFillColor(HexColor(color))
        self.c.setFont(font, size)
        baseline = HEIGHT-y-size*.86
        if align == 'center':
            self.c.drawCentredString(x, baseline, content)
        elif align == 'right':
            self.c.drawRightString(x, baseline, content)
        else:
            self.c.drawString(x, baseline, content)

    def line(self, x1, y1, x2, y2, color=LINE, width=2, dash=None):
        self.c.setStrokeColor(HexColor(color))
        self.c.setLineWidth(width)
        self.c.setDash(dash or [])
        self.c.line(x1, HEIGHT-y1, x2, HEIGHT-y2)
        self.c.setDash([])

    def arrow(self, x1, y1, x2, y2, color=BLUE, width=3):
        import math
        self.line(x1, y1, x2, y2, color, width)
        a = math.atan2(y2-y1, x2-x1)
        for offset in [-.52, .52]:
            self.line(x2, y2, x2-12*math.cos(a+offset),
                      y2-12*math.sin(a+offset), color, width)

    def pill(self, label, x, y, w, h=40, fill=BLUE, color=WHITE, size=24):
        self.rect(x, y, w, h, fill, h/2)
        self.text(label, x+w/2, y+(h-size)/2-1, size, color, 'bold',
                  'center', w-12)

    def header(self, index, title, subtitle):
        self.c.saveState()
        self.c.scale(PAGE_SCALE, PAGE_SCALE)
        self.rect(0, 0, WIDTH, HEIGHT, BG)
        self.c.drawImage(self.logo, MARGIN, HEIGHT-116, width=286, height=44,
                         preserveAspectRatio=True, anchor='sw', mask='auto')
        self.text('2026 · CUP 1ST', WIDTH-MARGIN, 78, 25, GRAY, 'bold', 'right')
        self.text(title, MARGIN, 171, 67, NAVY, 'heavy', max_width=CONTENT_WIDTH)
        self.text(subtitle, MARGIN, 268, 29, GRAY, max_width=CONTENT_WIDTH)
        self.line(MARGIN, 329, WIDTH-MARGIN, 329)
        self.text(f'{index:02d} / 03', WIDTH-MARGIN, HEIGHT-64, 25, GRAY, 'bold', 'right')
        self.text('FAIRGROUND  ·  2026.10.03  ·  엠무브 은평점',
                  MARGIN, HEIGHT-63, 22, GRAY, max_width=750)

    def finish(self):
        self.c.restoreState()
        self.c.showPage()
