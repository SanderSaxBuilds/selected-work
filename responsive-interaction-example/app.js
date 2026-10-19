$(function () {
  const $toggle = $('#menu-toggle');
  const $nav = $('#site-nav');

  function setMenu(open) {
    $toggle.attr('aria-expanded', String(open));
    $nav.toggleClass('is-open', open);
  }

  $toggle.on('click', function () {
    setMenu($toggle.attr('aria-expanded') !== 'true');
  });
  $nav.find('a').on('click', function () {
    setMenu(false);
  });
  $(document).on('keydown', function (event) {
    if (event.key === 'Escape' && $toggle.attr('aria-expanded') === 'true') {
      setMenu(false);
      $toggle.trigger('focus');
    }
  });

  $('#detail-toggle').on('click', function () {
    const open = $(this).attr('aria-expanded') === 'true';
    $(this).attr('aria-expanded', String(!open));
    $('#detail-answer').prop('hidden', open);
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
