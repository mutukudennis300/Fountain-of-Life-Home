const siteWhatsAppLink = 'https://wa.me/254716863607?text=Hello%20Fountain%20of%20Life,%20I%20would%20like%20to%20know%20more.';
const API_BASE = 'https://fountain-backend.mutukudennis300.workers.dev';

function copyText(text) {
  const value = String(text || '').trim();
  if (!value) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).catch(() => {});
  }

  window.alert(`Copied: ${value}`);
}

function openDonationLink(amount = '') {
  const safeAmount = String(amount || '').trim();
  const message = safeAmount ? `Hello%20Fountain%20of%20Life,%20I%20would%20like%20to%20donate%20Ksh%20${encodeURIComponent(safeAmount)}.` : 'Hello%20Fountain%20of%20Life,%20I%20would%20like%20to%20support%20your%20work.';
  window.open(`${siteWhatsAppLink.replace('Hello%20Fountain%20of%20Life,%20I%20would%20like%20to%20know%20more.', message)}`, '_blank', 'noopener,noreferrer');
}

/* --- DROPDOWN TOGGLE (Mobile & Desktop) --- */
function closeAllDropdowns(exceptContent = null) {
  document.querySelectorAll('.dropdown-content.show').forEach(content => {
    if (content !== exceptContent) {
      content.classList.remove('show');
    }
  });
}

function toggleDropdown(button) {
  const dropdown = button?.closest('.dropdown');
  const dropdownContent = dropdown?.querySelector('.dropdown-content');

  if (!dropdown || !dropdownContent) return;

  const shouldOpen = !dropdownContent.classList.contains('show');
  closeAllDropdowns(shouldOpen ? dropdownContent : null);
  dropdownContent.classList.toggle('show', shouldOpen);
  button.setAttribute('aria-expanded', String(shouldOpen));
}

