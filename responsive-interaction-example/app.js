$(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var phone = window.matchMedia('(max-width: 720px)');

  // Price list. Days are working days, Monday to Saturday.
  var GARMENTS = [
    { id: 'trousers', name: 'Trousers and jeans', jobs: [
      { id: 'hem', name: 'Shorten hem', price: 14, days: 3, measure: true },
      { id: 'hem-orig', name: 'Shorten, keep original hem', price: 18, days: 3, measure: true },
      { id: 'waist', name: 'Take in waist', price: 22, days: 3 },
      { id: 'taper', name: 'Taper legs', price: 28, days: 4 },
      { id: 'zip', name: 'Replace zip', price: 19, days: 2 }
    ] },
    { id: 'shirt', name: 'Shirts and tops', jobs: [
      { id: 'sleeves', name: 'Shorten sleeves', price: 18, days: 3, measure: true },
      { id: 'sides', name: 'Take in sides', price: 20, days: 3 },
      { id: 'buttons', name: 'New buttons, full set', price: 8, days: 1 }
    ] },
    { id: 'dress', name: 'Dresses and skirts', jobs: [
      { id: 'dhem', name: 'Shorten hem', price: 22, days: 3, measure: true },
      { id: 'takein', name: 'Take in', price: 30, days: 4 },
      { id: 'straps', name: 'Adjust straps', price: 12, days: 1 }
    ] },
    { id: 'jacket', name: 'Jackets and coats', jobs: [
      { id: 'jsleeves', name: 'Shorten sleeves', price: 32, days: 4, measure: true },
      { id: 'lining', name: 'Replace lining', price: 85, days: 7, noExpress: true },
      { id: 'jzip', name: 'Replace zip', price: 34, days: 3 }
    ] },
    { id: 'repair', name: 'Repairs, any garment', jobs: [
      { id: 'patch', name: 'Patch a tear', price: 10, days: 1 },
      { id: 'button', name: 'Sew on a button', price: 3, days: 1 },
      { id: 'darn', name: 'Darn a hole', price: 9, days: 1 }
    ] }
  ];
  var lines = [];
  var booked = null;
  var nextLine = 1;

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
  function dayName(d) { return d.toLocaleDateString('en-GB', { weekday: 'long' }); }
  function longDay(d) { return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }

  // Hero headline follows the real calendar
  $('#hero-day').text(dayName(readyDate(3))).before('by ');

  // Tape measure along the hero, moved by scrolling
  var $strip = $('#tape-strip');
  for (var k = 1; k <= 40; k++) $('<span>').text(k * 10).css('left', k * 100 + 'px').appendTo($strip);
  var ticking = false;
  $(window).on('scroll', function () {
    if (reduce.matches || ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      $strip[0].style.setProperty('--tape-x', -((window.scrollY * 0.5) % 400) + 'px');
      ticking = false;
    });
  });

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
      var $p = $('<button type="button" class="price">').attr({ 'data-g': g.id, 'data-j': j.id, 'aria-label': 'Add ' + j.name + ', ' + g.name + ', ' + euro(j.price) + ', ' + j.days + ' working ' + (j.days === 1 ? 'day' : 'days') + ', to the ticket' })
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
    announceAdd();
  });

  // Builder: garment, then job
  var $garments = $('#garment-list');
  $.each(GARMENTS, function (i, g) {
    var $l = $('<label class="pick">');
    $l.append($('<input type="radio" name="garment">').val(g.id).prop('checked', i === 0), $('<span>').text(g.name));
    $garments.append($l);
  });
  function renderJobs() {
    var g = find($('input[name="garment"]:checked').val(), GARMENTS[0].jobs[0].id).g;
    var $jobs = $('#job-list').empty();
    $.each(g.jobs, function (i, j) {
      var $l = $('<label class="pick">');
      $l.append($('<input type="radio" name="job">').val(j.id), $('<span>').append(document.createTextNode(j.name + ' '), $('<small>').text(euro(j.price))));
      $jobs.append($l);
    });
    $('#measure').prop('hidden', true);
    $('#add-error').prop('hidden', true);
  }
  renderJobs();
  $garments.on('change', 'input', renderJobs);
  $('#job-list').on('change', 'input', function () {
    var f = find($('input[name="garment"]:checked').val(), $(this).val());
    $('#measure').prop('hidden', !f.j.measure);
    $('#add-error').prop('hidden', true);
  });
  function cm(v) { return v + ' cm'; }
  $('#shorten').on('input', function () { $('#shorten-out').text(cm($(this).val())); });
  $('#add-form').on('submit', function (e) {
    e.preventDefault();
    var gid = $('input[name="garment"]:checked').val();
    var jid = $('input[name="job"]:checked').val();
    if (!jid) {
      $('#add-error').prop('hidden', false);
      $('#job-list input').first().trigger('focus');
      return;
    }
    if (booked) startOver();
    addLine(gid, jid, Number($('#shorten').val()));
    $('#job-list input').prop('checked', false);
    $('#measure').prop('hidden', true);
    announceAdd();
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
    $('#express').prop('disabled', t.lining);
    $('#express-note').prop('hidden', !t.lining);
    $('#nav-count').text(lines.length).prop('hidden', !lines.length);
    $('#mini-text').text(lines.length + (lines.length === 1 ? ' job, ' : ' jobs, ') + euro(t.total));
    if (!booked) $('#tag-no').text(lines.length ? lines.length + (lines.length === 1 ? ' job' : ' jobs') + ', ' + euro(t.total) : 'Not booked yet');
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
    if ($next.length) $next.trigger('focus'); else $('#garment-list input:checked').trigger('focus');
  });
  $('#express').on('change', function () { render(false); });

  function announceAdd() {}

  // Mini total on phones while the tag is off screen
  var tagVisible = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { tagVisible = es[0].isIntersecting; updateMini(); }, { threshold: 0.15 }).observe(document.getElementById('tag'));
  }
  function updateMini() { $('#mini-total').prop('hidden', !lines.length || tagVisible || !!booked).toggleClass('show', !!lines.length && !tagVisible && !booked); }

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
    var phoneMsg = !phoneVal ? 'Enter a phone number for the ready message.' : (!/^\+?[\d\s()-]+$/.test(phoneVal) ? 'Use digits, spaces and an optional plus only.' : (digits.length < 7 ? 'That number is too short, it needs at least 7 digits.' : ''));
    setError('name', nameMsg);
    setError('phone', phoneMsg);
    if (all && !lines.length) errs.push({ href: '#garment-list', text: 'Add at least one job to the ticket.' });
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
      booked = { no: 'HL\u2011' + String(1000 + Math.floor(Math.random() * 9000)), ready: readyDate(t.days) };
      $('#tag').addClass('booked');
      $('#tag-no').text('Sample ticket ' + booked.no);
      $('#tag-done-text').text(String($('#name').val()).trim() + ', bring it ' + ($('input[name="handover"]:checked').val() === 'box' ? 'to the drop box with ' + booked.no + ' on the bag' : 'to the counter and show ' + booked.no) + '. Ready ' + longDay(booked.ready) + '.');
      $('#tag-done').prop('hidden', false);
      $('#book-form, #add-form').find('input, button').prop('disabled', true);
      updateMini();
      document.getElementById('tag').scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' });
      $('#new-ticket').trigger('focus');
    }, reduce.matches ? 150 : 700);
  });
  $('#error-list').on('click', 'a', function (e) {
    e.preventDefault();
    var target = $(this).attr('href') === '#garment-list' ? $('#garment-list input:checked') : $($(this).attr('href'));
    target.trigger('focus');
  });
  function startOver() {
    lines = []; booked = null;
    $('#tag').removeClass('booked');
    $('#tag-done').prop('hidden', true);
    $('#tag-no').text('Not booked yet');
    $('#book-form, #add-form').find('input, button').prop('disabled', false);
    render(false);
  }
  $('#new-ticket').on('click', function () {
    startOver();
    $('#garment-list input:checked').trigger('focus');
  });
  render(false);
});
