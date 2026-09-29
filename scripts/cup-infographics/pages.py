"""One rendering function per infographic; schedule content comes from the guide."""
from drawing import (BLUE, NAVY, TEAL, GRAY, LINE, PALE_BLUE, PALE_TEAL,
                     WHITE, MARGIN, CONTENT_WIDTH)

PANEL_PADDING = 32
LEFT_COLUMN = MARGIN + PANEL_PADDING
RIGHT_COLUMN = 450


def overview(b, data):
    b.header(1, '하루 전체 시간표', '10월 3일 토요일  |  엠무브 은평점  |  혼성 풋살 대회')
    for x, label, value in [(88, '참가 규모', '8팀 · 20경기'),
                             (400, '팀별 경기', '3 + 2 = 5경기'),
                             (712, '경기 장소', 'A구장 한 면')]:
        b.text(label, x, 379, 24, GRAY)
        b.text(value, x, 426, 32, BLUE, 'bold', max_width=280)
    for x in [370, 682]:
        b.line(x, 381, x, 459)

    b.text('15분마다 다음 경기 시작', MARGIN, 520, 36, NAVY, 'bold')
    b.rect(MARGIN, 582, 708, 68, BLUE, 10)
    b.rect(812, 582, 180, 68, TEAL, 10)
    b.text('경기 12분', 442, 602, 30, WHITE, 'bold', 'center')
    b.text('교체 3분', 902, 604, 27, WHITE, 'bold', 'center')

    b.rect(MARGIN, 694, CONTENT_WIDTH, 470, WHITE, 20, LINE)
    b.pill('01', LEFT_COLUMN, 728, 56, 42)
    b.text('준비와 오프닝', 194, 731, 34, NAVY, 'bold')
    b.text('07:40-10:00', 960, 735, 29, GRAY, align='right')
    for i, (time, title, *_rest) in enumerate(data['timeline'][0]['rows']):
        y = 807+i*58
        if i == 0:
            title = '운영진 세팅 · 구장 밖'
        b.text(time, LEFT_COLUMN, y, 30, BLUE, 'bold', max_width=298)
        b.text(title, RIGHT_COLUMN, y, 32, NAVY, max_width=510)

    b.rect(MARGIN, 1198, CONTENT_WIDTH, 242, BLUE, 20)
    b.pill('02', LEFT_COLUMN, 1232, 56, 42, WHITE, BLUE)
    b.text('A구장 경기', 194, 1235, 34, WHITE, 'bold')
    for y, row, detail in zip([1307, 1377], data['timeline'][1]['rows'],
                               ['팀당 3경기', '팀당 2경기']):
        b.text(row[0], LEFT_COLUMN, y, 33, WHITE, 'bold', max_width=300)
        b.text(row[1], RIGHT_COLUMN, y, 33, WHITE, 'bold', max_width=350)
        b.text(detail, 960, y+5, 24, '#DAE8FF', align='right')

    b.rect(MARGIN, 1478, CONTENT_WIDTH, 150, PALE_TEAL, 18)
    b.text('동시 진행 · 실내구장', LEFT_COLUMN, 1508, 23, TEAL, 'bold')
    b.text('10:00-14:30', LEFT_COLUMN, 1559, 32, TEAL, 'bold')
    b.text('그라운드 챌린지 3종', RIGHT_COLUMN, 1505, 34, TEAL, 'bold')
    b.text('다음 경기팀은 참여 호출에서 제외', RIGHT_COLUMN, 1569, 25, TEAL)

    b.rect(MARGIN, 1666, CONTENT_WIDTH, 296, WHITE, 20, LINE)
    b.pill('03', LEFT_COLUMN, 1700, 56, 42)
    b.text('시상과 마무리', 194, 1703, 34, NAVY, 'bold')
    for i, row in enumerate(data['timeline'][3]['rows']):
        y = 1782+i*58
        b.text(row[0], LEFT_COLUMN, y, 30, BLUE, 'bold', max_width=298)
        b.text(row[1], RIGHT_COLUMN, y, 32, NAVY, max_width=510)
    b.text('식사는 팀별 휴식 시간에 · 대관 08:00-18:00',
           MARGIN, 2011, 27, GRAY)
    b.finish()