document.addEventListener('click', (e) => {
  const button = e.target.closest('.dropbtn');

  if (button) {
    e.preventDefault();
    e.stopImmediatePropagation();
    toggleDropdown(button);
    return;
  }

  if (!e.target.closest('.dropdown')) {
    closeAllDropdowns();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const statFields = {
    'stat-boys': 'boys_accommodated',
    'stat-highschool': 'high_school_boys',
    'stat-served': 'children_served',
    'stat-graduates': 'college_graduates',
  };
  if (Object.keys(statFields).some(id => document.getElementById(id))) {
    fetch(`${API_BASE}/api/stats`)
      .then(response => {
        if (!response.ok) throw new Error(`Stats request failed (${response.status}).`);
        return response.json();
      })
      .then(data => {
        for (const [id, field] of Object.entries(statFields)) {
          const element = document.getElementById(id);
          const value = data[field];
          if (element && (typeof value === 'string' || typeof value === 'number')) {
            element.textContent = String(value);
          }
        }
      })
      .catch(error => {
        console.error('Could not load live impact stats.', error);
      });
  }

  const status = new URLSearchParams(window.location.search).get('status');
  const formStatus = document.querySelector('[data-form-status]');
  const statusMessages = {
    success: 'Thank you. Your message was submitted successfully.',
    'review-success': 'Thank you. Your feedback was submitted successfully.',
  };
  if (formStatus && status === formStatus.dataset.formStatus && statusMessages[status]) {
    formStatus.hidden = false;
    formStatus.textContent = statusMessages[status];
  }

  const donateButton = document.querySelector('[data-donate-button]');
  const amountInput = document.getElementById('customAmount');
  const phoneInput = document.getElementById('mpesaPhone');
  const donationStatus = document.querySelector('[data-stk-status]');

  if (donateButton && amountInput && phoneInput && donationStatus) {
    donateButton.addEventListener('click', async () => {
      const apiBase = donateButton.dataset.stkApi?.trim().replace(/\/+$/, '');
      if (!apiBase) {
        donationStatus.textContent = 'Online M-Pesa is not yet set up. Please use the Paybill below.';
        return;
      }

      const isLocalPreview = window.location.hostname === '127.0.0.1'
        || window.location.hostname === 'localhost';
      if (isLocalPreview) {
        donationStatus.textContent = 'Online M-Pesa requests work on the live website only. Please use the Paybill for this local preview.';
        return;
      }

      const amount = Number(amountInput.value);
      if (!Number.isInteger(amount) || amount < 1 || amount > 250000) {
        donationStatus.textContent = 'Enter a whole amount from KSh 1 to KSh 250,000.';
        amountInput.focus();
        return;
      }

      const phoneNumber = phoneInput.value.trim();
      if (!phoneNumber) {
        donationStatus.textContent = 'Enter the M-Pesa phone number that should receive the payment prompt.';
        phoneInput.focus();
        return;
      }

      donateButton.disabled = true;
      donationStatus.textContent = 'Sending a secure request to M-Pesa...';

      try {
        const response = await fetch(`${apiBase}/api/mpesa/stkpush`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, phoneNumber }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result) {
          throw new Error(result?.error || 'The payment service could not accept the request.');
        }

        donationStatus.textContent = result.message;
        const statusToken = result.statusToken;
        if (result.status === 'pending' && typeof statusToken === 'string') {
          for (let attempt = 0; attempt < 30; attempt += 1) {
            await new Promise(resolve => window.setTimeout(resolve, 4000));
            const statusResponse = await fetch(`${apiBase}/api/mpesa/status`, {
              headers: { Authorization: `Bearer ${statusToken}` },
            });
            const statusResult = await statusResponse.json().catch(() => null);
            if (!statusResponse.ok || !statusResult) {
              throw new Error(statusResult?.error || 'Could not check the payment status.');
            }

            donationStatus.textContent = statusResult.message;
            if (statusResult.status === 'succeeded' || statusResult.status === 'failed') {
              break;
            }
          }
        }
      } catch (error) {
        if (error instanceof TypeError) {
          donationStatus.textContent = 'Could not connect to the payment service. Please use the Paybill below or try again later.';
        } else {
          donationStatus.textContent = error instanceof Error
            ? error.message
            : 'The payment request could not be completed. Please use the Paybill below.';
        }
      } finally {
        donateButton.disabled = false;
      }
    });
  }

  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = reviewForm.querySelector('button[type="submit"]');
      const message = reviewForm.querySelector('.form-feedback');
      if (!submitButton || !message) return;

      submitButton.disabled = true;
      message.classList.remove('is-error');
      message.textContent = 'Sending your feedback...';

      try {
        const endpoint = new URL(reviewForm.action);
        endpoint.pathname = `/ajax${endpoint.pathname}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(Object.fromEntries(new FormData(reviewForm))),
        });
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error('The form service returned an unreadable response. Please try again later.');
        }

        if (
          !response.ok ||
          !result ||
          (result.success !== true && result.success !== 'true')
        ) {
          throw new Error(result.message || 'The form service could not accept your feedback.');
        }

        reviewForm.reset();
        message.textContent = 'Thank you. Your feedback was submitted successfully.';
      } catch (error) {
        message.classList.add('is-error');
        message.textContent = error instanceof Error
          ? `Your feedback could not be submitted. ${error.message}`
          : 'Your feedback could not be submitted. Please try again.';
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = contactForm.querySelector('button[type="submit"]');
      const message = document.querySelector('[data-form-status="success"]');
      if (!submitButton || !message) return;

      submitButton.disabled = true;
      message.hidden = false;
      message.textContent = 'Sending your message...';

      const formData = new FormData(contactForm);
      const payload = {
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        inquiry_type: String(formData.get('inquiry_type') ?? 'General'),
        message: String(formData.get('message') ?? ''),
      };

      try {
        const response = await fetch(`${API_BASE}/api/inquiries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'The inquiry service could not accept your message.');
        }

        contactForm.reset();
        message.textContent = 'Asante! Your message has been received by Fountain of Life.';
      } catch (error) {
        message.textContent = error instanceof Error
          ? `${error.message} Please call or WhatsApp +254 722 308 846.`
          : 'Your message could not be sent. Please call or WhatsApp +254 722 308 846.';
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  const volunteerForm = document.querySelector('form[action*="formspree.io"]');
  if (volunteerForm) {
    volunteerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = volunteerForm.querySelector('button[type="submit"]');
      const message = volunteerForm.querySelector('.form-feedback');
      if (!submitButton || !message) return;

      submitButton.disabled = true;
      message.classList.remove('is-error');
      message.textContent = 'Sending your application...';

      try {
        const response = await fetch(volunteerForm.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(volunteerForm),
        });

        if (!response.ok) {
          throw new Error(`The form service returned status ${response.status}. Please try again.`);
        }

        volunteerForm.reset();
        message.textContent = 'Thank you. Your volunteer application was submitted successfully.';
      } catch (error) {
        message.classList.add('is-error');
        message.textContent = error instanceof Error
          ? `Your application could not be submitted. ${error.message}`
          : 'Your application could not be submitted. Please try again.';
      } finally {
        submitButton.disabled = false;
      }
    });
  }
});

