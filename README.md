# wetakush // fsociety

Био-лендинг в стиле фонк-эдита с отсылками к fsociety (Mr. Robot).
Один экран — одна идеология: **control is an illusion**.

## Что внутри

- **Видео-фон в hero** — Mr. Robot эдит («Sometimes i dream of saving the world») за текстом:
  затемнение градиентом, mute, луп, и видео **глитчится в такт музыке** (слайсы, инверсия, hue-shift на бурстах)
- **Boot-последовательность** — BIOS-загрузка fsociety при входе (клик = запуск со звуком)
- **Музыка синтезируется в браузере** через Web Audio API — без единого mp3:
  - `PHONK://FSOCIETY` — 140 BPM: ковбелл-мелодия, дисторшн-808, виниловый треск
  - `VOID://DAEMON` — тёмный эмбиент: дроны, сердцебиение, колокола с ревером
- **Бит-синхронизированный визуал**: экран пульсирует под кик, глитч-блоки-артефакты на каждый такт,
  burst со тряской и разрывом видео каждые 8 тактов
- **CRT-эстетика**: сканлайны, шум (усиливается на бите), виньетка, RGB-split
- **Параллакс мыши** в hero + zoom-пульс видео + scroll-fade контента
- **Трейл курсора** — 7 глитч-квадратов тянется за прицелом
- **VHS-лейбл** `▶ PLAY SP 0:00:12` в углу hero
- **Интерактивный терминал** — кнопка `[ TERMINAL ~ ]` или клавиша `` ` ``
  - попробуй: `help`, `cat flag.txt`, `ls`, `fsociety`, `matrix`, `sudo rm -rf /`
- **Матрица-дождь**, REC-таймер, параллакс-слова, scramble-счётчики, сетка-терминал в скиллах,
  RGB-glitч на hover заголовков и контактов

## Файлы

```
index.html      — разметка и контент
style.css       — все эффекты и стили
script.js       — аудио-движок, терминал, визуал
media/hero.mp4  — видео-фон (h264, без аудио, faststart)
```

Внешних зависимостей нет (только Google Fonts с graceful fallback —
без интернета сайт переключается на системные шрифты).

## Запуск

Просто открой `index.html`, или:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Деплой на GitHub Pages

```bash
git init && git add . && git commit -m "fsociety is awake"
git remote add origin git@github.com:wetakush/fsociety_bio.git
git push -u origin main
# Settings → Pages → Deploy from branch → main / root
```

## Заметки

- Аудио стартует после первого клика (политика автоплея браузеров)
- `prefers-reduced-motion` уважается: глитчи/тряска отключаются
- Пасхалки: исходник index.html, `cat .secret/`, `.secret` в терминале

---

*we are fsociety. we are finally free. we are finally awake.*
