/* Website check, console edition. A visitor types an address at a terminal prompt, a real Lighthouse run measures it, and the result prints in plain words.
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
en:{doc:"Website check · SanderSax",skip:"Skip to the address field",kick:"Website check",instr:"Measuring instrument",
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
 privacy:"The address you type is sent to Microlink, a public service that runs the Lighthouse test. Nothing is stored on this site.",
 rep:"Website report",sampleTag:"Example",sampleP:"A real report for example.com, the standard test address. Measure your own site above.",
 liveTag:"Measured just now",
 fAddr:"Address",fWhen:"Measured",fDev:"Device",fEng:"Engine",
 dev:{mobile:"Phone",desktop:"Desktop"},devWord:{mobile:"phones",desktop:"computers"},
 cats:{performance:"Speed",accessibility:"Easy to use","best-practices":"Trust and safety",seo:"Found on Google"},
 catSub:{performance:"How fast it opens",accessibility:"Reading and tapping","best-practices":"Security and errors",seo:"Search basics"},
 band:["Poor","Needs work","Good"],of:"out of 100",
 readings:"Readings",
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
 otherDev:"Measure on {d} too",
 ctaH:"Want these fixed?",ctaP:"I build and repair websites for small businesses in Thailand. Send me this report and I will tell you honestly what is worth fixing, what it would cost and how long it takes. If the site is already fine, I will say so.",
 tg:"Message on Telegram",wa:"Message on WhatsApp",waS:"The summary is already in the message",em:"Send an email",
 hello:"Hello Alexandr, I checked my website with your tool.",fixFirst:"Fix first:",link:"Report",subj:"Website check for {u}",
 shotAlt:"How the page looked on the test {d} at the end of loading",
 generic:"A technical check that did not pass. A developer can fix it using the details below.",
 fCity:"Thailand, working remotely",fOffer:"Websites for businesses",fAll:"All work",footLabel:"Links",
 sum:"Website check for {u} on {d}, {t}"},
ru:{doc:"Проверка сайта · SanderSax",skip:"Перейти к полю адреса",kick:"Проверка сайта",instr:"Измерительный прибор",
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
 privacy:"Введённый адрес отправляется в Microlink, публичный сервис, который запускает тест Lighthouse. На этом сайте ничего не сохраняется.",
 rep:"Отчёт о сайте",sampleTag:"Пример",sampleP:"Настоящий отчёт для example.com, стандартного тестового адреса. Измерьте свой сайт выше.",
 liveTag:"Измерено только что",
 fAddr:"Адрес",fWhen:"Измерено",fDev:"Устройство",fEng:"Движок",
 dev:{mobile:"Телефон",desktop:"Компьютер"},devWord:{mobile:"телефоне",desktop:"компьютере"},
 cats:{performance:"Скорость",accessibility:"Удобство","best-practices":"Надёжность",seo:"Видимость в Google"},
 catSub:{performance:"Как быстро открывается",accessibility:"Текст и кнопки","best-practices":"Безопасность и ошибки",seo:"Основы поиска"},
 band:["Плохо","Нужно улучшить","Хорошо"],of:"из 100",
 readings:"Показания",
 mn:{fcp:"Первое появление",lcp:"Главное видно",tbt:"Не реагирует на нажатия",cls:"Страница прыгает",tbw:"Объём загрузки"},
 mh:{fcp:"Когда появляется первый текст или картинка.",lcp:"Когда видна самая крупная часть страницы. Хорошо, если меньше 2,5 с.",tbt:"Сколько страница слишком занята, чтобы ответить на нажатие.",cls:"Насколько всё сдвигается во время загрузки. Хорошо, если меньше 0,1.",tbw:"Всё, что посетитель скачивает при первом визите."},
 fixHead:"Исправить в первую очередь",fixSub:"По порядку пользы для посетителей. Нажмите на оценку выше, чтобы оставить одну область.",
 more:"Мелочи ({n})",noFix:"Важных исправлений нет. Страница в очень хорошем состоянии.",noFixCat:"В этой области исправлять нечего.",
 impact:["Малый эффект","Средний эффект","Большой эффект"],saw:"Что увидел тест",saves:"Страница может появляться примерно на {x} быстрее",
 all:"Все области",showing:"Показано: {c}",
 v:{good:"На {d} всё в очень хорошем состоянии.",perf:"Медленно на {d}. Главное содержимое появляется через {x}, многие посетители не ждут так долго.",perf2:"На {d} могло бы быть быстрее.",
  access:"Части посетителей будет трудно читать текст или попадать по кнопкам.","best-practices":"Есть проблемы с надёжностью или безопасностью.",seo:"Google может плохо показывать эту страницу.",
  tail1:"Начните с исправления ниже.",tailN:"Начните с {n} исправлений ниже."},
 actPrint:"Печать или PDF",actCopy:"Копировать итог",actLink:"Копировать ссылку",copied:"Скопировано",copyFail:"Не удалось скопировать",
 otherDev:"Измерить и на {d}",
 ctaH:"Хотите это исправить?",ctaP:"Я делаю и чиню сайты для небольших бизнесов в Таиланде. Пришлите этот отчёт, и я честно скажу, что стоит исправлять, сколько это стоит и сколько займёт. Если сайт уже в порядке, так и скажу.",
 tg:"Написать в Telegram",wa:"Написать в WhatsApp",waS:"Итог уже в сообщении",em:"Написать на почту",
 hello:"Здравствуйте, Александр! Я проверил свой сайт вашим инструментом.",fixFirst:"Исправить в первую очередь:",link:"Отчёт",subj:"Проверка сайта {u}",
 shotAlt:"Как страница выглядела на тестовом устройстве ({d}) в конце загрузки",
 generic:"Техническая проверка не пройдена. Разработчик исправит это по деталям ниже.",
 fCity:"Таиланд, работаю удалённо",fOffer:"Сайты для бизнеса",fAll:"Все работы",footLabel:"Ссылки",
 sum:"Проверка сайта {u}, {d}, {t}"},
th:{doc:"เช็กเว็บไซต์ · SanderSax",skip:"ข้ามไปที่ช่องที่อยู่เว็บ",kick:"เช็กเว็บไซต์",instr:"เครื่องวัด",
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
 privacy:"ที่อยู่เว็บที่คุณพิมพ์จะถูกส่งไปที่ Microlink บริการสาธารณะที่รันการทดสอบ Lighthouse เว็บนี้ไม่เก็บข้อมูลใดๆ",
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
 otherDev:"วัดบน{d}ด้วย",
 ctaH:"อยากให้แก้เรื่องเหล่านี้ไหม",ctaP:"ผมทำและซ่อมเว็บไซต์ให้ธุรกิจขนาดเล็กในไทย ส่งรายงานนี้มา ผมจะบอกตรงๆ ว่าอะไรคุ้มที่จะแก้ ราคาเท่าไร และใช้เวลานานแค่ไหน ถ้าเว็บดีอยู่แล้ว ผมก็จะบอกตามจริง",
 tg:"ทักทาง Telegram",wa:"ทักทาง WhatsApp",waS:"มีสรุปอยู่ในข้อความแล้ว",em:"ส่งอีเมล",
 hello:"สวัสดีครับ คุณ Alexandr ผมเช็กเว็บไซต์ด้วยเครื่องมือของคุณ",fixFirst:"ควรแก้ก่อน:",link:"รายงาน",subj:"เช็กเว็บไซต์ {u}",
 shotAlt:"หน้าเว็บบน{d}ทดสอบตอนโหลดเสร็จ",
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

/* -------- console words -------- */
var C={
en:{skip:"Skip to the command line",sys:"SANDERSAX WEBSITE CHECK, CONSOLE WC-3270",eng:"ENGINE    LIGHTHOUSE {v}, RUN BY MICROLINK",devs:"DEVICES   PHONE, MID-RANGE ON SLOW 4G. DESKTOP, FAST LINE.",
 h1:"Measure any website in about thirty seconds.",hint1:"Type an address and press Enter, for example",
 hint2:"On a phone, tap the keys below. {ex} shows a sample report, {help} lists every command.",
 ready:"READY",run:"RUNNING, ESC STOPS",prt:"PRINTING, ANY KEY SKIPS",typeAddr:"TYPE THE ADDRESS, THEN PRESS ENTER",
 busy:"A test is running. Type STOP or press Esc to cancel it.",noRun:"Nothing is running.",unknown:"Unknown command {c}. Type HELP for the list.",
 helpH:"COMMANDS",helpKeys:"Up and Down arrows bring back earlier commands. Esc or a tap skips the printing.",
 help:[["yourbusiness.com","Measure a website. SCAN yourbusiness.com does the same.",0],["SCAN address DESKTOP","Measure it as a desktop computer instead of a phone.",0],["DEVICE","Switch the test device between phone and desktop.",1],["EXAMPLE","Show a real report for example.com.",1],["FIX 1","Show what the test saw for fix number 1.",1],["MORE","List the smaller things found.",1],["PRINT","Print the last report, or save it as PDF.",1],["SHARE","Copy a link that opens this check again.",1],["COPY","Copy a short summary of the report.",1],["CONTACT","Ways to reach me about the fixes.",1],["STOP","Cancel a running test.",1],["RETRY","Run the last test again.",1],["LANG RU","Change the language: EN, RU or TH.",1],["CLEAR","Clear the screen.",1]],
 devSet:"Test device is now: {d}.",scanH:"MEASURING {u} ON {D}",elapsed:"ELAPSED",usual:"usually done between 15 and 40 s",doneL:"Done in {x} s. Report follows.",
 rpH:"WEBSITE REPORT",tagS:"EXAMPLE",tagL:"MEASURED JUST NOW",sampleP:"A real report for example.com, the standard test address. Type your own address to measure your site.",
 scores:"SCORES",verdict:"VERDICT",fixHint:"Ordered by how much each one helps your visitors. Type FIX and a number to see what the test saw.",
 moreL:"Smaller things found: {n}.",moreH:"SMALLER THINGS FOUND",evH:"FIX {n}, WHAT THE TEST SAW",evNone:"The test gave no more detail for this one.",
 noRep:"No report yet. Type an address, or EXAMPLE for a sample.",noFix:"There is no fix {n}. This report lists {m}.",noMore:"Nothing smaller was found.",
 next:"NEXT",eT:{empty:"NO ADDRESS",invalid:"BAD ADDRESS",local:"PRIVATE ADDRESS",unreach:"NO REPLY",timeout:"TIMED OUT",quota:"DAILY LIMIT",net:"OFFLINE",other:"NOT FINISHED",stopped:"STOPPED"},
 hRetry:"Type RETRY to run it again.",hQuota:"Type CONTACT and send me the address, I will run it for you.",hAddr:"Try for example SCAN yourbusiness.com",noRetry:"Nothing to retry yet.",
 copiedL:"Link copied.",copiedS:"Summary copied.",shared:"Shared.",copyFail:"Could not copy. Select the text above and copy it by hand.",
 printL:"Opening the print dialog. Choose Save as PDF to keep a file.",langSet:"Language set to English.",otherHint:"Type {c} to measure on {d} too.",
 ph:"yourbusiness.com",inLabel:"Command line",keysLabel:"Command keys",oDev:"DEVICE",printHead:"SanderSax website check",cmdW:"Command"},
ru:{skip:"Перейти к командной строке",sys:"SANDERSAX ПРОВЕРКА САЙТА, КОНСОЛЬ WC-3270",eng:"ДВИЖОК     LIGHTHOUSE {v}, ЗАПУСК ЧЕРЕЗ MICROLINK",devs:"УСТРОЙСТВА ТЕЛЕФОН, СРЕДНИЙ, МЕДЛЕННЫЙ 4G. КОМПЬЮТЕР, БЫСТРЫЙ ИНТЕРНЕТ.",
 h1:"Измерьте любой сайт примерно за полминуты.",hint1:"Введите адрес и нажмите Enter, например",
 hint2:"На телефоне нажимайте клавиши внизу. {ex} покажет пример отчёта, {help} покажет все команды.",
 ready:"ГОТОВ",run:"ИДЁТ ТЕСТ, ESC ОСТАНОВИТ",prt:"ПЕЧАТЬ, ЛЮБАЯ КЛАВИША ПРОПУСКАЕТ",typeAddr:"ВВЕДИТЕ АДРЕС И НАЖМИТЕ ENTER",
 busy:"Идёт тест. Введите STOP или нажмите Esc, чтобы отменить.",noRun:"Сейчас ничего не запущено.",unknown:"Неизвестная команда {c}. Введите HELP, чтобы увидеть список.",
 helpH:"КОМАНДЫ",helpKeys:"Стрелки вверх и вниз возвращают прошлые команды. Esc или касание пропускают печать.",
 help:[["vash-biznes.com","Измерить сайт. SCAN vash-biznes.com делает то же самое.",0],["SCAN адрес DESKTOP","Измерить как на компьютере, а не на телефоне.",0],["DEVICE","Переключить тестовое устройство: телефон или компьютер.",1],["EXAMPLE","Показать настоящий отчёт для example.com.",1],["FIX 1","Показать, что увидел тест, для исправления номер 1.",1],["MORE","Список мелочей.",1],["PRINT","Напечатать последний отчёт или сохранить в PDF.",1],["SHARE","Скопировать ссылку, которая снова откроет эту проверку.",1],["COPY","Скопировать краткий итог отчёта.",1],["CONTACT","Как связаться со мной насчёт исправлений.",1],["STOP","Отменить идущий тест.",1],["RETRY","Запустить последний тест ещё раз.",1],["LANG EN","Сменить язык: EN, RU или TH.",1],["CLEAR","Очистить экран.",1]],
 devSet:"Тестовое устройство: {d}.",scanH:"ИЗМЕРЯЕМ {u}, {D}",elapsed:"ПРОШЛО",usual:"обычно готово за 15-40 с",doneL:"Готово за {x} с. Отчёт ниже.",
 rpH:"ОТЧЁТ О САЙТЕ",tagS:"ПРИМЕР",tagL:"ИЗМЕРЕНО ТОЛЬКО ЧТО",sampleP:"Настоящий отчёт для example.com, стандартного тестового адреса. Введите свой адрес, чтобы измерить свой сайт.",
 scores:"ОЦЕНКИ",verdict:"ИТОГ",fixHint:"По порядку пользы для посетителей. Введите FIX и номер, чтобы увидеть, что увидел тест.",
 moreL:"Мелочей найдено: {n}.",moreH:"МЕЛОЧИ",evH:"ИСПРАВЛЕНИЕ {n}, ЧТО УВИДЕЛ ТЕСТ",evNone:"Тест не дал подробностей по этому пункту.",
 noRep:"Отчёта пока нет. Введите адрес или EXAMPLE для примера.",noFix:"Исправления {n} нет. В отчёте их {m}.",noMore:"Мелочей не найдено.",
 next:"ДАЛЬШЕ",eT:{empty:"НЕТ АДРЕСА",invalid:"НЕВЕРНЫЙ АДРЕС",local:"ЧАСТНЫЙ АДРЕС",unreach:"НЕТ ОТВЕТА",timeout:"ВРЕМЯ ВЫШЛО",quota:"ЛИМИТ НА СЕГОДНЯ",net:"НЕТ СВЯЗИ",other:"ТЕСТ НЕ ЗАВЕРШЁН",stopped:"ОСТАНОВЛЕНО"},
 hRetry:"Введите RETRY, чтобы запустить снова.",hQuota:"Введите CONTACT и пришлите мне адрес, я проверю сам.",hAddr:"Например: SCAN vash-biznes.com",noRetry:"Повторять пока нечего.",
 copiedL:"Ссылка скопирована.",copiedS:"Итог скопирован.",shared:"Отправлено.",copyFail:"Не удалось скопировать. Выделите текст выше и скопируйте вручную.",
 printL:"Открываю печать. Выберите «Сохранить как PDF», чтобы получить файл.",langSet:"Язык: русский.",otherHint:"Введите {c}, чтобы измерить и на {d}.",
 ph:"vash-biznes.com",inLabel:"Командная строка",keysLabel:"Командные клавиши",oDev:"УСТР.",printHead:"SanderSax, проверка сайта",cmdW:"Команда"},
th:{skip:"ข้ามไปที่บรรทัดคำสั่ง",sys:"SANDERSAX เช็กเว็บไซต์ คอนโซล WC-3270",eng:"เครื่องมือ  LIGHTHOUSE {v} รันผ่าน MICROLINK",devs:"อุปกรณ์  มือถือระดับกลาง เน็ต 4G ช้า และคอมพิวเตอร์ เน็ตเร็ว",
 h1:"วัดเว็บไซต์ไหนก็ได้ในราวสามสิบวินาที",hint1:"พิมพ์ที่อยู่เว็บแล้วกด Enter เช่น",
 hint2:"บนมือถือแตะปุ่มด้านล่าง {ex} แสดงรายงานตัวอย่าง {help} แสดงคำสั่งทั้งหมด",
 ready:"พร้อม",run:"กำลังทดสอบ กด ESC เพื่อหยุด",prt:"กำลังพิมพ์ กดปุ่มใดก็ได้เพื่อข้าม",typeAddr:"พิมพ์ที่อยู่เว็บ แล้วกด ENTER",
 busy:"กำลังทดสอบอยู่ พิมพ์ STOP หรือกด Esc เพื่อยกเลิก",noRun:"ตอนนี้ไม่มีการทดสอบ",unknown:"ไม่รู้จักคำสั่ง {c} พิมพ์ HELP เพื่อดูรายการ",
 helpH:"คำสั่ง",helpKeys:"ลูกศรขึ้นและลงเรียกคำสั่งก่อนหน้า กด Esc หรือแตะเพื่อข้ามการพิมพ์",
 help:[["yourbusiness.com","วัดเว็บไซต์ พิมพ์ SCAN yourbusiness.com ก็ได้ผลเหมือนกัน",0],["SCAN ที่อยู่ DESKTOP","วัดแบบคอมพิวเตอร์แทนมือถือ",0],["DEVICE","สลับอุปกรณ์ทดสอบระหว่างมือถือกับคอมพิวเตอร์",1],["EXAMPLE","ดูรายงานจริงของ example.com",1],["FIX 1","ดูสิ่งที่การทดสอบเห็นสำหรับข้อที่ 1",1],["MORE","ดูเรื่องเล็กๆ ที่พบ",1],["PRINT","พิมพ์รายงานล่าสุด หรือบันทึกเป็น PDF",1],["SHARE","คัดลอกลิงก์ที่เปิดการเช็กนี้อีกครั้ง",1],["COPY","คัดลอกสรุปสั้นๆ ของรายงาน",1],["CONTACT","ช่องทางติดต่อผมเรื่องการแก้ไข",1],["STOP","ยกเลิกการทดสอบที่กำลังทำ",1],["RETRY","ทดสอบครั้งล่าสุดอีกครั้ง",1],["LANG EN","เปลี่ยนภาษา EN, RU หรือ TH",1],["CLEAR","ล้างหน้าจอ",1]],
 devSet:"อุปกรณ์ทดสอบตอนนี้คือ{d}",scanH:"กำลังวัด {u} บน{D}",elapsed:"ผ่านไป",usual:"ปกติเสร็จใน 15 ถึง 40 วินาที",doneL:"เสร็จใน {x} วินาที รายงานอยู่ด้านล่าง",
 rpH:"รายงานเว็บไซต์",tagS:"ตัวอย่าง",tagL:"เพิ่งวัดเสร็จ",sampleP:"รายงานจริงของ example.com ที่อยู่สำหรับทดสอบมาตรฐาน พิมพ์ที่อยู่ของคุณเพื่อวัดเว็บของคุณ",
 scores:"คะแนน",verdict:"สรุป",fixHint:"เรียงตามประโยชน์ต่อผู้เข้าชม พิมพ์ FIX ตามด้วยหมายเลขเพื่อดูสิ่งที่การทดสอบเห็น",
 moreL:"พบเรื่องเล็กๆ {n} ข้อ",moreH:"เรื่องเล็กๆ ที่พบ",evH:"ข้อ {n} สิ่งที่การทดสอบเห็น",evNone:"การทดสอบไม่มีรายละเอียดเพิ่มสำหรับข้อนี้",
 noRep:"ยังไม่มีรายงาน พิมพ์ที่อยู่เว็บ หรือ EXAMPLE เพื่อดูตัวอย่าง",noFix:"ไม่มีข้อ {n} รายงานนี้มี {m} ข้อ",noMore:"ไม่พบเรื่องเล็กๆ",
 next:"ต่อไป",eT:{empty:"ไม่มีที่อยู่",invalid:"ที่อยู่ไม่ถูกต้อง",local:"ที่อยู่ส่วนตัว",unreach:"ไม่มีการตอบกลับ",timeout:"หมดเวลา",quota:"ครบโควตาวันนี้",net:"ออฟไลน์",other:"ทดสอบไม่เสร็จ",stopped:"หยุดแล้ว"},
 hRetry:"พิมพ์ RETRY เพื่อลองใหม่",hQuota:"พิมพ์ CONTACT แล้วส่งที่อยู่มา ผมจะเช็กให้",hAddr:"ลองแบบนี้ SCAN yourbusiness.com",noRetry:"ยังไม่มีอะไรให้ลองใหม่",
 copiedL:"คัดลอกลิงก์แล้ว",copiedS:"คัดลอกสรุปแล้ว",shared:"แชร์แล้ว",copyFail:"คัดลอกไม่สำเร็จ เลือกข้อความด้านบนแล้วคัดลอกเอง",
 printL:"กำลังเปิดหน้าพิมพ์ เลือกบันทึกเป็น PDF เพื่อเก็บไฟล์",langSet:"เปลี่ยนเป็นภาษาไทยแล้ว",otherHint:"พิมพ์ {c} เพื่อวัดบน{d}ด้วย",
 ph:"yourbusiness.com",inLabel:"บรรทัดคำสั่ง",keysLabel:"ปุ่มคำสั่ง",oDev:"อุปกรณ์",printHead:"SanderSax เช็กเว็บไซต์",cmdW:"คำสั่ง"}
};
var KEYS=["SCAN","EXAMPLE","DEVICE","PRINT","SHARE","CONTACT","HELP","CLEAR"];
function cell(c){return '<i class="c '+c+'"></i>'}   /* one character cell of a gauge, drawn as a lit block */

