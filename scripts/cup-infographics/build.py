#!/usr/bin/env python3
"""Export the current operating schedule as three shareable vector pages."""
import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess

from reportlab.pdfgen import canvas

from drawing import Board, HEIGHT, PAGE_SCALE, WIDTH, register_fonts
from pages import overview, group_schedule, placement

ROOT = Path(__file__).resolve().parents[2]


def read_schedule():
    result = subprocess.run(['node', str(Path(__file__).with_name('export-data.mjs'))],
                            check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    games = data['courtMatches']
    if len(games) != 20 or [g['slot'] for g in games] != list(range(1, 21)):
        raise ValueError('Expected the confirmed 20-game single-court schedule')
    appearances = Counter()
    pairs = set()
    for i, game in enumerate(games):
        start, end = game['time'].split('–')
        as_minutes = lambda t: int(t[:2])*60 + int(t[3:])
        if as_minutes(start) != 600+i*20 or as_minutes(end)-as_minutes(start) != 20:
            raise ValueError(f'Unexpected 20-minute slot: {game}')
        if as_minutes(game['reportTime']) != as_minutes(start)-5:
            raise ValueError(f'Report time must be five minutes before kickoff: {game}')
        if i < 12:
            seeds = game['seedMatch'].split(' vs ')
            if len(seeds) != 2 or seeds[0][0] != seeds[1][0]:
                raise ValueError(f'Invalid group matchup: {seeds}')
            pairs.add(tuple(sorted(seeds)))
            appearances.update(seeds)
    if len(pairs) != 12 or appearances != Counter({seed: 3 for seed in data['teamSeeds']}):
        raise ValueError('Every team must play three unique group opponents')
    # A changed tournament format must be reflected in the bracket renderer.
    expected = {13: 'A조 3위 vs B조 4위', 14: 'A조 4위 vs B조 3위',
                15: 'A조 1위 vs B조 2위', 16: 'A조 2위 vs B조 1위',
                17: '챌린지 준결승 패자 2팀', 18: '챌린지 준결승 승자 2팀',
                19: '챔피언십 준결승 패자 2팀', 20: '챔피언십 준결승 승자 2팀'}
    if any(g['match'] != expected[g['slot']] for g in games[12:]):
        raise ValueError('Placement bracket format changed; update pages.py')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font-dir', default=str(Path.home()/'Library/Fonts'))
    parser.add_argument('--output', type=Path, default=ROOT/'output/pdf/fairground-cup-2026-schedule.pdf')
    args = parser.parse_args()
    data = read_schedule()
    register_fonts(args.font_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(args.output), pagesize=(WIDTH*PAGE_SCALE, HEIGHT*PAGE_SCALE),
                      pageCompression=1, invariant=1)
    c.setTitle('2026 FairGround Cup | 전체 시간표와 대진표')
    c.setAuthor('FairGround')
    c.setSubject('2026.10.03 · 8팀 · A구장 한 면 · 경기 12분 + 교대 3분 + 장비 점검 5분')
    b = Board(c, ROOT/'public/cup-ops/assets/wordmark.png')
    for page in [overview, group_schedule, placement]:
        page(b, data)
    c.save()
    print(args.output)


if __name__ == '__main__':
    main()
