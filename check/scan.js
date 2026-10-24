/* Website check. A visitor types an address, a real Lighthouse run measures it, and the result is written up in plain words.
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

/* -------- state -------- */
var lang="en",dev="mobile",state="idle",ctrl=null,t0=0,tb=0,tick=null,retried=false,lastErr=null;
var store={sample:window.CHECK_SAMPLE||null,live:{},url:""},view={src:"sample",dev:"mobile",cat:null};
var input=$("[data-url]"),form=$("#probe"),glass=$("#glass"),rep=$("[data-rep]"),live=$("[data-live]"),goBtn=$("[data-go]");

function T(){return S[lang]}

/* -------- the instrument face -------- */
function axisTicks(){
  var h="";for(var s=0;s<=AXIS;s+=5){h+='<i style="left:'+(s/AXIS*100)+'%" class="'+(s%10?"":"mj")+'">'+(s%10?"":"<b>"+s+"</b>")+"</i>"}
  $("[data-ticks]").innerHTML=h;
  var band=$(".axis-band");band.style.left=(15/AXIS*100)+"%";band.style.width=(25/AXIS*100)+"%";
}
function setGlass(g){state=g;$$(".g-state",glass).forEach(function(el){el.hidden=el.getAttribute("data-g")!==g});glass.setAttribute("data-state",g)}
function stepsHTML(n,retry){
  var t=T();return t.steps.map(function(s,i){var c=i<n?"ok":i===n?"now":"";
    var lab=(i===1&&retry)?t.retry:s;
    return '<li class="'+c+'"><i aria-hidden="true"></i><span>'+esc(lab)+'</span><em data-st="'+i+'"></em></li>'}).join("");
}
var stepN=-1,stepTimes=[];
function setStep(n,force){
  if(n<=stepN&&!force)return;
  for(var i=stepN+1;i<=n;i++)stepTimes[i]=(performance.now()-t0)/1000;
  stepN=n;$("[data-steps]").innerHTML=stepsHTML(n,retried);
  stepTimes.forEach(function(v,i){var em=$('[data-st="'+i+'"]');if(em&&i<n)em.textContent=v.toFixed(1)+"s"});
  if(n<T().steps.length)live.textContent=T().steps[n];
}
function clock(){
  var s=(performance.now()-t0)/1000,sb=(performance.now()-tb)/1000;
  $("[data-clock]").textContent=(s<10?"0":"")+s.toFixed(1);
  $("[data-fill]").style.width=Math.min(100,s/AXIS*100)+"%";
  for(var i=STEP_AT.length-2;i>=2;i--){if(sb>=STEP_AT[i]){setStep(i);break}}
}
function devNote(){var t=T();$("[data-gdev]").textContent=t.devNote[dev];$("[data-gdev2]").textContent=t.devNote[dev]}

