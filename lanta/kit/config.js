/* Lanta site config. This is the only file you need to edit.
   Text fields accept one string, or an object with en, ru and th. An empty language falls back to English.
   type: spa, tours, bike, dental, cafe or other. theme: dark or light. accent: any #rrggbb colour.
   hours: "mon" to "sun", each ["10:00", "21:00"] or null when closed. "00:00" as closing time means midnight.
   contact.channel: whatsapp, line or telegram. The handle is a number like 66812345678 for WhatsApp,
   an Official Account ID like @yourshop for LINE, or a username for Telegram.
   This sample is a placeholder business. Set "sample" to false for a real client. */
window.LANTA = {
  "version": 1,
  "type": "spa",
  "sample": true,
  "name": { "en": "Baan Sabai Spa", "ru": "Baan Sabai Spa", "th": "บ้านสบาย สปา" },
  "tagline": {
    "en": "Thai massage on Koh Lanta, booked in a minute",
    "ru": "Тайский массаж на Ко Ланте, запись за минуту",
    "th": "นวดแผนไทยบนเกาะลันตา จองได้ในหนึ่งนาที"
  },
  "sub": {
    "en": "Experienced therapists, quiet rooms and warm herbal oils. Choose a time and send the request in your messenger.",
    "ru": "Опытные мастера, тихие комнаты и тёплые травяные масла. Выберите время и отправьте заявку в мессенджер.",
    "th": "นักนวดมากประสบการณ์ ห้องเงียบสงบ และน้ำมันสมุนไพรอุ่นๆ เลือกเวลาแล้วส่งคำขอทางแชท"
  },
  "accent": "#0e7490",
  "theme": "dark",
  "languages": ["en", "ru", "th"],
  "defaultLang": "en",
  "timezone": "Asia/Bangkok",
  "slotMinutes": 30,
  "leadMinutes": 30,
  "services": [
    { "name": { "en": "Thai massage", "ru": "Тайский массаж", "th": "นวดแผนไทย" }, "minutes": 60, "price": 400 },
    { "name": { "en": "Thai massage", "ru": "Тайский массаж", "th": "นวดแผนไทย" }, "minutes": 90, "price": 550 },
    { "name": { "en": "Aroma oil massage", "ru": "Массаж с аромамаслами", "th": "นวดน้ำมันอโรมา" }, "minutes": 60, "price": 600 },
    { "name": { "en": "Foot massage", "ru": "Массаж стоп", "th": "นวดเท้า" }, "minutes": 45, "price": 350 },
    { "name": { "en": "Herbal compress massage", "ru": "Массаж травяными мешочками", "th": "นวดประคบสมุนไพร" }, "minutes": 90, "price": 900 }
  ],
  "hours": {
    "mon": ["10:00", "21:00"], "tue": ["10:00", "21:00"], "wed": ["10:00", "21:00"], "thu": ["10:00", "21:00"],
    "fri": ["10:00", "21:00"], "sat": ["10:00", "21:00"], "sun": ["10:00", "21:00"]
  },
  "contact": { "channel": "line", "handle": "@lanta.sample", "phone": "+66 80 000 0000" },
  "address": {
    "text": {
      "en": "12 Moo 2, Saladan, Koh Lanta, Krabi 81150",
      "ru": "12 Му 2, Саладан, Ко Ланта, Краби 81150",
      "th": "12 หมู่ 2 ต.ศาลาด่าน อ.เกาะลันตา จ.กระบี่ 81150"
    },
    "city": { "en": "Koh Lanta", "ru": "Ко Ланта", "th": "เกาะลันตา" },
    "region": "Krabi",
    "postalCode": "81150",
    "mapsUrl": "https://maps.google.com/?q=Saladan,+Koh+Lanta"
  },
  "faq": [
    {
      "q": { "en": "Do I need to book in advance?", "ru": "Нужно ли записываться заранее?", "th": "ต้องจองล่วงหน้าไหม" },
      "a": {
        "en": "Walk-ins are welcome, but evenings fill up fast. Send a request and we hold the time for you.",
        "ru": "Можно прийти и без записи, но вечером мест обычно нет. Отправьте заявку, и мы придержим время.",
        "th": "แวะมาได้เลย แต่ช่วงเย็นคิวเต็มเร็ว ส่งคำขอไว้ก่อน เราจะกันเวลาไว้ให้"
      }
    },
    {
      "q": { "en": "What should I wear?", "ru": "Что надеть?", "th": "ต้องแต่งตัวอย่างไร" },
      "a": {
        "en": "We give you loose cotton clothes for Thai massage and towels for oil treatments.",
        "ru": "Для тайского массажа мы выдаём свободную хлопковую одежду, для массажа с маслом есть полотенца.",
        "th": "เรามีชุดผ้าฝ้ายให้สำหรับนวดแผนไทย และผ้าขนหนูสำหรับนวดน้ำมัน"
      }
    },
    {
      "q": { "en": "How can I pay?", "ru": "Как можно оплатить?", "th": "ชำระเงินได้อย่างไร" },
      "a": {
        "en": "Cash, Thai QR or card at the front desk.",
        "ru": "Наличными, по тайскому QR или картой на ресепшене.",
        "th": "เงินสด สแกน QR หรือบัตร ที่เคาน์เตอร์"
      }
    }
  ]
};
