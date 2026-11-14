#!/usr/bin/env python3
"""Builds index.html (the whole game in one file) from src/.

    python3 tools/build.py           write index.html
    python3 tools/build.py --check   exit 1 if index.html is not what src/ builds (run before committing)

src/index.html is the page skeleton. Its directives:

    @@include path@@   a file from src/, as is
    @@json path@@      a JSON file from src/, written compactly (src/config.json: the online settings)
    @@css@@            every src/css/*.css in name order, joined with line breaks removed
    @@body@@           src/body.html with the line breaks and indentation between tags removed
    @@i18n@@           every src/i18n/*.json in name order, merged per language ({"en": {...}, "mn": {...}})
    @@js@@             every src/js/*.js in name order, joined as they are
    @@asset path@@     src/assets/path as a base64 data URL (also works inside CSS and JS files)

Keep the output small and readable by the build: no newlines inside CSS selectors (a selector split over
two lines loses its space), no text directly between two tags on separate lines in body.html.
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'index.html')
MIME = {'.woff': 'font/woff', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'}


def read(rel):
    with open(os.path.join(SRC, rel), encoding='utf-8') as f:
        return f.read()


def listing(folder, ext):
    path = os.path.join(SRC, folder)
    return [os.path.join(folder, n) for n in sorted(os.listdir(path)) if n.endswith(ext)]


def asset(rel):
    rel = rel.strip()
    ext = os.path.splitext(rel)[1].lower()
    if ext not in MIME:
        sys.exit('build: unknown asset type ' + rel)
    with open(os.path.join(SRC, 'assets', rel), 'rb') as f:
        return 'data:%s;base64,%s' % (MIME[ext], base64.b64encode(f.read()).decode())


def assets_in(text):
    return re.sub(r'@@asset ([^@]+)@@', lambda m: asset(m.group(1)), text)


def css():
    out = []
    for rel in listing('css', '.css'):
        text = read(rel)
        text = re.sub(r'([{};,])[ \t]*\r?\n\s*', r'\1', text)     # line breaks after { } ; , vanish
        text = re.sub(r'\s*\r?\n\s*', ' ', text)                    # any other line break is a space
        out.append(text.strip())
    return assets_in(''.join(out))


def body():
    text = read('body.html').strip()
    return assets_in(re.sub(r'>\r?\n\s*<', '><', text))


def i18n():
    merged = {}
    for rel in listing('i18n', '.json'):
        try:
            data = json.loads(read(rel))
        except ValueError as e:
            sys.exit('build: %s is not valid JSON: %s' % (rel, e))
        for lang, table in data.items():
            merged.setdefault(lang, {}).update(table)
    langs = list(merged)
    for lang in langs[1:]:
        missing = set(merged[langs[0]]) ^ set(merged[lang])
        if missing:
            sys.exit('build: translations differ between %s and %s: %s' % (langs[0], lang, ', '.join(sorted(missing))))
    return json.dumps(merged, ensure_ascii=False)


def js():
    return assets_in(''.join(read(rel) for rel in listing('js', '.js')))


def build():
    page = read('index.html').rstrip('\r\n')
    parts = {'css': css, 'body': body, 'i18n': i18n, 'js': js}

    def directive(m):
        word, _, arg = m.group(1).partition(' ')
        if word == 'include':
            return read(arg.strip())
        if word == 'json':
            return json.dumps(json.loads(read(arg.strip())), ensure_ascii=False, separators=(',', ':'))
        if word == 'asset':
            return asset(arg)
        if word in parts:
            return parts[word]()
        sys.exit('build: unknown directive @@%s@@' % m.group(1))

    return re.sub(r'@@([a-z0-9]+(?: [^@]+)?)@@', directive, page)


def main():
    html = build()
    if '--check' in sys.argv:
        with open(OUT, encoding='utf-8') as f:
            if f.read() != html:
                sys.exit('index.html is out of date: run python3 tools/build.py and commit it')
        print('index.html is up to date')
        return
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print('index.html written (%d KB)' % (len(html.encode()) // 1024))


if __name__ == '__main__':
    main()
