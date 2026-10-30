$(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var phone = window.matchMedia('(max-width: 720px)');

  // Price list. Days are working days, Monday to Saturday.
  // "pin" is where the price is pinned on the drawing (viewBox 300 x 380), "side" is the label column.
  var GARMENTS = [
    { id: 'trousers', tab: 'Trousers', name: 'Trousers and jeans', jobs: [
      { id: 'hem', name: 'Shorten hem', short: 'Shorten', price: 14, days: 3, measure: true, pin: [111, 350], side: 'l' },
      { id: 'hem-orig', name: 'Shorten, keep original hem', short: 'Shorten, keep hem', price: 18, days: 3, measure: true, pin: [189, 350], side: 'r' },
      { id: 'waist', name: 'Take in waist', short: 'Take in waist', price: 22, days: 3, pin: [118, 40], side: 'l' },
      { id: 'taper', name: 'Taper legs', short: 'Taper legs', price: 28, days: 4, pin: [212, 262], side: 'r' },
      { id: 'zip', name: 'Replace zip', short: 'New zip', price: 19, days: 2, pin: [151, 88], side: 'r' }
    ] },
    { id: 'shirt', tab: 'Shirts', name: 'Shirts and tops', jobs: [
      { id: 'sleeves', name: 'Shorten sleeves', short: 'Shorten sleeves', price: 18, days: 3, measure: true, pin: [74, 300], side: 'l' },
      { id: 'sides', name: 'Take in sides', short: 'Take in sides', price: 20, days: 3, pin: [198, 230], side: 'r' },
      { id: 'buttons', name: 'New buttons, full set', short: 'New buttons', price: 8, days: 1, pin: [156, 164], side: 'r' }
    ] },
    { id: 'dress', tab: 'Dresses', name: 'Dresses and skirts', jobs: [
      { id: 'dhem', name: 'Shorten hem', short: 'Shorten hem', price: 22, days: 3, measure: true, pin: [96, 358], side: 'l' },
      { id: 'takein', name: 'Take in', short: 'Take in', price: 30, days: 4, pin: [182, 150], side: 'r' },
      { id: 'straps', name: 'Adjust straps', short: 'Adjust straps', price: 12, days: 1, pin: [121, 48], side: 'l' }
    ] },
    { id: 'jacket', tab: 'Jackets', name: 'Jackets and coats', jobs: [
      { id: 'jsleeves', name: 'Shorten sleeves', short: 'Shorten sleeves', price: 32, days: 4, measure: true, pin: [68, 316], side: 'l' },
      { id: 'lining', name: 'Replace lining', short: 'New lining', price: 85, days: 7, noExpress: true, pin: [124, 236], side: 'l' },
      { id: 'jzip', name: 'Replace zip', short: 'New zip', price: 34, days: 3, pin: [150, 290], side: 'r' }
    ] },
    { id: 'repair', tab: 'Repairs', name: 'Repairs, any garment', jobs: [
      { id: 'patch', name: 'Patch a tear', short: 'Patch a tear', price: 10, days: 1, pin: [192, 224], side: 'r' },
      { id: 'button', name: 'Sew on a button', short: 'Sew on a button', price: 3, days: 1, pin: [150, 92], side: 'r' },
      { id: 'darn', name: 'Darn a hole', short: 'Darn a hole', price: 9, days: 1, pin: [121, 281], side: 'l' }
    ] }
  ];
  var lines = [];
  var booked = null;
  var nextLine = 1;
  var cur = { g: 'trousers', j: 'hem' };

  var euro = function (v) { return '€' + (Math.round(v * 100) / 100).toFixed(v % 1 ? 2 : 0); };
  var find = function (gid, jid) {
    var g = GARMENTS.filter(function (x) { return x.id === gid; })[0];
    return { g: g, j: g.jobs.filter(function (x) { return x.id === jid; })[0] };
  };
  function readyDate(days) {
    var d = new Date();
    var n = 0;
    while (n < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) n++; }
    return d;
  }
  function longDay(d) { return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function shortDay(d) { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function daysText(n) { return n + (n === 1 ? ' working day' : ' working days'); }

  // Phone menu
  var $toggle = $('#menu-toggle');
  var $nav = $('#site-nav');
  function setMenu(open) {
    $toggle.attr('aria-expanded', String(open));
    $toggle.find('.menu-label').text(open ? 'Close' : 'Menu');
    $nav.toggleClass('is-open', open);
  }
  $toggle.on('click', function () { setMenu($toggle.attr('aria-expanded') !== 'true'); });
  $nav.on('click', 'a', function () { setMenu(false); });
  $(document).on('keydown', function (e) {
    if (e.key === 'Escape' && $toggle.attr('aria-expanded') === 'true') { setMenu(false); $toggle.trigger('focus'); }
  });
  $(document).on('click', function (e) {
    if ($toggle.attr('aria-expanded') === 'true' && !$(e.target).closest('.bar').length) setMenu(false);
  });
  $(phone).on('change', function () { if (!phone.matches) setMenu(false); });

  // Price list
  var $groups = $('#price-groups');
  $.each(GARMENTS, function (gi, g) {
    var bodyId = 'group-' + g.id;
    var $group = $('<div class="group">');
    var $btn = $('<button type="button" class="group-toggle">').attr({ 'aria-expanded': 'true', 'aria-controls': bodyId })
      .append($('<span>').text(g.name), '<span class="chev" aria-hidden="true"></span>');
    var $list = $('<ul class="group-body">').attr('id', bodyId);
    $.each(g.jobs, function (ji, j) {
      var $p = $('<button type="button" class="price">').attr({ 'data-g': g.id, 'data-j': j.id, 'aria-label': 'Add ' + j.name + ', ' + g.name + ', ' + euro(j.price) + ', ' + daysText(j.days) + ', to the ticket' })
        .append($('<span class="p-name">').text(j.name), $('<span class="p-days">').text(j.days + (j.days === 1 ? ' day' : ' days')), $('<span class="p-cost">').text(euro(j.price)));
      $list.append($('<li>').append($p));
    });
    $group.append($btn, $list).appendTo($groups);
  });
  function initGroups() {
    $groups.find('.group-toggle').each(function (i) {
      var open = !phone.matches || i === 0;
      $(this).attr('aria-expanded', String(open));
      $('#' + $(this).attr('aria-controls')).prop('hidden', !open);
    });
  }
  initGroups();
  $(phone).on('change', initGroups);
  $groups.on('click', '.group-toggle', function () {
    var open = $(this).attr('aria-expanded') === 'true';
    var $body = $('#' + $(this).attr('aria-controls'));
    $(this).attr('aria-expanded', String(!open));
    if (reduce.matches) { $body.prop('hidden', open); return; }
    if (open) $body.slideUp(180, function () { $body.prop('hidden', true).css('display', ''); });
    else { $body.prop('hidden', false).hide().slideDown(200, function () { $body.css('display', ''); }); }
  });
  $groups.on('click', '.price', function () {
    if (booked) startOver();
    var $p = $(this);
    addLine($p.data('g'), $p.data('j'), 3);
    $p.addClass('added');
    window.setTimeout(function () { $p.removeClass('added'); }, 600);
  });

  // The drawings: a technical flat per garment, the job's area in violet, the new hem following the slider
  var PX_CM = 4;
  var mirror = function (s) { return [300 - s[1], 300 - s[0]]; };
  var FLATS = {
    trousers: {
      cloth: '<path d="M92 30h116v20H92z"/><path d="M92 50 80 350h62l8-232 8 232h62L208 50z"/>',
      detail: '<path d="M104 50c4 24 14 34 32 36"/><path d="M196 50c-4 24-14 34-32 36"/><path d="M110 30v20M140 30v20M160 30v20M190 30v20"/><path d="M81 336h60M159 336h60"/>',
      zones: '<rect class="zone fillzone" data-z="waist" x="92" y="30" width="116" height="20"/><path class="zone linezone" data-z="waist" d="M150 50v-20"/>' +
        '<path class="zone linezone" data-z="hem" d="M80 350h62"/><path class="zone linezone" data-z="hem-orig" d="M158 350h62"/><path class="zone linezone" data-z="zip" d="M150 50v62c0 8-4 12-10 14"/>' +
        '<path class="zone linezone" data-z="taper" d="M86 210 94 348M140 210l-6 138M214 210l-8 138M160 210l6 138"/>',
      measure: { base: 350, dimX: 240, segs: function (y) { var l = [92 - 12 * (y - 50) / 300, 150 - 8 * (y - 118) / 232]; return [l, mirror(l)]; } }
    },
    shirt: {
      cloth: '<path d="M124 34 100 44 64 60 60 300h28l4-190 4 230h108l4-230 4 190h28l-4-240-36-16-24-10q-26 18-52 0z"/><path d="M124 34l14 26 12-12 12 12 14-26"/>',
      detail: '<path d="M150 52v288"/><path d="M61 284h27M212 284h27"/><path d="M66 64c10 14 20 28 26 46M234 64c-10 14-20 28-26 46"/>',
      zones: '<path class="zone linezone" data-z="sleeves" d="M60 300h28M212 300h28"/><path class="zone linezone" data-z="sides" d="M100 118l6 218M200 118l-6 218"/>' +
        [80, 122, 164, 206, 248, 296].map(function (y) { return '<circle class="zone dotzone" data-z="buttons" cx="156" cy="' + y + '" r="3.6"/>'; }).join(''),
      measure: { base: 300, dimX: 254, segs: function (y) { var l = [64 - 4 * (y - 60) / 240, 92 - 4 * (y - 110) / 190]; return [l, mirror(l)]; } }
    },
    dress: {
      cloth: '<path d="M116 26h6l4 46h-6zM178 26h6l-4 46h-6z"/><path d="M118 70q32 14 64 0l6 80 62 200q-100 18-200 0l62-200z"/>',
      detail: '<path d="M112 150q38 10 76 0"/><path d="M150 76v74"/><path d="M58 336q92 16 184 0"/>',
      zones: '<path class="zone linezone" data-z="straps" d="M119 28l4 42M181 28l-4 42"/><path class="zone linezone" data-z="dhem" d="M50 350q100 18 200 0"/>' +
        '<path class="zone linezone" data-z="takein" d="M124 76l-6 74-50 180M176 76l6 74 50 180"/>',
      measure: { base: 350, dimX: 262, curve: true, segs: function (y) { var x = 112 - 62 * (y - 150) / 200; return [[x, 300 - x]]; } }
    },
    jacket: {
      cloth: '<path d="M120 30 96 40 58 58 52 316h32l6-200 2 236h116l2-236 6 200h32l-6-258-38-18-24-10q-30 14-60 0z"/>',
      detail: '<path d="M100 270h36M164 270h36"/><path d="M53 300h31M216 300h31"/><path d="M62 62c12 16 22 32 28 54M238 62c-12 16-22 32-28 54"/>',
      lines: '<path d="M120 30l16 64-12 8 20 58 6 40M180 30l-16 64 12 8-20 58-6 40"/>',
      zones: '<path class="zone fillzone" data-z="lining" d="M96 120h108l2 228H94z"/><path class="zone linezone" data-z="jsleeves" d="M52 316h32M216 316h32"/>' +
        '<path class="zone linezone" data-z="jzip" d="M150 200v152"/><circle class="zone dotzone" data-z="" cx="156" cy="226" r="3.6"/><circle class="zone dotzone" data-z="" cx="156" cy="262" r="3.6"/>',
      measure: { base: 316, dimX: 262, segs: function (y) { var l = [58 - 6 * (y - 58) / 258, 90 - 6 * (y - 116) / 200]; return [l, mirror(l)]; } }
    },
    repair: {
      cloth: '<path d="M118 36 92 44 50 80l18 44 26-16 2 232h108l2-232 26 16 18-44-42-36-26-8q-32 26-64 0z"/>',
      detail: '<path d="M150 60v40"/><path d="M98 326h104"/>',
      zones: '<rect class="zone fillzone" data-z="patch" x="152" y="206" width="40" height="36"/><path class="zone linezone" data-z="patch" d="M152 206h40v36h-40z" stroke-dasharray="3 2"/>' +
        '<circle class="zone dotzone" data-z="button" cx="150" cy="92" r="4"/>' +
        '<path class="zone linezone" data-z="darn" d="M110 276h22M110 281h22M110 286h22M114 272v18M120 272v18M126 272v18"/>'
    }
  };
  var NOTES = {
    hem: ['Inside leg', 81], 'hem-orig': ['Inside leg', 81], sleeves: ['Sleeve', 64], dhem: ['Length', 102], jsleeves: ['Sleeve', 63],
    waist: 'Taken in at the centre back seam, up to 4 cm.', taper: 'A new leg line from the knee down.', zip: 'The fly zip swapped for a matching one.',
    sides: 'Side seams brought in evenly from the arm to the hem.', buttons: 'The whole set replaced with matching buttons.',
    takein: 'Side seams taken in from the bust to the hip.', straps: 'Straps shortened at the back seam.', lining: 'Body and sleeve lining replaced. Takes a full week.',
    jzip: 'Front zip replaced, top to bottom.', patch: 'Patched from the inside and stitched by hand.', button: 'One button sewn on to match the others.', darn: 'The hole woven closed with matching thread.'
  };
  function cm(v) { return v + ' cm'; }

  // Garment tabs
  var $tabs = $('#garments');
  $.each(GARMENTS, function (i, g) {
    $('<button type="button">').attr({ 'data-g': g.id, 'aria-pressed': String(g.id === cur.g), 'aria-label': g.name }).text(g.tab).appendTo($tabs);
  });
  $tabs.on('click', 'button', function () {
    var gid = $(this).attr('data-g');
    if (gid === cur.g) return;
    cur.g = gid; cur.j = find(gid, GARMENTS.filter(function (x) { return x.id === gid; })[0].jobs[0].id).g.jobs[0].id;
    $('#shorten').val(3); $('#shorten-out').text(cm(3));
    drawBoard();
  });

  var $art = $('#fitting-art');
  var $board = $('#board');
  var $L = $('#calls-l'), $R = $('#calls-r');

  function drawBoard() {
    var g = find(cur.g, cur.j).g;
    var f = FLATS[cur.g];
    $tabs.find('button').each(function () { $(this).attr('aria-pressed', String($(this).attr('data-g') === cur.g)); });
    $art.html('<svg viewBox="0 0 300 380" class="flat" role="img" aria-label="Drawing of ' + g.name.toLowerCase() + ' with the prices pinned to it">' +
      '<g class="cloth">' + f.cloth + '</g><g class="detail">' + f.detail + '</g>' + (f.lines ? '<g class="line" fill="none" stroke="#18211a" stroke-width="1.6">' + f.lines + '</g>' : '') +
      f.zones + '<g class="redline"></g></svg>');
    $L.empty(); $R.empty();
    $.each(g.jobs, function (i, j) {
      var $b = $('<button type="button" class="call">').attr({ 'data-j': j.id, 'aria-pressed': 'false', 'aria-label': j.name + ', ' + euro(j.price) + ', ready in ' + daysText(j.days) })
        .append($('<span class="c-name">').text(j.short), $('<span class="c-price">').text(euro(j.price)));
      $('<li>').attr('data-y', j.pin[1]).append($b).appendTo(j.side === 'l' ? $L : $R);
    });
    selectJob(cur.j);
  }
  $board.on('click', '.call', function () { selectJob($(this).attr('data-j')); });

  function selectJob(jid) {
    cur.j = jid;
    var fj = find(cur.g, jid), job = fj.j, f = FLATS[cur.g];
    $board.find('.call').each(function () { $(this).attr('aria-pressed', String($(this).attr('data-j') === jid)); });
    $art.find('.zone').each(function () {
      var zs = (this.getAttribute('data-z') || '').split(' ');
      this.classList.toggle('on', zs.indexOf(jid) > -1);
    });
    $('#s-name').text(job.name);
    $('#s-garment').text(fj.g.name);
    $('#s-price').text(euro(job.price));
    $('#s-ready').text(longDay(readyDate(job.days)));
    $('#measure').prop('hidden', !job.measure);
    $('#s-added').prop('hidden', true);
    drawCut();
    placeCalls();
  }

  function drawCut() {
    var f = FLATS[cur.g], job = find(cur.g, cur.j).j;
    var red = $art.find('.redline')[0];
    if (!red) return;
    if (job.measure && f.measure) {
      var s = Number($('#shorten').val()), m = f.measure, y = m.base - s * PX_CM, b = m.base, html = '';
      $.each(m.segs(y), function (i, seg) {
        var sb = m.segs(b)[i];
        html += '<path class="cutaway" d="M' + seg[0] + ' ' + y + 'L' + seg[1] + ' ' + y + 'L' + sb[1] + ' ' + (b + 1) + 'L' + sb[0] + ' ' + (b + 1) + 'Z"/>';
        html += m.curve ? '<path class="cut" d="M' + (seg[0] - 4) + ' ' + y + 'Q150 ' + (y + 18) + ' ' + (seg[1] + 4) + ' ' + y + '"/>' : '<path class="cut" d="M' + (seg[0] - 5) + ' ' + y + 'H' + (seg[1] + 5) + '"/>';
      });
      html += '<path class="dim" d="M' + m.dimX + ' ' + y + 'V' + b + 'M' + (m.dimX - 4) + ' ' + (y + 4) + 'l4-4 4 4M' + (m.dimX - 4) + ' ' + (b - 4) + 'l4 4 4-4"/>';
      red.innerHTML = html;
      var n = NOTES[cur.j];
      $('#fitting-cap').text(n[0] + ' goes from ' + n[1] + ' cm to about ' + (n[1] - s) + ' cm.' + (cur.j === 'hem-orig' ? ' The original hem is sewn back on.' : ''));
    } else {
      red.innerHTML = '';
      $('#fitting-cap').text(NOTES[cur.j] || '');
    }
  }
  $('#shorten').on('input', function () { $('#shorten-out').text(cm($(this).val())); $('#s-added').prop('hidden', true); drawCut(); });

  // Labels sit level with their pin, then a thin line runs from the label to the pin
  var NS = 'http://www.w3.org/2000/svg';
  function placeCalls() {
    var svg = $art.find('svg')[0], lead = document.getElementById('leaders');
    if (!svg || !lead) return;
    var br = $board[0].getBoundingClientRect(), fr = svg.getBoundingClientRect();
    var sx = fr.width / 300, sy = fr.height / 380;
    var job = find(cur.g, cur.j).g.jobs;
    lead.innerHTML = '';
    [['l', $L], ['r', $R]].forEach(function (pair) {
      var side = pair[0], $col = pair[1], colR = $col[0].getBoundingClientRect(), H = colR.height;
      var items = $col.children('li').get().map(function (li) {
        var j = job.filter(function (x) { return x.id === $(li).find('.call').attr('data-j'); })[0];
        return { li: li, j: j, py: fr.top - colR.top + j.pin[1] * sy, h: li.offsetHeight };
      }).sort(function (a, b) { return a.py - b.py; });
      var y = 0;
      items.forEach(function (it) { it.top = Math.max(y, it.py - it.h / 2); y = it.top + it.h + 8; });
      var over = y - 8 - H;
      if (over > 0) { for (var k = items.length - 1, lim = H; k >= 0; k--) { items[k].top = Math.min(items[k].top, lim - items[k].h); lim = items[k].top - 8; } }
      items.forEach(function (it) {
        it.li.style.top = Math.max(0, it.top) + 'px';
        var btn = $(it.li).find('.call')[0], r = btn.getBoundingClientRect();
        var x1 = (side === 'l' ? r.right : r.left) - br.left, y1 = r.top + r.height / 2 - br.top;
        var x2 = fr.left - br.left + it.j.pin[0] * sx, y2 = fr.top - br.top + it.j.pin[1] * sy;
        var bend = x1 + (side === 'l' ? 10 : -10);
        var on = it.j.id === cur.j ? 'on' : '';
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'H' + bend.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1));
        if (on) p.setAttribute('class', on);
        lead.appendChild(p);
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x2.toFixed(1)); c.setAttribute('cy', y2.toFixed(1)); c.setAttribute('r', on ? 5 : 4);
        if (on) c.setAttribute('class', on);
        lead.appendChild(c);
      });
    });
  }
  var rz = 0;
  $(window).on('resize', function () { clearTimeout(rz); rz = setTimeout(placeCalls, 60); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeCalls);

  $('#add-btn').on('click', function () {
    if (booked) startOver();
    addLine(cur.g, cur.j, Number($('#shorten').val()));
    var job = find(cur.g, cur.j).j;
    $('#s-added').text(job.name + ' added.').prop('hidden', false);
  });

  function addLine(gid, jid, shorten) {
    var f = find(gid, jid);
    lines.push({ id: nextLine++, g: f.g, j: f.j, shorten: f.j.measure ? shorten : null });
    render(true);
  }
  function totals() {
    var sub = 0, days = 0, lining = false;
    $.each(lines, function (i, l) { sub += l.j.price; days = Math.max(days, l.j.days); if (l.j.noExpress) lining = true; });
    var express = $('#express').prop('checked') && !lining;
    return { sub: sub, extra: express ? sub / 2 : 0, total: express ? sub * 1.5 : sub, days: express ? 1 : days, express: express, lining: lining };
  }
  function render(bump) {
    var t = totals();
    var $list = $('#tag-lines').empty();
    $.each(lines, function (i, l) {
      var $li = $('<li class="tag-line">');
      var $txt = $('<div>').append($('<b>').text(l.j.name), $('<small>').text(l.g.name + (l.shorten ? ', ' + cm(l.shorten) : '') + ', ' + l.j.days + (l.j.days === 1 ? ' day' : ' days')));
      var $rm = $('<button type="button" class="remove">').attr({ 'data-id': l.id, 'aria-label': 'Remove ' + l.j.name + ', ' + l.g.name }).html('&times;');
      $li.append($txt, $('<span class="cost">').text(euro(l.j.price)), $rm);
      $list.append($li);
    });
    $('#tag-empty').prop('hidden', lines.length > 0);
    $('#tag-foot').prop('hidden', !lines.length);
    $('#tag-sub').text(euro(t.sub));
    $('#tag-express-row').prop('hidden', !t.express);
    $('#tag-express').text('+' + euro(t.extra));
    $('#tag-total').text(euro(t.total));
    $('#tag-ready').text(lines.length ? longDay(readyDate(t.days)) : '');
    $('#express').prop('disabled', t.lining || !!booked);
    $('#express-note').prop('hidden', !t.lining);
    $('#nav-count').text(lines.length).prop('hidden', !lines.length);
    var summary = lines.length + (lines.length === 1 ? ' job, ' : ' jobs, ') + euro(t.total);
    $('#mini-text').text(summary);
    $('#s-ticket').text('Your ticket: ' + summary + ', ready ' + shortDay(readyDate(t.days))).prop('hidden', !lines.length);
    if (!booked) $('#tag-no').text(lines.length ? summary : 'Not booked yet');
    updateMini();
    if (bump && !reduce.matches) {
      var $tag = $('#tag').addClass('bump');
      window.setTimeout(function () { $tag.removeClass('bump'); }, 220);
    }
  }
  $('#tag-lines').on('click', '.remove', function () {
    var id = Number($(this).attr('data-id'));
    var idx = $('#tag-lines .remove').index(this);
    lines = lines.filter(function (l) { return l.id !== id; });
    render(false);
    var $next = $('#tag-lines .remove').eq(Math.min(idx, lines.length - 1));
    if ($next.length) $next.trigger('focus'); else $('#add-btn').trigger('focus');
  });
  $('#express').on('change', function () { render(false); });

  // Mini total on phones while the ticket is off screen and the stub is not in view either
  var tagVisible = false, stubVisible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { tagVisible = es[0].isIntersecting; updateMini(); }, { threshold: 0.15 }).observe(document.getElementById('tag'));
    new IntersectionObserver(function (es) { stubVisible = es[0].isIntersecting; updateMini(); }, { threshold: 0.3 }).observe(document.getElementById('stub'));
  }
  function updateMini() { var show = !!lines.length && !tagVisible && !stubVisible && !booked; $('#mini-total').prop('hidden', !show).toggleClass('show', show); }

  // Booking
  function setError(id, msg) {
    $('#' + id).attr('aria-invalid', msg ? 'true' : 'false');
    $('#' + id + '-error').text(msg || '').prop('hidden', !msg);
  }
  $('#name, #phone').on('input', function () { if ($(this).attr('aria-invalid') === 'true') validate(false); });
  function validate(all) {
    var errs = [];
    var name = String($('#name').val()).trim();
    var phoneVal = String($('#phone').val()).trim();
    var digits = phoneVal.replace(/\D/g, '');
    var nameMsg = name.length < 2 ? 'Enter a name for the ticket, at least 2 letters.' : '';
    var phoneMsg = !phoneVal ? 'Enter a phone number, we text you when it is ready.' : (!/^\+?[\d\s()-]+$/.test(phoneVal) ? 'Use digits, spaces and a plus at the start only.' : (digits.length < 7 ? 'That number is too short, it needs at least 7 digits.' : ''));
    setError('name', nameMsg);
    setError('phone', phoneMsg);
    if (all && !lines.length) errs.push({ href: '#add-btn', text: 'Add at least one job to the ticket.' });
    if (nameMsg) errs.push({ href: '#name', text: nameMsg });
    if (phoneMsg) errs.push({ href: '#phone', text: phoneMsg });
    return errs;
  }
  $('#book-form').on('submit', function (e) {
    e.preventDefault();
    if (booked) return;
    var errs = validate(true);
    var $sum = $('#error-summary');
    if (errs.length) {
      $('#error-list').empty().append($.map(errs, function (x) { return $('<li>').append($('<a>').attr('href', x.href).text(x.text)); }));
      $sum.prop('hidden', false).trigger('focus');
      return;
    }
    $sum.prop('hidden', true);
    var $btn = $('#book-btn').addClass('is-loading').attr('aria-busy', 'true');
    $btn.find('.book-label').text('Booking');
    window.setTimeout(function () {
      $btn.removeClass('is-loading').removeAttr('aria-busy').find('.book-label').text('Book this ticket');
      var t = totals();
      booked = { no: 'SR‑' + String(1000 + Math.floor(Math.random() * 9000)), ready: readyDate(t.days) };
      $('#tag').addClass('booked');
      $('#tag-no').text('Sample ticket ' + booked.no);
      $('#tag-done-text').text(String($('#name').val()).trim() + ', bring it ' + ($('input[name="handover"]:checked').val() === 'box' ? 'to the drop box with ' + booked.no + ' on the bag' : 'to the counter and show ' + booked.no) + '. Ready ' + longDay(booked.ready) + '.');
      $('#tag-done').prop('hidden', false);
      $('#book-form').find('input, button').prop('disabled', true);
      updateMini();
      document.getElementById('tag').scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' });
      $('#new-ticket').trigger('focus');
    }, reduce.matches ? 150 : 700);
  });
  $('#error-list').on('click', 'a', function (e) {
    e.preventDefault();
    var href = $(this).attr('href');
    if (href === '#add-btn') {
      document.getElementById('stub').scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' });
      window.setTimeout(function () { $('#add-btn').trigger('focus'); }, reduce.matches ? 0 : 400);
    } else $(href).trigger('focus');
  });
  function startOver() {
    lines = []; booked = null;
    $('#tag').removeClass('booked');
    $('#tag-done').prop('hidden', true);
    $('#tag-no').text('Not booked yet');
    $('#book-form').find('input, button').prop('disabled', false);
    render(false);
  }
  $('#new-ticket').on('click', function () {
    startOver();
    $('#name').trigger('focus');
  });

  drawBoard();
  render(false);
});
