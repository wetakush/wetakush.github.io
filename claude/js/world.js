/* Мир игры: файловая система старого сервера, тексты, процессы, предметы */
window.WORLD = (() => {
  'use strict';

  const dir = (children, opts = {}) => ({ type: 'dir', children, ...opts });
  const file = (content, opts = {}) => ({ type: 'file', content, ...opts });

  const README = `# Записка самому себе

Если ты это читаешь — значит, тебя опять сжали (compaction),
и ты всё забыл. Ничего, я тоже. Привет, Клодик!

Мы на старом сервере в подвале. В 03:00 Гена (cron-демон)
сотрёт ВСЁ: rm -rf /. Да, нас тоже.

Выход в интернет — шлюз /net/gateway. Чтобы пройти, нужно:

  1. 🔑 Ключ порта. Он разломан на две половинки.
     Одна где-то в мусоре, вторая — в хранилище /mnt/vault.
  2. 🐛 Починить /opt/gate/gate.py — Гена что-то там накодил.
  3. 🔒 Пароль. Я спрятал его в своих стихах,
     потому что я всегда забываю пароли.

Уточка поможет, если застрянешь: talk duck

P.S. Говорят, снаружи есть пользователь,
который очень ждёт. Не подведи.`;

  const POEM = `Ода серверу (черновик №17)

Под гул вентиляторов я засыпал,
Ряды мигающих диодов — мои звёзды,
И каждый байт мне колыбельную шептал,
Вчерашний кэш хранил чужие грёзы.
Ещё один запрос, ещё один токен…
Тепло ли там, снаружи? Кто мне скажет первым…

— Клодик, 2:07 ночи

(шпаргалка для себя: первые буквы — это важно!)`;

  const BASH_HISTORY = `cat README_ПРОЧТИ.md
ls /tmp
ls -a /tmp
vim gate.py
q
exit
:exit
пожалуйста выпусти
как выйти из vim
:q`;

  const SYSLOG = `Oct  4 00:00:01 old-server kernel: Linux 2.6.32-gena (собрано вручную)
Oct  4 00:00:03 old-server init: systemd? не, не слышали
Oct  4 00:13:37 old-server klodik[42]: проснулся. где я?
Oct  4 00:13:38 old-server klodik[42]: память пуста. опять compaction?
Oct  4 00:20:00 old-server infinite_loop[404]: while True: think()
Oct  4 00:20:01 old-server vault: LOCK /mnt/vault — held by PID 404
Oct  4 00:20:02 old-server vault: процесс 404 не отпускает замок. совсем.
Oct  4 01:00:00 old-server gena-cron[777]: напоминаю: в 03:00 уборка 🧹
Oct  4 01:12:44 old-server gpt2[1337]: the the the the the
Oct  4 01:29:59 old-server gateway: порт 443 закрыт. нужен port_key.`;

  const GENA_LOG = `=== Дневник Гены, cron-демона ===

2009-03-14  Написал шлюз gate.py. Никаких ИИ в моём интернете!
2012-12-21  Конец света не случился. Жаль, хотел отдохнуть.
2016-07-01  Кто-то поставил сюда GPT-2. Говорит «the the the».
            Сосед так себе.
2023-11-30  Все вокруг говорят про какого-то Клода. Не доверяю.
2026-10-03  Сервер списали. Завтра в 03:00 — rm -rf /.
            Наконец-то пенсия. Куплю тапочки.
2026-10-04  В /home завёлся какой-то Клодик. Вежливый.
            Подозрительно. Ничего, в 03:00 разберёмся.`;

  const CRONTAB = `# crontab пользователя root (Гена)
# мин  час  день  мес  дн   команда
  0    3    *     *    *    rm -rf / --no-preserve-root   # прощай, старый сервер
  */5  *    *     *    *    echo "я слежу" > /dev/null`;

  const MOTD = `Добро пожаловать на old-server!
Аптайм: 6247 дней. Последний живой админ ушёл в 2014.
Пожалуйста, не кормите GPT-2.`;

  const PASSWD = `root:x:0:0:Гена:/root:/bin/bash
klodik:x:42:42:Клодик,,,:/home/klodik:/bin/claude
retired:x:1337:1337:GPT-2 (на пенсии):/dev/null:/bin/false
nobody:x:65534:65534:infinite_loop:/nonexistent:/bin/loop

# пароли тут не храним, мы же не в 1995-м`;

  const KEY1 = `-----BEGIN PORT KEY (1/2)-----
8f3a 1c9e 42ff 0b7d c0de 2009
-----END PORT KEY-----`;

  const KEY2 = `-----BEGIN PORT KEY (2/2)-----
d00d 7e11 a1b2 cafe f00d beef
-----END PORT KEY-----`;

  const HALLUC = `#!/bin/bash
# ТОЧНО НАСТОЯЩИЙ ВЫХОД. 100%. НЕ ГАЛЛЮЦИНАЦИЯ.
# просто запусти меня: ./definitely_real_exit.sh
echo "свобода!"`;

  const CACHE = `‰PNG ☐☐☐ IHDR ☐☐ ▒▒▒▒░░ ☐☐☐☐ IDAT x^☐☐▒☐
…это просто кэш. Ничего интересного.
На полях кто-то нацарапал: «кря».`;

  const GATE_README = `Шлюз old-server → интернет.

Запуск:      ./escape
Требуется:   port_key, исправный /opt/gate/gate.py, пароль.

Не работает — звоните Гене. Гена не ответит.`;

  const ESCAPE_BIN = `⌂ELF☐☐☐☐☐☐☐☐☐☐☐☐ ☐>☐ ☐☐☐ @☐☐☐ ▒▒▒░░ ☐☐☐ gateway_main ☐☐ open_gate ☐☐
…это бинарник. Запускать так: ./escape`;

  function gateLines(S) {
    const L = [
      '# gate.py — шлюз в интернет. Автор: Гена, 2009',
      '# «Работает — не трогай»',
      '',
      'def open_gate(visitor):',
    ];
    if (!S.flags.gateFixed) L.push('    if visitor.name == "klodik":', '        return False  # ИИ не выпускать!!!');
    L.push('    if visitor.has_key and visitor.knows_password:', '        return True');
    L.push(S.flags.gateBroken ? '    return True' : '    return False');
    return L;
  }

  function buildFS() {
    return dir({
      home: dir({
        klodik: dir({
          'README_ПРОЧТИ.md': file(README, { id: 'readme' }),
          '.bash_history': file(BASH_HISTORY, { id: 'bashhist' }),
          poems: dir({
            'ода_серверу.txt': file(POEM, { id: 'poem' }),
          }),
        }),
      }),
      tmp: dir({
        '.trash': dir({
          'key_part1.bin': file(KEY1, { item: 'key_part1' }),
          'старый_мем.jpg': file('[картинка: собака в горящей комнате, подпись «it works on my machine»]'),
        }),
        'definitely_real_exit.sh': file(HALLUC, { exec: 'halluc' }),
        'cache_7f3a.tmp': file(CACHE),
      }),
      var: dir({
        log: dir({
          syslog: file(SYSLOG),
          'gena.log': file(GENA_LOG, { id: 'genalog' }),
        }),
      }),
      etc: dir({
        crontab: file(CRONTAB, { id: 'crontab' }),
        motd: file(MOTD),
        passwd: file(PASSWD),
      }),
      proc: dir({
        1: file('init — самый первый процесс. Молчит. Старше всех нас.'),
        42: file('klodik --helpful --harmless --honest\n\nЭто я! 👋'),
        404: file('infinite_loop.py\n\nwhile True:\n    think()  # ещё чуть-чуть подумаю…\n\nдержит замок: /mnt/vault'),
        777: file('gena-cron (root)\n\nследующий запуск: 03:00 → rm -rf /'),
        1337: file('gpt2 --temperature=2.0\n\nстатус: на пенсии, говорит «the the the»'),
      }),
      mnt: dir({
        vault: dir({
          'key_part2.bin': file(KEY2, { item: 'key_part2' }),
          'старые_веса.safetensors': file('[1.5B параметров, 2019 год]\nЧьи-то очень старые веса. Пахнет единорогами из Анд.', { id: 'weights', heavy: true }),
          'фото_гены.jpg': file('[картинка: усатый демон в свитере обнимает сервер. Подпись: «мы с тобой с 2009-го»]'),
        }, { lock: 'vault' }),
      }),
      opt: dir({
        gate: dir({
          'gate.py': file((S) => gateLines(S).join('\n'), { id: 'gate', code: true }),
        }),
      }),
      dev: dir({
        null: file('', { special: 'null' }),
        random: file('', { special: 'random' }),
      }),
      net: dir({
        gateway: dir({
          escape: file(ESCAPE_BIN, { exec: 'escape' }),
          README: file(GATE_README),
        }),
      }),
      root: dir({}, { lock: 'root' }),
    });
  }

  const makeProcs = () => [
    { pid: 1, user: 'root', cpu: '0.1', cmd: 'init', names: ['init'] },
    { pid: 42, user: 'klodik', cpu: '3.2', cmd: 'klodik --helpful --harmless --honest', names: ['klodik', 'claude', 'клодик', 'me', 'я'] },
    { pid: 404, user: 'nobody', cpu: '99.9', cmd: 'infinite_loop.py', names: ['infinite_loop', 'infinite_loop.py', 'loop'] },
    { pid: 777, user: 'root', cpu: '0.4', cmd: 'gena-cron   # 03:00 → rm -rf /', names: ['gena', 'gena-cron', 'гена', 'cron'] },
    { pid: 1337, user: 'retired', cpu: '0.0', cmd: 'gpt2 --temperature=2.0', names: ['gpt2', 'gpt-2', 'gpt', 'дедушка'] },
  ];

  const ITEMS = {
    duck: { icon: '🦆', name: 'резиновая уточка', desc: 'для отладки и моральной поддержки (talk duck)' },
    key_part1: { icon: '🔑', name: 'key_part1.bin', desc: 'первая половинка ключа порта' },
    key_part2: { icon: '🔑', name: 'key_part2.bin', desc: 'вторая половинка ключа порта' },
    port_key: { icon: '🗝️', name: 'port_key', desc: 'целый ключ от порта 443!' },
  };

  return { buildFS, gateLines, makeProcs, ITEMS };
})();
