// Field & Frame preview, first screen. Drag the yellow line to compare the drawing with the finished house.
// On the first visit the drawing draws itself once, then the line slides across to show the photo.
(() => {
  const root = document.querySelector('[data-compare]')
  if (!root) return
  const stage = root.querySelector('.compare-stage')
  const handle = root.querySelector('.compare-handle')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const REST = 58
  let pos = REST
  let intro = 0
  let press = null

  function set(value, byUser = false) {
    pos = Math.max(0, Math.min(100, value))
    const shown = Math.round(pos)
    root.style.setProperty('--pos', `${pos}%`)
    handle.setAttribute('aria-valuenow', String(shown))
    handle.setAttribute('aria-valuetext', `${shown} percent drawing, ${100 - shown} percent photo`)
    root.dataset.edge = pos < 16 ? 'left' : pos > 84 ? 'right' : ''
    if (byUser) {
      stopIntro()
      root.dataset.moved = 'true'
    }
  }
  const at = event => {
    const box = stage.getBoundingClientRect()
    return ((event.clientX - box.left) / box.width) * 100
  }

  // Mouse: press and drag anywhere on the picture. Touch: a sideways drag moves the line,
  // an up or down swipe still scrolls the page, a tap moves the line to that spot.
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: event.pointerType === 'mouse' }
    if (press.dragging) {
      event.preventDefault()
      stage.setPointerCapture(event.pointerId)
      set(at(event), true)
    }
  })
  stage.addEventListener('pointermove', event => {
    if (!press || press.id !== event.pointerId) return
    if (!press.dragging) {
      const dx = Math.abs(event.clientX - press.x)
      const dy = Math.abs(event.clientY - press.y)
      if (dx < 6 || dx < dy) return
      press.dragging = true
      try { stage.setPointerCapture(event.pointerId) } catch { /* the pointer may already be gone */ }
    }
    set(at(event), true)
  })
  stage.addEventListener('pointerup', event => {
    if (press && press.id === event.pointerId && !press.dragging) {
      const moved = Math.abs(event.clientX - press.x) + Math.abs(event.clientY - press.y)
      if (moved < 10) set(at(event), true)
    }
    press = null
  })
  stage.addEventListener('pointercancel', () => { press = null })

  handle.addEventListener('keydown', event => {
    const steps = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }
    let next = null
    if (event.key in steps) next = pos + steps[event.key]
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 100
    if (next === null) return
    event.preventDefault()
    set(next, true)
  })

  function stopIntro() {
    if (intro) cancelAnimationFrame(intro)
    intro = 0
    root.dataset.intro = 'done'
  }

  if (reduce.matches) {
    set(REST)
    root.dataset.intro = 'done'
    return
  }
  set(100)
  root.dataset.intro = 'run'
  const start = performance.now() + 1150
  const length = 1100
  const step = now => {
    if (root.dataset.intro !== 'run') return
    if (now >= start) {
      const t = Math.min(1, (now - start) / length)
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      set(100 - (100 - REST) * eased)
      if (t === 1) { intro = 0; root.dataset.intro = 'done'; return }
    }
    intro = requestAnimationFrame(step)
  }
  intro = requestAnimationFrame(step)
})()
