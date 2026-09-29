"""One rendering function per infographic; schedule content comes from the guide."""
from drawing import BLUE, NAVY, TEAL, GRAY, LINE, PALE_BLUE, PALE_TEAL, WHITE


def overview(b, data):
    b.header(1, '하루 전체 시간표', '10월 3일 토요일  |  엠무브 은평점  |  혼성 풋살 대회')
    for x, label, value in [(64, '참가 규모', '8팀 · 20경기'),
                             (389, '팀별 경기', '3 + 2 = 5경기'),
                             (714, '경기 장소', 'A구장 한 면')]:
        b.rect(x, 308, 302, 99, WHITE, 14, LINE)
        b.text(label, x+22, 324, 24, GRAY)
        b.text(value, x+22, 363, 32, BLUE, 'bold', max_width=260)

    b.text('15분마다 다음 경기 시작', 64, 434, 36, NAVY, 'bold')
    b.rect(64, 488, 761, 58, BLUE, 10)
    b.rect(836, 488, 180, 58, TEAL, 10)
    b.text('경기 12분', 444, 503, 30, WHITE, 'bold', 'center')
    b.text('교체 3분', 926, 505, 27, WHITE, 'bold', 'center')

    b.rect(64, 580, 952, 419, WHITE, 20, LINE)
    b.pill('01', 88, 603, 56, 42)
    b.text('준비와 오프닝', 161, 606, 34, NAVY, 'bold')
    b.text('07:40-10:00', 988, 609, 29, GRAY, align='right')
    for i, (time, title, *_rest) in enumerate(data['timeline'][0]['rows']):
        y = 674+i*51
        if i == 0:
            title = '운영진 세팅 · 구장 밖'
        b.text(time, 94, y, 30, BLUE, 'bold', max_width=299)
        b.text(title, 419, y, 32, NAVY, max_width=566)
        if i < 5:
            b.line(94, y+39, 986, y+39, '#EDF1F6', 1)

    b.rect(64, 1019, 952, 226, BLUE, 20)
    b.pill('02', 88, 1043, 56, 42, WHITE, BLUE)
    b.text('A구장 경기', 161, 1046, 34, WHITE, 'bold')
    for y, row, detail in zip([1102, 1170], data['timeline'][1]['rows'],
                               ['팀당 3경기', '팀당 2경기']):
        b.text(row[0], 94, y, 33, WHITE, 'bold', max_width=300)
        b.text(row[1], 419, y, 33, WHITE, 'bold', max_width=350)
        b.text(detail, 986, y+5, 24, '#DAE8FF', align='right')

    b.rect(64, 1265, 952, 117, PALE_TEAL, 18)
    b.text('동시 진행 · 실내구장', 88, 1283, 23, TEAL, 'bold')
    b.text('10:00-14:30', 88, 1323, 32, TEAL, 'bold')
    b.text('그라운드 챌린지 3종', 419, 1289, 34, TEAL, 'bold')
    b.text('다음 경기팀은 참여 호출에서 제외', 419, 1341, 25, TEAL)

    b.rect(64, 1402, 952, 242, WHITE, 20, LINE)
    b.pill('03', 88, 1426, 56, 42)
    b.text('시상과 마무리', 161, 1429, 34, NAVY, 'bold')
    for i, row in enumerate(data['timeline'][3]['rows']):
        y = 1490+i*47
        b.text(row[0], 94, y, 30, BLUE, 'bold', max_width=299)
        b.text(row[1], 419, y, 32, NAVY, max_width=566)
    b.text('식사는 팀별 휴식 시간에 · 대관 08:00-18:00',
           64, 1672, 27, GRAY)
    b.finish()


def group_schedule(b, data):
    b.header(2, '조별리그 대진표', '10:00-13:00  |  A구장 한 면  |  팀당 3경기')
    for x, group, color, tint in [(64, 'A', BLUE, PALE_BLUE),
                                    (552, 'B', TEAL, PALE_TEAL)]:
        b.rect(x, 306, 464, 282, WHITE, 18, LINE)
        b.rect(x, 306, 464, 55, color, 15)
        b.text(f'{group}조', x+23, 317, 32, WHITE, 'bold')
        for i in range(1, 5):
            y = 379+(i-1)*47
            seed = f'{group}{i}'
            b.pill(seed, x+22, y-1, 56, 36, tint, color, 22)
            b.text(data['teamSeeds'][seed], x+93, y+1, 30, NAVY,
                   'bold', max_width=350)
    b.text('시간 순서대로, A조와 B조가 번갈아 경기합니다.',
           64, 616, 28, GRAY)
    b.text('경기', 86, 671, 23, GRAY, 'bold')
    b.text('시작', 154, 671, 23, GRAY, 'bold')
    b.text('대진', 355, 671, 23, GRAY, 'bold')

    for index, game in enumerate(data['courtMatches'][:12]):
        y = 716+index*73
        seeds = game['seedMatch'].split(' vs ')
        home, away = [data['teamSeeds'][seed] for seed in seeds]
        color = BLUE if seeds[0].startswith('A') else TEAL
        tint = PALE_BLUE if color == BLUE else PALE_TEAL
        b.rect(64, y, 952, 65, WHITE, 11)
        b.rect(64, y, 7, 65, color, 3)
        b.text(f'{game["slot"]:02d}', 88, y+20, 24, GRAY, 'bold')
        b.text(game['time'].split('–')[0], 154, y+16, 34, color, 'bold')
        b.pill(seeds[0][0]+'조', 278, y+14, 62, 37, tint, color, 24)
        b.text(home, 356, y+20, 28, NAVY, 'bold', max_width=292)
        b.text('vs', 681, y+22, 23, GRAY, 'medium', 'center')
        b.text(away, 717, y+20, 28, NAVY, 'bold', max_width=287)

    b.rect(64, 1620, 952, 87, BLUE, 14)
    b.text('13:00  순위결정전 시작', 88, 1645, 34, WHITE, 'bold')
    b.text('전체 대진은 3쪽에서', 989, 1650, 26, '#DAE8FF', align='right')
    b.finish()


