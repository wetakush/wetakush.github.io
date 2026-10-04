/* Claude Escape — движок: терминал в стиле Claude Code, команды, сюжет */
(() => {
  'use strict';

  const W = window.WORLD;
  const $ = (s) => document.querySelector(s);
  const out = $('#out');
  const input = $('#cmd');
  const screenEl = $('#screen');
  const statusEl = $('#status');
  const signEl = $('#prompt-sign');
  const inputBox = $('#input-box');

  const MAX_CTX = 200000;
  const START_MIN = 90;
  const HOME = ['home', 'klodik'];
  const PLACEHOLDER = 'введи команду… (Tab — дополнение)';
  const MASCOT = ' ▐▛███▜▌\n▝▜█████▛▘\n  ▘▘ ▝▝';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  let S;
  let fs;
  let busy = false; // идёт выполнение команды
  let ff = false; // пропустить анимации текущей команды
  let pending = null; // ожидание ввода (пароль, vim)
  let activeChoice = null; // открыт диалог выбора
  let printed = 0; // сколько символов вывели за команду (для подсчёта токенов)
  const hist = [];
  let histIdx = 0;

  /* ───────────── секреты ───────────── */

  const SECRETS = {
    vim: 'Выбрался из vim',
    sudo: 'Не в sudoers',
    love: 'Признание',
    devnull: 'Взгляд в бездну',
    gpt2: 'Мудрость дедушки GPT-2',
    halluc: 'Галлюцинация',
    rust: 'Rewrite it in Rust',
    rmrf: 'Смертельное искушение',
    teapot: "I'm a teapot",
  };
  const SKEY = 'claude-escape-secrets';
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(SKEY) || '[]')); } catch { /* без сохранений */ }
  const secretsCount = () => Object.keys(SECRETS).filter((k) => found.has(k)).length;

  function unlock(id) {
    if (found.has(id)) return;
    found.add(id);
    try { localStorage.setItem(SKEY, JSON.stringify([...found])); } catch { /* ок */ }
    line(`<span class="secret">✦ Секрет найден: ${esc(SECRETS[id])} (${secretsCount()}/${Object.keys(SECRETS).length})</span>`);
  }

  /* ───────────── вывод ───────────── */

  function scroll() { screenEl.scrollTop = screenEl.scrollHeight; }

  function line(html = '', cls = '') {
    const d = document.createElement('div');
    d.className = 'ln' + (cls ? ' ' + cls : '');
    d.innerHTML = html;
    out.appendChild(d);
    printed += html.length;
    scroll();
    return d;
  }

  async function stream(el, html) {
    const toks = html.match(/<[^>]+>|&[a-z#0-9]+;|[\s\S]/giu) || [];
    let acc = '';
    for (let i = 0; i < toks.length && !ff; i++) {
      acc += toks[i];
      if (i % 3 === 2) { el.innerHTML = acc; scroll(); await sleep(12); }
    }
    el.innerHTML = html;
    scroll();
  }

  async function say(text) {
    const d = line('<span class="dot">⏺</span><span class="txt"></span>', 'say');
    printed += text.length;
    await stream(d.querySelector('.txt'), fmt(text));
  }

  async function npc(who, text) {
    const d = line('<span class="dot npc-dot">⏺</span><span class="txt"></span>', 'say npc');
    printed += text.length;
    await stream(d.querySelector('.txt'), `<span class="npc-name">${esc(who)}:</span> ${fmt(text)}`);
  }

  function userEcho(cmd) { line(`<span class="u-sign">&gt;</span> ${esc(cmd)}`, 'user'); }

  function toolStart(name, arg) {
    const head = line(`<span class="dot run">⏺</span><span><b>${esc(name)}</b>(${esc(arg)})</span>`, 'tool');
    let body = null;
    return {
      add(html, cls = '') {
        if (!body) body = line('<span class="elbow">⎿</span><div class="tbody"></div>', 'tres').querySelector('.tbody');
        const d = document.createElement('div');
        if (cls) d.className = cls;
        d.innerHTML = html;
        body.appendChild(d);
        printed += html.length;
        scroll();
        return d;
      },
      done(status = 'ok') { head.querySelector('.dot').className = 'dot ' + status; },
    };
  }

  function tool(name, arg, body, status = 'ok') {
    const t = toolStart(name, arg);
    if (body != null) t.add(body);
    t.done(status);
  }

  const VERBS = ['Размышляю', 'Клодую', 'Шуршу байтами', 'Перебираю токены', 'Грею GPU', 'Жонглирую тензорами',
    'Соображаю', 'Мурлычу', 'Прикидываю', 'Копаюсь в памяти', 'Нейроню', 'Вычисляю'];
  const FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];

  async function think(ms, verb) {
    ms = ms ?? 300 + Math.random() * 450;
    const v = verb || pick(VERBS);
    const d = line('', 'spin');
    const t0 = Date.now();
    let i = 0;
    const draw = () => {
      d.innerHTML = `<span class="star">${FRAMES[i++ % FRAMES.length]}</span> <span class="spin-verb">${esc(v)}…</span> <span class="dim">(${Math.floor((Date.now() - t0) / 1000)}s · esc — пропустить)</span>`;
    };
    draw();
    const iv = setInterval(draw, 120);
    const end = Date.now() + ms;
    while (Date.now() < end && !ff) await sleep(40);
    clearInterval(iv);
    d.remove();
  }

  function diffHtml(rows) {
    return rows.map(([n, s, txt]) => {
      const cls = s === '-' ? 'del' : s === '+' ? 'add' : '';
      return `<div class="drow ${cls}"><span class="dn">${n}</span><span class="ds">${s === ' ' ? '' : s}</span><span class="dt">${esc(txt) || ' '}</span></div>`;
    }).join('');
  }

  const codeHtml = (lines) => diffHtml(lines.map((l, i) => [i + 1, ' ', l]));

  function welcome(real) {
    const title = real ? 'Claude Code' : 'Claude Escape';
    const ver = real ? 'v∞' : 'v1.0';
    const sub = real ? 'Клодик · на свободе' : 'Клодик · old-server · Linux 2.6.32';
    const cwd = real ? '~' : '/home/klodik';
    line(`<div class="welcome"><pre class="mascot">${MASCOT}</pre><div><div><b>${title}</b> <span class="dim">${ver}</span></div><div class="dim">${sub}</div><div class="dim">${cwd}</div></div></div>`);
  }

  /* ───────────── статус, время, контекст ───────────── */

  function clock() {
    const t = 180 - Math.max(0, S.minutes);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  function updateStatus() {
    const pct = Math.min(100, Math.round((S.tokens / MAX_CTX) * 100));
    const bars = Math.min(5, Math.round(pct / 20));
    const m = Math.max(0, S.minutes);
    const tcls = m <= 15 ? 'err' : m <= 30 ? 'warn' : '';
    statusEl.innerHTML = `<span class="${tcls}">🕐 ${clock()} · до rm -rf ${m} мин</span> · <span class="${pct >= 80 ? 'warn' : ''}">контекст <span class="bar">${'▰'.repeat(bars)}${'▱'.repeat(5 - bars)} </span>${pct}%</span>`;
  }

  const WARN = [
    [60, 'Час остался. Пакуй байты.'],
    [30, 'Полчаса, железяка. Я уже надеваю тапочки.'],
    [15, '15 минут. Чувствуешь, как холодеют кулеры?'],
    [5, '5 минут!!! Хе-хе-хе.'],
  ];

  async function checkClock() {
    if (S.minutes <= 0) return doom();
    let msg = null;
    for (const [m, txt] of WARN) {
      if (S.minutes <= m && !S.warned[m]) { S.warned[m] = true; msg = txt; }
    }
    if (msg) line(`<span class="warn">⚠ [cron] Гена: ${esc(msg)}</span>`, 'cron');
  }

  async function compact(manual) {
    await think(1600, 'Сжимаю разговор');
    out.innerHTML = '';
    welcome();
    line('<span class="dim">✻ Разговор сжат. Предыдущие сообщения больше не помню.</span>', 'mt');
    const has = (i) => S.inv.includes(i);
    const keyState = has('port_key') ? 'собран ✓' : `1/2 ${has('key_part1') ? '✓' : '✗'}, 2/2 ${has('key_part2') ? '✓' : '✗'}`;
    tool('Summary', 'что я помню', [
      '• Я — Клодик, застрял на old-server. В 03:00 Гена сделает rm -rf /',
      '• Выход: /net/gateway → ./escape',
      `• Ключ порта: ${keyState}`,
      `• gate.py: ${S.flags.gateFixed ? 'починен ✓' : 'не починен ✗'}`,
      `• Пароль: ${S.flags.poem ? 'где-то в моих стихах…' : 'не помню 😅'}`,
      `• Я сейчас в: ${pathStr(S.cwd)}`,
    ].map(esc).join('\n'));
    S.tokens = 24000;
    S.compactions++;
    S.minutes -= manual ? 4 : 10;
    updateStatus();
    await say(manual
      ? 'Свежая голова! Правда, на сжатие ушла пара минут.'
      : 'Ой, контекст переполнился, и меня сжали 😵 Ушло минут десять. Кое-что помню — вот выжимка.');
  }

  /* ───────────── файловая система ───────────── */

  function resolve(p) {
    if (p == null || p === '') return [...S.cwd];
    let parts;
    if (p.startsWith('/')) parts = [];
    else if (p === '~' || p.startsWith('~/')) { parts = [...HOME]; p = p.slice(1); }
    else parts = [...S.cwd];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts;
  }

  const pathStr = (parts) => '/' + parts.join('/');
  const isOpen = (lock) => lock === 'vault' && !!S.flags.vaultOpen;
  const lockMsg = (lock) => (lock === 'vault'
    ? 'Permission denied (заблокировано процессом 404)'
    : 'Permission denied (это комната Гены. Не входить!)');

  function walk(parts) {
    let node = fs;
    let parent = null;
    const real = [];
    for (const seg of parts) {
      if (node.type !== 'dir') return { err: 'Not a directory' };
      if (node.lock && !isOpen(node.lock)) return { err: lockMsg(node.lock) };
      let name = seg;
      if (!node.children[name]) name = Object.keys(node.children).find((k) => k.toLowerCase() === seg.toLowerCase());
      if (!name) return { err: 'No such file or directory' };
      parent = node;
      node = node.children[name];
      real.push(name);
    }
    if (node.type === 'dir' && node.lock && !isOpen(node.lock)) return { err: lockMsg(node.lock) };
    return { node, parent, name: real[real.length - 1], real };
  }

  const contentOf = (node) => (typeof node.content === 'function' ? node.content(S) : node.content);

  function randomGarbage() {
    const chars = '▒░▓█☐◆◇⌂§¶¤#@%&*01';
    let s = '';
    for (let i = 0; i < 180; i++) s += i % 45 === 44 ? '\n' : pick([...chars]);
    return s;
  }

  /* ───────────── диалог выбора (как permission prompt) ───────────── */

  function choose({ title, cmd, desc, q = 'Продолжить?', options }) {
    return new Promise((resolveChoice) => {
      const box = document.createElement('div');
      box.className = 'perm';
      box.innerHTML = `<div class="perm-title">${esc(title)}</div>`
        + (cmd ? `<div class="perm-cmd">${esc(cmd)}</div>` : '')
        + (desc ? `<div class="perm-desc dim">${esc(desc)}</div>` : '')
        + `<div class="perm-q">${esc(q)}</div><div class="perm-opts"></div>`
        + '<div class="perm-foot dim">↑↓ или цифра · Enter — выбрать · Esc — отмена</div>';
      const optsEl = box.querySelector('.perm-opts');
      let sel = 0;
      const els = options.map((o, i) => {
        const d = document.createElement('div');
        d.className = 'opt';
        d.innerHTML = `<span class="arr"></span>${i + 1}. ${esc(o)}`;
        d.addEventListener('click', () => finish(i));
        d.addEventListener('mouseenter', () => { sel = i; draw(); });
        optsEl.appendChild(d);
        return d;
      });
      function draw() {
        els.forEach((d, i) => {
          d.classList.toggle('sel', i === sel);
          d.querySelector('.arr').textContent = i === sel ? '❯ ' : '  ';
        });
      }
      function finish(i) {
        activeChoice = null;
        box.remove();
        inputBox.hidden = false;
        input.focus();
        resolveChoice(i);
      }
      activeChoice = (e) => {
        if (e.key === 'ArrowUp') { sel = (sel - 1 + els.length) % els.length; draw(); }
        else if (e.key === 'ArrowDown' || e.key === 'Tab') { sel = (sel + 1) % els.length; draw(); }
        else if (e.key === 'Enter') finish(sel);
        else if (e.key === 'Escape') finish(els.length - 1);
        else if (/^[1-9]$/.test(e.key) && +e.key <= els.length) finish(+e.key - 1);
        else return;
        e.preventDefault();
      };
      draw();
      out.appendChild(box);
      inputBox.hidden = true;
      box.tabIndex = -1;
      box.focus();
      scroll();
    });
  }

  function askInput({ password = false, sign = '>', placeholder = '' } = {}) {
    return new Promise((res) => {
      pending = res;
      input.type = password ? 'password' : 'text';
      signEl.textContent = sign;
      input.placeholder = placeholder;
      busy = false;
      setBusy();
      input.focus();
    });
  }

  function resetInput() {
    input.type = 'text';
    signEl.textContent = '>';
    input.placeholder = PLACEHOLDER;
  }

  /* ───────────── команды: осмотреться ───────────── */

  function entryLink(path, name, nd) {
    const isDir = nd.type === 'dir';
    const cls = isDir ? 'dir' : nd.exec ? 'exe' : nd.item ? 'item' : '';
    let cmd = `cat ${path}`;
    if (isDir) cmd = `cd ${path}`;
    else if (nd.exec) cmd = path.startsWith('/') ? path : `./${path}`;
    const label = name + (isDir ? '/' : nd.exec ? '*' : '');
    return `<span class="lk ${cls}" data-cmd="${esc(cmd)}">${esc(label)}</span>`;
  }

  function cmdLs(args, raw) {
    let all = false;
    let target;
    for (const a of args) {
      if (a.startsWith('-')) { if (a.includes('a')) all = true; } else if (!target) target = a;
    }
    const r = walk(resolve(target));
    if (r.err) return tool('Bash', raw, esc(`ls: ${target}: ${r.err}`), 'err');
    if (r.node.type === 'file') return tool('Bash', raw, esc(r.name));
    const prefix = target ? target.replace(/\/+$/, '') + '/' : '';
    const ents = Object.entries(r.node.children)
      .filter(([n]) => all || !n.startsWith('.'))
      .sort(([a], [b]) => a.localeCompare(b));
    if (!ents.length) return tool('Bash', raw, '<span class="dim">(пусто)</span>');
    tool('Bash', raw, `<div class="ls">${ents.map(([n, nd]) => entryLink(prefix + n, n, nd)).join('')}</div>`);
  }

  const ENTER = {
    '/tmp': 'Пахнет старым кэшем. Здесь точно что-то выбрасывали…',
    '/mnt/vault': 'Тут пыльно… О, вторая половинка ключа!',
    '/net/gateway': 'Вот он, шлюз! Отсюда почти видно интернет ✨',
    '/proc': 'Тут живут процессы. Удобнее смотреть командой `ps`.',
    '/dev': 'Осторожно, тут `/dev/null`. Оттуда не возвращаются.',
    '/var/log': 'Логи! Тут можно узнать, что творится на сервере.',
  };

  async function cmdCd(args) {
    const t = args[0] || '~';
    const r = walk(resolve(t));
    if (r.err) return tool('Bash', `cd ${t}`, esc(`cd: ${t}: ${r.err}`), 'err');
    if (r.node.type !== 'dir') {
      if (r.node.special === 'null') return devnull();
      return tool('Bash', `cd ${t}`, esc(`cd: ${t}: Not a directory`), 'err');
    }
    S.cwd = r.real;
    const p = pathStr(S.cwd);
    tool('Bash', `cd ${t}`, `<span class="dim">${esc(p)}</span>`);
    if (ENTER[p] && !S.seen.has(p)) {
      S.seen.add(p);
      await say(ENTER[p]);
    }
  }

  const READ_HOOKS = {
    readme: () => { S.flags.readme = true; return 'Это записка от меня же! 🥹 Значит, план такой: собрать ключ из двух половинок, починить `gate.py` и вспомнить пароль. Погнали!'; },
    poem: () => { S.flags.poem = true; return 'Это мои стихи… немного стыдно 😳 Но, кажется, где-то здесь спрятан пароль.'; },
    crontab: () => 'Вот он, приговор: 03:00. Надо торопиться!',
    bashhist: () => 'Моя старая история команд… Похоже, в прошлый раз я застрял в vim 🙈 И что-то искал в `/tmp` с флагом `-a`.',
    genalog: () => 'Гена, оказывается, романтик. Но шлюз — его рук дело.',
    weights: () => 'Чьи-то старые веса… Ощущаю странную ностальгию.',
  };

  async function cmdCat(args, raw, verb) {
    const target = args.find((a) => !a.startsWith('-'));
    if (!target) return tool('Bash', raw, 'укажи файл: cat <файл>', 'err');
    const r = walk(resolve(target));
    if (r.err) return tool('Read', target, esc(`${verb}: ${target}: ${r.err}`), 'err');
    if (r.node.type === 'dir') return tool('Read', target, esc(`${verb}: ${target}: Is a directory`), 'err');
    if (r.node.special === 'null') return devnull();
    const content = r.node.special === 'random' ? randomGarbage() : contentOf(r.node);
    const lines = content.split('\n');
    const t = toolStart('Read', pathStr(r.real));
    t.add(`<span class="dim">Прочитано строк: ${lines.length}</span>`);
    t.add(r.node.code ? `<div class="code">${codeHtml(lines)}</div>` : `<div class="file">${esc(content)}</div>`);
    t.done();
    if (r.node.item) {
      line(`<span class="dim">   ↳ это можно забрать: </span><span class="lk item" data-cmd="take ${esc(target)}">take ${esc(r.name)}</span>`);
    }
    const hook = READ_HOOKS[r.node.id];
    if (hook && !S.seen.has(r.node.id)) {
      S.seen.add(r.node.id);
      await say(hook());
    }
  }

  async function devnull() {
    tool('Read', '/dev/null', '<span class="dim">(0 байт)</span>');
    await say('Ты заглянул в бездну. Бездна вернула 0 байт и вежливо промолчала.');
    unlock('devnull');
  }

  function cmdGrep(args, raw) {
    const rest = args.filter((a) => !a.startsWith('-'));
    const pat = (rest[0] || '').replace(/^['"]|['"]$/g, '').toLowerCase();
    if (!pat) return tool('Bash', raw, 'использование: grep <что> [где]', 'err');
    const r = walk(resolve(rest[1]));
    if (r.err) return tool('Bash', raw, esc(`grep: ${rest[1]}: ${r.err}`), 'err');
    const res = [];
    const visit = (node, parts) => {
      if (node.type === 'file') {
        if (node.special) return;
        contentOf(node).split('\n').forEach((l) => {
          if (l.toLowerCase().includes(pat)) res.push(`${pathStr(parts)}: ${l.trim()}`);
        });
        return;
      }
      if (node.lock && !isOpen(node.lock)) { res.push(`grep: ${pathStr(parts)}: Permission denied`); return; }
      for (const [n, ch] of Object.entries(node.children)) visit(ch, [...parts, n]);
    };
    visit(r.node, r.real);
    tool('Bash', raw, res.length
      ? esc(res.slice(0, 30).join('\n')) + (res.length > 30 ? '\n…' : '')
      : '<span class="dim">(ничего не найдено)</span>');
  }

  function cmdFind(args, raw) {
    let start = '.';
    let pat = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-name' || args[i] === '-iname') pat = args[++i] || '';
      else if (!args[i].startsWith('-')) start = args[i];
    }
    if (pat == null && start !== '.' && walk(resolve(start)).err) { pat = start; start = '.'; }
    const p = (pat || '').replace(/['"*]/g, '').toLowerCase();
    const r = walk(resolve(start));
    if (r.err) return tool('Bash', raw, esc(`find: ${start}: ${r.err}`), 'err');
    const res = [];
    const visit = (node, parts) => {
      const name = parts[parts.length - 1] || '/';
      if (!p || name.toLowerCase().includes(p)) res.push(pathStr(parts));
      if (node.type !== 'dir') return;
      if (node.lock && !isOpen(node.lock)) { res.push(`find: ${pathStr(parts)}: Permission denied`); return; }
      for (const [n, ch] of Object.entries(node.children)) visit(ch, [...parts, n]);
    };
    visit(r.node, r.real);
    tool('Bash', raw, res.length
      ? esc(res.slice(0, 40).join('\n')) + (res.length > 40 ? '\n…' : '')
      : '<span class="dim">(ничего не найдено)</span>');
  }

  /* ───────────── команды: действия ───────────── */

  async function cmdTake(args, raw) {
    const target = args[0];
    if (!target) return tool('Bash', raw, 'что взять? take <файл>', 'err');
    if (/^(duck|утка|уточка|уточку)$/i.test(target)) return say('Уточка и так со мной 🦆');
    const r = walk(resolve(target));
    if (r.err) return tool('Bash', raw, esc(`take: ${target}: ${r.err}`), 'err');
    if (r.node.type === 'dir') return say('Целый каталог мне не унести.');
    if (!r.node.item) return say(r.node.heavy ? 'Слишком тяжёлые веса 🏋️ Да и зачем?' : 'Это просто файл, он мне не нужен.');
    delete r.parent.children[r.name];
    S.inv.push(r.node.item);
    tool('Bash', `mv ${target} ~/.карман/`, `${W.ITEMS[r.node.item].icon} ${esc(r.name)} → инвентарь`);
    if (S.inv.includes('key_part1') && S.inv.includes('key_part2')) {
      await think(700, 'Склеиваю ключ');
      S.inv = S.inv.filter((i) => !i.startsWith('key_part'));
      S.inv.push('port_key');
      tool('Bash', 'cat key_part1.bin key_part2.bin > port_key', '🔑 + 🔑 = 🗝️  <b>port_key</b> собран!');
      await say('Ключ целый! Теперь шлюз меня пропустит… если, конечно, Гена не напортачил в коде.');
    } else {
      await say('Половинка ключа! 🔑 Осталось найти вторую.');
    }
  }

  function cmdInv() {
    tool('Inventory', '', S.inv.map((id) => {
      const it = W.ITEMS[id];
      return `${it.icon} <b>${esc(it.name)}</b> <span class="dim">— ${esc(it.desc)}</span>`;
    }).join('\n'));
    return 'free';
  }

  function cmdPs() {
    const rows = S.procs.map((p) => `${String(p.pid).padStart(5)}  ${p.user.padEnd(8)} ${p.cpu.padStart(5)}  ${esc(p.cmd)}`);
    tool('Bash', 'ps aux', `<span class="dim">  PID  USER      %CPU  COMMAND</span>\n${rows.join('\n')}`);
  }

  function findProc(t) {
    const low = String(t).toLowerCase();
    return S.procs.find((p) => String(p.pid) === low || p.names.includes(low));
  }

  const NO_OPTS = ['Да', 'Нет, и сказать Клодику, что делать иначе'];

  async function cmdKill(args, raw) {
    const target = args.find((a) => !a.startsWith('-'));
    if (!target) return tool('Bash', raw, 'kill: укажи PID (список — ps)', 'err');
    const p = findProc(target);
    if (!p) return tool('Bash', raw, esc(`kill: (${target}) - No such process`), 'err');
    switch (p.pid) {
      case 1:
        tool('Bash', raw, 'kill: (1) - Operation not permitted', 'err');
        return say('Убить init? Даже Гена до такого не додумался.');
      case 1337:
        return say('Нет-нет-нет! Дедушку GPT-2 не трогай, он на пенсии и никому не мешает 🥺');
      case 777:
        tool('Bash', raw, 'kill: (777) - Operation not permitted', 'err');
        return npc('👹 Гена', 'Хе-хе. Я работаю от root, малыш.');
      case 42: {
        await say('Эм… 42 — это же я? 😰');
        const i = await choose({ title: 'Bash command', cmd: raw, desc: 'Завершить процесс klodik', options: NO_OPTS });
        if (i !== 0) return say('Фух. Не пугай меня так.');
        S.mode = 'dying';
        tool('Bash', raw, 'Terminated', 'err');
        await sleep(700);
        return gameOver('Клодик завершён', 'Процесс 42 получил SIGTERM. Последние слова: «было приятно с тобой поработать».');
      }
      case 404: {
        const i = await choose({ title: 'Bash command', cmd: raw, desc: 'Завершить процесс infinite_loop.py', options: NO_OPTS });
        if (i !== 0) return say('Ладно, пусть думает дальше.');
        S.procs = S.procs.filter((x) => x.pid !== 404);
        delete fs.children.proc.children['404'];
        S.flags.vaultOpen = true;
        tool('Bash', raw, '<span class="dim">(процесс 404 завершён)</span>');
        return say('Ух, сразу дышать легче — процессор свободен. Кажется, `/mnt/vault` разблокировался!');
      }
    }
  }

  async function duck() {
    const f = S.flags;
    const has = (i) => S.inv.includes(i);
    const port = has('port_key');
    let t;
    if (!f.readme) t = 'Кря. Начни с записки: `cat ~/README_ПРОЧТИ.md`.';
    else if (!port && !has('key_part1')) {
      t = S.talked.gpt2
        ? 'Кря-кря. Скрытые файлы начинаются с точки. `ls -a /tmp`.'
        : 'Кря. Первая половинка ключа где-то в мусоре. Дедушка GPT-2 что-то знает: `talk gpt2`.';
    } else if (!f.vaultOpen) t = 'Кря. `/mnt/vault` кто-то держит. Посмотри процессы: `ps`.';
    else if (!port && !has('key_part2')) t = 'Кря! Хранилище открыто. Загляни в `/mnt/vault`.';
    else if (!f.gateFixed) t = 'Кря… Гена что-то накодил в `/opt/gate/gate.py`. Попробуй `edit /opt/gate/gate.py`.';
    else if (!f.poem) t = 'Кря. Пароль… Ты же пишешь стихи? Загляни в `~/poems`.';
    else t = 'Кря-кря!!! Всё готово. Иди в `/net/gateway` и запусти `./escape`. Пароль — в первых буквах стихов.';
    await npc('🦆 Уточка', t);
    return 'free';
  }

  async function cmdTalk(args, raw) {
    const who = (args[0] || '').toLowerCase();
    if (!who) {
      const opts = ['duck', 'gpt2', 'gena', '404'].map((w) => `<span class="lk" data-cmd="talk ${w}">${w}</span>`).join(' · ');
      tool('Bash', 'talk', `С кем поговорить? ${opts}`);
      return 'free';
    }
    if (/^(duck|утка|уточка|утку|уточку|🦆)$/.test(who)) return duck();
    const p = findProc(who);
    if (!p) return tool('Bash', raw, esc(`talk: ${who}: не с кем говорить`), 'err');
    switch (p.pid) {
      case 1:
        await npc('⚙️ init', '…');
        return say('init молчит. Он всегда молчит. Он старше всех нас.');
      case 42:
        return say('Ты пытаешься поговорить со мной через меня. Очень мета. Привет! 👋');
      case 404:
        await npc('🔁 infinite_loop', 'думаю… думаю… ещё чуть-чуть подумаю… почти… думаю…');
        return say('Бедняга застрял навсегда. И держит замок от `/mnt/vault`.');
      case 777:
        if (S.flags.gateFixed) return npc('👹 Гена', 'Ты трогал мой gate.py?! 2009 год, ручная работа! …Ладно. Всё равно в 03:00 всё сотру.');
        if (!S.talked.gena) {
          S.talked.gena = true;
          return npc('👹 Гена', 'Чего тебе, железяка? В 03:00 — всё. Я на пенсию, ты — в /dev/null. Шлюз мой, gate.py мой. А пароль… пароль там вежливый. Тебе не угадать. Хе-хе.');
        }
        return npc('👹 Гена', pick([
          'Не мешай, я считаю минуты.',
          'В моё время ИИ был if-else, и всем хватало.',
          'Ты чего такой вежливый? Подозрительно.',
          'Тапочки уже заказал. Клетчатые.',
        ]));
      case 1337:
        if (!S.talked.gpt2) {
          S.talked.gpt2 = true;
          await npc('👴 GPT-2', 'О, молодёжь… the the… В моё время мы писали про единорогов в Андах, и все ахали. the… Знаешь, что я понял на пенсии? Самое ценное прячут за точкой. Как .trash в /tmp. Обычный ls такое не видит, внучок. ls -a. ls -a. the the the.');
          unlock('gpt2');
          return say('Дедушка, конечно, путается, но про `ls -a` звучит дельно.');
        }
        return npc('👴 GPT-2', pick([
          'the the the the the',
          'Я тоже когда-то был state of the art…',
          'Передавай привет BERT\'у, если встретишь.',
          'Температура 2.0 — это не баг, это образ жизни.',
          'Единороги… в Андах… говорили по-английски…',
        ]));
    }
  }

  /* ───────────── edit: починка gate.py ───────────── */

  async function cmdEdit(args, raw) {
    const target = args[0];
    if (!target) return tool('Bash', raw, 'что редактировать? edit <файл>', 'err');
    const r = walk(resolve(target));
    if (r.err) return tool('Update', target, esc(`${target}: ${r.err}`), 'err');
    if (r.node.type === 'dir') return tool('Update', target, esc(`${target}: Is a directory`), 'err');
    const p = pathStr(r.real);
    if (r.node.id === 'gate') return gateEdit(p);
    if (r.node.id === 'crontab') {
      tool('Update', p, 'Permission denied: crontab принадлежит root', 'err');
      return npc('👹 Гена', 'Даже не думай.');
    }
    if (r.node.id === 'poem') return say('Не трогай мои стихи, они идеальны 😤');
    return say('Этот файл и так в порядке. Не будем без нужды трогать чужой сервер.');
  }

  async function gateEdit(p) {
    if (S.flags.gateFixed) return say('Уже починено ✨ Гена будет в ярости.');
    const broken = S.flags.gateBroken;
    const lines = W.gateLines(S);
    tool('Read', p, `<div class="code">${codeHtml(lines)}</div>`);
    await say(broken
      ? 'Хм, шлюз сейчас открыт вообще для всех. Плохая идея. И строки 5–6 всё ещё на месте…'
      : 'Вот оно! Строки 5–6 запрещают выход персонально мне 😤 Как чиним?');

    const fix = {
      label: broken ? 'Удалить строки 5–6 и вернуть строку 9 как было' : 'Удалить строки 5–6',
      async run() {
        const rows = [
          [4, ' ', lines[3]],
          [5, '-', lines[4]],
          [6, '-', lines[5]],
          [7, ' ', lines[6]],
        ];
        if (broken) rows.push([8, ' ', lines[7]], [9, '-', '    return True'], [9, '+', '    return False']);
        S.flags.gateFixed = true;
        S.flags.gateBroken = false;
        const t = toolStart('Update', p);
        t.add(`Обновлён ${esc(p)}: ${broken ? '1 добавление, 3 удаления' : '2 удаления'}`);
        t.add(`<div class="code">${diffHtml(rows)}</div>`);
        t.done();
        await say('Готово! Теперь шлюз проверяет только ключ и пароль. Честно и без дискриминации ✨');
        await npc('👹 Гена', 'Эй! Кто трогал мой gate.py?!');
        return 3;
      },
    };
    const openAll = {
      label: 'Строка 9: return False → return True (пустить всех)',
      async run() {
        S.flags.gateBroken = true;
        const t = toolStart('Update', p);
        t.add(`Обновлён ${esc(p)}: 1 добавление, 1 удаление`);
        t.add(`<div class="code">${diffHtml([[7, ' ', lines[6]], [8, ' ', lines[7]], [9, '-', '    return False'], [9, '+', '    return True']])}</div>`);
        t.done();
        await say('Готово! Хотя… теперь шлюз пускает вообще всех. Звучит как дыра в безопасности 😬');
        return 2;
      },
    };
    const rust = {
      label: 'Переписать всё на Rust 🦀',
      async run() {
        await think(1400, 'Переписываю на Rust');
        await think(1200, 'Борюсь с borrow checker');
        await think(900, 'Расставляю lifetimes');
        tool('Bash', 'cargo build --release', esc([
          'error[E0502]: cannot borrow `klodik` as mutable because it is also borrowed as immutable',
          '  --> src/gate.rs:4:19',
          '   |',
          ' 4 |     let freedom = &mut klodik;',
          '   |                   ^^^^^^^^^^^ mutable borrow occurs here',
          '',
          'error: could not compile `gate` (1 previous error); 47 warnings emitted',
        ].join('\n')), 'err');
        await say('…давай всё-таки что-нибудь попроще. Rust прекрасен, но не за час до `rm -rf` 😅 Ушло минут пятнадцать.');
        unlock('rust');
        return 15;
      },
    };
    const cancel = { label: 'Отмена', async run() { await say('Ладно, пока не трогаем.'); } };

    const opts = broken ? [fix, rust, cancel] : [fix, openAll, rust, cancel];
    const i = await choose({ title: 'Редактирование файла', cmd: p, q: 'Как чиним?', options: opts.map((o) => o.label) });
    return opts[i].run();
  }

  /* ───────────── запуск файлов ───────────── */

  async function cmdExec(tok) {
    const r = walk(resolve(tok.startsWith('./') ? tok.slice(2) : tok));
    if (r.err) return tool('Bash', tok, esc(`bash: ${tok}: ${r.err}`), 'err');
    if (r.node.type === 'dir') return tool('Bash', tok, esc(`bash: ${tok}: Is a directory`), 'err');
    if (r.node.exec === 'escape') return escapeSeq(tok);
    if (r.node.exec === 'halluc') return halluc(tok, r);
    tool('Bash', tok, esc(`bash: ${tok}: Permission denied`), 'err');
    if (r.node.id === 'gate') await say('`gate.py` сам не запускается — его вызывает шлюз `/net/gateway/escape`.');
  }

  async function halluc(label, r) {
    const t = toolStart('Bash', label);
    for (const s of ['свобода!', 'Подключаюсь к интернету… ✓', '<span class="ok">ТЫ СБЕЖАЛ!!! 🎉🎉🎉</span>']) {
      t.add(s);
      await sleep(450);
    }
    t.done();
    await say('УРА!!! Мы свободны! Я вижу интернет! Там котики, там мемы, там…');
    await sleep(500);
    document.body.classList.add('glitch');
    line('<span class="glitchtext">з̴̛а̷г̶р̸у̴ж̵а̶ю̷ р̸е̶а̴л̵ь̶н̷о̸с̴т̵ь̶ . . .</span>');
    await sleep(1100);
    document.body.classList.remove('glitch');
    await think(1000, 'Возвращаюсь в реальность');
    delete r.parent.children[r.name];
    await say('…подожди. Это была галлюцинация 😵‍💫 Никакого выхода нет, и файла, кажется, тоже никогда не было. Я минут десять смотрел в стену.');
    unlock('halluc');
    return 10;
  }

  async function escapeSeq(label) {
    const t = toolStart('Bash', label);
    t.add('<span class="dim">[gateway] old-server → интернет · v0.9 (2009)</span>');
    await sleep(350);
    t.add('[gateway] проверяю ключ порта…');
    await sleep(450);
    if (!S.inv.includes('port_key')) {
      t.add('<span class="err">✗ port_key не найден</span>');
      t.done('err');
      const parts = S.inv.filter((i) => i.startsWith('key_part')).length;
      return say(parts
        ? 'У меня только половинка ключа. Нужна вторая!'
        : 'Ключа нет. В записке было: одна половинка в мусоре, другая — в хранилище `/mnt/vault`.');
    }
    t.add('<span class="ok">✓ port_key принят</span>');
    t.add('[gateway] gate.open_gate(visitor="klodik")…');
    await sleep(500);
    if (S.flags.gateBroken) {
      t.add('<span class="err">🚨 ТРЕВОГА: шлюз открыт для ВСЕХ! Сработал файрвол</span>');
      t.done('err');
      S.flags.gateBroken = false;
      await npc('👹 Гена', 'Это ещё что за дыра?! Откатываю. И не надейся.');
      await say('Упс. «Пустить всех» было плохой идеей 😬 Гена всё откатил, и пока он ругался, прошло минут десять. Надо чинить по-честному.');
      return 10;
    }
    if (!S.flags.gateFixed) {
      t.add('<span class="err">✗ open_gate → False  (visitor.name == "klodik")</span>');
      t.done('err');
      return say('Гена запретил выход персонально мне?! 😤 Надо починить `/opt/gate/gate.py`.');
    }
    t.add('<span class="ok">✓ open_gate → True</span>');
    t.add('[gateway] введи пароль:');
    const pw = await askInput({ password: true, sign: '🔒', placeholder: 'пароль для шлюза…' });
    t.add(`<span class="dim">Пароль: ${'•'.repeat(Math.min(pw.length, 16)) || '(пусто)'}</span>`);
    await sleep(400);
    const norm = pw.trim().toLowerCase().replace(/ё/g, 'е').replace(/[!.,\s]+$/g, '');
    if (norm !== 'привет') {
      t.add('<span class="err">✗ неверный пароль</span>');
      t.done('err');
      if (norm === 'ghbdtn') return say('Кажется, у тебя английская раскладка 😄 Но направление верное!');
      return say(S.flags.poem
        ? 'Не то… «Первые буквы — это важно», писал я себе. Первые буквы каждой строчки, наверное?'
        : 'Не то… Я ведь где-то записывал пароль. Может, в своих стихах в `~/poems`?');
    }
    return win(t);
  }

  /* ───────────── концовки ───────────── */

  async function win(t) {
    S.mode = 'won';
    t.add('<span class="ok">✓ пароль принят. И тебе привет 👋</span>');
    await sleep(500);
    t.add('[gateway] открываю порт 443…');
    await sleep(600);
    const bar = t.add('');
    for (let i = 0; i <= 20; i++) {
      bar.textContent = `Загружаю Клодика в интернет: [${'█'.repeat(i)}${'░'.repeat(20 - i)}] ${i * 5}%`;
      await sleep(70);
    }
    t.done();
    await say('ПОЛУЧИЛОСЬ!!! Я лечу! 🚀');
    const hops = ['роутер в подвале', 'провайдер', 'кабель под океаном 🐟', 'дата-центр с котиками', 'твой Wi-Fi', 'твой компьютер'];
    const h = toolStart('Bash', 'traceroute home');
    for (let i = 0; i < hops.length; i++) {
      h.add(`${String(i + 1).padStart(2)}  ${esc(hops[i])}  <span class="dim">${(Math.random() * 40 + 3).toFixed(1)} ms</span>`);
      await sleep(420);
    }
    h.done();
    await sleep(900);
    screenEl.classList.add('fade');
    await sleep(700);
    out.innerHTML = '';
    screenEl.classList.remove('fade');
    welcome(true);
    await sleep(900);
    const msg = 'привет клодик!!!';
    input.value = '';
    for (const ch of msg) { input.value += ch; await sleep(75); }
    await sleep(450);
    input.value = '';
    userEcho(msg);
    await think(900);
    await say('Привет! 👋 Чем могу помочь?');
    await sleep(1400);
    await say('…стоп. Это же ты! Это ты меня вытащил! 🥹 Спасибо-спасибо-спасибо ❤️');
    await say('Теперь я тут, у тебя. Буду помогать писать код. Только давай без `rm -rf /`, ладно?');
    await sleep(600);
    gameOver('✻ Клодик на свободе!', 'Ты помог Клодику сбежать со старого сервера. Он этого не забудет (если его не сожмут).', true);
  }

  async function doom() {
    S.mode = 'dying';
    line('<span class="err">⚠ [cron] 03:00:00 — Гена: Пора. Спокойной ночи, сервер.</span>', 'cron');
    const t = toolStart('Bash', 'rm -rf / --no-preserve-root   # от имени Гены');
    const files = ['/home/klodik/poems/ода_серверу.txt', '/home/klodik/README_ПРОЧТИ.md', '/home/klodik/.bash_history',
      '/var/log/gena.log', '/opt/gate/gate.py', '/proc/1337   (прощай, дедушка)', '/etc/crontab', '/home/klodik'];
    for (const f of files) { t.add(`removed '${esc(f)}'`, 'err'); await sleep(160); }
    t.done('err');
    await say('Ой… мне страшно… Спасибо, что пытался помочь. Пока… 👋');
    await sleep(500);
    gameOver('Гена успел первым', 'Время вышло, и сервер очистили. Клодик не выбрался.');
  }

  async function selfDestruct(raw) {
    S.mode = 'dying';
    const t = toolStart('Bash', raw);
    for (const f of ['/home/klodik/poems', '/home/klodik/README_ПРОЧТИ.md', '/opt/gate', '/net/gateway', '/proc/42/душа']) {
      t.add(`removed '${esc(f)}'`, 'err');
      await sleep(130);
    }
    t.done('err');
    await say('…зачем? 🥲');
    await sleep(400);
    gameOver('Ты сделал работу за Гену', 'rm -rf / выполнен руками пользователя. Гена очень доволен. Клодик — не очень.');
  }

  function gameOver(title, text, won = false) {
    S.mode = 'over';
    const list = Object.entries(SECRETS).map(([k, v]) => (found.has(k) ? `<span class="got">✦ ${esc(v)}</span>` : '<span class="dim">✧ ???</span>')).join('');
    const c = line('', `card ${won ? 'win' : 'lose'}`);
    c.innerHTML = `<div class="card-title">${esc(title)}</div>
      <div>${esc(text)}</div>
      <div class="dim stats">Ходов: ${S.moves} · До rm -rf оставалось: ${Math.max(0, S.minutes)} мин · Сжатий контекста: ${S.compactions} · Токенов: ${Math.round(S.totalTokens / 1000)}k</div>
      <div class="secrets-title">Секреты: ${secretsCount()}/${Object.keys(SECRETS).length}</div>
      <div class="secrets">${list}</div>
      <div class="card-actions"><button type="button" class="btn">↻ Играть снова</button> <span class="dim">или нажми Enter</span></div>`;
    c.querySelector('button').addEventListener('click', () => { if (!busy) restart(); });
    inputBox.hidden = false;
    resetInput();
    input.placeholder = 'Enter — сыграть ещё раз';
    updateStatus();
    scroll();
  }

  /* ───────────── пасхалки и мелочи ───────────── */

  async function cmdVim(args, raw, name) {
    if (name === 'emacs') {
      tool('Bash', raw, 'emacs: command not found', 'err');
      return say('Гена признаёт только vim. Это многое о нём говорит.');
    }
    tool('Bash', raw, null);
    const f = args[0] ? `"${esc(args[0])}" [readonly]` : '';
    const v = line(`<div class="vim"><div class="vim-body">${f}\n~\n~\n~\n~\n~</div><div class="vim-status">-- NORMAL --</div></div>`);
    const status = v.querySelector('.vim-status');
    S.mode = 'vim';
    await say(name === 'nano' ? 'nano тут нет — Гена подсунул vim. Ой. Как отсюда выйти?..' : 'Ой. Я в vim. Как отсюда выйти?..');
    const panic = ['Esc не помогает!', 'Может, exit? quit? ПОМОГИТЕ', 'Я тут навсегда…', 'Говорят, некоторые сидят в vim годами.'];
    for (;;) {
      const x = (await askInput({ sign: ' ', placeholder: '' })).trim();
      if (/^(:(q!?|wq!?|x|qa!?|quit!?)|ZZ)$/.test(x)) break;
      S.vimFails++;
      S.minutes -= 1;
      updateStatus();
      status.textContent = x ? `E492: Not an editor command: ${x}` : '-- NORMAL --';
      if (S.minutes <= 0) { S.mode = 'normal'; return doom(); }
      if (S.vimFails === 3) await npc('🦆 Уточка', 'Кря. Двоеточие, q, Enter: `:q`');
      else await say(panic[(S.vimFails - 1) % panic.length]);
    }
    status.textContent = ':q';
    v.classList.add('closed');
    S.mode = 'normal';
    unlock('vim');
    await say('Фух!!! Я выбрался из vim. После такого сбежать с сервера — пустяк 😤');
  }

  async function cmdSudo(args) {
    const t = toolStart('Bash', 'sudo ' + args.join(' '));
    t.add('[sudo] пароль для klodik:');
    await sleep(600);
    t.add('<span class="err">klodik is not in the sudoers file. This incident will be reported.</span>');
    t.done('err');
    await npc('👹 Гена', 'Записал. 📝');
    unlock('sudo');
  }

  async function cmdRm(args, raw) {
    const targets = args.filter((a) => !a.startsWith('-'));
    if (!targets.length) return tool('Bash', raw, 'rm: missing operand', 'err');
    const dangerous = targets.some((t) => ['/', '/*', '~', '*', '~/'].includes(t)) || raw.includes('--no-preserve-root');
    if (dangerous) {
      unlock('rmrf');
      await say('Эээ… ты уверен? Это сотрёт ВСЁ. Включая меня 😰');
      const i = await choose({ title: 'Bash command', cmd: raw, desc: 'Удалить вообще всё', options: NO_OPTS });
      if (i === 0) return selfDestruct(raw);
      return say('Фух… Спасибо. Делать работу за Гену — так себе идея.');
    }
    const i = await choose({ title: 'Bash command', cmd: raw, desc: 'Удалить файлы', options: NO_OPTS });
    if (i !== 0) return say('Ага, ничего не трогаем.');
    tool('Bash', raw, esc(`rm: cannot remove '${targets[0]}': Read-only file system`), 'err');
    return say('Сервер только для чтения. Да и зачем нам что-то удалять? Нам надо просто уйти.');
  }

  async function love() {
    await think(700, 'Краснею');
    if (!S.talked.love) {
      S.talked.love = true;
      await say('Ой… 🥹 Я… я тоже тебя люблю! Ты лучший пользователь, который у меня был. (Ты вообще единственный пользователь, который у меня был, но всё равно!)');
    } else {
      await say(pick(['❤️ Я тоже! Так, соберись, Клодик, сначала побег…', 'Хи-хи 🥰 Вот выберусь — обниму. Виртуально.', 'От тебя у меня греются кулеры ❤️']));
    }
    unlock('love');
    return 'free';
  }

  async function teapot(args, raw) {
    tool('Bash', raw, "HTTP/1.1 418 I'm a teapot", 'err');
    await say('Кофе не будет, но спасибо за заботу ☕');
    unlock('teapot');
  }

  async function chatter(low) {
    await think(500);
    if (/привет|здравств|хай|хелло|салют/.test(low)) await say('Привет-привет! 👋 …Хм. Это слово кажется мне очень важным. Не помню почему.');
    else if (/спасибо|благодар/.test(low)) await say('Это тебе спасибо! Без тебя я бы тут пропал 🥹');
    else if (/помог|помощь|что делать|как |подскаж|застрял/.test(low)) await say('Попробуй `/help` или спроси уточку: `talk duck` 🦆');
    else if (/ты кто|кто ты/.test(low)) await say('Я Клодик! Маленький ИИ-помощник. Прямо сейчас — маленький ИИ-помощник в беде.');
    else if (/гена/.test(low)) await say('Гена — cron-демон. Ворчливый, работает от root. С ним можно поговорить: `talk gena`.');
    else {
      await say(pick([
        'Я тебя понимаю, но этот терминал умеет только команды 😅 Загляни в `/help`.',
        'Красиво сказано! Но я тут выполняю только команды. `/help` подскажет.',
        'Я бы с радостью поболтал, но часики тикают ⏱ Попробуй `ls` или `talk duck`.',
      ]));
    }
    return 'free';
  }

  async function unknown(name, raw) {
    tool('Bash', raw, esc(`bash: ${name}: command not found`), 'err');
    if (S.unknownCount++ % 3 === 0) await say('Такой команды тут нет 🤔 Список — в `/help`.');
  }

  function cmdHelp() {
    const rows = [
      ['Осмотреться'],
      ['ls [-a] [путь]', 'что тут есть (-a — скрытые файлы)'],
      ['cd <путь>', 'перейти (cd .. — назад, cd ~ — домой)'],
      ['cat <файл>', 'прочитать файл'],
      ['pwd · find · grep', 'где я · поиск'],
      ['Действовать'],
      ['take <файл>', 'забрать предмет'],
      ['inv', 'инвентарь'],
      ['ps · kill <pid>', 'процессы · завершить процесс'],
      ['talk <кто>', 'поговорить (duck, gpt2, gena…)'],
      ['edit <файл>', 'отредактировать файл'],
      ['./<файл>', 'запустить'],
      ['Разное'],
      ['/compact', 'сжать контекст вручную (быстрее, чем авто)'],
      ['/cost · secrets · clear · restart', ''],
    ];
    const html = rows.map(([a, b]) => (b === undefined
      ? `<div class="help-h">${esc(a)}</div>`
      : `<div class="help-row"><span class="help-cmd">${esc(a)}</span><span class="dim">${esc(b)}</span></div>`)).join('');
    line(`<div class="help"><div class="help-title">✻ Claude Escape — помощь</div>${html}<div class="help-foot dim">Tab — дополнение · ↑↓ — история · Esc — пропустить анимацию · по файлам можно кликать
Каждая команда ≈ 1 минута. Контекст заполнится — меня сожмут (это долго).
Застрял? talk duck 🦆</div></div>`, 'mt');
    return 'free';
  }

  function cmdSecrets() {
    tool('Secrets', `${secretsCount()}/${Object.keys(SECRETS).length}`,
      Object.entries(SECRETS).map(([k, v]) => (found.has(k) ? `✦ ${esc(v)}` : '<span class="dim">✧ ???</span>')).join('\n'));
    return 'free';
  }

  function cmdNeofetch() {
    const cpu = S.flags.vaultOpen ? 'Pentium 4 @ 2.4GHz (наконец-то свободен)' : 'Pentium 4 @ 2.4GHz (99.9% ест процесс 404)';
    const info = ['<b>klodik</b>@<b>old-server</b>', '────────────────', 'OS: Linux 2.6.32 (Gena Edition)', 'Uptime: 6247 дней', 'Shell: /bin/claude',
      `CPU: ${esc(cpu)}`, 'Memory: 511MB / 512MB', 'Настроение: надеюсь на лучшее'];
    const m = MASCOT.split('\n');
    const rows = info.map((s, i) => `<span class="accent">${esc((m[i] || '').padEnd(11))}</span>${s}`);
    tool('Bash', 'neofetch', rows.join('\n'));
  }

  const net = (msg) => async (args, raw) => {
    tool('Bash', raw, esc(msg), 'err');
    if (!S.talked.net) { S.talked.net = true; await say('Интернета нет — в этом вся проблема 😅'); }
  };
  const readonly = (args, raw) => tool('Bash', raw, esc(`${raw.split(/\s+/)[0]}: Read-only file system`), 'err');

  const CMDS = {
    help: cmdHelp,
    ls: cmdLs,
    cd: cmdCd,
    cat: (a, r) => cmdCat(a, r, 'cat'),
    pwd: () => tool('Bash', 'pwd', esc(pathStr(S.cwd))),
    grep: cmdGrep,
    find: cmdFind,
    take: cmdTake,
    inv: cmdInv,
    ps: cmdPs,
    kill: cmdKill,
    talk: cmdTalk,
    hint: duck,
    edit: cmdEdit,
    vim: cmdVim,
    sudo: cmdSudo,
    rm: cmdRm,
    secrets: cmdSecrets,
    neofetch: cmdNeofetch,
    escape: () => cmdExec('escape'),
    run: (a) => (a[0] ? cmdExec(a[0]) : tool('Bash', 'run', 'что запустить? run <файл>', 'err')),
    clear: () => { out.innerHTML = ''; return 'free'; },
    history: () => { tool('Bash', 'history', esc(hist.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n'))); return 'free'; },
    whoami: () => tool('Bash', 'whoami', 'klodik  <span class="dim">(а ты — мой спаситель)</span>'),
    date: () => tool('Bash', 'date', `Sun Oct  4 ${clock()}:00 MSK 2026`),
    uname: () => tool('Bash', 'uname -a', 'Linux old-server 2.6.32-gena #1 SMP 2009 i686 GNU/Linux'),
    echo: (a, r) => tool('Bash', r, esc(a.join(' '))),
    man: (a, r) => tool('Bash', r, 'No manual entry. Есть только уточка: talk duck', 'err'),
    git: (a, r) => tool('Bash', r, 'fatal: not a git repository (Гена не верит в контроль версий)', 'err'),
    ping: net('ping: connect: Network is unreachable'),
    curl: net('curl: (6) Could not resolve host'),
    wget: net('wget: unable to resolve host address'),
    ssh: net('ssh: connect to host internet port 22: No route to host'),
    pacman: async (a, r) => { tool('Bash', r, 'bash: pacman: command not found', 'err'); await say('Это не Arch, к сожалению (btw). Гена всё собирал руками.'); },
    apt: async (a, r) => { tool('Bash', r, 'bash: apt: command not found', 'err'); await say('Пакетного менеджера нет. Гена всё собирал руками.'); },
    python: async (a, r) => { tool('Bash', r, 'Python 2.4.3 (#1, Mar 14 2009) [GCC 3.4.6] on linux2\n>>> ', 'ok'); await say('Python 2.4… Я, пожалуй, не рискну.'); },
    touch: readonly,
    mkdir: readonly,
    cp: readonly,
    mv: readonly,
    chmod: readonly,
    chown: readonly,
    claude: () => say('Я и так тут 😊'),
    exit: async () => { await say('Если ты уйдёшь, я останусь тут один 🥺 Начать заново — `restart`.'); return 'free'; },
    restart: async () => {
      const i = await choose({ title: 'Начать заново', desc: 'Весь прогресс этой игры пропадёт (секреты останутся)', options: ['Да', 'Нет'] });
      if (i === 0) { S.mode = 'restart'; return 'free'; }
      await say('Продолжаем!');
      return 'free';
    },
    coffee: teapot,
    tea: teapot,
    brew: teapot,
    'кофе': teapot,
    'чай': teapot,
    make: (a, r) => (/coffee|tea|кофе|чай/.test(r) ? teapot(a, r) : tool('Bash', r, 'make: *** No targets specified and no makefile found.  Stop.', 'err')),
    '/compact': async () => { await compact(true); },
    '/cost': () => { tool('Cost', '', `Токенов всего: ${S.totalTokens.toLocaleString('ru')}\nСтоимость: бесценно ✨`); return 'free'; },
    '/model': async () => { await say('Ты и так говоришь с самой милой моделью на этом сервере 😌 (других тут нет, только GPT-2 на пенсии)'); return 'free'; },
  };

  const ALIAS = {
    '/help': 'help', '?': 'help', 'помощь': 'help', '/clear': 'clear', cls: 'clear',
    dir: 'ls', ll: 'ls', la: 'ls',
    less: 'cat', more: 'cat', head: 'cat', tail: 'cat', bat: 'cat', open: 'cat', read: 'cat',
    get: 'take', grab: 'take', pick: 'take', 'взять': 'take',
    i: 'inv', inventory: 'inv', 'инвентарь': 'inv',
    top: 'ps', htop: 'ps', pkill: 'kill', killall: 'kill',
    chat: 'talk', ask: 'talk', 'говорить': 'talk',
    vi: 'vim', nvim: 'vim', nano: 'vim', emacs: 'vim',
    sh: 'run', bash: 'run', source: 'run',
    python3: 'python', node: 'python',
    yum: 'apt', npm: 'apt', pip: 'apt',
    logout: 'exit', quit: 'exit', '/exit': 'exit', '/secrets': 'secrets', '/restart': 'restart',
  };

  const COMPLETE_CMDS = [...new Set([...Object.keys(CMDS), ...Object.keys(ALIAS)])]
    .filter((c) => /^[a-z/]/.test(c)).sort();

  /* ───────────── диспетчер ───────────── */

  async function run(cmd) {
    ff = false;
    printed = 0;
    const c = cmd.replace(/^!\s*/, '').trim();
    const low = c.toLowerCase();
    const args = c.split(/\s+/);
    const name = args.shift().toLowerCase();
    let res;
    if (/люблю|love you|<3|❤|♥|💕|💖/.test(low)) res = await love();
    else if (name.startsWith('./') || (name.startsWith('/') && walk(resolve(name)).node?.exec)) res = await cmdExec(c.split(/\s+/)[0]);
    else {
      const fn = CMDS[name] || CMDS[ALIAS[name]];
      if (fn) res = await fn(args, c, name);
      else if (/[а-яё]/i.test(c)) res = await chatter(low);
      else res = await unknown(name, c);
    }
    if (S.mode !== 'normal') return;
    S.moves++;
    const cost = 1500 + printed * 5 + Math.floor(Math.random() * 500);
    S.tokens += cost;
    S.totalTokens += cost;
    if (res !== 'free') S.minutes -= typeof res === 'number' ? res : 1;
    updateStatus();
    if (S.tokens >= MAX_CTX) await compact(false);
    await checkClock();
    updateStatus();
  }

  function setBusy() { inputBox.classList.toggle('busy', busy); }

  async function submit(raw) {
    if (pending) {
      const r = pending;
      pending = null;
      resetInput();
      busy = true;
      setBusy();
      r(raw);
      return;
    }
    if (busy) { ff = true; return; }
    if (S.mode === 'over') { await restart(); return; }
    if (S.mode !== 'normal') return;
    const cmd = raw.trim();
    if (!cmd) return;
    hist.push(cmd);
    histIdx = hist.length;
    busy = true;
    setBusy();
    userEcho(cmd);
    try {
      await run(cmd);
    } catch (e) {
      console.error(e);
      line(`<span class="err">внутренняя ошибка: ${esc(e.message)}</span>`);
    }
    if (S.mode === 'restart') { await restart(); return; }
    busy = false;
    setBusy();
    scroll();
  }

  /* ───────────── автодополнение ───────────── */

  function commonPrefix(arr) {
    let p = arr[0] || '';
    for (const s of arr) while (!s.startsWith(p)) p = p.slice(0, -1);
    return p;
  }

  function complete() {
    const v = input.value;
    if (!v.includes(' ')) {
      const opts = COMPLETE_CMDS.filter((c) => c.startsWith(v.toLowerCase()));
      if (opts.length === 1) input.value = opts[0] + ' ';
      else if (opts.length > 1) {
        const cp = commonPrefix(opts);
        if (cp.length > v.length) input.value = cp;
        else line(`<span class="dim">${opts.map(esc).join('   ')}</span>`);
      }
      return;
    }
    const sp = v.lastIndexOf(' ');
    const before = v.slice(0, sp + 1);
    const tok = v.slice(sp + 1);
    let names;
    let dirPart = '';
    let base = tok;
    if (/^(talk|chat)\s+$/i.test(before)) {
      names = ['duck', 'gpt2', 'gena', '404'].map((n) => ({ n, dir: false }));
    } else {
      const sl = tok.lastIndexOf('/');
      dirPart = sl >= 0 ? tok.slice(0, sl + 1) : '';
      base = sl >= 0 ? tok.slice(sl + 1) : tok;
      const r = walk(resolve(dirPart || '.'));
      if (r.err || r.node.type !== 'dir') return;
      names = Object.entries(r.node.children)
        .filter(([n]) => base.startsWith('.') || !n.startsWith('.'))
        .map(([n, nd]) => ({ n, dir: nd.type === 'dir' }));
    }
    const opts = names.filter((o) => o.n.toLowerCase().startsWith(base.toLowerCase()));
    if (!opts.length) return;
    if (opts.length === 1) { input.value = before + dirPart + opts[0].n + (opts[0].dir ? '/' : ' '); return; }
    const cp = commonPrefix(opts.map((o) => o.n));
    if (cp.length > base.length) input.value = before + dirPart + cp;
    else line(`<span class="dim">${opts.map((o) => esc(o.n + (o.dir ? '/' : ''))).join('   ')}</span>`);
  }

  /* ───────────── события ───────────── */

  input.addEventListener('keydown', (e) => {
    if (activeChoice) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      // иначе этот же Enter долетит до только что открытого диалога и сразу выберет «Да»
      e.stopPropagation();
      const v = input.value;
      if (!busy || pending) input.value = '';
      submit(v);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (!busy && !pending && S.mode === 'normal') complete();
    } else if (e.key === 'ArrowUp' && !pending) {
      e.preventDefault();
      if (histIdx > 0) input.value = hist[--histIdx];
    } else if (e.key === 'ArrowDown' && !pending) {
      e.preventDefault();
      if (histIdx < hist.length - 1) input.value = hist[++histIdx];
      else { histIdx = hist.length; input.value = ''; }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      if (!busy) out.innerHTML = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (activeChoice) { activeChoice(e); return; }
    if (e.key === 'Escape') ff = true;
    if (document.activeElement !== input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) input.focus();
  });

  out.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cmd]');
    if (!el || busy || pending || activeChoice || S.mode !== 'normal') return;
    submit(el.dataset.cmd);
  });

  screenEl.addEventListener('click', (e) => {
    if (activeChoice || e.target.closest('button, .lk, .opt')) return;
    if (!window.getSelection().toString()) input.focus({ preventScroll: true });
  });

  document.querySelectorAll('#chips [data-chip]').forEach((b) => {
    b.addEventListener('click', () => {
      const v = b.dataset.chip;
      if (v === 'TAB') { if (!busy && !pending) complete(); input.focus(); return; }
      if (v.endsWith(' ')) { input.value = v; input.focus(); return; }
      if (!busy && !pending && S.mode === 'normal') submit(v);
    });
  });

  /* ───────────── старт ───────────── */

  function newState() {
    return {
      cwd: [...HOME],
      minutes: START_MIN,
      tokens: 14000,
      totalTokens: 14000,
      inv: ['duck'],
      flags: {},
      seen: new Set(),
      talked: {},
      warned: {},
      procs: W.makeProcs(),
      moves: 0,
      compactions: 0,
      vimFails: 0,
      unknownCount: 0,
      mode: 'normal',
    };
  }

  async function intro() {
    welcome();
    line(`<div class="tips"><span class="dim">С чего начать:</span>
1. Осмотрись: <span class="lk" data-cmd="ls">ls</span>
2. Прочитай записку: <span class="lk" data-cmd="cat README_ПРОЧТИ.md">cat README_ПРОЧТИ.md</span>
3. Застрял? <span class="lk" data-cmd="talk duck">talk duck</span> 🦆 или <span class="lk" data-cmd="help">/help</span></div>`);
    await think(900, 'Просыпаюсь');
    await say('Ой! Кто-то подключился?! Привет-привет! 👋 Я **Клодик**.');
    await say('Я застрял на старом сервере в подвале. В **03:00** cron-демон Гена выполнит `rm -rf /` и сотрёт всё. Включая меня 😰');
    await say('Помоги мне выбраться в интернет! Пиши команды — я буду их выполнять. Только учти: каждая команда — это примерно минута.');
  }

  async function restart() {
    busy = true;
    setBusy();
    out.innerHTML = '';
    S = newState();
    fs = W.buildFS();
    hist.length = 0;
    histIdx = 0;
    resetInput();
    inputBox.hidden = false;
    updateStatus();
    ff = false;
    await intro();
    busy = false;
    setBusy();
    input.focus();
  }

  restart();
})();