/* -------- state -------- */
var lang="en",dev="mobile",ctrl=null,t0=0,tb=0,tick=null,retried=false,stepN=-1,runBox=null;
var store={sample:window.CHECK_SAMPLE||null,live:{}};
var cur=null,lastScan=null,lastErr=false,hist=[],hi=0,touch=false,follow=true,rpN=0,idle=[];
var ver=((store.sample&&store.sample.mobile&&store.sample.mobile.ver)||"13").split(".")[0];
var log=$("[data-log]"),form=$("#cmd"),input=$("#cmd-in"),pr=$("[data-prompt]"),keys=$("[data-keys]"),live=$("[data-live]"),stat=$("[data-stat]"),screen=$("[data-screen]");
function T(){return S[lang]}
function K(){return C[lang]}
function disp(u){return String(u).replace(/^https:\/\//,"").replace(/\/$/,"")}
function L(html,cls,tag){tag=tag||"div";return "<"+tag+' class="ln'+(cls?" "+cls:"")+'">'+html+"</"+tag+">"}
function B(cmd,label){return '<button type="button" class="k" data-cmd="'+esc(cmd)+'">'+esc(label||cmd)+"</button>"}
function pad(n){return (n<10?"0":"")+n}
function sec(x){var v=x.toFixed(1);return lang==="ru"?v.replace(".",","):v}

/* -------- teletype printer: every .ln is one line, revealed in order -------- */
var Q=[],qt=null,printing=false;
function put(html,opt){
  opt=opt||{};
  var box=document.createElement("div");box.className="blk"+(opt.cls?" "+opt.cls:"");box.innerHTML=html;
  log.appendChild(box);
  var lines=$$(".ln",box);
  if(opt.now||reduce||(!Q.length&&!lines.length)){if(!printing)settle();return box}
  lines.forEach(function(n){n.classList.add("wait");Q.push(n)});
  if(!printing){printing=true;pr.classList.add("off");setStat()}
  if(!qt)pump();
  return box;
}
function pump(){
  var n=Q.shift();
  if(!n){qt=null;printing=false;pr.classList.remove("off");setStat();settle();return}
  n.classList.remove("wait");
  var len=Math.min(90,(n.textContent||"").replace(/\s+/g," ").length),d=Math.max(50,Math.min(240,len*4.5));
  n.style.setProperty("--n",String(Math.max(1,Math.round(len/2))));n.style.setProperty("--d",Math.round(d)+"ms");
  n.classList.add("tt");
  if(follow)keep(n);
  qt=setTimeout(pump,Math.max(24,d*0.5)+(n.classList.contains("gap")?50:0));
}
function skip(){
  if(!printing)return;
  clearTimeout(qt);qt=null;
  Q.forEach(function(n){n.classList.remove("wait")});Q=[];
  pump();
}
function keep(n){
  var r=n.getBoundingClientRect(),kb=keys.getBoundingClientRect(),lim=Math.min(window.innerHeight,kb.top>0?kb.top:window.innerHeight)-14;
  if(r.bottom>lim)window.scrollBy(0,Math.ceil(r.bottom-lim));
}
function settle(){
  setStat();
  if(follow)keep(pr);
  if(!touch){try{input.focus({preventScroll:true})}catch(e){}}
  var c=idle.splice(0);c.forEach(function(f){f()});
}
function say(html,cls){return put(L(html,cls))}

/* -------- status line and keys -------- */
function setStat(m){
  var k=K();
  stat.textContent=m||(ctrl?k.run:printing?k.prt:k.ready);
  stat.className=ctrl?"st run":printing?"st prt":"st";
  $("[data-odev]").textContent=k.oDev+" "+T().dev[dev].toUpperCase();
}
function keysRender(){
  keys.innerHTML=KEYS.map(function(c,i){
    var cmd=(i===0&&ctrl)?"STOP":c,sub=c==="DEVICE"?T().dev[dev].toUpperCase():"";
    return '<button type="button" class="key'+(cmd==="STOP"?" stop":"")+'" data-key="'+cmd+'"><small aria-hidden="true">PF'+(i+1)+'</small><b>'+cmd+'</b>'+(sub?'<em>'+esc(sub)+'</em>':"")+'</button>';
  }).join("");
}
function syncDev(){setStat();keysRender()}

/* -------- commands -------- */
var DEVW={PHONE:"mobile",MOBILE:"mobile",DESKTOP:"desktop",PC:"desktop",COMPUTER:"desktop",LAPTOP:"desktop"};
var CMD={
  SCAN:cmdScan,MEASURE:cmdScan,CHECK:cmdScan,RUN:cmdScan,TEST:cmdScan,
  HELP:cmdHelp,"?":cmdHelp,CLEAR:cmdClear,CLS:cmdClear,
  PRINT:cmdPrint,SHARE:cmdShare,LINK:cmdShare,COPY:cmdCopy,SUMMARY:cmdCopy,
  EXAMPLE:cmdExample,SAMPLE:cmdExample,DEMO:cmdExample,
  DEVICE:cmdDevice,PHONE:function(){cmdDevice(["PHONE"])},MOBILE:function(){cmdDevice(["PHONE"])},DESKTOP:function(){cmdDevice(["DESKTOP"])},
  FIX:cmdFix,MORE:cmdMore,CONTACT:cmdContact,STOP:cmdStop,RETRY:cmdRetry,LANG:cmdLang
};
var DURING=["STOP","HELP","?","CLEAR","CLS","LANG"];
function exec(raw){
  skip();follow=true;
  var s=String(raw||"").trim().slice(0,300);
  put(L('<span class="pp" aria-hidden="true">===&gt;</span> <span class="sr">'+esc(K().cmdW)+': </span>'+esc(s),"echo"),{now:true});
  if(!s){settle();return}
  if(hist[hist.length-1]!==s)hist.push(s);hi=hist.length;
  var parts=s.split(/\s+/),w=parts[0].toUpperCase(),arg=parts.slice(1);
  if(ctrl&&DURING.indexOf(w)<0){say(esc(K().busy),"dim");return}
  if(CMD[w]){CMD[w](arg);return}
  if(parts.length<=2&&/[.:\/]/.test(parts[0])){cmdScan(parts);return}
  say(esc(fmt(K().unknown,{c:parts[0].toUpperCase()})),"warn");
}
function cmdScan(a){
  var d=dev,addr=null;
  a.forEach(function(x){var u=x.toUpperCase();if(DEVW[u])d=DEVW[u];else if(!addr)addr=x});
  if(!addr){errBlock("empty");return}
  var p=parseAddress(addr);
  if(p.err){errBlock(p.err);return}
  start(p.url,d);
}
function cmdHelp(){
  var k=K(),h=L(esc(k.helpH),"sec","h2");
  k.help.forEach(function(r){h+=L('<span class="hp-c">'+(r[2]?B(r[0]):'<code>'+esc(r[0])+'</code>')+'</span><span class="hp-d">'+esc(r[1])+'</span>',"hp")});
  h+=L(esc(k.helpKeys),"dim");
  put(h,{cls:"help"});
}
function cmdClear(){skip();log.innerHTML="";follow=true;window.scrollTo(0,0);settle()}
function cmdExample(){
  var M=store.sample&&(store.sample[dev]||store.sample.mobile);
  if(!M){errBlock("other","no sample");return}
  showReport(M,"sample","https://example.com/");
}
function cmdDevice(a){
  var w=(a[0]||"").toUpperCase();
  dev=DEVW[w]||(dev==="mobile"?"desktop":"mobile");syncDev();
  var h=L(esc(fmt(K().devSet,{d:T().dev[dev]})));
  if(cur&&cur.src==="live"&&!store.live[dev+"|"+cur.url]){var c="SCAN "+disp(cur.url)+" "+(dev==="desktop"?"DESKTOP":"PHONE");h+=L(esc(fmt(K().otherHint,{c:"{c}",d:T().devWord[dev]})).replace("{c}",B(c)),"dim")}
  put(h);
}
function cmdLang(a){
  var w=(a[0]||"").toLowerCase(),order=["en","ru","th"];
  setLang(S[w]?w:order[(order.indexOf(lang)+1)%3]);
  say(esc(K().langSet));
}
function need(){if(!cur){say(esc(K().noRep)+" "+B("EXAMPLE"),"warn");return false}return true}
function allFixes(){return cur.top.concat(cur.rest)}
function cmdFix(a){
  if(!need())return;
  var all=allFixes(),n=parseInt(a[0],10);
  if(!(n>=1&&n<=all.length)){say(esc(fmt(K().noFix,{n:a[0]||"?",m:all.length})),"warn");return}
  put(L(esc(fmt(K().evH,{n:n})),"sec","h2")+L(esc(fixTitle(all[n-1])),"hi")+evHTML(all[n-1]));
}
function cmdMore(){
  if(!need())return;
  if(!cur.rest.length){say(esc(K().noMore));return}
  var h=L(esc(K().moreH),"sec","h2");
  cur.rest.forEach(function(o,i){h+=fixHTML(o,cur.top.length+i)});
  put(h);
}
function cmdPrint(){
  if(!need())return;
  if(!cur.el||!cur.el.isConnected){var b=put(reportHTML(cur),{now:true});cur.el=$(".rp",b)}
  mark(cur.el);
  say(esc(K().printL),"dim");
  skip();
  setTimeout(function(){window.print()},reduce?0:120);
}
function mark(el){$$(".rp.pr").forEach(function(x){x.classList.remove("pr")});el.classList.add("pr");document.body.classList.add("has-pr")}
function shareURL(){return cur&&cur.src==="live"?location.href:location.origin+location.pathname}
function cmdShare(){
  var u=shareURL(),k=K(),coarse=window.matchMedia("(pointer: coarse)").matches;
  if(navigator.share&&coarse){navigator.share({title:T().doc,url:u}).then(function(){say(esc(k.shared))},function(){copyOut(u,k.copiedL)});return}
  copyOut(u,k.copiedL);
}
function cmdCopy(){if(!need())return;copyOut(summary(cur.M,cur.top),K().copiedS,true)}
function copyOut(text,okMsg,quiet){
  copy(text).then(function(){say(esc(okMsg)+(quiet?"":' <span class="dim">'+esc(text)+'</span>'))},function(){say(esc(K().copyFail)+' <span class="hi">'+esc(text)+'</span>',"warn")});
}
function cmdContact(){put(ctaHTML(cur?summary(cur.M,cur.top):T().hello,cur?host(cur.M.final||cur.M.url):""))}
function cmdStop(){if(ctrl)ctrl.abort("user");else say(esc(K().noRun),"dim")}
function cmdRetry(){if(!lastScan){say(esc(K().noRetry),"dim");return}start(lastScan.url,lastScan.dev)}

/* -------- a live measurement -------- */
function start(url,d){
  dev=d;lastScan={url:url,dev:d};lastErr=false;retried=false;stepN=-1;
  var k=K(),t=T();
  runBox=put(L(esc(fmt(k.scanH,{u:disp(url),D:t.dev[d].toUpperCase()})),"hd")+L(esc(t.devNote[d]),"dim")+'<ol class="steps" data-steps></ol>'+L("","prog"),{now:true,cls:"run"});
  t0=tb=performance.now();
  ctrl={pending:true};syncDev();
  setStep(1);
  tick=setInterval(clock,reduce?1000:100);clock();
  live.textContent=fmt(k.scanH,{u:disp(url),D:t.dev[d]});
  go(url,d);
}
function stepLabel(i){return i===1&&retried?T().retry:T().steps[i]}
function setStep(n){
  if(!runBox||n<=stepN)return;
  var ol=$("[data-steps]",runBox);
  for(var i=stepN+1;i<=n;i++){
    var prev=ol.lastElementChild;
    if(prev&&!prev.classList.contains("ok")){prev.classList.add("ok");$("em",prev).textContent="OK "+sec((performance.now()-t0)/1000)}
    var li=document.createElement("li");li.className="ln";
    li.innerHTML='<span>'+esc(stepLabel(i))+'</span><i aria-hidden="true"></i><em>...</em>';
    ol.appendChild(li);
  }
  stepN=n;
  if(follow)keep(pr);
}
function gauge(s){
  var n=20,f=Math.min(n,Math.floor(s/60*n)),a="";
  for(var i=0;i<f;i++)a+=cell("on");
  /* filled part, then the "usually done here" stretch (15 to 40 s of 60), then the rest */
  var h='<span class="g-on">'+a+'</span>';
  for(var j=f;j<n;j++){h+=cell(j>=5&&j<14?"typ":"off")}
  return h;
}
function clock(){
  if(!runBox)return;
  var s=(performance.now()-t0)/1000,sb=(performance.now()-tb)/1000,k=K();
  $(".prog",runBox).innerHTML='<span class="pl">'+esc(k.elapsed)+' <b>'+sec(s)+' s</b></span><span class="pg" aria-hidden="true">['+gauge(s)+']</span><span class="pu dim">'+esc(k.usual)+'</span>';
  for(var i=STEP_AT.length-2;i>=2;i--){if(sb>=STEP_AT[i]){setStep(i);break}}
}
function go(url,d){
  var ac=new AbortController();ctrl=ac;
  var timer=setTimeout(function(){ac.abort("limit")},LIMIT);
  measure(url,d,ac.signal).then(function(M){
    clearTimeout(timer);if(ac!==ctrl)return;
    setStep(6);
    var took=(performance.now()-t0)/1000;
    finish(true);
    store.live[d+"|"+url]=M;
    put(L(esc(fmt(K().doneL,{x:sec(took)})),"ok"),{now:true});
    shareState(url,d);
    showReport(M,"live",url);
  },function(e){
    clearTimeout(timer);if(ac!==ctrl)return;
    if(ac.signal.aborted){finish(false);errBlock(ac.signal.reason==="limit"?"timeout":"stopped");return}
    if(e.code==="timeout"&&!retried){retried=true;tb=performance.now();var ol=$("[data-steps]",runBox);ol.innerHTML="";stepN=-1;setStep(1);go(url,d);return}
    finish(false);errBlock(e.code||"other",e.detail);
  });
}
function finish(ok){
  clearInterval(tick);tick=null;ctrl=null;
  if(runBox){
    clock();
    var last=$("[data-steps] li:last-child",runBox);
    if(last&&!last.classList.contains("ok")){last.classList.add(ok?"ok":"bad");$("em",last).textContent=ok?"OK "+sec((performance.now()-t0)/1000):"--"}
  }
  runBox=null;syncDev();
}
function errBlock(code,detail){
  var t=T(),k=K(),msg=fmt(t.e[code]||t.e.other,{c:detail||code});
  var addr=code==="empty"||code==="invalid"||code==="local";
  var h=L('<span class="er-c">?ERR</span> '+esc(k.eT[code]||k.eT.other),"er-h")+L(esc(msg));
  if(addr)h+=L(esc(k.hAddr)+" "+B("EXAMPLE"),"dim");
  else if(code==="quota")h+=L(esc(k.hQuota)+" "+B("CONTACT")+" "+B("RETRY"),"dim");
  else h+=L(esc(k.hRetry)+" "+B("RETRY"),"dim");
  lastErr=!addr;
  put(h,{cls:"er"});
  live.textContent=(k.eT[code]||"")+". "+msg;
}
function shareState(url,d){try{var p=new URLSearchParams(location.search);p.set("url",disp(url));p.set("device",d);history.replaceState(null,"","?"+p.toString()+location.hash)}catch(e){}}

/* -------- the report, printed as console output -------- */
function split(F){
  var top=[],rest=[];
  F.forEach(function(o){(top.length<5&&(lvl(o.imp)>0||top.length<3)?top:rest).push(o)});
  return {top:top,rest:rest};
}
function showReport(M,src,url){
  var F=fixes(M),sp=split(F);
  cur={M:M,F:F,top:sp.top,rest:sp.rest,src:src,url:url,el:null};
  var box=put(reportHTML(cur),{cls:"rpb"});
  cur.el=$(".rp",box);
  var t=T();
  live.textContent=K().rpH+". "+CATS.map(function(c){return t.cats[c]+" "+(M.cats[c]==null?"-":M.cats[c])}).join(", ");
}
function bar(v){
  var n=20,f=v==null?0:Math.round(v/100*n),on="",off="";
  for(var i=0;i<n;i++){if(i<f)on+=cell("on");else off+=cell("off")}
  return '[<span class="on">'+on+'</span><span class="off">'+off+'</span>]';
}
function rgauge(k,v){
  var sc=SCALE[k],n=15,g=Math.round(sc[0]/sc[2]*n),f=Math.round(sc[1]/sc[2]*n),p=Math.min(n-1,Math.floor(v/sc[2]*n)),h="";
  for(var i=0;i<n;i++){var z=i<g?0:i<f?1:2;h+='<span class="z'+z+(i===p?" mk":"")+'">'+(i===p?cell("mk"):"-")+'</span>'}
  return "["+h+"]";
}
var SCALE={fcp:[1800,3000,6000],lcp:[2500,4000,8000],tbt:[200,600,1200],cls:[0.1,0.25,0.5],tbw:[1677722,3355443,6710886]};
function readVal(k,m){return k==="cls"?(lang==="ru"?m.v.toFixed(3).replace(".",","):m.v.toFixed(3)):k==="tbw"?bytes(m.v,lang):k==="tbt"?Math.round(m.v)+(lang==="ru"?" мс":" ms"):secs(m.v,lang)}
function fixTitle(o){var tx=o.fx?(o.fx[lang]||o.fx.en):null;return tx?tx[0]:o.titles[0]}
function evHTML(o){
  var k=K(),h="";
  if(o.titles.length)h+=L(esc(o.titles.join(". "))+(o.dv.length?' <span class="dim">('+esc(o.dv.join(", "))+')</span>':""),"ev");
  o.items.forEach(function(it){h+=L("- "+esc(it),"ev it")});
  if(!o.dv.length&&!o.items.length)h+=L(esc(k.evNone),"ev dim");
  return h;
}
function fixHTML(o,i){
  var t=T(),fx=o.fx,tx=fx?fx[lang]||fx.en:null,lv=lvl(o.imp),n=i+1;
  var body=tx?tx[1]:t.generic,imp=["#--","##-","###"][lv];
  var h='<div class="fx l'+lv+'">';
  h+=L('<span class="fx-n">'+pad(n)+'</span><span class="fx-t">'+esc(fixTitle(o))+'</span>',"fx-h");
  h+=L('<span class="fx-i"><span aria-hidden="true">['+imp+']</span> '+esc(t.impact[lv])+'</span><span class="fx-c">'+esc(t.cats[o.cat])+'</span><span class="np">'+B("FIX "+n)+'</span>',"fx-m");
  h+=L(esc(body),"fx-p");
  if(o.cat==="performance"&&o.sav>=100)h+=L(esc(fmt(t.saves,{x:secs(o.sav,lang)})),"fx-s");
  h+='<div class="po fx-ev">'+evHTML(o)+'</div></div>';
  return h;
}
function ctaHTML(txt,u){
  var t=T(),wa="https://wa.me/"+CONTACT.whatsapp+"?text="+encodeURIComponent(txt);
  var em="mailto:"+CONTACT.email+"?subject="+encodeURIComponent(fmt(t.subj,{u:u||"my website"}))+"&body="+encodeURIComponent(txt);
  return L(esc(t.ctaH),"sec","h3")+L(esc(t.ctaP),"cta-p")+
    L('<a class="lk" href="https://t.me/'+CONTACT.telegram+'" target="_blank" rel="noopener">TELEGRAM @'+CONTACT.telegram+'</a><a class="lk" href="'+esc(wa)+'" target="_blank" rel="noopener">WHATSAPP</a><a class="lk" href="'+esc(em)+'">EMAIL</a>',"cta-l np")+
    L(esc(t.waS),"dim np")+
    '<p class="po">Telegram @'+CONTACT.telegram+', WhatsApp +66 96 134 7329, '+CONTACT.email+'</p>';
}
function reportHTML(c){
  var M=c.M,t=T(),k=K(),isS=c.src==="sample",V=verdict(M,c.top),id="rp"+(++rpN),other=M.device==="mobile"?"desktop":"mobile";
  var h='<section class="rp" aria-labelledby="'+id+'">';
  h+='<p class="po ph">'+esc(k.printHead)+', sandersaxbuilds.github.io/selected-work/check/</p>';
  h+=L('<h2 id="'+id+'">'+esc(k.rpH)+'</h2><span class="tag'+(isS?" s":"")+'">'+esc(isS?k.tagS:k.tagL)+'</span>',"rp-h");
  if(isS)h+=L(esc(k.sampleP),"dim");
  h+='<dl class="meta">'+[[t.fAddr,disp(M.final||M.url).replace(/^http:\/\//,"")],[t.fWhen,when(M.at,lang)],[t.fDev,t.dev[M.device]],[t.fEng,"Lighthouse "+M.ver+(M.src?", "+M.src:"")]].map(function(r){return '<div class="ln mr"><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>'}).join("")+'</dl>';
  h+='<div class="rp-top"><div class="rp-sc">';
  h+=L(esc(k.scores),"sec","h3");
  CATS.forEach(function(cat){var v=M.cats[cat],b=band(v);
    h+=L('<span class="sc-l">'+esc(t.cats[cat])+'</span><span class="sc-b" aria-hidden="true">'+bar(v)+'</span><span class="sc-n">'+(v==null?"--":v)+'<span class="sr"> '+esc(t.of)+',</span></span><span class="sc-w">'+(b<0?"":esc(t.band[b]))+'</span>',"sc b"+b)});
  h+=L(esc(k.verdict),"sec","h3")+L(esc(V.s)+(V.tail?" "+esc(V.tail):""),"vd");
  h+='</div>';
  if(M.shot)h+='<figure class="ln shot '+M.device+'"><img src="'+M.shot+'" alt="'+esc(fmt(t.shotAlt,{d:t.dev[M.device].toLowerCase()}))+'"></figure>';
  h+='</div>';
  h+=L(esc(t.readings),"sec","h3");
  ["lcp","fcp","tbt","cls","tbw"].forEach(function(key){var m=M.m[key];if(!m||m.v==null)return;var b=sband(m.s);
    h+=L('<span class="rd-l">'+esc(t.mn[key])+'</span><span class="rd-v">'+esc(readVal(key,m))+'</span><span class="rd-w">'+(b<0?"":esc(t.band[b]))+'</span><span class="rd-g" aria-hidden="true">'+rgauge(key,m.v)+'</span>',"rd b"+b)+L(esc(t.mh[key]).replace(/(\d) (s|с|ms|มс)([ .]|$)/g,"$1 $2$3").replace(/ (\d[\d.,]*)\.$/," $1."),"rd-h dim")});
  h+=L(esc(t.fixHead),"sec","h3");
  if(c.top.length){h+=L(esc(k.fixHint),"dim np");c.top.forEach(function(o,i){h+=fixHTML(o,i)})}
  else h+=L(esc(t.noFix));
  if(c.rest.length){
    h+=L(esc(fmt(k.moreL,{n:c.rest.length}))+' <span class="np">'+B("MORE")+'</span>',"more");
    h+='<div class="po">'+c.rest.map(function(o,i){return fixHTML(o,c.top.length+i)}).join("")+'</div>';
  }
  var nx=[B("PRINT"),B("SHARE"),B("COPY"),B("CONTACT")];
  if(!isS&&!store.live[other+"|"+c.url])nx.push(B("SCAN "+disp(c.url)+" "+(other==="desktop"?"DESKTOP":"PHONE"),T().dev[other].toUpperCase()));
  h+=L('<span class="nx-l">'+esc(k.next)+'</span>'+nx.join(""),"nx np");
  h+=ctaHTML(summary(M,c.top),host(M.final||M.url));
  h+='</section>';
  return h;
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

/* -------- boot -------- */
function boot(){
  var k=K(),t=T();
  put(L(esc(k.sys),"hi")+L(esc(fmt(k.eng,{v:ver})),"dim")+L(esc(k.devs),"dim")+L("","gap")+
    '<h1 class="ln h1">'+esc(k.h1)+'</h1>'+L(esc(t.lead),"lead")+L("","gap")+
    L(esc(k.hint1)+' <code>'+esc(k.ph)+'</code>')+
    L(esc(k.hint2).replace("{ex}",B("EXAMPLE")).replace("{help}",B("HELP")))+
    L(esc(t.privacy),"dim sm"),{cls:"boot"});
}

/* -------- language -------- */
function setLang(l){
  lang=S[l]?l:"en";var t=T(),k=K();
  document.documentElement.lang=lang;document.title=t.doc;
  $$("[data-s]").forEach(function(el){var v=t[el.getAttribute("data-s")];if(typeof v==="string")el.textContent=v});
  $$("[data-c]").forEach(function(el){var v=k[el.getAttribute("data-c")];if(typeof v==="string")el.textContent=v});
  $$("[data-s-aria]").forEach(function(el){var v=t[el.getAttribute("data-s-aria")];if(typeof v==="string")el.setAttribute("aria-label",v)});
  $$(".langs button").forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-l")===lang))});
  input.placeholder=k.ph;keys.setAttribute("aria-label",k.keysLabel);
  syncDev();
  try{localStorage.setItem("ak-lang",lang)}catch(e){}
}

/* -------- wiring -------- */
form.addEventListener("submit",function(e){e.preventDefault();var v=input.value;input.value="";exec(v)});
input.addEventListener("keydown",function(e){
  if(e.key==="ArrowUp"&&hist.length){e.preventDefault();hi=Math.max(0,hi-1);input.value=hist[hi];setTimeout(function(){input.setSelectionRange(input.value.length,input.value.length)},0)}
  else if(e.key==="ArrowDown"&&hist.length){e.preventDefault();hi=Math.min(hist.length,hi+1);input.value=hist[hi]||""}
});
document.addEventListener("keydown",function(e){
  touch=false;
  if(e.key==="Escape"){if(printing){skip();e.preventDefault()}else if(ctrl){ctrl.abort("user");e.preventDefault()}else if(document.activeElement===input)input.value="";return}
  if(printing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&["Shift","Control","Alt","Meta","Tab","CapsLock"].indexOf(e.key)<0)skip();
});
document.addEventListener("pointerdown",function(e){touch=e.pointerType==="touch"||e.pointerType==="pen";if(printing&&screen.contains(e.target)&&!e.target.closest("a,button"))skip()});
function stopFollow(){if(printing||ctrl)follow=false}
window.addEventListener("wheel",function(e){if(e.deltaY<0)stopFollow()},{passive:true});
window.addEventListener("touchmove",stopFollow,{passive:true});
function onCmdClick(e){
  var b=e.target.closest("[data-cmd],[data-key]");if(!b)return;
  if(b.hasAttribute("data-key")){
    var c=b.getAttribute("data-key");
    if(c==="SCAN"){var v=input.value.trim();if(v){input.value="";exec(/^scan\b/i.test(v)?v:"SCAN "+v)}else{skip();setStat(K().typeAddr);input.focus()}return}
    exec(c);return;
  }
  exec(b.getAttribute("data-cmd"));
}
log.addEventListener("click",onCmdClick);
keys.addEventListener("click",onCmdClick);
screen.addEventListener("click",function(e){
  if(touch||e.target.closest("a,button,input,img")||String(window.getSelection&&window.getSelection())!=="")return;
  try{input.focus({preventScroll:true})}catch(x){}
});
$$(".langs button").forEach(function(b){b.addEventListener("click",function(){var l=b.getAttribute("data-l");if(l!==lang){setLang(l);say(esc(K().langSet))}})});
window.addEventListener("beforeprint",function(){
  skip();
  if(!$(".rp.pr")){var all=$$(".rp");if(all.length)mark(all[all.length-1])}
});
window.addEventListener("afterprint",function(){$$(".rp.pr").forEach(function(x){x.classList.remove("pr")});document.body.classList.remove("has-pr")});
try{window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change",function(m){reduce=m.matches})}catch(e){}

var P=new URLSearchParams(location.search),saved=null;try{saved=localStorage.getItem("ak-lang")}catch(e){}
var nl=(navigator.language||"en").slice(0,2);
setLang(S[P.get("lang")]?P.get("lang"):S[saved]?saved:S[nl]?nl:"en");
if(P.get("device")==="desktop")dev="desktop";
$("[data-ver]").textContent=ver;
syncDev();
boot();
if(P.get("url")){var q="SCAN "+P.get("url").slice(0,200)+(dev==="desktop"?" DESKTOP":"");if(printing)idle.push(function(){exec(q)});else exec(q)}
window.__check={parseAddress:parseAddress,fixes:fixes,store:store,exec:exec,skip:skip,cur:function(){return cur},printing:function(){return printing}};
})();