function start(url,d){
  if(ctrl)return;
  dev=d||dev;syncDev();
  store.url=url;input.value=url.replace(/^https:\/\//,"").replace(/\/$/,"");if(view.src==="live"&&store.lastUrl!==url){store.live={}}store.lastUrl=url;
  setErr("");retried=false;stepN=-1;stepTimes=[];
  setGlass("run");t0=tb=performance.now();lastErr=null;setStep(1);
  $("[data-fill]").style.width="0";
  tick=setInterval(clock,reduce?1000:100);clock();
  goBtn.classList.add("on");$("[data-golab]").textContent=T().stop;
  run(url,dev);
}
function run(url,d){
  ctrl=new AbortController();var my=ctrl,timer=setTimeout(function(){my.abort("limit")},LIMIT);
  measure(url,d,my.signal).then(function(M){
    clearTimeout(timer);if(my!==ctrl)return;
    setStep(6);
    store.live[d]=M;store.url=url;
    setTimeout(function(){finish();view={src:"live",dev:d,cat:null};render(true);showDone(M);share(url,d);
      setTimeout(function(){var r=$("#report");r.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});try{r.focus({preventScroll:true})}catch(x){}},reduce?0:900)},reduce?0:350);
  },function(e){
    clearTimeout(timer);if(my!==ctrl)return;
    if(my.signal.aborted){finish();if(my.signal.reason==="limit")fail("timeout");else{setGlass("idle");setErr(T().e.stopped)}return}
    if(e.code==="timeout"&&!retried){retried=true;ctrl=null;tb=performance.now();stepN=-1;stepTimes=[];setStep(1);run(url,d);return}
    finish();fail(e.code||"other",e.detail);
  });
}
function toUnit(){$(".unit").scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"})}
function finish(){clearInterval(tick);tick=null;ctrl=null;goBtn.classList.remove("on");$("[data-golab]").textContent=T().measure}
function stop(){if(ctrl)ctrl.abort("user")}
function fail(code,detail){
  lastErr=[code,detail];var t=T(),msg=fmt(t.e[code]||t.e.other,{c:detail||code});
  $("[data-errmsg]").textContent=msg;setGlass("err");live.textContent=msg;
  if(!store.live.mobile&&!store.live.desktop){view={src:"sample",dev:view.dev,cat:null};render(false)}
}
function showDone(M){
  var t=T();
  $("[data-reads]").innerHTML=CATS.map(function(c){var v=M.cats[c],b=band(v);return '<div class="rd b'+b+'"><span>'+esc(t.cats[c])+'</span><b>'+(v==null?"–":v)+'</b></div>'}).join("");
  $("[data-took]").textContent=fmt(t.took,{x:((performance.now()-t0)/1000).toFixed(1)});setGlass("done");
  live.textContent=t.rep+". "+CATS.map(function(c){return t.cats[c]+" "+M.cats[c]}).join(", ");
}
function setErr(m){$("[data-err]").textContent=m;input.setAttribute("aria-invalid",m&&m!==T().e.stopped?"true":"false")}
function syncDev(){$$("[data-dev]").forEach(function(b){b.setAttribute("aria-checked",String(b.getAttribute("data-dev")===dev))});$(".dev-sw").setAttribute("data-on",dev);devNote()}
function share(url,d){try{var p=new URLSearchParams(location.search);p.set("url",url.replace(/^https:\/\//,""));p.set("device",d);history.replaceState(null,"","?"+p.toString()+location.hash)}catch(e){}}

/* -------- the report -------- */
var GR=42;
function dial(c,v,on){
  var b=band(v),t=T(),off=v==null?100:100-v,ticks="";
  for(var i=0;i<50;i++){var p=i*2,mj=p===0||p===50||p===90,a=(p/100)*Math.PI*2-Math.PI/2,r1=mj?47.5:49,r2=mj?54:52;
    ticks+='<line class="tk'+(mj?" mj":"")+'" x1="'+(50+Math.cos(a)*r1).toFixed(2)+'" y1="'+(50+Math.sin(a)*r1).toFixed(2)+'" x2="'+(50+Math.cos(a)*r2).toFixed(2)+'" y2="'+(50+Math.sin(a)*r2).toFixed(2)+'"/>'}
  var lab=t.cats[c]+": "+(v==null?"–":v)+" "+t.of+", "+(b<0?"":t.band[b]);
  return '<button type="button" class="dial b'+b+(on?" sel":"")+'" data-cat="'+c+'" aria-pressed="'+(on?"true":"false")+'" aria-label="'+esc(lab)+'">'+
   '<span class="dial-g"><svg viewBox="-6 -6 112 112" aria-hidden="true">'+ticks+
   '<circle class="tr" cx="50" cy="50" r="'+GR+'"/>'+
   '<circle class="ar" data-arc cx="50" cy="50" r="'+GR+'" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="'+(reduce?off:100)+'" data-off="'+off+'" transform="rotate(-90 50 50)"'+(v===0?' style="display:none"':'')+'/></svg>'+
   '<span class="dial-n" data-n="'+(v==null?"":v)+'">'+(v==null?"–":(reduce?v:0))+'</span></span>'+
   '<span class="dial-l"><b>'+esc(t.cats[c])+'</b><small>'+esc(t.catSub[c])+'</small><em>'+(b<0?"":esc(t.band[b]))+'</em></span></button>';
}
var SCALE={fcp:[1800,3000,6000],lcp:[2500,4000,8000],tbt:[200,600,1200],cls:[0.1,0.25,0.5],tbw:[1677722,3355443,6710886]};
function reading(k,m){
  var t=T();if(!m||m.v==null)return "";
  var sc=SCALE[k],b=sband(m.s),pos=Math.min(100,m.v/sc[2]*100),val=k==="cls"?(lang==="ru"?m.v.toFixed(3).replace(".",","):m.v.toFixed(3)):k==="tbw"?bytes(m.v,lang):k==="tbt"?Math.round(m.v)+(lang==="ru"?" мс":" ms"):secs(m.v,lang);
  return '<li class="rdg b'+b+'"><div class="rdg-t"><b>'+esc(t.mn[k])+'</b><small>'+esc(t.mh[k])+'</small></div>'+
   '<div class="rdg-v"><strong>'+esc(val)+'</strong><em>'+(b<0?"":esc(t.band[b]))+'</em></div>'+
   '<div class="rdg-s" aria-hidden="true"><span class="z g" style="width:'+(sc[0]/sc[2]*100)+'%"></span><span class="z f" style="width:'+((sc[1]-sc[0])/sc[2]*100)+'%"></span><span class="z p"></span><i class="nd" style="--x:'+pos.toFixed(1)+'%"></i></div></li>';
}
function fixHTML(o,i,top){
  var t=T(),fx=o.fx,tx=fx?fx[lang]||fx.en:null,L=lvl(o.imp);
  var title=tx?tx[0]:o.titles[0],body=tx?tx[1]:t.generic;
  var ev="";
  if(o.dv.length||o.items.length||!tx){
    ev='<details class="ev"><summary>'+esc(t.saw)+'</summary><div class="ev-b">'+
      (tx?"":"")+'<p class="ev-lh">'+esc(o.titles.join(" · "))+(o.dv.length?" · "+esc(o.dv.join(", ")):"")+'</p>'+
      (o.items.length?'<ul>'+o.items.map(function(it){return "<li>"+esc(it)+"</li>"}).join("")+"</ul>":"")+'</div></details>';
  }
  var sv=o.cat==="performance"&&o.sav>=100?'<p class="fx-sv">'+esc(fmt(t.saves,{x:secs(o.sav,lang)}))+'</p>':"";
  return '<li class="fx l'+L+'" data-fc="'+o.cat+'">'+(top?'<span class="fx-i">'+(i+1)+'</span>':"")+
    '<div class="fx-b"><div class="fx-h"><span class="fx-imp"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>'+esc(t.impact[L])+'</span><span class="fx-c">'+esc(t.cats[o.cat])+'</span></div>'+
    '<h4>'+esc(title)+'</h4><p>'+esc(body)+'</p>'+sv+ev+'</div></li>';
}
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
function current(){return view.src==="live"?store.live[view.dev]:(store.sample&&store.sample[view.dev])}
function render(anim){
  var M=current(),t=T();
  if(!M){rep.innerHTML="";return}
  var F=fixes(M),top=[],rest=[];
  F.forEach(function(o){(top.length<5&&(lvl(o.imp)>0||top.length<3)?top:rest).push(o)});
  var V=verdict(M,top),isS=view.src==="sample",other=view.dev==="mobile"?"desktop":"mobile";
  var hasOther=isS?!!(store.sample&&store.sample[other]):!!store.live[other];
  var cat=view.cat;
  function vis(list){return cat?list.filter(function(o){return o.cat===cat}):list}
  var tv=vis(top),rv=vis(rest);
  rep.className="rep"+(isS?" is-sample":"")+(anim&&!reduce?" in":"");
  rep.innerHTML=
   '<header class="rep-top"><div class="rep-tt"><h2 id="rep-h">'+esc(t.rep)+'</h2><span class="tag'+(isS?" s":"")+'">'+esc(isS?t.sampleTag:t.liveTag)+'</span></div>'+
    '<div class="rep-sw" role="group" aria-label="'+esc(t.devLabel)+'">'+["mobile","desktop"].map(function(d){var avail=isS?!!(store.sample&&store.sample[d]):true;return '<button type="button" data-rdev="'+d+'" aria-pressed="'+(d===view.dev)+'"'+(avail?"":" disabled")+'>'+esc(t.dev[d])+(isS||store.live[d]?"":' <small>+</small>')+'</button>'}).join("")+'</div></header>'+
   (isS?'<p class="rep-note">'+esc(t.sampleP)+'</p>':"")+
   '<dl class="rep-meta"><div><dt>'+esc(t.fAddr)+'</dt><dd>'+esc(host(M.final||M.url))+'</dd></div><div><dt>'+esc(t.fWhen)+'</dt><dd>'+esc(when(M.at,lang))+'</dd></div><div><dt>'+esc(t.fDev)+'</dt><dd>'+esc(t.dev[M.device])+'</dd></div><div><dt>'+esc(t.fEng)+'</dt><dd>Lighthouse '+esc(M.ver)+'</dd></div></dl>'+
   '<div class="rep-hero '+M.device+'">'+
     (M.shot?'<figure class="shot '+M.device+'"><img src="'+M.shot+'" alt="'+esc(fmt(t.shotAlt,{d:t.dev[M.device].toLowerCase()}))+'"></figure>':"")+
     '<div class="rep-side"><p class="verdict">'+esc(V.s)+' <span>'+esc(V.tail)+'</span></p>'+
     '<div class="dials">'+CATS.map(function(c){return dial(c,M.cats[c],cat===c)}).join("")+'</div></div>'+
   '</div>'+
   '<section class="rep-sec"><h3>'+esc(t.readings)+'</h3><ul class="rdgs">'+["lcp","fcp","tbt","cls","tbw"].map(function(k){return reading(k,M.m[k])}).join("")+'</ul></section>'+
   '<section class="rep-sec"><div class="sec-h"><h3>'+esc(t.fixHead)+'</h3>'+(cat?'<button type="button" class="chip" data-cat="">'+esc(fmt(t.showing,{c:t.cats[cat]}))+' <span aria-hidden="true">×</span></button>':"")+'</div><p class="sec-p">'+esc(t.fixSub)+'</p>'+
     (tv.length?'<ol class="fxs">'+tv.map(function(o,i){return fixHTML(o,i,true)}).join("")+'</ol>':'<p class="nofix">'+esc(cat?t.noFixCat:t.noFix)+'</p>')+
     (rv.length?'<details class="more"><summary>'+esc(fmt(t.more,{n:rv.length}))+'</summary><ul class="fxs sm">'+rv.map(function(o,i){return fixHTML(o,i,false)}).join("")+'</ul></details>':"")+
   '</section>'+
   '<div class="acts">'+
     '<button type="button" class="act" data-act="print"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>'+esc(t.actPrint)+'</button>'+
     '<button type="button" class="act" data-act="copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>'+esc(t.actCopy)+'</span></button>'+
     (isS?"":'<button type="button" class="act" data-act="link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg><span>'+esc(t.actLink)+'</span></button>')+
     (!isS&&!hasOther?'<button type="button" class="act" data-act="other"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>'+esc(fmt(t.otherDev,{d:t.devWord[other]}))+'</button>':"")+
   '</div>'+
   '<section class="cta"><div class="cta-t"><h3>'+esc(t.ctaH)+'</h3><p>'+esc(t.ctaP)+'</p></div>'+
     '<div class="cta-l">'+
       '<a class="ch tg" href="https://t.me/'+CONTACT.telegram+'" target="_blank" rel="noopener" data-tg><b>'+esc(t.tg)+'</b><small>@'+CONTACT.telegram+'</small></a>'+
       '<a class="ch wa" target="_blank" rel="noopener" data-wa><b>'+esc(t.wa)+'</b><small>'+esc(t.waS)+'</small></a>'+
       '<a class="ch em" data-em><b>'+esc(t.em)+'</b><small>'+CONTACT.email+'</small></a>'+
     '</div><p class="cta-print">Telegram @'+CONTACT.telegram+' · WhatsApp +66 96 134 7329 · '+CONTACT.email+'</p></section>';
  var txt=summary(M,top);
  $("[data-wa]",rep).href="https://wa.me/"+CONTACT.whatsapp+"?text="+encodeURIComponent(txt);
  $("[data-em]",rep).href="mailto:"+CONTACT.email+"?subject="+encodeURIComponent(fmt(t.subj,{u:host(M.final||M.url)}))+"&body="+encodeURIComponent(txt);
  $("[data-tg]",rep).addEventListener("click",function(){copy(txt)});
  $$("[data-rdev]",rep).forEach(function(b){b.addEventListener("click",function(){
    var d=b.getAttribute("data-rdev");if(d===view.dev)return;
    if(view.src==="live"&&!store.live[d]){toUnit();start(store.url,d);return}
    view.dev=d;view.cat=null;render(false);$('[data-rdev="'+d+'"]',rep).focus()})});
  $$("[data-cat]",rep).forEach(function(b){b.addEventListener("click",function(){
    var c=b.getAttribute("data-cat")||null;view.cat=(c&&view.cat!==c)?c:null;render(false);
    var f=view.cat?$('.dial[data-cat="'+view.cat+'"]',rep):$('.dial[data-cat="'+(c||"performance")+'"]',rep);if(f)f.focus({preventScroll:true})})});
  $$("[data-act]",rep).forEach(function(b){b.addEventListener("click",function(){
    var a=b.getAttribute("data-act");
    if(a==="print"){$$("details",rep).forEach(function(d){d.open=true});window.print()}
    else if(a==="copy")copy(txt,b);
    else if(a==="link")copy(location.href,b);
    else if(a==="other"){toUnit();start(store.url,other)}
  })});
  fill(anim);
}
function fill(anim){
  var arcs=$$("[data-arc]",rep),nums=$$(".dial-n",rep);
  if(!anim||reduce){arcs.forEach(function(a){a.setAttribute("stroke-dashoffset",a.getAttribute("data-off"))});nums.forEach(function(n){if(n.getAttribute("data-n"))n.textContent=n.getAttribute("data-n")});rep.classList.add("set");return}
  var T0=null,D=1100;
  function f(ts){if(!rep.isConnected)return;if(T0==null)T0=ts;var p=Math.min(1,(ts-T0)/D),e=1-Math.pow(1-p,3);
    arcs.forEach(function(a){var off=+a.getAttribute("data-off");a.setAttribute("stroke-dashoffset",String(100-(100-off)*e))});
    nums.forEach(function(n){var v=n.getAttribute("data-n");if(v)n.textContent=Math.round(+v*e)});
    if(p<1)requestAnimationFrame(f);else rep.classList.add("set")}
  function end(){arcs.forEach(function(a){a.setAttribute("stroke-dashoffset",a.getAttribute("data-off"))});nums.forEach(function(n){if(n.getAttribute("data-n"))n.textContent=n.getAttribute("data-n")});rep.classList.add("set")}
  setTimeout(function(){requestAnimationFrame(f)},450);
  setTimeout(end,D+1200);
}
function summary(M,top){
  var t=T(),u=host(M.final||M.url),lines=[t.hello,"",fmt(t.sum,{u:u,d:t.dev[M.device],t:when(M.at,lang)})];
  lines.push(CATS.map(function(c){return t.cats[c]+": "+(M.cats[c]==null?"–":M.cats[c])}).join(", "));
  if(top.length){lines.push("");lines.push(t.fixFirst);top.slice(0,5).forEach(function(o,i){var tx=o.fx?(o.fx[lang]||o.fx.en)[0]:o.titles[0];lines.push((i+1)+". "+tx)})}
  if(view.src==="live"){lines.push("");lines.push(t.link+": "+location.href)}
  return lines.join("\n");
}
function copy(text,btn){
  var t=T();
  function mark(ok){if(!btn)return;var sp=$("span",btn)||btn,old=sp.textContent;sp.textContent=ok?t.copied:t.copyFail;btn.classList.toggle("ok",ok);setTimeout(function(){if(btn.isConnected){sp.textContent=old;btn.classList.remove("ok")}},2000)}
  function fb(){try{var ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();var r=document.execCommand("copy");ta.remove();mark(r)}catch(e){mark(false)}}
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(function(){mark(true)},fb);else fb();
}

/* -------- language -------- */
function setLang(l){
  lang=S[l]?l:"en";var t=T();
  document.documentElement.lang=lang;document.title=t.doc;
  $$("[data-s]").forEach(function(el){var v=t[el.getAttribute("data-s")];if(typeof v==="string")el.textContent=v});
  $$("[data-s-aria]").forEach(function(el){var v=t[el.getAttribute("data-s-aria")];if(typeof v==="string")el.setAttribute("aria-label",v)});
  $$(".langs button").forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-l")===lang))});
  input.placeholder=t.ph;$("[data-golab]").textContent=ctrl?t.stop:t.measure;devNote();
  if(state==="run")setStep(stepN,true);
  if(state==="done"&&current())showDone(current());
  if(state==="err"&&lastErr)$("[data-errmsg]").textContent=fmt(t.e[lastErr[0]]||t.e.other,{c:lastErr[1]||lastErr[0]});
  if($("[data-err]").textContent)setErr("");
  render(false);
  try{localStorage.setItem("ak-lang",lang)}catch(e){}
}

/* -------- wiring -------- */
form.addEventListener("submit",function(e){
  e.preventDefault();
  if(ctrl){stop();return}
  var p=parseAddress(input.value);
  if(p.err){setErr(T().e[p.err]);input.focus();return}
  start(p.url,dev);
});
input.addEventListener("input",function(){if($("[data-err]").textContent)setErr("")});
$$("[data-dev]").forEach(function(b){
  b.addEventListener("click",function(){if(ctrl)return;dev=b.getAttribute("data-dev");syncDev()});
  b.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key==="ArrowLeft"||e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();if(ctrl)return;dev=dev==="mobile"?"desktop":"mobile";syncDev();$('[data-dev="'+dev+'"]').focus()}});
});
$$(".langs button").forEach(function(b){b.addEventListener("click",function(){setLang(b.getAttribute("data-l"))})});
$("[data-plate]").textContent="LIGHTHOUSE "+((store.sample&&store.sample.mobile&&store.sample.mobile.ver)||"13").split(".")[0];
axisTicks();

var P=new URLSearchParams(location.search),saved=null;try{saved=localStorage.getItem("ak-lang")}catch(e){}
var nl=(navigator.language||"en").slice(0,2);
setLang(S[P.get("lang")]?P.get("lang"):S[saved]?saved:S[nl]?nl:"en");
if(P.get("device")==="desktop"){dev="desktop";view.dev="desktop"}
syncDev();setGlass("idle");render(false);
if(P.get("url")){var pa=parseAddress(P.get("url"));if(pa.url){input.value=pa.url.replace(/^https:\/\//,"").replace(/\/$/,"");start(pa.url,dev)}else{input.value=P.get("url");setErr(T().e[pa.err])}}
window.__check={parseAddress:parseAddress,fixes:fixes,store:store,view:view};
})();
