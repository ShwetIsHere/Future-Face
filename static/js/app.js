/**
 * FutureFace — AI Powered Face Age Progression Client Logic
 * Multi-Page Application (Home, Try Now, About, Feedback)
 * Developed by Shwet Patel (heyshwet.me)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Target age boundary constraints
  const MIN_TARGET_AGE = 8;
  const MAX_TARGET_AGE = 90;

  // Safe DOM Helper Functions (Guarantees zero null pointer exceptions)
  function safeSetText(elOrId, text) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el.textContent = text;
  }

  function safeSetHTML(elOrId, html) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el.innerHTML = html;
  }

  function showToast(message, isError = true) {
    const errorToast = document.getElementById('errorToast');
    const toastMessage = document.getElementById('toastMessage');
    if (errorToast && toastMessage) {
      toastMessage.textContent = message;
      errorToast.style.backgroundColor = isError ? '#ef4444' : '#10b981';
      errorToast.classList.remove('hidden');
      setTimeout(() => {
        errorToast.classList.add('hidden');
      }, 5000);
    }
  }

  const toastClose = document.getElementById('toastClose');
  if (toastClose) {
    toastClose.addEventListener('click', () => {
      const errorToast = document.getElementById('errorToast');
      if (errorToast) errorToast.classList.add('hidden');
    });
  }

  // ============================================================
  // 1. THEME MANAGEMENT (Light & Dark Mode)
  // ============================================================
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('futureface-theme') || 'dark';

  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('futureface-theme', isDark ? 'dark' : 'light');
    });
  }

  // ============================================================
  // 2. MOBILE NAVIGATION MENU DRAWER
  // ============================================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');

  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.toggle('open');
      document.body.classList.toggle('mobile-menu-active', isOpen);
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        document.body.classList.remove('mobile-menu-active');
      });
    });

    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && e.target !== mobileMenuBtn) {
        navMenu.classList.remove('open');
        document.body.classList.remove('mobile-menu-active');
      }
    });
  }

  // ============================================================
  // 3. GPU HARDWARE HEALTH CHECK (Live PyTorch CUDA Detection)
  // ============================================================
  const statusDevice = document.getElementById('statusDevice');
  let detectedGpuName = 'NVIDIA RTX 3060 Laptop GPU';

  async function checkSystemHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.gpu && data.gpu !== 'None') {
          detectedGpuName = data.gpu.replace('NVIDIA GeForce ', '');
          if (statusDevice) {
            statusDevice.textContent = detectedGpuName + ' (Ready)';
          }
          const gpuFootnoteName = document.getElementById('gpuFootnoteName');
          if (gpuFootnoteName) {
            gpuFootnoteName.textContent = detectedGpuName;
          }
        } else {
          detectedGpuName = 'CPU Mode';
          if (statusDevice) statusDevice.textContent = 'CPU Mode';
          const gpuFootnoteName = document.getElementById('gpuFootnoteName');
          if (gpuFootnoteName) gpuFootnoteName.textContent = 'CPU Mode';
        }
      }
    } catch (err) {
      if (statusDevice) statusDevice.textContent = 'Online';
    }
  }
  checkSystemHealth();

  // ============================================================
  // 4. SPLIT SLIDER INITIALIZER FUNCTION (Mouse & Touch)
  // ============================================================
  function initSplitSlider(container, beforeWrap, handle, defaultPct = 50) {
    if (!container || !beforeWrap || !handle) return;

    let isDragging = false;

    function updatePosition(clientX) {
      const rect = container.getBoundingClientRect();
      let x = clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const pct = (x / rect.width) * 100;
      beforeWrap.style.clipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
      handle.style.left = `${pct}%`;
    }

    beforeWrap.style.clipPath = `polygon(0 0, ${defaultPct}% 0, ${defaultPct}% 100%, 0 100%)`;
    handle.style.left = `${defaultPct}%`;

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      updatePosition(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        updatePosition(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length === 0) return;
      updatePosition(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  // Initialize Home Hero Split Slider if present
  const heroSplitSlider = document.getElementById('heroSplitSlider');
  const heroBeforeWrap = document.getElementById('heroBeforeWrap');
  const heroSplitHandle = document.getElementById('heroSplitHandle');
  if (heroSplitSlider && heroBeforeWrap && heroSplitHandle) {
    initSplitSlider(heroSplitSlider, heroBeforeWrap, heroSplitHandle, 50);
  }

  // ============================================================
  // 5. GALLERY CATEGORY FILTERING (Home Page)
  // ============================================================
  const filterBtns = document.querySelectorAll('.gallery-filters .filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-grid .gallery-item');

  if (filterBtns.length > 0 && galleryItems.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        galleryItems.forEach(item => {
          const cat = item.dataset.category;
          if (filter === 'all' || cat === filter || (filter === 'sequence' && (cat === 'male' || cat === 'female'))) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  // ============================================================
  // 6. STANDALONE FEEDBACK PAGE FORM
  // ============================================================
  // 6. STANDALONE FEEDBACK PAGE FORM (Web3Forms)
  // ============================================================
  const form = document.getElementById('form') || document.getElementById('standaloneFeedbackForm');
  const feedbackStarRating = document.getElementById('feedbackStarRating');
  const ratingLabelHint = document.getElementById('ratingLabelHint');
  const feedbackRatingInput = document.getElementById('feedbackRatingInput');
  const feedbackSuccessState = document.getElementById('feedbackSuccessState');
  let userFeedbackRating = 5;

  const ratingHints = {
    1: '1 star — Poor experience',
    2: '2 stars — Fair experience',
    3: '3 stars — Average experience',
    4: '4 stars — Good experience',
    5: '5 stars — Excellent experience!'
  };

  if (feedbackStarRating) {
    const stars = feedbackStarRating.querySelectorAll('.star');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        userFeedbackRating = parseInt(star.dataset.rating, 10);
        if (feedbackRatingInput) {
          feedbackRatingInput.value = `${userFeedbackRating} Stars — ${ratingHints[userFeedbackRating] || ''}`;
        }
        stars.forEach(s => {
          const r = parseInt(s.dataset.rating, 10);
          if (r <= userFeedbackRating) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
        if (ratingLabelHint) {
          ratingLabelHint.textContent = ratingHints[userFeedbackRating] || `${userFeedbackRating} stars`;
        }
      });
    });
  }

  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const warningAlert = document.getElementById('feedbackWarningAlert');
    const warningText = document.getElementById('feedbackWarningText');

    // Auto-dismiss warning when user edits inputs
    ['feedbackName', 'feedbackEmail', 'feedbackMessage'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (warningAlert && !warningAlert.classList.contains('hidden')) {
            warningAlert.classList.add('hidden');
          }
        });
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (warningAlert) warningAlert.classList.add('hidden');

      const nameInput = document.getElementById('feedbackName');
      const emailInput = document.getElementById('feedbackEmail');
      const messageInput = document.getElementById('feedbackMessage');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const message = messageInput ? messageInput.value.trim() : '';

      if (!message) {
        if (typeof showToast === 'function') showToast('Please enter your feedback message.', true);
        return;
      }

      const originalBtnContent = submitBtn ? submitBtn.innerHTML : 'Submit Feedback';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Submitting...</span> <div class="spinner-small" style="display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-left:8px;"></div>`;
      }

      try {
        // Step 1: Verify with Multilingual AI Moderation Agent
        const verifyResp = await fetch("/api/feedback/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            email: email,
            rating: `${userFeedbackRating} Stars — ${ratingHints[userFeedbackRating] || ''}`,
            message: message
          })
        });

        const verifyData = await verifyResp.json();

        if (!verifyResp.ok || !verifyData.success) {
          // AI Agent detected unethical, abusive, or irrelevant content!
          const warnMsg = verifyData.error || "Feedback could not be submitted.";
          if (warningAlert && warningText) {
            warningText.textContent = warnMsg;
            warningAlert.classList.remove('hidden');
          }
          if (typeof showToast === 'function') {
            showToast(warnMsg, true);
          }
          return;
        }

        // Step 2: Content verified! Submit from client to Web3Forms (works cleanly on Free plan)
        if (submitBtn) {
          submitBtn.innerHTML = `<span>Sending...</span> <div class="spinner-small" style="display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-left:8px;"></div>`;
        }

        const web3FormData = new FormData(form);
        web3FormData.set("access_key", "82725bd8-bd34-4109-b8d1-8df7cc07337b");
        web3FormData.set("name", name);
        web3FormData.set("email", email);
        web3FormData.set("message", message);
        web3FormData.set("rating", `${userFeedbackRating} Stars — ${ratingHints[userFeedbackRating] || ''}`);
        web3FormData.set("from_name", "FutureFace User Feedback");
        web3FormData.set("subject", `New FutureFace Feedback (${userFeedbackRating} Stars) [AI-Verified]`);

        try {
          await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: web3FormData
          });
        } catch (wErr) {
          console.warn("Web3Forms client notification note:", wErr);
        }

        // Step 3: Reveal customized success message
        form.classList.add('hidden');
        if (warningAlert) warningAlert.classList.add('hidden');
        if (feedbackSuccessState) feedbackSuccessState.classList.remove('hidden');
        if (typeof showToast === 'function') {
          showToast("Thank you for giving your valuable time!", false);
        }
        form.reset();

      } catch (error) {
        console.error("Feedback submission error:", error);
        const errMsg = "Something went wrong verifying your feedback. Please try again.";
        if (warningAlert && warningText) {
          warningText.textContent = errMsg;
          warningAlert.classList.remove('hidden');
        }
        if (typeof showToast === 'function') {
          showToast(errMsg, true);
        }
      } finally {
        if (submitBtn) {
          submitBtn.innerHTML = originalBtnContent;
          submitBtn.disabled = false;
        }
      }
    });
  }

  // ============================================================
  // 7. TRY NOW TRANSFORMATION WORKSPACE LOGIC
  // ============================================================
  const tryNowRoot = document.getElementById('try-now');
  if (tryNowRoot) {
    let currentSessionId = null;
    let currentEstimatedAge = null;
    let targetAge = 50;
    let webcamStream = null;
    let selectedFile = null;
    let capturedDataUrl = null;

    // Face Angle & Photo Guidelines Tutorial Modal Logic
    const faceGuideModal = document.getElementById('faceGuideModal');
    const btnOpenFaceGuide = document.getElementById('btnOpenFaceGuide');
    const btnCloseFaceGuide = document.getElementById('btnCloseFaceGuide');
    const btnAcknowledgeGuide = document.getElementById('btnAcknowledgeGuide');
    const chkDoNotShowAgain = document.getElementById('chkDoNotShowAgain');

    function openFaceGuide() {
      if (faceGuideModal) {
        faceGuideModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeFaceGuide(persistChoice = false) {
      if (faceGuideModal) {
        faceGuideModal.classList.add('hidden');
        document.body.style.overflow = '';
        if (persistChoice || (chkDoNotShowAgain && chkDoNotShowAgain.checked)) {
          sessionStorage.setItem('ff_face_guide_dismissed', 'true');
        }
      }
    }

    if (btnOpenFaceGuide) btnOpenFaceGuide.addEventListener('click', openFaceGuide);
    if (btnCloseFaceGuide) btnCloseFaceGuide.addEventListener('click', () => closeFaceGuide(false));
    if (btnAcknowledgeGuide) btnAcknowledgeGuide.addEventListener('click', () => closeFaceGuide(true));

    if (faceGuideModal) {
      faceGuideModal.addEventListener('click', (e) => {
        if (e.target === faceGuideModal) {
          closeFaceGuide(false);
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && faceGuideModal && !faceGuideModal.classList.contains('hidden')) {
        closeFaceGuide(false);
      }
    });

    // Automatically show tutorial popup when user enters Try Now page (once per browser session)
    if (!sessionStorage.getItem('ff_face_guide_dismissed')) {
      setTimeout(openFaceGuide, 450);
    }

    // Step Progress Nodes
    function updateStepProgress(stepNum) {
      const stepNodes = [
        document.getElementById('stepNode1'),
        document.getElementById('stepNode2'),
        document.getElementById('stepNode3'),
        document.getElementById('stepNode4')
      ];
      const stepLines = [
        document.getElementById('stepLine1'),
        document.getElementById('stepLine2'),
        document.getElementById('stepLine3')
      ];

      stepNodes.forEach((node, idx) => {
        if (!node) return;
        if (idx + 1 <= stepNum) {
          node.classList.add('active');
        } else {
          node.classList.remove('active');
        }
      });

      stepLines.forEach((line, idx) => {
        if (!line) return;
        if (idx + 1 < stepNum) {
          line.classList.add('completed');
        } else {
          line.classList.remove('completed');
        }
      });
    }

    // Tabs: Upload vs Camera
    const tabUploadBtn = document.getElementById('tabUploadBtn');
    const tabCameraBtn = document.getElementById('tabCameraBtn');
    const tabUpload = document.getElementById('tabUpload');
    const tabCamera = document.getElementById('tabCamera');

    if (tabUploadBtn && tabCameraBtn && tabUpload && tabCamera) {
      tabUploadBtn.addEventListener('click', () => {
        tabUploadBtn.classList.add('active');
        tabCameraBtn.classList.remove('active');
        tabUpload.classList.add('active');
        tabCamera.classList.remove('active');
        stopWebcam();
      });

      tabCameraBtn.addEventListener('click', () => {
        tabCameraBtn.classList.add('active');
        tabUploadBtn.classList.remove('active');
        tabCamera.classList.add('active');
        tabUpload.classList.remove('active');
        startWebcam();
      });
    }

    // Dropzone logic
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const dropzonePreview = document.getElementById('dropzonePreview');
    const uploadPreviewImg = document.getElementById('uploadPreviewImg');
    const btnChangeUpload = document.getElementById('btnChangeUpload');

    function handleFileSelection(file) {
      if (!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file (JPG, PNG, WEBP).');
        return;
      }
      selectedFile = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        currentOriginalDataUrl = dataUrl;
        if (uploadPreviewImg) uploadPreviewImg.src = dataUrl;
        if (dropzoneContent) dropzoneContent.classList.add('hidden');
        if (dropzonePreview) dropzonePreview.classList.remove('hidden');

        estimateAgeFromDataUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelection(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelection(e.target.files[0]);
        }
      });

      if (btnChangeUpload) {
        btnChangeUpload.addEventListener('click', (e) => {
          e.stopPropagation();
          fileInput.value = '';
          if (dropzoneContent) dropzoneContent.classList.remove('hidden');
          if (dropzonePreview) dropzonePreview.classList.add('hidden');
        });
      }
    }

    // Camera logic
    const cameraViewport = document.getElementById('cameraViewport');
    const webcamVideo = document.getElementById('webcamVideo');
    const snapshotCanvas = document.getElementById('snapshotCanvas');
    const cameraSnapshotPreview = document.getElementById('cameraSnapshotPreview');
    const cameraActiveControls = document.getElementById('cameraActiveControls');
    const snapshotActions = document.getElementById('snapshotActions');
    const btnStartCamera = document.getElementById('btnStartCamera');
    const btnCapturePhoto = document.getElementById('btnCapturePhoto');
    const btnStopCamera = document.getElementById('btnStopCamera');
    const btnRetakePhoto = document.getElementById('btnRetakePhoto');
    const btnConfirmSnapshot = document.getElementById('btnConfirmSnapshot');

    async function startWebcam() {
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        showToast('Live camera requires HTTPS or a domain name for browser security. Please upload a photo or connect your domain with SSL.');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera access is not supported by your browser or environment. Please upload a photo.');
        return;
      }
      try {
        if (webcamStream) stopWebcam();
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
        if (webcamVideo) {
          webcamVideo.srcObject = webcamStream;
          webcamVideo.onloadedmetadata = () => {
            if (webcamVideo.videoWidth && webcamVideo.videoHeight && cameraViewport) {
              cameraViewport.style.aspectRatio = `${webcamVideo.videoWidth} / ${webcamVideo.videoHeight}`;
            }
          };
          await webcamVideo.play();
        }
        if (cameraViewport) cameraViewport.className = 'camera-viewport state-streaming';
        if (cameraActiveControls) cameraActiveControls.classList.remove('hidden');
        if (snapshotActions) snapshotActions.classList.add('hidden');
      } catch (err) {
        console.error('Camera error:', err);
        showToast('Could not access camera. Please check permissions.');
        stopWebcam();
      }
    }

    function stopWebcam() {
      if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
      }
      if (webcamVideo) webcamVideo.srcObject = null;
      if (cameraViewport) {
        cameraViewport.className = 'camera-viewport state-off';
        cameraViewport.style.aspectRatio = '4 / 3';
      }
      if (cameraActiveControls) cameraActiveControls.classList.add('hidden');
      if (snapshotActions) snapshotActions.classList.add('hidden');
    }

    if (btnStartCamera) btnStartCamera.addEventListener('click', startWebcam);
    if (btnStopCamera) btnStopCamera.addEventListener('click', stopWebcam);

    if (btnCapturePhoto && webcamVideo && snapshotCanvas) {
      btnCapturePhoto.addEventListener('click', () => {
        const w = webcamVideo.videoWidth || 640;
        const h = webcamVideo.videoHeight || 480;
        snapshotCanvas.width = w;
        snapshotCanvas.height = h;

        const ctx = snapshotCanvas.getContext('2d');
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(webcamVideo, 0, 0, w, h);

        capturedDataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.95);
        currentOriginalDataUrl = capturedDataUrl;
        if (cameraSnapshotPreview) {
          cameraSnapshotPreview.src = capturedDataUrl;
          if (cameraViewport && w && h) {
            cameraViewport.style.aspectRatio = `${w} / ${h}`;
          }
        }

        if (cameraViewport) cameraViewport.className = 'camera-viewport state-captured';
        if (cameraActiveControls) cameraActiveControls.classList.add('hidden');
        if (snapshotActions) snapshotActions.classList.remove('hidden');
      });
    }

    if (btnRetakePhoto) {
      btnRetakePhoto.addEventListener('click', () => {
        capturedDataUrl = null;
        if (cameraViewport) cameraViewport.className = 'camera-viewport state-streaming';
        if (cameraActiveControls) cameraActiveControls.classList.remove('hidden');
        if (snapshotActions) snapshotActions.classList.add('hidden');
      });
    }

    if (btnConfirmSnapshot) {
      btnConfirmSnapshot.addEventListener('click', () => {
        if (capturedDataUrl) {
          estimateAgeFromDataUrl(capturedDataUrl);
        }
      });
    }

    // Demo samples picker strictly from demo folder
    const samplesGrid = document.getElementById('samplesGrid');
    const demoSamples = [
      { name: 'person1.jpg', label: 'Person 1', type: 'image/jpeg' },
      { name: 'person2.webp', label: 'Person 2', type: 'image/webp' },
      { name: 'person3.jpg', label: 'Person 3', type: 'image/jpeg' },
      { name: 'person4.webp', label: 'Person 4', type: 'image/webp' },
      { name: 'person5.png', label: 'Person 5', type: 'image/png' },
      { name: 'person6.png', label: 'Person 6', type: 'image/png' }
    ];

    if (samplesGrid) {
      samplesGrid.innerHTML = '';
      demoSamples.forEach(sample => {
        const img = document.createElement('img');
        img.src = `/demo/${sample.name}`;
        img.alt = sample.label;
        img.title = `Click to test demo portrait: ${sample.label}`;
        img.className = 'demo-sample-thumb';
        img.addEventListener('click', async () => {
          try {
            const res = await fetch(`/demo/${sample.name}`);
            const blob = await res.blob();
            const file = new File([blob], sample.name, { type: sample.type || blob.type || 'image/jpeg' });
            handleFileSelection(file);
          } catch (err) {
            showToast(`Could not load ${sample.name}`);
          }
        });
        samplesGrid.appendChild(img);
      });
    }

    // Enhanced Biometric Scanner & Real-Time Stopwatch Elements
    const progressOverlay = document.getElementById('progressOverlay');
    const progressTitle = document.getElementById('progressTitle');
    const progressSubtitle = document.getElementById('progressSubtitle');
    const scannerFaceImg = document.getElementById('scannerFaceImg');
    const scannerLiveCanvas = document.getElementById('scannerLiveCanvas');
    const scannerStatusBadge = document.getElementById('scannerStatusBadge');
    const hudTargetAge = document.getElementById('hudTargetAge');
    const hudShiftYears = document.getElementById('hudShiftYears');
    const scannerProgressFill = document.getElementById('scannerProgressFill');
    const scannerStepLabel = document.getElementById('scannerStepLabel');
    const scannerPercentLabel = document.getElementById('scannerPercentLabel');
    const liveTimerDisplay = document.getElementById('liveTimerDisplay');

    const croppedFaceImg = document.getElementById('croppedFaceImg');
    const thumbPlaceholder = document.getElementById('thumbPlaceholder');
    const displayEstimatedAge = document.getElementById('displayEstimatedAge');

    let isGenerating = false;
    let liveTimerInterval = null;
    let liveTimerStart = 0;
    let stageIntervals = [];
    let livePixelAnimId = null;

    // Prevent page reload / navigation while image transformation is active
    window.addEventListener('beforeunload', (e) => {
      if (isGenerating) {
        e.preventDefault();
        e.returnValue = 'Facial age transformation is currently in progress. Reloading will cancel the generation.';
        return e.returnValue;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (isGenerating && (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R')))) {
        e.preventDefault();
        showToast('⚠️ Image generation is in progress. Please wait ~30-40 seconds before reloading.');
      }
    });

    function startLiveStopwatch() {
      liveTimerStart = performance.now();
      if (liveTimerDisplay) liveTimerDisplay.textContent = '00:00.00';
      if (liveTimerInterval) clearInterval(liveTimerInterval);
      liveTimerInterval = setInterval(() => {
        const elapsed = performance.now() - liveTimerStart;
        const totalSec = Math.floor(elapsed / 1000);
        const ms = Math.floor((elapsed % 1000) / 10);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        if (liveTimerDisplay) liveTimerDisplay.textContent = formatted;
      }, 25);
    }

    function stopLiveStopwatch() {
      if (liveTimerInterval) {
        clearInterval(liveTimerInterval);
        liveTimerInterval = null;
      }
      stageIntervals.forEach(t => clearTimeout(t));
      stageIntervals = [];
    }

    // Real-Time Procedural Pixel Transformation Engine
    function startLivePixelSimulation(imageSrc, shift, targetAgeVal) {
      if (!scannerLiveCanvas) return;
      const ctx = scannerLiveCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const w = scannerLiveCanvas.width;
      const h = scannerLiveCanvas.height;

      const sourceImg = new Image();
      sourceImg.crossOrigin = 'anonymous';

      sourceImg.onload = () => {
        // Draw base face centered and scaled onto an offscreen canvas
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        const scale = Math.max(w / sourceImg.width, h / sourceImg.height);
        const sw = sourceImg.width * scale;
        const sh = sourceImg.height * scale;
        const ox = (w - sw) / 2;
        const oy = (h - sh) / 2;
        offCtx.drawImage(sourceImg, ox, oy, sw, sh);

        const baseData = offCtx.getImageData(0, 0, w, h);
        const workData = ctx.createImageData(w, h);

        const startTime = performance.now();
        const isAging = shift >= 0;

        function renderFrame(now) {
          const elapsed = (now - startTime) / 1000;

          // Copy base pixels to workData
          workData.data.set(baseData.data);
          const pixels = workData.data;

          // 1. Scan Line Laser position (sweeping top to bottom)
          const sweepPeriod = 2.4;
          const sweepProgress = (elapsed % sweepPeriod) / sweepPeriod;
          const scanY = Math.floor(sweepProgress * h);

          // Morph progress accumulates smoothly over ~30 seconds
          const morphProgress = Math.min(elapsed / 30.0, 1.0);

          // Procedural pixel transformation loop
          for (let y = 0; y < h; y++) {
            const dyFromScan = Math.abs(y - scanY);
            const nearScan = dyFromScan < 16;
            const scanFactor = nearScan ? (1 - dyFromScan / 16) : 0;

            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              let r = pixels[idx];
              let g = pixels[idx + 1];
              let b = pixels[idx + 2];

              // Phase 1: Highlighting edge gradients near laser sweep (landmark detection)
              if (scanFactor > 0) {
                const leftIdx = idx - 4;
                const upIdx = idx - w * 4;
                if (leftIdx >= 0 && upIdx >= 0) {
                  const lumDiff = Math.abs((r + g + b) - (pixels[leftIdx] + pixels[leftIdx + 1] + pixels[leftIdx + 2])) / 3;
                  if (lumDiff > 8) {
                    r = Math.min(255, r * (1 - scanFactor * 0.6) + 56 * scanFactor * 0.9);
                    g = Math.min(255, g * (1 - scanFactor * 0.6) + 189 * scanFactor * 0.9);
                    b = Math.min(255, b * (1 - scanFactor * 0.6) + 248 * scanFactor * 0.9);
                  }
                }
              }

              // Phase 2: Live Procedural Aging or Rejuvenation Pixel Alterations
              if (elapsed > 2.5) {
                if (isAging) {
                  // Forehead horizontal age wrinkles
                  if (y >= 45 && y <= 85 && x >= 55 && x <= 185) {
                    const crease = Math.sin(y * 0.42 + Math.cos(x * 0.05)) * Math.sin(x * 0.1);
                    if (crease > 0.45) {
                      const darken = (crease - 0.45) * morphProgress * 0.42;
                      r = Math.max(0, r * (1 - darken));
                      g = Math.max(0, g * (1 - darken * 1.05));
                      b = Math.max(0, b * (1 - darken * 1.1));
                    }
                  }

                  // Nasolabial folds (smile lines deepening)
                  const dLeftFold = Math.abs((x - 75) + 0.6 * (y - 170));
                  const dRightFold = Math.abs((x - 165) - 0.6 * (y - 170));
                  if (y >= 125 && y <= 180 && (dLeftFold < 10 || dRightFold < 10)) {
                    const foldDist = Math.min(dLeftFold, dRightFold);
                    const foldFactor = (1 - foldDist / 10) * morphProgress * 0.35;
                    r = Math.max(0, r * (1 - foldFactor));
                    g = Math.max(0, g * (1 - foldFactor * 1.08));
                    b = Math.max(0, b * (1 - foldFactor * 1.15));
                  }

                  // Eye corner crows' feet
                  const leftCornerDist = Math.hypot(x - 60, y - 100);
                  const rightCornerDist = Math.hypot(x - 180, y - 100);
                  if (leftCornerDist < 24 || rightCornerDist < 24) {
                    const angle = Math.atan2(y - 100, (leftCornerDist < 24 ? x - 60 : x - 180));
                    const crowWave = Math.sin(angle * 7);
                    if (crowWave > 0.4) {
                      const crowDarken = (crowWave - 0.4) * morphProgress * 0.3;
                      r = Math.max(0, r * (1 - crowDarken));
                      g = Math.max(0, g * (1 - crowDarken));
                      b = Math.max(0, b * (1 - crowDarken));
                    }
                  }

                  // Temple & hair graying / desaturation
                  if ((y < 55 || x < 50 || x > 190) && (r + g + b) < 320) {
                    const gray = (r * 0.3 + g * 0.59 + b * 0.11);
                    const silverProgress = morphProgress * 0.55;
                    r = r * (1 - silverProgress) + (gray + 45) * silverProgress;
                    g = g * (1 - silverProgress) + (gray + 45) * silverProgress;
                    b = b * (1 - silverProgress) + (gray + 50) * silverProgress;
                  }

                  // Mature skin texture micro-contrast
                  if (y > 70 && y < 195 && x > 55 && x < 185) {
                    const grain = ((x * 13 + y * 37) % 7) - 3;
                    const grainAmp = morphProgress * 0.04;
                    r = Math.min(255, Math.max(0, r + grain * grainAmp * r));
                    g = Math.min(255, Math.max(0, g + grain * grainAmp * g));
                    b = Math.min(255, Math.max(0, g + grain * grainAmp * b));
                  }

                } else {
                  // Youth Regression (smoothing, fine line reduction, youthful glow)
                  if (y > 45 && y < 200 && x > 50 && x < 190) {
                    const peachGlow = morphProgress * 0.18;
                    r = Math.min(255, r * (1 - peachGlow * 0.1) + 245 * peachGlow * 0.15);
                    g = Math.min(255, g * (1 - peachGlow * 0.1) + 210 * peachGlow * 0.12);
                    b = Math.min(255, b * (1 - peachGlow * 0.1) + 195 * peachGlow * 0.1);
                  }
                }
              }

              pixels[idx] = r;
              pixels[idx + 1] = g;
              pixels[idx + 2] = b;
            }
          }

          ctx.putImageData(workData, 0, 0);

          livePixelAnimId = requestAnimationFrame(renderFrame);
        }

        livePixelAnimId = requestAnimationFrame(renderFrame);
      };

      sourceImg.src = imageSrc;
    }

    function stopLivePixelSimulation() {
      if (livePixelAnimId) {
        cancelAnimationFrame(livePixelAnimId);
        livePixelAnimId = null;
      }
    }

    let currentOriginalDataUrl = null;
    let lastDetectedFaceBbox = null;

    // Age estimation runs non-intrusively in background without loading modal
    async function estimateAgeFromDataUrl(dataUrl, isCropped = false) {
      if (!isCropped) {
        currentOriginalDataUrl = dataUrl;
      }
      if (displayEstimatedAge) {
        displayEstimatedAge.innerHTML = '<span class="estimating-pulse">Estimating...</span>';
      }
      const currentAgeHint = document.getElementById('currentAgeHint');
      safeSetText(currentAgeHint, '(AI estimating facial age...)');
      if (yearsSlider) yearsSlider.setAttribute('disabled', 'true');
      if (btnExecuteTransform) btnExecuteTransform.setAttribute('disabled', 'true');

      try {
        const payload = { image_data: dataUrl };
        if (isCropped) {
          payload.is_cropped = true;
          payload.skip_autocrop = true;
        }
        const res = await fetch('/api/estimate-age', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to detect face or estimate age.');
        }

        currentSessionId = data.session_id;
        currentEstimatedAge = parseFloat(data.estimated_age);
        if (data.face_bbox) {
          lastDetectedFaceBbox = data.face_bbox;
        }

        safeSetText(displayEstimatedAge, Math.round(currentEstimatedAge));
        safeSetText(currentAgeHint, isCropped ? '(Custom Safezone Applied)' : '(AI Estimated via ResNet-50)');

        if (yearsSlider) {
          yearsSlider.removeAttribute('disabled');
        }
        if (btnExecuteTransform) {
          btnExecuteTransform.removeAttribute('disabled');
        }

        const faceDataUrl = data.cropped_image || data.cropped_url;
        if (croppedFaceImg && faceDataUrl) {
          croppedFaceImg.src = faceDataUrl;
          croppedFaceImg.classList.remove('hidden');
        }
        if (thumbPlaceholder) thumbPlaceholder.classList.add('hidden');

        // Reveal Safezone action button
        const btnEditSafezonePill = document.getElementById('btnEditSafezonePill');
        if (btnEditSafezonePill) btnEditSafezonePill.classList.remove('hidden');

        setupTargetAgeControls(currentEstimatedAge);
        updateStepProgress(2);

      } catch (err) {
        console.error(err);
        safeSetText(displayEstimatedAge, '--');
        safeSetText(currentAgeHint, '(Upload or capture photo to estimate)');
        showToast(err.message || 'Error estimating age. Please choose another photo.');
      }
    }

    // Target Age Slider strictly bounded to [8, 90]
    const yearsSlider = document.getElementById('yearsSlider');
    const targetAgeBadge = document.getElementById('targetAgeBadge');
    const bannerSummaryText = document.getElementById('bannerSummaryText');
    const presetChipsContainer = document.getElementById('presetChipsContainer');
    const sliderTickMin = document.getElementById('sliderTickMin');
    const sliderTickCenter = document.getElementById('sliderTickCenter');
    const sliderTickMax = document.getElementById('sliderTickMax');

    function setupTargetAgeControls(estAge) {
      const roundedEst = Math.round(estAge);

      if (yearsSlider) {
        yearsSlider.min = MIN_TARGET_AGE;
        yearsSlider.max = MAX_TARGET_AGE;

        if (roundedEst <= 40) {
          targetAge = Math.min(MAX_TARGET_AGE, roundedEst + 30);
        } else {
          targetAge = Math.max(MIN_TARGET_AGE, roundedEst - 25);
        }
        yearsSlider.value = targetAge;
      }

      if (sliderTickMin) sliderTickMin.textContent = MIN_TARGET_AGE;
      if (sliderTickCenter) sliderTickCenter.textContent = Math.round((MIN_TARGET_AGE + MAX_TARGET_AGE) / 2);
      if (sliderTickMax) sliderTickMax.textContent = MAX_TARGET_AGE;

      renderPresetChips(roundedEst);
      updateTargetDisplays();
    }

    function renderPresetChips(roundedEst) {
      if (!presetChipsContainer) return;
      presetChipsContainer.innerHTML = '';

      const candidateShifts = [-30, -20, -10, 10, 20, 30, 40, 50];
      const validPresets = [];

      candidateShifts.forEach(shift => {
        const candTarget = roundedEst + shift;
        if (candTarget >= MIN_TARGET_AGE && candTarget <= MAX_TARGET_AGE) {
          validPresets.push({
            label: `${shift > 0 ? '+' : ''}${shift} yrs (${candTarget})`,
            target: candTarget
          });
        }
      });

      [15, 30, 50, 70, 85].forEach(absTarget => {
        if (Math.abs(absTarget - roundedEst) >= 5) {
          validPresets.push({
            label: `Age ${absTarget}`,
            target: absTarget
          });
        }
      });

      const seen = new Set();
      const finalPresets = [];
      for (const p of validPresets) {
        if (!seen.has(p.target) && finalPresets.length < 6) {
          seen.add(p.target);
          finalPresets.push(p);
        }
      }

      finalPresets.sort((a, b) => a.target - b.target);

      finalPresets.forEach(preset => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        if (preset.target === targetAge) chip.classList.add('active');
        chip.textContent = preset.label;
        chip.addEventListener('click', () => {
          targetAge = preset.target;
          if (yearsSlider) yearsSlider.value = targetAge;
          document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          updateTargetDisplays();
        });
        presetChipsContainer.appendChild(chip);
      });
    }

    function updateTargetDisplays() {
      if (currentEstimatedAge === null) {
        safeSetText(targetAgeBadge, '--');
        safeSetText(bannerSummaryText, 'Upload or capture a photo first to estimate age and choose transformation');
        return;
      }

      if (yearsSlider) {
        targetAge = parseInt(yearsSlider.value, 10);
      }
      targetAge = Math.max(MIN_TARGET_AGE, Math.min(MAX_TARGET_AGE, targetAge));

      safeSetText(targetAgeBadge, `${targetAge} years`);

      const shift = targetAge - Math.round(currentEstimatedAge);
      let summary = '';
      if (shift > 0) {
        summary = `Transforming approximately +${shift} years into the future (Target: ${targetAge} yrs)`;
      } else if (shift < 0) {
        summary = `Transforming approximately ${shift} years into the past (Target: ${targetAge} yrs)`;
      } else {
        summary = `Current estimated age (${targetAge} yrs) — minimal facial change`;
      }
      safeSetText(bannerSummaryText, summary);

      if (presetChipsContainer) {
        presetChipsContainer.querySelectorAll('.preset-chip').forEach(c => {
          if (c.textContent.includes(`Age ${targetAge}`) || c.textContent.includes(`(${targetAge})`)) {
            c.classList.add('active');
          } else {
            c.classList.remove('active');
          }
        });
      }
    }

    if (yearsSlider) {
      yearsSlider.addEventListener('input', updateTargetDisplays);
    }

    // Execution / Transformation Call
    const btnExecuteTransform = document.getElementById('btnExecuteTransform');
    const resultPresentationBox = document.getElementById('resultPresentationBox');
    const imgSplitTransformed = document.getElementById('imgSplitTransformed');
    const imgSplitOriginal = document.getElementById('imgSplitOriginal');
    const imgComparisonPoster = document.getElementById('imgComparisonPoster');
    const btnDownloadPoster = document.getElementById('btnDownloadPoster');
    const sliderBadgeOrig = document.getElementById('sliderBadgeOrig');
    const sliderBadgeTrans = document.getElementById('sliderBadgeTrans');
    const statOrigAge = document.getElementById('statOrigAge');
    const statShift = document.getElementById('statShift');
    const statTargetAge = document.getElementById('statTargetAge');

    const splitSliderContainer = document.getElementById('splitSliderContainer');
    const splitBeforeWrap = document.getElementById('splitBeforeWrap');
    const splitHandle = document.getElementById('splitHandle');
    if (splitSliderContainer && splitBeforeWrap && splitHandle) {
      initSplitSlider(splitSliderContainer, splitBeforeWrap, splitHandle, 50);
    }

    if (btnExecuteTransform) {
      btnExecuteTransform.addEventListener('click', async () => {
        if (!currentSessionId) {
          showToast('Please upload an image or take a photo first.');
          return;
        }

        const shift = targetAge - Math.round(currentEstimatedAge);

        updateStepProgress(3);

        const previewSrc = (croppedFaceImg && !croppedFaceImg.classList.contains('hidden') && croppedFaceImg.src) || (uploadPreviewImg && uploadPreviewImg.src) || capturedDataUrl || '/demo/person1.jpg';

        // Lock reload while photo is generating
        isGenerating = true;

        if (progressOverlay) {
          if (scannerFaceImg) {
            scannerFaceImg.src = previewSrc;
          }

          safeSetText(hudTargetAge, `TARGET: ${targetAge}Y`);
          safeSetText(hudShiftYears, `SHIFT: ${shift >= 0 ? '+' : ''}${shift}Y`);
          safeSetText(scannerStatusBadge, 'AI Neural Aging Engine Active');

          if (scannerProgressFill) scannerProgressFill.style.width = '16%';
          safeSetText(scannerStepLabel, 'Stage 1 of 4');
          safeSetText(scannerPercentLabel, '16%');
          safeSetText(progressTitle, 'Inverting Face into StyleGAN2 Latent Space (w+)...');
          safeSetText(progressSubtitle, 'Estimated processing time: ~30–40 seconds. YuNet mapping 68 biometric landmark points & extracting identity-preserving embeddings.');

          startLiveStopwatch();
          startLivePixelSimulation(previewSrc, shift, targetAge);
          progressOverlay.classList.remove('hidden');

          // Stage 2 schedule (7.5s)
          stageIntervals.push(setTimeout(() => {
            if (scannerProgressFill) scannerProgressFill.style.width = '45%';
            safeSetText(scannerStepLabel, 'Stage 2 of 4');
            safeSetText(scannerPercentLabel, '45%');
            safeSetText(progressTitle, `Traversing Age Latent Trajectory (${shift >= 0 ? '+' : ''}${shift} yrs)...`);
            safeSetText(progressSubtitle, `SAM model navigating continuous age direction vector towards target age ${targetAge} in GPU memory.`);
          }, 7500));

          // Stage 3 schedule (18s)
          stageIntervals.push(setTimeout(() => {
            if (scannerProgressFill) scannerProgressFill.style.width = '74%';
            safeSetText(scannerStepLabel, 'Stage 3 of 4');
            safeSetText(scannerPercentLabel, '74%');
            safeSetText(progressTitle, 'Synthesizing Facial Geometry & Structural Aging...');
            safeSetText(progressSubtitle, 'Modulating intermediate AdaIN style layers: skin texture, hairline, wrinkles, and facial contours.');
          }, 18000));

          // Stage 4 schedule (28s)
          stageIntervals.push(setTimeout(() => {
            if (scannerProgressFill) scannerProgressFill.style.width = '92%';
            safeSetText(scannerStepLabel, 'Stage 4 of 4');
            safeSetText(scannerPercentLabel, '92%');
            safeSetText(progressTitle, 'Finalizing Watermarked High-Res Output...');
            safeSetText(progressSubtitle, 'Embedding FutureFace authenticity watermark and rendering dual comparison views.');
          }, 28000));
        }

        try {
          const res = await fetch('/api/transform', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: currentSessionId,
              shift: shift
            })
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Transformation failed.');
          }

          isGenerating = false;
          stopLivePixelSimulation();
          stopLiveStopwatch();
          const finalDuration = ((performance.now() - liveTimerStart) / 1000).toFixed(2);
          const totalSec = Math.floor(finalDuration);
          const ms = Math.floor((finalDuration % 1) * 100);
          if (liveTimerDisplay) {
            liveTimerDisplay.textContent = `00:${String(totalSec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
          }

          if (scannerProgressFill) scannerProgressFill.style.width = '100%';
          safeSetText(scannerStepLabel, 'Stage 4 of 4');
          safeSetText(scannerPercentLabel, '100%');
          safeSetText(progressTitle, 'Age Transformation Complete!');
          safeSetText(progressSubtitle, `Synthesized successfully in ${finalDuration}s on ${detectedGpuName}.`);

          // Brief delay so user sees completion & stopwatch result
          await new Promise(r => setTimeout(r, 450));

          const origAgeRounded = Math.round(data.estimated_age);
          const finalTargetAge = Math.round(data.target_age);
          const finalShift = Math.round(data.shift_years);

          const transImg = data.transformed_image || data.transformed_url;
          const origImg = data.original_image || data.cropped_image || data.cropped_url;
          const compImg = data.comparison_image || data.comparison_url;

          if (imgSplitTransformed && transImg) imgSplitTransformed.src = transImg;
          if (imgSplitOriginal && origImg) imgSplitOriginal.src = origImg;
          if (imgComparisonPoster && compImg) imgComparisonPoster.src = compImg;
          if (btnDownloadPoster && compImg) {
            btnDownloadPoster.href = compImg;
            btnDownloadPoster.download = `FutureFace_Comparison_Target_${finalTargetAge || targetAge}.jpg`;
          }
          const btnDownloadTransformed = document.getElementById('btnDownloadTransformed');
          if (btnDownloadTransformed && transImg) {
            btnDownloadTransformed.href = transImg;
            btnDownloadTransformed.download = `FutureFace_Transformed_Target_${finalTargetAge || targetAge}.jpg`;
          }

          safeSetText(sliderBadgeOrig, `Original (${origAgeRounded} yrs)`);
          safeSetText(sliderBadgeTrans, `Transformed (${finalTargetAge} yrs)`);

          safeSetText(statOrigAge, `${data.estimated_age.toFixed(1)} yrs`);
          safeSetText(statShift, `${finalShift >= 0 ? '+' : ''}${finalShift} yrs`);
          safeSetText(statTargetAge, `${finalTargetAge} yrs`);

          if (resultPresentationBox) {
            resultPresentationBox.classList.remove('hidden');
            resultPresentationBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          updateStepProgress(4);
          showToast(`Transformation completed in ${finalDuration}s!`, false);

        } catch (err) {
          isGenerating = false;
          stopLivePixelSimulation();
          stopLiveStopwatch();
          console.error(err);
          showToast(err.message || 'Error generating future face.');
          updateStepProgress(2);
        } finally {
          isGenerating = false;
          stopLivePixelSimulation();
          stopLiveStopwatch();
          if (progressOverlay) progressOverlay.classList.add('hidden');
        }
      });
    }

    // Result view toggle
    const btnViewSplit = document.getElementById('btnViewSplit');
    const btnViewSide = document.getElementById('btnViewSide');
    const viewSplitPanel = document.getElementById('viewSplitPanel');
    const viewSidePanel = document.getElementById('viewSidePanel');

    if (btnViewSplit && btnViewSide && viewSplitPanel && viewSidePanel) {
      btnViewSplit.addEventListener('click', () => {
        btnViewSplit.classList.add('active');
        btnViewSide.classList.remove('active');
        viewSplitPanel.classList.add('active');
        viewSidePanel.classList.remove('active');
      });

      btnViewSide.addEventListener('click', () => {
        btnViewSide.classList.add('active');
        btnViewSplit.classList.remove('active');
        viewSidePanel.classList.add('active');
        viewSplitPanel.classList.remove('active');
      });
    }

    const btnTryAnotherAge = document.getElementById('btnTryAnotherAge');
    const btnRestartAll = document.getElementById('btnRestartAll');

    if (btnTryAnotherAge) {
      btnTryAnotherAge.addEventListener('click', () => {
        if (yearsSlider) {
          yearsSlider.scrollIntoView({ behavior: 'smooth', block: 'center' });
          yearsSlider.focus();
        }
      });
    }

    if (btnRestartAll) {
      btnRestartAll.addEventListener('click', () => {
        selectedFile = null;
        currentSessionId = null;
        if (dropzoneContent) dropzoneContent.classList.remove('hidden');
        if (dropzonePreview) dropzonePreview.classList.add('hidden');
        if (fileInput) fileInput.value = '';
        if (resultPresentationBox) resultPresentationBox.classList.add('hidden');
        if (croppedFaceImg) croppedFaceImg.classList.add('hidden');
        if (thumbPlaceholder) thumbPlaceholder.classList.remove('hidden');
        currentEstimatedAge = null;
        safeSetText(displayEstimatedAge, '--');
        const currentAgeHint = document.getElementById('currentAgeHint');
        safeSetText(currentAgeHint, '(Upload or capture photo to estimate)');
        safeSetText(targetAgeBadge, '--');
        safeSetText(bannerSummaryText, 'Upload or capture a photo first to estimate age and choose transformation');
        if (yearsSlider) {
          yearsSlider.setAttribute('disabled', 'disabled');
          yearsSlider.value = 50;
        }
        if (presetChipsContainer) {
          presetChipsContainer.innerHTML = '<span class="no-presets-hint">Upload or capture a photo to unlock age shift presets</span>';
        }
        if (btnEditSafezonePill) btnEditSafezonePill.classList.add('hidden');
        stopWebcam();
        updateStepProgress(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // =========================================================================
    // SAFEZONE CROP EDITOR MODAL (Interactive 3x3 Grid Crop)
    // =========================================================================
    const safezoneModal = document.getElementById('safezoneModal');
    const safezoneSourceImg = document.getElementById('safezoneSourceImg');
    const safezoneCropBox = document.getElementById('safezoneCropBox');
    const btnCloseSafezoneModal = document.getElementById('btnCloseSafezoneModal');
    const btnCancelSafezone = document.getElementById('btnCancelSafezone');
    const btnResetSafezone = document.getElementById('btnResetSafezone');
    const btnApplySafezone = document.getElementById('btnApplySafezone');
    const btnEditSafezonePill = document.getElementById('btnEditSafezonePill');

    let cropState = {
      x: 0,
      y: 0,
      size: 100,
      isDragging: false,
      isResizing: false,
      resizeDir: null,
      startX: 0,
      startY: 0,
      startBoxX: 0,
      startBoxY: 0,
      startBoxSize: 0,
      stageWidth: 0,
      stageHeight: 0
    };

    function updateCropBoxDOM() {
      if (!safezoneCropBox) return;
      safezoneCropBox.style.left = `${cropState.x}px`;
      safezoneCropBox.style.top = `${cropState.y}px`;
      safezoneCropBox.style.width = `${cropState.size}px`;
      safezoneCropBox.style.height = `${cropState.size}px`;
    }

    function initAutoSafezone() {
      if (!safezoneSourceImg || !safezoneSourceImg.width || !safezoneSourceImg.height) return;
      const dispW = safezoneSourceImg.width;
      const dispH = safezoneSourceImg.height;
      cropState.stageWidth = dispW;
      cropState.stageHeight = dispH;

      const natW = safezoneSourceImg.naturalWidth || dispW;
      const natH = safezoneSourceImg.naturalHeight || dispH;
      const scaleX = dispW / natW;
      const scaleY = dispH / natH;

      if (lastDetectedFaceBbox && lastDetectedFaceBbox.length === 4) {
        const [fx, fy, fw, fh] = lastDetectedFaceBbox;
        // 1.48x max(fw, fh) matching exact red box reference
        const faceSizeNat = Math.max(fw, fh);
        const sideNat = Math.round(faceSizeNat * 1.48);
        const cxNat = fx + fw / 2;
        const cyNat = fy + fh * 0.45;

        let size = Math.round(sideNat * Math.min(scaleX, scaleY));
        size = Math.max(60, Math.min(size, dispW, dispH));

        let x = Math.round(cxNat * scaleX - size / 2);
        let y = Math.round(cyNat * scaleY - size / 2);

        x = Math.max(0, Math.min(dispW - size, x));
        y = Math.max(0, Math.min(dispH - size, y));

        cropState.x = x;
        cropState.y = y;
        cropState.size = size;
      } else {
        // Fallback: centered 65% square
        const size = Math.round(Math.min(dispW, dispH) * 0.65);
        cropState.size = size;
        cropState.x = Math.round((dispW - size) / 2);
        cropState.y = Math.round((dispH - size) / 2);
      }
      updateCropBoxDOM();
    }

    function openSafezoneModal() {
      const src = currentOriginalDataUrl || capturedDataUrl || (uploadPreviewImg && uploadPreviewImg.src);
      if (!src) {
        showToast('Please upload or capture a photo first.');
        return;
      }

      if (!safezoneSourceImg || !safezoneModal) return;

      safezoneSourceImg.onload = () => {
        initAutoSafezone();
      };
      safezoneSourceImg.src = src;
      safezoneModal.classList.remove('hidden');
    }

    function closeSafezoneModal() {
      if (safezoneModal) safezoneModal.classList.add('hidden');
    }

    // Bind triggers
    if (btnEditSafezonePill) btnEditSafezonePill.addEventListener('click', openSafezoneModal);
    if (btnCloseSafezoneModal) btnCloseSafezoneModal.addEventListener('click', closeSafezoneModal);
    if (btnCancelSafezone) btnCancelSafezone.addEventListener('click', closeSafezoneModal);
    if (btnResetSafezone) btnResetSafezone.addEventListener('click', initAutoSafezone);

    // Apply safezone
    if (btnApplySafezone && safezoneSourceImg) {
      btnApplySafezone.addEventListener('click', () => {
        try {
          const dispW = safezoneSourceImg.width;
          const dispH = safezoneSourceImg.height;
          const natW = safezoneSourceImg.naturalWidth;
          const natH = safezoneSourceImg.naturalHeight;

          if (!dispW || !dispH || !natW || !natH) {
            closeSafezoneModal();
            return;
          }

          const scaleX = natW / dispW;
          const scaleY = natH / dispH;

          const cropXNat = Math.round(cropState.x * scaleX);
          const cropYNat = Math.round(cropState.y * scaleY);
          const cropSizeNat = Math.round(cropState.size * Math.max(scaleX, scaleY));

          const cropCanvas = document.createElement('canvas');
          const targetDim = Math.min(1024, Math.max(256, cropSizeNat));
          cropCanvas.width = targetDim;
          cropCanvas.height = targetDim;

          const ctx = cropCanvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(
            safezoneSourceImg,
            cropXNat, cropYNat, cropSizeNat, cropSizeNat,
            0, 0, targetDim, targetDim
          );

          const customCropDataUrl = cropCanvas.toDataURL('image/jpeg', 0.98);
          closeSafezoneModal();

          // Estimate age and set session with the custom crop!
          estimateAgeFromDataUrl(customCropDataUrl, true);
          showToast('Safezone applied successfully! Ready to generate.');
        } catch (err) {
          console.error('Apply safezone error:', err);
          showToast('Could not apply safezone crop. Please try again.');
          closeSafezoneModal();
        }
      });
    }

    // Pointer events for dragging and resizing the crop box
    function onPointerDown(e) {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      const targetHandle = e.target.closest('.crop-hndl');
      if (targetHandle) {
        cropState.isResizing = true;
        cropState.resizeDir = targetHandle.getAttribute('data-dir');
        cropState.startX = clientX;
        cropState.startY = clientY;
        cropState.startBoxX = cropState.x;
        cropState.startBoxY = cropState.y;
        cropState.startBoxSize = cropState.size;
        e.preventDefault();
        return;
      }

      if (e.target.closest('#safezoneCropBox')) {
        cropState.isDragging = true;
        cropState.startX = clientX;
        cropState.startY = clientY;
        cropState.startBoxX = cropState.x;
        cropState.startBoxY = cropState.y;
        e.preventDefault();
      }
    }

    function onPointerMove(e) {
      if (!cropState.isDragging && !cropState.isResizing) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      const deltaX = clientX - cropState.startX;
      const deltaY = clientY - cropState.startY;

      const maxW = safezoneSourceImg.width || cropState.stageWidth;
      const maxH = safezoneSourceImg.height || cropState.stageHeight;

      if (cropState.isDragging) {
        let newX = cropState.startBoxX + deltaX;
        let newY = cropState.startBoxY + deltaY;

        newX = Math.max(0, Math.min(maxW - cropState.size, newX));
        newY = Math.max(0, Math.min(maxH - cropState.size, newY));

        cropState.x = newX;
        cropState.y = newY;
        updateCropBoxDOM();
      } else if (cropState.isResizing) {
        let newSize = cropState.startBoxSize;
        let newX = cropState.startBoxX;
        let newY = cropState.startBoxY;

        const dir = cropState.resizeDir;
        if (dir === 'br') {
          const delta = Math.max(deltaX, deltaY);
          newSize = Math.max(50, Math.min(maxW - newX, maxH - newY, cropState.startBoxSize + delta));
        } else if (dir === 'tl') {
          const delta = Math.min(deltaX, deltaY);
          const maxDelta = Math.min(cropState.startBoxX, cropState.startBoxY);
          const clampedDelta = Math.max(-maxDelta, delta);
          newSize = Math.max(50, cropState.startBoxSize - clampedDelta);
          newX = cropState.startBoxX + (cropState.startBoxSize - newSize);
          newY = cropState.startBoxY + (cropState.startBoxSize - newSize);
        } else if (dir === 'tr') {
          const delta = Math.max(deltaX, -deltaY);
          newSize = Math.max(50, Math.min(maxW - newX, cropState.startBoxY + cropState.startBoxSize, cropState.startBoxSize + delta));
          newY = cropState.startBoxY - (newSize - cropState.startBoxSize);
          if (newY < 0) {
            newSize += newY;
            newY = 0;
          }
        } else if (dir === 'bl') {
          const delta = Math.max(-deltaX, deltaY);
          newSize = Math.max(50, Math.min(cropState.startBoxX + cropState.startBoxSize, maxH - newY, cropState.startBoxSize + delta));
          newX = cropState.startBoxX - (newSize - cropState.startBoxSize);
          if (newX < 0) {
            newSize += newX;
            newX = 0;
          }
        }

        cropState.size = Math.round(newSize);
        cropState.x = Math.round(newX);
        cropState.y = Math.round(newY);
        updateCropBoxDOM();
      }
    }

    function onPointerUp() {
      cropState.isDragging = false;
      cropState.isResizing = false;
    }

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    const safezoneStage = document.getElementById('safezoneStage');
    if (safezoneStage) {
      safezoneStage.addEventListener('mousedown', onPointerDown);
      safezoneStage.addEventListener('touchstart', onPointerDown, { passive: false });
    }
  }
});
