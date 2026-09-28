/* Mr. Brick — site script. No dependencies. Everything is progressive
   enhancement: navigation, forms and the gallery all work without JS. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  root.classList.add('js');

  var PAGE_TYPE = (doc.body && doc.body.getAttribute('data-page-type')) || 'page';
  var SERVICE = (doc.body && doc.body.getAttribute('data-service')) || '';

  /* ======================================================================
     1. TRACKING — one place for every analytics event.
     Events go to window.dataLayer. GTM (if configured) maps them to GA4 and
     Google Ads. No personal data (name, phone, email, message, address) is
     ever pushed. See docs/analytics-event-map.md.
     ====================================================================== */
  window.dataLayer = window.dataLayer || [];
  function device() {
    var w = window.innerWidth;
    return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  }
  function track(event, params) {
    var payload = { event: event, page_type: PAGE_TYPE, device_type: device() };
    if (SERVICE) payload.service_page = SERVICE;
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) payload[k] = params[k];
    window.dataLayer.push(payload);
  }
  window.mrBrickTrack = track;

  function locationOf(el) {
    var host = el.closest('[data-cta-location]');
    return host ? host.getAttribute('data-cta-location') : 'body';
  }

  if (PAGE_TYPE === 'service') track('view_service', { service_name: SERVICE });

  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var loc = locationOf(a);
    if (href.indexOf('tel:') === 0) {
      track('click_phone', { cta_location: loc });
      return;
    }
    if (href.indexOf('sms:') === 0) { track('click_text', { cta_location: loc }); return; }
    if (href.indexOf('mailto:') === 0) { track('click_email', { cta_location: loc }); return; }
    if (a.hasAttribute('data-cta')) {
      track('cta_click', { cta_id: a.getAttribute('data-cta'), cta_location: loc });
    }
    if (/\/request-quote(\b|$|#)/.test(href)) track('click_quote', { cta_location: loc });
    if (/\/finance(\b|$)/.test(href)) track('financing_click', { cta_location: loc });
    if (a.hasAttribute('data-review-link')) track('review_click', { review_platform: a.getAttribute('data-review-link') });
    if (a.closest('.primary-nav, .site-footer')) {
      track('navigation_click', { nav_area: a.closest('.primary-nav') ? 'header' : 'footer', nav_item: (a.textContent || '').trim().slice(0, 60) });
    }
  }, { capture: true });

  /* ======================================================================
     2. ATTRIBUTION — first + last touch, stored first-party, copied into the
     quote form as hidden fields so leads carry their source into the inbox.
     ====================================================================== */
  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid'];
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (err) { /* storage blocked */ } }
  function load(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (err) { return null; } }

  (function captureAttribution() {
    var params = new URLSearchParams(location.search);
    var touch = { landing_page: location.pathname, referrer: doc.referrer || '(direct)', ts: new Date().toISOString() };
    var hasParams = false;
    ATTR_KEYS.forEach(function (k) { var v = params.get(k); if (v) { touch[k] = v.slice(0, 150); hasParams = true; } });
    var externalRef = doc.referrer && doc.referrer.indexOf(location.host) === -1;
    if (!load('mb_first_touch')) store('mb_first_touch', touch);
    // A new last touch = a new campaign click or an external referral, not an internal page view.
    if (hasParams || externalRef || !load('mb_last_touch')) store('mb_last_touch', touch);
  })();

  function fillAttribution(form) {
    var first = load('mb_first_touch') || {};
    var last = load('mb_last_touch') || {};
    function set(name, val) { var f = form.querySelector('[name="' + name + '"]'); if (f) f.value = val || ''; }
    ATTR_KEYS.forEach(function (k) { set(k, last[k] || first[k]); });
    set('first_touch', [first.utm_source || '', first.utm_medium || '', first.referrer || '', first.landing_page || ''].join(' | '));
    set('last_touch', [last.utm_source || '', last.utm_medium || '', last.referrer || '', last.landing_page || ''].join(' | '));
    set('landing_page', first.landing_page);
    set('referrer', last.referrer);
    set('submitted_from', location.pathname);
  }

  /* ======================================================================
     3. NAVIGATION
     ====================================================================== */
  var toggle = doc.querySelector('.nav-toggle');
  var nav = doc.getElementById('primary-nav');
  function setNav(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    var header = doc.querySelector('.site-header');
    if (open && header && window.innerWidth < 1024) nav.style.top = Math.max(0, header.getBoundingClientRect().bottom) + 'px';
    else nav.style.top = '';
    var lbl = toggle.querySelector('.nav-toggle__label');
    if (lbl) lbl.textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('is-open', open);
    doc.body.style.overflow = open && window.innerWidth < 1024 ? 'hidden' : '';
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setNav(toggle.getAttribute('aria-expanded') !== 'true'); });
  }
  var subToggles = doc.querySelectorAll('.nav-sub-toggle');
  function closeSubs(except) {
    subToggles.forEach(function (b) {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false');
      var p = doc.getElementById(b.getAttribute('aria-controls'));
      if (p) p.classList.remove('is-open');
    });
  }
  subToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      closeSubs(btn);
      btn.setAttribute('aria-expanded', String(open));
      var panel = doc.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.classList.toggle('is-open', open);
    });
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openSub = doc.querySelector('.nav-sub-toggle[aria-expanded="true"]');
    if (openSub) { closeSubs(); openSub.focus(); return; }
    if (toggle && toggle.getAttribute('aria-expanded') === 'true') { setNav(false); toggle.focus(); }
  });
  doc.addEventListener('click', function (e) {
    if (window.innerWidth >= 1024 && !e.target.closest('.nav-list')) closeSubs();
  });

  /* ======================================================================
     4. PROMOTIONS — hide anything past its end date even if the build is stale.
     ====================================================================== */
  var today = new Date().toISOString().slice(0, 10);
  doc.querySelectorAll('[data-promo-ends]').forEach(function (el) {
    var ends = el.getAttribute('data-promo-ends');
    if (ends && ends < today) el.remove();
  });

  /* ======================================================================
     5. QUOTE FORM — multi-step with validation, Netlify Forms submission.
     ====================================================================== */
  var MAX_UPLOAD = 8 * 1024 * 1024; // Netlify Forms limit per submission

  doc.querySelectorAll('form[data-quote-form]').forEach(function (form) {
    var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
    var shell = form.closest('.quote') || form;
    var progress = shell.querySelectorAll('.progress li');
    var label = shell.querySelector('.progress-label');
    var alertBox = form.querySelector('.form-alert');
    var formId = form.getAttribute('data-quote-form');
    var current = 0;
    var started = false;

    fillAttribution(form);

    // Deep links like /request-quote?service=Chimney preselect the service.
    var wanted = new URLSearchParams(location.search).get('service');
    if (wanted) {
      var match = form.querySelector('input[name="service"][value="' + wanted.replace(/"/g, '') + '"]');
      if (match) match.checked = true;
    }

    function show(i) {
      current = i;
      steps.forEach(function (s, n) { s.hidden = n !== i; });
      progress.forEach(function (p, n) {
        p.classList.toggle('is-done', n < i);
        p.classList.toggle('is-current', n === i);
      });
      if (label) label.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
    }
    if (steps.length > 1) show(0);

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('form_start', { form_id: formId });
    });

    function fieldError(field, msg) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.toggle('has-error', !!msg);
      var err = wrap.querySelector('.error');
      if (err) {
        err.textContent = msg || '';
        if (!err.id) err.id = 'err-' + Math.random().toString(36).slice(2, 9);
      }
      var inputs = wrap.querySelectorAll('input, select, textarea');
      inputs.forEach(function (inp) {
        if (msg) { inp.setAttribute('aria-invalid', 'true'); if (err) inp.setAttribute('aria-describedby', err.id); }
        else { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); }
      });
    }

    function validate(scope) {
      var firstBad = null;
      var checked = {};
      scope.querySelectorAll('input, select, textarea').forEach(function (f) {
        if (f.type === 'hidden' || f.name === 'bot-field' || f.disabled) return;
        var msg = '';
        if (f.type === 'radio') {
          if (checked[f.name]) return;
          checked[f.name] = true;
          if (f.required && !scope.querySelector('input[name="' + f.name + '"]:checked')) msg = f.getAttribute('data-msg') || 'Please choose one.';
        } else if (f.type === 'file') {
          var total = 0;
          Array.prototype.forEach.call(f.files || [], function (file) { total += file.size; });
          if (total > MAX_UPLOAD) msg = 'Photos add up to more than 8 MB. Please choose fewer or smaller photos.';
        } else {
          var v = (f.value || '').trim();
          if (f.required && !v) msg = f.getAttribute('data-msg') || 'This field is required.';
          else if (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Enter an email like name@example.com.';
          else if (v && f.type === 'tel' && v.replace(/\D/g, '').length < 10) msg = 'Enter a 10-digit phone number.';
          else if (v && f.name === 'zip' && !/^\d{5}$/.test(v)) msg = 'Enter a 5-digit ZIP code.';
        }
        fieldError(f, msg);
        if (msg) {
          if (!firstBad) firstBad = f;
          track('form_error', { form_id: formId, field_name: f.name, step: current + 1 });
        }
      });
      if (firstBad) firstBad.focus();
      return !firstBad;
    }

    // Clear errors while typing so the layout doesn't shift under the next click.
    form.addEventListener('input', function (e) {
      if (e.target.closest('.field.has-error')) fieldError(e.target, '');
    });
    form.addEventListener('change', function (e) {
      var f = e.target;
      if (f.closest('.field.has-error')) fieldError(f, '');
      if (f.type === 'file' && f.files && f.files.length) track('file_upload', { form_id: formId, file_count: f.files.length });
    });

    form.addEventListener('click', function (e) {
      var next = e.target.closest('[data-next]');
      var back = e.target.closest('[data-back]');
      if (next) {
        e.preventDefault();
        if (!validate(steps[current])) return;
        track('form_step', { form_id: formId, step: current + 2 });
        show(current + 1);
        var nextStep = steps[current];
        var focusTarget = nextStep.querySelector('legend');
        if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus(); }
      }
      if (back) { e.preventDefault(); show(current - 1); }
    });

    form.addEventListener('submit', function (e) {
      // Honeypot filled => silently drop.
      var hp = form.querySelector('[name="bot-field"]');
      if (hp && hp.value) { e.preventDefault(); return; }
      if (!validate(steps.length > 1 ? steps[current] : form)) { e.preventDefault(); return; }
      if (!window.fetch || !window.FormData) return; // native POST fallback
      e.preventDefault();

      var btn = form.querySelector('[type="submit"]');
      if (btn) { btn.setAttribute('aria-busy', 'true'); btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; }
      if (alertBox) alertBox.classList.remove('is-visible');

      var service = (form.querySelector('[name="service"]:checked') || {}).value || '';
      var property = (form.querySelector('[name="property_type"]:checked') || {}).value || '';
      track('form_submit', { form_id: formId, service_type: service, property_type: property });

      fetch('/', { method: 'POST', body: new FormData(form) })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          // The conversion fires on /thank-you once, guarded by this flag.
          try { sessionStorage.setItem('mb_lead', JSON.stringify({ form_id: formId, service_type: service, property_type: property })); } catch (err) {}
          track('form_success', { form_id: formId, service_type: service, property_type: property });
          window.location.href = form.getAttribute('action') || '/thank-you';
        })
        .catch(function () {
          track('form_error', { form_id: formId, field_name: '(submit)', step: current + 1 });
          if (alertBox) {
            alertBox.innerHTML = 'Your request didn\u2019t go through. Check your connection and try again, or call or text <a href="tel:+15862093052">(586) 209-3052</a>.';
            alertBox.classList.add('is-visible');
            alertBox.focus();
          }
          if (btn) { btn.removeAttribute('aria-busy'); btn.textContent = btn.dataset.label; }
        });
    });
  });

  // Thank-you page: fire the lead conversion exactly once per submission.
  if (PAGE_TYPE === 'thank-you') {
    var lead = null;
    try { lead = JSON.parse(sessionStorage.getItem('mb_lead') || 'null'); sessionStorage.removeItem('mb_lead'); } catch (err) {}
    if (lead) track('quote_request', lead);
  }

  /* ======================================================================
     6. GALLERY — filter chips + <dialog> lightbox.
     ====================================================================== */
  var grid = doc.querySelector('[data-gallery]');
  if (grid) {
    var items = Array.prototype.slice.call(grid.querySelectorAll('li'));
    var chips = doc.querySelectorAll('[data-filter]');
    var status = doc.querySelector('[data-gallery-status]');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.getAttribute('data-filter');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        var shown = 0;
        items.forEach(function (li) {
          var match = f === 'all' || (' ' + li.getAttribute('data-tags') + ' ').indexOf(' ' + f + ' ') > -1;
          li.hidden = !match;
          if (match) shown++;
        });
        if (status) status.textContent = shown + ' photos shown';
        track('gallery_filter', { filter: f });
      });
    });
  }

  var dialog = doc.querySelector('.lightbox');
  if (dialog && typeof dialog.showModal === 'function') {
    var img = dialog.querySelector('.lightbox__img');
    var cap = dialog.querySelector('.lightbox__caption');
    var list = [];
    var idx = 0;
    function visibleCards() { return Array.prototype.slice.call(doc.querySelectorAll('[data-lightbox]')).filter(function (b) { return !b.closest('li[hidden]'); }); }
    function open(i) {
      var b = list[i]; if (!b) return;
      idx = i;
      img.src = b.getAttribute('data-full');
      img.alt = b.getAttribute('data-alt');
      cap.textContent = b.getAttribute('data-alt');
      track('view_project', { project_id: b.getAttribute('data-id') });
    }
    doc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lightbox]');
      if (!b) return;
      e.preventDefault();
      list = visibleCards();
      open(list.indexOf(b));
      dialog.showModal();
    });
    dialog.addEventListener('click', function (e) {
      if (e.target.closest('[data-lb-close]') || e.target === dialog) dialog.close();
      if (e.target.closest('[data-lb-prev]')) open((idx - 1 + list.length) % list.length);
      if (e.target.closest('[data-lb-next]')) open((idx + 1) % list.length);
    });
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') open((idx - 1 + list.length) % list.length);
      if (e.key === 'ArrowRight') open((idx + 1) % list.length);
    });
  }
})();
