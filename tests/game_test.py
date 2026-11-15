#!/usr/bin/env python3
"""Browser tests for the built index.html (rules, touch controls, game flows, the offline and cloud paths).

    python3 tests/game_test.py                 all groups
    python3 tests/game_test.py rules flows     only the named groups: rules, touch, flows, cloud, controls, friends, look, store

Environment: CHROME (browser binary, default: Playwright's Chromium), TEST_OUT (screenshot folder).
Exit code 1 when a check fails or the page throws. Checks read state through the game's own globals
(boards, series, profile, t(...)), so they survive wording and layout changes; keep them that way.
"""
import asyncio, datetime, json, os, sys, tempfile
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, 'index.html')
OUT = os.path.join(os.environ.get('TEST_OUT') or tempfile.mkdtemp(prefix='neon-test-'), '')
os.makedirs(OUT, exist_ok=True)
GROUPS = [g for g in sys.argv[1:] if not g.startswith('-')] or ['rules', 'touch', 'flows', 'cloud', 'controls', 'friends', 'look', 'store']
R, ERRS = {}, []


def check(name, ok, info=''):
    R[name] = bool(ok)
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else '  -> ' + json.dumps(info, ensure_ascii=False, default=str)[:400]), flush=True)


async def new_page(browser, touch=False, store=None, route=None):
    ctx = await browser.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, has_touch=touch, is_mobile=touch)
    if route:
        await ctx.route('https://test.supabase.co/**', route)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: ERRS.append('PAGEERROR ' + str(e)))
    pg.on('dialog', lambda d: ERRS.append('DIALOG ' + d.message))
    if store is not None:
        await pg.add_init_script("if(!localStorage.getItem('neon-duel'))localStorage.setItem('neon-duel',%s)" % json.dumps(json.dumps(store)))
    return ctx, pg


async def wait(pg, cond, timeout=8000):
    # the page's CSP blocks eval-based polling in the page, so poll from here
    end = asyncio.get_event_loop().time() + timeout / 1000
    while not await pg.evaluate(cond):
        if asyncio.get_event_loop().time() > end:
            raise TimeoutError('timed out waiting for ' + cond)
        await asyncio.sleep(0.1)


FREEZE = "window.MABLE_PARAMS.fallSeconds=1000;aiClock=-1e9"     # stop gravity and the AI for setups
CLEAR = "b.cells=Array.from({length:20},emptyRow);b.garbage=[];b.b2b=-1;b.combo=-1;b.attack=0;b.lines=0"


# ====================================================================== rules
async def rules(br):
    print('rules', flush=True)
    ctx, pg = await new_page(br)
    await pg.goto('file://' + PAGE)
    await pg.evaluate("profile.fmt='single';startPractice()")
    await pg.evaluate(FREEZE)
    q = await pg.evaluate("[boards[0].queue.slice(0,6),boards[1].queue.slice(0,6),boards[0].queue.length]")
    check('both players get the same pieces, 5+ previews', q[0] == q[1] and q[2] >= 7, q)
    att = await pg.evaluate("""[attackFor(1,0,-1,0,false),attackFor(2,0,-1,0,false),attackFor(4,0,0,0,false),attackFor(4,0,1,0,false),
      attackFor(2,2,-1,0,false),attackFor(3,2,2,0,false),attackFor(1,0,-1,2,false),attackFor(2,0,-1,1,false),attackFor(4,0,0,2,false),
      attackFor(1,0,-1,0,true),attackFor(2,1,0,0,false)]""")
    check('attack table (lines, T-spin, B2B, combo, all clear)', att == [0, 1, 4, 5, 4, 7, 1, 1, 6, 10, 1], att)
    k = await pg.evaluate("""(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);place(b,0);b.piece.y=18;
      const x0=b.piece.x,y0=b.piece.y,ok=rotate(b,1);return [ok,b.piece.x-x0,b.piece.y-y0,b.lastKick,b.piece.r]})()""")
    check('SRS: I piece on the floor kicks up', k == [True, 1, -2, 4, 1], k)
    c = await pg.evaluate("""(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);place(b,2);b.piece.y=8;const s=JSON.stringify(b.piece.m),x=b.piece.x,y=b.piece.y;
      for(let i=0;i<4;i++)rotate(b,1);const cw=JSON.stringify(b.piece.m)===s&&b.piece.x===x&&b.piece.y===y;
      rotate(b,-1);rotate(b,1);const ccw=JSON.stringify(b.piece.m)===s;rotate(b,2);rotate(b,2);return cw&&ccw&&JSON.stringify(b.piece.m)===s})()""")
    check('rotations cycle back (cw, ccw, 180)', c)
    TSD = """b.cells[19]=[8,8,8,8,0,8,8,8,8,8];b.cells[18]=[8,8,8,0,0,0,8,8,8,8];b.cells[17][3]=8;b.piece={id:2,r:2,m:ROT[2][2],x:3,y:17};"""
    t = await pg.evaluate("(()=>{const b=boards[0],o=boards[1];o.garbage=[];%s;%s b.lastRot=true;b.lastKick=0;lock(b);return [b.lines,b.attack,pendingRows(o,false),b.b2b]})()" % (CLEAR, TSD))
    check('T-spin double sends 4', t == [2, 4, 4, 0], t)
    t = await pg.evaluate("(()=>{const b=boards[0];%s;%s b.lastRot=false;lock(b);return [b.lines,b.attack]})()" % (CLEAR, TSD))
    check('same slot without a rotation is a plain double', t == [2, 1], t)
    QUAD = "for(let y=16;y<20;y++){b.cells[y]=Array(10).fill(8);b.cells[y][9]=0}b.cells[15][0]=3;b.piece={id:0,r:1,m:ROT[0][1],x:7,y:16};b.lastRot=false;"
    t = await pg.evaluate("(()=>{const b=boards[0],o=boards[1];o.garbage=[];%s;%s b.garbage=[{rows:3,hole:2,delay:0}];lock(b);return [pendingRows(b,false),pendingRows(o,false),b.attack]})()" % (CLEAR, QUAD))
    check('attacks cancel incoming garbage first (quad vs 3 -> sends 1)', t == [0, 1, 4], t)
    t = await pg.evaluate("""(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);b.combo=-1;
      b.garbage=[{rows:5,hole:1,delay:.35},{rows:6,hole:7,delay:0}];place(b,1);hard(b);const first=b.cells.filter(r=>r.includes(8)).length;
      b.garbage[0].delay=0;place(b,1);b.piece.x=0;hard(b);return [first,b.cells.filter(r=>r.includes(8)).length,pendingRows(b,false)]})()""")
    check('garbage waits its delay, in order, max 8 per piece', t == [0, 8, 3], t)
    t = await pg.evaluate("""(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);b.garbage=[];place(b,2);while(move(b,0,1));
      const p=b.piece;for(let i=0;i<27;i++)step(1/60);const early=b.piece===p;for(let i=0;i<6;i++)step(1/60);return [early,b.piece!==p]})()""")
    check('lock delay 0.5 s', t == [True, True], t)
    t = await pg.evaluate("""(()=>{const b=boards[0],o=boards[1];o.garbage=[];%s;const out=[];for(let k=0;k<3;k++){
      b.cells[19]=[8,8,8,8,8,8,8,8,8,0];b.cells[18]=[8,8,8,8,8,8,8,8,8,0];b.cells[0][0]=3;b.piece={id:0,r:1,m:ROT[0][1],x:7,y:16};lock(b);out.push([b.combo,b.attack])}return out})()""" % CLEAR)
    check('combo grows the attack', t == [[0, 1], [1, 2], [2, 3]], t)
    t = await pg.evaluate("(()=>{const b=boards[0],o=boards[1];o.garbage=[];%s;b.cells[19]=[8,8,8,8,8,8,0,0,0,0];b.piece={id:0,r:0,m:ROT[0][0],x:6,y:18};lock(b);return b.attack})()" % CLEAR)
    check('all clear sends 10', t == 10, t)
    t = await pg.evaluate("""(()=>{rivalCfg=DIFFS[2];const o=boards[1];o.cells=Array.from({length:20},emptyRow);o.garbage=[];o.lines=0;
      for(let i=0;i<150&&state==='play';i++){aiMove();boards[0].garbage=[]}return [state,o.lines]})()""")
    check('Hard AI survives 150 pieces and clears lines', t[0] == 'play' and t[1] > 40, t)
    await ctx.close()


# ====================================================================== touch
S = 412 / 504