/* FAQ ACCORDION */
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const item = button.parentElement;
        item.classList.toggle('active');
    });
});


/* BACK TO TOP BUTTON */
function initBackToTop() {
  let backToTopBtn = document.getElementById('backToTop');

  if (!backToTopBtn) {
    backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'backToTop';
    backToTopBtn.type = 'button';
    backToTopBtn.setAttribute('aria-label', 'Back to top');
    backToTopBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    document.body.appendChild(backToTopBtn);
  }

  const toggleVisibility = () => {
    const shouldShow = window.scrollY > 220;
    backToTopBtn.classList.toggle('show', shouldShow);
  };

  toggleVisibility();
  window.addEventListener('scroll', toggleVisibility, { passive: true });
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

initBackToTop();

/* index PAGE: FILTER & CARDS */
const filterItems = document.querySelectorAll('.filter-item');
const storyCards = document.querySelectorAll('.story-card');

filterItems.forEach(item => {
  item.addEventListener('click', () => {
    const filter = item.getAttribute('data-filter');

    // Update active state
    filterItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    // Show/hide cards
    storyCards.forEach(card => {
      if (filter === 'all' || card.classList.contains(filter)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// faqs section

document.addEventListener('DOMContentLoaded', () => {
    const questions = document.querySelectorAll('.faq-question');
    const filterButtons = document.querySelectorAll('.category-btn');
    const sections = document.querySelectorAll('.faq-section');
    const searchInput = document.getElementById('faqSearch');

    if (sections.length === 0 && filterButtons.length === 0 && questions.length === 0) {
      return;
    }

    // 1. Accordion Logic (Opening the plus sign)
    questions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            // Close others (Optional)
            document.querySelectorAll('.faq-item').forEach(i => {
                if(i !== item) i.classList.remove('active');
            });
            item.classList.toggle('active');
        });
    });

    // 2. Combined Filter & Search Logic
    function applyFilters() {
        const activeBtn = document.querySelector('.category-btn.active');
        const selectedCategory = activeBtn ? activeBtn.textContent.trim() : 'Admissions';
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        sections.forEach(section => {
            const sectionCategory = section.getAttribute('data-category');
            const sectionText = section.innerText.toLowerCase();
            
            // Match Category AND Search Term
            const matchesCategory = (sectionCategory === selectedCategory);
            const matchesSearch = sectionText.includes(searchTerm);

            if (matchesCategory && matchesSearch) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
    }

    // 3. Event Listeners
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        });
    });

    if(searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    // 4. Run once on load to show Admissions
    applyFilters();
});


// 1. Close dropdown when clicking anywhere else
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-content.show').forEach(content => {
      content.classList.remove('show');
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // 1. Create and inject the modal layout dynamically into the body
  const lightbox = document.createElement("div");
  lightbox.id = "custom-lightbox";
  lightbox.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    display: none;
    justify-content: center;
    align-items: center;
    cursor: zoom-out;
    opacity: 0;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(8px);
  `;

  const lightboxImg = document.createElement("img");
  lightboxImg.style.cssText = `
    max-width: 90%;
    max-height: 80%;
    border-radius: 8px;
    box-shadow: 0px 10px 30px rgba(0,0,0,0.5);
    transform: scale(0.95);
    transition: transform 0.3s ease;
  `;

  const closeBtn = document.createElement("span");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.cssText = `
    position: absolute;
    top: 20px; right: 30px;
    color: #fff; font-size: 40px; font-weight: bold;
    cursor: pointer;
  `;

  lightbox.appendChild(closeBtn);
  lightbox.appendChild(lightboxImg);
  document.body.appendChild(lightbox);

  // 2. Add click/tap handlers to all gallery images
  const galleryItems = document.querySelectorAll(".gallery-item img");
  galleryItems.forEach(img => {
    // Add a pointer cursor to indicate clickability
    img.style.cursor = "zoom-in";
    
    img.addEventListener("click", (e) => {
      // Don't activate if clicking the logo container card
      if (img.alt === "Logo") return;

      lightboxImg.src = img.src;
      lightbox.style.display = "flex";
      
      // Smooth fade-in animation trigger
      setTimeout(() => {
        lightbox.style.opacity = "1";
        lightboxImg.style.transform = "scale(1)";
      }, 10);
    });
  });

  // 3. Close modal actions
  const closeModal = () => {
    lightbox.style.opacity = "0";
    lightboxImg.style.transform = "scale(0.95)";
    setTimeout(() => {
      lightbox.style.display = "none";
    }, 300);
  };

  lightbox.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
});
