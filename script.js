document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('loading-screen');
  const appContainer = document.getElementById('app-container');
  const homeScreen = document.getElementById('home-screen');
  const formScreen = document.getElementById('form-screen');
  const successScreen = document.getElementById('success-screen');

  const btnStartRsvp = document.getElementById('btn-start-rsvp');
  const btnBackHome = document.getElementById('btn-back-home');
  const rsvpForm = document.getElementById('rsvp-form');
  const btnSubmitRsvp = document.getElementById('btn-submit-rsvp');
  const formErrorBanner = document.getElementById('form-error-banner');

  const ticketGuestName = document.getElementById('ticket-guest-name');
  const ticketGuestOrg = document.getElementById('ticket-guest-org');
  const ticketResId = document.getElementById('ticket-res-id');
  const ticketQrImg = document.getElementById('ticket-qr-img');
  const btnDownloadQr = document.getElementById('btn-download-qr');

  let currentReservationId = '';
  let currentQrDataUrl = '';

  // ==========================================
  // 1. LOADING SCREEN TRANSITION
  // ==========================================
  // Wait 2.6 seconds (giving enough time for progress animation)
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    appContainer.classList.remove('hidden');
    
    // Cleanup loading screen after transition completes
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 1000);
  }, 2600);

  // ==========================================
  // 2. NAVIGATION BETWEEN SCREENS
  // ==========================================
  function switchScreen(fromScreen, toScreen) {
    fromScreen.classList.remove('active');
    
    // Small delay to allow the fade-out transform to start
    setTimeout(() => {
      toScreen.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
  }

  btnStartRsvp.addEventListener('click', () => {
    switchScreen(homeScreen, formScreen);
  });

  btnBackHome.addEventListener('click', () => {
    switchScreen(formScreen, homeScreen);
  });

  // ==========================================
  // 3. FORM VALIDATION & SUBMISSION
  // ==========================================
  rsvpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    clearFormErrors();
    formErrorBanner.classList.add('hidden');
    formErrorBanner.textContent = '';

    // Extract form data
    const formData = {
      name: document.getElementById('fullName').value.trim(),
      email: document.getElementById('emailAddress').value.trim(),
      phone: document.getElementById('phoneNumber').value.trim(),
      organization: document.getElementById('organization').value.trim(),
      mealPreference: document.getElementById('mealPreference').value,
      specialRequests: document.getElementById('specialRequests').value.trim()
    };

    // Client-side validation
    let hasError = false;

    if (!formData.name) {
      showInputError('fullName', 'Full Name is required.');
      hasError = true;
    }
    
    if (!formData.email) {
      showInputError('emailAddress', 'Email Address is required.');
      hasError = true;
    } else if (!validateEmail(formData.email)) {
      showInputError('emailAddress', 'Please enter a valid email address.');
      hasError = true;
    }

    if (!formData.phone) {
      showInputError('phoneNumber', 'Phone Number is required.');
      hasError = true;
    }

    if (!formData.organization) {
      showInputError('organization', 'Organization is required.');
      hasError = true;
    }



    if (hasError) {
      formErrorBanner.textContent = 'Please fill out all required fields correctly.';
      formErrorBanner.classList.remove('hidden');
      return;
    }

    // Submit via AJAX
    setSubmitState(true);

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        // Success
        currentReservationId = result.reservationId;
        currentQrDataUrl = result.qrDataUrl;

        // Render ticket info
        ticketGuestName.textContent = formData.name;
        ticketGuestOrg.textContent = formData.organization;
        ticketResId.textContent = currentReservationId;
        ticketQrImg.src = currentQrDataUrl;

        // Switch to success screen
        switchScreen(formScreen, successScreen);
      } else {
        // Validation/database error from server
        formErrorBanner.textContent = result.error || 'Registration failed. Please try again.';
        formErrorBanner.classList.remove('hidden');
        window.scrollTo({ top: formErrorBanner.offsetTop - 50, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('RSVP Submission error:', err);
      formErrorBanner.textContent = 'Server connectivity issue. Please check your network connection.';
      formErrorBanner.classList.remove('hidden');
    } finally {
      setSubmitState(false);
    }
  });

  // Helper validation functions
  function validateEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  }

  function showInputError(inputId, message) {
    const inputEl = document.getElementById(inputId);
    const parent = inputEl.parentElement;
    parent.classList.add('invalid');
    
    const errorEl = document.getElementById(`err-${inputId}`);
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  function clearFormErrors() {
    const invalidGroups = rsvpForm.querySelectorAll('.input-group.invalid');
    invalidGroups.forEach(group => group.classList.remove('invalid'));
    
    const errorMsgs = rsvpForm.querySelectorAll('.error-msg');
    errorMsgs.forEach(msg => msg.textContent = '');
  }

  function setSubmitState(isLoading) {
    if (isLoading) {
      btnSubmitRsvp.disabled = true;
      btnSubmitRsvp.querySelector('.btn-text').textContent = 'PROCESSING RSVP...';
      btnSubmitRsvp.style.opacity = '0.7';
    } else {
      btnSubmitRsvp.disabled = false;
      btnSubmitRsvp.querySelector('.btn-text').textContent = 'CONFIRM ATTENDANCE';
      btnSubmitRsvp.style.opacity = '1';
    }
  }

  // ==========================================
  // 4. DOWNLOAD QR TICKET FEATURE
  // ==========================================
  btnDownloadQr.addEventListener('click', () => {
    if (!currentQrDataUrl) return;
    
    const link = document.createElement('a');
    link.href = currentQrDataUrl;
    link.download = `FIFA_2026_VIP_Ticket_${currentReservationId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
});
