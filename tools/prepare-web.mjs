#!/usr/bin/env node
// Copies the built game (index.html) into www/, the folder Capacitor packs into the iOS app
// (webDir in capacitor.config.json). Run by `npm run ios:sync`; see docs/IOS.md.
//
// Online settings: with SUPABASE_URL and SUPABASE_ANON_KEY set in the environment the copy becomes the
// online version, exactly like the Android workflows do it. Without them it is the offline version.
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... npm run ios:sync
// index.html itself is never changed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'index.html');
const outDir = join(root, 'www');
const EMPTY = '{"supabaseUrl":"","supabaseAnonKey":""}';

let html;
try {
  html = readFileSync(source, 'utf8');
} catch (e) {
  console.error('index.html not found. Build it first: python3 tools/build.py');
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (process.env.SUPABASE_ANON_KEY || '').trim();

if (url && key) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    console.warn('Warning: ' + url + ' is not a *.supabase.co address. The page only allows connections to '
      + 'https://*.supabase.co (Content-Security-Policy in src/index.html); add your domain there first.');
  }
  if (html.includes(EMPTY)) {
    // JSON inside <script type="application/json">: keep "<" out so the tag cannot be closed early
    const settings = JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }).replace(/</g, '\\u003c');
    html = html.replace(EMPTY, () => settings);
    console.log('Online version: Supabase settings added for ' + url);
  } else {
    console.log('index.html already has Supabase settings: keeping them (online version)');
  }
} else if (url || key) {
  console.error('Set both SUPABASE_URL and SUPABASE_ANON_KEY, or neither (offline version).');
  process.exit(1);
} else {
  console.log(html.includes(EMPTY) ? 'Offline version (no SUPABASE_URL / SUPABASE_ANON_KEY)'
    : 'index.html already has Supabase settings: online version');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
console.log('Wrote www/index.html (' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
