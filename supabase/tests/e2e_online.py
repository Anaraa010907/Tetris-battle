"""End-to-end check of online ranked play: several browser players against the real SQL functions.

- REST: a small stand-in for Supabase Auth + PostgREST that runs the real functions through psql,
  as the `authenticated` role with the caller's id in the JWT claim (see local_stub.sql).
- Realtime: Playwright's WebSocket routing relays Phoenix `broadcast` frames between the pages
  (with latency and optional loss) and answers phx_join / heartbeat like the Realtime server does.

It does not talk to a real Supabase project. After connecting one, play a match on two phones.

Needs: Python with Playwright (and a Chromium or Chrome), psql, and a local Postgres you can use as a
superuser. Settings come from the environment:

    PGHOST (default /tmp)  PGPORT (5432)  PGUSER (postgres)   - the local server
    CHROME                                                    - browser binary (default: Playwright's Chromium)
    E2E_OUT                                                   - folder for screenshots (default: a temp folder)

    python3 supabase/tests/e2e_online.py            # everything
    python3 supabase/tests/e2e_online.py S2 S6      # the first scenario plus the named ones (S1-S8; S8: friend rooms)
"""
import asyncio, glob, json, os, random, re, subprocess, sys, tempfile
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'index.html')
ONLY = set(sys.argv[1:])
DB = 'neon_e2e'
PG = ['-h', os.environ.get('PGHOST', '/tmp'), '-p', os.environ.get('PGPORT', '5432'), '-U', os.environ.get('PGUSER', 'postgres')]
OUT = os.path.join(os.environ.get('E2E_OUT') or tempfile.mkdtemp(prefix='neon-e2e-'), '')
TEST = OUT + 'online_test.html'
os.makedirs(OUT, exist_ok=True)
open(TEST, 'w', encoding='utf-8').write(open(SRC, encoding='utf-8').read().replace(
    '{"supabaseUrl":"","supabaseAnonKey":""}', '{"supabaseUrl":"https://test.supabase.co","supabaseAnonKey":"anon-key"}'))
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
VOID = {'cancel_queue', 'delete_my_account', 'cancel_room'}
SCALAR = {'my_position'}
net = {'drop': 0.0, 'latency': 0.06, 'sent': 0, 'dropped': 0}
rpc_log = []


def psql(sql):
    r = subprocess.run(['psql', *PG, '-d', DB, '-tAq', '-v', 'ON_ERROR_STOP=1', '-c', sql], capture_output=True, text=True)
    if r.returncode != 0:
        m = re.search(r'ERROR:\s+(.*)', r.stderr)
        raise RuntimeError(m.group(1).strip() if m else r.stderr.strip())
    lines = [l for l in r.stdout.split('\n') if l.strip()]
    return lines[-1] if lines else ''