async def touch(br):
    print('touch', flush=True)
    ctx, pg = await new_page(br, touch=True)
    cdp = await ctx.new_cdp_session(pg)
    await pg.goto('file://' + PAGE)
    await pg.evaluate("profile.fmt='single';startPractice()")
    await pg.evaluate(FREEZE + ";rivalCfg={...rivalCfg,sec:1e9}")
    # convert game coordinates (504 wide) to page coordinates for this viewport
    sc = await pg.evaluate("parseFloat($('world').style.transform.slice(6))")
    ox, oy = await pg.evaluate("[parseFloat($('world').style.left),parseFloat($('world').style.top)]")

    def css(wx, wy): return ox + wx * sc, oy + wy * sc

    async def t(kind, x, y):
        await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y, 'id': 1}]})

    async def drag(w0, w1, ms, steps=12):
        x0, y0 = css(*w0); x1, y1 = css(*w1)
        await t('touchStart', x0, y0)
        for i in range(1, steps + 1):
            await pg.wait_for_timeout(ms / steps)
            await t('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
        await t('touchEnd', x1, y1)
        await pg.wait_for_timeout(50)

    async def fresh(i=2):
        await pg.evaluate("(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);place(b,%d);b.canHold=true})()" % i)

    await fresh()
    before = await pg.evaluate('JSON.stringify(boards[0].piece.m)')
    x, y = css(450, 790)
    await t('touchStart', x, y); await pg.wait_for_timeout(60); await t('touchEnd', x, y); await pg.wait_for_timeout(50)
    check('tap anywhere rotates', before != await pg.evaluate('JSON.stringify(boards[0].piece.m)'))
    await fresh(); x0 = await pg.evaluate('boards[0].piece.x')
    await drag((40, 1000), (40 + 26 * 3 + 5, 1002), 600)
    check('slow slide right moves 3 columns', await pg.evaluate('boards[0].piece.x') - x0 == 3)
    await fresh()
    await drag((140, 400), (140, 400 + 28 * 4 + 5), 1200, steps=24)
    r = await pg.evaluate('[boards[0].piece.y,boards[0].cells.flat().filter(v=>v).length]')
    check('slow drag down follows the finger, no lock', r == [4, 0], r)
    await fresh()
    # a real flick takes a few frames; CDP touches are too slow to time one, so dispatch it in the page
    await pg.evaluate("""(()=>{const el=$('board'),s=parseFloat($('world').style.transform.slice(6)),r=$('world').getBoundingClientRect();
      const P=(type,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:r.left+140*s,clientY:r.top+y*s}));
      P('pointerdown',300);P('pointermove',380);P('pointermove',460);P('pointermove',620);P('pointerup',620)})()""")
    r = await pg.evaluate('[boards[0].cells.flat().filter(v=>v).length,boards[0].piece.y,boards[0].pieces]')
    check('fast flick down drops', r[0] == 4, r)
    await fresh()
    await drag((200, 700), (200, 600), 150, steps=6)
    r = await pg.evaluate('[boards[0].hold,boards[0].canHold]')
    check('swipe up holds, once per piece', r == [2, False], r)
    cur = await pg.evaluate('boards[0].piece.id')
    await pg.click('#holdBtn')
    check('second hold on the same piece is ignored', await pg.evaluate('boards[0].piece.id') == cur)
    await pg.evaluate("hard(boards[0])"); await pg.click('#holdBtn')
    r = await pg.evaluate('[boards[0].piece.id,boards[0].canHold]')
    check('hold swaps on the next piece', r == [2, False], r)
    await fresh(5); sx = await pg.evaluate('boards[0].piece.x')
    x0, y0 = css(140, 300)
    await t('touchStart', x0, y0)
    for i in range(1, 9):
        await pg.wait_for_timeout(40); await t('touchMove', x0 + i * 7 * sc, y0)
    for i in range(1, 11):
        await pg.wait_for_timeout(60); await t('touchMove', x0 + 56 * sc, y0 + i * 9 * sc)
    await pg.wait_for_timeout(200); await t('touchEnd', x0 + 56 * sc, y0 + 90 * sc)
    r = await pg.evaluate('[boards[0].piece.x-%d,boards[0].piece.y]' % sx)
    check('L-shaped drag: sideways, then down', r == [2, 3], r)
    await fresh(); m0 = await pg.evaluate('JSON.stringify(boards[0].piece.m)')
    await pg.tap('#controls button[data-action="left"]')
    check('buttons do not count as a tap-to-rotate', await pg.evaluate('JSON.stringify(boards[0].piece.m)') == m0)
    await pg.screenshot(path=OUT + 'touch.png')
    await ctx.close()


# ====================================================================== flows
async def flows(br):
    print('flows', flush=True)
    ctx, pg = await new_page(br)
    await pg.goto('file://' + PAGE)
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=OUT + 'home.png')
    check('new player is unranked ("?")', await pg.evaluate("rankLetter()==='?'&&!placed()"))
    # settings: format and powers
    await pg.click('#settings'); await pg.click('#fmtBtn'); await pg.click('#saveProfile')
    check('format setting is saved', await pg.evaluate("JSON.parse(localStorage.getItem('neon-duel')).fmt") == 'ft3')
    # practice FT3 vs NOVA
    await pg.click('#start'); await pg.wait_for_timeout(200)
    r = await pg.evaluate("({mode:series.mode,target:series.target,powers:$('powers').hidden,badge:$('series').hidden})")
    check('practice FT3 starts (powers off by default)', r == {'mode': 'practice', 'target': 3, 'powers': True, 'badge': False}, r)
    for i in range(4):
        await pg.evaluate("action('%s');action('hard')" % ['left', 'right', 'rotate', 'ccw'][i])
        await pg.wait_for_timeout(250)
    await pg.screenshot(path=OUT + 'play.png')
    await pg.evaluate("finishRound(boards[1])"); await pg.wait_for_timeout(300)
    check('round over: GAME! and 1-0', await pg.evaluate("state==='over'&&!$('gameover').hidden&&series.me===1"))
    await wait(pg, "state==='play'&&series.game===1&&boards[0].pieces===0", 7000)
    for who in ('boards[0]', 'boards[1]', 'boards[1]'):
        await wait(pg, "state==='play'", 7000)
        await pg.evaluate("finishRound(%s)" % who)
    await wait(pg, "state==='result'", 4000)
    r = await pg.evaluate("({me:series.me,foe:series.foe,rank:profile.rank,wins:profile.wins,coins:profile.coins,rp:$('resultStats').firstElementChild.textContent.includes(t('noRp'))})")
    check('practice series 3-1: coins only, no rank', r == {'me': 3, 'foe': 1, 'rank': 1000, 'wins': 0, 'coins': 150, 'rp': True}, r)
    await pg.screenshot(path=OUT + 'result.png')
    await pg.click('#rematch'); await pg.wait_for_timeout(100)
    check('rematch after practice is practice', await pg.evaluate("state==='play'&&series.mode==='practice'"))
    await pg.evaluate("leaveMatch()")
    # powers only in practice
    await pg.click('#settings'); await pg.click('#fmtBtn'); await pg.click('#powBtn'); await pg.click('#saveProfile')
    await pg.click('#start'); await pg.wait_for_timeout(100)
    check('powers show in practice when switched on', await pg.evaluate("!$('powers').hidden&&powersOn()"))
    await pg.evaluate("leaveMatch()")
    # ranked without a server: a labelled bot near the player's rating
    await pg.click('#ranked'); await pg.wait_for_timeout(200)
    check('Rank without a server offers a bot', await pg.evaluate("$('modal').textContent.includes(t('rankOffline'))&&!!$('rkBot')"))
    await pg.click('#rkBot'); await pg.wait_for_timeout(200)
    r = await pg.evaluate("({mode:series.mode,powers:powersOn(),bot:$('rivalName').textContent.includes(t('bot').toUpperCase()),near:Math.abs(rivalRating-profile.rank)<=60})")
    check('ranked bot game: labelled, near my rating, no powers', r == {'mode': 'bot', 'powers': False, 'bot': True, 'near': True}, r)
    await pg.evaluate("finishRound(boards[1])"); await wait(pg, "state==='result'", 4000)
    r = await pg.evaluate("[profile.wins,profile.rank>1000,profile.coins]")
    check('ranked bot win moves rank and record', r == [1, True, 210], r)
    await pg.click('#rematch'); await pg.wait_for_timeout(100)
    check('rematch after ranked opens Rank again', await pg.evaluate("state==='title'&&!!$('rkBot')"))
    await pg.click('#rkCancel')
    b = await pg.evaluate("[700,1300,2050].map(r=>{const x=botFor(r);return [x.cfg.sec,x.cfg.style]})")
    check('bots get faster and smarter with rating', b[0][0] > b[1][0] > b[2][0] and b[0][1] == 0 and b[2][1] == 2, b)
    # titles, promotion, ladder and leaderboard
    await pg.evaluate("profile.wins=3;profile.losses=1;profile.rank=1170;profile.fmt='single';save();profileView()")
    await pg.click('#ranked'); await pg.click('#rkBot'); await pg.wait_for_timeout(100)
    await pg.evaluate("rivalRating=1200;finishRound(boards[1])"); await wait(pg, "state==='result'", 4000)
    r = await pg.evaluate("({placed:placed(),promo:!$('promo').hidden,title:titleName(profile.rank)})")
    check('fifth ranked game gives a title with a banner', r['placed'] and r['promo'] and r['title'] == await pg.evaluate("t('tMingghan')"), r)
    await pg.evaluate("leaveMatch()")
    await pg.click('.pcard'); await pg.wait_for_timeout(200)
    check('profile shows title and progress', await pg.evaluate("!!document.querySelector('.rankhead .rbadge')&&!!document.querySelector('.prog i')"))
    await pg.click('#lbBtn'); await pg.wait_for_timeout(200)
    check('offline leaderboard lists me among the AI', await pg.evaluate("document.querySelectorAll('#lbList .lbrow').length>=4&&!!document.querySelector('#lbList .lbrow.me')"))
    await pg.click('#lbDone'); await pg.click('#ladderBtn')
    check('ladder lists the 8 titles', await pg.evaluate("document.querySelectorAll('.lb .lbrow').length") == 8)
    await pg.click('#ladDone'); await pg.click('#statsDone')
    # back button and pause
    await pg.evaluate("profile.fmt='single'"); await pg.click('#start'); await pg.wait_for_timeout(100)
    r = await pg.evaluate("[window.onAndroidBack(),state,window.onAndroidBack(),state]")
    check('back pauses, back again resumes', r == [True, 'pause', True, 'play'], r)
    await pg.evaluate("finishRound(boards[0])"); await pg.wait_for_timeout(100)
    check('back is ignored on the GAME! screen', await pg.evaluate("[window.onAndroidBack(),state]") == [True, 'over'])
    await wait(pg, "state==='result'", 4000)
    check('back leaves the result, then exits from home', await pg.evaluate("[window.onAndroidBack(),state,window.onAndroidBack()]") == [True, 'title', False])
    # shop, language, delete
    await pg.evaluate("profile.coins=300;save()")
    await pg.click('#shop'); await pg.click('[data-theme="2"]')
    check('theme bought and equipped', await pg.evaluate("[profile.theme,profile.coins]") == [2, 200])
    await pg.click('#shopDone')
    await pg.click('#language')
    check('language switches', await pg.evaluate("profile.lang==='en'&&$('start').textContent===STRINGS.en.start"))
    await pg.click('#language')
    await pg.click('#settings'); await pg.click('#delete'); await pg.click('#yesDelete')
    r = await pg.evaluate("({rank:profile.rank,wins:profile.wins,coins:profile.coins,theme:profile.theme})")
    check('delete profile resets progress', r == {'rank': 1000, 'wins': 0, 'coins': 0, 'theme': 0}, r)
    await pg.click('#tutorial')
    for _ in range(3):
        await pg.click('#tNext')
    check('tutorial opens and closes', await pg.evaluate("$('modal').hidden"))
    await ctx.close()


