/* Preview copy for the thailand page (plain verdicts, page colours). Website check, a printed inspection report. Mounts into every [data-site-check] element and follows <html lang>.
   data-offer="#prices" points the "see prices" link somewhere else, data-here marks the offer page itself. */
(function(){
"use strict";
var CONTACT={email:"leshadqq@gmail.com",telegram:"sandersax",whatsapp:"66961347329"};
var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

var BIZ=["spa","tours","rent","cafe","clinic","other"],BASE=[60,70,50,90,40,45];
var Q=[{id:"biz"},{id:"site"},{id:"mobile",own:true},{id:"book"},{id:"langs",many:true},{id:"maps"},{id:"msgr",many:true,none:3},{id:"prices"},{id:"speed",own:true}];
/* points per answer, 100 in total */
var PTS={site:[10,4,2,0],mobile:[15,7,0,5],book:[18,10,4,0],maps:[12,6,0],prices:[13,6,0],speed:[10,6,0,4]};
var NOS={mobile:[15,8,4,0],speed:[10,6,4,0]};
var LANGP=[5,2,3,2],MSGP=[4,3,3];
var MAX={site:10,mobile:15,book:18,langs:12,maps:12,msgr:10,prices:13,speed:10};
var AREAS=["site","mobile","book","langs","maps","msgr","prices","speed"];
var W={spa:{book:1.4,prices:1.3,maps:1.2,msgr:1.1},tours:{langs:1.4,book:1.3,prices:1.2,msgr:1.1},rent:{msgr:1.4,prices:1.3,maps:1.2,book:1.1},cafe:{maps:1.4,mobile:1.2,msgr:1.2,prices:1.1},clinic:{book:1.4,langs:1.3,maps:1.2},other:{}};
var LCODE=["EN","RU","TH","CN"],MNAME=["LINE","WhatsApp","Telegram"];
var LOC={ru:"ru-RU",en:"en-GB",th:"th-TH"};

var L={
ru:{qn:"Вопрос {n} из {t}",word0:"вашего бизнеса",word:["спа-салона","туров и экскурсий","проката","кафе и ресторана","клиники","вашего бизнеса"],
 q:{
  biz:["Какой у вас бизнес?","От этого зависят советы в конце.",["Спа и массаж","Туры и экскурсии","Аренда байков и авто","Кафе и ресторан","Клиника","Другое"]],
  site:["У вас есть свой сайт?","Своя страница с адресом, а не только соцсети.",["Да, свой сайт","Только Instagram или Facebook","Только карточка в Google Maps","Пока ничего нет"]],
  mobile:["Как сайт выглядит с телефона?","Если не уверены, откройте его на телефоне.",["Удобно, всё читается","Нормально, но мелко или кнопки неудобные","Неудобно, приходится увеличивать","Не знаю"]],
  book:["Можно ли записаться или заказать онлайн?","Без звонка и долгой переписки.",["Да, в пару нажатий","Через форму или почту","Только звонок или сообщение","Нет"]],
  langs:["На каких языках есть информация?","Можно выбрать несколько.",["Английский","Русский","Тайский","Китайский"]],
  maps:["Есть карточка в Google Maps с отзывами?","И ведёт ли на неё ссылка с сайта.",["Есть, и сайт на неё ссылается","Есть, но с сайтом не связана","Нет или не знаю"]],
  msgr:["Можно написать вам одним нажатием?","Кнопки мессенджеров на странице. Можно выбрать несколько.",["LINE","WhatsApp","Telegram","Таких кнопок нет"]],
  prices:["Видны ли цены?","Клиенту не нужно писать, чтобы узнать стоимость.",["Да, на все услуги","Только на часть","Нет, цену узнают в переписке"]],
  speed:["Как быстро сайт открывается через мобильный интернет?","Хватит первого впечатления, без замеров.",["Сразу","Несколько секунд","Долго, можно не дождаться","Не знаю"]]},
 short:{biz:"Бизнес",site:"Сайт",mobile:"С телефона",book:"Онлайн-запись",langs:"Языки",maps:"Google Maps",msgr:"Мессенджеры",prices:"Цены",speed:"Скорость"},
 notChecked:"своего сайта нет",
 verdict:[[80,"Сильный сайт","Основное уже работает. Осталось поправить детали, чтобы клиенты не уходили к конкурентам."],[60,"Хорошая основа","Сайт помогает, но часть клиентов уходит на последних шагах."],[40,"Часть клиентов уходит без записи","Вас находят, но многим неудобно узнать цену или записаться."],[0,"Сайт почти не приводит клиентов","Большинство посетителей уходит, так и не написав вам."]],
 yours:"Ваш результат",of:"из 100",fixHead:"Что исправить в первую очередь",allGood:"Серьёзных проблем не видно. На разборе можно найти мелочи, которые добавят заявок.",
 fix:{site:["Свой простой сайт","Одна быстрая страница с услугами, ценами и кнопками связи. Её легко найти в Google и удобно отправить клиенту."],
  mobile:["Удобная версия для телефона","Крупный текст и кнопки под палец. Почти все клиенты в Таиланде смотрят сайт с телефона."],
  book:["","Клиент сам выбирает услугу и время, а заявка сразу приходит вам в Telegram или LINE."],
  langs:["Нужные языки","Добавьте {x}. Клиенты охотнее пишут, когда читают на своём языке."],
  maps:["Google Maps и отзывы","Свяжите сайт с карточкой в Google Maps. Отзывы и маршрут убеждают быстрее любого текста."],
  msgr:["Кнопки мессенджеров","Одно нажатие, и клиент уже пишет вам, без поиска номера."],
  prices:["Цены на виду","Покажите цены на все услуги. Многие не пишут, если не видят стоимость сразу."],
  speed:["Быстрая загрузка","Лёгкая страница открывается за секунду даже через мобильный интернет. Медленный сайт закрывают, не дождавшись."]},
 bookT:["Запись на процедуры онлайн","Бронирование тура онлайн","Бронь байка или авто на даты","Заказ и бронь столика онлайн","Запись на приём онлайн","Запись или заказ онлайн"],
 langN:["английский","русский","тайский","китайский"],sep:", ",and:" и ",
 msgrOne:"Добавьте кнопку {x}.",msgrMany:"Добавьте кнопки {x}.",
 lossLabel:"Грубая оценка",loss:"Возможно, вы теряете <b>{r} {u}</b> в месяц.",rng:"-",
 lossLow:"Похоже, вы теряете совсем немного. Остались мелочи.",
 lossNote:"Это не прогноз. Считаю от типичного числа обращений для небольшого бизнеса вашего типа и от того, сколько людей уходит без цен, записи или нужного языка. Ваши цифры могут быть другими.",
 units:[["запись","записи","записей"],["бронирование","бронирования","бронирований"],["бронь","брони","броней"],["заказ","заказа","заказов"],["запись на приём","записи на приём","записей на приём"],["обращение","обращения","обращений"]],
 ctaH:"Получить бесплатный разбор",ctaP:"Пришлите ссылку на сайт или страницу. За один день я пришлю, что мешает клиентам, и набросок новой главной. Бесплатно и без обязательств.",
 tg:"Написать в Telegram",tgS:"@sandersax",tgHint:"Для Telegram итог копируется сам, останется вставить его в чат.",wa:"Написать в WhatsApp",waS:"Сообщение с итогом уже готово",em:"Написать на почту",
 copy:"Копировать",copied:"Готово",copiedNote:"Итог скопирован. Вставьте его в чат.",copyFail:"Не получилось скопировать. Выделите текст вручную.",
 offer:"Цены и работы",again:"Пройти заново",price:"Сайт от $300, с онлайн-записью от $600, поддержка $30 в месяц.",
 hello:"Здравствуйте, Александр!",resLine:"Результат проверки сайта: {s} из 100.",fixFirst:"Главное исправить:",want:"Хочу бесплатный разбор. Мой сайт или страница: ",subj:"Бесплатный разбор сайта, оценка {s} из 100"},
en:{qn:"Question {n} of {t}",word0:"your business",word:["your spa","your tour business","your rental","your cafe","your clinic","your business"],
 q:{
  biz:["What kind of business do you run?","The advice at the end depends on it.",["Spa and massage","Tours and trips","Bike and car rental","Cafe or restaurant","Clinic","Something else"]],
  site:["Do you have your own website?","A page with its own address, not only social media.",["Yes, my own site","Only Instagram or Facebook","Only a Google Maps listing","Nothing yet"]],
  mobile:["How does it look on a phone?","Open it on your phone if you are not sure.",["Easy to use, everything reads well","It works, but text is small or buttons are fiddly","Hard to use, people have to zoom","Not sure"]],
  book:["Can customers book or order online?","Without a call or a long chat.",["Yes, in a couple of taps","Through a form or email","Only by phone or message","No"]],
  langs:["Which languages does it show?","Pick all that apply.",["English","Russian","Thai","Chinese"]],
  maps:["Do you have a Google Maps listing with reviews?","And does your site link to it?",["Yes, and the site links to it","Yes, but it is not linked","No, or not sure"]],
  msgr:["Can customers message you in one tap?","Chat buttons on the page. Pick all that apply.",["LINE","WhatsApp","Telegram","No chat buttons"]],
  prices:["Are your prices visible?","Without having to message you first.",["Yes, for every service","Only some","No, people ask in chat"]],
  speed:["How fast does it open on mobile data?","Your gut feeling is enough.",["Straight away","A few seconds","Slow, people may give up","Not sure"]]},
 short:{biz:"Business",site:"Website",mobile:"On a phone",book:"Online booking",langs:"Languages",maps:"Google Maps",msgr:"Chat buttons",prices:"Prices",speed:"Speed"},
 notChecked:"no website of my own",
 verdict:[[80,"A strong site","The basics work. Fix a few details so customers do not go to competitors."],[60,"A good base","The site helps, but some customers drop off at the last step."],[40,"Some customers leave without booking","People find you, but many struggle to see a price or book."],[0,"The site brings you very few customers","Most visitors leave without messaging you."]],
 yours:"Your result",of:"out of 100",fixHead:"Fix these first",allGood:"Nothing serious stands out. A review can still find small details that bring in more requests.",
 fix:{site:["A simple site of your own","One fast page with services, prices and contact buttons. Easy to find on Google and easy to send to a customer."],
  mobile:["A phone friendly layout","Big text and buttons within thumb reach. Nearly every customer in Thailand sees your site on a phone."],
  book:["","Customers pick a service and a time themselves, and the request lands in your Telegram or LINE."],
  langs:["The languages your customers read","Add {x}. People message more readily when they can read in their own language."],
  maps:["Google Maps and reviews","Link your site to your Google Maps listing. Reviews and directions persuade faster than any text."],
  msgr:["Chat buttons","One tap and the customer is already writing to you, no hunting for a number."],
  prices:["Prices in plain sight","Show a price for every service. Many people never ask if they cannot see the cost straight away."],
  speed:["Fast loading","A light page opens in a second or two, even on mobile data. Slow sites get closed before they load."]},
 bookT:["Online booking for treatments","Online tour booking","Book a bike or car for set dates","Online orders and table booking","Online appointments","Online booking or ordering"],
 langN:["English","Russian","Thai","Chinese"],sep:", ",and:" and ",
 msgrOne:"Add a {x} button.",msgrMany:"Add {x} buttons.",
 lossLabel:"Rough estimate",loss:"You may be missing about <b>{r} {u}</b> a month.",rng:" to ",
 lossLow:"It looks like you are missing very little. Only small details are left.",
 lossNote:"Not a forecast. It starts from a typical number of enquiries for a small business like yours and the share of people who leave when they cannot see a price, a way to book or their language. Your real numbers may differ.",
 units:["bookings","bookings","bookings","orders","appointments","enquiries"],
 ctaH:"Get a free review",ctaP:"Send a link to your site or page. Within a day I will send what is getting in your customers' way and a sketch of a new home page. Free, with no obligation.",
 tg:"Message on Telegram",tgS:"@sandersax",tgHint:"For Telegram the summary is copied for you, just paste it into the chat.",wa:"Message on WhatsApp",waS:"Your summary is already in the message",em:"Send an email",
 copy:"Copy",copied:"Copied",copiedNote:"Summary copied. Paste it into the chat.",copyFail:"Copying did not work. Please select the text by hand.",
 offer:"See prices and work",again:"Start again",price:"Website from $300, with online booking from $600, support $30 a month.",
 hello:"Hello Alexandr,",resLine:"My website check result: {s} out of 100.",fixFirst:"Fix first:",want:"I would like a free review. My site or page: ",subj:"Free website review, score {s} out of 100"},
th:{qn:"ข้อ {n} จาก {t}",word0:"ธุรกิจของคุณ",word:["ร้านสปา","ธุรกิจทัวร์","ร้านเช่ารถ","คาเฟ่และร้านอาหาร","คลินิก","ธุรกิจของคุณ"],
 q:{
  biz:["ธุรกิจของคุณคืออะไร","คำแนะนำตอนจบจะปรับตามประเภทธุรกิจ",["สปาและนวด","ทัวร์และทริป","เช่ารถและมอเตอร์ไซค์","คาเฟ่และร้านอาหาร","คลินิก","อื่นๆ"]],
  site:["มีเว็บไซต์ของตัวเองไหม","หมายถึงเว็บที่มีที่อยู่ของตัวเอง ไม่ใช่แค่โซเชียล",["มี เป็นเว็บไซต์ของตัวเอง","มีแค่ Instagram หรือ Facebook","มีแค่หน้าร้านใน Google Maps","ยังไม่มีเลย"]],
  mobile:["เปิดเว็บบนมือถือแล้วเป็นอย่างไร","ถ้าไม่แน่ใจ ลองเปิดดูบนมือถือ",["ใช้ง่าย อ่านได้สบาย","พอใช้ได้ แต่ตัวเล็กหรือกดยาก","ใช้ยาก ต้องซูมดู","ไม่แน่ใจ"]],
  book:["ลูกค้าจองหรือสั่งออนไลน์ได้ไหม","โดยไม่ต้องโทรหรือแชทกันนาน",["ได้ แตะไม่กี่ครั้ง","ผ่านฟอร์มหรืออีเมล","ต้องโทรหรือส่งข้อความเท่านั้น","ไม่ได้"]],
  langs:["เว็บมีข้อมูลภาษาอะไรบ้าง","เลือกได้หลายข้อ",["อังกฤษ","รัสเซีย","ไทย","จีน"]],
  maps:["มีหน้าร้านใน Google Maps พร้อมรีวิวไหม","และเว็บมีลิงก์ไปหน้านั้นหรือเปล่า",["มี และเว็บลิงก์ไปที่นั่น","มี แต่ไม่ได้เชื่อมกับเว็บ","ไม่มี หรือไม่แน่ใจ"]],
  msgr:["ลูกค้าแตะครั้งเดียวแล้วทักคุณได้ไหม","ปุ่มแชทบนหน้าเว็บ เลือกได้หลายข้อ",["LINE","WhatsApp","Telegram","ไม่มีปุ่มแชท"]],
  prices:["ลูกค้าเห็นราคาไหม","โดยไม่ต้องทักมาถาม",["เห็น ครบทุกบริการ","เห็นแค่บางส่วน","ไม่เห็น ต้องทักมาถาม"]],
  speed:["เว็บเปิดเร็วแค่ไหนเมื่อใช้เน็ตมือถือ","ตามความรู้สึกก็พอ ไม่ต้องวัด",["เปิดขึ้นทันที","รอไม่กี่วินาที","ช้า ลูกค้าอาจรอไม่ไหว","ไม่แน่ใจ"]]},
 short:{biz:"ธุรกิจ",site:"เว็บไซต์",mobile:"บนมือถือ",book:"จองออนไลน์",langs:"ภาษา",maps:"Google Maps",msgr:"ปุ่มแชท",prices:"ราคา",speed:"ความเร็ว"},
 notChecked:"ไม่มีเว็บไซต์ของตัวเอง",
 verdict:[[80,"เว็บไซต์แข็งแรง","เรื่องหลักทำงานได้ดีแล้ว เหลือแค่เก็บรายละเอียดไม่ให้ลูกค้าไปหาร้านอื่น"],[60,"พื้นฐานดี","เว็บช่วยได้ แต่ลูกค้าบางส่วนหลุดไปในขั้นตอนสุดท้าย"],[40,"ลูกค้าบางส่วนออกไปโดยไม่จอง","ลูกค้าหาคุณเจอ แต่หลายคนดูราคาหรือจองได้ไม่สะดวก"],[0,"เว็บแทบไม่ได้ช่วยหาลูกค้า","ลูกค้าส่วนใหญ่ออกไปก่อนจะได้ทักหาคุณ"]],
 yours:"ผลของคุณ",of:"จาก 100",fixHead:"ควรแก้อะไรก่อน",allGood:"ไม่พบปัญหาใหญ่ ในการรีวิวอาจเจอรายละเอียดเล็กๆ ที่ช่วยให้ได้ลูกค้าเพิ่ม",
 fix:{site:["มีเว็บไซต์ง่ายๆ ของตัวเอง","หน้าเดียวที่โหลดเร็ว มีบริการ ราคา และปุ่มติดต่อ ค้นเจอใน Google และส่งให้ลูกค้าได้ง่าย"],
  mobile:["ใช้งานบนมือถือได้สะดวก","ตัวหนังสือใหญ่ ปุ่มกดง่าย ลูกค้าในไทยเกือบทั้งหมดเปิดเว็บจากมือถือ"],
  book:["","ลูกค้าเลือกบริการและเวลาได้เอง คำขอส่งเข้า Telegram หรือ LINE ของคุณทันที"],
  langs:["ภาษาที่ลูกค้าใช้","เพิ่มภาษา{x} ลูกค้ากล้าทักมากขึ้นเมื่ออ่านภาษาของตัวเองได้"],
  maps:["Google Maps และรีวิว","เชื่อมเว็บกับหน้าร้านใน Google Maps รีวิวและเส้นทางช่วยให้ลูกค้าตัดสินใจเร็วกว่าข้อความใดๆ"],
  msgr:["ปุ่มแชท","แตะครั้งเดียวลูกค้าก็ทักหาคุณได้ ไม่ต้องหาเบอร์"],
  prices:["แสดงราคาให้ชัด","ใส่ราคาทุกบริการ หลายคนไม่ทักมาถามถ้าไม่เห็นราคาตั้งแต่แรก"],
  speed:["โหลดเร็ว","หน้าเว็บที่เบาเปิดได้ในไม่กี่วินาทีแม้ใช้เน็ตมือถือ เว็บที่ช้ามักถูกปิดก่อนโหลดเสร็จ"]},
 bookT:["จองบริการสปาออนไลน์","จองทัวร์ออนไลน์","จองรถล่วงหน้าตามวันที่","สั่งอาหารและจองโต๊ะออนไลน์","นัดหมายออนไลน์","จองหรือสั่งออนไลน์"],
 langN:["อังกฤษ","รัสเซีย","ไทย","จีน"],sep:" ",and:" และ",
 msgrOne:"เพิ่มปุ่ม {x}",msgrMany:"เพิ่มปุ่ม {x}",
 lossLabel:"ประมาณการคร่าวๆ",loss:"คุณอาจพลาด{u}ประมาณ <b>{r} {c}</b>ต่อเดือน",rng:"-",
 lossLow:"ดูเหมือนคุณแทบไม่เสียลูกค้าเลย เหลือแค่รายละเอียดเล็กๆ",
 lossNote:"นี่ไม่ใช่การพยากรณ์ คิดจากจำนวนการติดต่อโดยเฉลี่ยของธุรกิจขนาดเล็กประเภทนี้ และสัดส่วนคนที่ออกไปเมื่อไม่เห็นราคา จองไม่ได้ หรือไม่มีภาษาที่ต้องการ ตัวเลขจริงของคุณอาจต่างออกไป",
 units:[["การจอง","ครั้ง"],["การจองทัวร์","ครั้ง"],["การจองรถ","ครั้ง"],["ออเดอร์","รายการ"],["การนัดหมาย","ครั้ง"],["การติดต่อ","ครั้ง"]],
 ctaH:"รับรีวิวเว็บไซต์ฟรี",ctaP:"ส่งลิงก์เว็บหรือเพจมา ภายในหนึ่งวันผมจะส่งสิ่งที่ทำให้ลูกค้าหลุด พร้อมร่างหน้าแรกใหม่ให้ ฟรีและไม่มีข้อผูกมัด",
 tg:"ทักทาง Telegram",tgS:"@sandersax",tgHint:"สำหรับ Telegram ระบบจะคัดลอกสรุปให้ แค่วางลงในแชท",wa:"ทักทาง WhatsApp",waS:"มีข้อความสรุปเตรียมไว้แล้ว",em:"ส่งอีเมล",
 copy:"คัดลอก",copied:"คัดลอกแล้ว",copiedNote:"คัดลอกสรุปแล้ว วางในแชทได้เลย",copyFail:"คัดลอกไม่สำเร็จ ลองเลือกข้อความเอง",
 offer:"ดูราคาและผลงาน",again:"เช็กใหม่อีกครั้ง",price:"เว็บไซต์เริ่มต้น $300 พร้อมระบบจองเริ่มต้น $600 ดูแลรายเดือน $30",
 hello:"สวัสดี คุณ Alexandr",resLine:"ผลเช็กเว็บไซต์: {s} จาก 100",fixFirst:"ควรแก้ก่อน:",want:"อยากได้รีวิวเว็บไซต์ฟรี ลิงก์เว็บหรือเพจ: ",subj:"ขอรีวิวเว็บไซต์ฟรี คะแนน {s} จาก 100"}
};

var U={
ru:{kick:"Бесплатно · 2 минуты · без регистрации",hA:"Проверьте свой сайт",hB:"за две минуты",
 p:"Ответьте на несколько вопросов о сайте. В конце будет оценка из 100 и три главных исправления.",
 sigS:"Пришлите ссылку, и я разберу ваш сайт лично.",rep:"Отчёт о проверке сайта",fBiz:"Бизнес",fDate:"Дата",blank:"по вашим ответам",
 sH:"Как ваш сайт работает на клиентов?",sP:"Короткие вопросы, ответ одним нажатием.",
 pts:["Оценка из 100 и баллы по частям сайта","Три главных исправления для вашего бизнеса","Примерно, сколько заявок уходит"],
 go:"Начать проверку",sN:"Ответы никуда не отправляются.",back:"Назад",next:"Дальше",areas:"Баллы по частям сайта",
 signedBy:"Проверил",signedSub:"SanderSax · сайты для бизнеса",offerHere:"Смотреть цены",
 fQ:"Вопросов",qRange:"7-9",bands:["Почти не работает","Теряет клиентов","Хорошая основа","Сильный сайт"],
 tip:"Клавиши 1-9 выбирают ответ",pts1:["балл","балла","баллов"],planHint:"Включайте и выключайте исправления, чтобы увидеть, сколько баллов они добавят.",
 planWith:"С включёнными исправлениями: <b>{p} из 100</b>",planNone:"Ни одно исправление не включено.",planLine:"С этими исправлениями: {p} из 100."},
en:{kick:"Free · 2 minutes · no sign up",hA:"Check your website",hB:"in two minutes",
 p:"Answer a few questions about your site. You get a score out of 100 and the three fixes that matter most.",
 sigS:"Send me a link and I will review your site myself.",rep:"Website check report",fBiz:"Business",fDate:"Date",blank:"from your answers",
 sH:"How well does your site work for customers?",sP:"Short questions, one tap each.",
 pts:["A score out of 100, with points for each part","The three fixes that matter most for you","A rough count of the bookings you may be missing"],
 go:"Start the check",sN:"Your answers are not sent anywhere.",back:"Back",next:"Next",areas:"Points by area",
 signedBy:"Checked by",signedSub:"SanderSax · websites for businesses",offerHere:"See prices",
 fQ:"Questions",qRange:"7-9",bands:["Barely working","Losing customers","A good base","Strong"],
 tip:"Keys 1-9 pick an answer",pts1:["point","points","points"],planHint:"Switch fixes on or off to see the points each one adds.",
 planWith:"With the fixes switched on: <b>{p} out of 100</b>",planNone:"No fixes switched on.",planLine:"With these fixes: {p} out of 100."},
th:{kick:"ฟรี · 2 นาที · ไม่ต้องสมัคร",hA:"เช็กเว็บไซต์ของคุณ",hB:"ใน 2 นาที",
 p:"ตอบคำถามสั้นๆ เกี่ยวกับเว็บไซต์ของคุณ แล้วรับคะแนนเต็ม 100 พร้อมสามเรื่องที่ควรแก้ก่อน",
 sigS:"ส่งลิงก์มา ผมจะดูเว็บไซต์ของคุณเอง",rep:"รายงานเช็กเว็บไซต์",fBiz:"ธุรกิจ",fDate:"วันที่",blank:"ตามคำตอบของคุณ",
 sH:"เว็บไซต์ของคุณช่วยหาลูกค้าได้ดีแค่ไหน",sP:"คำถามสั้นๆ ตอบด้วยการแตะครั้งเดียว",
 pts:["คะแนนเต็ม 100 พร้อมคะแนนแต่ละส่วน","3 เรื่องที่ควรแก้ก่อนสำหรับธุรกิจของคุณ","ประมาณการลูกค้าที่อาจหลุดไป"],
 go:"เริ่มเช็กเลย",sN:"คำตอบของคุณไม่ถูกส่งไปที่ไหน",back:"ย้อนกลับ",next:"ถัดไป",areas:"คะแนนแต่ละส่วน",
 signedBy:"ตรวจโดย",signedSub:"SanderSax · เว็บไซต์สำหรับธุรกิจ",offerHere:"ดูราคา",
 fQ:"คำถาม",qRange:"7-9",bands:["แทบไม่ช่วย","ลูกค้าหลุด","พื้นฐานดี","แข็งแรง"],
 tip:"กดปุ่ม 1-9 เพื่อเลือกคำตอบ",pts1:["คะแนน","คะแนน","คะแนน"],planHint:"เปิดหรือปิดแต่ละข้อ เพื่อดูว่าเพิ่มคะแนนได้เท่าไร",
 planWith:"ถ้าแก้ข้อที่เปิดไว้: <b>{p} จาก 100</b>",planNone:"ยังไม่ได้เปิดข้อไหน",planLine:"ถ้าแก้ตามนี้: {p} จาก 100"}
};

var AR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
var BK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
var IC={
 tg:'<svg viewBox="0 0 24 24"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l12-9"/></svg>',
 wa:'<svg viewBox="0 0 24 24"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.5z"/><path d="M9 8.6c0 3.5 2.8 6.4 6.4 6.4l1.1-1.6-2-1-1 .8a4.6 4.6 0 0 1-2.7-2.7l.8-1-1-2z"/></svg>',
 em:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
 cp:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
 ag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
 ck:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};

var CK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
/* which report rows a finding lifts */
var LIFT={site:["site","mobile","speed"]};
/* the gauge: 200 x 200, the arc starts at twelve o'clock */
var GR=78;
function gpos(p){var a=(p/100)*Math.PI*2-Math.PI/2;return [100+Math.cos(a)*GR,100+Math.sin(a)*GR]}
function gauge(id){
  var t="";
  for(var i=0;i<50;i++){var v=i*2,mj=v===0||v===40||v===60||v===80,a=(v/100)*Math.PI*2-Math.PI/2,r1=mj?92:94,r2=mj?101:98;
    t+='<line class="tk'+(mj?" mj":"")+'" x1="'+(100+Math.cos(a)*r1).toFixed(1)+'" y1="'+(100+Math.sin(a)*r1).toFixed(1)+'" x2="'+(100+Math.cos(a)*r2).toFixed(1)+'" y2="'+(100+Math.sin(a)*r2).toFixed(1)+'"/>'}
  var c=' cx="100" cy="100" r="'+GR+'" pathLength="100" stroke-dasharray="100 100" transform="rotate(-90 100 100)"';
  return '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="'+id+'-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f7a52"/><stop offset="1" stop-color="#0e4d36"/></linearGradient></defs>'+t+
   '<circle class="tr" cx="100" cy="100" r="'+GR+'"/><circle class="gh" data-gh'+c+' stroke-dashoffset="100"/><circle class="ar" data-ar'+c+' stroke="url(#'+id+'-g)" stroke-dashoffset="100"/>'+
   '<circle class="cap" data-cap cx="100" cy="'+(100-GR)+'" r="7"/></svg>';
}
function band(n){return n>=80?3:n>=60?2:n>=40?1:0}

function fmt(s,o){return s.replace(/\{(\w+)\}/g,function(m,k){return o[k]!=null?o[k]:m})}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function plural(n,f){var m=n%10,h=n%100;if(m===1&&h!==11)return f[0];if(m>=2&&m<=4&&(h<12||h>14))return f[1];return f[2]}
function pageLang(){var l=(document.documentElement.lang||"ru").slice(0,2);return L[l]?l:"ru"}
/* a frame, or a short timer when frames are paused (background tab) */
function frame(cb){var fired=false;function run(){if(!fired){fired=true;cb(performance.now())}}requestAnimationFrame(run);setTimeout(run,40)}

var uid=0;
function mount(root){
  var id="sc"+(++uid),lang=pageLang(),ans={},step=-1,view="start",lock=false,R=null,plan=null,P=new URLSearchParams(location.search);
  var offerHref=root.getAttribute("data-offer")||"../thailand/",here=root.hasAttribute("data-here");
  root.classList.add("sc");
  root.innerHTML=
   '<div class="sc-aside">'+
    '<span class="sc-kick">'+IC.ck+'<span data-u="kick"></span></span>'+
    '<h2 class="sc-h" id="'+id+'-h"><span data-u="hA"></span> <em data-u="hB"></em></h2>'+
    '<p class="sc-p" data-u="p"></p>'+
    '<ul class="sc-key" aria-hidden="true">'+["0-39","40-59","60-79","80-100"].map(function(r,i){return '<li style="--c:'+["#f4b6c9","#d3e4da","#8fc2a6","#2f8a5f"][i]+'"><b>'+r+'</b><span data-band="'+i+'"></span></li>'}).join("")+'</ul>'+
    '<div class="sc-sig"><i class="sc-mk" aria-hidden="true"></i><div><b>Alexandr Khrustalev</b><small data-u="sigS"></small></div></div>'+
   '</div>'+
   '<div class="sc-sheet" tabindex="-1" role="region" aria-labelledby="'+id+'-h">'+
    '<div class="sc-top"><span class="sc-brand"><i class="sc-mk" aria-hidden="true"></i>[SANDERSAX]</span><small data-u="rep"></small></div>'+
    '<div class="sc-view" data-v="start">'+
      '<div class="sc-meta"><div><span data-u="fBiz"></span><b class="blank" data-biz></b></div><div><span data-u="fDate"></span><b data-date></b></div><div><span data-u="fQ"></span><b class="num" data-u="qRange"></b></div></div>'+
      '<h3 class="sc-st-h" data-u="sH"></h3><p class="sc-st-p" data-u="sP"></p>'+
      '<ul class="sc-pts">'+[0,1,2].map(function(i){return '<li><span>0'+(i+1)+'</span><span data-p="'+i+'"></span></li>'}).join("")+'</ul>'+
      '<button class="sc-go" type="button" data-go><span data-u="go"></span>'+AR+'</button>'+
      '<p class="sc-note" data-u="sN"></p>'+
    '</div>'+
    '<div class="sc-view" data-v="q" hidden>'+
      '<div class="sc-steps"><span class="sc-qn"></span><span class="sc-bar" aria-hidden="true"></span></div>'+
      '<div class="sc-qb"><div class="sc-qtop"><h3 class="sc-qt" id="'+id+'-q" tabindex="-1"></h3><p class="sc-qh"></p></div><div class="sc-opts" role="group" aria-labelledby="'+id+'-q"></div></div>'+
      '<div class="sc-foot"><button class="sc-back" type="button" data-back>'+BK+'<span data-u="back"></span></button><span class="sc-tip" data-u="tip" aria-hidden="true"></span><button class="sc-next hide" type="button" data-next disabled><span data-u="next"></span>'+AR+'</button></div>'+
    '</div>'+
    '<div class="sc-view" data-v="res" hidden></div>'+
    '<p class="sr" aria-live="polite" data-live></p>'+
   '</div>';
  function $(s){return root.querySelector(s)}
  var sheet=$(".sc-sheet"),qb=$(".sc-qb"),opts=$(".sc-opts"),nx=$("[data-next]"),live=$("[data-live]");

  function active(){return Q.filter(function(q){return !q.own||ans.site==null||ans.site===0})}
  function today(){var s=new Intl.DateTimeFormat(LOC[lang],{day:"numeric",month:"long",year:"numeric"}).format(new Date());return s.replace(/\s*г\.$/,"")}
  function join(list){var d=L[lang];if(list.length<2)return list.join("");var last=list[list.length-1],a=d.and;if(lang==="th"&&/^[A-Za-z]/.test(last))a+=" ";return list.slice(0,-1).join(d.sep)+a+last}

  function show(v,anim){view=v;["start","q","res"].forEach(function(k){$('[data-v="'+k+'"]').hidden=k!==v});var el=$('[data-v="'+v+'"]');el.classList.remove("in");if(anim&&!reduce){void el.offsetWidth;el.classList.add("in")}}
  /* keep the top of the sheet on screen, so the next question is never below the fold */
  function keepInView(){var t=sheet.getBoundingClientRect().top;if(t<0||t>innerHeight*.35)sheet.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"})}

  /* questions */
  function renderQ(){
    var A=active(),q=A[step],d=L[lang].q[q.id],sel=ans[q.id];
    $(".sc-qn").textContent=fmt(L[lang].qn,{n:step+1,t:A.length});
    $(".sc-bar").innerHTML=A.map(function(x,i){return '<i class="'+(i<step?"done":i===step?"now":"")+'"></i>'}).join("");
    $(".sc-qt").textContent=d[0];$(".sc-qh").textContent=d[1];
    opts.innerHTML="";
    d[2].forEach(function(lb,i){
      var b=document.createElement("button"),on=q.many?(sel||[]).indexOf(i)>=0:sel===i;
      b.type="button";b.className="sc-op";b.setAttribute("aria-pressed",String(on));
      var h='<span class="sc-k" aria-hidden="true">'+(i+1)+'</span><span class="sc-l">'+esc(lb)+"</span>";
      if(q.id==="langs")h+='<em class="sc-cd" aria-hidden="true">'+LCODE[i]+"</em>";
      if(q.many)h+='<i class="sc-bx" aria-hidden="true">'+CK+'</i>';
      b.innerHTML=h;b.addEventListener("click",function(){pick(q,i)});opts.appendChild(b);
    });
    nx.classList.toggle("hide",!q.many);nx.disabled=!(q.many&&sel&&sel.length);
    live.textContent=$(".sc-qn").textContent+". "+d[0];
  }
  function pressAll(q){var sel=ans[q.id];[].forEach.call(opts.children,function(b,j){b.setAttribute("aria-pressed",String(q.many?(sel||[]).indexOf(j)>=0:sel===j))})}
  function pick(q,i){
    if(lock)return;
    if(q.many){
      var arr=(ans[q.id]||[]).slice(),at=arr.indexOf(i);
      if(at>=0)arr.splice(at,1);
      else{if(q.none!=null){if(i===q.none)arr=[];else arr=arr.filter(function(x){return x!==q.none})}arr.push(i)}
      ans[q.id]=arr;pressAll(q);nx.disabled=!arr.length;return;
    }
    ans[q.id]=i;pressAll(q);
    if(q.id==="biz")setBiz();
    if(q.id==="site"){if(i!==0){delete ans.mobile;delete ans.speed}$(".sc-qn").textContent=fmt(L[lang].qn,{n:step+1,t:active().length});
      $(".sc-bar").innerHTML=active().map(function(x,k){return '<i class="'+(k<step?"done":k===step?"now":"")+'"></i>'}).join("")}
    lock=true;setTimeout(function(){lock=false;go(1)},reduce?120:520);
  }
  function go(dir){
    step+=dir;
    if(step<0){step=-1;show("start",true);return}
    if(step>=active().length){showResult(true);return}
    if(view!=="q"){show("q",true);renderQ();focusQ();keepInView();return}
    if(reduce){renderQ();focusQ();return}
    qb.className="sc-qb out"+(dir<0?" rev":"");
    setTimeout(function(){renderQ();qb.className="sc-qb "+(dir<0?"inL":"inR");focusQ();keepInView()},140);
  }
  function focusQ(){try{$(".sc-qt").focus({preventScroll:true})}catch(e){}}
  function setBiz(){var f=$("[data-biz]");if(ans.biz==null){f.className="blank";f.textContent=U[lang].blank}else{f.className="";f.textContent=L[lang].q.biz[2][ans.biz]}}

  /* scoring */
  function compute(){
    var a=ans,own=a.site===0,s={},w=W[BIZ[a.biz||0]];
    s.site=PTS.site[a.site||0];
    s.mobile=own?PTS.mobile[a.mobile!=null?a.mobile:3]:NOS.mobile[a.site];
    s.speed=own?PTS.speed[a.speed!=null?a.speed:3]:NOS.speed[a.site];
    s.book=PTS.book[a.book!=null?a.book:3];s.maps=PTS.maps[a.maps!=null?a.maps:2];s.prices=PTS.prices[a.prices!=null?a.prices:2];
    s.langs=(a.langs||[]).reduce(function(t,i){return t+LANGP[i]},0);
    s.msgr=(a.msgr||[]).reduce(function(t,i){return t+(i<3?MSGP[i]:0)},0);
    var total=0;for(var k in s)total+=s[k];total=Math.max(0,Math.min(100,total));
    var keys=own?["mobile","book","langs","maps","msgr","prices","speed"]:["site","book","langs","maps","msgr","prices"];
    var fixes=keys.map(function(k){var g=k==="site"?(MAX.site-s.site)+(MAX.mobile-s.mobile)+(MAX.speed-s.speed):MAX[k]-s[k];return {k:k,g:g,r:g*(k==="site"?1.5:(w[k]||1))}})
      .filter(function(f){return f.g>0}).sort(function(x,y){return y.r-x.r}).slice(0,3);
    return {total:total,fixes:fixes,s:s};
  }
  function fixTitle(k){var d=L[lang];return k==="book"?d.bookT[ans.biz||0]:d.fix[k][0]}
  function fixBody(k){
    var d=L[lang],f=d.fix[k];
    if(k==="langs"){var miss=[0,1,2,3].filter(function(i){return (ans.langs||[]).indexOf(i)<0}).map(function(i){return d.langN[i]});return fmt(f[1],{x:join(miss)})}
    if(k==="msgr"){var mm=[0,1,2].filter(function(i){return (ans.msgr||[]).indexOf(i)<0}).map(function(i){return MNAME[i]});return fmt(mm.length>1?d.msgrMany:d.msgrOne,{x:join(mm)})+" "+f[1]}
    return f[1];
  }
  function verdict(n){var v=L[lang].verdict;for(var i=0;i<v.length;i++)if(n>=v[i][0])return v[i];return v[v.length-1]}
  function lossHTML(total){
    var d=L[lang],i=ans.biz||0,x=BASE[i]*(100-total)/100*.3,hi=Math.round(x),lo=Math.max(1,Math.round(x*.5));
    if(hi<2)return esc(d.lossLow);
    var r=lo===hi?String(hi):lo+d.rng+hi;
    if(lang==="ru")return fmt(d.loss,{r:r,u:esc(plural(hi,d.units[i]))});
    if(lang==="en")return fmt(d.loss,{r:r,u:esc(d.units[i])});
    return fmt(d.loss,{r:r,u:esc(d.units[i][0]),c:esc(d.units[i][1])});
  }
  function chosen(){return R.fixes.filter(function(f){return plan[f.k]})}
  function projected(){return Math.min(100,R.total+chosen().reduce(function(t,f){return t+f.g},0))}
  function summary(){
    var d=L[lang],lines=[d.hello,fmt(d.resLine,{s:R.total}),""],ch=chosen();
    Q.forEach(function(q){var v=ans[q.id],lb=d.q[q.id][2],t;
      if(v==null||(Array.isArray(v)&&!v.length))t=q.own?d.notChecked:"-";
      else t=Array.isArray(v)?v.map(function(i){return lb[i]}).join(", "):lb[v];
      lines.push(d.short[q.id]+": "+t)});
    if(ch.length){lines.push("");lines.push(d.fixFirst);ch.forEach(function(f,j){lines.push((j+1)+". "+fixTitle(f.k)+" (+"+f.g+")")});lines.push(fmt(U[lang].planLine,{s:R.total,p:projected()}))}
    lines.push("");lines.push(d.want);
    return lines.join("\n");
  }
  function ptsWord(n){var p=U[lang].pts1;return lang==="ru"?plural(n,p):(n===1?p[0]:p[1])}

  function showResult(anim){
    var d=L[lang],u=U[lang],v,el=$('[data-v="res"]'),keep=plan;
    R=compute();v=verdict(R.total);
    plan={};R.fixes.forEach(function(f){plan[f.k]=keep&&keep[f.k]!=null?keep[f.k]:true});
    var bi=band(R.total),cls=bi===0?" lo":bi===3?" hi":"";
    var fx=R.fixes.length?R.fixes.map(function(f,j){return '<li><button class="sc-fi" type="button" data-k="'+f.k+'" aria-pressed="'+plan[f.k]+'"><span class="ix" aria-hidden="true">'+(j+1)+'</span><span><b>'+esc(fixTitle(f.k))+'</b><p>'+esc(fixBody(f.k))+'</p></span><span class="gn"><strong>+'+f.g+'</strong><small>'+esc(ptsWord(f.g))+'</small><i class="sw" aria-hidden="true"></i></span></button></li>'}).join(""):'<li><span class="sc-ok">'+esc(d.allGood)+"</span></li>";
    var ar=AREAS.map(function(k){var got=R.s[k],r=got/MAX[k];return '<li data-a="'+k+'" class="'+(r>=1?"full":r<.34?"low":"")+'"><span>'+esc(d.short[k])+'</span><span class="pt">'+got+'<small> / '+MAX[k]+'</small></span><span class="mt" aria-hidden="true"><i style="--w:'+Math.round(r*100)+'%"></i></span></li>'}).join("");
    var tg="https://t.me/"+CONTACT.telegram;
    el.innerHTML='<div class="sc-rise">'+
      '<div class="sc-meta"><div><span>'+esc(u.fBiz)+'</span><b>'+esc(d.q.biz[2][ans.biz||0])+'</b></div><div><span>'+esc(u.fDate)+'</span><b>'+esc(today())+'</b></div><div><span>'+esc(u.fQ)+'</span><b class="num">'+active().length+'</b></div></div>'+
      '<div class="sc-score"><div class="sc-g">'+gauge(id)+'<div class="sc-gc"><b data-num>0</b><small>'+esc(d.of)+'</small><span class="to" data-to></span></div></div>'+
        '<div class="sc-verd"><span class="sc-band'+cls+'">'+esc(u.bands[bi])+'</span><h3 tabindex="-1" data-rh>'+esc(v[1])+'</h3><p>'+esc(v[2])+'</p>'+
        '<div class="sc-scale" aria-hidden="true"><span class="mk" data-mk style="left:0"></span><span class="pk" data-pk style="left:0"></span><div class="seg">'+[0,1,2,3].map(function(i){return '<i class="'+(i===bi?"at"+cls:"")+'"></i>'}).join("")+'</div><div class="lb"><span>0</span><span>40</span><span>60</span><span>80</span></div></div></div></div>'+
      '<div><p class="sc-lab"><span>'+esc(d.fixHead)+'</span></p><ol class="sc-fx">'+fx+'</ol>'+(R.fixes.length?'<p class="sc-plan" data-plan aria-live="polite"></p>':'')+'</div>'+
      '<div><p class="sc-lab"><span>'+esc(u.areas)+'</span><em class="num">'+R.total+' / 100</em></p><ul class="sc-areas">'+ar+'</ul></div>'+
      '<div class="sc-loss"><p class="sc-lab">'+esc(d.lossLabel)+'</p><p>'+lossHTML(R.total)+'</p><small>'+esc(d.lossNote)+'</small></div>'+
      '<div class="sc-signed"><div><i class="sc-mk" aria-hidden="true"></i><span><small>'+esc(u.signedBy)+'</small><b>Alexandr Khrustalev</b><small>'+esc(u.signedSub)+'</small></span></div><time>'+esc(today())+'</time></div>'+
      '<div class="sc-cta"><h3>'+esc(d.ctaH)+'</h3><p>'+esc(d.ctaP)+'</p>'+
        '<div class="sc-chs">'+
          '<div class="sc-row"><a class="sc-ch tg prim" data-tg href="'+tg+'" target="_blank" rel="noopener"><i class="sc-ic" aria-hidden="true">'+IC.tg+'</i><span><b>'+esc(d.tg)+'</b><small>'+esc(d.tgS)+'</small></span></a>'+
            '<button class="sc-cp" type="button" data-cp title="'+esc(d.copy)+'">'+IC.cp+'<span data-cpt>'+esc(d.copy)+'</span></button></div>'+
          '<a class="sc-ch wa" data-wa target="_blank" rel="noopener"><i class="sc-ic" aria-hidden="true">'+IC.wa+'</i><span><b>'+esc(d.wa)+'</b><small>'+esc(d.waS)+'</small></span></a>'+
          '<a class="sc-ch em" data-em><i class="sc-ic" aria-hidden="true">'+IC.em+'</i><span><b>'+esc(d.em)+'</b><small>'+esc(CONTACT.email)+'</small></span></a>'+
        '</div><p class="sc-cnote" data-cnote aria-live="polite">'+esc(d.tgHint)+'</p>'+
        '<div class="sc-more"><a href="'+esc(offerHref)+'">'+esc(here?u.offerHere:d.offer)+' →</a><button class="sc-again" type="button" data-again>'+IC.ag+esc(d.again)+'</button></div>'+
        '<p class="sc-price">'+esc(d.price)+'</p></div>'+
    '</div>';
    if(!anim)el.firstChild.classList.remove("sc-rise");
    show("res",false);
    [].forEach.call(el.querySelectorAll(".sc-fi"),function(b){
      var k=b.getAttribute("data-k");
      b.addEventListener("click",function(){plan[k]=!plan[k];b.setAttribute("aria-pressed",String(plan[k]));update(true)});
      function hit(on){(LIFT[k]||[k]).forEach(function(a){var li=el.querySelector('[data-a="'+a+'"]');if(li)li.classList.toggle("hit",on)})}
      b.addEventListener("mouseenter",function(){hit(true)});b.addEventListener("mouseleave",function(){hit(false)});
      b.addEventListener("focus",function(){hit(true)});b.addEventListener("blur",function(){hit(false)});
    });
    $("[data-cp]").addEventListener("click",function(){copy(summary(),true)});
    $("[data-tg]").addEventListener("click",function(){copy(summary(),false)});
    $("[data-again]").addEventListener("click",restart);
    live.textContent=d.yours+": "+R.total+" "+d.of+". "+v[1];
    update(false);
    var num=$("[data-num]");
    if(anim){keepInView();try{$("[data-rh]").focus({preventScroll:true})}catch(e){}
      setTimeout(function(){fill(R.total,true)},reduce?0:380)}
    else fill(R.total,false);
  }
  /* projected score, plan line and message links follow the switched-on fixes */
  function update(soft){
    if(!R)return;
    var u=U[lang],p=projected(),txt=summary(),gh=$("[data-gh]"),to=$("[data-to]"),pl=$("[data-plan]"),pk=$("[data-pk]");
    if(gh)gh.setAttribute("stroke-dashoffset",String(100-p));
    if(to){to.textContent=p>R.total?"→ "+p:"";to.classList.toggle("on",p>R.total)}
    if(pk){pk.style.left=p+"%";pk.style.opacity=p>R.total?"":"0"}
    if(pl)pl.innerHTML=(chosen().length?fmt(u.planWith,{p:p}):esc(u.planNone))+'<span>'+esc(u.planHint)+'</span>';
    var d=L[lang];
    $("[data-wa]").href="https://wa.me/"+CONTACT.whatsapp+"?text="+encodeURIComponent(txt);
    $("[data-em]").href="mailto:"+CONTACT.email+"?subject="+encodeURIComponent(fmt(d.subj,{s:R.total}))+"&body="+encodeURIComponent(txt);
  }
  /* the arc, its cap and the number move together */
  function fill(n,anim){
    var num=$("[data-num]"),ar=$("[data-ar]"),cap=$("[data-cap]"),mk=$("[data-mk]"),lo=band(n)===0,areas=$(".sc-areas");
    if(ar)ar.classList.toggle("lo",lo);if(cap)cap.classList.toggle("lo",lo);
    function at(v){num.textContent=Math.round(v);ar.setAttribute("stroke-dashoffset",String(100-v));var q=gpos(v);cap.setAttribute("cx",q[0].toFixed(1));cap.setAttribute("cy",q[1].toFixed(1));mk.style.left=v+"%"}
    if(!anim||reduce){at(n);if(areas)areas.classList.add("on");return}
    var t0=null,D=1200;
    function f(t){if(!num.isConnected)return;if(t0==null)t0=t;var p=Math.min(1,(t-t0)/D);at(n*(1-Math.pow(1-p,3)));if(p<1)frame(f)}
    frame(f);setTimeout(function(){if(areas&&areas.isConnected)areas.classList.add("on")},500);
  }
  function copy(text,flag){
    var d=L[lang];
    function ok(){var c=$("[data-cnote]");if(c){c.textContent=d.copiedNote;c.classList.add("ok")}if(flag){var b=$("[data-cp]"),t=$("[data-cpt]");if(b){b.classList.add("ok");t.textContent=d.copied;setTimeout(function(){if(b.isConnected){b.classList.remove("ok");t.textContent=L[lang].copy}},2200)}}}
    function fail(){var c=$("[data-cnote]");if(flag&&c)c.textContent=d.copyFail}
    function fb(){try{var ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();var r=document.execCommand("copy");ta.remove();if(r)ok();else fail()}catch(e){fail()}}
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(ok,fb);else fb();
  }
  function restart(){ans={};step=-1;R=null;plan=null;lock=false;setBiz();show("start",true);try{sheet.focus({preventScroll:true})}catch(e){}keepInView()}

  function setLang(l){
    lang=l;var u=U[l];
    [].forEach.call(root.querySelectorAll("[data-u]"),function(el){var v=u[el.getAttribute("data-u")];if(v!=null)el.textContent=v});
    [].forEach.call(root.querySelectorAll("[data-p]"),function(el){el.textContent=u.pts[+el.getAttribute("data-p")]});
    [].forEach.call(root.querySelectorAll("[data-band]"),function(el){el.textContent=u.bands[+el.getAttribute("data-band")]});
    $("[data-date]").textContent=today();setBiz();
    if(view==="q")renderQ();else if(view==="res")showResult(false);
  }

  $("[data-go]").addEventListener("click",function(){step=-1;go(1)});
  $("[data-back]").addEventListener("click",function(){if(!lock)go(-1)});
  nx.addEventListener("click",function(){if(this.disabled||lock)return;go(1)});
  root.addEventListener("keydown",function(e){
    if(view!=="q"||e.altKey||e.ctrlKey||e.metaKey)return;
    if(/^[1-9]$/.test(e.key)){var b=opts.children[+e.key-1];if(b){b.click();b.focus()}}
    /* on a pick-many question Enter moves on, Space still toggles the focused answer */
    else if(e.key==="Enter"&&!nx.disabled&&!nx.classList.contains("hide")&&e.target!==nx&&!(e.target.closest&&e.target.closest("[data-back]"))){e.preventDefault();nx.click()}
  });
  new MutationObserver(function(){var l=pageLang();if(l!==lang)setLang(l)}).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  setLang(lang);

  /* preview states for review: ?sc=q5 or ?sc=result, optional &biz=tours */
  var demo=P.get("sc");
  if(demo){
    var bi=Math.max(0,BIZ.indexOf(P.get("biz"))),pre={biz:bi,site:0,mobile:1,book:2,langs:[0,1],maps:1,msgr:[0],prices:1,speed:1};
    if(demo==="result"){ans=pre;setBiz();step=active().length;showResult(false)}
    else if(/^q[1-9]$/.test(demo)){var n=+demo.slice(1)-1;for(var j=0;j<n;j++)ans[Q[j].id]=pre[Q[j].id];setBiz();step=n;show("q",false);renderQ()}
    if(root.hasAttribute("data-here"))setTimeout(function(){root.scrollIntoView({block:"start"})},60);
  }
}
[].forEach.call(document.querySelectorAll("[data-site-check]"),mount);
})();