def lit(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(v)
    if isinstance(v, list): return "'{" + ','.join(str(int(x)) for x in v) + "}'"
    if isinstance(v, dict): return "'" + json.dumps(v).replace("'", "''") + "'"
    return "'" + str(v).replace("'", "''") + "'"


def rpc(uid, fn, args):
    call = 'public.%s(%s)' % (fn, ', '.join('%s => %s' % (k, lit(v)) for k, v in args.items()))
    body = ('select %s;' % call) if fn in VOID else ("select coalesce(to_json(%s)::text,'null');" % call) if fn in SCALAR \
        else ("select coalesce(to_json(r)::text,'null') from %s r;" % call)
    out = psql("set role authenticated; select set_config('request.jwt.claim.sub','%s',false); %s" % (uid, body))
    return None if fn in VOID else json.loads(out)


async def rest(route):
    req = route.request
    if req.method == 'OPTIONS':
        return await route.fulfill(status=204, headers=CORS)
    path = req.url.split('supabase.co', 1)[1]
    body = json.loads(req.post_data) if req.post_data else {}
    auth = req.headers.get('authorization', '')
    uid = auth[len('Bearer tok-'):] if auth.startswith('Bearer tok-') else None

    def ok(data, status=200):
        return route.fulfill(status=status, headers={**CORS, 'Content-Type': 'application/json'}, body=json.dumps(data))

    try:
        if path.startswith('/auth/v1/signup'):
            meta = json.dumps(body.get('data', {})).replace("'", "''")
            u = psql("insert into auth.users (raw_user_meta_data, is_anonymous) values ('%s', true) returning id" % meta)
            return await ok({'access_token': 'tok-' + u, 'refresh_token': 'ref-' + u, 'expires_in': 3600, 'user': {'id': u, 'email': '', 'is_anonymous': True}})
        if path.startswith('/rest/v1/profiles'):
            pid = re.search(r'id=eq\.([0-9a-f-]+)', path).group(1)
            return await ok(json.loads(psql("select coalesce(json_agg(t),'[]') from (select username,avatar,rating,wins,losses from profiles where id='%s') t" % pid)))
        if '/rpc/' in path:
            fn = path.split('/rpc/')[1].split('?')[0]
            if not uid:
                return await ok({'message': 'not_signed_in'}, 401)
            rpc_log.append((uid[:4], fn, body))
            return await ok(rpc(uid, fn, body))
        return await ok({'message': 'unknown ' + path}, 404)
    except RuntimeError as e:
        return await ok({'code': 'P0001', 'message': str(e)}, 400)


topics = {}


def ws_handler(deaf=False):
    def handler(ws):
        def on_message(msg):
            m = json.loads(msg)
            if m['event'] == 'phx_join':
                if deaf: return                                   # a Realtime server that never answers
                topics.setdefault(m['topic'], set()).add(ws)
                ws.send(json.dumps({'topic': m['topic'], 'event': 'phx_reply', 'ref': m['ref'], 'join_ref': m.get('join_ref'),
                                    'payload': {'status': 'ok', 'response': {'postgres_changes': []}}}))
            elif m['event'] == 'heartbeat':
                ws.send(json.dumps({'topic': 'phoenix', 'event': 'phx_reply', 'ref': m['ref'], 'payload': {'status': 'ok', 'response': {}}}))
            elif m['event'] == 'broadcast':
                assert m['payload']['type'] == 'broadcast' and m.get('join_ref') and m.get('ref')
                for other in list(topics.get(m['topic'], ())):
                    if other is ws: continue
                    net['sent'] += 1
                    if random.random() < net['drop']:
                        net['dropped'] += 1
                        continue
                    data = json.dumps({'topic': m['topic'], 'event': 'broadcast', 'payload': {**m['payload'], 'meta': {'id': 'x'}}})
                    asyncio.get_event_loop().call_later(net['latency'], lambda o=other, d=data: safe_send(o, d))
        ws.on_message(on_message)
        ws.on_close(lambda *a: [t.discard(ws) for t in topics.values()])
    return handler


def safe_send(ws, data):
    try: ws.send(data)
    except Exception: pass


class Player:
    def __init__(self, name): self.name = name; self.errs = []

    async def start(self, browser, deaf=False):
        self.ctx = await browser.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2)
        await self.ctx.route('https://test.supabase.co/**', rest)
        await self.ctx.route_web_socket(re.compile(r'wss://test\.supabase\.co/.*'), ws_handler(deaf))
        self.pg = await self.ctx.new_page()
        self.pg.on('pageerror', lambda e: self.errs.append('%s PAGEERROR %s' % (self.name, e)))
        await self.pg.goto('file://' + TEST)
        await self.pg.evaluate("localStorage.setItem('neon-duel',JSON.stringify({name:%s,fmt:'single'}))" % json.dumps(self.name))
        await self.pg.reload()
        await self.wait("Cloud.state==='online'", 8000)
        await self.js("Cloud.rpc('set_profile',{p_username:%s,p_avatar:null,p_theme:null}).then(applyServer)" % json.dumps(self.name))
        self.uid = await self.js("Cloud.session.user.id")
        return self

    async def js(self, code): return await self.pg.evaluate(code)
    async def wait(self, cond, timeout=12000):
        # the page's CSP forbids eval-based polling inside the page, so poll from here
        end = asyncio.get_event_loop().time() + timeout / 1000
        while True:
            if await self.pg.evaluate(cond): return
            if asyncio.get_event_loop().time() > end:
                raise TimeoutError('%s: timed out waiting for %s (phase=%s state=%s)' % (self.name, cond, await self.pg.evaluate('Net.phase'), await self.pg.evaluate('state')))
            await asyncio.sleep(0.1)
    async def shot(self, name): await self.pg.screenshot(path=OUT + name)