# ====================================================================== cloud (a fake Supabase)
async def cloud(br):
    print('cloud', flush=True)
    src = open(PAGE, encoding='utf-8').read()
    test_page = OUT + 'cloud_test.html'
    open(test_page, 'w', encoding='utf-8').write(src.replace('{"supabaseUrl":"","supabaseAnonKey":""}',
                                                            '{"supabaseUrl":"https://test.supabase.co","supabaseAnonKey":"anon-key"}'))
    calls, users, net = [], {}, {'down': False, 'n': 0}
    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}

    def fresh(uid, name):
        return {'id': uid, 'username': name, 'avatar': '👑', 'rating': 1000, 'wins': 0, 'losses': 0, 'coins': 0,
                'theme': 0, 'owned': [0], 'streak': 0, 'last_claim': None, 'imported': False}

    def session(uid, email='', anon=True):
        return {'access_token': 'tok-' + uid, 'refresh_token': 'ref-' + uid, 'expires_in': 3600, 'user': {'id': uid, 'email': email, 'is_anonymous': anon}}

    async def handle(route):
        req = route.request
        if req.method == 'OPTIONS':
            return await route.fulfill(status=204, headers=cors)
        if net['down']:
            return await route.abort()
        path = req.url.split('supabase.co', 1)[1]
        body = json.loads(req.post_data) if req.post_data else {}
        auth = req.headers.get('authorization', '')
        uid = auth[len('Bearer tok-'):] if auth.startswith('Bearer tok-') else None
        calls.append((path.split('?')[0], body, req.headers.get('apikey')))
        ok = lambda d, st=200: route.fulfill(status=st, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
        err = lambda m, st=400: ok({'message': m}, st)
        if path.startswith('/auth/v1/signup'):
            net['n'] += 1; u = 'guest%d' % net['n']
            users[u] = fresh(u, body.get('data', {}).get('username', 'NOMAD'))
            return await ok(session(u))
        if path.startswith('/auth/v1/token?grant_type=password'):
            if body.get('email') == 'a@b.mn' and body.get('password') == 'secret12':
                users.setdefault('acct', {**fresh('acct', 'Хаан'), 'rating': 1300, 'wins': 20, 'losses': 5, 'coins': 900})
                return await ok(session('acct', 'a@b.mn', False))
            return await err('Invalid login credentials')
        if path.startswith('/auth/v1/user'):
            return await ok({'id': uid, 'email': body['email'], 'is_anonymous': False})
        if path.startswith('/auth/v1/logout'):
            return await route.fulfill(status=204, headers=cors)
        if path.startswith('/rest/v1/leaderboard'):
            return await ok([{'id': 'x1', 'username': '<img src=x onerror=alert(1)>', 'avatar': '⚡', 'rating': 1500, 'position': 1},
                             {'id': 'x2', 'username': 'Болд', 'avatar': '◈', 'rating': 1210, 'position': 2}])
        me = users.get(uid)
        if me is None:
            return await err('not_signed_in', 401)
        fn = path.split('/rpc/')[1] if '/rpc/' in path else ''
        if fn == 'get_my_profile':
            return await ok(me)
        if fn == 'import_local':
            if not me['imported'] and me['wins'] + me['losses'] == 0:
                me.update(rating=min(body['p_rating'], 1400), wins=body['p_wins'], losses=body['p_losses'], coins=min(body['p_coins'], 2000),
                          owned=sorted({0, *[x for x in body['p_owned'] if x in (0, 1, 2)]}), imported=True)
            return await ok(me)
        if fn == 'report_match':
            ft = body['p_format'] == 'ft3'
            if body['p_kind'] == 'bot':
                e = 1 / (1 + 10 ** ((body['p_opponent_rating'] - me['rating']) / 400))
                me['rating'] = max(0, me['rating'] + round((40 if ft else 24) * ((1 if body['p_won'] else 0) - e)))
                me['wins' if body['p_won'] else 'losses'] += 1
            me['coins'] += (150 if body['p_won'] else 40) if ft else (60 if body['p_won'] else 20)
            return await ok(me)
        if fn == 'claim_daily':
            if me['last_claim']:
                return await err('already_claimed')
            me.update(last_claim=(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)).strftime('%Y-%m-%d'), streak=1, coins=me['coins'] + 10)
            return await ok(me)
        if fn == 'buy_theme':
            if body['p_theme'] not in me['owned']:
                if me['coins'] < 100:
                    return await err('not_enough_coins')
                me['coins'] -= 100; me['owned'].append(body['p_theme'])
            me['theme'] = body['p_theme']
            return await ok(me)
        if fn == 'set_profile':
            if (body.get('p_username') or '').lower() == 'taken':
                return await err('username_taken', 409)
            if body.get('p_username'): me['username'] = body['p_username']
            if body.get('p_avatar'): me['avatar'] = body['p_avatar']
            return await ok(me)
        if fn == 'my_position':
            return await ok(3)
        if fn == 'delete_my_account':
            users.pop(uid, None)
            return await route.fulfill(status=204, headers=cors)
        return await err('unknown ' + path, 404)

    ctx, pg = await new_page(br, store={'name': 'Тэмүүжин', 'rank': 1180, 'wins': 4, 'losses': 2, 'coins': 250, 'owned': [0, 1], 'theme': 1}, route=handle)
    await pg.goto('file://' + test_page)
    await wait(pg, "Cloud.state==='online'")
    r = await pg.evaluate("({rank:profile.rank,wins:profile.wins,coins:profile.coins,name:profile.name,id:profile.cloudId})")
    check('guest sign-up imports offline progress', r == {'rank': 1180, 'wins': 4, 'coins': 250, 'name': 'Тэмүүжин', 'id': 'guest1'}, r)
    check('anon key sent on every call', all(c[2] == 'anon-key' for c in calls))
    await pg.evaluate("profile.fmt='single';profile.diff=1;save()")
    await pg.click('#start'); await pg.wait_for_timeout(200)
    await pg.evaluate("finishRound(boards[0])"); await wait(pg, "state==='result'&&outbox.length===0", 6000)
    rep = [c[1] for c in calls if c[0].endswith('report_match')]
    check('practice result reported as practice, coins from the server', rep and rep[-1]['p_kind'] == 'ai' and await pg.evaluate("[profile.rank,profile.coins]") == [1180, 270], rep[-1:])
    await pg.click('#home')
    await pg.click('.pcard'); await pg.wait_for_timeout(500)
    check('leaderboard position shown', await pg.evaluate("$('myPos')?.textContent||''") == ' · #3')
    await pg.click('#claimDaily'); await pg.wait_for_timeout(500)
    check('daily reward through the server, once', await pg.evaluate("[profile.coins,canClaim()]") == [280, False])
    await pg.click('#lbBtn'); await pg.wait_for_timeout(500)
    r = await pg.evaluate("[document.querySelectorAll('#lbList img').length,document.querySelector('#lbList .nm').textContent]")
    check('leaderboard names are escaped', r[0] == 0 and '<img' in r[1], r)
    await pg.click('#lbDone')
    await pg.fill('#aUser', 'temuujin@mail.mn'); await pg.fill('#aPw', 'secret12'); await pg.click('#linkAcc'); await pg.wait_for_timeout(500)
    check('guest account secured with email', await pg.evaluate("[Cloud.session.user.anon,Cloud.session.user.email]") == [False, 'temuujin@mail.mn'])
    await pg.wait_for_timeout(1000)
    await pg.click('#statsDone')
    await pg.click('#settings'); await pg.fill('#nick', 'Taken'); await pg.click('#saveProfile'); await pg.wait_for_timeout(400)
    check('taken nickname is refused', await pg.evaluate("$('setMsg').textContent===t('errNameTaken')"))
    await pg.fill('#nick', 'Тэмүүжин2'); await pg.click('#saveProfile'); await pg.wait_for_timeout(400)
    check('rename through the server', await pg.evaluate("[profile.name,$('modal').hidden]") == ['Тэмүүжин2', True])
    await pg.click('#shop'); await pg.click('[data-theme="2"]'); await pg.wait_for_timeout(400)
    check('theme bought through the server', await pg.evaluate("[profile.theme,profile.coins]") == [2, 180])
    await pg.click('#shopDone')
    net['down'] = True
    await pg.evaluate("Cloud.state='offline';netView()")
    await pg.click('#ranked'); await pg.click('#rkFind'); await pg.wait_for_timeout(1500)
    check('Rank with the server down: told so, bot offered', await pg.evaluate("$('modal').textContent.includes(t('rankNoNet'))&&!!$('rkBot')"))
    await pg.click('#rkBot'); await pg.wait_for_timeout(200)
    await pg.evaluate("finishRound(boards[1])"); await wait(pg, "state==='result'", 6000); await pg.wait_for_timeout(1500)
    check('offline result waits in the outbox', await pg.evaluate("[outbox.length,JSON.parse(localStorage.getItem('neon-duel-outbox')).length]") == [1, 1])
    net['down'] = False
    await pg.evaluate("sync(true)"); await wait(pg, "Cloud.state==='online'&&outbox.length===0", 6000)
    check('outbox sent on reconnect (ranked bot win counted)', await pg.evaluate("profile.wins") == 5)
    await pg.click('#home')
    await pg.click('.pcard'); await pg.wait_for_timeout(300)
    await pg.evaluate("Cloud.session.user.anon=true;stats()")
    await pg.fill('#aUser', 'a@b.mn'); await pg.fill('#aPw', 'wrong'); await pg.click('#signInAcc'); await pg.wait_for_timeout(400)
    check('wrong password is refused', await pg.evaluate("$('aMsg').textContent===t('accBadCloud')"))
    await pg.fill('#aPw', 'secret12'); await pg.click('#signInAcc'); await pg.wait_for_timeout(800)
    check('sign in to another account', await pg.evaluate("[profile.name,profile.rank,profile.wins]") == ['Хаан', 1300, 20])
    await pg.click('#statsDone')
    await pg.click('#settings'); await pg.click('#delete'); await pg.click('#yesDelete'); await pg.wait_for_timeout(900)
    check('delete removes the server account', any(c[0].endswith('delete_my_account') for c in calls) and await pg.evaluate("[profile.rank,profile.wins]") == [1000, 0])
    await ctx.close()


# ====================================================================== controls (DAS, ARR, soft drop, touch, layout)
STEP = "(n)=>{for(let i=0;i<n;i++)step(1/60);const p=boards[0].piece;return [p.x,p.y]}"    # n game ticks of 1/60 s
FRESH = "(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);b.garbage=[];place(b,2);b.time=0;b.fall=0;releaseAll();return [b.piece.x,b.piece.y]})()"
FLICK = """(()=>{const el=$('board'),s=parseFloat($('world').style.transform.slice(6)),r=$('world').getBoundingClientRect();
  const P=(type,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:r.left+140*s,clientY:r.top+y*s}));
  P('pointerdown',300);P('pointermove',380);P('pointermove',460);P('pointermove',620);P('pointerup',620);
  return [boards[0].cells.flat().filter(v=>v).length,boards[0].piece.y]})()"""
SLIDE = """(()=>{const el=$('board'),s=parseFloat($('world').style.transform.slice(6)),r=$('world').getBoundingClientRect(),x0=boards[0].piece.x;
  const P=(type,x)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:8,pointerType:'touch',isPrimary:true,clientX:r.left+x*s,clientY:r.top+300*s}));
  P('pointerdown',60);for(let x=70;x<=143;x+=8)P('pointermove',x);P('pointermove',143);P('pointerup',143);return boards[0].piece.x-x0})()"""


