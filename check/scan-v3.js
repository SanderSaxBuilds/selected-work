/* Preview copy of check/scan.js for the V3 pass (31 Oct 2026). The page opens with the example report already shown under the address box,
   the device switch updates the example, and the report is laid out as score tiles, summary, top fixes and the page screenshot.
   Website check. A visitor types an address in the box, a real Lighthouse run measures it, and the result prints in plain words.
   Engine: Microlink's free Lighthouse endpoint (browser callable, no key, about 25 runs a day per visitor).
   PageSpeed Insights is used instead when PSI_KEY holds a browser key restricted to this site. Google's keyless PSI quota is 0. */
(function(){
"use strict";
var PSI_KEY="";
var CONTACT={email:"leshadqq@gmail.com",telegram:"sandersax",whatsapp:"66961347329"};
var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var CATS=["performance","accessibility","best-practices","seo"];
var LIMIT=75000;            /* stop waiting after this many ms */
var AXIS=60;                /* seconds shown on the instrument's time axis */
var STEP_AT=[0,0,2.5,7,15,22,1e9];  /* when each step usually starts, seconds; the last one starts on the reply */

/* -------- words -------- */
var S={
en:{doc:"Free website check · Pagewarden",cap:"Free speed and SEO check for your website.",skip:"Skip to the address field",kick:"Website check",instr:"Measuring instrument",
 h1a:"Measure any website",h1b:"in about thirty seconds.",
 lead:"Type an address. A real Lighthouse test, the engine behind Google PageSpeed, opens the page on a simulated phone or computer. You get scores, the fixes that matter most, and what each one means for your customers.",
 fieldLabel:"Website address",ph:"yourbusiness.com",devLabel:"Device",phone:"Phone",desktop:"Desktop",measure:"Measure",stop:"Stop",
 ready:"Ready",readyP:"Type an address below and press Measure.",
 devNote:{mobile:"Test device: mid-range phone, slow 4G",desktop:"Test device: desktop computer, fast connection"},
 steps:["Address checked","Request sent to the test server","Opening the page on the test device","Measuring how fast it loads","Checking reading and tapping","Checking Google basics and security","Reply received, writing the report"],
 typical:"usually done here",elapsed:"Elapsed",retry:"The test server was busy, trying once more",
 doneBtn:"Read the report",took:"Measured in {x} s",
 e:{empty:"Type a website address first.",invalid:"That does not look like a web address. Try something like yourbusiness.com.",local:"That address only works on your own computer or network. Enter a public website.",
  unreach:"The test server could not open that address. Check the spelling, then open it in your browser to make sure it loads.",
  timeout:"The page took too long to load for the test. That alone is a sign it is slow for visitors. Try again in a minute.",
  quota:"Today's free tests from this connection are used up. Try again tomorrow, or send me the address and I will run the check for you.",
  net:"Could not reach the test server. Check your internet connection and try again.",other:"The test did not finish ({c}). Try again in a minute.",stopped:"Measurement stopped."},
 exampleNote:"The example report below shows what you will get.",
 privacy:"To run the test, the address goes to Microlink, a public service. This site stores nothing.",
 rep:"Website report",sampleTag:"Example",sampleP:"A real report for example.com, the standard test address. Measure your own site above.",
 liveTag:"Measured just now",
 fAddr:"Address",fWhen:"Measured",fDev:"Device",fEng:"Engine",
 dev:{mobile:"Phone",desktop:"Desktop"},devWord:{mobile:"phones",desktop:"computers"},
 cats:{performance:"Speed",accessibility:"Easy to use","best-practices":"Trust and safety",seo:"Found on Google"},
 catSub:{performance:"How fast it opens",accessibility:"Reading and tapping","best-practices":"Security and errors",seo:"Search basics"},
 band:["Poor","Needs work","Good"],of:"out of 100",
 readings:"Measurements",
 mn:{fcp:"First thing appears",lcp:"Main content visible",tbt:"Ignores taps while loading",cls:"Page jumps while loading",tbw:"Download size"},
 mh:{fcp:"When the first text or picture shows up.",lcp:"When the biggest part of the page is visible. Aim for under 2.5 s.",tbt:"How long the page is too busy to react to a tap.",cls:"How much things move around as the page loads. Aim for under 0.1.",tbw:"Everything a visitor downloads on the first visit."},
 fixHead:"Fix these first",fixSub:"Ordered by how much each one helps your visitors. Tap a score above to see one area only.",
 more:"Smaller things found ({n})",noFix:"Nothing important to fix. This page is in very good shape.",noFixCat:"Nothing to fix in this area.",
 impact:["Low impact","Medium impact","High impact"],saw:"What the test saw",saves:"Could make the page appear about {x} sooner",
 all:"All areas",showing:"Showing: {c}",
 v:{good:"In very good shape on {d}.",perf:"Slow on {d}. The main content takes {x} to appear, and many visitors give up before that.",perf2:"Could be faster on {d}.",
  access:"Some visitors will struggle to read it or tap the right thing.","best-practices":"There are trust or safety problems to fix.",seo:"Google may not show this page well.",
  tail1:"Start with the fix below.",tailN:"Start with the {n} fixes below."},
 actPrint:"Print or save as PDF",actCopy:"Copy summary",actLink:"Copy link to this check",copied:"Copied",copyFail:"Could not copy",
 otherDev:"Check on {d} too",
 ctaH:"I can fix these for you",ctaP:"I build and repair websites for small businesses in Thailand. Send me this report and I will tell you what is worth fixing, the price and how long it takes. If your site is fine, I will say so.",
 tg:"Message on Telegram",wa:"Message on WhatsApp",waS:"The summary is already in the message",em:"Send an email",
 hello:"Hello Alexandr, I checked my website with your tool.",fixFirst:"Fix first:",link:"Report",subj:"Website check for {u}",
 shotAlt:"How the page looked on the test {d} at the end of loading",shotCap:{mobile:"The page on the test phone",desktop:"The page on the test computer"},
 generic:"A technical check that did not pass. A developer can fix it using the details below.",
 fCity:"Thailand, working remotely",fOffer:"Websites for businesses",fAll:"All work",footLabel:"Links",
 sum:"Website check for {u} on {d}, {t}"},
ru:{doc:"Бесплатная проверка сайта · Pagewarden",cap:"Бесплатная проверка скорости и SEO вашего сайта.",skip:"Перейти к полю адреса",kick:"Проверка сайта",instr:"Измерительный прибор",
 h1a:"Измерьте любой сайт",h1b:"примерно за полминуты.",
 lead:"Введите адрес. Настоящий тест Lighthouse, тот же движок, что у Google PageSpeed, открывает страницу на телефоне или компьютере. Вы получите оценки, главные исправления и то, что каждое из них значит для ваших клиентов.",
 fieldLabel:"Адрес сайта",ph:"vash-biznes.com",devLabel:"Устройство",phone:"Телефон",desktop:"Компьютер",measure:"Измерить",stop:"Стоп",
 ready:"Готов",readyP:"Введите адрес ниже и нажмите «Измерить».",
 devNote:{mobile:"Тестовое устройство: средний телефон, медленный 4G",desktop:"Тестовое устройство: компьютер, быстрый интернет"},
 steps:["Адрес проверен","Запрос отправлен на тестовый сервер","Страница открывается на тестовом устройстве","Измеряем скорость загрузки","Проверяем текст и кнопки","Проверяем основы для Google и безопасность","Ответ получен, пишем отчёт"],
 typical:"обычно готово здесь",elapsed:"Прошло",retry:"Тестовый сервер занят, пробуем ещё раз",
 doneBtn:"Открыть отчёт",took:"Измерено за {x} с",
 e:{empty:"Сначала введите адрес сайта.",invalid:"Это не похоже на адрес сайта. Попробуйте, например, vash-biznes.com.",local:"Этот адрес работает только на вашем компьютере или в вашей сети. Введите публичный сайт.",
  unreach:"Тестовый сервер не смог открыть этот адрес. Проверьте написание и откройте его в браузере, чтобы убедиться, что сайт работает.",
  timeout:"Страница грузилась слишком долго для теста. Это уже говорит о том, что посетителям она открывается медленно. Попробуйте через минуту.",
  quota:"Бесплатные проверки на сегодня с этого подключения закончились. Попробуйте завтра или пришлите мне адрес, и я проверю сайт сам.",
  net:"Не удалось связаться с тестовым сервером. Проверьте интернет и попробуйте снова.",other:"Тест не завершился ({c}). Попробуйте через минуту.",stopped:"Измерение остановлено."},
 exampleNote:"Пример отчёта ниже показывает, что вы получите.",
 privacy:"Для теста адрес уходит в Microlink, это публичный сервис. Этот сайт ничего не хранит.",
 rep:"Отчёт о сайте",sampleTag:"Пример",sampleP:"Настоящий отчёт для example.com, стандартного тестового адреса. Измерьте свой сайт выше.",
 liveTag:"Измерено только что",
 fAddr:"Адрес",fWhen:"Измерено",fDev:"Устройство",fEng:"Движок",
 dev:{mobile:"Телефон",desktop:"Компьютер"},devWord:{mobile:"телефоне",desktop:"компьютере"},
 cats:{performance:"Скорость",accessibility:"Удобство","best-practices":"Надёжность",seo:"Видимость в Google"},
 catSub:{performance:"Как быстро открывается",accessibility:"Текст и кнопки","best-practices":"Безопасность и ошибки",seo:"Основы поиска"},
 band:["Плохо","Нужно улучшить","Хорошо"],of:"из 100",
 readings:"Замеры",
 mn:{fcp:"Первое появление",lcp:"Главное видно",tbt:"Не реагирует на нажатия",cls:"Страница прыгает",tbw:"Объём загрузки"},
 mh:{fcp:"Когда появляется первый текст или картинка.",lcp:"Когда видна самая крупная часть страницы. Хорошо, если меньше 2,5 с.",tbt:"Сколько страница слишком занята, чтобы ответить на нажатие.",cls:"Насколько всё сдвигается во время загрузки. Хорошо, если меньше 0,1.",tbw:"Всё, что посетитель скачивает при первом визите."},
 fixHead:"Исправить в первую очередь",fixSub:"По порядку пользы для посетителей. Нажмите на оценку выше, чтобы оставить одну область.",
 more:"Мелкие замечания ({n})",noFix:"Важных исправлений нет. Страница в очень хорошем состоянии.",noFixCat:"В этой области исправлять нечего.",
 impact:["Малый эффект","Средний эффект","Большой эффект"],saw:"Что увидел тест",saves:"Страница может появляться примерно на {x} быстрее",
 all:"Все области",showing:"Показано: {c}",
 v:{good:"На {d} всё в очень хорошем состоянии.",perf:"Медленно на {d}. Главное содержимое появляется через {x}, многие посетители не ждут так долго.",perf2:"На {d} могло бы быть быстрее.",
  access:"Части посетителей будет трудно читать текст или попадать по кнопкам.","best-practices":"Есть проблемы с надёжностью или безопасностью.",seo:"Google может плохо показывать эту страницу.",
  tail1:"Начните с исправления ниже.",tailN:"Начните с {n} исправлений ниже."},
 actPrint:"Печать или PDF",actCopy:"Копировать итог",actLink:"Копировать ссылку",copied:"Скопировано",copyFail:"Не удалось скопировать",
 otherDev:"Проверить и на {d}",
 ctaH:"Могу исправить это за вас",ctaP:"Я делаю и чиню сайты для небольших бизнесов в Таиланде. Пришлите этот отчёт, и я скажу, что стоит исправить, сколько это стоит и сколько займёт. Если сайт в порядке, так и скажу.",
 tg:"Написать в Telegram",wa:"Написать в WhatsApp",waS:"Итог уже в сообщении",em:"Написать на почту",
 hello:"Здравствуйте, Александр! Я проверил свой сайт вашим инструментом.",fixFirst:"Исправить в первую очередь:",link:"Отчёт",subj:"Проверка сайта {u}",
 shotAlt:"Как страница выглядела на тестовом устройстве ({d}) в конце загрузки",shotCap:{mobile:"Страница на тестовом телефоне",desktop:"Страница на тестовом компьютере"},
 generic:"Техническая проверка не пройдена. Разработчик исправит это по деталям ниже.",
 fCity:"Таиланд, работаю удалённо",fOffer:"Сайты для бизнеса",fAll:"Все работы",footLabel:"Ссылки",
 sum:"Проверка сайта {u}, {d}, {t}"},
th:{doc:"เช็กเว็บไซต์ฟรี · Pagewarden",cap:"เช็กความเร็วและ SEO ของเว็บไซต์คุณ ฟรี",skip:"ข้ามไปที่ช่องที่อยู่เว็บ",kick:"เช็กเว็บไซต์",instr:"เครื่องวัด",
 h1a:"วัดเว็บไซต์ไหนก็ได้",h1b:"ในราวสามสิบวินาที",
 lead:"พิมพ์ที่อยู่เว็บ ระบบจะทดสอบด้วย Lighthouse ของจริง ซึ่งเป็นเครื่องมือเดียวกับ Google PageSpeed โดยเปิดหน้าเว็บบนมือถือหรือคอมพิวเตอร์จำลอง คุณจะได้คะแนน สิ่งที่ควรแก้ก่อน และความหมายของแต่ละข้อต่อลูกค้าของคุณ",
 fieldLabel:"ที่อยู่เว็บไซต์",ph:"yourbusiness.com",devLabel:"อุปกรณ์",phone:"มือถือ",desktop:"คอมพิวเตอร์",measure:"วัดเลย",stop:"หยุด",
 ready:"พร้อม",readyP:"พิมพ์ที่อยู่เว็บด้านล่าง แล้วกดวัดเลย",
 devNote:{mobile:"อุปกรณ์ทดสอบ: มือถือระดับกลาง เน็ต 4G ช้า",desktop:"อุปกรณ์ทดสอบ: คอมพิวเตอร์ เน็ตเร็ว"},
 steps:["ตรวจที่อยู่เว็บแล้ว","ส่งคำขอไปที่เซิร์ฟเวอร์ทดสอบ","กำลังเปิดหน้าเว็บบนอุปกรณ์ทดสอบ","กำลังวัดความเร็วในการโหลด","กำลังเช็กตัวหนังสือและปุ่ม","กำลังเช็กพื้นฐาน Google และความปลอดภัย","ได้ผลแล้ว กำลังเขียนรายงาน"],
 typical:"ปกติเสร็จช่วงนี้",elapsed:"ผ่านไป",retry:"เซิร์ฟเวอร์ทดสอบไม่ว่าง กำลังลองอีกครั้ง",
 doneBtn:"อ่านรายงาน",took:"วัดเสร็จใน {x} วินาที",
 e:{empty:"พิมพ์ที่อยู่เว็บไซต์ก่อน",invalid:"ดูไม่เหมือนที่อยู่เว็บ ลองแบบนี้ yourbusiness.com",local:"ที่อยู่นี้ใช้ได้แค่ในเครื่องหรือเครือข่ายของคุณ กรุณาใส่เว็บไซต์สาธารณะ",
  unreach:"เซิร์ฟเวอร์ทดสอบเปิดที่อยู่นี้ไม่ได้ ตรวจตัวสะกด แล้วลองเปิดในเบราว์เซอร์ว่าเว็บใช้งานได้",
  timeout:"หน้าเว็บโหลดนานเกินไปสำหรับการทดสอบ ซึ่งแปลว่าลูกค้าก็รอนานเช่นกัน ลองใหม่ในอีกสักครู่",
  quota:"สิทธิ์ทดสอบฟรีของวันนี้จากการเชื่อมต่อนี้หมดแล้ว ลองใหม่พรุ่งนี้ หรือส่งที่อยู่เว็บมา ผมจะเช็กให้เอง",
  net:"ติดต่อเซิร์ฟเวอร์ทดสอบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",other:"การทดสอบไม่เสร็จ ({c}) ลองใหม่ในอีกสักครู่",stopped:"หยุดการวัดแล้ว"},
 exampleNote:"ตัวอย่างรายงานด้านล่างคือสิ่งที่คุณจะได้รับ",
 privacy:"เพื่อรันการทดสอบ ที่อยู่เว็บจะถูกส่งไปที่ Microlink ซึ่งเป็นบริการสาธารณะ เว็บนี้ไม่เก็บข้อมูลใดๆ",
 rep:"รายงานเว็บไซต์",sampleTag:"ตัวอย่าง",sampleP:"รายงานจริงของ example.com ที่อยู่สำหรับทดสอบมาตรฐาน วัดเว็บของคุณได้ด้านบน",
 liveTag:"เพิ่งวัดเสร็จ",
 fAddr:"ที่อยู่",fWhen:"วัดเมื่อ",fDev:"อุปกรณ์",fEng:"เครื่องมือ",
 dev:{mobile:"มือถือ",desktop:"คอมพิวเตอร์"},devWord:{mobile:"มือถือ",desktop:"คอมพิวเตอร์"},
 cats:{performance:"ความเร็ว",accessibility:"ใช้งานง่าย","best-practices":"ความน่าเชื่อถือ",seo:"การค้นเจอใน Google"},
 catSub:{performance:"เปิดเร็วแค่ไหน",accessibility:"ตัวหนังสือและปุ่ม","best-practices":"ความปลอดภัยและข้อผิดพลาด",seo:"พื้นฐานการค้นหา"},
 band:["แย่","ควรปรับ","ดี"],of:"จาก 100",
 readings:"ค่าที่วัดได้",
 mn:{fcp:"เริ่มเห็นหน้าเว็บ",lcp:"เห็นเนื้อหาหลัก",tbt:"ไม่ตอบสนองการแตะ",cls:"หน้าเว็บกระตุก",tbw:"ขนาดที่ต้องโหลด"},
 mh:{fcp:"เวลาที่ตัวหนังสือหรือรูปแรกปรากฏ",lcp:"เวลาที่ส่วนใหญ่ที่สุดของหน้าปรากฏ ควรต่ำกว่า 2.5 วินาที",tbt:"เวลาที่หน้าเว็บยุ่งจนไม่ตอบสนองการแตะ",cls:"ของบนหน้าเลื่อนไปมาแค่ไหนระหว่างโหลด ควรต่ำกว่า 0.1",tbw:"ทุกอย่างที่ผู้เข้าชมต้องดาวน์โหลดในครั้งแรก"},
 fixHead:"ควรแก้ก่อน",fixSub:"เรียงตามประโยชน์ต่อผู้เข้าชม แตะคะแนนด้านบนเพื่อดูเฉพาะส่วนนั้น",
 more:"เรื่องเล็กๆ ที่พบ ({n})",noFix:"ไม่มีเรื่องสำคัญที่ต้องแก้ หน้านี้อยู่ในสภาพดีมาก",noFixCat:"ส่วนนี้ไม่มีอะไรต้องแก้",
 impact:["ผลน้อย","ผลปานกลาง","ผลมาก"],saw:"สิ่งที่การทดสอบเห็น",saves:"หน้าเว็บอาจขึ้นเร็วขึ้นราว {x}",
 all:"ทุกส่วน",showing:"กำลังแสดง: {c}",
 v:{good:"บน{d}อยู่ในสภาพดีมาก",perf:"ช้าบน{d} เนื้อหาหลักใช้เวลา {x} กว่าจะขึ้น ผู้เข้าชมหลายคนไม่รอนานขนาดนั้น",perf2:"บน{d}ยังเร็วขึ้นได้อีก",
  access:"ผู้เข้าชมบางคนจะอ่านยากหรือกดปุ่มผิด","best-practices":"มีปัญหาเรื่องความน่าเชื่อถือหรือความปลอดภัยที่ควรแก้",seo:"Google อาจแสดงหน้านี้ได้ไม่ดี",
  tail1:"เริ่มจากข้อด้านล่าง",tailN:"เริ่มจาก {n} ข้อด้านล่าง"},
 actPrint:"พิมพ์หรือบันทึก PDF",actCopy:"คัดลอกสรุป",actLink:"คัดลอกลิงก์",copied:"คัดลอกแล้ว",copyFail:"คัดลอกไม่สำเร็จ",
 otherDev:"เช็กบน{d}ด้วย",
 ctaH:"ผมช่วยแก้ให้ได้",ctaP:"ผมทำและซ่อมเว็บไซต์ให้ธุรกิจขนาดเล็กในไทย ส่งรายงานนี้มา ผมจะบอกว่าอะไรควรแก้ ราคาเท่าไร และใช้เวลานานแค่ไหน ถ้าเว็บดีอยู่แล้ว ผมก็จะบอกตรงๆ",
 tg:"ทักทาง Telegram",wa:"ทักทาง WhatsApp",waS:"มีสรุปอยู่ในข้อความแล้ว",em:"ส่งอีเมล",
 hello:"สวัสดีครับ คุณ Alexandr ผมเช็กเว็บไซต์ด้วยเครื่องมือของคุณ",fixFirst:"ควรแก้ก่อน:",link:"รายงาน",subj:"เช็กเว็บไซต์ {u}",
 shotAlt:"หน้าเว็บบน{d}ทดสอบตอนโหลดเสร็จ",shotCap:{mobile:"หน้าเว็บบนมือถือทดสอบ",desktop:"หน้าเว็บบนคอมพิวเตอร์ทดสอบ"},
 generic:"การตรวจทางเทคนิคที่ไม่ผ่าน นักพัฒนาแก้ได้จากรายละเอียดด้านล่าง",
 fCity:"ประเทศไทย ทำงานออนไลน์",fOffer:"เว็บไซต์สำหรับธุรกิจ",fAll:"ผลงานทั้งหมด",footLabel:"ลิงก์",
 sum:"เช็กเว็บไซต์ {u} บน{d} {t}"}
};

/* -------- what each Lighthouse finding means, in plain words. w = how much it matters to a visitor, 0-100 -------- */
var GROUP={"unused-javascript":"js","legacy-javascript-insight":"js","duplicated-javascript-insight":"js","bootup-time":"js","mainthread-work-breakdown":"js","unminified-javascript":"js",
 "unused-css-rules":"css","unminified-css":"css","server-response-time":"server","document-latency-insight":"server","cls-culprits-insight":"shift","unsized-images":"shift",
 "button-name":"names","link-name":"names","input-button-name":"names","select-name":"names","html-has-lang":"lang","html-lang-valid":"lang","valid-lang":"lang",
 "image-alt":"imgalt","input-image-alt":"imgalt","svg-img-alt":"imgalt","object-alt":"imgalt","geolocation-on-start":"perm","notification-on-start":"perm","doctype":"basics","charset":"basics"};
/* insights that are developer diagnostics, not fixes a business owner can act on */
var SKIP=["forced-reflow-insight","network-dependency-tree-insight","dom-size-insight","third-parties-insight","lcp-breakdown-insight","inp-breakdown-insight","valid-source-maps"];
var FIX={
 "render-blocking-insight":{w:30,en:["Let the page start showing sooner","Some style and font files must finish downloading before anything appears. Loading them in a lighter way lets visitors see the page earlier."],ru:["Пусть страница появляется раньше","Некоторые файлы стилей и шрифтов должны скачаться до того, как что-то появится. Если грузить их легче, посетители увидят страницу раньше."],th:["ให้หน้าเว็บเริ่มขึ้นเร็วขึ้น","ไฟล์สไตล์และฟอนต์บางไฟล์ต้องโหลดเสร็จก่อนหน้าเว็บจะขึ้น ถ้าโหลดแบบเบาลง ผู้เข้าชมจะเห็นหน้าเว็บเร็วขึ้น"]},
 "image-delivery-insight":{w:40,en:["Make the photos smaller","Photos are heavier than the screen needs. Resizing them and saving them as WebP makes the page appear much faster on mobile data."],ru:["Уменьшите фотографии","Фото тяжелее, чем нужно экрану. Если уменьшить их и сохранить в WebP, страница будет появляться заметно быстрее через мобильный интернет."],th:["ลดขนาดรูปภาพ","รูปภาพใหญ่เกินกว่าที่หน้าจอต้องใช้ ถ้าย่อขนาดและบันทึกเป็น WebP หน้าเว็บจะขึ้นเร็วขึ้นมากบนเน็ตมือถือ"]},
 "cache-insight":{w:22,en:["Let returning visitors load instantly","The server tells browsers to download the same files again on every visit. Longer cache times make the second visit almost instant."],ru:["Ускорьте повторные визиты","Сервер заставляет браузер заново скачивать те же файлы при каждом визите. Если хранить их дольше, второй визит будет почти мгновенным."],th:["ให้ผู้เข้าชมที่กลับมาโหลดได้ทันที","เซิร์ฟเวอร์สั่งให้เบราว์เซอร์โหลดไฟล์เดิมใหม่ทุกครั้ง ถ้าตั้งเวลาเก็บแคชให้นานขึ้น การเข้าครั้งที่สองจะแทบไม่ต้องรอ"]},
 server:{w:45,en:["Speed up the server's first reply","The server takes a long time before it starts sending the page. Better hosting or page caching fixes this for every visitor."],ru:["Ускорьте первый ответ сервера","Сервер долго думает, прежде чем начать отдавать страницу. Хороший хостинг или кэширование страниц исправят это для всех посетителей."],th:["ให้เซิร์ฟเวอร์ตอบเร็วขึ้น","เซิร์ฟเวอร์ใช้เวลานานก่อนเริ่มส่งหน้าเว็บ โฮสติ้งที่ดีกว่าหรือการแคชหน้าเว็บจะแก้ได้สำหรับผู้เข้าชมทุกคน"]},
 "lcp-discovery-insight":{w:35,en:["Load the main picture first","The browser finds the biggest picture late. Marking it as important lets it load straight away."],ru:["Грузите главную картинку первой","Браузер поздно находит самую крупную картинку. Если пометить её как важную, она начнёт грузиться сразу."],th:["โหลดรูปหลักก่อน","เบราว์เซอร์เจอรูปที่ใหญ่ที่สุดช้า ถ้ากำหนดให้เป็นรูปสำคัญ รูปจะเริ่มโหลดทันที"]},
 "font-display-insight":{w:20,en:["Show text while fonts load","Text stays invisible until the custom font arrives. Letting a system font show first means visitors can read at once."],ru:["Показывайте текст, пока грузится шрифт","Текст невидим, пока не скачается особый шрифт. Если сначала показать системный, посетитель сможет читать сразу."],th:["แสดงตัวหนังสือระหว่างโหลดฟอนต์","ตัวหนังสือจะมองไม่เห็นจนกว่าฟอนต์พิเศษจะโหลดเสร็จ ถ้าให้ฟอนต์ระบบแสดงก่อน ผู้เข้าชมจะอ่านได้ทันที"]},
 js:{w:35,en:["Cut heavy scripts","The page loads more JavaScript than it uses, and the phone is busy running it. Removing unused plugins and delaying the rest makes the page react sooner."],ru:["Уберите тяжёлые скрипты","Страница грузит больше JavaScript, чем использует, и телефон занят его выполнением. Если убрать лишние плагины и отложить остальное, страница будет реагировать быстрее."],th:["ลดสคริปต์ที่หนัก","หน้าเว็บโหลด JavaScript มากเกินกว่าที่ใช้ และมือถือต้องเสียเวลาประมวลผล ถ้าเอาปลั๊กอินที่ไม่ใช้ออกและเลื่อนส่วนที่เหลือ หน้าเว็บจะตอบสนองเร็วขึ้น"]},
 css:{w:14,en:["Trim unused styles","The page downloads style rules it never uses. Removing them makes it lighter."],ru:["Уберите лишние стили","Страница скачивает правила оформления, которые не использует. Без них она станет легче."],th:["ตัดสไตล์ที่ไม่ได้ใช้","หน้าเว็บโหลดสไตล์ที่ไม่ได้ใช้ ถ้าตัดออกหน้าเว็บจะเบาลง"]},
 "total-byte-weight":{w:35,en:["Make the whole page lighter","The page is heavy to download, which costs time and mobile data. Lighter photos, video and scripts help most."],ru:["Сделайте страницу легче","Страница много весит, это стоит времени и мобильного трафика. Больше всего помогут лёгкие фото, видео и скрипты."],th:["ทำให้หน้าเว็บเบาลง","หน้าเว็บมีขนาดใหญ่ เสียทั้งเวลาและเน็ตมือถือ รูป วิดีโอ และสคริปต์ที่เบาลงช่วยได้มากที่สุด"]},
 redirects:{w:30,en:["Remove extra redirects","The address jumps to other addresses before the page loads, and each jump adds a delay. Link straight to the final address."],ru:["Уберите лишние перенаправления","Адрес перескакивает на другие адреса до загрузки страницы, и каждый прыжок добавляет задержку. Ставьте ссылку сразу на конечный адрес."],th:["ลดการเปลี่ยนเส้นทาง","ที่อยู่เว็บเด้งไปที่อื่นก่อนหน้าเว็บจะโหลด แต่ละครั้งทำให้ช้าลง ควรลิงก์ไปที่ที่อยู่สุดท้ายโดยตรง"]},
 shift:{w:30,en:["Stop the page jumping while it loads","Content moves as images and banners appear, so visitors tap the wrong thing. Reserving space for them stops it."],ru:["Остановите прыжки страницы","Содержимое сдвигается, когда появляются картинки и баннеры, и посетители нажимают не туда. Если заранее оставить им место, прыжки исчезнут."],th:["หยุดหน้าเว็บกระตุกระหว่างโหลด","เนื้อหาเลื่อนเมื่อรูปหรือแบนเนอร์ขึ้น ทำให้ผู้เข้าชมกดผิด ถ้าเว้นที่ไว้ล่วงหน้าจะไม่กระตุก"]},
 "modern-http-insight":{w:15,en:["Turn on modern HTTP","The server uses an older way to send files. HTTP/2 or HTTP/3 loads many files at once and is usually a hosting setting."],ru:["Включите современный HTTP","Сервер отдаёт файлы старым способом. HTTP/2 или HTTP/3 грузят много файлов сразу, обычно это настройка хостинга."],th:["เปิดใช้ HTTP แบบใหม่","เซิร์ฟเวอร์ใช้วิธีส่งไฟล์แบบเก่า HTTP/2 หรือ HTTP/3 โหลดหลายไฟล์พร้อมกันได้ และมักตั้งค่าได้ที่โฮสติ้ง"]},
 "viewport-insight":{w:40,en:["Make taps respond instantly on phones","The page is not set up for phone screens, so taps can lag. One line in the page header fixes it."],ru:["Пусть нажатия срабатывают сразу","Страница не настроена для экранов телефонов, поэтому нажатия могут запаздывать. Это исправляет одна строка в заголовке страницы."],th:["ให้การแตะบนมือถือตอบสนองทันที","หน้าเว็บไม่ได้ตั้งค่าสำหรับจอมือถือ การแตะจึงอาจช้า แก้ได้ด้วยโค้ดบรรทัดเดียวในส่วนหัวของหน้า"]},
 "bf-cache":{w:10,en:["Make the back button instant","When visitors come back to this page, the browser loads it again from scratch. Removing what blocks the back-forward cache makes it instant."],ru:["Сделайте кнопку «Назад» мгновенной","Когда посетитель возвращается на страницу, браузер грузит её заново. Если убрать то, что мешает кэшу, возврат будет мгновенным."],th:["ให้ปุ่มย้อนกลับเร็วทันที","เมื่อผู้เข้าชมย้อนกลับมาหน้านี้ เบราว์เซอร์ต้องโหลดใหม่ทั้งหมด ถ้าแก้สิ่งที่บล็อกแคชไว้ การย้อนกลับจะเร็วทันที"]},
 "color-contrast":{w:55,en:["Make text easier to read","Some text is too pale against its background. It is hard to read in sunlight and for older visitors."],ru:["Сделайте текст читаемым","Часть текста слишком бледная на своём фоне. Её трудно прочитать на солнце и людям постарше."],th:["ทำให้ตัวหนังสืออ่านง่ายขึ้น","ตัวหนังสือบางส่วนสีอ่อนเกินไปเมื่อเทียบกับพื้นหลัง อ่านยากกลางแดดและสำหรับผู้สูงอายุ"]},
 "target-size":{w:50,en:["Make buttons big enough for a thumb","Some buttons or links are small or too close together, so people tap the wrong one on a phone."],ru:["Кнопки под палец","Некоторые кнопки или ссылки маленькие или стоят слишком близко, и на телефоне люди попадают не туда."],th:["ทำปุ่มให้ใหญ่พอสำหรับนิ้ว","ปุ่มหรือลิงก์บางอันเล็กหรือชิดกันเกินไป ทำให้คนกดผิดบนมือถือ"]},
 imgalt:{w:35,en:["Describe your images","Some images have no text description. Screen readers and Google cannot tell what they show."],ru:["Подпишите картинки","У части картинок нет текстового описания. Программы чтения с экрана и Google не понимают, что на них."],th:["ใส่คำอธิบายรูปภาพ","รูปบางรูปไม่มีคำอธิบาย โปรแกรมอ่านหน้าจอและ Google จึงไม่รู้ว่าเป็นรูปอะไร"]},
 names:{w:45,en:["Name every button and link","Some buttons or links have no readable name, so people using screen readers cannot tell what they do."],ru:["Дайте имя каждой кнопке и ссылке","У некоторых кнопок или ссылок нет читаемого названия, и люди с программами чтения экрана не понимают, что они делают."],th:["ตั้งชื่อปุ่มและลิงก์ทุกอัน","ปุ่มหรือลิงก์บางอันไม่มีชื่อที่อ่านได้ ผู้ใช้โปรแกรมอ่านหน้าจอจึงไม่รู้ว่ากดแล้วจะเกิดอะไร"]},
 label:{w:50,en:["Label your form fields","Some form fields have no label, so screen reader users do not know what to type. Forms are where bookings happen."],ru:["Подпишите поля форм","У некоторых полей формы нет подписи, и не все понимают, что туда вводить. А ведь именно через формы приходят заявки."],th:["ใส่ป้ายชื่อช่องในฟอร์ม","ช่องในฟอร์มบางช่องไม่มีป้ายชื่อ ผู้ใช้โปรแกรมอ่านหน้าจอจึงไม่รู้ว่าต้องกรอกอะไร และฟอร์มคือที่ที่ลูกค้าจอง"]},
 lang:{w:25,en:["Tell browsers the page language","The page does not say which language it is in, so translation and reading tools may get it wrong."],ru:["Укажите язык страницы","Страница не сообщает, на каком она языке, и переводчики и программы чтения могут ошибаться."],th:["ระบุภาษาของหน้าเว็บ","หน้าเว็บไม่ได้บอกว่าเป็นภาษาอะไร เครื่องมือแปลภาษาและโปรแกรมอ่านจึงอาจทำงานผิด"]},
 "meta-viewport":{w:85,en:["Let the page fit phone screens","The page blocks zooming or is not set up for phones. Visitors on small screens struggle to read it."],ru:["Подстройте страницу под телефон","Страница запрещает увеличение или не настроена для телефонов. На маленьком экране её трудно читать."],th:["ทำให้หน้าเว็บพอดีกับจอมือถือ","หน้าเว็บห้ามซูมหรือไม่ได้ตั้งค่าสำหรับมือถือ คนที่ใช้จอเล็กจะอ่านลำบาก"]},
 "heading-order":{w:12,en:["Put headings in order","Headings skip levels. A clean order helps screen readers and search engines understand the page."],ru:["Наведите порядок в заголовках","Уровни заголовков идут не по порядку. Ровная структура помогает программам чтения и поисковикам понять страницу."],th:["เรียงหัวข้อให้ถูกลำดับ","หัวข้อข้ามระดับ ลำดับที่ถูกต้องช่วยให้โปรแกรมอ่านหน้าจอและเสิร์ชเอนจินเข้าใจหน้าเว็บ"]},
 "landmark-one-main":{w:8,en:["Mark the main content","The page has no main area marked, so screen reader users cannot jump straight to the content."],ru:["Отметьте основное содержимое","На странице не отмечена основная часть, и пользователи программ чтения не могут сразу перейти к ней."],th:["กำหนดส่วนเนื้อหาหลัก","หน้าเว็บไม่ได้ระบุส่วนเนื้อหาหลัก ผู้ใช้โปรแกรมอ่านหน้าจอจึงข้ามไปที่เนื้อหาไม่ได้"]},
 "link-in-text-block":{w:15,en:["Make links stand out in text","Links inside text differ only by colour. Underlining them helps people who see colour differently."],ru:["Выделите ссылки в тексте","Ссылки в тексте отличаются только цветом. Подчёркивание поможет тем, кто плохо различает цвета."],th:["ทำให้ลิงก์ในข้อความเด่นขึ้น","ลิงก์ในข้อความต่างกันแค่สี การขีดเส้นใต้ช่วยคนที่มองสีได้ไม่ชัด"]},
 aria:{w:20,en:["Fix screen reader labels","Some accessibility attributes are used incorrectly, which confuses screen readers."],ru:["Исправьте подсказки для программ чтения","Часть атрибутов доступности использована неправильно, это путает программы чтения с экрана."],th:["แก้ป้ายสำหรับโปรแกรมอ่านหน้าจอ","แอตทริบิวต์ด้านการเข้าถึงบางอย่างใช้ผิด ทำให้โปรแกรมอ่านหน้าจอสับสน"]},
 "is-on-https":{w:100,en:["Use a secure https address","Part of the page is not on https. Browsers mark it as not secure, and visitors leave before they book."],ru:["Используйте защищённый https","Часть страницы работает не по https. Браузер помечает её как небезопасную, и посетители уходят, не оставив заявку."],th:["ใช้ที่อยู่ https ที่ปลอดภัย","บางส่วนของหน้าเว็บไม่ได้ใช้ https เบราว์เซอร์จะเตือนว่าไม่ปลอดภัย และลูกค้าจะออกก่อนจอง"]},
 "redirects-http":{w:55,en:["Send http visitors to https","Typing the address without https does not move visitors to the secure version."],ru:["Переводите http на https","Если набрать адрес без https, посетитель не попадает на защищённую версию."],th:["ส่งผู้เข้าชม http ไปที่ https","ถ้าพิมพ์ที่อยู่โดยไม่มี https ผู้เข้าชมจะไม่ถูกพาไปที่เวอร์ชันที่ปลอดภัย"]},
 "errors-in-console":{w:25,en:["Fix the errors the page reports","The browser logged errors while loading the page. Something may be broken, such as a form, a map or a booking widget."],ru:["Исправьте ошибки страницы","Во время загрузки браузер записал ошибки. Что-то может не работать, например форма, карта или виджет записи."],th:["แก้ข้อผิดพลาดที่หน้าเว็บรายงาน","เบราว์เซอร์พบข้อผิดพลาดระหว่างโหลด บางอย่างอาจใช้งานไม่ได้ เช่น ฟอร์ม แผนที่ หรือระบบจอง"]},
 "image-aspect-ratio":{w:20,en:["Stop stretched images","Some images are shown at the wrong proportions, so they look squashed or stretched."],ru:["Уберите растянутые картинки","Часть картинок показана в неверных пропорциях и выглядит сплющенной или растянутой."],th:["แก้รูปที่ยืดผิดสัดส่วน","รูปบางรูปแสดงผิดสัดส่วน ทำให้ดูบีบหรือยืด"]},
 "image-size-responsive":{w:25,en:["Use sharp images on phones","Some images are too small for phone screens and look blurry."],ru:["Чёткие картинки на телефоне","Некоторые картинки слишком маленькие для экранов телефонов и выглядят размытыми."],th:["ใช้รูปที่คมชัดบนมือถือ","รูปบางรูปเล็กเกินไปสำหรับจอมือถือ จึงดูเบลอ"]},
 deprecations:{w:15,en:["Update outdated code","The page uses browser features that are being removed. It may break in a future browser update."],ru:["Обновите устаревший код","Страница использует функции, которые браузеры убирают. После обновления браузера что-то может сломаться."],th:["อัปเดตโค้ดที่ล้าสมัย","หน้าเว็บใช้ฟีเจอร์ที่เบราว์เซอร์กำลังจะเลิกรองรับ อาจใช้งานไม่ได้เมื่อเบราว์เซอร์อัปเดต"]},
 "third-party-cookies":{w:15,en:["Rely less on outside cookies","Outside services set cookies that browsers are starting to block, so some features may stop working."],ru:["Меньше сторонних cookie","Сторонние сервисы ставят cookie, которые браузеры начинают блокировать, и часть функций может перестать работать."],th:["ลดการใช้คุกกี้จากภายนอก","บริการภายนอกตั้งคุกกี้ที่เบราว์เซอร์เริ่มบล็อก บางฟีเจอร์อาจใช้งานไม่ได้"]},
 "inspector-issues":{w:12,en:["Fix browser warnings","The browser flagged problems with this page, such as blocked content or cookie issues."],ru:["Исправьте предупреждения браузера","Браузер отметил проблемы на странице, например заблокированное содержимое или ошибки cookie."],th:["แก้คำเตือนของเบราว์เซอร์","เบราว์เซอร์พบปัญหาในหน้านี้ เช่น เนื้อหาถูกบล็อกหรือปัญหาคุกกี้"]},
 perm:{w:35,en:["Do not ask for permissions on arrival","The page asks for location or notifications straight away. Most visitors say no, and some leave."],ru:["Не просите разрешения сразу","Страница сразу спрашивает местоположение или уведомления. Большинство отказывается, а кто-то уходит."],th:["อย่าขอสิทธิ์ทันทีที่เข้าเว็บ","หน้าเว็บขอตำแหน่งหรือการแจ้งเตือนทันที คนส่วนใหญ่กดปฏิเสธ และบางคนออกไปเลย"]},
 "paste-preventing-inputs":{w:20,en:["Let visitors paste into fields","Some fields block pasting, which frustrates people filling in forms."],ru:["Разрешите вставку в поля","Некоторые поля запрещают вставку текста, это раздражает при заполнении форм."],th:["ให้วางข้อความในช่องได้","บางช่องห้ามวางข้อความ ทำให้คนกรอกฟอร์มหงุดหงิด"]},
 basics:{w:25,en:["Fix the page header basics","The page is missing a basic technical line, so browsers may display it oddly."],ru:["Исправьте основу страницы","На странице нет базовой технической строки, и браузеры могут показывать её странно."],th:["แก้พื้นฐานส่วนหัวของหน้า","หน้าเว็บขาดบรรทัดพื้นฐานทางเทคนิค เบราว์เซอร์อาจแสดงผลแปลกๆ"]},
 "http-status-code":{w:100,en:["The page answers with an error","The server reports an error code for this page, so Google may drop it from search results."],ru:["Страница отвечает ошибкой","Сервер возвращает код ошибки, и Google может убрать страницу из поиска."],th:["หน้าเว็บตอบกลับเป็นข้อผิดพลาด","เซิร์ฟเวอร์ส่งรหัสข้อผิดพลาดสำหรับหน้านี้ Google อาจเอาออกจากผลการค้นหา"]},
 "is-crawlable":{w:95,en:["Let Google list this page","The page tells search engines not to list it, so it will not appear on Google."],ru:["Разрешите Google показывать страницу","Страница просит поисковики её не показывать, поэтому её не будет в Google."],th:["ให้ Google แสดงหน้านี้","หน้าเว็บบอกเสิร์ชเอนจินว่าไม่ให้แสดง จึงไม่ขึ้นใน Google"]},
 "meta-description":{w:40,en:["Write the text Google shows under your name","The page has no description, so Google picks random text from the page for search results."],ru:["Напишите описание для Google","У страницы нет описания, и Google показывает в поиске случайный кусок текста."],th:["เขียนคำอธิบายที่ Google แสดงใต้ชื่อเว็บ","หน้าเว็บไม่มีคำอธิบาย Google จึงสุ่มข้อความจากหน้าเว็บมาแสดงในผลการค้นหา"]},
 "document-title":{w:65,en:["Give the page a clear title","The page has no title. It is the first line people see on Google and on the browser tab."],ru:["Дайте странице понятный заголовок","У страницы нет заголовка. Это первая строка, которую видят в Google и на вкладке браузера."],th:["ตั้งชื่อหน้าเว็บให้ชัด","หน้าเว็บไม่มีชื่อ ซึ่งเป็นบรรทัดแรกที่คนเห็นใน Google และบนแท็บเบราว์เซอร์"]},
 "link-text":{w:18,en:["Use clear words for links","Links say things like \"click here\" or \"more\". Words such as the service name help Google and visitors."],ru:["Понятные слова в ссылках","Ссылки называются «здесь» или «подробнее». Название услуги в ссылке помогает и Google, и посетителям."],th:["ใช้คำที่ชัดเจนในลิงก์","ลิงก์เขียนว่า \"คลิกที่นี่\" หรือ \"เพิ่มเติม\" การใช้ชื่อบริการช่วยทั้ง Google และผู้เข้าชม"]},
 "crawlable-anchors":{w:22,en:["Make links Google can follow","Some links are not real links, so Google cannot follow them to your other pages."],ru:["Ссылки, по которым пройдёт Google","Некоторые ссылки ненастоящие, и Google не может по ним перейти на другие страницы."],th:["ทำลิงก์ที่ Google ตามไปได้","ลิงก์บางอันไม่ใช่ลิงก์จริง Google จึงตามไปหน้าอื่นของคุณไม่ได้"]},
 hreflang:{w:25,en:["Fix the language versions","The tags that point to other language versions are wrong, so Google may show the wrong language."],ru:["Исправьте языковые версии","Метки других языковых версий указаны неверно, и Google может показать не тот язык."],th:["แก้เวอร์ชันภาษา","แท็กที่ชี้ไปยังเวอร์ชันภาษาอื่นไม่ถูกต้อง Google อาจแสดงภาษาผิด"]},
 canonical:{w:30,en:["Fix the main address tag","The tag that tells Google the main address of this page is wrong or conflicting."],ru:["Исправьте метку главного адреса","Метка, которая сообщает Google главный адрес страницы, неверна или противоречива."],th:["แก้แท็กที่อยู่หลัก","แท็กที่บอก Google ว่าที่อยู่หลักของหน้านี้คืออะไรไม่ถูกต้องหรือขัดกัน"]},
 "robots-txt":{w:30,en:["Fix the robots file","The robots.txt file has errors, so search engines may skip parts of the site."],ru:["Исправьте файл robots.txt","В файле robots.txt есть ошибки, и поисковики могут пропускать части сайта."],th:["แก้ไฟล์ robots","ไฟล์ robots.txt มีข้อผิดพลาด เสิร์ชเอนจินอาจข้ามบางส่วนของเว็บ"]}
};

/* -------- helpers -------- */
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return [].slice.call((r||document).querySelectorAll(s))}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function fmt(s,o){return String(s).replace(/\{(\w+)\}/g,function(m,k){return o[k]!=null?o[k]:m})}
function band(n){return n==null?-1:n>=90?2:n>=50?1:0}
function sband(s){return s==null?-1:s>=0.9?2:s>=0.5?1:0}
var LOC={en:"en-GB",ru:"ru-RU",th:"th-TH"};
function secs(ms,l){var v=ms/1000,t=v<10?v.toFixed(1):String(Math.round(v));if(l==="ru")t=t.replace(".",",");return t+(l==="ru"?" с":l==="th"?" วินาที":" s")}
function bytes(b,l){var mb=b/1048576,t=mb>=1?mb.toFixed(1)+" MB":Math.max(1,Math.round(b/1024))+" KB";return l==="ru"?t.replace(".",",").replace("MB","МБ").replace("KB","КБ"):t}
function host(u){try{return new URL(u).host.replace(/^www\./,"")}catch(e){return u}}
function when(iso,l){try{return new Intl.DateTimeFormat(LOC[l],{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}catch(e){return iso}}

/* -------- address check, before anything is sent -------- */
function parseAddress(raw){
  var s=String(raw||"").trim().replace(/^[<"'(]+|[>"')]+$/g,"");
  if(!s)return {err:"empty"};
  if(/\s/.test(s))return {err:"invalid"};
  if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(s))s="https://"+s.replace(/^\/+/,"");
  var u;try{u=new URL(s)}catch(e){return {err:"invalid"}}
  if(u.protocol!=="http:"&&u.protocol!=="https:")return {err:"invalid"};
  var h=u.hostname.toLowerCase();
  if(h==="localhost"||/\.(localhost|local|test|internal|lan|home)$/.test(h))return {err:"local"};
  if(/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||h==="[::1]")return {err:"local"};
  if(h.indexOf(".")<0||/^\.|\.\.|\.$/.test(h)||!/^[a-z0-9.\-¡-￿]+$/i.test(h)&&h.charAt(0)!=="[")return {err:"invalid"};
  var tld=h.split(".").pop();if(!/^(\d+|[a-z¡-￿-]{2,})$/i.test(tld)&&tld.indexOf("xn--")!==0)return {err:"invalid"};
  u.hash="";
  return {url:u.href};
}

/* -------- the engine -------- */
function endpoint(url,dev){
  if(PSI_KEY){
    return "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url="+encodeURIComponent(url)+"&category=performance&category=accessibility&category=best-practices&category=seo&strategy="+dev+"&key="+encodeURIComponent(PSI_KEY);
  }
  return "https://api.microlink.io/?url="+encodeURIComponent(url)+(dev==="desktop"?"&insights.lighthouse.preset=desktop":"&insights.lighthouse=true")+"&insights.technologies=false&meta=false";
}
function failure(code,detail){var e=new Error(code);e.code=code;e.detail=detail||"";return e}
function measure(url,dev,signal){
  return fetch(endpoint(url,dev),{signal:signal,credentials:"omit",referrerPolicy:"strict-origin"}).then(function(r){
    return r.text().then(function(t){
      var j=null;try{j=JSON.parse(t)}catch(e){}
      if(r.status===429||(j&&j.code==="ERATE"))throw failure("quota");
      if(r.status===408||(j&&/TIMEOUT/i.test(j.code||"")))throw failure("timeout");
      if(j&&j.code==="EINVALURL")throw failure("unreach");
      if(!r.ok){var m=j&&(j.message||(j.error&&j.error.message))||("HTTP "+r.status);
        if(/unable to process|FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST|NO_FCP|DNS|ENOTFOUND|EFATAL|ERR_NAME/i.test(m+(j&&j.code||"")))throw failure("unreach");
        throw failure("other",(j&&j.code)||("HTTP "+r.status))}
      var lh=PSI_KEY?(j&&j.lighthouseResult):(j&&j.data&&j.data.insights&&j.data.insights.lighthouse);
      if(!lh)throw failure("other","no result");
      if(lh.runtimeError&&lh.runtimeError.code&&lh.runtimeError.code!=="NO_ERROR")throw failure("unreach");
      return window.LH.normalize(lh,PSI_KEY?"PageSpeed Insights":"Microlink");
    });
  },function(e){if(signal.aborted){var a=new Error("aborted");a.name="AbortError";throw a}throw failure("net")});
}

/* -------- turning findings into ordered fixes -------- */
function impactOf(f,fx){
  if(f.cat==="performance"){var ms=f.sav.lcp+0.6*f.sav.fcp+f.sav.tbt;
    if(ms>0)return Math.min(100,20+ms/35);
    return (fx?fx.w:12)*(1-f.score)*0.7}
  return (fx?fx.w:12)*(1-f.score);
}
function fixes(M){
  var out={},list=[];
  M.finds.forEach(function(f){
    if(SKIP.indexOf(f.id)>=0)return;
    var key=GROUP[f.id]||(f.id.indexOf("aria-")===0?"aria":f.id),fx=FIX[key]||FIX[f.id]||null;
    var imp=impactOf(f,fx),o=out[key];
    if(!o){o=out[key]={key:key,fx:fx,cat:f.cat,imp:imp,sav:0,dv:[],items:[],titles:[]};list.push(o)}
    o.imp=Math.max(o.imp,imp);o.sav=Math.max(o.sav,f.sav.lcp||f.sav.fcp||0);
    if(f.dv&&o.dv.indexOf(f.dv)<0)o.dv.push(f.dv);
    if(o.titles.indexOf(f.title)<0)o.titles.push(f.title);
    f.items.forEach(function(it){if(o.items.length<4&&o.items.indexOf(it)<0)o.items.push(it)});
  });
  list.sort(function(a,b){return b.imp-a.imp});
  return list;
}
function lvl(imp){return imp>=60?2:imp>=30?1:0}

/* -------- verdict line -------- */
function verdict(M,F){
  var t=T(),d=t.devWord[M.device],worst=null,wv=101;
  CATS.forEach(function(c){var v=M.cats[c];if(v!=null&&v<wv){wv=v;worst=c}});
  var main=F.filter(function(o){return lvl(o.imp)>0||F.length<=3}).length||Math.min(3,F.length);
  var s;
  if(wv>=90)s=fmt(t.v.good,{d:d});
  else if(worst==="performance"){var l=M.m.lcp;s=l&&l.v>4000?fmt(t.v.perf,{d:d,x:secs(l.v,lang)}):fmt(t.v.perf2,{d:d})}
  else s=worst==="accessibility"?t.v.access:t.v[worst];
  var tail=F.length?(Math.min(5,main)===1?t.v.tail1:fmt(t.v.tailN,{n:Math.min(5,main)})):"";
  return {s:s,tail:tail};
}

/* -------- interface words -------- */
var C={
en:{skip:"Skip to the address box",fieldLabel:"Your website address",check:"Check my site",example:"Show the example report",rpFor:"Report for {u}",cancel:"Cancel",tryAgain:"Try again",
 runH:"Measuring {u} on {d}",usual:"Usually done in 15 to 40 seconds.",elapsed:"Elapsed",errH:"The check did not finish",
 rpH:"Website report",tagS:"Example",tagL:"Checked just now",sampleP:"A real report for example.com, the standard test address. Type your own address above to measure your site.",
 scores:"Scores",verdict:"Summary",fixHint:"Ordered by how much each one helps your visitors. Open a fix to see what the test saw.",
 share:"Share",shared:"Shared",contact:"Contact me",printHead:"SanderSax website check",
 ready:"READY",run:"MEASURING",done:"REPORT READY",err:"NOT FINISHED",oDev:"DEVICE"},
ru:{skip:"Перейти к полю адреса",fieldLabel:"Адрес вашего сайта",check:"Проверить сайт",example:"Показать пример отчёта",rpFor:"Отчёт для {u}",cancel:"Отмена",tryAgain:"Попробовать снова",
 runH:"Измеряем {u}, {d}",usual:"Обычно занимает от 15 до 40 секунд.",elapsed:"Прошло",errH:"Проверка не завершилась",
 rpH:"Отчёт о сайте",tagS:"Пример",tagL:"Проверено только что",sampleP:"Настоящий отчёт для example.com, стандартного тестового адреса. Введите свой адрес выше, чтобы измерить свой сайт.",
 scores:"Оценки",verdict:"Итог",fixHint:"По порядку пользы для посетителей. Откройте пункт, чтобы увидеть, что увидел тест.",
 share:"Поделиться",shared:"Отправлено",contact:"Связаться со мной",printHead:"SanderSax, проверка сайта",
 ready:"ГОТОВ",run:"ИДЁТ ИЗМЕРЕНИЕ",done:"ОТЧЁТ ГОТОВ",err:"НЕ ЗАВЕРШЕНО",oDev:"УСТРОЙСТВО"},
th:{skip:"ข้ามไปที่ช่องที่อยู่เว็บ",fieldLabel:"ที่อยู่เว็บไซต์ของคุณ",check:"เช็กเว็บของฉัน",example:"ดูรายงานตัวอย่าง",rpFor:"รายงานของ {u}",cancel:"ยกเลิก",tryAgain:"ลองอีกครั้ง",
 runH:"กำลังวัด {u} บน{d}",usual:"ปกติใช้เวลา 15 ถึง 40 วินาที",elapsed:"ผ่านไป",errH:"การเช็กไม่สำเร็จ",
 rpH:"รายงานเว็บไซต์",tagS:"ตัวอย่าง",tagL:"เพิ่งเช็กเสร็จ",sampleP:"รายงานจริงของ example.com ที่อยู่สำหรับทดสอบมาตรฐาน พิมพ์ที่อยู่ของคุณด้านบนเพื่อวัดเว็บของคุณ",
 scores:"คะแนน",verdict:"สรุป",fixHint:"เรียงตามประโยชน์ต่อผู้เข้าชม เปิดแต่ละข้อเพื่อดูสิ่งที่การทดสอบเห็น",
 share:"แชร์",shared:"แชร์แล้ว",contact:"ติดต่อผม",printHead:"SanderSax เช็กเว็บไซต์",
 ready:"พร้อม",run:"กำลังวัด",done:"รายงานพร้อม",err:"ไม่สำเร็จ",oDev:"อุปกรณ์"}
};
function cell(c){return '<i class="c '+c+'"></i>'}   /* one character cell of a gauge, drawn as a lit block */

/* -------- state -------- */
var lang="en",dev="mobile",ctrl=null,t0=0,tb=0,tick=null,retried=false,stepN=-1,mode="idle";
var store={sample:window.CHECK_SAMPLE||null,live:{}};
var cur=null,lastScan=null,lastErr=null,rpN=0;
var ver=((store.sample&&store.sample.mobile&&store.sample.mobile.ver)||"13").split(".")[0];
var form=$("#probe"),input=$("#url"),goBtn=$("[data-go]"),fieldErr=$("[data-err]"),panel=$("[data-panel]"),rep=$("[data-rep]"),live=$("[data-live]"),stat=$("[data-stat]");
function T(){return S[lang]}
function K(){return C[lang]}
function disp(u){return String(u).replace(/^https?:\/\//,"").replace(/\/$/,"")}
function pad(n){return (n<10?"0":"")+n}
function sec(x){var v=x.toFixed(1);return lang==="ru"?v.replace(".",","):v}

function setStat(){
  var k=K();stat.textContent=mode==="run"?k.run:mode==="done"?k.done:mode==="err"?k.err:k.ready;
  stat.className="st "+mode;
  $("[data-odev]").textContent=k.oDev+" "+T().dev[dev].toUpperCase();
}
function syncDev(){
  $$("[data-dev]").forEach(function(b){b.setAttribute("aria-checked",String(b.getAttribute("data-dev")===dev))});
  $(".dev-sw").setAttribute("data-on",dev);setStat();
}
function setErr(m){fieldErr.textContent=m||"";fieldErr.hidden=!m;input.setAttribute("aria-invalid",m?"true":"false")}

/* -------- a live measurement -------- */
function start(url,d){
  if(ctrl)return;
  dev=d;syncDev();lastScan={url:url,dev:d};lastErr=null;retried=false;stepN=-1;setErr("");
  input.value=disp(url);
  var k=K(),t=T();mode="run";setStat();
  panel.hidden=false;panel.className="panel run";
  panel.innerHTML='<h2 class="pn-h">'+esc(fmt(k.runH,{u:disp(url),d:t.dev[d].toLowerCase()}))+'</h2>'+
    '<p class="pn-dev">'+esc(t.devNote[d])+'</p>'+
    '<div class="pbar" aria-hidden="true" data-pbar></div>'+
    '<p class="pn-clock"><span>'+esc(k.elapsed)+'</span> <b data-clock>0.0 s</b> <span class="pn-usual">'+esc(k.usual)+'</span></p>'+
    '<ol class="steps" data-steps></ol>'+
    '<button type="button" class="kc kc-sm" data-cancel>'+esc(k.cancel)+'</button>';
  $("[data-cancel]",panel).addEventListener("click",function(){if(ctrl)ctrl.abort("user")});
  goBtn.disabled=true;
  t0=tb=performance.now();
  setStep(1);
  tick=setInterval(clock,reduce?1000:100);clock();
  live.textContent=fmt(k.runH,{u:disp(url),d:t.dev[d]});
  panel.scrollIntoView({behavior:reduce?"auto":"smooth",block:"nearest"});
  go(url,d);
}
function stepLabel(i){return i===1&&retried?T().retry:T().steps[i]}
function setStep(n){
  var ol=$("[data-steps]",panel);if(!ol||n<=stepN)return;
  for(var i=stepN+1;i<=n;i++){
    var prev=ol.lastElementChild;
    if(prev&&!prev.classList.contains("ok")){prev.classList.add("ok");$("em",prev).textContent="OK "+sec((performance.now()-t0)/1000)+" s"}
    var li=document.createElement("li");
    li.innerHTML='<span>'+esc(stepLabel(i))+'</span><em>...</em>';
    ol.appendChild(li);
  }
  stepN=n;
}
function clock(){
  var s=(performance.now()-t0)/1000,sb=(performance.now()-tb)/1000,n=30,f=Math.min(n,Math.floor(s/60*n)),h="";
  for(var j=0;j<n;j++)h+=cell(j<f?"on":(j>=7.5&&j<20?"typ":"off"));
  var pb=$("[data-pbar]",panel);if(pb)pb.innerHTML=h;
  var c=$("[data-clock]",panel);if(c)c.textContent=sec(s)+" s";
  for(var i=STEP_AT.length-2;i>=2;i--){if(sb>=STEP_AT[i]){setStep(i);break}}
}
function go(url,d){
  var ac=new AbortController();ctrl=ac;
  var timer=setTimeout(function(){ac.abort("limit")},LIMIT);
  measure(url,d,ac.signal).then(function(M){
    clearTimeout(timer);if(ac!==ctrl)return;
    setStep(6);finish();
    store.live[d+"|"+url]=M;
    panel.hidden=true;panel.innerHTML="";
    shareState(url,d);
    showReport(M,"live",url,true);
  },function(e){
    clearTimeout(timer);if(ac!==ctrl)return;
    if(ac.signal.aborted){finish();if(ac.signal.reason==="limit")fail("timeout");else{panel.hidden=true;panel.innerHTML="";mode=cur?"done":"idle";setStat();setErr(T().e.stopped);input.focus()}return}
    if(e.code==="timeout"&&!retried){retried=true;tb=performance.now();$("[data-steps]",panel).innerHTML="";stepN=-1;setStep(1);go(url,d);return}
    finish();fail(e.code||"other",e.detail);
  });
}
function finish(){clearInterval(tick);tick=null;ctrl=null;goBtn.disabled=false}
function fail(code,detail){
  var t=T(),k=K(),msg=fmt(t.e[code]||t.e.other,{c:detail||code});
  lastErr=code;mode="err";setStat();
  panel.hidden=false;panel.className="panel err";
  panel.innerHTML='<h2 class="pn-h">'+esc(k.errH)+'</h2><p class="pn-msg">'+esc(msg)+'</p>'+
    '<div class="pn-acts"><button type="button" class="kc" data-retry>'+esc(k.tryAgain)+'</button>'+
    (code==="quota"?'<a class="kc kc-ghost" href="https://t.me/'+CONTACT.telegram+'" target="_blank" rel="noopener">Telegram @'+CONTACT.telegram+'</a><a class="kc kc-ghost" href="mailto:'+CONTACT.email+'">'+CONTACT.email+'</a>':"")+'</div>';
  $("[data-retry]",panel).addEventListener("click",function(){if(lastScan)start(lastScan.url,lastScan.dev)});
  live.textContent=k.errH+". "+msg;
  try{$("[data-retry]",panel).focus({preventScroll:true})}catch(x){}
  panel.scrollIntoView({behavior:reduce?"auto":"smooth",block:"nearest"});
}
function shareState(url,d){try{var p=new URLSearchParams(location.search);p.set("url",disp(url));p.set("device",d);history.replaceState(null,"","?"+p.toString()+location.hash)}catch(e){}}

/* -------- the report -------- */
function split(F){
  var top=[],rest=[];
  F.forEach(function(o){(top.length<5&&(lvl(o.imp)>0||top.length<3)?top:rest).push(o)});
  return {top:top,rest:rest};
}
function showReport(M,src,url,scroll,quiet){
  var F=fixes(M),sp=split(F);
  cur={M:M,F:F,top:sp.top,rest:sp.rest,src:src,url:url};
  mode="done";setStat();
  render(!quiet);
  var t=T();
  if(!quiet)live.textContent=K().rpH+". "+CATS.map(function(c){return t.cats[c]+" "+(M.cats[c]==null?"-":M.cats[c])}).join(", ");
  if(scroll){var r=$("#report");setTimeout(function(){r.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});try{r.focus({preventScroll:true})}catch(x){}},reduce?0:150)}
}
function bar(v){
  var n=20,f=v==null?0:Math.round(v/100*n),h="";
  for(var i=0;i<n;i++)h+=cell(i<f?"on":"off");
  return h;
}
var SCALE={fcp:[1800,3000,6000],lcp:[2500,4000,8000],tbt:[200,600,1200],cls:[0.1,0.25,0.5],tbw:[1677722,3355443,6710886]};
function rgauge(k,v){
  var sc=SCALE[k],g=sc[0]/sc[2]*100,f=(sc[1]-sc[0])/sc[2]*100,p=Math.max(1.5,Math.min(98.5,v/sc[2]*100));
  return '<i class="z0" style="width:'+g.toFixed(1)+'%"></i><i class="z1" style="width:'+f.toFixed(1)+'%"></i><i class="z2" style="flex:1"></i><b style="left:'+p.toFixed(1)+'%"></b>';
}
function readVal(k,m){return k==="cls"?(lang==="ru"?m.v.toFixed(3).replace(".",","):m.v.toFixed(3)):k==="tbw"?bytes(m.v,lang):k==="tbt"?Math.round(m.v)+(lang==="ru"?" мс":" ms"):secs(m.v,lang)}
function fixTitle(o){var tx=o.fx?(o.fx[lang]||o.fx.en):null;return tx?tx[0]:o.titles[0]}
function nb(s){return s.replace(/(\d) (s|с|ms|мс)([ .]|$)/g,"$1 $2$3").replace(/ (\d[\d.,]*)\.$/," $1.")}
function evHTML(o){
  var h="";
  if(o.titles.length)h+='<p class="ev-t">'+esc(o.titles.join(". "))+(o.dv.length?' <span class="dim">('+esc(o.dv.join(", "))+')</span>':"")+'</p>';
  if(o.items.length)h+='<ul class="ev-l">'+o.items.map(function(it){return "<li>"+esc(it)+"</li>"}).join("")+'</ul>';
  return h;
}
function fixHTML(o,i){
  var t=T(),fx=o.fx,tx=fx?fx[lang]||fx.en:null,lv=lvl(o.imp),n=i+1;
  var body=tx?tx[1]:t.generic;
  var h='<li class="fx l'+lv+'">';
  h+='<div class="fx-h"><span class="fx-n">'+n+'</span><h4 class="fx-t">'+esc(fixTitle(o))+'</h4></div>';
  h+='<p class="fx-m"><span class="fx-i">'+esc(t.impact[lv])+'</span><span class="fx-c">'+esc(t.cats[o.cat])+'</span></p>';
  h+='<p class="fx-p">'+esc(body)+'</p>';
  if(o.cat==="performance"&&o.sav>=100)h+='<p class="fx-s">'+esc(fmt(t.saves,{x:secs(o.sav,lang)}))+'</p>';
  if(o.titles.length||o.items.length)h+='<details class="ev"><summary>'+esc(t.saw)+'</summary><div class="ev-b">'+evHTML(o)+'</div></details>';
  return h+'</li>';
}
function ctaHTML(txt,u){
  var t=T(),wa="https://wa.me/"+CONTACT.whatsapp+"?text="+encodeURIComponent(txt);
  var em="mailto:"+CONTACT.email+"?subject="+encodeURIComponent(fmt(t.subj,{u:u||"my website"}))+"&body="+encodeURIComponent(txt);
  return '<section class="cta" id="contact" tabindex="-1"><h3 class="sec">'+esc(t.ctaH)+'</h3><p class="cta-p">'+esc(t.ctaP)+'</p>'+
    '<div class="cta-l np"><a class="kc kc-ghost" href="https://t.me/'+CONTACT.telegram+'" target="_blank" rel="noopener" data-tg>'+esc(t.tg)+' <small>@'+CONTACT.telegram+'</small></a>'+
    '<a class="kc kc-ghost" href="'+esc(wa)+'" target="_blank" rel="noopener">'+esc(t.wa)+' <small>'+esc(t.waS)+'</small></a>'+
    '<a class="kc kc-ghost" href="'+esc(em)+'">'+esc(t.em)+' <small>'+CONTACT.email+'</small></a></div>'+
    '<p class="po">Telegram @'+CONTACT.telegram+', WhatsApp +66 96 134 7329, '+CONTACT.email+'</p></section>';
}
function syncEx(){var ex=$("[data-example]");if(ex)ex.hidden=!store.sample||!!(cur&&cur.src==="sample")}
function render(anim){
  if(!cur){rep.innerHTML="";rep.hidden=true;syncEx();return}
  var c=cur,M=c.M,t=T(),k=K(),isS=c.src==="sample",V=verdict(M,c.top),id="rp"+(++rpN),other=M.device==="mobile"?"desktop":"mobile";
  var h='<p class="po ph">'+esc(k.printHead)+', sandersaxbuilds.github.io/selected-work/check/</p>';
  h+='<header class="rp-h"><span class="tag'+(isS?" s":"")+'">'+esc(isS?k.tagS:k.tagL)+'</span><h2 id="'+id+'">'+esc(fmt(k.rpFor,{u:disp(M.final||M.url)}))+'</h2>'+
    '<p class="meta">'+[t.dev[M.device],when(M.at,lang),"Lighthouse "+M.ver+(M.src?", "+M.src:"")].map(esc).join('<span aria-hidden="true"> · </span>')+'</p></header>';
  h+='<div class="rp-g"><div class="rp-sc"><h3 class="sec">'+esc(k.scores)+'</h3><ul class="scs">';
  CATS.forEach(function(cat){var v=M.cats[cat],b=band(v);
    h+='<li class="sc b'+b+'"><span class="sc-n">'+(v==null?"--":v)+'<span class="sr"> '+esc(t.of)+',</span></span><span class="sc-w">'+(b<0?"":esc(t.band[b]))+'</span><span class="sc-l">'+esc(t.cats[cat])+'<small>'+esc(t.catSub[cat])+'</small></span><span class="sc-b" aria-hidden="true"><i style="width:'+(v==null?0:v)+'%"></i></span></li>'});
  h+='</ul></div>';
  h+='<div class="rp-vd"><h3 class="sec">'+esc(k.verdict)+'</h3><p class="vd">'+esc(V.s)+(V.tail?" "+esc(V.tail):"")+'</p></div>';
  h+='<div class="rp-fx"><h3 class="sec">'+esc(t.fixHead)+'</h3>';
  if(c.top.length)h+='<ol class="fxs">'+c.top.map(function(o,i){return fixHTML(o,i)}).join("")+'</ol>';
  else h+='<p class="nofix">'+esc(t.noFix)+'</p>';
  if(c.rest.length)h+='<details class="more"><summary>'+esc(fmt(t.more,{n:c.rest.length}))+'</summary><ol class="fxs" start="'+(c.top.length+1)+'">'+c.rest.map(function(o,i){return fixHTML(o,c.top.length+i)}).join("")+'</ol></details>';
  h+='</div>';
  if(M.shot)h+='<figure class="shot '+M.device+'"><img src="'+M.shot+'" alt="'+esc(fmt(t.shotAlt,{d:t.dev[M.device].toLowerCase()}))+'"><figcaption>'+esc(t.shotCap[M.device])+'</figcaption></figure>';
  h+='</div>';
  h+='<h3 class="sec">'+esc(t.readings)+'</h3><ul class="rds">';
  ["lcp","fcp","tbt","cls","tbw"].forEach(function(key){var m=M.m[key];if(!m||m.v==null)return;var b=sband(m.s);
    h+='<li class="rd b'+b+'"><span class="rd-l">'+esc(t.mn[key])+'</span><span class="rd-v">'+esc(readVal(key,m))+'</span><span class="rd-w">'+(b<0?"":esc(t.band[b]))+'</span><span class="rd-g" aria-hidden="true">'+rgauge(key,m.v)+'</span><span class="rd-h">'+esc(nb(t.mh[key]))+'</span></li>'});
  h+='</ul>';
  h+='<div class="acts np">'+
    '<button type="button" class="kc" data-act="print">'+esc(t.actPrint)+'</button>'+
    '<button type="button" class="kc" data-act="share">'+esc(k.share)+'</button>'+
    '<button type="button" class="kc" data-act="link">'+esc(t.actLink)+'</button>'+
    '<button type="button" class="kc" data-act="copy">'+esc(t.actCopy)+'</button>'+
    '<button type="button" class="kc" data-act="contact">'+esc(k.contact)+'</button>'+
    (!isS&&!store.live[other+"|"+c.url]?'<button type="button" class="kc kc-ghost" data-act="other">'+esc(fmt(t.otherDev,{d:t.devWord[other]}))+'</button>':"")+
  '</div>';
  h+=ctaHTML(summary(M,c.top),host(M.final||M.url));
  rep.innerHTML='<section class="rp" aria-labelledby="'+id+'">'+h+'</section>';
  rep.hidden=false;
  rep.classList.remove("in");
  if(anim&&!reduce){void rep.offsetWidth;rep.classList.add("in")}
  $("[data-tg]",rep).addEventListener("click",function(){copy(summary(M,c.top)).catch(function(){})});
  $$("[data-act]",rep).forEach(function(b){b.addEventListener("click",function(){act(b.getAttribute("data-act"),b)})});
  syncEx();
}
function flash(b,ok,txt){var old=b.textContent;b.textContent=txt;b.classList.toggle("ok",ok);setTimeout(function(){if(b.isConnected){b.textContent=old;b.classList.remove("ok")}},2000)}
function shareURL(){return cur&&cur.src==="live"?location.href:location.origin+location.pathname}
function act(a,b){
  var t=T(),k=K();
  if(a==="print"){$$("details",rep).forEach(function(d){d.open=true});window.print()}
  else if(a==="share"){
    var u=shareURL();
    if(navigator.share&&window.matchMedia("(pointer: coarse)").matches){navigator.share({title:t.doc,url:u}).then(function(){flash(b,true,k.shared)},function(){})}
    else copy(u).then(function(){flash(b,true,t.copied)},function(){flash(b,false,t.copyFail)});
  }
  else if(a==="link")copy(shareURL()).then(function(){flash(b,true,t.copied)},function(){flash(b,false,t.copyFail)});
  else if(a==="copy")copy(summary(cur.M,cur.top)).then(function(){flash(b,true,t.copied)},function(){flash(b,false,t.copyFail)});
  else if(a==="contact"){var cta=$("#contact");cta.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});try{cta.focus({preventScroll:true})}catch(x){}}
  else if(a==="other"){var o=cur.M.device==="mobile"?"desktop":"mobile";start(cur.url,o)}
}
function summary(M,top){
  var t=T(),u=host(M.final||M.url),lines=[t.hello,"",fmt(t.sum,{u:u,d:t.dev[M.device],t:when(M.at,lang)})];
  lines.push(CATS.map(function(c){return t.cats[c]+": "+(M.cats[c]==null?"-":M.cats[c])}).join(", "));
  if(top.length){lines.push("");lines.push(t.fixFirst);top.slice(0,5).forEach(function(o,i){lines.push((i+1)+". "+fixTitle(o))})}
  if(cur&&cur.src==="live"&&cur.M===M){lines.push("");lines.push(t.link+": "+location.href)}
  return lines.join("\n");
}
function copy(text){
  return new Promise(function(res,rej){
    function fb(){try{var ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();var r=document.execCommand("copy");ta.remove();r?res():rej()}catch(e){rej()}}
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(res,fb);else fb();
  });
}

/* -------- language -------- */
function setLang(l){
  lang=S[l]?l:"en";var t=T(),k=K();
  document.documentElement.lang=lang;document.title=t.doc;
  $$("[data-s]").forEach(function(el){var v=t[el.getAttribute("data-s")];if(typeof v==="string")el.textContent=v});
  $$("[data-c]").forEach(function(el){var v=k[el.getAttribute("data-c")];if(typeof v==="string")el.textContent=v});
  $$("[data-s-aria]").forEach(function(el){var v=t[el.getAttribute("data-s-aria")];if(typeof v==="string")el.setAttribute("aria-label",v)});
  $$(".langs button").forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-l")===lang))});
  input.placeholder=t.ph;
  if(fieldErr.textContent)setErr("");
  if(mode==="err"&&lastErr)fail(lastErr);
  else if(mode==="run"&&panel.firstChild){$(".pn-h",panel).textContent=fmt(k.runH,{u:disp(lastScan.url),d:t.dev[lastScan.dev].toLowerCase()});$(".pn-usual",panel).textContent=k.usual;$("[data-cancel]",panel).textContent=k.cancel}
  syncDev();render(false);
  try{localStorage.setItem("ak-lang",lang)}catch(e){}
}

/* -------- wiring -------- */
form.addEventListener("submit",function(e){
  e.preventDefault();
  if(ctrl)return;
  var p=parseAddress(input.value);
  if(p.err){setErr(T().e[p.err]);input.focus();return}
  start(p.url,dev);
});
input.addEventListener("input",function(){if(fieldErr.textContent)setErr("")});
$$("[data-dev]").forEach(function(b){
  b.addEventListener("click",function(){if(ctrl)return;dev=b.getAttribute("data-dev");syncDev();sampleDev()});
  b.addEventListener("keydown",function(e){if(/^Arrow/.test(e.key)){e.preventDefault();if(ctrl)return;dev=dev==="mobile"?"desktop":"mobile";syncDev();sampleDev();$('[data-dev="'+dev+'"]').focus()}});
});
function sampleDev(){if(cur&&cur.src==="sample"&&store.sample){var M=store.sample[dev]||store.sample.mobile;if(M!==cur.M)showReport(M,"sample","https://example.com/",false,true)}}
$("[data-example]").addEventListener("click",function(){
  if(ctrl)return;
  var M=store.sample&&(store.sample[dev]||store.sample.mobile);if(!M)return;
  panel.hidden=true;showReport(M,"sample","https://example.com/",true);
});
$$(".langs button").forEach(function(b){b.addEventListener("click",function(){setLang(b.getAttribute("data-l"))})});
window.addEventListener("beforeprint",function(){$$("details",rep).forEach(function(d){d.open=true})});
try{window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change",function(m){reduce=m.matches})}catch(e){}

var P=new URLSearchParams(location.search),saved=null;try{saved=localStorage.getItem("ak-lang")}catch(e){}
var nl=(navigator.language||"en").slice(0,2);
$("[data-ver]").textContent=ver;
if(P.get("device")==="desktop")dev="desktop";
setLang(S[P.get("lang")]?P.get("lang"):S[saved]?saved:S[nl]?nl:"en");
var sm=store.sample&&(store.sample[dev]||store.sample.mobile);
if(P.get("url")){var pa=parseAddress(P.get("url"));if(pa.url)start(pa.url,dev);else{input.value=P.get("url");setErr(T().e[pa.err]);if(sm)showReport(sm,"sample","https://example.com/",false,true)}}
else if(sm)showReport(sm,"sample","https://example.com/",false,true);
window.__check={parseAddress:parseAddress,fixes:fixes,store:store,cur:function(){return cur},mode:function(){return mode}};
})();
