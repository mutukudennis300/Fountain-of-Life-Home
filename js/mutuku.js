// #region agent log
const __agentLog = (hypothesisId, message, data) => {
  fetch('http://127.0.0.1:7797/ingest/0bf56bc0-2e30-47ee-90e9-6d3b3e4e58c9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1fec7d' },
    body: JSON.stringify({
      sessionId: '1fec7d',
      hypothesisId,
      location: 'mutuku.js',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
// #endregion

const siteWhatsAppLink = 'https://wa.me/254714042012?text=Hello%20Fountain%20of%20Life,%20I%20would%20like%20to%20know%20more.';
const siteEmail = 'fountainboys300@gmail.com';

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

function buildMailtoLink(subject, body) {
  return `mailto:${siteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

  const donateButton = document.querySelector('[data-donate-button]');
  const amountInput = document.getElementById('customAmount');

  if (donateButton && amountInput) {
    donateButton.addEventListener('click', () => {
      const amount = amountInput.value.trim();
      if (amount) {
        openDonationLink(amount);
      } else {
        window.open(siteWhatsAppLink, '_blank', 'noopener,noreferrer');
      }
    });
  }

  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = reviewForm.querySelector('input[name="name"]').value.trim();
      const review = reviewForm.querySelector('textarea[name="review"]').value.trim();
      const summary = `Name: ${name || 'Anonymous'}\n\nReview:\n${review || 'No review provided.'}`;
      const mailtoLink = buildMailtoLink('New website review', summary);
      window.location.href = mailtoLink;
      reviewForm.reset();
      const message = reviewForm.querySelector('.form-feedback');
      if (message) {
        message.textContent = 'Thank you for your feedback. Your message is ready to be sent.';
      }
    });
  }

  const contactForm = document.querySelector('form[action*="formsubmit.co"]');
  if (contactForm) {
    contactForm.addEventListener('submit', () => {
      const url = new URL(contactForm.action);
      url.searchParams.set('subject', 'New Website Inquiry');
      contactForm.action = url.toString();
    });
  }

  const volunteerForm = document.querySelector('form[action*="formspree.io"]');
  if (volunteerForm) {
    volunteerForm.addEventListener('submit', () => {
      volunteerForm.setAttribute('target', '_self');
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

    // #region agent log
    __agentLog('D', 'faq-init', {
      page: document.location.pathname,
      sectionCount: sections.length,
      hasSearchInput: !!searchInput,
    });
    // #endregion

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