async def controls(br):
    print('controls', flush=True)
    bad = {'das': 'fast', 'arr': -5, 'sdf': 7, 'sens': 'x', 'flick': 'no', 'buttons': 0, 'mirror': 1, 'size': 'huge'}
    ctx, pg = await new_page(br)                       # no init script: this test reloads the page and must keep what it saved
    await pg.goto('file://' + PAGE)
    await pg.evaluate("localStorage.setItem('neon-duel',%s)" % json.dumps(json.dumps({'name': 'Тест', 'ctl': bad})))
    await pg.reload()
    r = await pg.evaluate("profile.ctl")
    check('invalid saved control settings fall back to the defaults', r == {'das': 170, 'arr': 50, 'sdf': 20, 'sens': 'normal', 'flick': True,
                                                                            'buttons': True, 'mirror': False, 'size': 'normal'}, r)
    r = await pg.evaluate("ctlClean({das:120,arr:0,sdf:0,sens:'high',mirror:true,size:'large',buttons:false,flick:false,extra:1})")
    check('valid control settings are kept, unknown keys dropped', r == {'das': 120, 'arr': 0, 'sdf': 0, 'sens': 'high', 'flick': False,
                                                                        'buttons': False, 'mirror': True, 'size': 'large'}, r)
    check('existing players keep the button layout and gestures', await pg.evaluate(
        "!$('controls').hidden&&!$('controls').classList.contains('mirror')&&!$('controls').classList.contains('big')&&G.step===26&&G.row===28&&$('hint').dataset.t==='hint'"))
    # the game clock is driven by hand from here: no animation frames, gravity and the AI stopped
    await pg.evaluate("profile.fmt='single';startPractice()")
    await pg.evaluate(FREEZE + ";cancelAnimationFrame(raf);raf=0")
    # --- held on-screen button: DAS 170 ms, then ARR 50 ms
    x0, _ = await pg.evaluate(FRESH)
    box = await pg.locator('#controls button[data-action="right"]').bounding_box()
    await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    await pg.mouse.down()
    xs = [await pg.evaluate("boards[0].piece.x")]
    for n in (9, 2, 2, 1, 3, 6):                       # ticks: 150 ms, 183, 217, 233, 283, 383
        xs.append((await pg.evaluate(STEP, n))[0])
    check('held button: one step, DAS 170 ms, then one step per 50 ms up to the wall', [x - x0 for x in xs] == [1, 1, 2, 2, 3, 4, 4], [x - x0 for x in xs])
    await pg.mouse.up()
    check('releasing the button stops the repeat', await pg.evaluate("!anyHeld()&&heldAction===''"))
    x0, _ = await pg.evaluate(FRESH)
    check('no movement after release', (await pg.evaluate(STEP, 30))[0] == x0)
    # --- keyboard: own repeat, the OS key repeat is ignored; ARR 0 goes straight to the wall
    await pg.evaluate("profile.ctl.das=100;profile.ctl.arr=0")
    x0, _ = await pg.evaluate(FRESH)
    await pg.keyboard.down('ArrowLeft')
    a = await pg.evaluate("boards[0].piece.x")
    for _ in range(4):
        await pg.keyboard.down('ArrowLeft')            # Playwright sends these with repeat=true, like an OS key repeat
    b = await pg.evaluate("boards[0].piece.x")
    c = (await pg.evaluate(STEP, 5))[0]                 # 83 ms < DAS
    d = (await pg.evaluate(STEP, 2))[0]                 # 117 ms: DAS charged, ARR 0
    await pg.keyboard.up('ArrowLeft')
    check('keyboard: one step per press, OS repeats ignored, DAS 100 ms then ARR 0 to the wall', [x0 - a, x0 - b, x0 - c, d] == [1, 1, 1, 0], [x0, a, b, c, d])
    await pg.evaluate("profile.ctl.das=170;profile.ctl.arr=50")
    x0, _ = await pg.evaluate(FRESH)
    await pg.keyboard.down('ArrowRight')
    await pg.evaluate(STEP, 12)                         # right is charged (+2)
    await pg.mouse.move(*(lambda bb: (bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2))(await pg.locator('#controls button[data-action="left"]').bounding_box()))
    await pg.mouse.down()                               # the newer direction wins at once
    e = await pg.evaluate("boards[0].piece.x")
    await pg.mouse.up()                                 # back to the held key, which charges its DAS again
    f = (await pg.evaluate(STEP, 9))[0]
    g = (await pg.evaluate(STEP, 3))[0]
    await pg.keyboard.up('ArrowRight')
    check('newest direction wins; letting go hands back to the key, DAS again', [e - x0, f - x0, g - x0] == [1, 1, 2], [x0, e, f, g])
    # --- soft drop: one row at once, then factor x gravity (0.8 s per row at the start), never locks
    soft = []
    for sdf, key in ((20, 'button'), (5, 'button'), (10, 'key'), (0, 'button')):
        await pg.evaluate("window.MABLE_PARAMS.fallSeconds=0.8;profile.ctl.sdf=%d" % sdf)
        _, y0 = await pg.evaluate(FRESH)
        if key == 'key':
            await pg.keyboard.down('ArrowDown')
        else:
            bb = await pg.locator('#controls button[data-action="soft"]').bounding_box()
            await pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            await pg.mouse.down()
        y = (await pg.evaluate(STEP, 18))[1] - y0       # 0.3 s
        locked = await pg.evaluate("boards[0].cells.flat().filter(v=>v).length")
        await (pg.keyboard.up('ArrowDown') if key == 'key' else pg.mouse.up())
        soft.append([y, locked])
    check('soft drop speeds: x20, x5, x10 (keyboard), instant to the floor; no lock', soft == [[8, 0], [2, 0], [4, 0], [18, 0]], soft)
    await pg.evaluate("window.MABLE_PARAMS.fallSeconds=1000;profile.ctl.sdf=20")
    # --- touch sensitivity and the flick switch
    sl = []
    for sens in ('normal', 'high', 'low'):
        await pg.evaluate("profile.ctl.sens='%s';applyControls()" % sens)
        await pg.evaluate(FRESH)
        sl.append(await pg.evaluate(SLIDE))
    check('touch sensitivity: the same 83 px slide moves 3 / 4 / 2 columns', sl == [3, 4, 2], sl)
    await pg.evaluate("profile.ctl.sens='normal';profile.ctl.flick=false;applyControls()")
    await pg.evaluate(FRESH)
    r = await pg.evaluate(FLICK)
    check('flick drop switched off: a fast swipe only moves the piece down', r[0] == 0 and r[1] > 5, r)
    await pg.evaluate("profile.ctl.flick=true;applyControls()")
    await pg.evaluate(FRESH)
    check('flick drop on again', (await pg.evaluate(FLICK))[0] == 4)
    await pg.evaluate("raf=requestAnimationFrame(frame);leaveMatch()")
    # --- the dialog: changes apply at once, are saved and survive a reload
    await pg.click('#settings'); await pg.click('#ctlBtn')
    check('controls dialog opens from settings', await pg.evaluate("!!$('dasIn')&&!!$('arrIn')"))
    await pg.fill('#dasIn', '120'); await pg.fill('#arrIn', '0')
    check('sliders show their value', await pg.evaluate("[$('dasVal').textContent,$('arrVal').textContent.startsWith('0')]") == ['120 ms', True])
    for sel in ('.cseg[data-key=sdf] [data-v="0"]', '.cseg[data-key=sens] [data-v=high]', '[data-tog=flick]', '[data-tog=buttons]',
                '[data-tog=mirror]', '.cseg[data-key=size] [data-v=large]'):
        await pg.click(sel)
    await pg.screenshot(path=OUT + 'controls_dialog.png')
    want = {'das': 120, 'arr': 0, 'sdf': 0, 'sens': 'high', 'flick': False, 'buttons': False, 'mirror': True, 'size': 'large'}
    check('dialog changes are saved', await pg.evaluate("JSON.parse(localStorage.getItem('neon-duel')).ctl") == want)
    check('and applied at once', await pg.evaluate("$('controls').hidden&&G.step===26*.75&&$('hint').dataset.t==='hintNoFlick'"))
    await pg.click('#ctlDone')
    check('Done goes back to settings', await pg.evaluate("!!$('ctlBtn')"))
    await pg.click('#saveProfile')
    await pg.reload()
    r = await pg.evaluate("({ctl:profile.ctl,hidden:$('controls').hidden,mirror:$('controls').classList.contains('mirror'),big:$('controls').classList.contains('big'),step:G.step,hint:$('hint').textContent===t('hintNoFlick')})")
    check('settings survive a reload and render (gesture-only, mirrored, large)', r == {'ctl': want, 'hidden': True, 'mirror': True, 'big': True, 'step': 19.5, 'hint': True}, r)
    await pg.evaluate("profile.ctl.buttons=true;save();applyControls();profile.fmt='single';startPractice()")
    await pg.wait_for_timeout(200)
    r = await pg.evaluate("""(()=>{const q=a=>document.querySelector('#controls [data-action='+a+']').getBoundingClientRect(),h=$('hint').getBoundingClientRect();
      return {mirror:q('hard').left<q('soft').left&&q('soft').left<q('left').left&&q('left').left<q('right').left,big:q('left').height,
              fits:Math.max(q('left').bottom,h.bottom)<=innerHeight,board:$('board').getBoundingClientRect().bottom<=q('left').top}})()""")
    await pg.screenshot(path=OUT + 'controls_large_mirror.png')
    check('mirrored large buttons: drops on the left, still on screen below the board', r['mirror'] and r['big'] > 65 and r['fits'] and r['board'], r)
    await pg.evaluate("pause()")
    await pg.click('#pauseCtl')
    await pg.click('#ctlReset')
    check('reset to defaults', await pg.evaluate("JSON.stringify(profile.ctl)===JSON.stringify(ctlClean())&&!$('controls').hidden&&G.step===26"))
    await pg.click('#ctlDone')
    check('controls from the pause menu return to it', await pg.evaluate("state==='pause'&&!!$('resume')"))
    await pg.click('#resume')
    await pg.evaluate("leaveMatch()")
    r = await pg.evaluate("profile.ctl.das=90;save();profile=freshProfile({ctl:profile.ctl});profile.ctl.das")
    check('control settings are kept when the profile is reset', r == 90)
    await ctx.close()


