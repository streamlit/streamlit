/* globals $ */
var Site = {
  main: function () {
    $('#signupForm').on('submit', function (ev) {
      var submitButton = $(this).find('[type=submit]')
      submitButton.find('span').text(submitButton.data('submitted-value'))
      $(this)
        .addClass('state--submitted')
      $(this)
        .find('button')
        .attr('disabled', 'disabled')
    })

    $('.js--play').on('click', function (ev) {
      ev.preventDefault()
      $($(this).attr('href'))
        .show()
        .get(0)
        .play()
      $(this)
        .parent('.js--container')
        .hide()
    })
  }
}

Site.main()