def group_schedule(b, data):
    b.header(2, '조별리그 대진표', '10:00-13:00  |  A구장 한 면  |  팀당 3경기')
    for x, group, color, tint in [(88, 'A', BLUE, PALE_BLUE),
                                    (556, 'B', TEAL, PALE_TEAL)]:
        b.rect(x, 376, 436, 318, WHITE, 18, LINE)
        b.text(f'{group}조', x+28, 405, 32, color, 'bold')
        for i in range(1, 5):
            y = 466+(i-1)*54
            seed = f'{group}{i}'
            b.pill(seed, x+28, y-1, 56, 36, tint, color, 22)
            b.text(data['teamSeeds'][seed], x+102, y+1, 30, NAVY,
                   'medium', max_width=306)
    b.text('시간 순서대로, A조와 B조가 번갈아 경기합니다.',
           MARGIN, 738, 28, GRAY)
    b.text('경기', 112, 802, 23, GRAY, 'bold')
    b.text('시작', 184, 802, 23, GRAY, 'bold')
    b.text('대진', 388, 802, 23, GRAY, 'bold')

    for index, game in enumerate(data['courtMatches'][:12]):
        # Larger gaps every hour make the 12 games easier to scan in blocks.
        y = 847+index*84+(index//4)*24
        seeds = game['seedMatch'].split(' vs ')
        home, away = [data['teamSeeds'][seed] for seed in seeds]
        color = BLUE if seeds[0].startswith('A') else TEAL
        tint = PALE_BLUE if color == BLUE else PALE_TEAL
        b.rect(MARGIN, y, CONTENT_WIDTH, 76, WHITE, 11)
        b.rect(MARGIN, y, 5, 76, color, 2)
        b.text(f'{game["slot"]:02d}', 112, y+27, 24, GRAY, 'medium')
        b.text(game['time'].split('–')[0], 184, y+22, 34, color, 'bold')
        b.pill(seeds[0][0]+'조', 305, y+21, 62, 37, tint, color, 24)
        b.text(home, 388, y+26, 29, NAVY, 'medium', max_width=244)
        b.text('vs', 665, y+29, 23, GRAY, 'regular', 'center')
        b.text(away, 710, y+26, 29, NAVY, 'medium', max_width=260)

    b.rect(MARGIN, 1957, CONTENT_WIDTH, 99, BLUE, 14)
    b.text('13:00  순위결정전 시작', LEFT_COLUMN, 1990, 34, WHITE, 'bold')
    b.text('전체 대진은 3쪽에서', 960, 1995, 26, '#DAE8FF', align='right')
    b.finish()


def semifinal(b, game, x, y, color, tint):
    b.rect(x, y, 404, 150, WHITE, 14, LINE)
    b.pill(f'{game["slot"]:02d}경기', x+24, y+24, 88, 34,
           tint, color, 22)
    b.text(game['time'].split('–')[0], x+380, y+25, 28, color,
           'bold', 'right')
    home, away = game['match'].split(' vs ')
    b.text(f'{home}  vs  {away}', x+202, y+91, 31, NAVY,
           'bold', 'center', 356)


def result_game(b, game, x, y, label, color, tint, participants):
    b.rect(x, y, 404, 174, tint, 14)
    b.text(f'{game["slot"]:02d}경기  ·  {game["time"].split("–")[0]}',
           x+24, y+25, 25, color, 'bold')
    b.text(label, x+24, y+71, 38, color, 'bold', max_width=356)
    b.text(participants, x+24, y+129, 24, color, max_width=356)


def bracket_block(b, games, y, title, ranks, color, tint, semi_ids, final_ids):
    # Both semis feed both placement games. The central node joins the two
    # semis; named outgoing branches specify winner vs loser routing.
    b.rect(MARGIN, y, CONTENT_WIDTH, 674, WHITE, 20, LINE)
    b.text(title, LEFT_COLUMN, y+36, 38, color, 'bold')
    b.pill(ranks, 804, y+39, 156, 40, tint, color, 25)
    b.text('교차 준결승', LEFT_COLUMN, y+102, 25, GRAY, 'bold')
    for slot, x in zip(semi_ids, [120, 556]):
        semifinal(b, games[slot], x, y+156, color, tint)
    b.line(322, y+306, 322, y+339, color, 3)
    b.line(758, y+306, 758, y+339, color, 3)
    b.line(322, y+339, 758, y+339, color, 3)
    b.line(540, y+339, 540, y+361, color, 3)
    b.text('각 준결승 결과에 따라', 540, y+374, 26, GRAY,
           'bold', 'center')
    b.line(540, y+414, 540, y+427, color, 3)
    b.line(322, y+427, 758, y+427, color, 3)
    b.arrow(322, y+427, 322, y+467, color, 3)
    b.arrow(758, y+427, 758, y+467, color, 3)
    b.pill('패자끼리', 350, y+430, 129, 35, WHITE, GRAY, 24)
    b.pill('승자끼리', 787, y+430, 129, 35, WHITE, color, 24)
    loser, winner = [games[slot] for slot in final_ids]
    refs = f'{semi_ids[0]}·{semi_ids[1]}경기'
    result_game(b, loser, 120, y+467, loser['stage'], GRAY, '#F0F3F7', refs+' 패자 2팀')
    label = '결승 · 1·2위전' if winner['stage'] == '결승' else winner['stage']
    result_game(b, winner, 556, y+467, label, color, tint, refs+' 승자 2팀')


def placement(b, data):
    b.header(3, '순위결정전 대진표', '13:00-15:00  |  A구장 한 면  |  팀당 2경기')
    b.rect(MARGIN, 376, CONTENT_WIDTH, 130, PALE_BLUE, 14)
    b.text('“A조 1위”는 조별리그 최종 순위입니다.', LEFT_COLUMN, 404, 31, BLUE, 'bold')
    b.text('시드 A1·B1과 다릅니다. 경기 번호와 시작 시간을 확인하세요.',
           LEFT_COLUMN, 461, 25, BLUE)
    games = {game['slot']: game for game in data['courtMatches']}
    bracket_block(b, games, 554, '챌린지', '5-8위 결정', TEAL, PALE_TEAL,
                  [13, 14], [17, 18])
    bracket_block(b, games, 1292, '챔피언십', '1-4위 결정', BLUE, PALE_BLUE,
                  [15, 16], [19, 20])
    b.text('15:00 시상식  →  15:25 클로징·단체사진',
           540, 2014, 33, BLUE, 'bold', 'center')
    b.finish()
