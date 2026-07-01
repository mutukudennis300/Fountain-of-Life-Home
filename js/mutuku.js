/* --- DROPDOWN TOGGLE (Mobile & Desktop) --- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.dropbtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropdownContent = btn.nextElementSibling;
      
      // Close other dropdowns
      document.querySelectorAll('.dropdown-content.show').forEach(content => {
        if (content !== dropdownContent) {
          content.classList.remove('show');
        }
      });
      
      // Toggle current dropdown
      if (dropdownContent && dropdownContent.classList.contains('dropdown-content')) {
        dropdownContent.classList.toggle('show');
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown-content.show').forEach(content => {
        content.classList.remove('show');
      });
    }
  });
});

/* FAQ ACCORDION */
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const item = button.parentElement;
        item.classList.toggle('active');
    });
});


/* BACK TO TOP BUTTON */
const backToTopBtn = document.getElementById("backToTop");

// Only run the logic if the button actually exists on the page
if (backToTopBtn) {
  window.onscroll = function () {
    if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
      backToTopBtn.style.display = "block";
    } else {
      backToTopBtn.style.display = "none";
    }
  };

  backToTopBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

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
        const searchTerm = searchInput.value.toLowerCase();

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


