/* Lanta site kit 1.0
   Builds a one page booking site from window.LANTA, which config.js defines.
   Plain JavaScript, no dependencies and no build step. Edit config.js, not this file. */
(() => {
  'use strict';

  const LANGS = ['en', 'ru', 'th'];
  const LOCALE = { en: 'en-GB', ru: 'ru-RU', th: 'th-TH' };
  const LANG_NAME = { en: 'English', ru: 'Русский', th: 'ไทย' };
  const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const JS_DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const SCHEMA_DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const LD_TYPE = { spa: 'DaySpa', tours: 'TravelAgency', bike: 'AutoRental', dental: 'Dentist', cafe: 'CafeOrCoffeeShop', other: 'LocalBusiness' };
  const CH_NAME = { whatsapp: 'WhatsApp', line: 'LINE', telegram: 'Telegram' };
  const DEFAULT_ACCENT = '#1f5c46';

  /* ---------- interface text ---------- */
  const DICT = {
    en: {
      skip: 'Skip to content', navServices: 'Services', navBooking: 'Booking', navHours: 'Hours', navLocation: 'Location', navFaq: 'FAQ',
      langLabel: 'Language', bookShort: 'Book', heroCta: 'Book a time', heroAlt: 'Services and prices',
      openNow: 'Open now until {t}', opensToday: 'Closed now, opens today at {t}', opensTomorrow: 'Closed now, opens tomorrow at {t}', opensOn: 'Closed now, opens {d} at {t}',
      noHours: 'Opening hours will be announced soon', range: '{a} to {b}',
      factToday: 'Today', factWhere: 'Where', factBook: 'Booking', factFrom: 'Prices from', viaCh: 'Request in {ch}', factNext: 'Earliest times, {d}',
      closed: 'Closed', todayTag: 'Today', tomorrow: 'Tomorrow', today: 'today', tomorrowLow: 'tomorrow', to: 'to',
      servicesTitle: 'Services and prices', servicesSub: 'Prices are in Thai baht. Pick a service to book a time for it.', choose: 'Book this', free: 'Free',
      noServices: 'The service list is coming soon.', service: 'Service',
      bookingTitle: 'Book a time', bookingSub: 'Choose a service, a day and a time. Your request opens in {ch}, and we confirm it there.',
      bookingSubNone: 'Choose a service, a day and a time, then contact us to confirm.',
      stepService: 'Service', stepDay: 'Day', stepTime: 'Time', stepDetails: 'Your details', nameLabel: 'Name', noteLabel: 'Comment', optional: 'optional',
      notePh: 'Number of people, wishes', tz: 'Times are in Thailand time.', noTimes: 'No times left on this day. Please choose another day.', noDays: 'There are no open days this week.',
      summaryTitle: 'Your request', notChosen: 'Not chosen', pickTime: 'Choose a time to continue.', sendVia: 'Send request in {ch}',
      tgHint: 'Telegram cannot fill in the text for you, so the message is copied first. Paste it into the chat.',
      tgCopied: 'Message copied. Paste it into the Telegram chat that opened.', tgCopyFail: 'Could not copy automatically. Copy the message below and paste it into Telegram.',
      opening: 'Opening {ch}. If nothing happens, copy the message and send it yourself.', copyMsg: 'Copy message', copied: 'Copied',
      noContact: 'Online requests are not set up yet. Please call or visit us.', requestNote: 'This is a request, not a confirmed booking. We reply in the chat to confirm the time.',
      hoursTitle: 'Opening hours', locationTitle: 'How to find us', openMaps: 'Open in Google Maps', copyAddress: 'Copy address', addressCopied: 'Address copied',
      callUs: 'Call {p}', writeUs: 'Message us in {ch}', faqTitle: 'Frequently asked questions', mapLabel: 'Map of {c}',
      sample: 'Sample site. The business, prices and contacts are placeholders.', rights: '© {y} {n}',
      msgHello: 'Hello, {n}! I would like to book a time.', msgService: 'Service', msgDate: 'Date', msgTime: 'Time', msgName: 'Name', msgNote: 'Comment', msgFrom: 'Sent from the website',
      dateLong: '{wd} {d} {m}', unitMin: 'min', unitH: 'h', dayForms: { one: 'day', other: 'days' }, timeSuffix: '',
      types: { spa: 'Spa and massage', tours: 'Tours and trips', bike: 'Motorbike rental', dental: 'Dental clinic', cafe: 'Cafe', other: 'Local business' },
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      daysOn: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      daysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    },
    ru: {
      skip: 'Перейти к содержимому', navServices: 'Услуги', navBooking: 'Запись', navHours: 'Часы работы', navLocation: 'Как добраться', navFaq: 'Вопросы',
      langLabel: 'Язык', bookShort: 'Записаться', heroCta: 'Выбрать время', heroAlt: 'Услуги и цены',
      openNow: 'Сейчас открыто, до {t}', opensToday: 'Сейчас закрыто, откроемся сегодня в {t}', opensTomorrow: 'Сейчас закрыто, откроемся завтра в {t}', opensOn: 'Сейчас закрыто, откроемся {d} в {t}',
      noHours: 'Часы работы скоро появятся', range: 'с {a} до {b}',
      factToday: 'Сегодня', factWhere: 'Где', factBook: 'Запись', factFrom: 'Цены от', viaCh: 'Заявка в {ch}', factNext: 'Ближайшее время, {d}',
      closed: 'Выходной', todayTag: 'Сегодня', tomorrow: 'Завтра', today: 'сегодня', tomorrowLow: 'завтра', to: 'до',
      servicesTitle: 'Услуги и цены', servicesSub: 'Цены в тайских батах. Выберите услугу, чтобы записаться на неё.', choose: 'Записаться', free: 'Бесплатно',
      noServices: 'Список услуг скоро появится.', service: 'Услуга',
      bookingTitle: 'Запись онлайн', bookingSub: 'Выберите услугу, день и время. Заявка откроется в {ch}, там же мы её подтвердим.',
      bookingSubNone: 'Выберите услугу, день и время, а затем свяжитесь с нами для подтверждения.',
      stepService: 'Услуга', stepDay: 'День', stepTime: 'Время', stepDetails: 'Ваши данные', nameLabel: 'Имя', noteLabel: 'Комментарий', optional: 'необязательно',
      notePh: 'Сколько человек, пожелания', tz: 'Время указано по Таиланду.', noTimes: 'На этот день свободного времени не осталось. Выберите другой день.', noDays: 'На этой неделе нет рабочих дней.',
      summaryTitle: 'Ваша заявка', notChosen: 'Не выбрано', pickTime: 'Выберите время, чтобы продолжить.', sendVia: 'Отправить заявку в {ch}',
      tgHint: 'Telegram не умеет сам вставлять текст, поэтому мы сначала скопируем сообщение. Вставьте его в чат.',
      tgCopied: 'Сообщение скопировано. Вставьте его в открывшийся чат Telegram.', tgCopyFail: 'Не удалось скопировать автоматически. Скопируйте сообщение ниже и вставьте его в Telegram.',
      opening: 'Открываем {ch}. Если ничего не произошло, скопируйте сообщение и отправьте его сами.', copyMsg: 'Скопировать сообщение', copied: 'Скопировано',
      noContact: 'Онлайн-заявки пока не настроены. Позвоните нам или приходите.', requestNote: 'Это заявка, а не подтверждённая запись. Мы ответим в чате и подтвердим время.',
      hoursTitle: 'Часы работы', locationTitle: 'Как нас найти', openMaps: 'Открыть в Google Картах', copyAddress: 'Скопировать адрес', addressCopied: 'Адрес скопирован',
      callUs: 'Позвонить {p}', writeUs: 'Написать в {ch}', faqTitle: 'Частые вопросы', mapLabel: 'Карта, {c}',
      sample: 'Пример сайта. Компания, цены и контакты условные.', rights: '© {y} {n}',
      msgHello: 'Здравствуйте, {n}! Хочу записаться.', msgService: 'Услуга', msgDate: 'Дата', msgTime: 'Время', msgName: 'Имя', msgNote: 'Комментарий', msgFrom: 'Отправлено с сайта',
      dateLong: '{wd}, {d} {m}', unitMin: 'мин', unitH: 'ч', dayForms: { one: 'день', few: 'дня', many: 'дней', other: 'дня' }, timeSuffix: '',
      types: { spa: 'Спа и массаж', tours: 'Экскурсии и поездки', bike: 'Аренда байков', dental: 'Стоматология', cafe: 'Кафе', other: 'Местный бизнес' },
      days: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
      daysOn: ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'],
      daysShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      months: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
    },
    th: {
      skip: 'ข้ามไปยังเนื้อหา', navServices: 'บริการ', navBooking: 'จองคิว', navHours: 'เวลาทำการ', navLocation: 'ที่ตั้ง', navFaq: 'คำถาม',
      langLabel: 'ภาษา', bookShort: 'จอง', heroCta: 'เลือกเวลา', heroAlt: 'บริการและราคา',
      openNow: 'เปิดอยู่ ถึง {t}', opensToday: 'ปิดอยู่ เปิดวันนี้ เวลา {t}', opensTomorrow: 'ปิดอยู่ เปิดพรุ่งนี้ เวลา {t}', opensOn: 'ปิดอยู่ เปิด{d} เวลา {t}',
      noHours: 'จะแจ้งเวลาทำการเร็วๆ นี้', range: '{a} ถึง {b} น.',
      factToday: 'วันนี้', factWhere: 'ที่ไหน', factBook: 'การจอง', factFrom: 'ราคาเริ่มต้น', viaCh: 'ส่งคำขอทาง {ch}', factNext: 'เวลาที่ใกล้ที่สุด {d}',
      closed: 'ปิด', todayTag: 'วันนี้', tomorrow: 'พรุ่งนี้', today: 'วันนี้', tomorrowLow: 'พรุ่งนี้', to: 'ถึง',
      servicesTitle: 'บริการและราคา', servicesSub: 'ราคาเป็นเงินบาท เลือกบริการเพื่อจองเวลา', choose: 'จองบริการนี้', free: 'ฟรี',
      noServices: 'รายการบริการจะมาเร็วๆ นี้', service: 'บริการ',
      bookingTitle: 'จองเวลา', bookingSub: 'เลือกบริการ วัน และเวลา คำขอจะเปิดใน {ch} และเราจะยืนยันในแชท',
      bookingSubNone: 'เลือกบริการ วัน และเวลา แล้วติดต่อเราเพื่อยืนยัน',
      stepService: 'บริการ', stepDay: 'วัน', stepTime: 'เวลา', stepDetails: 'ข้อมูลของคุณ', nameLabel: 'ชื่อ', noteLabel: 'หมายเหตุ', optional: 'ไม่บังคับ',
      notePh: 'จำนวนคน หรือคำขอเพิ่มเติม', tz: 'เวลาตามเวลาประเทศไทย', noTimes: 'วันนี้ไม่มีเวลาว่างแล้ว กรุณาเลือกวันอื่น', noDays: 'สัปดาห์นี้ไม่มีวันเปิดทำการ',
      summaryTitle: 'คำขอของคุณ', notChosen: 'ยังไม่ได้เลือก', pickTime: 'เลือกเวลาเพื่อดำเนินการต่อ', sendVia: 'ส่งคำขอทาง {ch}',
      tgHint: 'Telegram ใส่ข้อความให้อัตโนมัติไม่ได้ ระบบจะคัดลอกข้อความไว้ก่อน แล้ววางในแชท',
      tgCopied: 'คัดลอกข้อความแล้ว วางในแชท Telegram ที่เปิดขึ้น', tgCopyFail: 'คัดลอกอัตโนมัติไม่สำเร็จ กรุณาคัดลอกข้อความด้านล่างแล้ววางใน Telegram',
      opening: 'กำลังเปิด {ch} หากไม่มีอะไรเกิดขึ้น ให้คัดลอกข้อความแล้วส่งเอง', copyMsg: 'คัดลอกข้อความ', copied: 'คัดลอกแล้ว',
      noContact: 'ยังไม่เปิดรับคำขอออนไลน์ กรุณาโทรหรือแวะมาที่ร้าน', requestNote: 'นี่คือคำขอ ยังไม่ใช่การจองที่ยืนยันแล้ว เราจะตอบกลับในแชทเพื่อยืนยันเวลา',
      hoursTitle: 'เวลาทำการ', locationTitle: 'วิธีเดินทางมาหาเรา', openMaps: 'เปิดใน Google Maps', copyAddress: 'คัดลอกที่อยู่', addressCopied: 'คัดลอกที่อยู่แล้ว',
      callUs: 'โทร {p}', writeUs: 'ทักแชททาง {ch}', faqTitle: 'คำถามที่พบบ่อย', mapLabel: 'แผนที่ {c}',
      sample: 'เว็บไซต์ตัวอย่าง ชื่อร้าน ราคา และช่องทางติดต่อเป็นข้อมูลสมมติ', rights: '© {y} {n}',
      msgHello: 'สวัสดี {n} ต้องการจองเวลา', msgService: 'บริการ', msgDate: 'วันที่', msgTime: 'เวลา', msgName: 'ชื่อ', msgNote: 'หมายเหตุ', msgFrom: 'ส่งจากเว็บไซต์',
      dateLong: '{wd}ที่ {d} {m}', unitMin: 'นาที', unitH: 'ชม.', dayForms: { other: 'วัน' }, timeSuffix: ' น.',
      types: { spa: 'สปาและนวด', tours: 'ทัวร์และทริป', bike: 'เช่ามอเตอร์ไซค์', dental: 'คลินิกทันตกรรม', cafe: 'คาเฟ่', other: 'ธุรกิจท้องถิ่น' },
      days: ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์'],
      daysOn: ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์'],
      daysShort: ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'],
      months: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    }
  };

  /* ---------- icons, static markup only ---------- */
  const ICON = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
    phone: '<path d="M6.6 3.5h2.6l1.6 4.2-2 1.5a11 11 0 0 0 6 6l1.5-2 4.2 1.6v2.6a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1z"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    send: '<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  const ic = name => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'i');
    s.innerHTML = ICON[name] || '';
    return s;
  };

  /* ---------- tiny DOM builder, text always goes in as text ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const c of kids) {
      if (c == null || c === false || c === '') continue;
      if (Array.isArray(c)) add(el, c);
      else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- config ---------- */
  const PREVIEW = /[?&]lanta-preview=1(&|$)/.test(location.search) && window.parent !== window;
  let cfg = normalize(window.LANTA);
  let lang = pickLang();
  let firstRender = true;
  const S = { svc: 0, day: -1, time: -1, name: '', note: '' };

  function isText(v) { return typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v)); }
  function timeOk(s) { return typeof s === 'string' && /^([01]?\d|2[0-4]):[0-5]\d$/.test(s.trim()); }
  function int(v, d, lo, hi) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }

  function normalize(raw) {
    const c = raw && typeof raw === 'object' ? raw : {};
    const languages = Array.isArray(c.languages) ? c.languages.filter(l => LANGS.includes(l)) : [];
    const out = {
      type: LD_TYPE[c.type] ? c.type : 'other',
      sample: !!c.sample,
      name: isText(c.name) ? c.name : 'Your business',
      tagline: isText(c.tagline) ? c.tagline : '',
      sub: isText(c.sub) ? c.sub : '',
      accent: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.accent || '') ? c.accent : DEFAULT_ACCENT,
      theme: c.theme === 'dark' ? 'dark' : 'light',
      languages: languages.length ? [...new Set(languages)] : ['en'],
      defaultLang: 'en',
      timezone: typeof c.timezone === 'string' ? c.timezone : 'Asia/Bangkok',
      slotMinutes: int(c.slotMinutes, 30, 5, 240),
      leadMinutes: int(c.leadMinutes, 30, 0, 1440),
      services: [],
      hours: {},
      contact: { channel: 'whatsapp', handle: '', phone: '' },
      address: { text: '', city: '', mapsUrl: '', region: '', postalCode: '' },
      faq: [],
      relayUrl: typeof c.relayUrl === 'string' && /^https:\/\//.test(c.relayUrl) ? c.relayUrl : ''
    };
    out.defaultLang = out.languages.includes(c.defaultLang) ? c.defaultLang : out.languages[0];
    if (Array.isArray(c.services)) {
      for (const s of c.services) {
        if (!s || typeof s !== 'object') continue;
        out.services.push({ name: isText(s.name) ? s.name : '', minutes: int(s.minutes, 60, 5, 60 * 24 * 31), price: int(s.price, 0, 0, 10000000) });
      }
    }
    const hrs = c.hours && typeof c.hours === 'object' ? c.hours : {};
    for (const k of WEEK) {
      const v = hrs[k];
      out.hours[k] = Array.isArray(v) && timeOk(v[0]) && timeOk(v[1]) ? [v[0].trim(), v[1].trim()] : null;
    }
    if (c.contact && typeof c.contact === 'object') {
      out.contact.channel = CH_NAME[c.contact.channel] ? c.contact.channel : 'whatsapp';
      out.contact.handle = String(c.contact.handle || '');
      out.contact.phone = String(c.contact.phone || '');
    }
    if (c.address && typeof c.address === 'object') {
      const a = c.address;
      out.address.text = isText(a.text) ? a.text : '';
      out.address.city = isText(a.city) ? a.city : '';
      out.address.mapsUrl = typeof a.mapsUrl === 'string' && /^https?:\/\/\S+$/i.test(a.mapsUrl.trim()) ? a.mapsUrl.trim() : '';
      out.address.region = String(a.region || '');
      out.address.postalCode = String(a.postalCode || '');
    }
    if (Array.isArray(c.faq)) {
      for (const f of c.faq) if (f && isText(f.q) && isText(f.a)) out.faq.push({ q: f.q, a: f.a });
    }
    return out;
  }

  function pickLang() {
    const on = cfg.languages;
    const q = new URLSearchParams(location.search).get('lang');
    if (on.includes(q)) return q;
    if (!PREVIEW) {
      try { const s = localStorage.getItem('lanta.lang'); if (on.includes(s)) return s; } catch (e) { /* storage blocked */ }
      const nav = (navigator.languages || [navigator.language || '']).map(l => String(l).slice(0, 2).toLowerCase());
      for (const l of nav) if (on.includes(l)) return l;
    }
    return cfg.defaultLang;
  }

  /* ---------- text helpers ---------- */
  function t(key, vars) {
    let s = DICT[lang] && DICT[lang][key];
    if (s == null) s = DICT.en[key];
    if (s == null) return key;
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return s;
  }
  function txIn(v, l) {
    if (v == null) return '';
    if (typeof v !== 'object') return String(v).trim();
    const pick = x => (typeof v[x] === 'string' ? v[x].trim() : '');
    return pick(l) || pick('en') || pick(cfg.defaultLang) || LANGS.map(pick).find(Boolean) || '';
  }
  const tx = v => txIn(v, lang);
  const D = key => DICT[lang][key] || DICT.en[key];

  const toMin = s => { const [hh, mm] = s.split(':').map(Number); return hh * 60 + mm; };
  const fromMin = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const tm = m => fromMin(m) + t('timeSuffix');

  function dur(min) {
    if (min >= 1440 && min % 1440 === 0) {
      const n = min / 1440;
      let form = 'other';
      try { form = new Intl.PluralRules(LOCALE[lang]).select(n); } catch (e) { /* old browser */ }
      const forms = D('dayForms');
      return n + ' ' + (forms[form] || forms.other);
    }
    if (min < 60) return min + ' ' + t('unitMin');
    const hh = Math.floor(min / 60), mm = min % 60;
    return hh + ' ' + t('unitH') + (mm ? ' ' + mm + ' ' + t('unitMin') : '');
  }
  function price(n) {
    if (!n) return t('free');
    try {
      return new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'THB', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(n);
    } catch (e) {
      return '฿' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }
  const svcName = (s, i) => tx(s.name) || t('service') + ' ' + (i + 1);

  /* ---------- time in the business time zone ---------- */
  function zonedNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: cfg.timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      const g = k => Number((parts.find(p => p.type === k) || {}).value);
      return { y: g('year'), m: g('month'), d: g('day'), min: (g('hour') % 24) * 60 + g('minute') };
    } catch (e) {
      const n = new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), min: n.getHours() * 60 + n.getMinutes() };
    }
  }
  function dayRange(key) {
    const r = cfg.hours[key];
    if (!r) return null;
    const o = toMin(r[0]);
    let c = toMin(r[1]);
    if (c === 0) c = 1440;
    return c > o ? { o, c } : null;
  }
  function upcoming() {
    const now = zonedNow();
    const base = Date.UTC(now.y, now.m - 1, now.d);
    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base + i * 864e5);
      const key = JS_DAY[d.getUTCDay()];
      list.push({ i, key, wi: WEEK.indexOf(key), dom: d.getUTCDate(), mon: d.getUTCMonth(), iso: d.toISOString().slice(0, 10), range: dayRange(key), nowMin: now.min });
    }
    return list;
  }
  function slotsFor(day, svc) {
    if (!day || !day.range) return [];
    const { o, c } = day.range;
    const step = cfg.slotMinutes, span = c - o;
    const need = svc && svc.minutes <= span ? svc.minutes : Math.min(step, span);
    const earliest = day.i === 0 ? day.nowMin + cfg.leadMinutes : -1;
    const out = [];
    for (let m = o; m + need <= c; m += step) if (m >= earliest) out.push(m);
    return out;
  }
  function dayWord(day) {
    if (day.i === 0) return t('today');
    if (day.i === 1) return t('tomorrowLow');
    return D('daysOn')[day.wi];
  }
  function dateLong(day) {
    let wd = D('days')[day.wi];
    if (lang === 'ru') wd = wd.toLowerCase();
    return t('dateLong', { wd, d: day.dom, m: D('months')[day.mon] });
  }
  function status(days) {
    const today = days[0];
    if (today.range && today.nowMin >= today.range.o && today.nowMin < today.range.c) return { cls: 'open', text: t('openNow', { t: tm(today.range.c) }) };
    if (today.range && today.nowMin < today.range.o) return { cls: 'closed', text: t('opensToday', { t: tm(today.range.o) }) };
    for (let i = 1; i < 7; i++) {
      const d = days[i];
      if (!d.range) continue;
      if (i === 1) return { cls: 'closed', text: t('opensTomorrow', { t: tm(d.range.o) }) };
      return { cls: 'closed', text: t('opensOn', { d: D('daysOn')[d.wi], t: tm(d.range.o) }) };
    }
    return { cls: 'none', text: t('noHours') };
  }

  /* ---------- contact channel ---------- */
  function handle() {
    const ch = cfg.contact.channel;
    let s = String(cfg.contact.handle || '').trim();
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
  function handleLabel() {
    const hd = handle();
    if (!hd) return '';
    if (cfg.contact.channel === 'whatsapp') return '+' + hd;
    return cfg.contact.channel === 'line' ? hd : '@' + hd;
  }
  function chatLink(msg) {
    const hd = handle();
    if (!hd) return '';
    const ch = cfg.contact.channel;
    if (ch === 'whatsapp') return 'https://wa.me/' + hd + (msg ? '?text=' + encodeURIComponent(msg) : '');
    if (ch === 'line') return msg ? 'https://line.me/R/oaMessage/' + hd + '/?' + encodeURIComponent(msg) : 'https://line.me/R/ti/p/' + encodeURIComponent(hd);
    return 'https://t.me/' + hd;
  }
  const chName = () => CH_NAME[cfg.contact.channel];
  const phoneHref = () => { const p = cfg.contact.phone.replace(/[^\d+]/g, ''); return p.length >= 6 ? 'tel:' + p : ''; };

  /* ---------- clipboard ---------- */
  function legacyCopy(text) {
    const ta = h('textarea', { readonly: true, 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    return Promise.resolve(legacyCopy(text));
  }

  /* ---------- colour ---------- */
  function rgb(hex) {
    let x = hex.slice(1);
    if (x.length === 3) x = x.split('').map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
  }
  const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, w) => a.map((v, i) => v + (b[i] - v) * w);
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  function applyColours() {
    const root = document.documentElement;
    const a = rgb(cfg.accent);
    const dark = cfg.theme === 'dark';
    /* accent text has to read on the weakest surface of each theme: the tinted band in light, the card in dark */
    const bg = dark ? [17, 26, 51] : [238, 235, 228];
    const white = [255, 255, 255], ink = [18, 18, 20];
    const cw = contrast(a, white), ci = contrast(a, ink);
    const on = cw >= 3.2 || cw >= ci ? white : ink;
    let text = a;
    for (let w = 0.08; contrast(text, bg) < 4.5 && w <= 1; w += 0.08) text = mix(a, dark ? white : ink, w);
    root.dataset.theme = cfg.theme;
    root.style.setProperty('--accent', toHex(a));
    root.style.setProperty('--accent-2', toHex(mix(a, white, 0.16)));
    root.style.setProperty('--accent-text', toHex(text));
    root.style.setProperty('--on-accent', toHex(on));
    root.style.setProperty('--accent-rgb', a.join(','));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0a1020' : '#f5f3ee');
    return { on: toHex(on) };
  }

  /* ---------- document head: title, description, icon, structured data ---------- */
  function applyHead(colours) {
    const name = tx(cfg.name);
    const city = tx(cfg.address.city);
    document.documentElement.lang = lang;
    document.title = name + ' · ' + t('types')[cfg.type] + (city ? ', ' + city : '');
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) { desc = h('meta', { name: 'description' }); document.head.append(desc); }
    desc.setAttribute('content', tx(cfg.sub) || tx(cfg.tagline));
    const initial = (Array.from(name)[0] || 'L').toUpperCase().replace(/[<&>"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${cfg.accent}"/><text x="16" y="22" font-family="Arial,sans-serif" font-weight="700" font-size="16" fill="${colours.on}" text-anchor="middle">${initial}</text></svg>`;
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) { icon = h('link', { rel: 'icon' }); document.head.append(icon); }
    icon.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg));
    let ld = document.getElementById('lanta-ld');
    if (!ld) { ld = h('script', { type: 'application/ld+json', id: 'lanta-ld' }); document.head.append(ld); }
    ld.textContent = JSON.stringify(jsonLd()).replace(/</g, '\\u003c');
  }

  function jsonLd() {
    const L = cfg.defaultLang;
    const groups = new Map();
    for (const k of WEEK) {
      const r = cfg.hours[k];
      if (!dayRange(k)) continue;
      const id = r[0] + '|' + r[1];
      if (!groups.has(id)) groups.set(id, { '@type': 'OpeningHoursSpecification', dayOfWeek: [], opens: r[0], closes: r[1] === '24:00' ? '23:59' : r[1] });
      groups.get(id).dayOfWeek.push('https://schema.org/' + SCHEMA_DAY[k]);
    }
    const prices = cfg.services.map(s => s.price).filter(p => p > 0);
    const link = chatLink('');
    const a = cfg.address;
    const data = {
      '@context': 'https://schema.org',
      '@type': LD_TYPE[cfg.type],
      name: txIn(cfg.name, L),
      description: txIn(cfg.sub, L) || txIn(cfg.tagline, L) || undefined,
      url: PREVIEW ? undefined : location.href.split(/[?#]/)[0],
      telephone: cfg.contact.phone || undefined,
      currenciesAccepted: 'THB',
      priceRange: prices.length ? '฿' + Math.min(...prices) + ' to ฿' + Math.max(...prices) : undefined,
      knowsLanguage: cfg.languages,
      address: txIn(a.text, 'en') || txIn(a.city, 'en') ? {
        '@type': 'PostalAddress', streetAddress: txIn(a.text, 'en') || undefined, addressLocality: txIn(a.city, 'en') || undefined,
        addressRegion: a.region || undefined, postalCode: a.postalCode || undefined, addressCountry: 'TH'
      } : undefined,
      hasMap: a.mapsUrl || undefined,
      sameAs: link ? [link] : undefined,
      openingHoursSpecification: groups.size ? [...groups.values()] : undefined,
      hasOfferCatalog: cfg.services.length ? {
        '@type': 'OfferCatalog', name: 'Services',
        itemListElement: cfg.services.map(s => ({ '@type': 'Offer', price: s.price, priceCurrency: 'THB', itemOffered: { '@type': 'Service', name: txIn(s.name, L) || 'Service' } }))
      } : undefined
    };
    return data;
  }

  /* ---------- page sections ---------- */
  function sampleBar() {
    return cfg.sample ? h('div', { class: 'sample', role: 'note' }, h('div', { class: 'wrap', text: t('sample') })) : null;
  }

  function header() {
    const name = tx(cfg.name);
    const nav = [['services', 'navServices'], ['booking', 'navBooking'], ['hours', 'navHours'], ['location', 'navLocation']];
    if (cfg.faq.length) nav.push(['faq', 'navFaq']);
    return h('header', { class: 'top' },
      h('a', { class: 'skip', href: '#main', text: t('skip') }),
      h('div', { class: 'wrap top-in' },
        h('a', { class: 'brand', href: '#top', 'aria-label': name },
          h('span', { class: 'mark', 'aria-hidden': 'true', text: (Array.from(name)[0] || 'L').toUpperCase() }),
          h('span', { class: 'brand-name', text: name })),
        h('nav', { class: 'nav' }, nav.map(([id, key]) => h('a', { href: '#' + id, text: t(key) }))),
        cfg.languages.length > 1 ? h('div', { class: 'lang', role: 'group', 'aria-label': t('langLabel') },
          cfg.languages.map(l => h('button', {
            type: 'button', lang: l, 'data-k': 'lang-' + l, 'aria-pressed': String(l === lang), 'aria-label': LANG_NAME[l],
            onclick: () => setLang(l), text: l.toUpperCase()
          }))) : null,
        h('a', { class: 'btn btn-accent btn-sm top-cta', href: '#booking', text: t('bookShort') })));
  }

  function hero(days) {
    const st = status(days);
    const city = tx(cfg.address.city);
    const sub = tx(cfg.sub);
    return h('section', { class: 'hero', id: 'top', 'aria-labelledby': 'heroT' },
      h('div', { class: 'wrap hero-g' },
        h('div', { class: 'hero-c' },
          h('p', { class: 'kicker' }, t('types')[cfg.type] + (city ? ' · ' + city : '')),
          h('h1', { id: 'heroT', text: tx(cfg.tagline) || tx(cfg.name) }),
          sub ? h('p', { class: 'lead', text: sub }) : null,
          h('p', { class: 'status is-' + st.cls }, ic('clock'), st.text),
          h('div', { class: 'btns' },
            h('a', { class: 'btn btn-accent', href: '#booking' }, t('heroCta'), ic('arrow')),
            cfg.services.length ? h('a', { class: 'btn btn-line', href: '#services', text: t('heroAlt') }) : null)),
        h('div', { class: 'hero-v' }, facts(days))));
  }

  function facts(days) {
    const today = days[0];
    const city = tx(cfg.address.city) || tx(cfg.address.text);
    const prices = cfg.services.map(s => s.price);
    const paid = prices.filter(p => p > 0);
    const rows = [
      [t('factToday'), today.range ? t('range', { a: fromMin(today.range.o), b: fromMin(today.range.c) }) : t('closed'), 'clock'],
      city ? [t('factWhere'), city, 'pin'] : null,
      handle() ? [t('factBook'), t('viaCh', { ch: chName() }), 'chat'] : null,
      prices.length ? [t('factFrom'), paid.length ? price(Math.min(...paid)) : t('free'), null] : null
    ].filter(Boolean);
    const svc = cfg.services[S.svc] || cfg.services[0];
    let next = null;
    for (const d of days) {
      const sl = slotsFor(d, svc);
      if (sl.length) { next = { d, sl: sl.slice(0, 3) }; break; }
    }
    const name = tx(cfg.name);
    return h('aside', { class: 'facts', 'aria-label': name },
      h('div', { class: 'f-head' },
        h('span', { class: 'mark', 'aria-hidden': 'true', text: (Array.from(name)[0] || 'L').toUpperCase() }),
        h('div', null, h('small', { text: t('types')[cfg.type] }), h('strong', { text: name }))),
      h('div', { class: 'f-body' },
        next && cfg.services.length ? h('div', { class: 'f-next' },
          h('p', { class: 'f-k', id: 'nextT', text: t('factNext', { d: dayWord(next.d) }) }),
          h('div', { class: 'f-slots', role: 'group', 'aria-labelledby': 'nextT' }, next.sl.map(m => h('button', {
            type: 'button', class: 'chip', 'data-k': 'next-' + m, text: fromMin(m),
            onclick: () => { S.day = next.d.i; S.time = m; renderBooking(); go('booking', '.send'); }
          })))) : null,
        h('dl', { class: 'f-list' }, rows.map(([k, v, i]) => h('div', { class: 'f-row' },
          h('dt', null, i ? ic(i) : h('span', { class: 'f-baht', 'aria-hidden': 'true', text: '฿' }), k),
          h('dd', { text: v }))))));
  }

  function secHead(id, title, sub) {
    return h('div', { class: 'sec-head' }, h('h2', { id, text: title }), sub ? h('p', { text: sub }) : null);
  }

  function servicesSec() {
    const list = cfg.services;
    return h('section', { class: 'sec alt', id: 'services', 'aria-labelledby': 'svcT' },
      h('div', { class: 'wrap' },
        secHead('svcT', t('servicesTitle'), list.length ? t('servicesSub') : null),
        list.length ? h('ul', { class: 'svc-grid' }, list.map((s, i) => h('li', { class: 'svc' },
          h('div', { class: 'svc-top' },
            h('h3', { text: svcName(s, i) }),
            h('span', { class: 'price', text: price(s.price) })),
          h('div', { class: 'svc-b' },
            h('span', { class: 'pill' }, ic('clock'), dur(s.minutes)),
            h('button', {
              type: 'button', class: 'svc-go', 'data-k': 'go-' + i, 'aria-label': t('choose') + ': ' + svcName(s, i),
              onclick: () => { S.svc = i; S.time = -1; renderBooking(); go('booking', '[data-k="svc-' + i + '"]'); }
            }, t('choose'), ic('arrow')))))) : h('p', { class: 'empty', text: t('noServices') })));
  }

  function bookingSec() {
    return h('section', { class: 'sec', id: 'booking', 'aria-labelledby': 'bkT' },
      h('div', { class: 'wrap' },
        secHead('bkT', t('bookingTitle'), handle() ? t('bookingSub', { ch: chName() }) : t('bookingSubNone')),
        h('div', { class: 'bk', id: 'bk' }, bookingBody())));
  }

  function clampState(days) {
    const list = cfg.services;
    if (S.svc >= list.length) S.svc = 0;
    const svc = list[S.svc];
    const okDay = i => days[i] && slotsFor(days[i], svc).length > 0;
    if (!okDay(S.day)) S.day = days.findIndex((d, i) => okDay(i));
    const sl = S.day >= 0 ? slotsFor(days[S.day], svc) : [];
    if (!sl.includes(S.time)) S.time = -1;
    return { svc, sl };
  }

  function bookingBody() {
    const days = upcoming();
    const list = cfg.services;
    const { svc, sl } = clampState(days);
    const steps = h('div', { class: 'bk-steps' });

    steps.append(h('div', { class: 'step' },
      h('h3', { class: 'step-t', id: 'stS' }, h('span', { class: 'n', text: '1' }), t('stepService')),
      list.length ? h('div', { class: 'opts', role: 'group', 'aria-labelledby': 'stS' }, list.map((s, i) => h('button', {
        type: 'button', class: 'opt', 'data-k': 'svc-' + i, 'aria-pressed': String(i === S.svc),
        onclick: () => { S.svc = i; renderBooking(); }
      }, h('span', { class: 'o-n', text: svcName(s, i) }), h('span', { class: 'o-m', text: dur(s.minutes) + ' · ' + price(s.price) })))) : h('p', { class: 'empty', text: t('noServices') })));

    steps.append(h('div', { class: 'step' },
      h('h3', { class: 'step-t', id: 'stD' }, h('span', { class: 'n', text: '2' }), t('stepDay')),
      h('div', { class: 'days', role: 'group', 'aria-labelledby': 'stD' }, days.map(d => {
        const can = slotsFor(d, svc).length > 0;
        const top = d.i === 0 ? t('todayTag') : d.i === 1 ? t('tomorrow') : D('daysShort')[d.wi];
        return h('button', {
          type: 'button', class: 'day', 'data-k': 'day-' + d.i, 'aria-pressed': String(d.i === S.day), disabled: !can,
          'aria-label': dateLong(d) + (d.range ? '' : ', ' + t('closed')),
          onclick: () => { S.day = d.i; S.time = -1; renderBooking(); }
        }, h('span', { class: 'd-w', text: top }), h('b', { text: d.dom }), h('span', { class: 'd-m', text: d.range ? D('months')[d.mon] : t('closed') }));
      }))));

    steps.append(h('div', { class: 'step' },
      h('h3', { class: 'step-t', id: 'stT' }, h('span', { class: 'n', text: '3' }), t('stepTime')),
      sl.length ? h('div', { class: 'times', role: 'group', 'aria-labelledby': 'stT' }, sl.map(m => h('button', {
        type: 'button', class: 'slot', 'data-k': 't-' + m, 'aria-pressed': String(m === S.time), text: fromMin(m),
        onclick: () => { S.time = m; renderBooking(); }
      }))) : h('p', { class: 'empty', text: S.day < 0 ? t('noDays') : t('noTimes') }),
      h('p', { class: 'tz' }, ic('clock'), t('tz'))));

    const nameIn = h('input', { id: 'bkName', type: 'text', autocomplete: 'name', maxlength: '80', 'data-k': 'name' });
    nameIn.value = S.name;
    nameIn.addEventListener('input', () => { S.name = nameIn.value; refreshMessage(); });
    const noteIn = h('textarea', { id: 'bkNote', rows: '2', maxlength: '300', placeholder: t('notePh'), 'data-k': 'note' });
    noteIn.value = S.note;
    noteIn.addEventListener('input', () => { S.note = noteIn.value; refreshMessage(); });
    steps.append(h('div', { class: 'step' },
      h('h3', { class: 'step-t' }, h('span', { class: 'n', text: '4' }), t('stepDetails')),
      h('div', { class: 'fields' },
        h('div', { class: 'field' }, h('label', { for: 'bkName' }, t('nameLabel'), h('small', { text: t('optional') })), nameIn),
        h('div', { class: 'field' }, h('label', { for: 'bkNote' }, t('noteLabel'), h('small', { text: t('optional') })), noteIn))));

    return [steps, summary(days, svc)];
  }

  function message(days, svc) {
    const d = days[S.day];
    const lines = [t('msgHello', { n: tx(cfg.name) }), ''];
    if (svc) lines.push(t('msgService') + ': ' + svcName(svc, S.svc) + ', ' + dur(svc.minutes) + ', ' + price(svc.price));
    if (d) lines.push(t('msgDate') + ': ' + dateLong(d));
    if (S.time >= 0) lines.push(t('msgTime') + ': ' + tm(S.time));
    if (S.name.trim()) lines.push(t('msgName') + ': ' + S.name.trim());
    if (S.note.trim()) lines.push(t('msgNote') + ': ' + S.note.trim());
    lines.push('', t('msgFrom'));
    return lines.join('\n');
  }

  function summary(days, svc) {
    const d = days[S.day];
    const ready = !!(svc && d && S.time >= 0);
    const hd = handle();
    const msg = message(days, svc);
    const ch = cfg.contact.channel;
    const hint = h('p', { class: 'hint', id: 'bkHint', 'aria-live': 'polite', text: !hd ? '' : !ready ? t('pickTime') : ch === 'telegram' ? t('tgHint') : '' });
    let send;
    if (!hd) {
      send = h('div', { class: 'nocontact' }, h('p', { text: t('noContact') }),
        phoneHref() ? h('a', { class: 'btn btn-accent send', href: phoneHref() }, ic('phone'), t('callUs', { p: cfg.contact.phone })) : null);
    } else if (ready) {
      send = h('a', { class: 'btn btn-accent send', href: chatLink(msg), target: '_blank', rel: 'noopener', 'data-k': 'send' }, ic('send'), t('sendVia', { ch: chName() }));
      send.addEventListener('click', e => {
        if (PREVIEW) {
          e.preventDefault();
          window.parent.postMessage({ type: 'lanta:request', channel: cfg.contact.channel, business: tx(cfg.name), text: message(upcoming(), cfg.services[S.svc]) }, location.origin);
          return;
        }
        onSend(hint);
      });
    } else {
      send = h('button', { type: 'button', class: 'btn btn-accent send', 'aria-disabled': 'true', 'aria-describedby': 'bkHint', 'data-k': 'send' }, ic('send'), t('sendVia', { ch: chName() }));
      send.addEventListener('click', () => {
        hint.textContent = '';
        requestAnimationFrame(() => { hint.textContent = t('pickTime'); hint.classList.remove('nudge'); void hint.offsetWidth; hint.classList.add('nudge'); });
        const first = document.querySelector('#bk .slot');
        if (first) first.focus();
      });
    }
    const copyBtn = h('button', { type: 'button', class: 'linkbtn', 'data-k': 'copy' }, ic('copy'), h('span', { text: t('copyMsg') }));
    copyBtn.addEventListener('click', () => {
      copy(message(upcoming(), cfg.services[S.svc])).then(ok => {
        const sp = copyBtn.querySelector('span');
        sp.textContent = ok ? t('copied') : t('copyMsg');
        if (ok) setTimeout(() => { if (sp.isConnected) sp.textContent = t('copyMsg'); }, 1800);
      });
    });
    const row = (k, v, on) => h('div', { class: 'sum-r' + (on ? '' : ' is-empty') }, h('dt', { text: k }), h('dd', { text: v }));
    return h('aside', { class: 'sum', 'aria-labelledby': 'sumT' },
      h('h3', { id: 'sumT', text: t('summaryTitle') }),
      h('dl', { class: 'sum-l' },
        row(t('stepService'), svc ? svcName(svc, S.svc) : t('notChosen'), !!svc),
        row(t('stepDay'), d ? dateLong(d) : t('notChosen'), !!d),
        row(t('stepTime'), S.time >= 0 ? tm(S.time) : t('notChosen'), S.time >= 0)),
      h('div', { class: 'bubble' },
        h('p', { class: 'b-h' }, ic('chat'), h('span', { text: hd ? chName() + ' · ' + handleLabel() : chName() })),
        h('pre', { class: 'b-t', id: 'bkMsg', text: msg })),
      send, hint,
      h('div', { class: 'sum-f' }, copyBtn),
      h('p', { class: 'fine', text: t('requestNote') }));
  }

  function refreshMessage() {
    const days = upcoming();
    const svc = cfg.services[S.svc];
    const msg = message(days, svc);
    const pre = document.getElementById('bkMsg');
    if (pre) pre.textContent = msg;
    const a = document.querySelector('#bk a.send[target]');
    if (a) a.setAttribute('href', chatLink(msg));
  }

  function onSend(hint) {
    const days = upcoming();
    const svc = cfg.services[S.svc];
    const msg = message(days, svc);
    relay(days, svc);
    if (cfg.contact.channel === 'telegram') {
      copy(msg).then(ok => { hint.textContent = ok ? t('tgCopied') : t('tgCopyFail'); });
    } else {
      hint.textContent = t('opening', { ch: chName() });
    }
  }

  /* Optional copy of each request to the owner's Telegram, see worker/telegram-relay.js in the Lanta README. */
  function relay(days, svc) {
    if (!cfg.relayUrl || PREVIEW) return;
    const d = days[S.day];
    const body = { business: txIn(cfg.name, cfg.defaultLang), service: svc ? txIn(svc.name, cfg.defaultLang) : '', minutes: svc ? svc.minutes : 0, price: svc ? svc.price : 0, date: d ? d.iso : '', time: S.time >= 0 ? fromMin(S.time) : '', name: S.name.trim(), note: S.note.trim(), lang, channel: cfg.contact.channel, page: location.href.split('#')[0], website: '' };
    try { fetch(cfg.relayUrl, { method: 'POST', mode: 'cors', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {}); } catch (e) { /* relay is best effort */ }
  }

  function infoSec(days) {
    const st = status(days);
    const todayKey = days[0].key;
    const addr = tx(cfg.address.text);
    const city = tx(cfg.address.city);
    const maps = cfg.address.mapsUrl;
    const link = chatLink('');
    const copyAddr = h('button', { type: 'button', class: 'btn btn-line btn-sm', 'data-k': 'copyaddr' }, ic('copy'), h('span', { text: t('copyAddress') }));
    copyAddr.addEventListener('click', () => copy([addr, city].filter(Boolean).join(', ')).then(ok => {
      if (!ok) return;
      const sp = copyAddr.querySelector('span');
      sp.textContent = t('addressCopied');
      setTimeout(() => { if (sp.isConnected) sp.textContent = t('copyAddress'); }, 1800);
    }));
    const hoursCard = h('div', { class: 'card', id: 'hours', 'aria-labelledby': 'hrT', role: 'region' },
      h('h2', { id: 'hrT', class: 'card-t', text: t('hoursTitle') }),
      h('p', { class: 'status is-' + st.cls }, ic('clock'), st.text),
      h('table', { class: 'hours' },
        h('caption', { class: 'sr', text: t('hoursTitle') }),
        h('tbody', null, WEEK.map((k, i) => {
          const r = dayRange(k);
          const isToday = k === todayKey;
          return h('tr', { class: isToday ? 'is-today' : null, 'aria-current': isToday ? 'date' : null },
            h('th', { scope: 'row' }, D('days')[i], isToday ? h('span', { class: 'tag', text: t('todayTag') }) : null),
            h('td', null, r ? [h('span', { text: fromMin(r.o) }), h('span', { class: 'to', 'aria-hidden': 'true' }), h('span', { class: 'sr', text: ' ' + t('to') + ' ' }), h('span', { text: fromMin(r.c) })] : h('span', { class: 'off', text: t('closed') })));
        }))),
      h('p', { class: 'tz' }, ic('clock'), t('tz')));
    const locCard = h('div', { class: 'card', id: 'location', 'aria-labelledby': 'locT', role: 'region' },
      h('h2', { id: 'locT', class: 'card-t', text: t('locationTitle') }),
      h(maps ? 'a' : 'div', { class: 'map', href: maps || null, target: maps ? '_blank' : null, rel: maps ? 'noopener' : null, 'aria-label': maps ? t('openMaps') : null },
        h('span', { class: 'map-pin', 'aria-hidden': 'true' }, ic('pin')),
        city ? h('span', { class: 'map-c', text: city }) : null),
      addr ? h('address', { class: 'addr', text: addr }) : null,
      h('div', { class: 'loc-btns' },
        maps ? h('a', { class: 'btn btn-accent btn-sm', href: maps, target: '_blank', rel: 'noopener' }, ic('ext'), t('openMaps')) : null,
        addr ? copyAddr : null),
      h('ul', { class: 'contacts' },
        link ? h('li', null, h('a', { href: link, target: '_blank', rel: 'noopener' }, ic('chat'), t('writeUs', { ch: chName() }))) : null,
        phoneHref() ? h('li', null, h('a', { href: phoneHref() }, ic('phone'), t('callUs', { p: cfg.contact.phone }))) : null));
    return h('section', { class: 'sec alt' }, h('div', { class: 'wrap info-g' }, hoursCard, locCard));
  }

  function faqSec() {
    if (!cfg.faq.length) return null;
    return h('section', { class: 'sec', id: 'faq', 'aria-labelledby': 'faqT' },
      h('div', { class: 'wrap faq-g' },
        h('div', { class: 'sec-head' }, h('h2', { id: 'faqT', text: t('faqTitle') })),
        h('div', { class: 'faq' }, cfg.faq.map((f, i) => {
          const q = tx(f.q), a = tx(f.a);
          if (!q) return null;
          return h('details', { 'data-k': 'faq-' + i }, h('summary', { text: q }), a ? h('p', { text: a }) : null);
        }))));
  }

  function footer(days) {
    const name = tx(cfg.name);
    const now = zonedNow();
    const link = chatLink('');
    return h('footer', { class: 'foot' },
      h('div', { class: 'wrap foot-g' },
        h('div', { class: 'foot-b' },
          h('span', { class: 'mark', 'aria-hidden': 'true', text: (Array.from(name)[0] || 'L').toUpperCase() }),
          h('div', null, h('strong', { text: name }), h('span', { text: t('types')[cfg.type] + (tx(cfg.address.city) ? ' · ' + tx(cfg.address.city) : '') }))),
        h('div', { class: 'foot-l' },
          link ? h('a', { href: link, target: '_blank', rel: 'noopener', text: chName() + ' ' + handleLabel() }) : null,
          phoneHref() ? h('a', { href: phoneHref(), text: cfg.contact.phone }) : null,
          h('span', { text: status(days).text }))),
      h('div', { class: 'wrap foot-s' },
        h('span', { text: t('rights', { y: now.y, n: name }) }),
        cfg.sample ? h('span', { text: t('sample') }) : null));
  }

  /* ---------- rendering ---------- */
  function keepFocus(fn) {
    const a = document.activeElement;
    const key = a && a.dataset ? a.dataset.k : null;
    const sel = key && (a.selectionStart != null) ? [a.selectionStart, a.selectionEnd] : null;
    fn();
    if (!key) return;
    const b = document.querySelector('[data-k="' + key + '"]');
    if (!b) return;
    if (b.disabled) return;
    b.focus({ preventScroll: true });
    if (sel && b.setSelectionRange) try { b.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text field */ }
  }

  function renderBooking() {
    const bk = document.getElementById('bk');
    if (!bk) return;
    keepFocus(() => bk.replaceChildren(...bookingBody()));
  }

  function go(id, focusSel) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    const f = focusSel ? el.querySelector(focusSel) : null;
    if (f) f.focus({ preventScroll: true });
  }

  function setLang(l) {
    if (!cfg.languages.includes(l) || l === lang) return;
    lang = l;
    if (!PREVIEW) try { localStorage.setItem('lanta.lang', l); } catch (e) { /* storage blocked */ }
    render();
  }

  function render() {
    if (!cfg.languages.includes(lang)) lang = cfg.defaultLang;
    const colours = applyColours();
    applyHead(colours);
    const days = upcoming();
    const app = document.getElementById('app');
    keepFocus(() => {
      app.replaceChildren(
        sampleBar() || '',
        header(),
        h('main', { id: 'main', tabindex: '-1' }, hero(days), servicesSec(), bookingSec(), infoSec(days), faqSec() || ''),
        footer(days));
    });
    if (firstRender && !reduced()) {
      document.body.classList.add('enter');
      setTimeout(() => document.body.classList.remove('enter'), 1400);
    }
    firstRender = false;
    document.documentElement.dataset.ready = 'true';
    if (PREVIEW) window.parent.postMessage({ type: 'lanta:rendered', lang }, location.origin);
  }

  /* Live preview inside Lanta Studio. Only same origin parent frames can send a config. */
  if (PREVIEW) {
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const d = e.data || {};
      if (d.type === 'lanta:config') {
        cfg = normalize(d.config);
        if (d.lang && cfg.languages.includes(d.lang)) lang = d.lang;
        render();
      } else if (d.type === 'lanta:lang' && cfg.languages.includes(d.lang)) {
        lang = d.lang;
        render();
      } else if (d.type === 'lanta:goto') {
        const t = document.getElementById(String(d.id || ''));
        if (t) (t.closest('section') || t).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  render();
  if (PREVIEW) window.parent.postMessage({ type: 'lanta:ready' }, location.origin);

  // Keep the open status and today's times current on long visits.
  setInterval(() => { if (!document.hidden && !document.activeElement.closest('#bk')) render(); }, 5 * 60 * 1000);
})();
