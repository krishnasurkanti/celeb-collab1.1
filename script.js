(() => {
  const body = document.body;
  const page = body.dataset.page || "home";
  const GOOGLE_SCRIPT_URL = body.dataset.googleScriptUrl || "";

  const validators = {
    email(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    },
    phone(value) {
      const cleaned = value.replace(/\D/g, "");
      return value.trim() === "" || (/^[\d+\-\s()]{10,}$/.test(value.trim()) && cleaned.length >= 10);
    }
  };

  function setFieldError(field, message) {
    if (!field) return;
    field.classList.toggle("error", Boolean(message));
    const errorText = field.querySelector(".error-text");
    if (errorText) errorText.textContent = message || "";
  }

  async function submitToGoogleSheets(formData) {
    if (!GOOGLE_SCRIPT_URL) return { ok: false, reason: "missing-url" };
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(formData),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: "network-error" };
    }
  }

  function trackLead() {
    if (typeof window.fbq === "function") {
      window.fbq("track", "Lead");
    }
  }

  function setSubmittingState(form, isSubmitting, label) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;
    if (!submitButton.dataset.defaultLabel) {
      submitButton.dataset.defaultLabel = submitButton.textContent;
    }
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? (label || "Submission in process...") : submitButton.dataset.defaultLabel;
  }

  function setupFadeIn() {
    const fadeItems = document.querySelectorAll(".fade-in");
    if (!fadeItems.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    fadeItems.forEach((item) => observer.observe(item));
  }

  function setupHomePage() {
    setupFadeIn();
    const backToTopButton = document.getElementById("back-to-top");
    backToTopButton?.addEventListener("click", () => {
      document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const form = document.getElementById("contact-form");
    if (!form) return;
    const successMessage = form.querySelector(".success-message");
    const inputs = form.querySelectorAll("input, textarea");

    function validateInput(input) {
      const field = input.closest(".field");
      if (!field) return true;
      const value = input.value.trim();
      let message = "";
      if (input.required && !value) message = "This field is required.";
      else if (input.type === "email" && value && !validators.email(value)) message = "Enter a valid email.";
      setFieldError(field, message);
      return !message;
    }

    inputs.forEach((input) => {
      input.addEventListener("blur", () => validateInput(input));
      input.addEventListener("input", () => {
        if (input.closest(".field")?.classList.contains("error")) validateInput(input);
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      let isValid = true;
      inputs.forEach((input) => { if (!validateInput(input)) isValid = false; });
      if (!isValid) {
        successMessage.classList.remove("show");
        successMessage.textContent = "";
        form.querySelector(".field.error input, .field.error textarea")?.focus();
        return;
      }
      setSubmittingState(form, true, "Submission in process...");
      const payload = {
        formType: "contact",
        submittedAt: new Date().toISOString(),
        name: form.querySelector('[name="name"]').value.trim(),
        email: form.querySelector('[name="email"]').value.trim(),
        message: form.querySelector('[name="message"]').value.trim()
      };
      const submitResult = await submitToGoogleSheets(payload);
      if (!submitResult.ok && GOOGLE_SCRIPT_URL) {
        setSubmittingState(form, false);
        successMessage.textContent = "Submission failed. Please try again.";
        successMessage.classList.add("show");
        return;
      }
      trackLead();
      successMessage.textContent = GOOGLE_SCRIPT_URL ? "Your message has been sent." : "Add your Google Script URL to save submissions to Sheets.";
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2200);
      form.reset();
      form.querySelectorAll(".field").forEach((field) => setFieldError(field, ""));
      setSubmittingState(form, false);
    });
  }

  function setupCreatorPage() {
    const form = document.getElementById("creator-form");
    if (!form) return;
    const platformField = document.getElementById("platform-field");
    const platformCheckboxes = document.querySelectorAll('input[name="platforms"]');
    const platformCards = document.querySelectorAll("[data-platform-card]");
    const successMessage = form.querySelector(".success-message");

    function updatePlatformCards() {
      platformCards.forEach((card) => {
        const platform = card.dataset.platformCard;
        const checkbox = document.querySelector(`input[name="platforms"][value="${platform}"]`);
        const isActive = Boolean(checkbox?.checked);
        card.classList.toggle("active", isActive);
        card.querySelectorAll("[data-platform-required]").forEach((input) => {
          input.required = isActive;
          if (!isActive) {
            input.value = "";
            setFieldError(input.closest(".field"), "");
          }
        });
      });
      const hasSelection = Array.from(platformCheckboxes).some((checkbox) => checkbox.checked);
      setFieldError(platformField, hasSelection ? "" : "Select at least one platform.");
    }

    function validateInput(input) {
      if (input.type === "checkbox" && input.name === "platforms") {
        const hasSelection = Array.from(platformCheckboxes).some((checkbox) => checkbox.checked);
        setFieldError(platformField, hasSelection ? "" : "Select at least one platform.");
        return hasSelection;
      }
      const field = input.closest(".field");
      if (!field) return true;
      const value = input.value.trim();
      let message = "";
      if (input.required && !value) message = "This field is required.";
      else if (input.type === "email" && value && !validators.email(value)) message = "Enter a valid email.";
      else if (input.type === "tel" && value && !validators.phone(value)) message = "Enter a valid phone number.";
      setFieldError(field, message);
      return !message;
    }

    form.querySelectorAll("input").forEach((input) => {
      input.addEventListener("blur", () => validateInput(input));
      input.addEventListener("input", () => {
        if (input.closest(".field")?.classList.contains("error")) validateInput(input);
      });
    });
    platformCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", updatePlatformCards));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      let isValid = true;
      if (!Array.from(platformCheckboxes).some((checkbox) => checkbox.checked)) {
        setFieldError(platformField, "Select at least one platform.");
        isValid = false;
      }
      form.querySelectorAll("input").forEach((input) => { if (!validateInput(input)) isValid = false; });
      if (!isValid) {
        successMessage.classList.remove("show");
        successMessage.textContent = "";
        form.querySelector(".field.error input")?.focus();
        return;
      }
      setSubmittingState(form, true, "Submission in process...");
      const payload = {
        formType: "creator",
        submittedAt: new Date().toISOString(),
        name: form.querySelector('[name="name"]').value.trim(),
        platforms: Array.from(platformCheckboxes).filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value).join(", "),
        instagramUsername: form.querySelector('[name="instagramUsername"]').value.trim(),
        instagramLink: form.querySelector('[name="instagramLink"]').value.trim(),
        youtubeName: form.querySelector('[name="youtubeName"]').value.trim(),
        youtubeLink: form.querySelector('[name="youtubeLink"]').value.trim(),
        facebookUsername: form.querySelector('[name="facebookUsername"]').value.trim(),
        facebookLink: form.querySelector('[name="facebookLink"]').value.trim(),
        otherPlatformName: form.querySelector('[name="otherPlatformName"]').value.trim(),
        otherPlatformLink: form.querySelector('[name="otherPlatformLink"]').value.trim(),
        email: form.querySelector('[name="email"]').value.trim(),
        phone: form.querySelector('[name="phone"]').value.trim(),
        niche: form.querySelector('[name="category"]').value.trim(),
        followers: form.querySelector('[name="followers"]').value.trim(),
        rate: form.querySelector('[name="rate"]').value.trim()
      };
      const submitResult = await submitToGoogleSheets(payload);
      if (!submitResult.ok && GOOGLE_SCRIPT_URL) {
        setSubmittingState(form, false);
        successMessage.textContent = "Submission failed. Please try again.";
        successMessage.classList.add("show");
        return;
      }
      trackLead();
      successMessage.textContent = GOOGLE_SCRIPT_URL ? "Your creator details have been submitted." : "Add your Google Script URL to save submissions to Sheets.";
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2400);
      form.reset();
      form.querySelectorAll(".field").forEach((field) => setFieldError(field, ""));
      updatePlatformCards();
      setSubmittingState(form, false);
    });

    updatePlatformCards();
  }

  function setupBusinessPage() {
    const form = document.getElementById("business-form");
    if (!form) return;
    const businessServiceField = document.getElementById("business-service-field");
    const businessServiceInputs = document.querySelectorAll('input[name="businessService"]');
    const businessInfluencerFields = document.getElementById("business-influencer-fields");
    const successMessage = form.querySelector(".success-message");

    function updateBusinessFields() {
      const selectedService = form.querySelector('input[name="businessService"]:checked')?.value;
      const showInfluencerFields = selectedService === "influencer";
      businessInfluencerFields.style.display = showInfluencerFields ? "grid" : "none";
      businessInfluencerFields.querySelectorAll("[data-business-influencer-required]").forEach((input) => {
        input.required = showInfluencerFields;
        if (!showInfluencerFields) {
          input.value = "";
          setFieldError(input.closest(".field"), "");
        }
      });
      businessInfluencerFields.querySelectorAll('input:not([data-business-influencer-required]), select:not([data-business-influencer-required])').forEach((input) => {
        if (!showInfluencerFields) {
          input.value = "";
          setFieldError(input.closest(".field"), "");
        }
      });
      setFieldError(businessServiceField, selectedService ? "" : "Select one option.");
    }

    function validateInput(input) {
      if (input.type === "radio" && input.name === "businessService") {
        const checked = form.querySelector('input[name="businessService"]:checked');
        setFieldError(businessServiceField, checked ? "" : "Select one option.");
        return Boolean(checked);
      }
      const field = input.closest(".field");
      if (!field) return true;
      const value = input.value.trim();
      let message = "";
      if (input.required && !value) message = "This field is required.";
      else if (input.type === "email" && value && !validators.email(value)) message = "Enter a valid email.";
      else if (input.type === "tel" && value && !validators.phone(value)) message = "Enter a valid phone number.";
      setFieldError(field, message);
      return !message;
    }

    businessServiceInputs.forEach((input) => input.addEventListener("change", updateBusinessFields));
    form.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("blur", () => validateInput(input));
      input.addEventListener("input", () => {
        if (input.closest(".field")?.classList.contains("error")) validateInput(input);
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      let isValid = true;
      form.querySelectorAll("input, select").forEach((input) => { if (!validateInput(input)) isValid = false; });
      if (!isValid) {
        successMessage.classList.remove("show");
        successMessage.textContent = "";
        form.querySelector(".field.error input, .field.error select")?.focus();
        return;
      }
      setSubmittingState(form, true, "Submission in process...");
      const payload = {
        formType: "business",
        submittedAt: new Date().toISOString(),
        name: form.querySelector('[name="name"]').value.trim(),
        businessName: form.querySelector('[name="businessName"]').value.trim(),
        service: form.querySelector('input[name="businessService"]:checked')?.value || "",
        platform: form.querySelector('[name="platform"]').value.trim(),
        budget: form.querySelector('[name="budget"]').value.trim(),
        influencerCount: form.querySelector('[name="influencerCount"]').value.trim(),
        niche: form.querySelector('[name="niche"]').value.trim(),
        preferredFollowers: form.querySelector('[name="preferredFollowers"]').value.trim(),
        email: form.querySelector('[name="email"]').value.trim(),
        phone: form.querySelector('[name="phone"]').value.trim()
      };
      const submitResult = await submitToGoogleSheets(payload);
      if (!submitResult.ok && GOOGLE_SCRIPT_URL) {
        setSubmittingState(form, false);
        successMessage.textContent = "Submission failed. Please try again.";
        successMessage.classList.add("show");
        return;
      }
      trackLead();
      successMessage.textContent = GOOGLE_SCRIPT_URL ? "Your business details have been submitted." : "Add your Google Script URL to save submissions to Sheets.";
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2400);
      form.reset();
      form.querySelectorAll(".field").forEach((field) => setFieldError(field, ""));
      updateBusinessFields();
      setSubmittingState(form, false);
    });

    updateBusinessFields();
  }

  if (page === "home") setupHomePage();
  if (page === "creator") setupCreatorPage();
  if (page === "business") setupBusinessPage();
})();