def semifinal(b, game, x, y, color, tint):
    b.rect(x, y, 432, 126, WHITE, 14, LINE)
    b.pill(f'{game["slot"]:02d}경기', x+19, y+15, 88, 34,
           tint, color, 22)
    b.text(game['time'].split('–')[0], x+407, y+16, 28, color,
           'bold', 'right')
    home, away = game['match'].split(' vs ')
    b.text(f'{home}  vs  {away}', x+216, y+71, 31, NAVY,
           'bold', 'center', 394)


def result_game(b, game, x, y, label, color, tint, participants):
    b.rect(x, y, 432, 151, tint, 14)
    b.text(f'{game["slot"]:02d}경기  ·  {game["time"].split("–")[0]}',
           x+22, y+19, 25, color, 'bold')
    b.text(label, x+22, y+59, 38, color, 'bold')
    b.text(participants, x+22, y+115, 24, color, max_width=390)


def bracket_block(b, games, y, title, ranks, color, tint, semi_ids, final_ids):
    # Both semis feed both placement games. The central node joins the two
    # semis; named outgoing branches specify winner vs loser routing.
    b.rect(64, y, 952, 578, WHITE, 20, LINE)
    b.text(title, 88, y+24, 38, color, 'bold')
    b.pill(ranks, 843, y+26, 149, 40, tint, color, 25)
    b.text('교차 준결승', 88, y+80, 25, GRAY, 'bold')
    for slot, x in zip(semi_ids, [88, 560]):
        semifinal(b, games[slot], x, y+123, color, tint)
    b.line(304, y+249, 304, y+283, color, 3)
    b.line(776, y+249, 776, y+283, color, 3)
    b.line(304, y+283, 776, y+283, color, 3)
    b.line(540, y+283, 540, y+305, color, 3)
    b.text('각 준결승 결과에 따라', 540, y+309, 26, GRAY,
           'bold', 'center')
    b.line(540, y+344, 540, y+357, color, 3)
    b.line(304, y+357, 776, y+357, color, 3)
    b.arrow(304, y+357, 304, y+407, color, 3)
    b.arrow(776, y+357, 776, y+407, color, 3)
    b.pill('패자끼리', 348, y+364, 129, 35, WHITE, GRAY, 24)
    b.pill('승자끼리', 820, y+364, 129, 35, WHITE, color, 24)
    loser, winner = [games[slot] for slot in final_ids]
    refs = f'{semi_ids[0]}·{semi_ids[1]}경기'
    result_game(b, loser, 88, y+407, loser['stage'], GRAY, '#F0F3F7', refs+' 패자 2팀')
    label = '결승 · 1·2위전' if winner['stage'] == '결승' else winner['stage']
    result_game(b, winner, 560, y+407, label, color, tint, refs+' 승자 2팀')


def placement(b, data):
    b.header(3, '순위결정전 대진표', '13:00-15:00  |  A구장 한 면  |  팀당 2경기')
    b.rect(64, 307, 952, 97, PALE_BLUE, 14)
    b.text('“A조 1위”는 조별리그 최종 순위입니다.', 88, 324, 31, BLUE, 'bold')
    b.text('시드 A1·B1과 다릅니다. 경기 번호와 시작 시간을 확인하세요.',
           88, 369, 25, BLUE)
    games = {game['slot']: game for game in data['courtMatches']}
    bracket_block(b, games, 431, '챌린지', '5-8위 결정', TEAL, PALE_TEAL,
                  [13, 14], [17, 18])
    bracket_block(b, games, 1033, '챔피언십', '1-4위 결정', BLUE, PALE_BLUE,
                  [15, 16], [19, 20])
    b.text('15:00 시상식  →  15:25 클로징·단체사진',
           540, 1660, 33, BLUE, 'bold', 'center')
    b.finish()