# ====================================================================== friends (rooms by code; UI and error paths)
async def friends(br):
    print('friends', flush=True)
    # without a server: the Rank dialog offers friend play and says it needs the online service
    ctx, pg = await new_page(br)
    await pg.goto('file://' + PAGE)
    await pg.click('#ranked')
    check('offline Rank dialog has a friend option', await pg.evaluate("!!$('rkBot')&&!!$('rkFriend')"))
    await pg.click('#rkFriend')
    check('friend play without a server: needs the online service', await pg.evaluate("$('modal').textContent.includes(t('friendNeedsOnline'))"))
    r = await pg.evaluate("[cleanCode(' k7p-2qx '),cleanCode('К7Р2QХ'),cleanCode('abcdefgh'),cleanCode('a.b/c')]")
    check('typed codes are forgiving (case, spaces, dashes, Cyrillic look-alikes)', r == ['K7P2QX', 'K7P2QX', 'ABCDEF', 'ABC'], r)
    FRIEND_RESULT = """(()=>{closeModal();series=newSeries('friend',1,{matchId:'m1',seed:5,game:1});rival='<b>Бат</b>';
      boards=[makeBoard(1),makeBoard(1)];spawn(boards[0]);spawn(boards[1]);state='over';finishMatch(true)})()"""
    before = await pg.evaluate("[profile.rank,profile.wins,profile.losses,profile.coins]")
    await pg.evaluate(FRIEND_RESULT)
    r = await pg.evaluate("({eb:$('resultEyebrow').textContent.startsWith(t('friendTag')),rp:$('resultStats').firstElementChild.textContent.includes(t('friendNoRp')),"
                          "p:[profile.rank,profile.wins,profile.losses,profile.coins],out:outbox.length})")
    check('friendly result: says so, no RP or coins, nothing changed or queued', r == {'eb': True, 'rp': True, 'p': before, 'out': 0}, r)
    await pg.click('#rematch')
    check('rematch without a server goes to the friend dialog', await pg.evaluate("state==='title'&&$('modal').textContent.includes(t('friendNeedsOnline'))"))
    await ctx.close()

    # with a (fake) server
    src = open(PAGE, encoding='utf-8').read()
    test_page = OUT + 'friends_test.html'
    open(test_page, 'w', encoding='utf-8').write(src.replace('{"supabaseUrl":"","supabaseAnonKey":""}',
                                                            '{"supabaseUrl":"https://test.supabase.co","supabaseAnonKey":"anon-key"}'))
    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
    fake = {'down': False, 'room': 'wait', 'rematch': 'wait', 'calls': []}
    me = {'id': 'f1', 'username': 'Анар', 'avatar': '👑', 'rating': 1100, 'wins': 3, 'losses': 2, 'coins': 70, 'theme': 0, 'owned': [0],
          'streak': 0, 'last_claim': None, 'imported': True}
    join_err = {'K7P2QX': 'own_room', 'BADBAD': 'room_not_found', 'TAKEN2': 'room_taken', 'OLD234': 'room_expired'}

    async def handle(route):
        req = route.request
        if req.method == 'OPTIONS':
            return await route.fulfill(status=204, headers=cors)
        if fake['down']:
            return await route.abort()
        path = req.url.split('supabase.co', 1)[1]
        body = json.loads(req.post_data) if req.post_data else {}
        ok = lambda d, st=200: route.fulfill(status=st, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
        if path.startswith('/auth/v1/signup'):
            return await ok({'access_token': 'tok-f1', 'refresh_token': 'r', 'expires_in': 3600, 'user': {'id': 'f1', 'is_anonymous': True}})
        fn = path.split('/rpc/')[1] if '/rpc/' in path else path
        fake['calls'].append((fn, body))
        if fn == 'get_my_profile':
            return await ok(me)
        if fn == 'create_room':
            now = datetime.datetime.now(datetime.timezone.utc)
            return await ok({'code': 'K7P2QX', 'format': body['p_format'], 'status': 'open', 'created_at': now.isoformat(),
                             'expires_at': (now + datetime.timedelta(minutes=10)).isoformat()})
        if fn == 'room_status':
            return await (ok({'message': 'room_expired'}, 400) if fake['room'] == 'expired' else ok({'id': None}))
        if fn == 'join_room':
            return await ok({'message': join_err.get(body['p_code'], 'room_not_found')}, 400)
        if fn == 'rematch_room':
            return await (ok({'message': 'room_expired'}, 400) if fake['rematch'] == 'gone' else ok({'id': None}))
        if fn == 'cancel_room':
            return await route.fulfill(status=204, headers=cors)
        return await ok({'message': 'unknown ' + path}, 404)

    ctx, pg = await new_page(br, store={'name': 'Анар', 'fmt': 'single'}, route=handle)
    await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    await pg.goto('file://' + test_page)
    await wait(pg, "Cloud.state==='online'")
    await pg.click('#ranked')
    check('Rank opens the online menu: find a player or play a friend', await pg.evaluate("!!$('rkFind')&&!!$('rkFriend')"))
    await pg.click('#rkFriend')
    await wait(pg, "!!$('fCreate')")
    await pg.click('#fFmt')
    check('room format can be switched in the friend dialog', await pg.evaluate("profile.fmt") == 'ft3')
    await pg.click('#fCreate')
    await wait(pg, "Net.phase==='room'&&!!$('fCode')")
    check('create: big code, waiting, format sent', await pg.evaluate("$('fCode').textContent") == 'K7P2QX'
          and [c[1] for c in fake['calls'] if c[0] == 'create_room'][-1] == {'p_format': 'ft3'})
    await pg.evaluate("Object.defineProperty(navigator,'share',{configurable:true,value:d=>{window.__shared=d.text;return Promise.resolve()}})")
    await pg.click('#fShare')
    await pg.wait_for_timeout(200)
    check('share uses the system share sheet when there is one', 'K7P2QX' in (await pg.evaluate("window.__shared||''")))
    await pg.evaluate("Object.defineProperty(navigator,'share',{configurable:true,value:undefined})")
    await pg.click('#fShare')
    await pg.wait_for_timeout(300)
    r = await pg.evaluate("navigator.clipboard.readText().then(c=>[c,$('fState').textContent===t('friendCopied')])")
    check('otherwise the invite is copied', 'K7P2QX' in r[0] and r[1], r)
    await pg.screenshot(path=OUT + 'friend_code.png')
    await pg.evaluate("Net.cfg.poll=150")
    fake['down'] = True
    await wait(pg, "!!$('fAgain')", 8000)
    check('network drop while waiting: told, with a retry', await pg.evaluate("Net.phase===''&&$('modal').textContent.includes(t('friendNet'))"))
    fake['down'] = False
    await pg.click('#fAgain')
    await wait(pg, "!!$('fCreate')")
    await pg.click('#fCreate')
    await wait(pg, "Net.phase==='room'")
    fake['room'] = 'expired'
    await wait(pg, "!!$('fNew')", 4000)
    check('expired room: the creator is offered a new code', await pg.evaluate("Net.phase===''&&$('modal').textContent.includes(t('friendExpiredOwn'))"))
    fake['room'] = 'wait'
    await pg.click('#fNew')
    await wait(pg, "Net.phase==='room'")
    n = len([c for c in fake['calls'] if c[0] == 'cancel_room'])
    check('back while waiting closes the room', await pg.evaluate("window.onAndroidBack()&&Net.phase===''&&$('modal').hidden"))
    await pg.wait_for_timeout(300)
    check('cancel_room sent', len([c for c in fake['calls'] if c[0] == 'cancel_room']) == n + 1)
    await pg.evaluate("openFriend()")
    await wait(pg, "!!$('fJoin')")
    await pg.click('#fJoin')
    msgs = []
    for typed in ('abc', 'k7p 2qx', 'badbad', 'taken2', 'old-234'):
        await pg.fill('#fCodeIn', '')
        await pg.type('#fCodeIn', typed)
        await pg.click('#fJoinGo')
        await pg.wait_for_timeout(300)
        msgs.append(await pg.evaluate("[$('fCodeIn').value,$('fMsg').textContent]"))
    want = await pg.evaluate("[['ABC',t('friendCodeShort')],['K7P2QX',t('friendOwn')],['BADBAD',t('friendNotFound')],['TAKEN2',t('friendTaken')],['OLD234',t('friendExpired')]]")
    check('join errors: short code, own room, wrong code, taken, expired', msgs == want, msgs)
    fake['down'] = True
    await pg.click('#fJoinGo')
    await pg.wait_for_timeout(300)
    check('join with the network down: told so', await pg.evaluate("$('fMsg').textContent===t('friendNet')&&!$('fJoinGo').disabled"))
    fake['down'] = False
    await pg.screenshot(path=OUT + 'friend_join.png')
    await pg.evaluate(FRIEND_RESULT)
    await pg.click('#rematch')
    await wait(pg, "Net.phase==='room'&&!!$('fCancel')")
    check('rematch waits for the friend (name escaped)', await pg.evaluate("$('modal').querySelectorAll('b').length===0&&$('modal').textContent.includes('<b>Бат</b>')")
          and [c[1] for c in fake['calls'] if c[0] == 'rematch_room'][-1] == {'p_match': 'm1'})
    await pg.click('#fCancel')
    await pg.wait_for_timeout(300)
    check('rematch can be cancelled', await pg.evaluate("Net.phase===''&&$('modal').hidden") and fake['calls'][-1][0] == 'cancel_room')
    fake['rematch'] = 'gone'
    await pg.evaluate(FRIEND_RESULT)
    await pg.click('#rematch')
    await wait(pg, "!!$('fAgain')", 4000)
    check('friend gone: offered a new room', await pg.evaluate("$('modal').textContent.includes(t('rematchGone'))"))
    await ctx.close()


# ====================================================================== look (block skins, names)
# a full-ish board with every piece value (1-7) and garbage (8); cell (x, y) holds BOARD[y][x]
FULL = """(()=>{const b=boards[0],o=boards[1],rows=['..........','..........','..........','..........','..........','..........',
  '..........','..........','..........','..........','..........','.......3..','......33..','1.....3...','1.2..5555.','1222.66777',
  '14456617.7','44556617..','88888.8888','8888888.88'];b.cells=rows.map(r=>[...r].map(c=>c==='.'?0:+c));o.cells=b.cells.map(r=>r.slice());
  b.piece={id:2,r:0,m:ROT[2][0],x:3,y:2};b.hold=6;b.canHold=true;b.garbage=[];render()})()"""
# the colour 6 CSS px inside the left edge of a board cell (clear of the centre glyph)
PIXEL = "((x,y)=>[...$('board').getContext('2d').getImageData((x*28+6)*2,(y*28+14)*2,1,1).data])"
BANNED = r"tetr|тетр"


async def look(br):
    print('look', flush=True)
    import re
    ctx, pg = await new_page(br)
    await pg.goto('file://' + PAGE)
    info = await pg.evaluate("SKINS.map(k=>({id:k.id,price:k.price,style:k.style,n:k.palette.length,named:t(k.name)!==k.name&&t(k.desc)!==k.desc,painter:!!TILE_STYLES[k.style]}))")
    check('skin registry: ids 0-2 present, 7 colours each, named, known tile style',
          [k['id'] for k in info][:3] == [0, 1, 2] and all(k['n'] == 7 and k['named'] and k['painter'] for k in info) and info[0]['price'] == 0, info)
    check('unknown skin id falls back to the default', await pg.evaluate("skinById(99)===SKINS[0]&&skinById(undefined)===SKINS[0]"))
    guide = ['#4bd9ed', '#f2d86b', '#b99aff', '#75e9b5', '#ff7298', '#769cff', '#ffa66d']
    pals = await pg.evaluate("SKINS.map(k=>k.palette.map(c=>c.toLowerCase()))")
    check('no skin uses the guideline colour per piece', all(sum(a == b for a, b in zip(p, guide)) == 0 for p in pals), pals)
    await pg.evaluate("profile.owned=[0,1,2];profile.fmt='single';startPractice()")
    await pg.evaluate(FREEZE)
    for sid in [k['id'] for k in info]:
        await pg.evaluate("profile.theme=%d" % sid)
        await pg.evaluate(FULL)
        cells = await pg.evaluate("[[0,13],[2,14],[6,13],[1,16],[5,14],[5,15],[7,15],[0,18],[4,5]].map(([x,y])=>%s(x,y))" % PIXEL)
        bg = cells[-1]
        pieces = cells[:7]
        dist = lambda a, b: sum(abs(a[i] - b[i]) for i in range(3))
        distinct = all(dist(pieces[i], pieces[j]) > 40 for i in range(7) for j in range(i + 1, 7))
        apart = all(dist(c, bg) > 60 for c in cells[:8]) and all(dist(cells[7], c) > 40 for c in pieces)
        prev = await pg.evaluate("""['hold','next','rival'].map(id=>{const c=$(id),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let a=0;for(let i=3;i<d.length;i+=4)a+=d[i]>0;return a})""")
        check('skin %d: board cells drawn, 7 piece colours distinct, garbage stands out, previews drawn' % sid,
              distinct and apart and all(n > 50 for n in prev), {'cells': cells, 'previews': prev})
        await pg.evaluate("(()=>{const b=boards[0];for(let y=3;y<16;y++)b.cells[y]=b.cells[y].map((v,x)=>x===9?0:(x+y)%7+1);b.piece={id:5,r:0,m:ROT[5][0],x:0,y:0};b.queue[0]=2;render()})()")
        x = await pg.evaluate("%s(4,0)" % PIXEL.replace('(x*28+6)*2,(y*28+14)*2', '(x*28+14)*2,(y*28+14)*2'))
        check('skin %d: danger X marks stay red and readable' % sid, x[0] > 180 and x[1] < 110 and x[2] < 140, x)
    # frame cost: unchanged frames draw nothing; a lock repaints only the board layer; moving frames stay cheap
    await pg.evaluate("profile.theme=0"); await pg.evaluate(FULL)
    r = await pg.evaluate("""(()=>{const p0=layerPaints;render();render();const idle=layerPaints===p0;
      const b=boards[0];hard(b);render();const lock=layerPaints===p0+1;
      const q=$('board').getContext('2d'),N=120;let t0=performance.now();
      for(let i=0;i<N;i++){b.piece.x=3+(i&1);render();q.getImageData(0,0,1,1)}const move=(performance.now()-t0)/N;
      t0=performance.now();for(let i=0;i<N;i++){render();q.getImageData(0,0,1,1)}const still=(performance.now()-t0)/N;
      return {idle,lock,move,still}})()""")
    check('rendering: idle frames skip, a lock repaints once, a moving frame < 4 ms, an idle frame < 1 ms',
          r['idle'] and r['lock'] and r['move'] < 4 and r['still'] < 1, r)
    print('       frame cost: moving %.3f ms, idle %.3f ms' % (r['move'], r['still']), flush=True)
    await pg.evaluate("leaveMatch()")
    # shop: real rendered previews, offline buying and equipping
    await pg.evaluate("profile.owned=[0];profile.theme=0;profile.coins=150;save()")
    await pg.click('#shop'); await pg.wait_for_timeout(100)
    r = await pg.evaluate("""[...document.querySelectorAll('#modal canvas.skinprev')].map(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let a=0;for(let i=3;i<d.length;i+=4)a+=d[i]===255;return a/(d.length/4)})""")
    check('shop shows a rendered preview for every skin', len(r) == len(info) and all(v > .9 for v in r), r)
    labels = await pg.evaluate("[...document.querySelectorAll('[data-theme] small')].map(e=>e.textContent)")
    check('shop labels: selected / unlock with price', labels[0] == await pg.evaluate("t('selected')") and labels[1] == await pg.evaluate("t('unlockFor').replace('{p}',100)"), labels)
    await pg.click('[data-theme="1"]')
    check('offline: skin 1 bought and equipped', await pg.evaluate("[profile.theme,profile.coins,profile.owned.includes(1)]") == [1, 50, True])
    await pg.click('[data-theme="2"]')
    check('offline: not enough coins is refused', await pg.evaluate("[profile.theme,profile.coins,$('modal').textContent.includes(t('notEnough'))]") == [1, 50, True])
    await pg.click('#infoDone'); await pg.click('#shop'); await pg.click('[data-theme="0"]')
    check('offline: owned default skin re-equipped for free', await pg.evaluate("[profile.theme,profile.coins]") == [0, 50])
    await pg.click('[data-theme="1"]')
    check('offline: owned skin re-equipped for free', await pg.evaluate("[profile.theme,profile.coins]") == [1, 50])
    await pg.click('#shopDone')
    await ctx.close()
    for sid in (0, 1, 2):
        ctx, pg = await new_page(br, store={'owned': [0, 1, 2], 'theme': sid, 'coins': 5})
        await pg.goto('file://' + PAGE)
        await pg.evaluate("profile.fmt='single';startPractice()"); await pg.evaluate(FREEZE); await pg.wait_for_timeout(100)
        r = await pg.evaluate("[profile.theme,currentSkin().id,getComputedStyle(document.documentElement).getPropertyValue('--skin-frame').trim()===currentSkin().board.frame]")
        check('saved theme %d loads as skin %d and frames the board' % (sid, sid), r == [sid, sid, True], r)
        await ctx.close()
    ctx, pg = await new_page(br, store={'owned': [0, 7], 'theme': 7})
    await pg.goto('file://' + PAGE)
    check('an unknown saved theme falls back to the default skin', await pg.evaluate("[profile.theme,currentSkin().id]") == [0, 0])
    # names: nothing a player or store visitor sees may say Tetris / TETR.IO or the old name
    await pg.click('#shop')
    seen = await pg.evaluate("JSON.stringify(STRINGS)+$('root').outerHTML+document.title")
    vendor = await pg.evaluate("$('mable-strings')?.textContent||''")      # platform shell strings (src/vendor, not ours to edit)
    check('no Tetris / TETR.IO in translations, markup or title', not re.search(BANNED, seen + vendor, re.I), re.findall(r'.{30}(?:%s).{30}' % BANNED, seen + vendor, re.I)[:3])
    check('the old name is gone from what players see', not re.search(r'neon\s*duel', seen, re.I), re.findall(r'.{30}neon\s*duel.{30}', seen, re.I)[:3])
    brand = await pg.evaluate("t('brandName')")
    r = await pg.evaluate("[document.title,$('brandMark').textContent.trim(),t('titleName'),$('loading').textContent.trim().slice(0,t('brandName').length),document.querySelector('.logo').getAttribute('aria-label'),[...document.querySelectorAll('.logo .lgf,.logo .lgw2')].map(e=>e.textContent).join(' ').trim()]")
    check('the brand name comes from one place (brandName) everywhere in the app', r == [brand] * 5 + [brand.upper()], r)
    r = await pg.evaluate("""(()=>{const L=STRINGS[profile.lang],keep=L.brandName,out=[];
      for(const name of ['Qwmwxwmwz','Wwwwwwwww Mmmmmmmmm','Khan Blocks']){L.brandName=name;brandLogo();
        out.push([document.querySelector('.logo .lgf').getComputedTextLength()<=400,document.querySelector('.logo .lgw2').getComputedTextLength()<=220,$('brandMark').offsetWidth<=162])}
      L.brandName=keep;brandLogo();return out})()""")
    check('any one- or two-word name of up to 9 letters fits the logo and the header', all(all(x) for x in r), r)
    texts = '\n'.join(re.findall(r'```text\n(.*?)```', open(os.path.join(ROOT, 'docs/store/listing.md'), encoding='utf-8').read(), re.S))
    store = {'README.md': open(os.path.join(ROOT, 'README.md'), encoding='utf-8').read(), 'store listing texts': texts}
    for f in ['docs/privacy/index.html', 'docs/privacy/delete.html', 'android/app/src/main/AndroidManifest.xml', 'capacitor.config.json', 'package.json']:
        if os.path.exists(os.path.join(ROOT, f)):
            store[f] = open(os.path.join(ROOT, f), encoding='utf-8').read()
    for d, _, fs in os.walk(os.path.join(ROOT, 'android')):
        store.update({os.path.join(d, f): open(os.path.join(d, f), encoding='utf-8').read() for f in fs if f == 'strings.xml'})
    hits = [f for f, txt in store.items() if re.search(BANNED, txt, re.I) or (f != 'README.md' and re.search(r'neon duel', txt, re.I))]
    check('no Tetris / TETR.IO / old name in README, store texts, privacy pages, app label', not hits, hits)
    check('store app label and app name match the brand', 'android:label="%s"' % brand in store.get('android/app/src/main/AndroidManifest.xml', 'android:label="%s"' % brand)
          and '"appName": "%s"' % brand in store.get('capacitor.config.json', '"appName": "%s"' % brand))
    r = await pg.evaluate("""(()=>{stats();$('ladderBtn').click();const rows=[...document.querySelectorAll('.lb .lbrow')];
      return {n:rows.length,meanings:rows.every((r,i)=>r.querySelector('.tmean')?.textContent===t(TITLES[TITLES.length-1-i][0]+'D')),
        emblems:TITLES.every(x=>!!BADGE_EMBLEMS[x[3]])&&rows.every(r=>r.querySelector('svg g')),names:TITLES.every(x=>t(x[0])!==x[0]&&t(x[0]+'D')!==x[0]+'D')}})()""")
    check('titles: 8 ranks, each with a name, a one-line meaning and an emblem badge', r == {'n': 8, 'meanings': True, 'emblems': True, 'names': True}, r)
    await pg.evaluate("closeModal()")
    words = await pg.evaluate("JSON.stringify(STRINGS.en)")
    check('no prototype / edition wording in the app texts', not re.search(r'prototype|this edition|offline edition|simulated', words, re.I), re.findall(r'.{20}(?:prototype|edition|simulated).{20}', words, re.I))
    await ctx.close()

    # home screen: drawn backdrop, logo, floating pieces in the equipped skin, the daily streak chip
    ctx, pg = await new_page(br, store={'streak': 3, 'lastClaim': '', 'coins': 10})
    await pg.goto('file://' + PAGE); await pg.wait_for_timeout(300)
    r = await pg.evaluate("""(()=>{const lit=cv=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=16)n+=d[i]>0;return n};
      return {art:lit($('homeArt')),pieces:document.querySelectorAll('#hero canvas.hp').length,lit:[...document.querySelectorAll('#hero canvas.hp')].every(c=>lit(c)>20),
        ring:lit($('homeRing'))>100,streak:!$('streak').hidden&&$('streak').textContent.includes(t('streakN').replace('{n}',3)),ready:$('streak').classList.contains('ready'),
        ids:['language','sound','profileName','record','rank','diff','start','tutorial','settings','shop','ranked','headStatus'].every(id=>!!$(id))}})()""")
    check('home: drawn backdrop, ring, floating pieces, streak chip, all controls present',
          r['art'] > 10000 and r['pieces'] >= 5 and r['lit'] and r['ring'] and r['streak'] and r['ready'] and r['ids'], r)
    await pg.click('#streak'); await pg.wait_for_timeout(200)
    check('streak chip opens the profile with the daily reward', await pg.evaluate("!!$('claimDaily')&&document.querySelectorAll('.sdots i.on').length===3"))
    await pg.evaluate("closeModal()")
    await pg.click('#tutorial'); await pg.wait_for_timeout(100)
    r = await pg.evaluate("(()=>{const c=$('tutArt'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=16)n+=d[i]>0;return n})()")
    check('tutorial steps show a picture drawn with the skin', r > 2000, r)
    await pg.evaluate("closeModal()")
    # delete: the label says what it deletes, and Profile has it too
    await pg.click('#settings')
    check('offline: Settings offers "Delete profile"', await pg.evaluate("$('delete').textContent===t('delete')"))
    await pg.evaluate("closeModal()"); await pg.click('.pcard'); await pg.wait_for_timeout(200)
    await pg.click('#delAcc'); await pg.wait_for_timeout(100)
    check('Profile has the delete button and asks before deleting', await pg.evaluate("$('yesDelete').textContent===t('confirmDelete')&&$('modal').textContent.includes(t('deleteAsk'))"))
    await pg.click('#noDelete'); await pg.wait_for_timeout(100)
    check('cancel returns to the profile', await pg.evaluate("!!$('statsDone')"))
    await pg.evaluate("closeModal()")
    # effects: a quad bursts, flashes and sends an orb to the rival meter; the rival's attack flies to mine
    await pg.evaluate("profile.fmt='single';startPractice()"); await pg.evaluate(FREEZE)
    await pg.wait_for_timeout(150)   # let the first frame see the new game (fxFrame clears effects once per new game)
    QUAD = """(()=>{const b=boards[%d];b.cells=Array.from({length:20},emptyRow);for(let y=16;y<20;y++){b.cells[y]=Array(10).fill(5);b.cells[y][9]=0}
      b.cells[15][0]=3;b.piece={id:0,r:1,m:ROT[0][1],x:7,y:0};b.garbage=[];hard(b);return fxParts.reduce((a,p)=>(a[p.k]=(a[p.k]||0)+1,a),{})})()"""
    r = await pg.evaluate(QUAD % 0)
    check('effects: a quad gives sparks, row flashes and an attack orb', r.get('spark', 0) > 20 and r.get('row') == 4 and r.get('orb') == 1, r)
    hit = await pg.evaluate("(()=>{const o=fxParts.find(p=>p.k==='orb');return o&&o.hit.id})()")
    check('effects: the orb flies to the rival meter', hit == 'rmeter', hit)
    await pg.wait_for_timeout(700)
    r = await pg.evaluate(QUAD % 1 + ";fxParts.find(p=>p.k==='orb')?.hit.id")
    check('effects: the rival attack flies to my meter', r == 'meter', r)
    await pg.wait_for_timeout(700)
    r = await pg.evaluate("[$('threat').hidden,$('threat').textContent,$('meter').classList.contains('threat')]")
    check('incoming garbage: the meter shows the count and pulses when ready', r[0] is False and r[1].startswith('+') and r[2], r)
    await ctx.close()
    # reduced motion: no shake, no flying orbs, fewer sparks
    ctx = await br.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, reduced_motion='reduce')
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: ERRS.append('PAGEERROR ' + str(e)))
    await pg.goto('file://' + PAGE)
    await pg.evaluate("profile.fmt='single';startPractice()"); await pg.evaluate(FREEZE)
    r = await pg.evaluate(QUAD % 0 + ";[fxParts.filter(p=>p.k==='orb').length,fxParts.filter(p=>p.k==='spark').length,fxShakeT,getComputedStyle(document.querySelector('.hp')).animationName]")
    check('reduced motion: no orb, no shake, fewer sparks, home pieces still', r[0] == 0 and r[1] <= 40 and r[2] == 0 and r[3] == 'none', r)
    await ctx.close()
    # result: a bar toward the next title, and a celebration for the first title that closes when leaving
    ctx, pg = await new_page(br, store={'wins': 4, 'losses': 0, 'rank': 1160})
    await pg.goto('file://' + PAGE)
    await pg.evaluate("profile.fmt='single'"); await pg.click('#ranked'); await pg.click('#rkBot'); await pg.wait_for_timeout(100)
    await pg.evaluate("rivalRating=1200;finishRound(boards[1])"); await wait(pg, "state==='result'", 4000)
    check('result: an RP bar toward the next title', await pg.evaluate("!!document.querySelector('#rpProg .fxbar')&&!$('rpProg').hidden"))
    await wait(pg, "!!$('celebrate')", 4000)
    check('result: the first title is celebrated', await pg.evaluate("$('celebrate').textContent.includes(titleName(profile.rank))&&$('celebrate').textContent.includes(t('placedNow'))"))
    await pg.evaluate("leaveMatch()"); await wait(pg, "!$('celebrate')", 2000)
    check('the celebration closes when leaving the result', await pg.evaluate("state==='title'&&!$('celebrate')"))
    await ctx.close()


