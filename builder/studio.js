/* Site builder studio
   Edits a site config, previews it live in the kit and exports a ready static site as a zip.
   Everything runs in the browser. The draft stays in localStorage on this device. */
(() => {
  'use strict';

  const LANGS = ['en', 'ru', 'th'];
  const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const STORE = 'lanta.studio.v1';
  const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90, 120];
  const CH = { whatsapp: 'WhatsApp', line: 'LINE', telegram: 'Telegram' };
  const SAMPLE_HANDLE = { whatsapp: '66000000000', line: '@sample.shop', telegram: 'sample_shop' };
  const SWATCHES = ['#1f5c46', '#0e7490', '#15803d', '#2f4b8a', '#7a5534', '#8a4b2e', '#8b3a7e', '#44403c'];
  const KIT_FILES = ['site.html', 'site.css', 'site.js'];

  /* ---------- icons ---------- */
  const ICON = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 15.8v.2"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5"/>',
    spa: '<path d="M12 20c-4.4 0-7.5-3-7.5-7.2 3.2 0 5.8 1.6 7.5 4.3 1.7-2.7 4.3-4.3 7.5-4.3 0 4.2-3.1 7.2-7.5 7.2z"/><path d="M12 17.1c-1.7-2.2-2.5-4.5-2.5-6.8 0-2.5 1-4.7 2.5-6.6 1.5 1.9 2.5 4.1 2.5 6.6 0 2.3-.8 4.6-2.5 6.8z"/>',
    tours: '<path d="M3 15.5l1.8 4h14.4l1.8-4H3z"/><path d="M12 3.5v12M12 3.5l6.5 9.5H12"/>',
    bike: '<circle cx="5.8" cy="17" r="2.6"/><circle cx="18.2" cy="17" r="2.6"/><path d="M8.4 17h6.2l2.4-7h-4.2M14.6 5h2.6l1.1 5M5.8 14.4l2.4-4.4h5"/>',
    dental: '<path d="M8 3.8c-2.4 0-4 1.9-4 4.4 0 2 .8 3.4 1.5 5.1.8 2 1 7 2.9 7 1.6 0 1.7-5 3.6-5s2 5 3.6 5c1.9 0 2.1-5 2.9-7 .7-1.7 1.5-3.1 1.5-5.1 0-2.5-1.6-4.4-4-4.4-1.6 0-2.5.9-4 .9s-2.4-.9-4-.9z"/>',
    cafe: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.5 1 2.6M12 3.5c0 1 1 1.5 1 2.6"/>'
  };
  const svg = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ''}</svg>`;

  /* ---------- play: type word, accent glow, a device that turns toward the pointer, booking notes, a burst on download ---------- */
  const fun = (() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const el = id => document.getElementById(id);
    const APP = { whatsapp: ['WhatsApp', '#25d366'], line: ['LINE', '#06c755'], telegram: ['Telegram', '#2aabee'] };
    let lastType = null, lastLang = null, noteTimer = 0;
    const host = el('burst');
    if (host) document.body.append(host);

    function sync() {
      const word = el('typeWord');
      const key = PRESETS[cfg.type] ? cfg.type : 'none';
      if (word && (key !== lastType || ui.lang !== lastLang)) {
        word.textContent = T('typeWord')[key];
        word.style.setProperty('--tc', key === 'none' ? 'var(--accent)' : PRESETS[key].accent);
        if (lastType !== null && key !== lastType && !calm.matches) { word.classList.remove('is-in'); void word.offsetWidth; word.classList.add('is-in'); }
        lastType = key; lastLang = ui.lang;
      }
      const st = el('stage');
      if (st && /^#[0-9a-f]{6}$/i.test(cfg.accent || '')) st.style.setProperty('--glow', cfg.accent);
    }

    (() => {
      const st = el('stage'), bx = el('pvBox'), fr = el('frame');
      if (!st || !bx || !matchMedia('(pointer: fine)').matches) return;
      let raf = 0, rx = 0, ry = 0;
      const set = () => { raf = 0; bx.style.setProperty('--rx', rx.toFixed(2) + 'deg'); bx.style.setProperty('--ry', ry.toFixed(2) + 'deg'); };
      st.addEventListener('pointermove', e => {
        if (calm.matches) return;
        const r = st.getBoundingClientRect();
        const k = el('device').dataset.dev === 'phone' ? 8 : 2.5;
        ry = ((e.clientX - r.left) / r.width - 0.5) * 2 * k;
        rx = -((e.clientY - r.top) / r.height - 0.5) * 1.4 * k;
        if (!raf) raf = requestAnimationFrame(set);
      });
      const flat = () => { rx = 0; ry = 0; if (!raf) raf = requestAnimationFrame(set); };
      st.addEventListener('pointerleave', flat);
      if (fr) fr.addEventListener('mouseenter', flat);
    })();

    const tryBtn = el('pvTry');
    if (tryBtn) tryBtn.addEventListener('click', () => {
      const fr = el('frame');
      try { fr.contentWindow.postMessage({ type: 'lanta:goto', id: 'bk' }, location.origin); } catch (e) { /* frame gone */ }
    });

    function note(d) {
      const box = el('pvNote');
      if (!box) return;
      const [app, col] = APP[d.channel] || APP.line;
      const lines = String(d.text || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
      box.innerHTML = `<div class="nt-h"><span class="nt-app" style="background:${col}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5c-4.7 0-8.5 3-8.5 6.8 0 2.2 1.3 4.2 3.4 5.4l-.6 2.8 3.1-1.7c.8.2 1.7.3 2.6.3 4.7 0 8.5-3 8.5-6.8S16.7 4.5 12 4.5z"/></svg></span><b>${esc(app)}</b><span>${esc(T('noteNow'))}</span></div>` +
        `<strong>${esc(T('noteTitle'))}${d.business ? ' · ' + esc(d.business) : ''}</strong><p>${lines.map(esc).join('<br>')}</p><small>${esc(T('noteCap'))}</small>`;
      box.hidden = false;
      box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in');
      if (tryBtn) tryBtn.classList.add('is-gone');
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => box.classList.remove('is-in'), 9000);
    }

    function burst(btn) {
      if (!host || calm.matches || !host.animate) return;
      const r = btn.getBoundingClientRect();
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const cols = [cfg.accent || '#4c6fff', '#4c6fff', '#ffffff', '#8fe0b4', '#f5f3ee'];
      host.textContent = '';
      for (let i = 0; i < 26; i++) {
        const s = document.createElement('i');
        const a = Math.PI * (0.55 + Math.random() * 0.9), v = 90 + Math.random() * 170;
        const dx = Math.cos(a) * v, dy = Math.sin(a) * v * 0.6 + 40;
        s.style.cssText = `left:${x0}px;top:${y0}px;background:${cols[i % cols.length]};width:${5 + Math.random() * 5}px;height:${8 + Math.random() * 8}px`;
        host.append(s);
        s.animate([
          { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.4 - 30}px)) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 140}px)) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], { duration: 1100 + Math.random() * 600, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }).onfinish = () => s.remove();
      }
      toast(T('celebrate'), { key: 'party', ms: 3200 });
    }

    return { sync, note, burst };
  })();

  /* ---------- interface text ---------- */
  const UI = {
    en: {
      skip: 'Skip to settings', brandTag: 'Site builder', topNote: 'Website kit for local businesses in Thailand', uiLang: 'Interface language', copyCfg: 'Copy config', download: 'Download site',
      viewLabel: 'View', tabEdit: 'Edit', tabPreview: 'Preview',
      eyebrow: 'Personal project by Alexandr Khrustalev', h1: 'Booking sites for', h1in: 'in', h1em: 'Thailand',
      typeWord: { none: 'local businesses', spa: 'spas', tours: 'tour desks', bike: 'bike rentals', dental: 'dental clinics', cafe: 'cafes' },
      tryIt: 'Try it like a customer: book a time in the preview', noteTitle: 'New booking request', noteNow: 'now', noteCap: 'This is how a request lands on the owner\'s phone. No server, no monthly fee.',
      readyPct: 'Your site is {n}% ready', celebrate: 'Packed and ready to go live',
      lead: 'Fill in the business, watch the site change, then download it ready to host. No sign up, and nothing leaves your browser.',
      sections: 'Sections', textLang: 'Text language', textLangHint: 'Text fields edit the language picked above. Empty ones show English.',
      cBusiness: 'Business', cLook: 'Look', cServices: 'Services', cHours: 'Hours', cContact: 'Booking', cLocation: 'Location', cFaq: 'FAQ',
      hBusiness: 'Business', hLook: 'Look and languages', hServices: 'Services and prices', hHours: 'Opening hours', hContact: 'Booking channel', hLocation: 'Location', hFaq: 'Questions and answers',
      fType: 'Type of business', fTypeHelp: 'Fills in sample services, questions and hours. You can undo it.', fName: 'Business name', fTagline: 'Headline',
      fTaglineHelp: 'What you do and where, in one line. Shown large at the top.', fSub: 'Sub line', fSample: 'Sample banner', fSampleHelp: 'Marks the site as a demo. Turn it off for a real client.',
      fAccent: 'Accent colour', fCustom: 'Custom colour', fHex: 'Hex code', hexErr: 'Use a hex code like #1f5c46.', fTheme: 'Theme', dark: 'Dark', light: 'Light',
      fLangs: 'Site languages', fLangsHelp: 'Visitors can switch between these. At least one stays on.', fDefault: 'Default language',
      fDefaultHelp: 'Used by search engines and when the browser language of a visitor is not on the list.', lastLang: 'At least one language stays on.',
      svcName: 'Name', svcMin: 'Minutes', svcPrice: 'Price, ฿', moveUp: 'Move up', removeSvc: 'Remove service {n}', removeFaq: 'Remove question {n}', addSvc: 'Add service',
      svcHelp: 'Prices in Thai baht, 0 shows as free. For rentals, 1440 minutes is one day.', svcEmptyT: 'No services yet', svcEmptyP: 'Add the first one, for example Thai massage, 60 minutes, 400 baht.',
      svcRemoved: 'Service removed', faqRemoved: 'Question removed', undo: 'Undo',
      closedDay: 'Closed', opens: 'opens', closes: 'closes', openToggle: '{d}, open', copyMon: 'Use Monday hours for every open day', copiedMon: 'Monday hours applied to every open day',
      monClosed: 'Monday is closed. Open it first, then copy.', fSlot: 'Time slot length', fSlotHelp: 'Start times are this far apart. Only times where the service ends before closing are offered.',
      slotOpt: '{n} minutes', hoursErr: 'Closing time must be after opening time. Use 00:00 for midnight.',
      fChannel: 'Requests open in', whatsappL: 'WhatsApp number', lineL: 'LINE Official Account ID', telegramL: 'Telegram username',
      whatsappH: 'International format. A Thai number that starts with 0 becomes 66 automatically.', lineH: 'The ID that starts with @, from LINE Official Account Manager.',
      telegramH: 'Telegram cannot prefill a chat, so the site copies the message for the visitor to paste.',
      handleOk: 'Opens {url}', handleEmpty: 'Add it to switch on booking.', handleSample: 'Placeholder contact. Replace it before going live.',
      handleBad: { whatsapp: 'This does not look like a phone number. Use 8 to 15 digits.', line: 'After @ use letters, digits, dots, dashes or underscores.', telegram: 'Usernames have 5 to 32 letters, digits or underscores and start with a letter.' },
      fPhone: 'Phone', optional: 'optional', fCity: 'Area or city', fAddress: 'Address', fMaps: 'Google Maps link', fMapsHelp: 'In Google Maps, open the place, press Share and copy the link.',
      mapsBad: 'Paste a full link that starts with https://', mapsNotGoogle: 'Not a Google Maps link, but it still works as a map link.', mapsOk: 'Link looks good.',
      faqQ: 'Question', faqA: 'Answer', addFaq: 'Add question', faqEmptyT: 'No questions yet', faqEmptyP: 'Short answers to what people ask in chat save time every day.',
      foot1: 'This site builder is a personal freelance project by Alexandr Khrustalev. The downloaded site is plain HTML, CSS and JavaScript that any static host can serve.',
      kitDemo: 'Open the kit demo', readme: 'Read the guide', reset: 'Start over', resetDone: 'Started over with the spa sample',
      pvTitle: 'Preview', pvSize: 'Preview size', desktop: 'Desktop', phone: 'Phone', pvLive: 'Preview', pvUpdated: 'Updated', pvWaiting: 'Updating', pvFrame: 'Site preview',
      pvErrT: 'The preview could not start', pvErrP: 'Open the studio from a web server, for example GitHub Pages or a local static server, not straight from a file on disk.', retry: 'Try again',
      ready: 'Ready to download', readyP: 'Everything a working site needs is filled in.', issuesN: '{n} things to check', issue1: '1 thing to check',
      missingLang: '{lang}: {n} texts show English for now',
      iName: 'Add the business name', iServices: 'Add at least one service', iSvcName: 'Name service {n}', iSvcNum: 'Check minutes and price of service {n}', iHours: 'Open at least one day',
      iHoursBad: 'Check the hours for {d}', iHandle: 'Add the {ch} contact', iHandleBad: 'Fix the {ch} contact', iMaps: 'Fix the Google Maps link', iFaq: 'Write question {n}',
      copied: 'Config copied. Paste it into config.js.', copyFail: 'Could not copy. The browser blocked the clipboard.',
      downloaded: 'Downloaded {file}, {n} files, {kb} KB', downloadedWarn: 'Downloaded {file}. {n} to check before it goes live.', zipFail: 'Could not build the zip. The kit files did not load, so open the studio from a web server.',
      presetApplied: '{name} sample loaded', restored: 'Draft restored from this browser',
      presets: { spa: 'Spa', tours: 'Tours', bike: 'Bike rental', dental: 'Dental', cafe: 'Cafe' },
      langNames: { en: 'English', ru: 'Russian', th: 'Thai' },
      sw: { '#1f5c46': 'Jungle', '#0e7490': 'Lagoon', '#15803d': 'Palm', '#2f4b8a': 'Indigo', '#7a5534': 'Teak', '#8a4b2e': 'Clay', '#8b3a7e': 'Orchid', '#44403c': 'Stone' },
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      min: 'min', h: 'h', free: 'free', day1: 'day', dayN: 'days'
    },
    ru: {
      skip: 'Перейти к настройкам', brandTag: 'Конструктор сайтов', topNote: 'Конструктор сайтов для местного бизнеса в Таиланде', uiLang: 'Язык интерфейса', copyCfg: 'Скопировать конфиг', download: 'Скачать сайт',
      viewLabel: 'Режим', tabEdit: 'Настройки', tabPreview: 'Просмотр',
      eyebrow: 'Личный проект Александра Хрусталёва', h1: 'Сайты с онлайн-записью для', h1in: 'в', h1em: 'Таиланде',
      typeWord: { none: 'местного бизнеса', spa: 'спа-салонов', tours: 'турагентств', bike: 'проката байков', dental: 'стоматологий', cafe: 'кафе' },
      tryIt: 'Попробуйте как клиент: запишитесь в превью', noteTitle: 'Новая заявка на запись', noteNow: 'сейчас', noteCap: 'Так заявка приходит на телефон владельца. Без сервера и абонентской платы.',
      readyPct: 'Сайт готов на {n}%', celebrate: 'Архив собран, сайт готов к запуску',
      lead: 'Заполните данные, смотрите, как меняется сайт, и скачайте архив, готовый к публикации. Без регистрации, все данные остаются в браузере.',
      sections: 'Разделы', textLang: 'Язык текстов', textLangHint: 'Текстовые поля редактируют выбранный выше язык. Пустые показывают английский текст.',
      cBusiness: 'Бизнес', cLook: 'Вид', cServices: 'Услуги', cHours: 'Часы', cContact: 'Запись', cLocation: 'Адрес', cFaq: 'Вопросы',
      hBusiness: 'Бизнес', hLook: 'Оформление и языки', hServices: 'Услуги и цены', hHours: 'Часы работы', hContact: 'Канал для заявок', hLocation: 'Адрес', hFaq: 'Вопросы и ответы',
      fType: 'Тип бизнеса', fTypeHelp: 'Подставляет примеры услуг, вопросов и часов работы. Это можно отменить.', fName: 'Название', fTagline: 'Заголовок',
      fTaglineHelp: 'Чем вы занимаетесь и где, одной строкой. Крупно вверху страницы.', fSub: 'Подзаголовок', fSample: 'Плашка «пример»', fSampleHelp: 'Помечает сайт как демо. Выключите для настоящего клиента.',
      fAccent: 'Акцентный цвет', fCustom: 'Свой цвет', fHex: 'HEX-код', hexErr: 'Введите код вида #1f5c46.', fTheme: 'Тема', dark: 'Тёмная', light: 'Светлая',
      fLangs: 'Языки сайта', fLangsHelp: 'Посетитель может переключаться между ними. Хотя бы один язык остаётся включённым.', fDefault: 'Основной язык',
      fDefaultHelp: 'Для поисковиков и для посетителей, чей язык браузера не в списке.', lastLang: 'Хотя бы один язык должен остаться.',
      svcName: 'Название', svcMin: 'Минуты', svcPrice: 'Цена, ฿', moveUp: 'Поднять выше', removeSvc: 'Удалить услугу {n}', removeFaq: 'Удалить вопрос {n}', addSvc: 'Добавить услугу',
      svcHelp: 'Цены в батах, 0 показывается как «бесплатно». Для аренды 1440 минут означает сутки.', svcEmptyT: 'Услуг пока нет', svcEmptyP: 'Добавьте первую, например тайский массаж, 60 минут, 400 батов.',
      svcRemoved: 'Услуга удалена', faqRemoved: 'Вопрос удалён', undo: 'Отменить',
      closedDay: 'Выходной', opens: 'открытие', closes: 'закрытие', openToggle: '{d}, рабочий день', copyMon: 'Часы понедельника для всех рабочих дней', copiedMon: 'Часы понедельника применены ко всем рабочим дням',
      monClosed: 'Понедельник выходной. Сначала включите его.', fSlot: 'Шаг времени записи', fSlotHelp: 'С таким шагом идут варианты начала. Предлагается только время, когда услуга заканчивается до закрытия.',
      slotOpt: '{n} минут', hoursErr: 'Закрытие должно быть позже открытия. Для полуночи укажите 00:00.',
      fChannel: 'Заявки открываются в', whatsappL: 'Номер WhatsApp', lineL: 'ID официального аккаунта LINE', telegramL: 'Имя пользователя Telegram',
      whatsappH: 'Международный формат. Тайский номер, который начинается с 0, сам превратится в 66.', lineH: 'ID, который начинается с @, из LINE Official Account Manager.',
      telegramH: 'Telegram не умеет подставлять текст в чат, поэтому сайт копирует сообщение, а посетитель его вставляет.',
      handleOk: 'Откроется {url}', handleEmpty: 'Укажите контакт, чтобы включить запись.', handleSample: 'Это условный контакт. Замените его перед публикацией.',
      handleBad: { whatsapp: 'Не похоже на номер телефона. Нужно от 8 до 15 цифр.', line: 'После @ допустимы буквы, цифры, точки, дефисы и подчёркивания.', telegram: 'Имя пользователя: от 5 до 32 латинских букв, цифр или подчёркиваний, первой идёт буква.' },
      fPhone: 'Телефон', optional: 'необязательно', fCity: 'Район или город', fAddress: 'Адрес', fMaps: 'Ссылка на Google Карты', fMapsHelp: 'В Google Картах откройте место, нажмите «Поделиться» и скопируйте ссылку.',
      mapsBad: 'Вставьте полную ссылку, которая начинается с https://', mapsNotGoogle: 'Это не Google Карты, но ссылка всё равно сработает.', mapsOk: 'Ссылка в порядке.',
      faqQ: 'Вопрос', faqA: 'Ответ', addFaq: 'Добавить вопрос', faqEmptyT: 'Вопросов пока нет', faqEmptyP: 'Короткие ответы на то, что спрашивают в чате, экономят время каждый день.',
      foot1: 'Этот конструктор сайтов Александр Хрусталёв сделал как личный фриланс-проект. Скачанный сайт состоит из обычных HTML, CSS и JavaScript и работает на любом статическом хостинге.',
      kitDemo: 'Открыть демо шаблона', readme: 'Инструкция', reset: 'Начать заново', resetDone: 'Начали заново с примера спа',
      pvTitle: 'Предпросмотр', pvSize: 'Размер предпросмотра', desktop: 'Компьютер', phone: 'Телефон', pvLive: 'Предпросмотр', pvUpdated: 'Обновлено', pvWaiting: 'Обновляем', pvFrame: 'Предпросмотр сайта',
      pvErrT: 'Предпросмотр не запустился', pvErrP: 'Откройте студию через веб-сервер, например GitHub Pages или локальный статический сервер, а не как файл с диска.', retry: 'Повторить',
      ready: 'Можно скачивать', readyP: 'Всё, что нужно для работающего сайта, заполнено.', issuesN: 'Нужно проверить: {n}', issue1: 'Нужно проверить: 1',
      missingLang: '{lang}: без перевода {n}',
      iName: 'Укажите название', iServices: 'Добавьте хотя бы одну услугу', iSvcName: 'Назовите услугу {n}', iSvcNum: 'Проверьте минуты и цену услуги {n}', iHours: 'Откройте хотя бы один день',
      iHoursBad: 'Проверьте часы: {d}', iHandle: 'Укажите контакт {ch}', iHandleBad: 'Исправьте контакт {ch}', iMaps: 'Исправьте ссылку на карту', iFaq: 'Заполните вопрос {n}',
      copied: 'Конфиг скопирован. Вставьте его в config.js.', copyFail: 'Не удалось скопировать: браузер заблокировал буфер обмена.',
      downloaded: 'Скачан {file}, файлов: {n}, {kb} КБ', downloadedWarn: 'Скачан {file}. Перед публикацией нужно проверить: {n}.', zipFail: 'Не удалось собрать архив: файлы шаблона не загрузились. Откройте студию через веб-сервер.',
      presetApplied: 'Загружен пример: {name}', restored: 'Черновик восстановлен из этого браузера',
      presets: { spa: 'Спа', tours: 'Туры', bike: 'Аренда байков', dental: 'Стоматология', cafe: 'Кафе' },
      langNames: { en: 'Английский', ru: 'Русский', th: 'Тайский' },
      sw: { '#1f5c46': 'Джунгли', '#0e7490': 'Лагуна', '#15803d': 'Пальма', '#2f4b8a': 'Индиго', '#7a5534': 'Тик', '#8a4b2e': 'Глина', '#8b3a7e': 'Орхидея', '#44403c': 'Камень' },
      days: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
      min: 'мин', h: 'ч', free: 'бесплатно', day1: 'день', dayN: 'дн.'
    }
  };

  /* ---------- sample businesses, all placeholders ---------- */
  const L3 = (en, ru, th) => ({ en, ru, th });
  const week = (o, c, closed = [], special = {}) => {
    const h = {};
    for (const k of WEEK) h[k] = closed.includes(k) ? null : special[k] || [o, c];
    return h;
  };
  const svc = (en, ru, th, minutes, price) => ({ name: L3(en, ru, th), minutes, price });
  const qa = (q, a) => ({ q: L3(...q), a: L3(...a) });

  const PRESETS = {
    spa: {
      name: L3('Baan Sabai Spa', 'Baan Sabai Spa', 'บ้านสบาย สปา'),
      tagline: L3('Thai massage in Rawai, Phuket, booked in a minute', 'Тайский массаж в Равае на Пхукете, запись за минуту', 'นวดแผนไทยที่ราไวย์ ภูเก็ต จองได้ในหนึ่งนาที'),
      sub: L3('Experienced therapists, quiet rooms and warm herbal oils. Choose a time and send the request in your messenger.',
        'Опытные мастера, тихие комнаты и тёплые травяные масла. Выберите время и отправьте заявку в мессенджер.',
        'นักนวดมากประสบการณ์ ห้องเงียบสงบ และน้ำมันสมุนไพรอุ่นๆ เลือกเวลาแล้วส่งคำขอทางแชท'),
      accent: '#0e7490', theme: 'light', slotMinutes: 30,
      services: [
        svc('Thai massage', 'Тайский массаж', 'นวดแผนไทย', 60, 400),
        svc('Thai massage', 'Тайский массаж', 'นวดแผนไทย', 90, 550),
        svc('Aroma oil massage', 'Массаж с аромамаслами', 'นวดน้ำมันอโรมา', 60, 600),
        svc('Foot massage', 'Массаж стоп', 'นวดเท้า', 45, 350),
        svc('Herbal compress massage', 'Массаж травяными мешочками', 'นวดประคบสมุนไพร', 90, 900)
      ],
      hours: week('10:00', '21:00'),
      contact: { channel: 'line', handle: SAMPLE_HANDLE.line, phone: '+66 80 000 0000' },
      address: {
        text: L3('45/12 Wiset Road, Rawai, Phuket 83100', '45/12 Висет-роуд, Равай, Пхукет 83100', '45/12 ถ.วิเศษ ต.ราไวย์ จ.ภูเก็ต 83100'),
        city: L3('Rawai', 'Равай', 'ราไวย์'), region: 'Phuket', postalCode: '83100', mapsUrl: 'https://maps.google.com/?q=Wiset+Road,+Rawai,+Phuket'
      },
      faq: [
        qa(['Do I need to book in advance?', 'Нужно ли записываться заранее?', 'ต้องจองล่วงหน้าไหม'],
          ['Walk-ins are welcome, but evenings fill up fast. Send a request and we hold the time for you.', 'Можно прийти и без записи, но вечером мест обычно нет. Отправьте заявку, и мы придержим время.', 'แวะมาได้เลย แต่ช่วงเย็นคิวเต็มเร็ว ส่งคำขอไว้ก่อน เราจะกันเวลาไว้ให้']),
        qa(['What should I wear?', 'Что надеть?', 'ต้องแต่งตัวอย่างไร'],
          ['We give you loose cotton clothes for Thai massage and towels for oil treatments.', 'Для тайского массажа мы выдаём свободную хлопковую одежду, для массажа с маслом есть полотенца.', 'เรามีชุดผ้าฝ้ายให้สำหรับนวดแผนไทย และผ้าขนหนูสำหรับนวดน้ำมัน']),
        qa(['How can I pay?', 'Как можно оплатить?', 'ชำระเงินได้อย่างไร'],
          ['Cash, Thai QR or card at the front desk.', 'Наличными, по тайскому QR или картой на ресепшене.', 'เงินสด สแกน QR หรือบัตร ที่เคาน์เตอร์'])
      ]
    },
    tours: {
      name: L3('Andaman Day Trips', 'Andaman Day Trips', 'อันดามัน เดย์ทริป'),
      tagline: L3('Island trips from Ao Nang in a small group', 'Морские экскурсии из Ао Нанга в небольшой группе', 'ทริปเที่ยวเกาะจากอ่าวนางแบบกลุ่มเล็ก'),
      sub: L3('Hotel pickup, snorkel gear and lunch are included. Pick a date and we confirm your seats in the chat.',
        'Трансфер из отеля, снаряжение для снорклинга и обед включены. Выберите дату, и мы подтвердим места в чате.',
        'รวมรถรับส่งโรงแรม อุปกรณ์ดำน้ำตื้น และอาหารกลางวัน เลือกวันแล้วเรายืนยันที่นั่งทางแชท'),
      accent: '#15803d', theme: 'light', slotMinutes: 60,
      services: [
        svc('Four islands by longtail boat', '4 острова на лодке лонгтейл', 'ทัวร์ 4 เกาะ เรือหางยาว', 420, 1200),
        svc('Hong islands by speedboat', 'Острова Хонг на спидботе', 'ทัวร์เกาะห้อง เรือสปีดโบ๊ท', 360, 1900),
        svc('Phi Phi full day', 'Пхи-Пхи на целый день', 'ทัวร์เกาะพีพี เต็มวัน', 540, 2400),
        svc('Sunset kayak', 'Каяк на закате', 'พายเรือคายัคชมพระอาทิตย์ตก', 180, 900)
      ],
      hours: week('07:00', '19:00'),
      contact: { channel: 'whatsapp', handle: SAMPLE_HANDLE.whatsapp, phone: '' },
      address: {
        text: L3('Ao Nang Beach Road, Krabi 81180', 'Ао Нанг, Бич-роуд, Краби 81180', 'ถนนเลียบหาดอ่าวนาง จ.กระบี่ 81180'),
        city: L3('Ao Nang', 'Ао Нанг', 'อ่าวนาง'), region: 'Krabi', postalCode: '81180', mapsUrl: 'https://maps.google.com/?q=Ao+Nang,+Krabi'
      },
      faq: [
        qa(['Is hotel pickup included?', 'Трансфер из отеля включён?', 'รวมรถรับส่งจากโรงแรมไหม'],
          ['Yes, from hotels in Ao Nang and Klong Muang. Other areas for a small extra fee.', 'Да, из отелей Ао Нанга и Клонг Муанга. Из других районов за небольшую доплату.', 'รวม สำหรับโรงแรมในอ่าวนางและคลองม่วง พื้นที่อื่นมีค่าบริการเพิ่มเล็กน้อย']),
        qa(['What if the weather is bad?', 'Что если плохая погода?', 'ถ้าอากาศไม่ดีจะทำอย่างไร'],
          ['If the marine office closes the sea, we move your trip or refund it in full.', 'Если морская служба закрывает выход в море, мы переносим поездку или полностью возвращаем деньги.', 'หากกรมเจ้าท่าประกาศห้ามออกเรือ เราจะเลื่อนทริปหรือคืนเงินเต็มจำนวน']),
        qa(['Are national park fees included?', 'Входят ли сборы нацпарка?', 'รวมค่าอุทยานแล้วหรือยัง'],
          ['Park fees are paid in cash on the boat and are not part of the price.', 'Сбор нацпарка оплачивается наличными на лодке и не входит в цену.', 'ค่าอุทยานชำระเป็นเงินสดบนเรือ ไม่รวมในราคา'])
      ]
    },
    bike: {
      name: L3('Chalong Scooters', 'Chalong Scooters', 'ฉลอง สกู๊ตเตอร์'),
      tagline: L3('Scooters for rent in Phuket, delivered to your hotel', 'Аренда скутеров на Пхукете с доставкой в отель', 'ให้เช่าสกู๊ตเตอร์ในภูเก็ต ส่งถึงโรงแรม'),
      sub: L3('Well kept bikes, two helmets and a phone holder with every rental. Choose a pickup time and we get the bike ready.',
        'Ухоженные байки, два шлема и держатель для телефона в каждой аренде. Выберите время, и мы подготовим байк.',
        'รถดูแลอย่างดี ทุกคันมีหมวกกันน็อก 2 ใบและที่จับโทรศัพท์ เลือกเวลารับรถ แล้วเราจะเตรียมรถไว้ให้'),
      accent: '#8b3a7e', theme: 'dark', slotMinutes: 30,
      services: [
        svc('Honda Click 125', 'Honda Click 125', 'Honda Click 125', 1440, 250),
        svc('Honda PCX 160', 'Honda PCX 160', 'Honda PCX 160', 1440, 400),
        svc('Yamaha NMAX 155', 'Yamaha NMAX 155', 'Yamaha NMAX 155', 1440, 450),
        svc('Honda Click 125, weekly', 'Honda Click 125, неделя', 'Honda Click 125 รายสัปดาห์', 10080, 1500)
      ],
      hours: week('08:00', '19:00'),
      contact: { channel: 'whatsapp', handle: SAMPLE_HANDLE.whatsapp, phone: '+66 80 000 0000' },
      address: {
        text: L3('Chao Fa West Road, Chalong, Phuket 83130', 'Чао Фа Вест-роуд, Чалонг, Пхукет 83130', 'ถ.เจ้าฟ้าตะวันตก ต.ฉลอง จ.ภูเก็ต 83130'),
        city: L3('Chalong', 'Чалонг', 'ฉลอง'), region: 'Phuket', postalCode: '83130', mapsUrl: 'https://maps.google.com/?q=Chao+Fa+West+Road,+Chalong,+Phuket'
      },
      faq: [
        qa(['Do I need a driving licence?', 'Нужны ли права?', 'ต้องมีใบขับขี่ไหม'],
          ['Yes. Police check for a motorcycle licence, and most travel insurance asks for one too.', 'Да. Полиция проверяет права на мотоцикл, и страховка обычно тоже их требует.', 'ต้องมี ตำรวจตรวจใบขับขี่รถจักรยานยนต์ และประกันการเดินทางส่วนใหญ่ก็กำหนดไว้']),
        qa(['Do you keep my passport?', 'Нужно оставлять паспорт?', 'ต้องฝากพาสปอร์ตไหม'],
          ['No. We take a cash deposit of 3,000 baht and return it when you bring the bike back.', 'Нет. Мы берём залог 3000 батов наличными и возвращаем его, когда вы сдаёте байк.', 'ไม่ต้อง เราเก็บเงินมัดจำ 3,000 บาท และคืนให้เมื่อนำรถมาคืน']),
        qa(['Is fuel included?', 'Бензин входит в цену?', 'รวมน้ำมันไหม'],
          ['The bike has enough fuel to reach the nearest station. Return it with the same level.', 'В баке хватит до ближайшей заправки. Верните байк с тем же уровнем.', 'รถมีน้ำมันพอไปถึงปั๊มที่ใกล้ที่สุด กรุณาคืนรถด้วยระดับน้ำมันเท่าเดิม'])
      ]
    },
    dental: {
      name: L3('Krabi Smile Dental', 'Krabi Smile Dental', 'คลินิกทันตกรรม กระบี่สไมล์'),
      tagline: L3('Gentle dental care in Krabi Town', 'Бережная стоматология в городе Краби', 'ทันตกรรมที่ใส่ใจทุกขั้นตอน ในตัวเมืองกระบี่'),
      sub: L3('English and Russian speaking staff, and clear prices before any treatment. Request a visit and we confirm it the same day.',
        'Персонал говорит по-английски и по-русски, цены известны до начала лечения. Отправьте заявку, и мы подтвердим визит в тот же день.',
        'เจ้าหน้าที่พูดภาษาอังกฤษและรัสเซียได้ แจ้งราคาก่อนเริ่มรักษา ส่งคำขอแล้วเรายืนยันภายในวันเดียวกัน'),
      accent: '#2f4b8a', theme: 'light', slotMinutes: 30,
      services: [
        svc('Check-up and cleaning', 'Осмотр и чистка', 'ตรวจฟันและขูดหินปูน', 45, 1200),
        svc('Consultation and X-ray', 'Консультация и снимок', 'ปรึกษาและเอกซเรย์', 30, 600),
        svc('Tooth filling', 'Пломба', 'อุดฟัน', 45, 1500),
        svc('Teeth whitening', 'Отбеливание зубов', 'ฟอกสีฟัน', 90, 6500)
      ],
      hours: week('09:00', '18:00', ['sun'], { sat: ['09:00', '15:00'] }),
      contact: { channel: 'line', handle: SAMPLE_HANDLE.line, phone: '+66 80 000 0000' },
      address: {
        text: L3('155 Maharaj Road, Krabi Town 81000', '155 Махарат-роуд, город Краби 81000', '155 ถ.มหาราช อ.เมือง จ.กระบี่ 81000'),
        city: L3('Krabi Town', 'Город Краби', 'เมืองกระบี่'), region: 'Krabi', postalCode: '81000', mapsUrl: 'https://maps.google.com/?q=Maharaj+Road,+Krabi'
      },
      faq: [
        qa(['Can I get documents for my insurance?', 'Дадите документы для страховой?', 'ขอเอกสารสำหรับเคลมประกันได้ไหม'],
          ['Yes. We give an itemised receipt and a treatment report in English.', 'Да. Мы выдаём подробный чек и отчёт о лечении на английском.', 'ได้ เราออกใบเสร็จแยกรายการและรายงานการรักษาเป็นภาษาอังกฤษ']),
        qa(['Do you treat children?', 'Принимаете детей?', 'รักษาเด็กไหม'],
          ['Yes, from age four. Book a longer first visit so your child can get used to us.', 'Да, с четырёх лет. Для первого визита лучше выбрать больше времени, чтобы ребёнок освоился.', 'รักษา ตั้งแต่อายุ 4 ขวบ ครั้งแรกแนะนำให้จองเวลานานขึ้นเพื่อให้เด็กคุ้นเคย']),
        qa(['What if I am in pain right now?', 'Что делать, если болит прямо сейчас?', 'ถ้าปวดฟันตอนนี้ต้องทำอย่างไร'],
          ['Write to us in the chat. We keep time free every day for urgent cases.', 'Напишите нам в чат. Каждый день мы оставляем время для срочных случаев.', 'ทักแชทมาได้เลย เราเว้นเวลาไว้สำหรับเคสเร่งด่วนทุกวัน'])
      ]
    },
    cafe: {
      name: L3('Slow Lane Coffee', 'Slow Lane Coffee', 'สโลว์เลน คอฟฟี่'),
      tagline: L3('Specialty coffee and brunch in Nimman', 'Спешелти-кофе и бранчи на Нимане', 'กาแฟพิเศษและบรันช์ย่านนิมมาน'),
      sub: L3('Beans from farms in Chiang Rai and Nan, roasted every week. Reserve a table or a tasting and we keep it for you.',
        'Зерно с ферм Чианграя и Нана, обжарка каждую неделю. Забронируйте стол или дегустацию, и мы оставим их за вами.',
        'เมล็ดกาแฟจากไร่ในเชียงรายและน่าน คั่วใหม่ทุกสัปดาห์ จองโต๊ะหรือคอร์สชิมกาแฟ แล้วเราจะเก็บไว้ให้'),
      accent: '#7a5534', theme: 'light', slotMinutes: 30,
      services: [
        svc('Brunch table for two', 'Стол на двоих для бранча', 'โต๊ะบรันช์สำหรับ 2 ท่าน', 90, 0),
        svc('Table for up to six', 'Стол для компании до 6 человек', 'โต๊ะสำหรับไม่เกิน 6 ท่าน', 90, 0),
        svc('Coffee tasting with the roaster', 'Дегустация кофе с обжарщиком', 'ชิมกาแฟกับนักคั่ว', 60, 450),
        svc('Latte art class', 'Мастер-класс по латте-арту', 'คลาสลาเต้อาร์ต', 90, 900)
      ],
      hours: week('08:00', '17:00', ['mon']),
      contact: { channel: 'telegram', handle: SAMPLE_HANDLE.telegram, phone: '' },
      address: {
        text: L3('Soi 9, Nimmanhaemin Road, Chiang Mai 50200', 'Сой 9, Нимманхеминт-роуд, Чиангмай 50200', 'ซอย 9 ถ.นิมมานเหมินท์ อ.เมือง จ.เชียงใหม่ 50200'),
        city: L3('Chiang Mai', 'Чиангмай', 'เชียงใหม่'), region: 'Chiang Mai', postalCode: '50200', mapsUrl: 'https://maps.google.com/?q=Nimmanhaemin+Soi+9,+Chiang+Mai'
      },
      faq: [
        qa(['Do I need to reserve a table?', 'Нужно ли бронировать стол?', 'ต้องจองโต๊ะไหม'],
          ['On weekdays you can just walk in. On weekends from 10:00 a reservation saves you a wait.', 'В будни можно прийти без брони. В выходные с 10:00 бронь избавит от ожидания.', 'วันธรรมดาเดินเข้ามาได้เลย วันหยุดตั้งแต่ 10:00 น. แนะนำให้จองเพื่อไม่ต้องรอ']),
        qa(['Do you have plant milk?', 'Есть растительное молоко?', 'มีนมจากพืชไหม'],
          ['Oat, almond and soy milk at no extra cost.', 'Овсяное, миндальное и соевое без доплаты.', 'มีนมโอ๊ต นมอัลมอนด์ และนมถั่วเหลือง ไม่มีค่าใช้จ่ายเพิ่ม']),
        qa(['Can I work on a laptop here?', 'Можно поработать с ноутбуком?', 'นั่งทำงานด้วยโน้ตบุ๊กได้ไหม'],
          ['Yes, there is fast Wi-Fi and sockets at the long table. At weekend brunch we keep tables for eating.', 'Да, есть быстрый Wi-Fi и розетки у длинного стола. Во время бранча в выходные столы только для гостей с едой.', 'ได้ มี Wi-Fi เร็วและปลั๊กที่โต๊ะยาว ช่วงบรันช์วันหยุดขอสงวนโต๊ะสำหรับทานอาหาร'])
      ]
    }
  };

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;

  function T(key, vars) {
    let s = UI[ui.lang][key];
    if (s == null) s = UI.en[key];
    if (s == null) return key;
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return s;
  }
  const valIn = (v, l) => (typeof v === 'string' ? (l === 'en' ? v : '') : v && typeof v[l] === 'string' ? v[l] : '');
  const txt = (v, l) => (valIn(v, l) || valIn(v, 'en') || LANGS.map(x => valIn(v, x)).find(s => s.trim()) || '').trim();
  const anyText = v => LANGS.some(l => valIn(v, l).trim());
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split('.');
    const last = ks.pop();
    const tgt = ks.reduce((a, k) => (a[k] && typeof a[k] === 'object' ? a[k] : (a[k] = {})), o);
    tgt[last] = v;
  }
  function setText(path, l, value) {
    let v = getPath(cfg, path);
    if (!v || typeof v !== 'object') v = { en: typeof v === 'string' ? v : '' };
    v[l] = value;
    setPath(cfg, path, v);
  }
  const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
  function hoursValid(r) {
    if (!r) return true;
    const o = toMin(r[0]);
    let c = toMin(r[1]);
    if (Number.isNaN(o) || Number.isNaN(c)) return false;
    if (c === 0) c = 1440;
    return c > o;
  }
  function fmtDur(min) {
    if (!(min > 0)) return '';
    if (min >= 1440 && min % 1440 === 0) { const n = min / 1440; return n + ' ' + (n === 1 ? T('day1') : T('dayN')); }
    if (min < 60) return min + ' ' + T('min');
    const hh = Math.floor(min / 60), mm = min % 60;
    return hh + ' ' + T('h') + (mm ? ' ' + mm + ' ' + T('min') : '');
  }
  const fmtPrice = n => (n > 0 ? '฿' + n.toLocaleString('en-US') : T('free'));

  /* Same rules as the kit, so the studio shows exactly what the site will open. */
  function cleanHandle(ch, raw) {
    let s = String(raw || '').trim();
    if (ch === 'whatsapp') {
      s = s.replace(/^https?:\/\/(wa\.me|api\.whatsapp\.com\/send\?phone=)\/?/i, '').replace(/\D/g, '');
      if (/^0\d{8,9}$/.test(s)) s = '66' + s.slice(1);
      return /^\d{8,15}$/.test(s) ? s : '';
    }
    if (ch === 'line') {
      s = s.replace(/^https?:\/\/line\.me\/R\/ti\/p\//i, '').replace(/^%40/, '@').replace(/\s+/g, '');
      if (!s) return '';
      if (s[0] !== '@') s = '@' + s;
      return /^@[A-Za-z0-9._-]{2,40}$/.test(s) ? s : '';
    }
    s = s.replace(/^https?:\/\/(t|telegram)\.me\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s) ? s : '';
  }
  const chatUrl = (ch, hd) => (ch === 'whatsapp' ? 'wa.me/' + hd : ch === 'line' ? 'line.me/R/oaMessage/' + hd : 't.me/' + hd);

  /* ---------- state ---------- */
  function fromPreset(key) {
    const p = clone(PRESETS[key]);
    return {
      version: 1, type: key, sample: true,
      name: p.name, tagline: p.tagline, sub: p.sub, accent: p.accent, theme: p.theme,
      languages: ['en', 'ru', 'th'], defaultLang: 'en', timezone: 'Asia/Bangkok',
      slotMinutes: p.slotMinutes, leadMinutes: 30,
      services: p.services, hours: p.hours, contact: p.contact, address: p.address, faq: p.faq
    };
  }
  function sanitize(c) {
    const base = fromPreset(PRESETS[c.type] ? c.type : 'spa');
    const out = Object.assign(base, c);
    out.contact = Object.assign({ channel: 'whatsapp', handle: '', phone: '' }, c.contact);
    if (!CH[out.contact.channel]) out.contact.channel = 'whatsapp';
    out.address = Object.assign({ text: '', city: '', mapsUrl: '', region: '', postalCode: '' }, c.address);
    out.hours = Object.assign({}, base.hours, c.hours && typeof c.hours === 'object' ? c.hours : {});
    for (const k of WEEK) if (out.hours[k] && !Array.isArray(out.hours[k])) out.hours[k] = null;
    out.services = Array.isArray(c.services) ? c.services.filter(s => s && typeof s === 'object') : base.services;
    out.faq = Array.isArray(c.faq) ? c.faq.filter(f => f && typeof f === 'object') : base.faq;
    out.languages = Array.isArray(c.languages) ? c.languages.filter(l => LANGS.includes(l)) : base.languages;
    if (!out.languages.length) out.languages = ['en'];
    if (!out.languages.includes(out.defaultLang)) out.defaultLang = out.languages[0];
    if (!/^#[0-9a-f]{6}$/i.test(out.accent || '')) out.accent = '#1f5c46';
    if (!SLOT_OPTIONS.includes(+out.slotMinutes)) out.slotMinutes = 30;
    return out;
  }

  let cfg;
  const ui = { lang: 'en', edit: 'en', device: 'desktop', view: 'edit', handles: {}, mem: {} };
  let restored = false;
  (function load() {
    let saved = null;
    try { const raw = localStorage.getItem(STORE); if (raw) saved = JSON.parse(raw); } catch (e) { saved = null; }
    if (saved && saved.v === 1 && saved.cfg && typeof saved.cfg === 'object' && Array.isArray(saved.cfg.services)) {
      try {
        cfg = sanitize(saved.cfg);
        const u = saved.ui || {};
        if (UI[u.lang]) ui.lang = u.lang;
        if (LANGS.includes(u.edit)) ui.edit = u.edit;
        if (u.device === 'desktop' || u.device === 'phone') ui.device = u.device;
        if (u.handles && typeof u.handles === 'object') ui.handles = u.handles;
        restored = true;
        return;
      } catch (e) { /* fall through to a fresh sample */ }
    }
    cfg = fromPreset('spa');
    ui.lang = /^ru/i.test(navigator.language || '') ? 'ru' : 'en';
    ui.device = isMobile() ? 'phone' : 'desktop';
  })();
  if (!cfg.languages.includes(ui.edit)) ui.edit = cfg.defaultLang;

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ v: 1, cfg, ui: { lang: ui.lang, edit: ui.edit, device: ui.device, handles: ui.handles } }));
    } catch (e) { /* private mode or storage full, the studio still works */ }
  }

  /* ---------- elements ---------- */
  const panel = $('#panel');
  const frame = $('#frame');
  const stage = $('#stage');
  const box = $('#pvBox');
  const device = $('#device');
  const studio = $('#studio');

  /* ---------- change pipeline ---------- */
  let tPost = 0, tSave = 0, tReady = 0;
  function changed() {
    clearTimeout(tPost); tPost = setTimeout(post, 140);
    clearTimeout(tSave); tSave = setTimeout(save, 400);
    clearTimeout(tReady); tReady = setTimeout(renderReady, 180);
    setStatus('pending');
  }

  /* ---------- interface language ---------- */
  function applyUi() {
    document.documentElement.lang = ui.lang;
    $$('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', T(el.dataset.i18nAria)));
    $$('[data-i18n-title]').forEach(el => el.setAttribute('title', T(el.dataset.i18nTitle)));
    $$('[data-ui]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ui === ui.lang)));
    renderPresets(); renderSwatches(); renderLangs(); renderSelects(); renderServices(); renderHours(); renderFaq(); fillContact(); fillMaps(); renderReady(); layout();
  }

  /* ---------- fill and render ---------- */
  function fillAll() {
    fillText(); renderPresets(); renderSwatches(); fillLook(); renderLangs(); renderSelects(); renderEditLang();
    renderServices(); renderHours(); fillContact(); fillMaps(); renderFaq(); renderReady();
    $('#f-sample').setAttribute('aria-checked', String(!!cfg.sample));
  }

  function fillText() {
    $$('[data-tx]').forEach(el => {
      const v = getPath(cfg, el.dataset.tx);
      el.value = valIn(v, ui.edit);
      el.placeholder = ui.edit !== 'en' ? valIn(v, 'en') : '';
    });
    $$('[data-lt]').forEach(b => { b.textContent = ui.edit.toUpperCase(); });
  }

  function renderEditLang() {
    const seg = $('#editLangSeg');
    seg.innerHTML = cfg.languages.map(l => `<button type="button" data-edit="${l}" aria-pressed="${l === ui.edit}" lang="${l}" title="${esc(T('langNames')[l])}">${l.toUpperCase()}</button>`).join('');
  }

  function renderPresets() {
    $('#presets').innerHTML = Object.keys(PRESETS).map(k =>
      `<button type="button" class="preset" style="--pc:${PRESETS[k].accent}" data-preset="${k}" aria-pressed="${cfg.type === k}"><span class="preset-i">${svg(k)}</span><span>${esc(T('presets')[k])}</span></button>`).join('');
  }

  function renderSwatches() {
    const cur = (cfg.accent || '').toLowerCase();
    $('#swatches').innerHTML = SWATCHES.map(c =>
      `<button type="button" class="sw" style="--c:${c}" data-swatch="${c}" aria-pressed="${cur === c}" aria-label="${esc(T('sw')[c])}" title="${esc(T('sw')[c])}">${svg('check')}</button>`).join('');
    $('#colorWrap').classList.toggle('is-on', !SWATCHES.includes(cur));
  }

  function fillLook() {
    const c = (cfg.accent || '#1f5c46').toLowerCase();
    $('#f-color').value = c;
    $('#colorWrap').style.setProperty('--c', c);
    const hex = $('#f-hex');
    if (document.activeElement !== hex) hex.value = c;
    hex.classList.remove('is-bad');
    $('#hexErr').hidden = true;
    $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === cfg.theme)));
  }

  function renderLangs() {
    $('#langs').innerHTML = LANGS.map(l => {
      const on = cfg.languages.includes(l);
      const native = { en: 'English', ru: 'Русский', th: 'ไทย' }[l];
      return `<button type="button" class="lng" data-lang-toggle="${l}" aria-pressed="${on}"><span class="box">${svg('check')}</span><span lang="${l}">${native}</span><small>${l.toUpperCase()}</small></button>`;
    }).join('');
  }

  function renderSelects() {
    $('#f-default').innerHTML = cfg.languages.map(l => `<option value="${l}"${l === cfg.defaultLang ? ' selected' : ''}>${esc(T('langNames')[l])}</option>`).join('');
    $('#f-slot').innerHTML = SLOT_OPTIONS.map(n => `<option value="${n}"${n === +cfg.slotMinutes ? ' selected' : ''}>${esc(T('slotOpt', { n }))}</option>`).join('');
  }

  function rowNum(i) { return String(i + 1).padStart(2, '0'); }

  function renderServices(focus) {
    const list = cfg.services;
    const ol = $('#svcList');
    ol.innerHTML = list.map((s, i) => `
      <li class="row" data-i="${i}">
        <div class="row-top"><span class="row-n">${rowNum(i)}</span><span class="row-hint" data-hint></span>
          <div class="row-acts">
            <button type="button" class="ib" data-act="up" aria-label="${esc(T('moveUp'))}" title="${esc(T('moveUp'))}"${i === 0 ? ' disabled' : ''}>${svg('up')}</button>
            <button type="button" class="ib ib-del" data-act="del" aria-label="${esc(T('removeSvc', { n: i + 1 }))}" title="${esc(T('removeSvc', { n: i + 1 }))}">${svg('trash')}</button>
          </div>
        </div>
        <div class="fld"><label class="lab" for="svc-${i}-name"><span>${esc(T('svcName'))}</span><i class="lt">${ui.edit.toUpperCase()}</i></label>
          <input id="svc-${i}-name" type="text" data-s="name" maxlength="70" autocomplete="off"></div>
        <div class="row-sub">
          <div class="fld"><label class="lab" for="svc-${i}-min">${esc(T('svcMin'))}</label><input id="svc-${i}-min" type="number" inputmode="numeric" min="5" max="44640" step="5" data-s="minutes"></div>
          <div class="fld"><label class="lab" for="svc-${i}-price">${esc(T('svcPrice'))}</label><input id="svc-${i}-price" type="number" inputmode="numeric" min="0" max="10000000" step="10" data-s="price"></div>
        </div>
      </li>`).join('');
    list.forEach((s, i) => {
      const li = ol.children[i];
      const n = $('[data-s="name"]', li);
      n.value = valIn(s.name, ui.edit);
      n.placeholder = ui.edit !== 'en' && valIn(s.name, 'en') ? valIn(s.name, 'en') : T('svcName');
      $('[data-s="minutes"]', li).value = s.minutes;
      $('[data-s="price"]', li).value = s.price;
      svcHint(li, s);
    });
    $('#svcEmpty').hidden = list.length > 0;
    $('#svcCount').textContent = list.length;
    if (focus) {
      const li = ol.children[focus.i];
      const el = li && $(focus.sel, li);
      if (el) el.focus();
      if (li && focus.isNew) li.classList.add('is-new');
    }
  }
  function svcHint(li, s) { $('[data-hint]', li).textContent = [fmtDur(s.minutes), fmtPrice(s.price)].filter(Boolean).join(' · '); }

  function renderFaq(focus) {
    const list = cfg.faq;
    const ol = $('#faqList');
    ol.innerHTML = list.map((f, i) => `
      <li class="row" data-i="${i}">
        <div class="row-top"><span class="row-n">${rowNum(i)}</span>
          <div class="row-acts" style="margin-left:auto">
            <button type="button" class="ib" data-act="up" aria-label="${esc(T('moveUp'))}" title="${esc(T('moveUp'))}"${i === 0 ? ' disabled' : ''}>${svg('up')}</button>
            <button type="button" class="ib ib-del" data-act="del" aria-label="${esc(T('removeFaq', { n: i + 1 }))}" title="${esc(T('removeFaq', { n: i + 1 }))}">${svg('trash')}</button>
          </div>
        </div>
        <div class="fld"><label class="lab" for="faq-${i}-q"><span>${esc(T('faqQ'))}</span><i class="lt">${ui.edit.toUpperCase()}</i></label>
          <input id="faq-${i}-q" type="text" data-f="q" maxlength="140" autocomplete="off"></div>
        <div class="fld"><label class="lab" for="faq-${i}-a"><span>${esc(T('faqA'))}</span><i class="lt">${ui.edit.toUpperCase()}</i></label>
          <textarea id="faq-${i}-a" rows="2" data-f="a" maxlength="500"></textarea></div>
      </li>`).join('');
    list.forEach((f, i) => {
      const li = ol.children[i];
      for (const k of ['q', 'a']) {
        const el = $(`[data-f="${k}"]`, li);
        el.value = valIn(f[k], ui.edit);
        el.placeholder = ui.edit !== 'en' ? valIn(f[k], 'en') : '';
      }
    });
    $('#faqEmpty').hidden = list.length > 0;
    $('#faqCount').textContent = list.length;
    if (focus) {
      const li = ol.children[focus.i];
      const el = li && $(focus.sel, li);
      if (el) el.focus();
      if (li && focus.isNew) li.classList.add('is-new');
    }
  }

  // 24 hour times in half hour steps. A value from a hand edited config that is not on the list is added to it.
  const TIMES = Array.from({ length: 48 }, (_, i) => String(Math.floor(i / 2)).padStart(2, '0') + (i % 2 ? ':30' : ':00'));
  const timeOptions = TIMES.map(v => `<option value="${v}">${v}</option>`).join('');
  function setTime(sel, v) {
    if (v && !TIMES.includes(v) && !$$('option', sel).some(o => o.value === v)) sel.insertAdjacentHTML('afterbegin', `<option value="${esc(v)}">${esc(v)}</option>`);
    sel.value = v || '';
  }
  function renderHours() {
    const wrap = $('#hoursList');
    wrap.innerHTML = WEEK.map((k, i) => {
      const day = T('days')[i];
      return `<div class="hrow" data-k="${k}">
        <label class="hday"><span class="tog"><input type="checkbox" data-h="open" id="h-${k}-open" aria-label="${esc(T('openToggle', { d: day }))}"><span class="track" aria-hidden="true"></span></span><span class="hname">${esc(day)}</span></label>
        <div class="htimes"><select class="tsel" data-h="o" id="h-${k}-o" aria-label="${esc(day + ', ' + T('opens'))}">${timeOptions}</select><span class="hsep" aria-hidden="true"></span><select class="tsel" data-h="c" id="h-${k}-c" aria-label="${esc(day + ', ' + T('closes'))}">${timeOptions}</select></div>
        <span class="hoff">${esc(T('closedDay'))}</span>
        <p class="herr" hidden>${esc(T('hoursErr'))}</p>
      </div>`;
    }).join('');
    WEEK.forEach(k => syncHourRow(k));
  }
  function syncHourRow(k) {
    const row = $(`.hrow[data-k="${k}"]`);
    const r = cfg.hours[k];
    const mem = ui.mem[k] || ['09:00', '18:00'];
    const open = !!r;
    row.classList.toggle('is-closed', !open);
    $('[data-h="open"]', row).checked = open;
    setTime($('[data-h="o"]', row), open ? r[0] : mem[0]);
    setTime($('[data-h="c"]', row), open ? r[1] : mem[1]);
    $('[data-h="o"]', row).disabled = !open;
    $('[data-h="c"]', row).disabled = !open;
    const bad = open && !hoursValid(r);
    row.classList.toggle('is-bad', bad);
    $('.herr', row).hidden = !bad;
  }

  function fillContact() {
    const ch = cfg.contact.channel;
    $$('[data-ch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ch === ch)));
    $('#handleLabel').textContent = T(ch + 'L');
    $('#handlePre').textContent = ch === 'whatsapp' ? '+' : ch === 'telegram' ? 't.me/' : '';
    const input = $('#f-handle');
    input.placeholder = ch === 'whatsapp' ? '66 81 234 5678' : ch === 'line' ? '@yourshop' : 'yourshop';
    input.inputMode = ch === 'whatsapp' ? 'tel' : 'text';
    if (document.activeElement !== input) input.value = cfg.contact.handle;
    $('#handleHelp').textContent = T(ch + 'H');
    if (document.activeElement !== $('#f-phone')) $('#f-phone').value = cfg.contact.phone || '';
    checkHandle();
  }
  function checkHandle() {
    const ch = cfg.contact.channel;
    const raw = String(cfg.contact.handle || '').trim();
    const hd = cleanHandle(ch, raw);
    const st = $('#handleState');
    const wrap = $('#f-handle').closest('.affix');
    let cls = 'is-ok', msg;
    if (!raw) { cls = 'is-warn'; msg = T('handleEmpty'); }
    else if (!hd) { cls = 'is-err'; msg = T('handleBad')[ch]; }
    else if (hd === cleanHandle(ch, SAMPLE_HANDLE[ch])) { cls = 'is-warn'; msg = T('handleSample'); }
    else msg = T('handleOk', { url: chatUrl(ch, hd) });
    st.className = 'state ' + cls;
    st.textContent = msg;
    wrap.classList.toggle('is-bad', !!raw && !hd);
    $('#f-handle').setAttribute('aria-invalid', String(!!raw && !hd));
  }

  function fillMaps() {
    const input = $('#f-maps');
    if (document.activeElement !== input) input.value = cfg.address.mapsUrl || '';
    checkMaps();
  }
  function checkMaps() {
    const v = String(cfg.address.mapsUrl || '').trim();
    const st = $('#mapsState');
    const input = $('#f-maps');
    let cls = '', msg = '';
    if (v && !/^https?:\/\/\S+$/i.test(v)) { cls = 'is-err'; msg = T('mapsBad'); }
    else if (v && !/(google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(v)) { cls = 'is-warn'; msg = T('mapsNotGoogle'); }
    else if (v) { cls = 'is-ok'; msg = T('mapsOk'); }
    st.className = 'state ' + cls;
    st.textContent = msg;
    input.classList.toggle('is-bad', cls === 'is-err');
    input.setAttribute('aria-invalid', String(cls === 'is-err'));
  }

  /* ---------- readiness ---------- */
  function issues() {
    const out = [];
    const ch = cfg.contact.channel;
    if (!anyText(cfg.name)) out.push({ msg: T('iName'), go: 'f-name' });
    if (!cfg.services.length) out.push({ msg: T('iServices'), go: 'addSvc' });
    cfg.services.forEach((s, i) => {
      if (!anyText(s.name)) out.push({ msg: T('iSvcName', { n: i + 1 }), go: `svc-${i}-name` });
      else if (!(s.minutes >= 5) || !(s.price >= 0)) out.push({ msg: T('iSvcNum', { n: i + 1 }), go: `svc-${i}-min` });
    });
    if (!WEEK.some(k => cfg.hours[k])) out.push({ msg: T('iHours'), go: 'h-mon-open' });
    WEEK.forEach((k, i) => { if (cfg.hours[k] && !hoursValid(cfg.hours[k])) out.push({ msg: T('iHoursBad', { d: T('days')[i] }), go: `h-${k}-c` }); });
    const raw = String(cfg.contact.handle || '').trim();
    if (!raw) out.push({ msg: T('iHandle', { ch: CH[ch] }), go: 'f-handle' });
    else if (!cleanHandle(ch, raw)) out.push({ msg: T('iHandleBad', { ch: CH[ch] }), go: 'f-handle' });
    if (cfg.address.mapsUrl && !/^https?:\/\/\S+$/i.test(cfg.address.mapsUrl.trim())) out.push({ msg: T('iMaps'), go: 'f-maps' });
    cfg.faq.forEach((f, i) => { if (!anyText(f.q) && anyText(f.a)) out.push({ msg: T('iFaq', { n: i + 1 }), go: `faq-${i}-q` }); });
    return out;
  }
  function missing() {
    const fields = [cfg.name, cfg.tagline, cfg.sub, cfg.address.text, cfg.address.city, ...cfg.services.map(s => s.name), ...cfg.faq.flatMap(f => [f.q, f.a])];
    return cfg.languages.filter(l => l !== 'en').map(l => ({ l, n: fields.filter(v => valIn(v, 'en').trim() && !valIn(v, l).trim()).length })).filter(x => x.n > 0);
  }
  function renderReady() {
    const list = issues();
    const miss = missing();
    const el = $('#ready');
    el.className = 'ready ' + (list.length ? 'is-warn' : 'is-ok');
    const pct = readiness();
    const head = pct === 100 && !list.length ? T('ready') : T('readyPct', { n: pct });
    const sub = list.length ? (list.length === 1 ? T('issue1') : T('issuesN', { n: list.length })) : '';
    const C = 2 * Math.PI * 17;
    let html = `<div class="ready-h"><span class="ring" style="--p:${pct}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="ring-t" cx="20" cy="20" r="17"/><circle class="ring-v" cx="20" cy="20" r="17" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/></svg><b>${pct === 100 ? svg('check') : pct}</b></span><span><strong>${esc(head)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span></div>`;
    if (!list.length && pct === 100) html += `<p>${esc(T('readyP'))}</p>`;
    else html += `<ul>${list.slice(0, 5).map(x => `<li><button type="button" data-go="${esc(x.go)}">${esc(x.msg)}</button></li>`).join('')}</ul>`;
    if (miss.length) html += `<ul class="info">${miss.map(m => `<li><button type="button" data-edit="${m.l}">${esc(T('missingLang', { lang: T('langNames')[m.l], n: m.n }))}</button></li>`).join('')}</ul>`;
    el.innerHTML = html;
    el.classList.toggle('is-full', pct === 100);
    fun.sync();
  }
  function readiness() {
    const ch = cfg.contact.channel;
    const open = WEEK.filter(k => cfg.hours[k]);
    const checks = [
      anyText(cfg.name), anyText(cfg.tagline),
      cfg.services.length > 0 && cfg.services.every(s => anyText(s.name) && s.minutes >= 5 && s.price >= 0),
      open.length > 0 && open.every(k => hoursValid(cfg.hours[k])),
      !!cleanHandle(ch, String(cfg.contact.handle || '').trim()),
      anyText(cfg.address.text) || anyText(cfg.address.city),
      /^https?:\/\/\S+$/i.test(String(cfg.address.mapsUrl || '').trim()),
      cfg.faq.some(f => anyText(f.q))
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  /* ---------- editing events ---------- */
  panel.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.tx) { setText(el.dataset.tx, ui.edit, el.value); return changed(); }
    const li = el.closest('.row');
    if (el.dataset.s && li) {
      const s = cfg.services[+li.dataset.i];
      if (!s) return;
      if (el.dataset.s === 'name') { if (!s.name || typeof s.name !== 'object') s.name = { en: typeof s.name === 'string' ? s.name : '' }; s.name[ui.edit] = el.value; }
      else {
        const n = Math.round(Number(el.value));
        const ok = el.value !== '' && Number.isFinite(n) && n >= (el.dataset.s === 'minutes' ? 5 : 0);
        el.classList.toggle('is-bad', !ok);
        el.setAttribute('aria-invalid', String(!ok));
        if (ok) s[el.dataset.s] = n;
        svcHint(li, s);
      }
      return changed();
    }
    if (el.dataset.f && li) {
      const f = cfg.faq[+li.dataset.i];
      if (!f) return;
      if (!f[el.dataset.f] || typeof f[el.dataset.f] !== 'object') f[el.dataset.f] = { en: '' };
      f[el.dataset.f][ui.edit] = el.value;
      return changed();
    }
    if (el.dataset.h === 'o' || el.dataset.h === 'c') {
      const row = el.closest('.hrow');
      const k = row.dataset.k;
      const o = $('[data-h="o"]', row).value, c = $('[data-h="c"]', row).value;
      cfg.hours[k] = [o, c];
      ui.mem[k] = [o, c];
      syncHourRow(k);
      return changed();
    }
    switch (el.id) {
      case 'f-hex': {
        let v = el.value.trim().toLowerCase();
        if (v && v[0] !== '#') v = '#' + v;
        const ok = /^#[0-9a-f]{6}$/.test(v);
        el.classList.toggle('is-bad', !ok && v.length >= 7);
        $('#hexErr').hidden = ok || v.length < 7;
        if (ok) { cfg.accent = v; $('#f-color').value = v; renderSwatches(); changed(); }
        return;
      }
      case 'f-color': cfg.accent = el.value.toLowerCase(); fillLook(); renderSwatches(); return changed();
      case 'f-handle': cfg.contact.handle = el.value; ui.handles[cfg.contact.channel] = el.value; checkHandle(); return changed();
      case 'f-phone': cfg.contact.phone = el.value; return changed();
      case 'f-maps': cfg.address.mapsUrl = el.value.trim(); checkMaps(); return changed();
      default:
    }
  });

  panel.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'f-default') { cfg.defaultLang = el.value; return changed(); }
    if (el.id === 'f-slot') { cfg.slotMinutes = +el.value; return changed(); }
    if (el.id === 'f-hex') { fillLook(); return; }
    if (el.dataset.h === 'open') {
      const row = el.closest('.hrow');
      const k = row.dataset.k;
      if (el.checked) cfg.hours[k] = [$('[data-h="o"]', row).value || '09:00', $('[data-h="c"]', row).value || '18:00'];
      else { if (cfg.hours[k]) ui.mem[k] = cfg.hours[k]; cfg.hours[k] = null; }
      syncHourRow(k);
      return changed();
    }
  });

  panel.addEventListener('click', e => {
    const b = e.target.closest('button, a');
    if (!b) return;
    const d = b.dataset;
    if (d.preset) return applyPreset(d.preset);
    if (d.swatch) { cfg.accent = d.swatch; fillLook(); renderSwatches(); return changed(); }
    if (d.themeSet) { cfg.theme = d.themeSet; fillLook(); return changed(); }
    if (d.langToggle) return toggleLang(d.langToggle, b);
    if (d.ch) return setChannel(d.ch);
    if (d.edit) return setEditLang(d.edit);
    if (d.go) return goTo(d.go);
    if (d.act) return rowAction(b);
    if (b.closest('#jump') && b.tagName === 'A') {
      e.preventDefault();
      const card = $(b.getAttribute('href'));
      if (card) { card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); setJump(card.id); }
      return;
    }
    switch (b.id) {
      case 'f-sample': cfg.sample = !cfg.sample; b.setAttribute('aria-checked', String(cfg.sample)); checkHandle(); return changed();
      case 'addSvc':
        cfg.services.push({ name: { en: '', ru: '', th: '' }, minutes: 60, price: 0 });
        renderServices({ i: cfg.services.length - 1, sel: '[data-s="name"]', isNew: true });
        return changed();
      case 'addFaq':
        cfg.faq.push({ q: { en: '', ru: '', th: '' }, a: { en: '', ru: '', th: '' } });
        renderFaq({ i: cfg.faq.length - 1, sel: '[data-f="q"]', isNew: true });
        return changed();
      case 'copyMon': return copyMonday();
      case 'resetAll': return resetAll();
      default:
    }
  });

  function rowAction(b) {
    const li = b.closest('.row');
    const isSvc = !!li.closest('#svcList');
    const list = isSvc ? cfg.services : cfg.faq;
    const i = +li.dataset.i;
    const rerender = f => (isSvc ? renderServices(f) : renderFaq(f));
    if (b.dataset.act === 'up' && i > 0) {
      [list[i - 1], list[i]] = [list[i], list[i - 1]];
      rerender({ i: i - 1, sel: i - 1 === 0 ? '[data-act="del"]' : '[data-act="up"]' });
      return changed();
    }
    if (b.dataset.act === 'del') {
      if (li.classList.contains('is-out')) return;
      const before = clone(list);
      const finish = () => {
        list.splice(i, 1);
        rerender(list.length ? { i: Math.min(i, list.length - 1), sel: '[data-act="del"]' } : null);
        if (!list.length) $(isSvc ? '#addSvc' : '#addFaq').focus();
        changed();
        toast(T(isSvc ? 'svcRemoved' : 'faqRemoved'), {
          key: 'remove',
          action: { label: T('undo'), fn: () => { if (isSvc) cfg.services = before; else cfg.faq = before; rerender({ i, sel: '[data-act="del"]', isNew: true }); changed(); } }
        });
      };
      if (reduced()) return finish();
      li.classList.add('is-out');
      setTimeout(finish, 180);
    }
  }

  function applyPreset(key) {
    if (!PRESETS[key]) return;
    const prevKey = cfg.type;
    const prev = PRESETS[prevKey] ? fromPreset(prevKey) : null;
    const next = fromPreset(key);
    const snapshot = clone(cfg);
    const snapHandles = clone(ui.handles);
    cfg.type = key;
    cfg.services = next.services;
    cfg.faq = next.faq;
    cfg.hours = next.hours;
    cfg.slotMinutes = next.slotMinutes;
    for (const f of ['name', 'tagline', 'sub', 'accent', 'theme', 'address']) {
      if (!prev || same(cfg[f], prev[f])) cfg[f] = next[f];
    }
    if (!prev || same(cfg.contact, prev.contact)) { cfg.contact = next.contact; ui.handles = {}; }
    fillAll();
    changed();
    if (prevKey !== key) {
      toast(T('presetApplied', { name: T('presets')[key] }), {
        key: 'preset',
        action: { label: T('undo'), fn: () => { cfg = snapshot; ui.handles = snapHandles; fillAll(); changed(); } }
      });
    }
  }

  function toggleLang(l, btn) {
    const on = cfg.languages.includes(l);
    if (on && cfg.languages.length === 1) {
      btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
      toast(T('lastLang'), { tone: 'warn', key: 'lang' });
      return;
    }
    cfg.languages = on ? cfg.languages.filter(x => x !== l) : LANGS.filter(x => x === l || cfg.languages.includes(x));
    if (!cfg.languages.includes(cfg.defaultLang)) cfg.defaultLang = cfg.languages[0];
    if (!cfg.languages.includes(ui.edit)) { ui.edit = cfg.defaultLang; fillText(); renderServices(); renderFaq(); }
    renderLangs(); renderSelects(); renderEditLang();
    $(`[data-lang-toggle="${l}"]`).focus();
    changed();
  }

  function setEditLang(l) {
    if (!cfg.languages.includes(l) || l === ui.edit) return;
    const keep = document.activeElement && document.activeElement.id;
    ui.edit = l;
    renderEditLang(); fillText(); renderServices(); renderFaq(); renderReady();
    if (keep && $('#' + keep)) $('#' + keep).focus();
    postLang();
    clearTimeout(tSave); tSave = setTimeout(save, 400);
  }

  function setChannel(ch) {
    if (ch === cfg.contact.channel) return;
    ui.handles[cfg.contact.channel] = cfg.contact.handle;
    cfg.contact.channel = ch;
    cfg.contact.handle = ui.handles[ch] != null ? ui.handles[ch] : cfg.sample ? SAMPLE_HANDLE[ch] : '';
    fillContact();
    changed();
  }

  function copyMonday() {
    const mon = cfg.hours.mon;
    if (!mon) return toast(T('monClosed'), { tone: 'warn' });
    for (const k of WEEK) if (cfg.hours[k] && k !== 'mon') cfg.hours[k] = [mon[0], mon[1]];
    WEEK.forEach(syncHourRow);
    toast(T('copiedMon'));
    changed();
  }

  function resetAll() {
    const snapshot = clone(cfg);
    const snapHandles = clone(ui.handles);
    cfg = fromPreset('spa');
    ui.handles = {};
    ui.edit = cfg.defaultLang;
    fillAll();
    changed();
    postLang();
    toast(T('resetDone'), { action: { label: T('undo'), fn: () => { cfg = snapshot; ui.handles = snapHandles; fillAll(); changed(); } } });
  }

  function goTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isMobile() && ui.view !== 'edit') setView('edit');
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }

  /* ---------- top bar, tabs and devices ---------- */
  $$('[data-ui]').forEach(b => b.addEventListener('click', () => {
    ui.lang = b.dataset.ui;
    applyUi();
    save();
  }));
  $$('[data-dev]').forEach(b => b.addEventListener('click', () => { ui.device = b.dataset.dev; layout(); save(); }));
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  $('#tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = ui.view === 'edit' ? 'preview' : 'edit';
    setView(next);
    $(next === 'edit' ? '#tabEdit' : '#tabPreview').focus();
  });
  function setView(v) {
    ui.view = v;
    studio.dataset.view = v;
    document.body.dataset.view = v;
    $('#tabEdit').setAttribute('aria-selected', String(v === 'edit'));
    $('#tabPreview').setAttribute('aria-selected', String(v === 'preview'));
    $('#tabEdit').tabIndex = v === 'edit' ? 0 : -1;
    $('#tabPreview').tabIndex = v === 'preview' ? 0 : -1;
    window.scrollTo(0, 0);
    requestAnimationFrame(layout);
  }
  function syncMode() {
    const m = isMobile();
    for (const [el, tab] of [[panel, 'tabEdit'], [$('#preview'), 'tabPreview']]) {
      if (m) { el.setAttribute('role', 'tabpanel'); el.setAttribute('aria-labelledby', tab); }
      else { el.removeAttribute('role'); el.setAttribute('aria-labelledby', el === panel ? 'pTitle' : 'pvTitle'); }
    }
    if (!m && ui.view !== 'edit') { ui.view = 'edit'; studio.dataset.view = 'edit'; document.body.dataset.view = 'edit'; }
    watchJump();
    layout();
  }

  /* ---------- live preview ---------- */
  let frameReady = false, firstAck = false, loadTimer = 0;
  function exportCfg() {
    const c = clone(cfg);
    const tidy = v => {
      if (typeof v === 'string') return v.trim();
      if (!v || typeof v !== 'object') return v;
      const o = {};
      for (const l of LANGS) o[l] = typeof v[l] === 'string' ? v[l].trim() : '';
      return o;
    };
    for (const k of ['name', 'tagline', 'sub']) c[k] = tidy(c[k]);
    c.address.text = tidy(c.address.text);
    c.address.city = tidy(c.address.city);
    c.services = c.services.map(s => ({ name: tidy(s.name), minutes: Math.max(5, Math.round(+s.minutes) || 60), price: Math.max(0, Math.round(+s.price) || 0) }));
    c.faq = c.faq.filter(f => anyText(f.q)).map(f => ({ q: tidy(f.q), a: tidy(f.a) }));
    c.contact.handle = String(c.contact.handle || '').trim();
    c.contact.phone = String(c.contact.phone || '').trim();
    c.address.mapsUrl = String(c.address.mapsUrl || '').trim();
    return c;
  }
  function post() {
    $('#pvUrl').textContent = slug() + '.com';
    if (!frameReady) return;
    try { frame.contentWindow.postMessage({ type: 'lanta:config', config: exportCfg(), lang: ui.edit }, location.origin); } catch (e) { /* frame gone */ }
  }
  function postLang() {
    if (!frameReady) return;
    try { frame.contentWindow.postMessage({ type: 'lanta:lang', lang: ui.edit }, location.origin); } catch (e) { /* frame gone */ }
  }
  let renderWaiters = [];
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    const d = e.data || {};
    if (d.type === 'lanta:ready') {
      frameReady = true;
      clearTimeout(loadTimer);
      $('#pvErr').hidden = true;
      post();
    } else if (d.type === 'lanta:request') {
      fun.note(d);
    } else if (d.type === 'lanta:rendered' && frameReady) {
      $('#pvLoad').classList.add('is-off');
      setStatus('flash');
      renderWaiters.splice(0).forEach(fn => fn());
      if (!firstAck) { firstAck = true; document.documentElement.dataset.ready = 'true'; return; }
      if (d.lang && d.lang !== ui.edit && cfg.languages.includes(d.lang)) {
        ui.edit = d.lang;
        renderEditLang(); fillText(); renderServices(); renderFaq();
      }
    }
  });
  frame.addEventListener('load', () => {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => { if (!frameReady) showPreviewError(); }, 3500);
  });
  function showPreviewError() {
    $('#pvErr').hidden = false;
    $('#pvLoad').classList.add('is-off');
    setStatus('');
    document.documentElement.dataset.ready = 'true';
  }
  $('#pvRetry').addEventListener('click', () => {
    frameReady = false; firstAck = false;
    $('#pvErr').hidden = true;
    $('#pvLoad').classList.remove('is-off');
    frame.src = 'kit/site.html?lanta-preview=1&r=' + Date.now();
  });
  function waitRendered(ms) {
    return new Promise(res => { const t = setTimeout(res, ms); renderWaiters.push(() => { clearTimeout(t); res(); }); });
  }

  let flashTimer = 0;
  function setStatus(kind) {
    const el = $('#pvStatus');
    const t = $('#pvStatusT');
    clearTimeout(flashTimer);
    el.classList.remove('is-pending', 'is-flash', 'is-ready');
    if (kind === 'pending') { el.classList.add('is-pending'); t.textContent = T('pvWaiting'); }
    else if (kind === 'flash') {
      el.classList.add('is-ready', 'is-flash');
      t.textContent = T('pvUpdated');
      flashTimer = setTimeout(() => { el.classList.remove('is-flash'); t.textContent = T('pvLive'); }, 1200);
    } else if (frameReady) { el.classList.add('is-ready'); t.textContent = T('pvLive'); }
  }

  function slug() {
    const s = txt(cfg.name, 'en').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40);
    return /[a-z0-9]/.test(s) ? s : 'booking-site';
  }

  function layout() {
    $$('[data-dev]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dev === ui.device)));
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const pad = r.width < 600 ? 12 : 28;
    const W = Math.max(0, r.width - pad * 2), H = Math.max(0, r.height - pad * 2);
    let vw, s, kind = ui.device;
    if (kind === 'desktop') {
      vw = 1280;
      s = Math.min(1, W / vw);
      device.style.width = vw + 'px';
      device.style.height = H / s + 'px';
      box.style.width = vw * s + 'px';
      box.style.height = H + 'px';
    } else if (W < 430) {
      kind = 'bare'; vw = Math.round(W); s = 1;
      device.style.width = W + 'px';
      device.style.height = H + 'px';
      box.style.width = W + 'px';
      box.style.height = H + 'px';
    } else {
      vw = 390;
      const fw = vw + 24, fh = 844 + 24;
      s = Math.min(1, W / fw, H / fh);
      device.style.width = fw + 'px';
      device.style.height = fh + 'px';
      box.style.width = fw * s + 'px';
      box.style.height = fh * s + 'px';
    }
    device.dataset.dev = kind;
    device.style.transform = s === 1 ? 'none' : `scale(${s})`;
    $('#pvMeta').textContent = vw + ' px · ' + Math.round(s * 100) + '%';
    $('#pvUrl').textContent = slug() + '.com';
  }
  new ResizeObserver(() => layout()).observe(stage);

  /* ---------- section bar ---------- */
  let jumpObs = null;
  function setJump(id) { $$('#jump a').forEach(a => a.classList.toggle('is-on', a.getAttribute('href') === '#' + id)); }
  // Highlights the card that sits just under the sticky bar.
  function watchJump() {
    if (jumpObs) jumpObs.disconnect();
    const m = isMobile();
    const root = m ? null : panel;
    const top = (m ? $('.top').offsetHeight + $('#tabs').offsetHeight : 0) + $('#bar').offsetHeight + 12;
    const height = m ? window.innerHeight : panel.clientHeight;
    const bottom = Math.max(0, height - top - 24);
    jumpObs = new IntersectionObserver(entries => {
      for (const en of entries) if (en.isIntersecting) setJump(en.target.id);
    }, { root, rootMargin: `-${top}px 0px -${bottom}px 0px` });
    $$('.panel .card').forEach(c => jumpObs.observe(c));
  }
  let jumpTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(jumpTimer); jumpTimer = setTimeout(watchJump, 200); });
  const bar = $('#bar');
  const stuck = () => {
    const limit = $('.top').offsetHeight + $('#tabs').offsetHeight + 1;
    const on = bar.getBoundingClientRect().top <= limit;
    bar.classList.toggle('is-stuck', on);
    if (!on) setJump(null);
  };
  panel.addEventListener('scroll', stuck, { passive: true });
  window.addEventListener('scroll', stuck, { passive: true });

  /* ---------- clipboard ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  /* ---------- export ---------- */
  function configJs() {
    const c = exportCfg();
    const name = txt(c.name, c.defaultLang).replace(/\*\//g, '');
    return '/* Site config for ' + name + '.\n' +
      '   Edit the values and keep the structure. Text fields take en, ru and th, an empty language shows English.\n' +
      '   Made with the site builder by Alexandr Khrustalev on ' + new Date().toISOString().slice(0, 10) + '. README.md explains every field. */\n' +
      'window.LANTA = ' + JSON.stringify(c, null, 2) + ';\n';
  }

  function buildIndex(html, ld) {
    const L = cfg.defaultLang;
    const name = txt(cfg.name, L) || 'Business';
    const tag = txt(cfg.tagline, L);
    const desc = txt(cfg.sub, L) || tag;
    let out = html
      .replace(/<html lang="[^"]*" data-theme="[^"]*">/, `<html lang="${L}" data-theme="${cfg.theme === 'dark' ? 'dark' : 'light'}">`)
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(name + (tag ? ' · ' + tag : ''))}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
      .replace(/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${cfg.theme === 'dark' ? '#0a1020' : '#f5f3ee'}">`);
    if (ld) out = out.replace('</head>', `<script type="application/ld+json" id="lanta-ld">${ld.replace(/</g, '\\u003c')}</script>\n</head>`);
    return out;
  }

  function clientReadme() {
    const c = exportCfg();
    const L = c.defaultLang;
    const name = txt(c.name, L) || 'Business';
    const ch = c.contact.channel;
    const hd = cleanHandle(ch, c.contact.handle);
    const uiLang = ui.lang;
    ui.lang = 'en';
    const todo = issues().map(x => '- ' + x.msg);
    ui.lang = uiLang;
    if (c.sample) todo.push('- Set "sample" to false in config.js, or switch off Sample banner in the site builder.');
    if (hd && hd === cleanHandle(ch, SAMPLE_HANDLE[ch])) todo.push('- Replace the placeholder ' + CH[ch] + ' contact with the real one.');
    todo.push('- Check every price, duration and opening time with the owner.', '- Open the site on a phone and send one test request to yourself.');
    const chLine = hd
      ? `Requests open in ${CH[ch]} for ${ch === 'whatsapp' ? '+' + hd : ch === 'line' ? hd : '@' + hd}. The visitor sends the message from their own app, and the business confirms the time in that chat.`
      : 'No contact is set yet, so the booking button stays off. Add contact.handle in config.js.';
    const tg = ch === 'telegram' ? '\n\nTelegram cannot prefill a message in a chat with a person. The site copies the request to the clipboard first and tells the visitor to paste it.' : '';
    return `# ${name} website

A one page booking site made with the site builder by Alexandr Khrustalev, for local businesses in Thailand. It is plain HTML, CSS and JavaScript with no build step and no tracking.

## Files

| File | What it does |
| --- | --- |
| index.html | Page shell with the title, description and search data. |
| config.js | All business content: names, prices, hours, contact and questions. |
| site.js | Builds the page from config.js and runs the booking widget and language switch. |
| site.css | Styles. Colours follow the accent and theme set in config.js. |
| README.md | This guide. |

## Change the content

Open config.js in any text editor, change the values and save. Reload the page to see the result.

- Text fields have en, ru and th values. An empty value shows the English text.
- Prices are whole baht. A price of 0 shows as free.
- Hours use 24 hour time, for example ["09:00", "18:00"]. Use null for a day off. A closing time of "00:00" means midnight.
- slotMinutes sets how far apart the offered start times are. leadMinutes hides times that start too soon today.
- accent is any #rrggbb colour. theme is light or dark. Button text switches to dark or light by itself for contrast.

Keep the quotes, commas and brackets as they are. If the page turns blank after an edit, a comma or a quote is usually missing.

## Booking requests

${chLine}${tg}

The site never stores requests. If you want a copy of every request in a Telegram chat, set relayUrl in config.js to a small relay such as the optional Cloudflare Worker that comes with the site builder.

## Publish

- Netlify Drop: open app.netlify.com/drop and drag this folder onto the page.
- GitHub Pages: create a repository, upload these files to the main branch, then turn on Pages under Settings.
- Any other static host or your own server works the same way. Upload the files as they are.

## Before going live

${todo.join('\n')}
`;
  }

  /* STORE method zip writer with CRC32, no compression and no library. */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStore(files, when = new Date()) {
    const enc = new TextEncoder();
    const time = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
    const date = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true);
      lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 0x0314, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true);
      ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true);
      ch.setUint16(36, 0, true);
      ch.setUint32(38, (0o100644 << 16) >>> 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((n, b) => n + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  let kitCache = null;
  async function loadKit() {
    if (kitCache) return kitCache;
    const texts = await Promise.all(KIT_FILES.map(async f => {
      const r = await fetch('kit/' + f, { cache: 'no-cache' });
      if (!r.ok) throw new Error(f + ' ' + r.status);
      return r.text();
    }));
    kitCache = { html: texts[0], css: texts[1], js: texts[2] };
    return kitCache;
  }

  let busy = false;
  $('#dl').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const btn = $('#dl');
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    try {
      clearTimeout(tPost);
      if (frameReady) { const w = waitRendered(800); post(); await w; }
      const kit = await loadKit();
      let ld = '';
      try { const s = frame.contentDocument && frame.contentDocument.getElementById('lanta-ld'); ld = s ? s.textContent : ''; } catch (e) { ld = ''; }
      const files = [
        { name: 'index.html', data: buildIndex(kit.html, ld) },
        { name: 'site.css', data: kit.css },
        { name: 'site.js', data: kit.js },
        { name: 'config.js', data: configJs() },
        { name: 'README.md', data: clientReadme() }
      ];
      const blob = zipStore(files);
      const file = slug() + '-site.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const left = issues().length;
      if (left) toast(T('downloadedWarn', { file, n: left }), { tone: 'warn' });
      else toast(T('downloaded', { file, n: files.length, kb: Math.max(1, Math.round(blob.size / 1024)) }));
      btn.classList.add('is-done');
      setTimeout(() => btn.classList.remove('is-done'), 1400);
      fun.burst(btn);
    } catch (err) {
      toast(T('zipFail'), { tone: 'err', ms: 7000 });
    } finally {
      busy = false;
      btn.classList.remove('is-busy');
      btn.removeAttribute('aria-busy');
    }
  });

  $('#copyCfg').addEventListener('click', () => {
    copyText(configJs()).then(ok => toast(ok ? T('copied') : T('copyFail'), { tone: ok ? 'ok' : 'err', key: 'copy' }));
  });

  /* ---------- toasts ---------- */
  function toast(msg, { tone = 'ok', action = null, ms = 4200, key = '' } = {}) {
    const wrap = $('#toasts');
    if (key) $$('.toast', wrap).forEach(t => { if (t.dataset.key === key) t.remove(); });
    const el = document.createElement('div');
    el.className = 'toast is-' + tone;
    el.dataset.key = key;
    el.innerHTML = svg(tone === 'ok' ? 'check' : 'alert') + '<span></span>';
    el.querySelector('span').textContent = msg;
    let timer = 0;
    const close = () => { clearTimeout(timer); el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 320); };
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 't-act';
      b.textContent = action.label;
      b.addEventListener('click', () => { action.fn(); close(); });
      el.append(b);
    }
    wrap.append(el);
    while (wrap.children.length > 3) wrap.firstElementChild.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    const wait = action ? 7000 : ms;
    timer = setTimeout(close, wait);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { clearTimeout(timer); timer = setTimeout(close, 2000); });
  }

  /* ---------- start ---------- */
  fillAll();
  applyUi();
  setView('edit');
  syncMode();
  window.matchMedia('(max-width: 1023px)').addEventListener('change', syncMode);
  if (restored) toast(T('restored'), { action: { label: T('reset'), fn: resetAll } });
  // The kit may have finished loading before this script ran, in which case its ready message was missed.
  try {
    if (!frameReady && frame.contentDocument && frame.contentDocument.documentElement.dataset.ready === 'true') { frameReady = true; post(); }
  } catch (e) { /* not reachable yet */ }
  setTimeout(() => { if (!frameReady && frame.contentDocument && frame.contentDocument.readyState === 'complete') showPreviewError(); }, 6000);
})();
