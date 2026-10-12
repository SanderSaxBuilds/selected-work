$(function () {
  $('#menu-toggle').on('click', function () {
    const open = $(this).attr('aria-expanded') === 'true';
    $(this).attr('aria-expanded', String(!open));
    $('#site-nav').toggleClass('is-open', !open);
  });
  $('#site-nav a').on('click', function () {
    $('#menu-toggle').attr('aria-expanded', 'false');
    $('#site-nav').removeClass('is-open');
  });
  $('#detail-toggle').on('click', function () {
    const open = $(this).attr('aria-expanded') === 'true';
    $(this).attr('aria-expanded', String(!open));
    $('#detail-answer').prop('hidden', open);
    $('#detail-symbol').text(open ? '+' : '−');
  });
  $('#project-form').on('submit', function (event) {
    event.preventDefault();
    const title = String($('#project-title').val()).trim();
    $('#project-title').attr('aria-invalid', String(!title));
    $('#form-message').toggleClass('error', !title)
      .text(title ? 'Title checked: ' + title : 'Enter a project title to continue.');
    if (!title) $('#project-title').trigger('focus');
  });
});