# ====================================================================== store (payments and ads, 54-native.js + 55-store.js)
# A fake of the Android app's KhanNative bridge, installed before the page loads. FAKE (in the page) drives what
# Google Play and AdMob answer; FAKE.calls records every request. The shop, result screen and settings call
# sites belong to the progression work, so these checks call the hooks directly with containers they create.
FAKE_NATIVE = r"""
window.FAKE={calls:[],billing:'ready',ads:{canRequest:true,privacyRequired:false,rewarded:true,interstitial:true,test:true},
  prices:{coins_small:'US$0.99',coins_medium:'US$1.99',coins_large:'US$4.99',remove_ads:'US$2.99',pass_s1:'US$3.99'},
  buy:'ok',rewarded:'earned',purchases:[],seq:0,shown:0,privacy:0,delay:5};
window.KhanNative={
  info(){return JSON.stringify({v:1,platform:'android',billing:FAKE.billing,ads:FAKE.ads})},
  post(json){
    const m=JSON.parse(json),a=m.args||{};FAKE.calls.push(m);
    const reply=(ok,data)=>setTimeout(()=>window.__khanNative(JSON.stringify(ok?{id:m.id,ok:true,data}:{id:m.id,ok:false,error:data})),FAKE.delay);
    const make=st=>{const p={token:'tok-'+a.sku+'-'+(++FAKE.seq)+'-abcdefgh',sku:a.sku,orderId:'GPA.'+FAKE.seq,state:st,acknowledged:false,time:Date.now(),quantity:1};FAKE.purchases.push(p);return p};
    if(m.op==='products')reply(true,{products:a.skus.filter(s=>FAKE.prices[s]).map(s=>({sku:s,price:FAKE.prices[s],micros:990000,currency:'USD'})),missing:a.skus.filter(s=>!FAKE.prices[s])});
    else if(m.op==='buy'){FAKE.account=a.account;if(FAKE.buy==='ok')reply(true,{status:'ok',purchases:[make('purchased')]});else if(FAKE.buy==='pending')reply(true,{status:'pending',purchases:[make('pending')]});else reply(true,{status:FAKE.buy})}
    else if(m.op==='purchases')reply(true,{purchases:JSON.parse(JSON.stringify(FAKE.purchases))});
    else if(m.op==='finish'){const i=FAKE.purchases.findIndex(p=>p.token===a.token);if(i<0)reply(false,'item_not_owned');else{if(a.consume)FAKE.purchases.splice(i,1);else FAKE.purchases[i].acknowledged=true;reply(true,{done:true})}}
    else if(m.op==='rewarded')reply(true,{status:FAKE.rewarded,amount:1,type:'reward'});
    else if(m.op==='interstitial'){if(FAKE.ads.interstitial)FAKE.shown++;reply(true,{status:FAKE.ads.interstitial?'shown':'unavailable'})}
    else if(m.op==='privacy'){FAKE.privacy++;reply(true,{status:'closed'})}
    else reply(false,'bad_op');
    return 'ok';
  }};
"""
SHOP_IAP = "(()=>{shop();const d=document.createElement('div');d.id='shopIap';$('adInfo').before(d);renderIapSection(d);$('shopDone').scrollIntoView({block:'end'})})()"
RESULT_AD = """(info=>{let d=$('resultAd');if(!d){d=document.createElement('div');d.id='resultAd';document.querySelector('#result .stack').before(d)}
  renderResultAd(d,info);return {hidden:d.hidden,btn:!!d.querySelector('button'),text:d.textContent}})"""