AI = """(n)=>{for(let i=0;i<n&&state==='play';i++){const b=boards[0],p=b.piece,pend=pendingRows(b,false);let best=-1e9,tg=null;
  placements(b.cells,p.id,p.y,(m,r,x,y)=>{const s=evalPlace(b.cells,m,x,y,1,pend).s;if(s>best){best=s;tg={m,r,x,y}}});
  if(!tg)break;Object.assign(p,tg);b.lastRot=false;lock(b)}return boards[0].pieces}"""
TOPOUT = "(()=>{const b=boards[0];b.garbage=[{rows:22,hole:3,delay:0}];place(b,1);hard(b);if(state==='play')hard(b);if(state==='play')hard(b);return state})()"
R = {}


def check(name, ok, info=''):
    R[name] = 'ok' if ok else 'FAILED ' + str(info)
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else '  -> ' + str(info)), flush=True)


async def pair(a, b, fmt='single'):
    for p in (a, b):
        await p.js("profile.fmt='%s';save();if(state==='result')leaveMatch();openRank()" % fmt)
        await asyncio.sleep(0.4)
    for p in (a, b):
        await p.wait("Net.phase==='live'&&state==='play'", 20000)


async def main():
    # a fresh database with the Supabase stand-in and every migration, in order
    admin = ['psql', *PG, '-q', '-v', 'ON_ERROR_STOP=1']
    subprocess.run(admin + ['-d', 'postgres', '-c', 'drop database if exists %s' % DB, '-c', 'create database %s' % DB], check=True)
    for f in [os.path.join(HERE, 'local_stub.sql')] + sorted(glob.glob(os.path.join(HERE, '..', 'migrations', '*.sql'))):
        subprocess.run(admin + ['-d', DB, '-f', f], check=True, stderr=subprocess.DEVNULL)
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
        A = await Player('Бат').start(br)
        B = await Player('Сараа').start(br)

        # ---------------------------------------------------------------- S1: search, handshake, live sync, result
        print('S1 single game', flush=True)
        await A.pg.click('#ranked')
        await A.pg.click('#rkFind')                     # Rank opens a small menu: find a player / play a friend
        await A.wait("Net.phase==='search'")
        await asyncio.sleep(1.2)
        await A.shot('o_search.png')
        check('A waits alone in the queue', psql("select count(*) from match_queue") == '1')
        await B.pg.click('#ranked')
        await B.pg.click('#rkFind')
        await B.wait("Net.phase==='handshake'||Net.phase==='countdown'")
        await A.wait("Net.phase==='handshake'||Net.phase==='countdown'")
        await B.pg.wait_for_selector('#rkStatus')
        await asyncio.sleep(1.3)
        await B.shot('o_found.png')
        found = await B.js("$('modal').textContent")
        check('found screen names the opponent', 'Бат' in found and 'Сараа' in found, found)
        check('back button cannot leave the found screen', await B.js("window.onAndroidBack()&&!$('modal').hidden"))
        for p in (A, B): await p.wait("Net.phase==='live'&&state==='play'", 15000)
        a, b = await A.js("({mode:series.mode,q:boards[0].queue.slice(0,6),first:boards[0].piece.id,host:Net.iAmA,rival:$('rivalName').textContent,target:series.target,powers:$('powers').hidden})"), \
            await B.js("({mode:series.mode,q:boards[0].queue.slice(0,6),first:boards[0].piece.id,host:Net.iAmA,rival:$('rivalName').textContent})")
        check('both are in an online game', a['mode'] == 'online' and b['mode'] == 'online')
        check('same piece order on both phones', a['q'] == b['q'] and a['first'] == b['first'], (a, b))
        check('one host, one guest', a['host'] is True and b['host'] is False)
        check('rival labels', a['rival'].startswith('Сараа') and b['rival'].startswith('Бат'), (a['rival'], b['rival']))
        check('queue is empty after pairing', psql("select count(*) from match_queue") == '0')
        check('both heartbeats reached the server', psql("select (seen_a > created_at and seen_b > created_at) from online_matches where status='active'") == 't')
        await A.pg.evaluate(AI, 6)
        await asyncio.sleep(0.5)
        check("A's stack shows on B's rival board", await A.js("JSON.stringify(boards[0].cells)") == await B.js("JSON.stringify(boards[1].cells)"))
        check("A's stats show on B", await B.js("boards[1].pieces") == 6)
        # an attack: quad on A (extra block keeps it from being an all clear)
        await A.js("""(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);for(let y=16;y<20;y++){b.cells[y]=Array(10).fill(8);b.cells[y][9]=0}
            b.cells[15][0]=3;b.garbage=[];b.b2b=-1;b.combo=-1;b.piece={id:0,r:1,m:ROT[0][1],x:7,y:16};b.lastRot=false;lock(b)})()""")
        await asyncio.sleep(0.5)
        check('attack arrives in the opponent queue', await B.js("pendingRows(boards[0],false)") == 4, await B.js("JSON.stringify(boards[0].garbage)"))
        await asyncio.sleep(1.3)
        check('sender sees the opponent meter fill', await A.js("pendingRows(boards[1],false)") == 4)
        await asyncio.sleep(1.0)
        check('repeated messages do not duplicate the attack', await B.js("pendingRows(boards[0],false)") == 4)
        await A.shot('o_live_a.png')
        # pause button offers to give up, the game keeps running
        await B.pg.click('#pause')
        check('pause opens the give-up dialog and the game keeps running', await B.js("state==='play'&&!!$('ffYes')"))
        await B.pg.click('#ffNo')
        # B tops out
        await B.js(TOPOUT)
        for p in (A, B): await p.wait("state==='result'", 10000)
        await asyncio.sleep(1.0)
        ra, rb = await A.js("({out:$('outcome').textContent,chip:$('resultStats').firstElementChild.textContent,rank:profile.rank,wins:profile.wins,coins:profile.coins,eb:$('resultEyebrow').textContent})"), \
            await B.js("({out:$('outcome').textContent,chip:$('resultStats').firstElementChild.textContent,rank:profile.rank,losses:profile.losses,coins:profile.coins})")
        check('winner result from the server', ra['rank'] == 1012 and ra['wins'] == 1 and ra['coins'] == 30 and ra['chip'].startswith('+12'), ra)
        check('loser result from the server', rb['rank'] == 988 and rb['losses'] == 1 and rb['coins'] == 10 and rb['chip'].startswith('-12'), rb)
        check('series stored', psql("select status||' '||(winner='%s')::text||' '||score_a||'-'||score_b from online_matches" % A.uid) == 'finished true 1-0')
        await A.shot('o_result_a.png')
        await B.shot('o_result_b.png')

        if not ONLY or 'S2' in ONLY:
            # ------------------------------------------------------------ S2: FT3, next game, double top-out, give up
            print('S2 FT3 series', flush=True)
            await pair(A, B, 'ft3')
            check('FT3 series', await A.js("series.target") == 3 and await B.js("series.target") == 3)
            host, guest = (A, B) if await A.js("Net.iAmA") else (B, A)
            await host.js(TOPOUT)
            for p in (A, B): await p.wait("state==='over'&&series.game===2", 8000)
            await asyncio.sleep(0.3)
            await guest.shot('o_ft3_between.png')
            check('game 1 score on both', await host.js("[series.me,series.foe]") == [0, 1] and await guest.js("[series.me,series.foe]") == [1, 0])
            check('round result text', 'GAME!' in await guest.js("$('gameover').textContent") and '1' in await guest.js("$('gdet').textContent"))
            for p in (A, B): await p.wait("state==='play'&&series.game===2", 9000)
            qa, qb = await A.js("boards[0].queue.slice(0,6).concat(boards[0].piece.id)"), await B.js("boards[0].queue.slice(0,6).concat(boards[0].piece.id)")
            check('game 2 starts on both with a shared new piece order', qa == qb)
            check('boards were reset', await A.js("boards[0].pieces+boards[1].pieces") == 0)
            # both top out at the same moment
            await asyncio.gather(A.js(TOPOUT), B.js(TOPOUT))
            for p in (A, B): await p.wait("state==='over'&&series.game===3", 8000)
            sa, sb = await A.js("[series.me,series.foe]"), await B.js("[series.me,series.foe]")
            check('double top-out: one point, same on both phones', sa == sb[::-1] and sum(sa) == 2, (sa, sb))
            for p in (A, B): await p.wait("state==='play'&&series.game===3", 9000)
            await guest.pg.click('#pause')
            await guest.pg.click('#ffYes')
            for p in (A, B): await p.wait("state==='result'", 12000)
            await asyncio.sleep(1.0)
            check('give up: the other player is told', await host.js("series.reason") == 'oppLeft' and await host.js("series.won") is True and await guest.js("series.reason") == 'youLeft')
            check('give up stored as a series win', psql("select (winner='%s')::text from online_matches order by created_at desc limit 1" % host.uid) == 'true')
            rh = await host.js("({rank:profile.rank,chip:$('resultStats').firstElementChild.textContent,eb:$('resultEyebrow').textContent})")
            check('FT3 rating change (K=40) shown', rh['chip'].startswith('+') and psql("select rating from profiles where id='%s'" % host.uid) == str(rh['rank']), rh)
            await host.shot('o_forfeit_winner.png')

        if not ONLY or 'S3' in ONLY:
            # ------------------------------------------------------------ S3: opponent disappears mid-game
            print('S3 disconnect', flush=True)
            await pair(A, B, 'single')
            await A.js("Net.cfg.silent=2500;Net.cfg.lagNote=1200")
            before = int(psql("select rating from profiles where id='%s'" % A.uid))
            # B freezes: no more messages, no more heartbeats (as if the app was killed)
            await B.js("(()=>{Net.stop();Cloud.rpc=()=>Promise.reject(new Error('gone'))})()")
            await asyncio.sleep(1.8)
            check('lag note appears', await A.js("!$('toast').hidden&&$('toast').textContent===t('oppLag')"))
            psql("update online_matches set seen_a = case when player_a='%s' then seen_a else now()-interval '1 minute' end, seen_b = case when player_b='%s' then seen_b else now()-interval '1 minute' end where status='active'" % (A.uid, A.uid))
            await A.wait("state==='result'", 15000)
            await asyncio.sleep(1.0)
            check('silent opponent: series claimed', await A.js("series.reason") == 'oppLeft' and int(psql("select rating from profiles where id='%s'" % A.uid)) > before)
            await A.js("Net.cfg.silent=31000;Net.cfg.lagNote=6000;leaveMatch()")

        C = await Player('Тэмүүлэн').start(br)
        extra = []
        if not ONLY or 'S4' in ONLY:
            # ------------------------------------------------------------ S4: opponent never connects
            print('S4 no-show', flush=True)
            ghost = psql("insert into auth.users (raw_user_meta_data) values ('{\"username\":\"Ghost\"}') returning id")
            psql("insert into match_queue (user_id, rating, format) values ('%s', 1000, 'single')" % ghost)
            await C.js("Net.cfg.noShow=2500;openRank()")
            await C.wait("Net.phase==='handshake'")
            psql("update online_matches set created_at=created_at-interval '20 seconds', seen_a=seen_a-interval '20 seconds' where player_a='%s'" % ghost)
            await C.wait("Net.phase===''&&!$('modal').hidden&&!!$('agYes')", 15000)
            check('no-show: told the match does not count', await C.js("$('modal').textContent.includes(t('oppNoShow'))"))
            check('no-show: no result stored', psql("select status||' '||coalesce(winner::text,'none') from online_matches where player_a='%s'" % ghost) == 'abandoned none'
                  and psql("select rating||' '||wins||' '||losses from profiles where id='%s'" % C.uid) == '1000 0 0')
            await C.shot('o_noshow.png')
            await C.js("Net.cfg.noShow=14000;closeModal()")

        if not ONLY or 'S5' in ONLY:
            # ------------------------------------------------------------ S5: nobody around -> labelled bot, ranked
            print('S5 bot fallback', flush=True)
            await C.js("Net.cfg.botAfter=1500;openRank()")
            await C.wait("Net.phase==='search'")
            check('bot offer is hidden at first', await C.js("$('rkBot').hidden"))
            await C.wait("!$('rkBot').hidden", 6000)
            await C.shot('o_search_bot.png')
            await C.pg.click('#rkBot')
            await asyncio.sleep(0.6)
            check('bot game is ranked and labelled', await C.js("series.mode==='bot'&&$('rivalName').textContent.includes(t('bot').toUpperCase())"), await C.js("$('rivalName').textContent"))
            check('left the queue', psql("select count(*) from match_queue where user_id='%s'" % C.uid) == '0')
            await C.js("finishRound(boards[1])")
            await C.wait("state==='result'", 6000)
            await asyncio.sleep(1.2)
            row = psql("select rating||' '||wins||' '||coins from profiles where id='%s'" % C.uid)
            rc = await C.js("[profile.rank,profile.wins,profile.coins,outbox.length]")
            check('bot win counted by the server', rc[0] > 1000 and row == '%d 1 30' % rc[0] and rc[3] == 0, (row, rc))
            check('stored as a bot match', psql("select kind from matches where user_id='%s'" % C.uid) == 'bot')
            # practice afterwards: coins only (the server allows one report per 10 s)
            psql("update profiles set last_report=null where id='%s'" % C.uid)
            await C.js("leaveMatch();startPractice()")
            await C.js("finishRound(boards[1])")
            await C.wait("state==='result'", 6000)
            await asyncio.sleep(1.2)
            check('practice: coins only on the server', psql("select rating||' '||wins||' '||coins from profiles where id='%s'" % C.uid) == '%d 1 60' % rc[0])
            await C.js("leaveMatch()")

        if not ONLY or 'S6' in ONLY:
            # ------------------------------------------------------------ S6: half of the live messages are lost
            print('S6 packet loss', flush=True)
            await pair(A, C, 'single')
            net['drop'], net['sent'], net['dropped'] = 0.5, 0, 0
            total = 0
            for k in range(3):
                await A.js("""(()=>{const b=boards[0];b.cells=Array.from({length:20},emptyRow);for(let y=16;y<20;y++){b.cells[y]=Array(10).fill(8);b.cells[y][9]=0}
                    b.cells[15][0]=3;b.garbage=[];b.b2b=-1;b.combo=-1;b.piece={id:0,r:1,m:ROT[0][1],x:7,y:16};b.lastRot=false;lock(b)})()""")
                total += 4
                await asyncio.sleep(0.4)
            await asyncio.sleep(5.0)
            got = await C.js("pendingRows(boards[0],false)")
            check('every attack arrives exactly once despite 50%% loss (%d of %d frames dropped)' % (net['dropped'], net['sent']), got == total and net['dropped'] > 3, (got, total))
            await C.js(TOPOUT)
            for p in (A, C): await p.wait("state==='result'", 15000)
            check('result still reaches both phones', await A.js("series.won") is True and await C.js("series.won") is False)
            net['drop'] = 0.0
            for p in (A, C): await p.js("leaveMatch()")

        if not ONLY or 'S7' in ONLY:
            # ------------------------------------------------------------ S7: the live connection cannot be opened
            print('S7 realtime unavailable', flush=True)
            D = await Player('Номин').start(br, deaf=True)
            await D.js("Net.cfg.noShow=2500")
            await A.js("openRank()")
            await asyncio.sleep(0.5)
            await D.js("openRank()")
            await D.wait("Net.phase===''&&!!$('agYes')", 15000)
            check('own live connection failed: told, nothing counted', await D.js("$('modal').textContent.includes(t('rtFail'))"))
            await A.wait("Net.phase===''&&!!$('agYes')", 20000)
            check('the waiting opponent is released without a result', await A.js("$('modal').textContent.includes(t('oppNoShow'))")
                  and psql("select status from online_matches order by created_at desc limit 1") == 'abandoned')

        if not ONLY or 'S8' in ONLY:
            # ------------------------------------------------------------ S8: play a friend by code (unranked)
            print('S8 friend room', flush=True)
            E = await Player('Энхжин').start(br)            # B's connection was cut on purpose in S3
            extra.append(E)
            for p in (A, E, C):
                await p.js("Net.stop();if(state!=='title')leaveMatch();closeModal();Net.cfg.noShow=14000;profile.fmt='single';save()")
            prof = lambda p: psql("select rating||' '||wins||' '||losses||' '||coins from profiles where id='%s'" % p.uid)
            before = {p.name: prof(p) for p in (A, E)}
            local = lambda p: p.js("[profile.rank,profile.wins,profile.losses,profile.coins]")
            local_before = {p.name: await local(p) for p in (A, E)}
            await A.pg.click('#ranked')
            await A.pg.click('#rkFriend')
            await A.pg.click('#fCreate')
            await A.wait("Net.phase==='room'&&!!$('fCode')")
            code = await A.js("$('fCode').textContent")
            check('room code shown to the creator (6 characters, no 0/O/1/I/L)', re.fullmatch(r'[A-HJKMNP-Z2-9]{6}', code), code)
            await asyncio.sleep(0.6)
            await A.shot('f_code.png')
            check('the creator cannot join their own room', await A.js("Cloud.rpc('join_room',{p_code:%s}).then(()=>'joined',e=>e.message)" % json.dumps(code)) == 'own_room')
            await E.pg.click('#ranked')
            await E.pg.click('#rkFriend')
            await E.pg.click('#fJoin')
            await E.pg.fill('#fCodeIn', 'QQQQQQ')
            await E.pg.click('#fJoinGo')
            await E.wait("$('fMsg').textContent===t('friendNotFound')")
            check('wrong code: told so', True)
            await E.pg.fill('#fCodeIn', '')
            await E.pg.type('#fCodeIn', code[:3].lower() + ' - ' + code[3:].lower())
            check('typed code is cleaned (case, spaces, dash)', await E.js("$('fCodeIn').value") == code, await E.js("$('fCodeIn').value"))
            await E.shot('f_join.png')
            await E.pg.click('#fJoinGo')
            await A.wait("Net.phase==='handshake'||Net.phase==='countdown'", 8000)
            check('found screen says friendly match', await A.js("$('modal').textContent.includes(t('friendPlay'))"))
            for p in (A, E): await p.wait("Net.phase==='live'&&state==='play'", 20000)
            fm = psql("select id||' '||ranked::text||' '||(player_a='%s')::text from online_matches order by created_at desc limit 1" % A.uid).split()
            check('both in a friendly match; the creator hosts; the server row is unranked',
                  await A.js("series.mode") == 'friend' and await E.js("series.mode") == 'friend' and fm[1:] == ['false', 'true'], fm)
            await C.js("friendJoin()")
            await C.pg.fill('#fCodeIn', code)
            await C.pg.click('#fJoinGo')
            await C.wait("$('fMsg').textContent===t('friendTaken')")
            check('a third player cannot take the room', True)
            await C.js("closeModal()")
            await A.pg.evaluate(AI, 4)
            await asyncio.sleep(0.5)
            check("live boards are shared as in ranked", await A.js("JSON.stringify(boards[0].cells)") == await E.js("JSON.stringify(boards[1].cells)"))
            await E.js(TOPOUT)
            for p in (A, E): await p.wait("state==='result'", 10000)
            await asyncio.sleep(1.0)
            ra = await A.js("({eb:$('resultEyebrow').textContent,chip:$('resultStats').firstElementChild.textContent,won:series.won,tag:t('friendTag'),norp:t('friendNoRp')})")
            check('result screen: friendly match, no RP or coins', ra['eb'].startswith(ra['tag']) and ra['norp'] in ra['chip'] and ra['won'] is True, ra)
            check('no rating, record or coin change on the server', all(prof(p) == before[p.name] for p in (A, E)), [prof(A), prof(E), before])
            check('no change on the phones either', [await local(p) for p in (A, E)] == [local_before[p.name] for p in (A, E)])
            check('history rows marked friend', psql("select count(*)||' '||bool_and(rating_before=rating_after and coins=0)::text from matches where kind='friend'") == '2 true')
            await A.shot('f_result.png')
            # rematch: both press it on the result screen
            await A.pg.click('#rematch')
            await A.wait("Net.phase==='room'")
            await asyncio.sleep(2.3)
            await A.shot('f_rematch_wait.png')
            await E.pg.click('#rematch')
            for p in (A, E): await p.wait("Net.phase==='live'&&state==='play'", 20000)
            rm = psql("select id||' '||ranked::text from online_matches order by created_at desc limit 1").split()
            check('rematch: a new friendly match with the same friend', rm[0] != fm[0] and rm[1] == 'false' and await A.js("series.mode") == 'friend')
            await A.pg.click('#pause')
            check('give-up note says the rank is not affected', await A.js("$('ffMsg').textContent===t('forfeitNoteFriend')"))
            await A.pg.click('#ffYes')
            for p in (A, E): await p.wait("state==='result'", 12000)
            check('giving up a friendly match changes nothing', all(prof(p) == before[p.name] for p in (A, E)) and await E.js("series.reason") == 'oppLeft')
            for p in (A, E): await p.js("leaveMatch()")
            # an expired code
            await A.js("openFriend()")
            await A.wait("!!$('fCreate')")
            await A.pg.click('#fCreate')
            await A.wait("Net.phase==='room'&&!!$('fCode')")
            code2 = await A.js("$('fCode').textContent")
            psql("update friend_rooms set expires_at=now()-interval '1 second' where code='%s'" % code2)
            await E.js("friendJoin()")
            await E.pg.fill('#fCodeIn', code2)
            await E.pg.click('#fJoinGo')
            await E.wait("$('fMsg').textContent===t('friendExpired')")
            await A.wait("!!$('fNew')", 6000)
            check('expired code: the joiner is told, the creator is offered a new code', True)
            await A.pg.click('#fNew')
            await A.wait("Net.phase==='room'&&!!$('fCode')")
            check('new code', await A.js("$('fCode').textContent") != code2)
            await A.js("window.onAndroidBack()")
            await asyncio.sleep(0.5)
            check('back cancels the room', await A.js("Net.phase===''&&$('modal').hidden") and
                  psql("select status from friend_rooms where creator='%s' order by created_at desc limit 1" % A.uid) == 'closed')
            await E.js("closeModal()")
            # the friend never connects
            ghost = psql("insert into auth.users (raw_user_meta_data) values ('{\"username\":\"Ghost2\"}') returning id")
            gcode = psql("set role authenticated; select set_config('request.jwt.claim.sub','%s',false); select code from create_room('single')" % ghost)
            await C.js("Net.cfg.friendNoShow=2500;friendJoin()")
            await C.pg.fill('#fCodeIn', gcode)
            await C.pg.click('#fJoinGo')
            await C.wait("Net.phase==='handshake'")
            psql("update online_matches set created_at=created_at-interval '20 seconds', seen_a=seen_a-interval '20 seconds' where player_a='%s'" % ghost)
            await C.wait("Net.phase===''&&!!$('agYes')", 15000)
            check('friend never connects: told, nothing counted, offered friend play again',
                  await C.js("$('modal').textContent.includes(t('oppNoShow'))&&$('agYes').textContent===t('friendPlay')")
                  and psql("select status from online_matches where player_a='%s'" % ghost) == 'abandoned')
            await C.js("Net.cfg.friendNoShow=60000;closeModal()")

        errs = A.errs + B.errs + C.errs + sum((p.errs for p in extra), [])
        print('page errors:', errs or 'none')
        fails = [k for k, v in R.items() if v != 'ok']
        print('RESULT: %d checks, %d failed %s' % (len(R), len(fails), fails))
        print('screenshots:', OUT)
        return 1 if fails or errs else 0

# os._exit: closing the browser trips a harmless Playwright error for WebSockets the page left open
code = asyncio.run(main())
sys.stdout.flush()
os._exit(code)