async def store_page(br, fake=True, store=None, route=None, page=None):
    ctx, pg = await new_page(br, store=store if store is not None else {'name': 'Тэмүүжин', 'coins': 100}, route=route)
    if fake:
        await pg.add_init_script(FAKE_NATIVE)
    await pg.goto('file://' + (page or PAGE))
    await pg.wait_for_timeout(150)
    return ctx, pg


async def store(br):
    print('store', flush=True)
    # ---- a plain browser: no bridge, no store, a note instead of the shop section, no ads at all
    ctx, pg = await store_page(br, fake=False)
    r = await pg.evaluate("""(()=>{const d=document.createElement('div');document.body.append(d);renderIapSection(d);
      const e=document.createElement('div');document.body.append(e);renderResultAd(e,{mode:'practice',win:true,coins:60,ref:'r1'});
      return {store:typeof window.Store,note:d.textContent.includes(t('iapBrowser')),buttons:d.querySelectorAll('button').length,ad:e.hidden&&!e.innerHTML,
              end:onMatchEnd({mode:'practice',win:true,coins:60,ref:'r1'}),native:Native.has()}})()""")
    check('browser: no Store, a note in the shop, no ad buttons, no interstitials', r == {'store': 'undefined', 'note': True, 'buttons': 0, 'ad': True, 'end': False, 'native': False}, r)
    await pg.evaluate(SHOP_IAP); await pg.wait_for_timeout(100)
    await pg.screenshot(path=OUT + 'store_browser_note.png')
    await ctx.close()

    # ---- the app, offline build (no Supabase): Play's answer is the proof, grants are local
    ctx, pg = await store_page(br)
    await wait(pg, "!!window.Store&&Store.ready()&&!!Store.price('coins_small')", 4000)
    r = await pg.evaluate("({ready:Store.ready(),price:Store.price('remove_ads'),has:Store.has('remove_ads'),removed:Store.adsRemoved()})")
    check('app: Store is ready with Play prices', r == {'ready': True, 'price': 'US$2.99', 'has': False, 'removed': False}, r)
    await pg.evaluate(SHOP_IAP)
    await wait(pg, "$('shopIap').textContent.includes('US$4.99')", 3000)
    r = await pg.evaluate("""(()=>{const b=[...document.querySelectorAll('#shopIap .iappack')];return {packs:b.map(x=>x.textContent),
      noads:document.querySelector('#shopIap [data-sku=remove_ads]').textContent.includes('US$2.99'),free:!!$('iapFree')&&!$('iapFree').disabled,restore:!!$('iapRestore')}})()""")
    check('shop section: coin packs with Play prices, Remove ads, free coins, restore',
          r['packs'] == ['◈ 500US$0.99', '◈ 1,200US$1.99', '◈ 3,500US$4.99'] and r['noads'] and r['free'] and r['restore'], r)
    await pg.screenshot(path=OUT + 'store_shop_mn.png')
    await pg.evaluate("profile.lang='en';translate();" + SHOP_IAP); await pg.wait_for_timeout(100)
    await pg.screenshot(path=OUT + 'store_shop_en.png')
    await pg.evaluate("profile.lang='mn';translate();" + SHOP_IAP); await pg.wait_for_timeout(100)
    # buy: ok (coins added once, then consumed), cancel, pending (added when Play confirms later)
    await pg.click('#shopIap [data-sku=coins_small]')
    await wait(pg, "profile.coins===600&&FAKE.purchases.length===0&&!!$('shopIap').querySelector('.iapmsg').textContent", 3000)
    r = await pg.evaluate("[profile.coins,JSON.parse(localStorage.getItem('neon-duel')).coins,FAKE.calls.filter(c=>c.op==='finish').map(c=>c.args.consume),$('shopIap').querySelector('.iapmsg').textContent]")
    check('buy a coin pack: +500, saved, consumed after the grant', r[:3] == [600, 600, [True]] and r[3] == (await pg.evaluate("t('iapThanksCoins').replace('{n}',500)")), r)
    await pg.evaluate("FAKE.buy='cancel'")
    r = await pg.evaluate("Store.buy('coins_medium').then(x=>[x,profile.coins])")
    check('buy cancelled: nothing changes', r == [{'ok': False, 'reason': 'cancel'}, 600], r)
    await pg.evaluate("FAKE.buy='pending'")
    r = await pg.evaluate("Store.buy('coins_medium').then(x=>[x,profile.coins,FAKE.purchases.length])")
    check('pending payment: nothing granted yet, the purchase waits', r == [{'ok': False, 'reason': 'pending'}, 600, 1], r)
    await pg.evaluate("FAKE.purchases[0].state='purchased';__khanNative(JSON.stringify({event:'purchases',data:{purchases:[FAKE.purchases[0]]}}))")
    await wait(pg, "profile.coins===1800&&FAKE.purchases.length===0", 3000)
    check('the pending payment goes through later: +1200 and consumed', True)
    await pg.evaluate("FAKE.buy='ok'")
    r = await pg.evaluate("Store.buy('remove_ads').then(x=>[x,Store.has('remove_ads'),Store.adsRemoved(),FAKE.purchases.map(p=>[p.sku,p.acknowledged])])")
    check('buy Remove ads: owned, acknowledged', r == [{'ok': True}, True, True, [['remove_ads', True]]], r)
    await pg.evaluate("window.__changes=0;Store.onChange(()=>__changes++);0")   # (an expression that ends in a function would be called)
    r = await pg.evaluate("Store.buy('remove_ads').then(x=>x)")
    check('buying an owned item again is a no-op', r == {'ok': True, 'reason': 'owned'}, r)
    await pg.evaluate(SHOP_IAP); await pg.wait_for_timeout(50)
    check('the shop shows Remove ads as owned', await pg.evaluate("!!document.querySelector('#shopIap .iapowned')&&!document.querySelector('#shopIap [data-sku=remove_ads]')"))
    # restore: lost local state comes back from Play; a refund (gone from Play's list) takes it away
    await pg.evaluate("payState.local={};paySave()")
    check('without local state the item is not owned', await pg.evaluate("Store.has('remove_ads')") is False)
    await pg.click('#iapRestore')
    await wait(pg, "Store.has('remove_ads')&&document.querySelector('#shopIap .iapmsg').textContent===t('iapRestored')", 3000)
    check('restore purchases brings it back (and tells the listeners)', await pg.evaluate("__changes>0"))
    await pg.evaluate("FAKE.purchases=[]")
    r = await pg.evaluate("Store.restore().then(()=>Store.has('remove_ads'))")
    check('offline build: a refunded item is removed on restore', r is False, r)
    # Play has no products for this country: the section says so instead of offering them
    await pg.evaluate("for(const k in payPrices)delete payPrices[k];['coins_small','coins_medium','coins_large','remove_ads'].forEach(s=>payMissing.add(s));" + SHOP_IAP)
    r = await pg.evaluate("[$('shopIap').textContent.includes(t('iapNoProducts')),[...document.querySelectorAll('#shopIap [data-sku]')].every(b=>b.disabled)]")
    check('no products for this Play country: told so, buttons off', r == [True, True], r)
    await pg.evaluate("payMissing.clear();loadProducts(PAY_SKUS)")
    # rewarded: free coins, 5 a day; an ad closed early gives nothing
    await pg.evaluate(SHOP_IAP); await wait(pg, "!!$('iapFree')&&!$('iapFree').disabled", 2000)
    c0 = await pg.evaluate("profile.coins")
    for i in range(5):
        await wait(pg, "!!$('iapFree')&&!$('iapFree').disabled", 2000)
        await pg.click('#iapFree')
        await wait(pg, "profile.coins===%d" % (c0 + 30 * (i + 1)), 2000)
    r = await pg.evaluate("[profile.coins-%d,$('iapFree').disabled,adsLeft('free_coins'),FAKE.calls.filter(c=>c.op==='rewarded').map(c=>c.args.placement).length]" % c0)
    check('free coins: +30 per ad, 5 a day, then the button is off', r == [150, True, 0, 5], r)
    r = await pg.evaluate("watchRewarded('free_coins','x-1').then(x=>x.reason)")
    check('a sixth free-coins ad is refused before any ad shows', r == 'daily_limit' and await pg.evaluate("FAKE.calls.filter(c=>c.op==='rewarded').length") == 5, r)
    await pg.evaluate("payState.day='2000-01-01';paySave();FAKE.rewarded='closed'")
    r = await pg.evaluate("(async()=>{const c=profile.coins,x=await watchRewarded('free_coins','x-2');return [x.reason,profile.coins-c,adsLeft('free_coins')]})()")
    check('a new day resets the cap; an ad closed early gives nothing', r == ['no_reward', 0, 5], r)
    await pg.evaluate("FAKE.rewarded='earned';closeModal()")
    # double coins on the result screen: once per match ref, practice and bot only
    await pg.evaluate("profile.fmt='single';startPractice()"); await pg.evaluate(FREEZE)
    await pg.evaluate("finishRound(boards[1])"); await wait(pg, "state==='result'", 4000)
    info = {'mode': 'practice', 'win': True, 'coins': 60, 'ref': 'match-1'}
    r = await pg.evaluate(RESULT_AD, info)
    check('result: a "double your coins" button', r['btn'] and not r['hidden'] and '+60' in r['text'], r)
    await pg.screenshot(path=OUT + 'store_result_mn.png')
    c0 = await pg.evaluate("profile.coins")
    await pg.click('#resultAd button')
    await wait(pg, "profile.coins===%d" % (c0 + 60), 2000)
    r = await pg.evaluate(RESULT_AD, info)
    check('double coins: +60 once, then the button is gone for that match', not r['btn'] and not r['hidden'] and '+60' in r['text'], r)
    r = await pg.evaluate("grantReward('double_coins','match-2',999).then(x=>x.granted)")
    check('double coins never more than 150', r == 150, r)
    r = await pg.evaluate("""[%s({mode:'online',win:true,coins:60,ref:'o1'}),%s({mode:'friend',win:true,coins:0,ref:'f1'}),%s({mode:'bot',win:false,coins:0,ref:'b1'})].map(x=>x.hidden&&!x.btn)""" % (RESULT_AD, RESULT_AD, RESULT_AD))
    check('no result ad in online or friend matches, or without coins', r == [True, True, True], r)
    r = await pg.evaluate(RESULT_AD, {'mode': 'bot', 'win': True, 'coins': 150, 'ref': 'match-3'})
    await pg.evaluate("profile.lang='en';translate()")
    await pg.evaluate(RESULT_AD, {'mode': 'bot', 'win': True, 'coins': 150, 'ref': 'match-3'})
    await pg.screenshot(path=OUT + 'store_result_en.png')
    await pg.evaluate("profile.lang='mn';translate();leaveMatch()")
    await ctx.close()

    # ---- interstitial pacing
    ctx, pg = await store_page(br, store={'name': 'Тоглогч', 'coins': 0})
    await wait(pg, "!!window.Store&&Store.ready()", 3000)
    await pg.evaluate("AD_RULES.delayMs=20;payState.first=Date.now()-2*864e5;state='result'")
    END = "(m=>onMatchEnd({mode:m,win:true,coins:60,ref:'p'+Math.random()}))"
    r = await pg.evaluate("[%s('online'),%s('friend'),payState.matches]" % (END, END))
    check('interstitials: never after online or friend matches (not even counted)', r == [False, False, 0], r)
    r = await pg.evaluate("[1,2,3,4,5].map(()=>%s('practice'))" % END)
    check('interstitials: none in the first 5 matches', r == [False] * 5, r)
    r = await pg.evaluate("%s('bot')" % END)
    await wait(pg, "FAKE.shown===1", 2000)
    check('the 6th match shows one, at the result screen', r is True and await pg.evaluate("[payState.since,Date.now()-payState.lastAd<5000]") == [0, True])
    r = await pg.evaluate("[%s('practice'),%s('practice'),%s('practice')]" % (END, END, END))
    check('then at most one per 3 matches, and not within 3 minutes', r == [False, False, False], r)
    await pg.evaluate("payState.lastAd-=181e3")
    r = await pg.evaluate("%s('practice')" % END)
    await wait(pg, "FAKE.shown===2", 2000)
    check('3 matches and 3 minutes later: the next one', r is True)
    await pg.evaluate("payState.lastAd-=181e3;payState.since=3")
    await pg.evaluate("watchRewarded('free_coins','r-1')"); await wait(pg, "!adBusy", 2000)
    r = await pg.evaluate("%s('practice')" % END)
    check('never right after a rewarded ad', r is False and await pg.evaluate("FAKE.shown") == 2, r)
    await pg.evaluate("payState.lastReward-=181e3;payState.first=Date.now()")
    check('never on the first day', await pg.evaluate("%s('practice')" % END) is False)
    await pg.evaluate("payState.first-=2*864e5;state='title'")
    r = await pg.evaluate("%s('practice')" % END)
    await pg.wait_for_timeout(200)
    check('not shown if the player already left the result screen', r is True and await pg.evaluate("FAKE.shown") == 2, r)
    await pg.evaluate("state='result';payState.since=3;payState.lastAd=0")
    await pg.evaluate("Store.buy('remove_ads')"); await wait(pg, "Store.adsRemoved()", 2000)
    check('Remove ads: no interstitials', await pg.evaluate("[%s('practice'),interstitialDue()]" % END) == [False, False])
    await pg.evaluate("payState.local={};payState.paid=false;FAKE.purchases=[];payState.since=3")
    check('(without it they would be due again)', await pg.evaluate("interstitialDue()") is True)
    await pg.evaluate("Store.buy('coins_small')"); await wait(pg, "payState.paid", 2000)
    check('any purchase: no interstitials', await pg.evaluate("[%s('practice'),interstitialDue()]" % END) == [False, False])
    # settings: the privacy and ad choices entry only when consent rules need it
    await pg.click('#settings')
    check('settings: no ad-privacy entry when not required', await pg.evaluate("!$('adPrivacy')"))
    await pg.evaluate("closeModal();FAKE.ads.privacyRequired=true;__khanNative(JSON.stringify({event:'state',data:{ads:FAKE.ads}}))")
    await pg.click('#settings'); await pg.wait_for_timeout(50)
    r = await pg.evaluate("[!!$('adPrivacy'),$('privacy').nextElementSibling.contains($('adPrivacy')),$('adPrivacy').textContent===t('adPrivacy')]")
    check('settings: "Privacy and ad choices" right after Privacy when required', r == [True, True, True], r)
    await pg.screenshot(path=OUT + 'store_settings_privacy_mn.png')
    await pg.click('#adPrivacy'); await wait(pg, "FAKE.privacy===1", 2000)
    check('it opens the consent form in the app', True)
    await pg.evaluate("closeModal();profile.lang='en';translate()"); await pg.click('#settings'); await pg.wait_for_timeout(50)
    await pg.screenshot(path=OUT + 'store_settings_privacy_en.png')
    await pg.evaluate("closeModal();profile.lang='mn';translate()")
    await ctx.close()

    # ---- the app with Supabase: the server grants, its answer replaces the local state
    src = open(PAGE, encoding='utf-8').read()
    test_page = OUT + 'store_cloud_test.html'
    open(test_page, 'w', encoding='utf-8').write(src.replace('{"supabaseUrl":"","supabaseAnonKey":""}',
                                                            '{"supabaseUrl":"https://test.supabase.co","supabaseAnonKey":"anon-key"}'))
    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
    srv = {'down': False, 'calls': [], 'skus': [], 'tokens': {}, 'reject': None, 'finished': True, 'ads': {'free_coins': 0, 'double_coins': 0}}
    me = {'id': 'u1', 'username': 'Тэмүүжин', 'avatar': '👑', 'rating': 1000, 'wins': 0, 'losses': 0, 'coins': 40, 'theme': 0, 'owned': [0],
          'streak': 0, 'last_claim': None, 'imported': True}
    packs = {'coins_small': 500, 'coins_medium': 1200, 'coins_large': 3500}

    def state():
        return {'skus': sorted(srv['skus']), 'paid': bool(srv['tokens']), 'day': '2026-11-16', 'ads': dict(srv['ads']), 'limits': {'free_coins': 5, 'double_coins': 10}}

    async def handle(route):
        req = route.request
        if req.method == 'OPTIONS':
            return await route.fulfill(status=204, headers=cors)
        if srv['down']:
            return await route.abort()
        path = req.url.split('supabase.co', 1)[1].split('?')[0]
        body = json.loads(req.post_data) if req.post_data else {}
        srv['calls'].append((path, body, req.headers.get('authorization', '')))
        ok = lambda d, st=200: route.fulfill(status=st, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
        if path.startswith('/auth/v1/signup'):
            return await ok({'access_token': 'tok-u1', 'refresh_token': 'r', 'expires_in': 3600, 'user': {'id': 'u1', 'is_anonymous': True}})
        if path == '/rest/v1/rpc/get_my_profile':
            return await ok(me)
        if path == '/rest/v1/rpc/my_entitlements':
            return await ok(state())
        if path == '/rest/v1/rpc/claim_ad_reward':
            amt = 30 if body['p_placement'] == 'free_coins' else min(body['p_coins'], 150)
            me['coins'] += amt; srv['ads'][body['p_placement']] += 1
            return await ok({'status': 'granted', 'granted': amt, 'profile': me, **state()})
        if path == '/functions/v1/verify-purchase':
            if srv['reject']:
                return await ok({'ok': False, 'error': srv['reject']}, 409)
            tok, sku = body['token'], body['sku']
            status = 'already' if tok in srv['tokens'] else 'granted'
            if status == 'granted':
                srv['tokens'][tok] = sku
                if sku in packs: me['coins'] += packs[sku]
                else: srv['skus'].append(sku)
            return await ok({'ok': True, 'status': status, 'sku': sku, 'coins': packs.get(sku, 0) if status == 'granted' else 0,
                             'finished': srv['finished'], 'profile': me, **state()})
        return await ok({'message': 'unknown ' + path}, 404)

    ctx, pg = await store_page(br, store={'name': 'Тэмүүжин', 'coins': 40, 'cloudId': 'u1'}, route=handle, page=test_page)
    await wait(pg, "Cloud.state==='online'&&payCloudUid==='u1'", 6000)
    await wait(pg, "payState.server.owner==='u1'", 3000)
    check('online: entitlements come from the server for this account', any(c[0].endswith('my_entitlements') for c in srv['calls']))
    await pg.evaluate("profile.coins=99999;save()")                 # a local number the server does not agree with
    r = await pg.evaluate("Store.buy('coins_small').then(x=>[x,profile.coins,FAKE.account])")
    v = [c for c in srv['calls'] if c[0] == '/functions/v1/verify-purchase']
    check('online purchase: verified by the server with the Play token, its coins replace the local ones',
          r == [{'ok': True}, 540, 'u1'] and v and v[-1][1]['sku'] == 'coins_small' and v[-1][1]['token'].startswith('tok-coins_small') and v[-1][2] == 'Bearer tok-u1', [r, v[-1:]])
    check('the server finished it (no second consume from the app)', await pg.evaluate("FAKE.calls.filter(c=>c.op==='finish').length") == 0)
    r = await pg.evaluate("Store.buy('remove_ads').then(x=>[x,Store.has('remove_ads'),payState.server.skus,Object.keys(payState.local).length])")
    check('online Remove ads: owned because the server says so (nothing kept locally)', r == [{'ok': True}, True, ['remove_ads'], 0], r)
    srv['skus'] = []; srv['finished'] = False      # from here the app finishes purchases itself (the fake server cannot)
    await pg.evaluate("payServerSync()"); await wait(pg, "!Store.has('remove_ads')", 3000)
    check('a refund on the server removes it from the phone too', True)
    srv['reject'] = 'token_used'
    r = await pg.evaluate("Store.buy('coins_medium').then(x=>[x,profile.coins,FAKE.purchases.filter(p=>p.sku==='coins_medium').length])")
    check('server refuses the token: nothing granted, the purchase is not consumed', r == [{'ok': False, 'reason': 'token_used'}, 540, 1], r)
    srv['reject'] = None
    srv['down'] = True
    r = await pg.evaluate("FAKE.buy='ok';Store.buy('coins_large').then(x=>[x,profile.coins])")
    check('server unreachable: not granted yet, the purchase waits in Play', r == [{'ok': False, 'reason': 'offline'}, 540], r)
    srv['down'] = False
    await pg.evaluate("restorePurchases(false)")
    await wait(pg, "profile.coins===540+1200+3500", 4000)
    await wait(pg, "FAKE.purchases.length===1", 3000)
    r = await pg.evaluate("[FAKE.purchases.map(p=>p.sku),profile.coins]")
    check('back online: waiting purchases are verified, granted once and consumed', r == [['remove_ads'], 5240], r)
    await pg.evaluate("payState.lastReward=0")
    r = await pg.evaluate("watchRewarded('free_coins','free-x1').then(x=>[x,profile.coins])")
    claims = [c[1] for c in srv['calls'] if c[0].endswith('claim_ad_reward')]
    check('online rewarded ad: the server grants it', r == [{'ok': True, 'granted': 30}, 5270] and claims[-1] == {'p_placement': 'free_coins', 'p_ref': 'free-x1', 'p_coins': None}, [r, claims[-1:]])
    srv['down'] = True
    await pg.evaluate("Cloud.state='offline'")
    r = await pg.evaluate("grantReward('double_coins','m-9',60).then(x=>[x.queued,profile.coins,payState.claims.length])")
    check('rewarded ad while offline: shown at once and queued for the server', r == [True, 5330, 1], r)
    srv['down'] = False
    await pg.evaluate("Cloud.state='online';flushClaims()")
    await wait(pg, "payState.claims.length===0", 3000)
    claims = [c[1] for c in srv['calls'] if c[0].endswith('claim_ad_reward')]
    check('the queued reward reaches the server', claims[-1] == {'p_placement': 'double_coins', 'p_ref': 'm-9', 'p_coins': 60} and await pg.evaluate("profile.coins") == 5330, claims[-1:])
    await ctx.close()


async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
        for g in GROUPS:
            await globals()[g](br)
        await br.close()
    fails = [k for k, v in R.items() if not v]
    print('page errors:', ERRS or 'none')
    print('RESULT: %d checks, %d failed %s' % (len(R), len(fails), fails))
    print('screenshots:', OUT)
    sys.exit(1 if fails or ERRS else 0)


asyncio.run(main())
