const badmintonBoard = (() => {
  const participants = [
    // { id: 'p1', name: '오승준', color: 'blue' },
    // { id: 'p2', name: '강소정', color: 'pink' },
    // { id: 'p3', name: '김병찬', color: 'blue' },
    // { id: 'p4', name: '장호철', color: 'blue' },
    // { id: 'p5', name: '정상현', color: 'blue' },
    // { id: 'p6', name: '조소영', color: 'pink' },
    // { id: 'p7', name: '최원식', color: 'blue' },
    // { id: 'p8', name: '손현서', color: 'blue' },
    // { id: 'p9', name: '박준희', color: 'blue' },
    // { id: 'p10', name: '게스트', color: 'orange' },
    // { id: 'p11', name: '류진희', color: 'pink' },
    // { id: 'p12', name: '박영경', color: 'pink' },
    // { id: 'p13', name: '김회연', color: 'blue' },
    // { id: 'p14', name: '원채령', color: 'pink' },
    // { id: 'p15', name: '이광재', color: 'blue' },
    // { id: 'p16', name: '채종일', color: 'blue' },
  ];
  const PARTICIPANT_COLORS = ['blue', 'pink', 'orange'];
  const PARTICIPANT_GRADES = ['F', 'E', 'D', 'C', 'B', 'A'];
  const DEFAULT_PARTICIPANT_GRADE = 'F';
  const PARTICIPANT_GRADE_IMAGES = {
    A: './assets/image/a_grade.jpg',
    B: './assets/image/b_grade.jpg',
    C: './assets/image/c_grade.jpg',
    D: './assets/image/d_grade.jpg',
    E: './assets/image/e_grade.jpg',
    F: './assets/image/f_grade.jpg',
  };
  const LESSON_TIME_OPTIONS = (() => {
    const values = [''];
    for (let hour = 6; hour <= 23; hour += 1) {
      for (let minute = 0; minute < 60; minute += 10) {
        const hourLabel = String(hour).padStart(2, '0');
        const minuteLabel = String(minute).padStart(2, '0');
        values.push(`${hourLabel}:${minuteLabel}`);
      }
    }
    return values;
  })();
  const DEFAULT_LESSON_START = '19:00';
  const DEFAULT_LESSON_END = '19:30';
  const LESSON_STATUS_POLL_INTERVAL = 30000;
  const PARTICIPANT_SORT_MODES = {
    GAMES_ASC: 'gamesAsc',
    ARRIVAL: 'arrival',
    NAME: 'name',
    CREATED: 'created',
  };
  const DEFAULT_PARTICIPANT_SORT_MODE = PARTICIPANT_SORT_MODES.GAMES_ASC;
  participants.forEach((member) => {
    member.status = member.status || 'pending';
    member.sessions = member.sessions || {};
    member.color = normalizeParticipantColor(member.color);
  });
  const normalizeParticipantColor = (color) => (PARTICIPANT_COLORS.includes(color) ? color : 'blue');
  const normalizeParticipantGrade = (grade) => (PARTICIPANT_GRADES.includes(grade) ? grade : DEFAULT_PARTICIPANT_GRADE);
  const normalizeLessonTime = (value) => (LESSON_TIME_OPTIONS.includes(value) ? value : '');
  const normalizeLessonEnabled = (value) => value === true || value === 'true';
  function normalizeCountValue(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.floor(numericValue));
  }
  const normalizeSessionMatches = (matches) => {
    if (!matches || typeof matches !== 'object') {
      return {};
    }
    return Object.entries(matches).reduce((acc, [opponentId, value]) => {
      const sanitizedKey = String(opponentId);
      const normalizedCount = normalizeCountValue(value);
      if (sanitizedKey && normalizedCount > 0) {
        acc[sanitizedKey] = normalizedCount;
      }
      return acc;
    }, {});
  };
  const normalizeSessionEntry = (entry) => {
    if (typeof entry === 'number') {
      return { count: normalizeCountValue(entry), joinedAt: null, matches: {}, lessonStart: '', lessonEnd: '', lessonEnabled: false };
    }
    if (!entry || typeof entry !== 'object') {
      return { count: 0, joinedAt: null, matches: {}, lessonStart: '', lessonEnd: '', lessonEnabled: false };
    }
    return {
      count: normalizeCountValue(entry.count),
      joinedAt: entry.joinedAt || null,
      matches: normalizeSessionMatches(entry.matches),
      lessonStart: normalizeLessonTime(entry.lessonStart),
      lessonEnd: normalizeLessonTime(entry.lessonEnd),
      lessonEnabled: normalizeLessonEnabled(entry.lessonEnabled),
    };
  };
  const normalizeParticipantSessions = (sessions = {}) => {
    const normalized = {};
    Object.entries(sessions || {}).forEach(([key, entry]) => {
      normalized[key] = normalizeSessionEntry(entry);
    });
    return normalized;
  };
  const normalizeParticipants = () => {
    participants.forEach((member) => {
      member.status = member.status || 'pending';
      member.sessions = normalizeParticipantSessions(member.sessions);
      member.color = normalizeParticipantColor(member.color);
      member.grade = normalizeParticipantGrade(member.grade);
    });
  };
  normalizeParticipants();
  const getGradeBadgeImage = (grade) => {
    const normalized = normalizeParticipantGrade(grade);
    return PARTICIPANT_GRADE_IMAGES[normalized] || PARTICIPANT_GRADE_IMAGES[DEFAULT_PARTICIPANT_GRADE];
  };
  const updateGradeBadgeElement = (badge, grade) => {
    if (!badge) return;
    const normalized = normalizeParticipantGrade(grade);
    badge.src = getGradeBadgeImage(normalized);
    badge.alt = `${normalized}조 급수 배지`;
    badge.dataset.grade = normalized;
  };
  const createGradeBadgeElement = (grade) => {
    const badge = document.createElement('img');
    badge.className = 'grade-badge';
    updateGradeBadgeElement(badge, grade);
    return badge;
  };
  const NAME_RESET_HOLD_DURATION = 2000;
  const SHUTTLE_IMAGE = './assets/image/shuttlecock.png';
  const STATE_API_ENDPOINT = '/api/state';
  const STATE_STREAM_ENDPOINT = '/api/stream';
  const CAPABILITIES_ENDPOINT = '/api/capabilities';
  const VIEWER_MODE_TITLE = '매치포인트 게임판';
  const EDITOR_MODE_TITLE = '매치포인트 게임판-운영진';
  const history = {};
  let isReadOnlyMode = false;
  let isRestoringState = false;
  let saveTimer = null;
  let boardEl;
  let participantsListEl;
  let addCourtBtn;
  let resetBtn;
  let participantNameInput;
  let participantGradeSelect;
  let addParticipantBtn;
  let hardResetBtn;
  let downloadHistoryBtn;
  let waitlistRowsEl;
  let addWaitlistRowBtn;
  let participantDetailModal;
  let participantDetailNameEl;
  let participantDetailArrivalEl;
  let participantDetailCountInput;
  let participantDetailSaveBtn;
  let participantDetailCloseBtn;
  let participantDetailCountIncreaseBtn;
  let participantDetailCountDecreaseBtn;
  let participantDetailColorInputs = [];
  let participantDetailGradeSelect;
  let participantDetailMatchListEl;
  let participantDetailMatchEmptyEl;
  let participantLessonStartSelect;
  let participantLessonEndSelect;
  let participantLessonCardEl;
  let participantLessonToggleBtn;
  let isLessonControlsEnabled = false;
  let activeDetailParticipantId = null;
  let participantSortMode = DEFAULT_PARTICIPANT_SORT_MODE;
  const usedCourtNumbers = new Set();
  let courtCount = 0;
  let boardCardSeq = 0;
  let waitlistRowSeq = 0;
  let waitlistCardSeq = 0;
  let currentWaitlistDropTarget = null;
  const LIST_CARD_ACTION_STACK_WIDTH = 320;
  let listCardResizeObserver = null;
  let slotParticipantPickerEl;
  let slotPickerSearchInput;
  let slotPickerListEl;
  let slotPickerEmptyMessageEl;
  let slotPickerActiveSlot = null;
  let activeWaitlistCourtMenu = null;
  let participantSortSelect;
  let stateEventSource = null;
  let stateReloadTimer = null;
  let lessonStatusTimer = null;
  const MODAL_SCROLL_LOCK_CLASS = 'modal-scroll-locked';
  let modalScrollLockCount = 0;
  let modalScrollLockScrollTop = 0;

  const lockModalScroll = () => {
    modalScrollLockCount += 1;
    if (modalScrollLockCount === 1) {
      document.documentElement?.classList.add(MODAL_SCROLL_LOCK_CLASS);
      document.body?.classList.add(MODAL_SCROLL_LOCK_CLASS);
      modalScrollLockScrollTop =
        window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
      if (document.body) {
        document.body.style.top = `-${modalScrollLockScrollTop}px`;
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }
    }
  };

  const unlockModalScroll = () => {
    if (modalScrollLockCount === 0) return;
    modalScrollLockCount -= 1;
    if (modalScrollLockCount === 0) {
      document.documentElement?.classList.remove(MODAL_SCROLL_LOCK_CLASS);
      document.body?.classList.remove(MODAL_SCROLL_LOCK_CLASS);
      if (document.body) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
      }
      const targetScroll = modalScrollLockScrollTop;
      requestAnimationFrame(() => {
        window.scrollTo(0, targetScroll);
      });
    }
  };

  const disableElement = (element) => {
    if (!element) return;
    element.disabled = true;
    element.setAttribute('aria-disabled', 'true');
    element.classList.add('is-disabled');
  };

  const disableInputsBySelector = (selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.disabled = true;
      node.classList.add('is-disabled');
    });
  };

  const disableCardInteractions = () => {
    if (!isReadOnlyMode) return;
    document.querySelectorAll('.card').forEach((card) => {
      card.draggable = false;
      card.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      });
    });
    document.querySelectorAll('.wait-card').forEach((card) => {
      card.draggable = false;
      const btn = card.querySelector('.wait-card-remove');
      if (btn) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      }
    });
    document.querySelectorAll('.court-remove, .court-complete, .waitlist-row-remove').forEach((button) => {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    });
  };

  const loadCapabilities = async () => {
    if (typeof window === 'undefined') return { readOnly: false };
    try {
      const response = await fetch(CAPABILITIES_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('사용 권한 정보를 불러오지 못했습니다.', error);
      return { readOnly: false };
    }
  };

  const applyModeSpecificBranding = () => {
    if (typeof document === 'undefined') return;
    document.title = isReadOnlyMode ? VIEWER_MODE_TITLE : EDITOR_MODE_TITLE;
  };

  const applyReadOnlyUiState = () => {
    if (!isReadOnlyMode) return;
    document.body?.classList.add('read-only-mode');
    disableElement(addParticipantBtn);
    disableElement(addCourtBtn);
    disableElement(resetBtn);
    disableElement(addWaitlistRowBtn);
    disableElement(hardResetBtn);
    if (participantNameInput) {
      participantNameInput.disabled = true;
      participantNameInput.placeholder = '뷰어 모드에서는 수정할 수 없습니다.';
      participantNameInput.classList.add('is-disabled');
    }
    if (participantGradeSelect) {
      participantGradeSelect.disabled = true;
      participantGradeSelect.classList.add('is-disabled');
    }
    disableInputsBySelector('input[name="participantColor"]');
    if (participantDetailCountInput) {
      participantDetailCountInput.disabled = true;
      participantDetailCountInput.classList.add('is-disabled');
    }
    disableElement(participantDetailSaveBtn);
    disableElement(participantDetailCountIncreaseBtn);
    disableElement(participantDetailCountDecreaseBtn);
    disableInputsBySelector('input[name="participantDetailColor"]');
    if (participantDetailGradeSelect) {
      participantDetailGradeSelect.disabled = true;
    }
    disableCardInteractions();
  };

  const clearHistorySnapshot = () => {
    Object.keys(history).forEach((key) => {
      delete history[key];
    });
  };

  const resetToDefaultState = ({ shouldPersist = true } = {}) => {
    participants.length = 0;
    normalizeParticipants();
    clearHistorySnapshot();
    renderParticipants();
    clearWaitlistUI();
    clearBoardUI();
    ensureWaitlistRow();
    createCourt(3);
    createCourt(4);
    if (isReadOnlyMode) {
      disableCardInteractions();
    }
    if (shouldPersist) {
      schedulePersist();
    }
  };

  const applyStateSnapshot = (state, { shouldPersist = true } = {}) => {
    if (!state) {
      resetToDefaultState({ shouldPersist });
      return;
    }
    participants.length = 0;
    if (Array.isArray(state.participants)) {
      state.participants.forEach((member) => {
        participants.push({ ...member });
      });
    }
    normalizeParticipants();
    participantSortMode = state.participantSortMode || DEFAULT_PARTICIPANT_SORT_MODE;
    clearHistorySnapshot();
    if (state.history) {
      Object.entries(state.history).forEach(([key, value]) => {
        history[key] = value;
      });
    }
    renderParticipants();
    applySavedState(state, { shouldPersist });
  };

  const refreshStateFromServer = async (nextState = null) => {
    if (typeof window === 'undefined') return;
    let latest = nextState;
    if (!latest) {
      latest = await loadState();
    }
    if (latest) {
      applyStateSnapshot(latest, { shouldPersist: false });
    } else {
      resetToDefaultState({ shouldPersist: false });
    }
  };

  const handleStateStreamUpdate = (event) => {
    if (isRestoringState) return;
    let payload = null;
    try {
      payload = event?.data ? JSON.parse(event.data) : null;
    } catch (error) {
      console.error('잘못된 SSE 데이터입니다.', error);
    }
    window.clearTimeout(stateReloadTimer);
    stateReloadTimer = window.setTimeout(() => {
      refreshStateFromServer(payload?.state || null);
    }, 60);
  };

  const disposeStateStream = () => {
    if (stateEventSource) {
      stateEventSource.close();
      stateEventSource = null;
    }
  };

  const handleStateStreamError = () => {
    disposeStateStream();
    window.setTimeout(() => {
      initStateStream();
    }, 1000);
  };

  const initStateStream = () => {
    if (typeof window === 'undefined') return;
    if (stateEventSource || !window.EventSource) return;
    try {
      stateEventSource = new EventSource(STATE_STREAM_ENDPOINT);
      stateEventSource.addEventListener('stateUpdate', handleStateStreamUpdate);
      stateEventSource.addEventListener('error', handleStateStreamError);
    } catch (error) {
      console.error('상태 스트림을 구독하지 못했습니다.', error);
    }
  };

  const getParticipantById = (id) => participants.find((member) => member.id === id);

  const init = async () => {
    boardEl = document.getElementById('gameBoard');
    participantsListEl = document.getElementById('participantsList');
    participantSortSelect = document.getElementById('participantSortSelect');
    addCourtBtn = document.getElementById('addCourtBtn');
    resetBtn = document.getElementById('resetBoardBtn');
    participantNameInput = document.getElementById('participantNameInput');
    participantGradeSelect = document.getElementById('participantGradeSelect');
    addParticipantBtn = document.getElementById('addParticipantBtn');
    waitlistRowsEl = document.getElementById('waitlistRows');
    addWaitlistRowBtn = document.getElementById('addWaitlistRowBtn');
    hardResetBtn = document.getElementById('hardResetBtn');
    downloadHistoryBtn = document.getElementById('downloadHistoryBtn');
    participantDetailModal = document.getElementById('participantDetailModal');
    participantDetailNameEl = document.getElementById('participantDetailName');
    participantDetailArrivalEl = document.getElementById('participantDetailArrival');
    participantDetailCountInput = document.getElementById('participantDetailCountInput');
    participantDetailSaveBtn = document.getElementById('participantDetailSaveBtn');
    participantDetailCloseBtn = document.getElementById('participantDetailCloseBtn');
    participantDetailCountIncreaseBtn = document.getElementById('participantDetailCountIncrease');
    participantDetailCountDecreaseBtn = document.getElementById('participantDetailCountDecrease');
    participantDetailColorInputs = [...document.querySelectorAll('input[name="participantDetailColor"]')];
    participantDetailGradeSelect = document.getElementById('participantDetailGradeSelect');
    participantDetailMatchListEl = document.getElementById('participantMatchHistoryList');
    participantDetailMatchEmptyEl = document.getElementById('participantMatchHistoryEmpty');
    participantLessonStartSelect = document.getElementById('participantLessonStartSelect');
    participantLessonEndSelect = document.getElementById('participantLessonEndSelect');
    participantLessonCardEl = document.getElementById('participantLessonCard');
    participantLessonToggleBtn = document.getElementById('participantLessonToggleBtn');
    slotParticipantPickerEl = document.getElementById('slotParticipantPicker');
    slotPickerSearchInput = document.getElementById('slotPickerSearchInput');
    slotPickerListEl = document.getElementById('slotPickerList');
    slotPickerEmptyMessageEl = document.getElementById('slotPickerEmptyMessage');

    if (!boardEl || !participantsListEl) return;

    const capabilities = await loadCapabilities();
    isReadOnlyMode = Boolean(capabilities?.readOnly);
    applyModeSpecificBranding();
    if (isReadOnlyMode) {
      document.body?.classList.add('read-only-mode');
    }
    initLessonTimeControls();

    const savedState = await loadState();
    applyStateSnapshot(savedState);
    if (!isReadOnlyMode) {
      enableListDrop();
    }
    bindParticipantDetailModal();

    participantSortSelect?.addEventListener('change', handleParticipantSortChange);

    if (!isReadOnlyMode) {
      addCourtBtn?.addEventListener('click', handleAddCourt);
      resetBtn?.addEventListener('click', resetBoardPositions);
      addParticipantBtn?.addEventListener('click', handleAddParticipant);
      addWaitlistRowBtn?.addEventListener('click', handleAddWaitlistRow);
      hardResetBtn?.addEventListener('click', handleHardReset);
      participantNameInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleAddParticipant();
        }
      });
      bindWaitlistReorderEvents();
      initSlotParticipantPicker();
      document.addEventListener('click', handleWaitlistCourtMenuDocumentClick);
      document.addEventListener('keydown', handleWaitlistCourtMenuKeydown);
    } else {
      applyReadOnlyUiState();
    }
    downloadHistoryBtn?.addEventListener('click', handleDownloadHistory);
    initStateStream();
    startLessonStatusWatcher();
  };

  const bindWaitlistReorderEvents = () => {
    if (!waitlistRowsEl) return;
    waitlistRowsEl.addEventListener('dragover', handleWaitlistRowDragOver);
    waitlistRowsEl.addEventListener('dragleave', handleWaitlistRowDragLeave);
    waitlistRowsEl.addEventListener('drop', handleWaitlistRowContainerDrop);
  };

  const bindParticipantDetailModal = () => {
    if (!participantDetailModal) return;
    participantDetailModal.addEventListener('click', (event) => {
      const action = event.target?.dataset?.modalAction;
      if (action === 'close') {
        closeParticipantDetail();
      }
    });
    participantDetailCloseBtn?.addEventListener('click', closeParticipantDetail);
    if (!isReadOnlyMode) {
      participantDetailSaveBtn?.addEventListener('click', handleParticipantDetailSave);
      participantDetailCountIncreaseBtn?.addEventListener('click', () => adjustParticipantDetailCount(1));
      participantDetailCountDecreaseBtn?.addEventListener('click', () => adjustParticipantDetailCount(-1));
      participantDetailCountInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleParticipantDetailSave();
        }
      });
    }
    document.addEventListener('keydown', handleParticipantDetailKeydown);
  };

  const initLessonTimeControls = () => {
    if (!participantLessonStartSelect || !participantLessonEndSelect) return;
    populateLessonSelect(participantLessonStartSelect, '시작 시간 선택');
    populateLessonSelect(participantLessonEndSelect, '종료 시간 선택');
    participantLessonStartSelect.addEventListener('change', handleLessonTimeInputChange);
    participantLessonEndSelect.addEventListener('change', handleLessonTimeInputChange);
    participantLessonStartSelect.disabled = true;
    participantLessonEndSelect.disabled = true;
    participantLessonToggleBtn?.addEventListener('click', handleLessonToggleClick);
    if (isReadOnlyMode && participantLessonToggleBtn) {
      participantLessonToggleBtn.disabled = true;
    }
    setLessonControlsEnabled(false);
    updateLessonCardActiveState();
  };

  const populateLessonSelect = (select, placeholder) => {
    if (!select) return;
    select.innerHTML = '';
    LESSON_TIME_OPTIONS.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      if (!value) {
        option.textContent = placeholder || '선택 안 함';
      } else {
        option.textContent = value;
      }
      select.appendChild(option);
    });
  };

  const handleLessonTimeInputChange = () => {
    updateLessonCardActiveState();
  };

  const handleLessonToggleClick = () => {
    if (isReadOnlyMode) return;
    const next = !isLessonControlsEnabled;
    if (next) {
      if (!normalizeLessonTime(participantLessonStartSelect?.value)) {
        setLessonSelectValue(participantLessonStartSelect, DEFAULT_LESSON_START, DEFAULT_LESSON_START);
      }
      if (!normalizeLessonTime(participantLessonEndSelect?.value)) {
        setLessonSelectValue(participantLessonEndSelect, DEFAULT_LESSON_END, DEFAULT_LESSON_END);
      }
    } else {
      if (participantLessonStartSelect) participantLessonStartSelect.value = '';
      if (participantLessonEndSelect) participantLessonEndSelect.value = '';
    }
    setLessonControlsEnabled(next);
    updateLessonCardActiveState();
  };

  const setDetailLessonState = ({ enabled, start, end }) => {
    if (enabled) {
      setLessonSelectValue(participantLessonStartSelect, start || DEFAULT_LESSON_START, DEFAULT_LESSON_START);
      setLessonSelectValue(participantLessonEndSelect, end || DEFAULT_LESSON_END, DEFAULT_LESSON_END);
    } else {
      if (participantLessonStartSelect) participantLessonStartSelect.value = '';
      if (participantLessonEndSelect) participantLessonEndSelect.value = '';
    }
    setLessonControlsEnabled(Boolean(enabled));
    updateLessonCardActiveState();
  };

  const setLessonSelectValue = (select, value, fallback) => {
    if (!select) return;
    const normalized = normalizeLessonTime(value) || fallback;
    const option = Array.from(select.options).find((item) => item.value === normalized);
    if (option) {
      select.value = normalized;
    } else if (select.options.length) {
      select.selectedIndex = 0;
    }
  };

  const setLessonControlsEnabled = (enabled) => {
    isLessonControlsEnabled = Boolean(enabled);
    const isInteractive = isLessonControlsEnabled && !isReadOnlyMode;
    if (participantLessonStartSelect) {
      participantLessonStartSelect.disabled = !isInteractive;
    }
    if (participantLessonEndSelect) {
      participantLessonEndSelect.disabled = !isInteractive;
    }
    if (participantLessonToggleBtn) {
      participantLessonToggleBtn.textContent = isLessonControlsEnabled ? '레슨 비활성화' : '레슨 활성화';
      participantLessonToggleBtn.setAttribute('aria-pressed', String(isLessonControlsEnabled));
      participantLessonToggleBtn.classList.toggle('is-active', isLessonControlsEnabled);
    }
    participantLessonCardEl?.classList.toggle('lesson-disabled', !isLessonControlsEnabled);
  };

  const getDetailLessonTimeSelection = () => {
    if (!isLessonControlsEnabled) {
      return { enabled: false, start: '', end: '' };
    }
    return {
      enabled: true,
      start: getLessonTimeValue(participantLessonStartSelect),
      end: getLessonTimeValue(participantLessonEndSelect),
    };
  };

  const getLessonTimeValue = (select) => {
    if (!select) return '';
    return normalizeLessonTime(select.value || '');
  };

  const parseLessonTime = (value) => {
    const normalized = normalizeLessonTime(value);
    if (!normalized) return null;
    const [hours, minutes] = normalized.split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const isLessonWindowActive = (start, end) => {
    const startDate = parseLessonTime(start);
    const endDate = parseLessonTime(end);
    if (!startDate || !endDate) return false;
    if (endDate <= startDate) return false;
    const now = new Date();
    return now >= startDate && now < endDate;
  };

  const updateLessonCardActiveState = () => {
    if (!participantLessonCardEl) return;
    const { start, end, enabled } = getDetailLessonTimeSelection();
    const isActive = enabled && isLessonWindowActive(start, end);
    participantLessonCardEl.classList.toggle('lesson-active', isActive);
  };

  const refreshLessonIndicators = () => {
    updateLessonCardActiveState();
    updateAllParticipantLessonStates();
  };

  const startLessonStatusWatcher = () => {
    if (lessonStatusTimer || typeof window === 'undefined') {
      refreshLessonIndicators();
      return;
    }
    refreshLessonIndicators();
    lessonStatusTimer = window.setInterval(refreshLessonIndicators, LESSON_STATUS_POLL_INTERVAL);
  };

  const handleParticipantDetailKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (!participantDetailModal?.classList.contains('is-open')) return;
    event.preventDefault();
    closeParticipantDetail();
  };

  const getDetailCountInputValue = () => {
    if (!participantDetailCountInput) return 0;
    return normalizeCountValue(participantDetailCountInput.value);
  };

  const setDetailCountInputValue = (value) => {
    if (!participantDetailCountInput) return;
    const normalized = normalizeCountValue(value);
    participantDetailCountInput.value = String(normalized);
  };

  const adjustParticipantDetailCount = (delta) => {
    const nextValue = getDetailCountInputValue() + delta;
    setDetailCountInputValue(nextValue);
  };

  const setDetailColorValue = (color) => {
    if (!participantDetailColorInputs?.length) return;
    const normalized = normalizeParticipantColor(color);
    let matched = false;
    participantDetailColorInputs.forEach((input) => {
      const isMatch = input.value === normalized;
      input.checked = isMatch;
      if (isMatch) {
        matched = true;
      }
    });
    if (!matched && participantDetailColorInputs[0]) {
      participantDetailColorInputs[0].checked = true;
    }
  };

  const getDetailColorValue = () => {
    if (!participantDetailColorInputs?.length) return 'blue';
    const selected = participantDetailColorInputs.find((input) => input.checked);
    return normalizeParticipantColor(selected?.value);
  };

  const setDetailGradeValue = (grade) => {
    if (!participantDetailGradeSelect) return;
    const normalized = normalizeParticipantGrade(grade);
    participantDetailGradeSelect.value = normalized;
  };

  const getDetailGradeValue = () => {
    if (!participantDetailGradeSelect) return DEFAULT_PARTICIPANT_GRADE;
    return normalizeParticipantGrade(participantDetailGradeSelect.value);
  };

  const openParticipantDetail = (participantId) => {
    if (!participantDetailModal) return;
    const participant = getParticipantById(participantId);
    if (!participant) return;
    activeDetailParticipantId = participantId;
    const wasOpen = participantDetailModal.classList.contains('is-open');
    participantDetailModal.classList.add('is-open');
    participantDetailModal.setAttribute('aria-hidden', 'false');
    if (participantDetailNameEl) {
      participantDetailNameEl.textContent = participant.name;
    }
    const session = getParticipantTodaySession(participantId);
    setDetailCountInputValue(session?.count || 0);
    setDetailColorValue(participant.color || 'blue');
    setDetailGradeValue(participant.grade || DEFAULT_PARTICIPANT_GRADE);
    if (participantDetailArrivalEl) {
      const arrivalLabel = formatArrivalTime(session?.joinedAt || null);
      participantDetailArrivalEl.textContent = arrivalLabel;
    }
    renderParticipantMatchHistory(participantId);
    const lessonTimes = getParticipantLessonTimes(participantId);
    setDetailLessonState(lessonTimes);
    if (!isReadOnlyMode) {
      participantDetailCountInput?.focus();
      participantDetailCountInput?.select();
    }
    if (!wasOpen) {
      lockModalScroll();
    }
  };

  const closeParticipantDetail = () => {
    if (!participantDetailModal) return;
    const wasOpen = participantDetailModal.classList.contains('is-open');
    participantDetailModal.classList.remove('is-open');
    participantDetailModal.setAttribute('aria-hidden', 'true');
    activeDetailParticipantId = null;
    if (wasOpen) {
      unlockModalScroll();
    }
  };

  const handleParticipantDetailSave = () => {
    if (isReadOnlyMode) {
      closeParticipantDetail();
      return;
    }
    if (!activeDetailParticipantId) {
      closeParticipantDetail();
      return;
    }
    const count = getDetailCountInputValue();
    setParticipantTodayCount(activeDetailParticipantId, count);
    const selectedColor = getDetailColorValue();
    setParticipantColor(activeDetailParticipantId, selectedColor);
    const selectedGrade = getDetailGradeValue();
    setParticipantGrade(activeDetailParticipantId, selectedGrade);
    const lessonSelection = getDetailLessonTimeSelection();
    setParticipantLessonTimes(
      activeDetailParticipantId,
      lessonSelection.start,
      lessonSelection.end,
      lessonSelection.enabled,
    );
    updateParticipantLessonHighlight(activeDetailParticipantId);
    renderParticipants();
    schedulePersist();
    closeParticipantDetail();
  };

  const handleWaitlistRowDragOver = (event) => {
    const payload = parseDragPayload(event);
    if (!payload || payload.source !== 'waitlistRow') return;
    const targetRow = event.target.closest('.waitlist-row');
    if (!targetRow || targetRow.dataset.rowId === payload.rowId) {
      clearWaitlistDropHighlight();
      return;
    }
    event.preventDefault();
    if (currentWaitlistDropTarget !== targetRow) {
      clearWaitlistDropHighlight();
      currentWaitlistDropTarget = targetRow;
      currentWaitlistDropTarget.classList.add('waitlist-row-drop-target');
    }
  };

  const handleWaitlistRowDragLeave = (event) => {
    const related = event.relatedTarget;
    if (related && waitlistRowsEl?.contains(related)) return;
    clearWaitlistDropHighlight();
  };

  const handleWaitlistRowContainerDrop = (event) => {
    const payload = parseDragPayload(event);
    if (!payload || payload.source !== 'waitlistRow') return;
    const container = waitlistRowsEl;
    if (!container) return;
    let targetRow = event.target.closest('.waitlist-row');
    const draggedRow = document.querySelector(`.waitlist-row[data-row-id="${payload.rowId}"]`);
    clearWaitlistDropHighlight();
    if (!draggedRow) return;
    event.preventDefault();
    if (!targetRow || draggedRow === targetRow) {
      container.appendChild(draggedRow);
    } else {
      container.insertBefore(draggedRow, targetRow);
    }
    refreshWaitlistRowLabels();
    schedulePersist();
  };

  const clearWaitlistDropHighlight = () => {
    if (currentWaitlistDropTarget) {
      currentWaitlistDropTarget.classList.remove('waitlist-row-drop-target');
      currentWaitlistDropTarget = null;
    }
  };

  const handleWaitlistRowTitleClick = (event, row, trigger) => {
    if (!row || !trigger) return;
    if (row.classList.contains('waitlist-row-dragging')) return;
    event.preventDefault();
    event.stopPropagation();
    toggleWaitlistCourtMenu(row, trigger);
  };

  const handleWaitlistRowTitleKeydown = (event, row, trigger) => {
    if (!row || !trigger) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleWaitlistCourtMenu(row, trigger);
  };

  const toggleWaitlistCourtMenu = (row, trigger) => {
    if (!row || !trigger) return;
    if (activeWaitlistCourtMenu?.row === row) {
      closeWaitlistCourtMenu(row);
    } else {
      openWaitlistCourtMenu(row, trigger);
    }
  };

  const openWaitlistCourtMenu = (row, trigger) => {
    if (!row) return;
    closeWaitlistCourtMenu();
    const menu = ensureWaitlistCourtMenu(row);
    renderWaitlistCourtMenu(row, menu);
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    trigger?.classList.add('waitlist-row-title-active');
    trigger?.setAttribute('aria-expanded', 'true');
    activeWaitlistCourtMenu = { row, menu, trigger };
  };

  const closeWaitlistCourtMenu = (targetRow = null) => {
    if (!activeWaitlistCourtMenu) return;
    if (targetRow && activeWaitlistCourtMenu.row !== targetRow) return;
    const { menu, trigger } = activeWaitlistCourtMenu;
    menu?.classList.remove('is-open');
    menu?.setAttribute('aria-hidden', 'true');
    trigger?.classList.remove('waitlist-row-title-active');
    trigger?.setAttribute('aria-expanded', 'false');
    activeWaitlistCourtMenu = null;
  };

  const ensureWaitlistCourtMenu = (row) => {
    let menu = row.querySelector('.waitlist-row-court-menu');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'waitlist-row-court-menu';
    menu.setAttribute('aria-hidden', 'true');

    const label = document.createElement('p');
    label.className = 'waitlist-row-court-menu-label';
    label.textContent = '코트로 이동';

    const hint = document.createElement('p');
    hint.className = 'waitlist-row-court-menu-hint';

    const list = document.createElement('div');
    list.className = 'waitlist-row-court-menu-list';

    const empty = document.createElement('p');
    empty.className = 'waitlist-row-court-menu-empty';
    empty.textContent = '등록된 코트가 없습니다.';

    menu.appendChild(label);
    menu.appendChild(hint);
    menu.appendChild(list);
    menu.appendChild(empty);

    const slotRow = row.querySelector('.waitlist-slot-row');
    if (slotRow) {
      row.insertBefore(menu, slotRow);
    } else {
      row.appendChild(menu);
    }
    return menu;
  };

  const renderWaitlistCourtMenu = (row, menu) => {
    if (!row || !menu) return;
    const list = menu.querySelector('.waitlist-row-court-menu-list');
    const hint = menu.querySelector('.waitlist-row-court-menu-hint');
    const empty = menu.querySelector('.waitlist-row-court-menu-empty');
    if (!list || !hint || !empty) return;
    list.innerHTML = '';

    const participants = getWaitlistRowParticipants(row);
    const hasParticipants = participants.length > 0;
    const courts = boardEl
      ? [...boardEl.querySelectorAll('.court')].sort(
          (a, b) => Number(a.dataset.number || 0) - Number(b.dataset.number || 0),
        )
      : [];
    const hasCourts = courts.length > 0;

    hint.textContent = hasParticipants ? '이동할 코트를 선택하세요.' : '대기 인원을 먼저 추가하세요.';
    hint.classList.toggle('is-disabled', !hasParticipants);

    empty.classList.toggle('is-visible', !hasCourts);
    if (!hasCourts) {
      return;
    }

    courts.forEach((court) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'waitlist-row-court-option';
      const number = court.dataset.number;
      button.textContent = number ? `코트 ${number}` : '코트';
      button.disabled = !hasParticipants;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleWaitlistCourtMenuSelection(row, court);
      });
      list.appendChild(button);
    });
  };

  const handleWaitlistCourtMenuSelection = (row, court) => {
    if (!row || !court) return;
    const participants = getWaitlistRowParticipants(row);
    if (!participants.length) return;
    const payload = {
      source: 'waitlistRow',
      rowId: row.dataset.rowId,
      participants,
    };
    handleWaitlistRowDropOnCourt(payload, court);
    closeWaitlistCourtMenu();
  };

  const handleWaitlistCourtMenuDocumentClick = (event) => {
    if (!activeWaitlistCourtMenu) return;
    const { menu, trigger } = activeWaitlistCourtMenu;
    if (menu?.contains(event.target) || trigger?.contains(event.target)) {
      return;
    }
    closeWaitlistCourtMenu();
  };

  const handleWaitlistCourtMenuKeydown = (event) => {
    if (event.key === 'Escape' && activeWaitlistCourtMenu) {
      closeWaitlistCourtMenu();
    }
  };

  const ensureListCardResizeObserver = () => {
    if (listCardResizeObserver || typeof ResizeObserver === 'undefined') {
      return listCardResizeObserver;
    }
    listCardResizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        updateListCardActionLayout(entry.target, entry.contentRect?.width);
      });
    });
    return listCardResizeObserver;
  };

  const updateListCardActionLayout = (card, reportedWidth = null) => {
    if (!card || !card.isConnected || card.classList.contains('on-board')) return;
    const actions = card.querySelector('.card-actions');
    if (!actions) return;
    const width = typeof reportedWidth === 'number' ? reportedWidth : card.getBoundingClientRect().width;
    const shouldStack = width < LIST_CARD_ACTION_STACK_WIDTH;
    actions.classList.toggle('card-actions-stacked', shouldStack);
    actions.classList.toggle('card-actions-inline', !shouldStack);
  };

  const observeListCardActionLayout = (card) => {
    if (!card) return;
    updateListCardActionLayout(card);
    const observer = ensureListCardResizeObserver();
    observer?.observe(card);
  };

  const unobserveListCardActionLayout = (card) => {
    if (!card || !listCardResizeObserver) return;
    listCardResizeObserver.unobserve(card);
  };

  const resetListCardActionObserver = () => {
    listCardResizeObserver?.disconnect();
  };

  const initSlotParticipantPicker = () => {
    if (!slotParticipantPickerEl) return;
    slotParticipantPickerEl.addEventListener('click', (event) => {
      const action = event.target?.dataset?.slotPickerAction;
      if (action === 'close') {
        closeSlotParticipantPicker();
      }
    });
    slotPickerListEl?.addEventListener('click', handleSlotPickerListClick);
    slotPickerSearchInput?.addEventListener('input', handleSlotPickerSearchInput);
    document.addEventListener('keydown', handleSlotPickerKeydown);
  };

  const openSlotParticipantPicker = (slot) => {
    if (!slotParticipantPickerEl || !slot) return;
    if (slotPickerActiveSlot) {
      slotPickerActiveSlot.classList.remove('slot-picker-target');
    }
    slotPickerActiveSlot = slot;
    slotPickerActiveSlot.classList.add('slot-picker-target');
    const wasOpen = slotParticipantPickerEl.classList.contains('is-open');
    slotParticipantPickerEl.classList.add('is-open');
    slotParticipantPickerEl.setAttribute('aria-hidden', 'false');
    if (slotPickerSearchInput) {
      slotPickerSearchInput.value = '';
    }
    renderSlotParticipantOptions();
    requestAnimationFrame(() => {
      if (!focusSlotPickerDefaultItem()) {
        slotPickerSearchInput?.focus();
      }
    });
    if (!wasOpen) {
      lockModalScroll();
    }
  };

  const closeSlotParticipantPicker = () => {
    if (!slotParticipantPickerEl) return;
    const wasOpen = slotParticipantPickerEl.classList.contains('is-open');
    slotParticipantPickerEl.classList.remove('is-open');
    slotParticipantPickerEl.setAttribute('aria-hidden', 'true');
    if (slotPickerActiveSlot) {
      slotPickerActiveSlot.classList.remove('slot-picker-target');
      slotPickerActiveSlot = null;
    }
    if (wasOpen) {
      unlockModalScroll();
    }
  };

  const renderSlotParticipantOptions = (query = '') => {
    if (!slotPickerListEl) return;
    const normalized = query.trim().toLowerCase();
    slotPickerListEl.innerHTML = '';
    const matches = participants
      .filter((member) => (member.name || '').toLowerCase().includes(normalized))
      .sort((a, b) => {
        const diff = compareParticipantsByGameCount(a, b);
        if (diff !== 0) return diff;
        return compareParticipantsByName(a, b);
      });
    matches.forEach((member) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'slot-picker-item';
      item.dataset.participantId = member.id;
      item.setAttribute('role', 'option');
      const name = document.createElement('span');
      name.className = 'slot-picker-item-name';
      name.textContent = member.name;
      const meta = document.createElement('span');
      meta.className = 'slot-picker-item-meta';
      meta.textContent = formatTodayCount(getParticipantTodayCount(member.id));
      item.appendChild(name);
      item.appendChild(meta);
      slotPickerListEl.appendChild(item);
    });
    slotPickerEmptyMessageEl?.classList.toggle('is-visible', matches.length === 0);
  };

  const focusSlotPickerDefaultItem = () => {
    if (!slotPickerListEl) return false;
    const firstItem = slotPickerListEl.querySelector('.slot-picker-item');
    if (!firstItem) return false;
    firstItem.focus();
    return true;
  };

  const handleSlotPickerSearchInput = (event) => {
    renderSlotParticipantOptions(event.target.value || '');
  };

  const handleSlotPickerListClick = (event) => {
    const target = event.target?.closest('.slot-picker-item');
    if (!target || !slotPickerListEl?.contains(target)) return;
    const participantId = target.dataset.participantId;
    handleSlotPickerSelection(participantId);
  };

  const handleSlotPickerSelection = (participantId) => {
    if (!participantId || !slotPickerActiveSlot) return;
    const participant = getParticipantById(participantId);
    if (!participant) return;
    const slotType = slotPickerActiveSlot.dataset.slotType || 'court';
    if (slotType === 'waitlist') {
      const waitCard = createWaitlistCard(participant);
      placeWaitlistCardInSlot(waitCard, slotPickerActiveSlot);
    } else {
      const existing = boardEl.querySelector(`.slot .card[data-participant-id="${participant.id}"]`);
      if (existing) {
        removeBoardCard(existing);
      }
      const card = createBoardCard(participant);
      placeCardInSlot(card, slotPickerActiveSlot);
    }
    closeSlotParticipantPicker();
  };

  const handleSlotPickerKeydown = (event) => {
    if (event.key === 'Escape' && slotParticipantPickerEl?.classList.contains('is-open')) {
      closeSlotParticipantPicker();
    }
  };

  const refreshSlotPickerOptions = () => {
    if (!slotParticipantPickerEl?.classList.contains('is-open')) return;
    const query = slotPickerSearchInput?.value || '';
    renderSlotParticipantOptions(query);
  };

  const renderParticipants = () => {
    if (!participantsListEl) return;
    if (participantSortSelect) {
      participantSortSelect.value = participantSortMode;
    }
    resetListCardActionObserver();
    participantsListEl.innerHTML = '';
    const sortedMembers = getSortedParticipants();
    sortedMembers.forEach((member) => {
      const card = createListCard(member);
      participantsListEl.appendChild(card);
      observeListCardActionLayout(card);
    });
    updateAllParticipantStats();
    refreshSlotPickerOptions();
    if (isReadOnlyMode) {
      disableCardInteractions();
    }
    updateAllParticipantLessonStates();
  };

  const getSortedParticipants = () => {
    if (participantSortMode === PARTICIPANT_SORT_MODES.CREATED) {
      return [...participants];
    }
    const comparator = getParticipantComparator(participantSortMode);
    if (!comparator) {
      return [...participants];
    }
    const indexed = participants.map((member, index) => ({ member, index }));
    indexed.sort((a, b) => {
      const diff = comparator(a.member, b.member);
      if (diff !== 0) return diff;
      return compareNumbers(a.index, b.index);
    });
    return indexed.map((entry) => entry.member);
  };

  const getParticipantComparator = (mode) => {
    switch (mode) {
      case PARTICIPANT_SORT_MODES.GAMES_ASC:
        return compareParticipantsByGameCount;
      case PARTICIPANT_SORT_MODES.ARRIVAL:
        return compareParticipantsByArrival;
      case PARTICIPANT_SORT_MODES.NAME:
        return compareParticipantsByName;
      default:
        return null;
    }
  };

  const compareNumbers = (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  };

  const compareParticipantsByName = (a, b) => {
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, 'ko-KR');
  };

  const getParticipantJoinedTimestamp = (participantId) => {
    const joinedAt = getParticipantJoinedAt(participantId);
    if (!joinedAt) return Number.POSITIVE_INFINITY;
    const timestamp = Date.parse(joinedAt);
    if (Number.isNaN(timestamp)) {
      return Number.POSITIVE_INFINITY;
    }
    return timestamp;
  };

  const compareParticipantsByArrival = (a, b) => {
    const diff = compareNumbers(getParticipantJoinedTimestamp(a.id), getParticipantJoinedTimestamp(b.id));
    if (diff !== 0) return diff;
    return compareParticipantsByName(a, b);
  };

  const compareParticipantsByGameCount = (a, b) => {
    const diff = compareNumbers(getParticipantTodayCount(a.id), getParticipantTodayCount(b.id));
    if (diff !== 0) return diff;
    return compareParticipantsByArrival(a, b);
  };

  const handleParticipantSortChange = (event) => {
    const nextMode = event.target?.value;
    if (!nextMode || participantSortMode === nextMode) return;
    participantSortMode = nextMode;
    renderParticipants();
    schedulePersist();
  };

  const getParticipantStatus = (participantId) => {
    const participant = getParticipantById(participantId);
    return participant?.status || 'pending';
  };

  const markParticipantSubmitted = (participantId) => {
    const participant = getParticipantById(participantId);
    if (!participant || participant.status === 'submitted') return;
    participant.status = 'submitted';
    syncParticipantCards(participantId);
    schedulePersist();
  };

  const markParticipantPending = (participantId) => {
    const participant = getParticipantById(participantId);
    if (!participant || participant.status === 'pending') return;
    participant.status = 'pending';
    syncParticipantCards(participantId);
    schedulePersist();
  };


  const getParticipantSessionForDate = (participantId, dateKey = null) => {
    const participant = getParticipantById(participantId);
    if (!participant) return null;
    const targetDate = dateKey || getTodayKey();
    participant.sessions = participant.sessions || {};
    let entry = participant.sessions[targetDate];
    entry = normalizeSessionEntry(entry);
    participant.sessions[targetDate] = entry;
    return entry;
  };

  const getParticipantTodaySession = (participantId) => getParticipantSessionForDate(participantId);

  const setParticipantTodayCount = (participantId, requestedCount) => {
    const session = getParticipantTodaySession(participantId);
    if (!session) return 0;
    const normalized = normalizeCountValue(requestedCount);
    session.count = normalized;
    const today = getTodayKey();
    history[today] = history[today] || {};
    history[today][participantId] = normalized;
    updateParticipantStatsDisplay(participantId);
    return normalized;
  };

  const incrementParticipantGameCount = (participantId) => {
    const session = getParticipantTodaySession(participantId);
    if (!session) return;
    setParticipantTodayCount(participantId, session.count + 1);
  };

  const setParticipantJoinedAt = (participantId, timestamp = new Date()) => {
    const session = getParticipantTodaySession(participantId);
    if (!session) return null;
    if (!session.joinedAt) {
      session.joinedAt = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
    }
    return session.joinedAt;
  };

  const getParticipantJoinedAt = (participantId) => {
    const session = getParticipantTodaySession(participantId);
    return session?.joinedAt || null;
  };

  const getParticipantLessonTimes = (participantId) => {
    const session = getParticipantTodaySession(participantId);
    if (!session) {
      return { start: '', end: '', enabled: false };
    }
    session.lessonStart = normalizeLessonTime(session.lessonStart);
    session.lessonEnd = normalizeLessonTime(session.lessonEnd);
    session.lessonEnabled = normalizeLessonEnabled(session.lessonEnabled);
    return { start: session.lessonStart, end: session.lessonEnd, enabled: session.lessonEnabled };
  };

  const setParticipantLessonTimes = (participantId, startTime, endTime, enabled) => {
    const session = getParticipantTodaySession(participantId);
    if (!session) return;
    session.lessonEnabled = normalizeLessonEnabled(enabled);
    if (!session.lessonEnabled) {
      session.lessonStart = '';
      session.lessonEnd = '';
      return;
    }
    session.lessonStart = normalizeLessonTime(startTime);
    session.lessonEnd = normalizeLessonTime(endTime);
  };

  const isParticipantLessonActive = (participantId) => {
    const { start, end, enabled } = getParticipantLessonTimes(participantId);
    if (!enabled) return false;
    return isLessonWindowActive(start, end);
  };

  const updateParticipantLessonHighlight = (participantId) => {
    if (!participantId) return false;
    const isActive = isParticipantLessonActive(participantId);
    const nodes = document.querySelectorAll(
      `.card[data-participant-id="${participantId}"], .wait-card[data-participant-id="${participantId}"]`,
    );
    nodes.forEach((node) => node.classList.toggle('lesson-active', isActive));
    return isActive;
  };

  const updateAllParticipantLessonStates = () => {
    participants.forEach((member) => updateParticipantLessonHighlight(member.id));
  };

  const syncParticipantCards = (participantId) => {
    const status = getParticipantStatus(participantId);
    const cards = document.querySelectorAll(`.card[data-participant-id="${participantId}"]`);
    cards.forEach((card) => applySubmissionState(card, status));
  };

  const updateParticipantCardColors = (participantId, color) => {
    const cards = document.querySelectorAll(`.card[data-participant-id="${participantId}"]`);
    cards.forEach((card) => {
      card.dataset.color = color;
    });
  };

  const setParticipantColor = (participantId, requestedColor) => {
    const participant = getParticipantById(participantId);
    if (!participant) return false;
    const normalized = normalizeParticipantColor(requestedColor || participant.color);
    if (participant.color === normalized) return false;
    participant.color = normalized;
    updateParticipantCardColors(participantId, normalized);
    return true;
  };

  const updateParticipantCardGrades = (participantId, grade) => {
    const nodes = document.querySelectorAll(
      `.card[data-participant-id="${participantId}"], .wait-card[data-participant-id="${participantId}"]`,
    );
    nodes.forEach((node) => applyGradeToNode(node, grade));
  };

  const applyGradeToNode = (node, grade) => {
    if (!node) return;
    const normalized = normalizeParticipantGrade(grade);
    node.dataset.grade = normalized;
    const badge = node.querySelector('.grade-badge');
    if (badge) {
      updateGradeBadgeElement(badge, normalized);
    }
  };

  const setParticipantGrade = (participantId, requestedGrade) => {
    const participant = getParticipantById(participantId);
    if (!participant) return false;
    const normalized = normalizeParticipantGrade(requestedGrade || participant.grade);
    if (participant.grade === normalized) return false;
    participant.grade = normalized;
    updateParticipantCardGrades(participantId, normalized);
    return true;
  };

  const applySubmissionState = (card, status) => {
    card.dataset.submissionStatus = status;
    if (status === 'submitted') {
      card.classList.remove('card-pending');
      card.classList.add('card-submitted');
    } else {
      card.classList.add('card-pending');
      card.classList.remove('card-submitted');
    }
    const shuttleBtn = card.querySelector('.shuttle-btn');
    if (shuttleBtn) {
      const isSubmitted = status === 'submitted';
      shuttleBtn.classList.toggle('shuttle-btn-complete', isSubmitted);
      shuttleBtn.disabled = isSubmitted;
      shuttleBtn.setAttribute('aria-label', isSubmitted ? '셔틀콕 제출 완료됨' : '셔틀콕 제출 완료 처리');
    }
  };

  const createShuttleButton = (participantId) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shuttle-btn';
    button.setAttribute('aria-label', '셔틀콕 제출 완료 처리');
    button.dataset.participantId = participantId;

    const icon = document.createElement('img');
    icon.src = SHUTTLE_IMAGE;
    icon.alt = '';
    icon.className = 'shuttle-icon';
    button.appendChild(icon);

    const stopEvent = (event) => {
      event.stopPropagation();
    };

    if (isReadOnlyMode) {
      button.disabled = true;
      button.setAttribute('aria-hidden', 'true');
    } else {
      button.addEventListener('pointerdown', stopEvent);
      button.addEventListener('pointerup', stopEvent);
      button.addEventListener('dragstart', (event) => event.preventDefault());

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        markParticipantSubmitted(participantId);
      });
    }

    return button;
  };

  const createDeleteButton = ({ label, onClick }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-delete';
    button.setAttribute('aria-label', label);
    button.innerHTML = '&times;';
    if (isReadOnlyMode) {
      button.disabled = true;
      button.setAttribute('aria-hidden', 'true');
    } else {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
      });
    }
    return button;
  };

  const attachNameResetHold = (target, participantId) => {
    let holdTimer = null;

    const clearHold = () => {
      if (holdTimer) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    const startHold = (event) => {
      if (event.button && event.button !== 0) return;
      if (getParticipantStatus(participantId) === 'pending') return;
      clearHold();
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        markParticipantPending(participantId);
      }, NAME_RESET_HOLD_DURATION);
    };

    target.addEventListener('pointerdown', startHold);
    target.addEventListener('pointerup', clearHold);
    target.addEventListener('pointerleave', clearHold);
    target.addEventListener('pointercancel', clearHold);
    target.addEventListener('dragstart', clearHold);
  };

  const handleHardReset = async () => {
    if (isReadOnlyMode) {
      window.alert('뷰어 모드에서는 초기화를 할 수 없습니다.');
      return;
    }
    const confirmed = window.confirm('전체 초기화를 진행하시겠습니까? 모든 데이터가 삭제됩니다.');
    if (!confirmed) return;
    await deletePersistedState();
    window.location.reload();
  };

  const handleDownloadHistory = () => {
    const today = getTodayKey();
    const todayHistory = history[today];
    if (!todayHistory || !Object.keys(todayHistory).length) {
      window.alert('오늘 기록이 없습니다.');
      return;
    }
    const output = {};
    Object.entries(todayHistory).forEach(([participantId, count]) => {
      const participant = getParticipantById(participantId);
      const name = participant?.name || participantId;
      output[name] = count;
    });
    try {
      const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${today}-history.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('히스토리를 저장하지 못했습니다.', error);
      window.alert('히스토리를 저장하지 못했습니다.');
    }
  };

  const schedulePersist = () => {
    if (isReadOnlyMode) return;
    if (isRestoringState) return;
    if (typeof window === 'undefined') return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      persistState();
    }, 200);
  };

  const getTodayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getParticipantTodayCount = (participantId) => {
    const session = getParticipantTodaySession(participantId);
    return session?.count || 0;
  };

  const formatTodayCount = (count) => `오늘 ${count}게임`;

  const formatArrivalTime = (timestamp) => {
    if (!timestamp) return '기록 없음';
    try {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) {
        return '기록 없음';
      }
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '기록 없음';
    }
  };

  const getParticipantMatchHistoryEntries = (participantId) => {
    const session = getParticipantTodaySession(participantId);
    if (!session) return [];
    const entries = Object.entries(session.matches || {}).map(([opponentId, count]) => {
      const opponent = getParticipantById(opponentId);
      return {
        opponentId,
        opponentName: opponent?.name || '이름 미상',
        count: normalizeCountValue(count),
      };
    });
    return entries.sort((a, b) => {
      const diff = compareNumbers(b.count, a.count);
      if (diff !== 0) return diff;
      return a.opponentName.localeCompare(b.opponentName, 'ko-KR');
    });
  };

  const renderParticipantMatchHistory = (participantId) => {
    if (!participantDetailMatchListEl || !participantDetailMatchEmptyEl) return;
    participantDetailMatchListEl.innerHTML = '';
    const entries = getParticipantMatchHistoryEntries(participantId);
    if (!entries.length) {
      participantDetailMatchEmptyEl.hidden = false;
      participantDetailMatchListEl.hidden = true;
      return;
    }
    participantDetailMatchEmptyEl.hidden = true;
    participantDetailMatchListEl.hidden = false;
    entries.forEach(({ opponentId, opponentName, count }) => {
      const item = document.createElement('li');
      item.className = 'match-history-item';
      item.dataset.opponentId = opponentId;

      const nameEl = document.createElement('span');
      nameEl.className = 'match-history-name';
      nameEl.textContent = opponentName;

      const countEl = document.createElement('span');
      countEl.className = 'match-history-count';
      countEl.textContent = `${count}게임`;

      item.appendChild(nameEl);
      item.appendChild(countEl);
      participantDetailMatchListEl.appendChild(item);
    });
  };

  const updateParticipantStatsDisplay = (participantId) => {
    const count = getParticipantTodayCount(participantId);
    const nodes = document.querySelectorAll(`.card[data-participant-id="${participantId}"] .today-count`);
    nodes.forEach((node) => {
      node.textContent = formatTodayCount(count);
    });
  };

  const updateAllParticipantStats = () => {
    participants.forEach((member) => updateParticipantStatsDisplay(member.id));
  };

  const persistState = async () => {
    if (isReadOnlyMode) return;
    if (typeof window === 'undefined') return;
    const data = buildState();
    try {
      const response = await fetch(STATE_API_ENDPOINT, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: data }),
      });
      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status}`);
      }
    } catch (error) {
      console.error('상태 저장에 실패했습니다.', error);
    }
  };

  const deletePersistedState = async () => {
    if (isReadOnlyMode) return;
    if (typeof window === 'undefined') return;
    try {
      const response = await fetch(STATE_API_ENDPOINT, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status}`);
      }
    } catch (error) {
      console.error('상태 초기화에 실패했습니다.', error);
    }
  };

  const buildState = () => {
    const state = {
      participants: participants.map(({ id, name, color, grade, status, sessions }) => ({
        id,
        name,
        color,
        grade,
        status,
        sessions: sessions ? { ...sessions } : {},
      })),
      courts: [],
      waitlist: [],
      history: JSON.parse(JSON.stringify(history)),
      participantSortMode,
    };

    if (boardEl) {
      const courts = [...boardEl.querySelectorAll('.court')];
      state.courts = courts.map((court) => {
        const slots = [...court.querySelectorAll('.slot')];
        return {
          number: Number(court.dataset.number),
          slots: slots.map((slot) => {
            const occupantId = slot.dataset.occupantId;
            if (!occupantId) return null;
            const card = document.getElementById(occupantId);
            return card?.dataset.participantId || null;
          }),
        };
      });
    }

    if (waitlistRowsEl) {
      const rows = [...waitlistRowsEl.querySelectorAll('.waitlist-row')];
      state.waitlist = rows.map((row) => {
        const slots = [...row.querySelectorAll('.waitlist-slot')];
        return {
          slots: slots.map((slot) => {
            const occupantId = slot.dataset.occupantId;
            if (!occupantId) return null;
            const card = document.getElementById(occupantId);
            return card?.dataset.participantId || null;
          }),
        };
      });
    }

    return state;
  };

  const loadState = async () => {
    if (typeof window === 'undefined') return null;
    try {
      const response = await fetch(STATE_API_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status}`);
      }
      const payload = await response.json();
      return payload?.state || null;
    } catch (error) {
      console.error('상태를 불러오지 못했습니다.', error);
      return null;
    }
  };

  const clearBoardUI = () => {
    usedCourtNumbers.clear();
    courtCount = 0;
    boardCardSeq = 0;
    if (boardEl) {
      boardEl.innerHTML = '';
    }
  };

  const clearWaitlistUI = () => {
    waitlistRowSeq = 0;
    waitlistCardSeq = 0;
    if (waitlistRowsEl) {
      waitlistRowsEl.innerHTML = '';
    }
  };

  const applySavedState = (state, { shouldPersist = true } = {}) => {
    if (!state) return;
    isRestoringState = true;
    try {
      clearWaitlistUI();
      clearBoardUI();

      if (Array.isArray(state.waitlist) && state.waitlist.length) {
        state.waitlist.forEach((rowData) => {
          const row = addWaitlistRow();
          const slots = row?.querySelectorAll('.waitlist-slot') || [];
          rowData.slots?.forEach((participantId, index) => {
            if (!participantId) return;
            const participant = getParticipantById(participantId);
            if (!participant) return;
            const waitCard = createWaitlistCard(participant);
            const slot = slots[index];
            if (slot) {
              placeWaitlistCardInSlot(waitCard, slot);
            }
          });
        });
      } else {
        ensureWaitlistRow();
      }

      if (Array.isArray(state.courts) && state.courts.length) {
        state.courts.forEach((courtData) => {
          createCourt(courtData.number);
          const courts = boardEl.querySelectorAll('.court');
          const courtEl = courts[courts.length - 1];
          const slots = courtEl?.querySelectorAll('.slot') || [];
          courtData.slots?.forEach((participantId, index) => {
            if (!participantId) return;
            const participant = getParticipantById(participantId);
            if (!participant) return;
            const boardCard = createBoardCard(participant);
            const slot = slots[index];
            if (slot) {
              placeCardInSlot(boardCard, slot);
            }
          });
        });
      } else {
        createCourt(3);
        createCourt(4);
      }
    } finally {
      isRestoringState = false;
      if (isReadOnlyMode) {
        disableCardInteractions();
      }
      if (shouldPersist) {
        schedulePersist();
      }
    }
  };


  const ensureWaitlistRow = () => {
    if (!waitlistRowsEl) return;
    if (!waitlistRowsEl.childElementCount) {
      addWaitlistRow();
    } else {
      refreshWaitlistRowLabels();
    }
  };

  const handleAddWaitlistRow = () => {
    if (isReadOnlyMode) return;
    addWaitlistRow();
  };

  const addWaitlistRow = () => {
    if (!waitlistRowsEl) return null;
    waitlistRowSeq += 1;
    const rowId = `wait-row-${waitlistRowSeq}`;
    const row = document.createElement('div');
    row.className = 'waitlist-row';
    row.dataset.rowId = rowId;

    const header = document.createElement('div');
    header.className = 'waitlist-row-header';

    const title = document.createElement('h4');
    title.textContent = `대기 라인 ${waitlistRowsEl.childElementCount + 1}`;
    title.classList.add('waitlist-row-title');
    title.draggable = true;
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-expanded', 'false');
    title.addEventListener('dragstart', (event) => handleWaitlistRowDragStart(event, row));
    title.addEventListener('dragend', () => handleWaitlistRowDragEnd(row));
    title.addEventListener('dragenter', (event) => event.preventDefault());
    title.addEventListener('click', (event) => handleWaitlistRowTitleClick(event, row, title));
    title.addEventListener('keydown', (event) => handleWaitlistRowTitleKeydown(event, row, title));

    const actions = document.createElement('div');
    actions.className = 'waitlist-row-header-actions';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'waitlist-row-remove';
    removeBtn.setAttribute('aria-label', `${title.textContent} 삭제`);
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => removeWaitlistRow(row));

    header.appendChild(title);
    actions.appendChild(removeBtn);
    header.appendChild(actions);

    const slotsRow = document.createElement('div');
    slotsRow.className = 'waitlist-slot-row';

    for (let i = 0; i < 4; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'waitlist-slot';
      slot.dataset.slotId = `${rowId}-slot-${i + 1}`;
      slot.dataset.slotType = 'waitlist';
      bindWaitlistSlot(slot);
      slotsRow.appendChild(slot);
    }

    row.appendChild(header);
    row.appendChild(slotsRow);
    waitlistRowsEl.appendChild(row);
    refreshWaitlistRowLabels();
    schedulePersist();
    return row;
  };

  const refreshWaitlistRowLabels = () => {
    if (!waitlistRowsEl) return;
    const rows = [...waitlistRowsEl.querySelectorAll('.waitlist-row')];
    rows.forEach((row, index) => {
      const label = row.querySelector('.waitlist-row-header h4');
      if (label) {
        label.textContent = `대기 라인 ${index + 1}`;
      }
      const removeBtn = row.querySelector('.waitlist-row-remove');
      if (removeBtn) {
        removeBtn.setAttribute('aria-label', `대기 라인 ${index + 1} 삭제`);
      }
    });
  };

  const removeWaitlistRow = (row) => {
    const cards = row.querySelectorAll('.wait-card');
    cards.forEach((card) => removeWaitlistCard(card));
    closeWaitlistCourtMenu(row);
    if (slotPickerActiveSlot && row.contains(slotPickerActiveSlot)) {
      closeSlotParticipantPicker();
    }
    row.remove();
    refreshWaitlistRowLabels();
    ensureWaitlistRow();
    schedulePersist();
  };

  const createWaitlistCard = (member) => {
    const card = document.createElement('div');
    card.className = 'wait-card';
    card.draggable = !isReadOnlyMode;
    card.id = `wait-card-${waitlistCardSeq++}`;
    card.dataset.participantId = member.id;
    card.dataset.previousSlotId = '';
    const grade = normalizeParticipantGrade(member.grade);
    card.dataset.grade = grade;
    attachNameResetHold(card, member.id);

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = member.name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'wait-card-remove';
    removeBtn.setAttribute('aria-label', `${member.name} 대기 해제`);
    removeBtn.innerHTML = '&times;';
    if (!isReadOnlyMode) {
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        removeWaitlistCard(card);
      });
    }

    card.appendChild(nameEl);
    card.appendChild(removeBtn);

    if (!isReadOnlyMode) {
      card.addEventListener('dragstart', (event) => handleWaitlistDragStart(event, card));
      card.addEventListener('dragend', () => handleWaitlistDragEnd(card));
    }

    return card;
  };

  const handleWaitlistDragStart = (event, card) => {
    const participantId = card.dataset.participantId;
    setDragPayload(event, { source: 'waitlist', participantId, cardId: card.id });
    const slot = card.closest('.waitlist-slot');
    if (slot) {
      slot.dataset.occupantId = '';
      slot.classList.remove('filled');
      card.dataset.previousSlotId = slot.dataset.slotId || '';
    }
    requestAnimationFrame(() => card.classList.add('dragging'));
  };

  const handleWaitlistDragEnd = (card) => {
    card.classList.remove('dragging');
    const slot = card.closest('.waitlist-slot');
    if (slot) {
      card.dataset.previousSlotId = slot.dataset.slotId || '';
      return;
    }
    const prevSlotId = card.dataset.previousSlotId;
    if (prevSlotId) {
      const prevSlot = document.querySelector(`.waitlist-slot[data-slot-id="${prevSlotId}"]`);
      if (prevSlot) {
        placeWaitlistCardInSlot(card, prevSlot);
        return;
      }
    }
    removeWaitlistCard(card);
  };

  const bindWaitlistSlot = (slot) => {
    if (isReadOnlyMode) return;
    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      slot.classList.add('waitlist-slot-active');
    });

    slot.addEventListener('dragleave', (event) => {
      const nextTarget = event.relatedTarget;
      if (!nextTarget || !slot.contains(nextTarget)) {
        slot.classList.remove('waitlist-slot-active');
      }
    });

    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('waitlist-slot-active');

      const payload = parseDragPayload(event);
      if (!payload) return;
      if (payload.source === 'list') {
        const member = getParticipantById(payload.participantId);
        if (!member) return;
        const waitCard = createWaitlistCard(member);
        placeWaitlistCardInSlot(waitCard, slot);
      } else if (payload.source === 'waitlist' && payload.cardId) {
        const card = document.getElementById(payload.cardId);
        if (!card) return;
        placeWaitlistCardInSlot(card, slot);
      } else if (payload.source === 'board' && payload.cardId) {
        const card = document.getElementById(payload.cardId);
        if (!card) return;
        const participantId = card.dataset.participantId;
        removeBoardCard(card);
        const member = getParticipantById(participantId);
        if (!member) return;
        const waitCard = createWaitlistCard(member);
        placeWaitlistCardInSlot(waitCard, slot);
      }
    });

    slot.addEventListener('click', (event) => handleSlotClick(event, slot));
  };

  const placeWaitlistCardInSlot = (card, slot) => {
    const existingId = slot.dataset.occupantId;
    if (existingId && existingId !== card.id) {
      removeWaitlistCardById(existingId);
    }
    freeWaitlistSlot(card);
    slot.dataset.occupantId = card.id;
    slot.classList.add('filled');
    card.dataset.previousSlotId = slot.dataset.slotId || '';
    slot.appendChild(card);
    if (slotPickerActiveSlot === slot) {
      closeSlotParticipantPicker();
    }
    const participantId = card.dataset.participantId;
    if (participantId) {
      updateParticipantLessonHighlight(participantId);
    }
    schedulePersist();
  };

  const freeWaitlistSlot = (card) => {
    const slot = card.closest('.waitlist-slot');
    if (!slot) return;
    slot.dataset.occupantId = '';
    slot.classList.remove('filled');
  };

  const removeWaitlistCard = (card) => {
    freeWaitlistSlot(card);
    card.dataset.previousSlotId = '';
    card.remove();
    schedulePersist();
  };

  const removeWaitlistCardById = (cardId) => {
    const card = document.getElementById(cardId);
    if (card) {
      removeWaitlistCard(card);
    }
  };

  const removeWaitlistEntries = (participantId) => {
    const cards = waitlistRowsEl?.querySelectorAll(`.wait-card[data-participant-id="${participantId}"]`);
    cards?.forEach((card) => removeWaitlistCard(card));
  };

  const getWaitlistRowParticipants = (row) => {
    if (!row) return [];
    const slots = [...row.querySelectorAll('.waitlist-slot')];
    return slots
      .map((slot) => {
        const cardId = slot.dataset.occupantId;
        if (!cardId) return null;
        const card = document.getElementById(cardId);
        if (!card) return null;
        const participantId = card.dataset.participantId;
        if (!participantId) return null;
        return { participantId, cardId };
      })
      .filter(Boolean);
  };

  const handleWaitlistRowDragStart = (event, row) => {
    if (!row) return;
    closeWaitlistCourtMenu(row);
    const participants = getWaitlistRowParticipants(row);
    row.classList.add('waitlist-row-dragging');
    setDragPayload(event, {
      source: 'waitlistRow',
      rowId: row.dataset.rowId,
      participants,
    });
    event.stopPropagation();
  };

  const handleWaitlistRowDragEnd = (row) => {
    row?.classList.remove('waitlist-row-dragging');
    if (currentWaitlistDropTarget) {
      currentWaitlistDropTarget.classList.remove('waitlist-row-drop-target');
      currentWaitlistDropTarget = null;
    }
  };

  const recordCourtMatchHistory = (participantIds) => {
    if (!Array.isArray(participantIds)) return;
    const uniqueIds = [...new Set(participantIds.filter(Boolean))];
    if (uniqueIds.length < 2) return;
    uniqueIds.forEach((participantId) => {
      const session = getParticipantTodaySession(participantId);
      if (!session) return;
      session.matches = session.matches || {};
      uniqueIds.forEach((opponentId) => {
        if (opponentId === participantId) return;
        const previous = session.matches[opponentId] || 0;
        session.matches[opponentId] = normalizeCountValue(previous + 1);
      });
    });
    if (activeDetailParticipantId && uniqueIds.includes(activeDetailParticipantId)) {
      renderParticipantMatchHistory(activeDetailParticipantId);
    }
  };

  const handleCourtGameComplete = (court) => {
    if (!court) return;
    const slots = [...court.querySelectorAll('.slot')];
    const participants = slots
      .map((slot) => {
        const occupantId = slot.dataset.occupantId;
        if (!occupantId) return null;
        const card = document.getElementById(occupantId);
        if (!card) return null;
        const participantId = card.dataset.participantId;
        if (!participantId) return null;
        return { participantId, card };
      })
      .filter(Boolean);
    if (!participants.length) {
      window.alert('이 코트에 배치된 멤버가 없습니다.');
      return;
    }
    recordCourtMatchHistory(participants.map(({ participantId }) => participantId));
    participants.forEach(({ participantId, card }) => {
      incrementParticipantGameCount(participantId);
      removeBoardCard(card);
    });
    renderParticipants();
    schedulePersist();
  };

  const handleWaitlistRowDropOnCourt = (payload, court, preferredSlot = null) => {
    if (!payload || !Array.isArray(payload.participants) || !court) return;
    const row = document.querySelector(`.waitlist-row[data-row-id="${payload.rowId}"]`);
    if (!row) return;
    const participants = payload.participants
      .map((entry) => {
        const participant = getParticipantById(entry.participantId);
        if (!participant) return null;
        return { participant, cardId: entry.cardId };
      })
      .filter(Boolean);
    if (!participants.length) return;

    const slots = [...court.querySelectorAll('.slot')];
    let orderedSlots = slots;
    if (preferredSlot) {
      orderedSlots = [preferredSlot, ...slots.filter((slot) => slot !== preferredSlot)];
    }
    let slotIndex = 0;

    for (const { participant, cardId } of participants) {
      let targetSlot = null;
      while (slotIndex < orderedSlots.length && !targetSlot) {
        targetSlot = orderedSlots[slotIndex];
        slotIndex += 1;
      }
      if (!targetSlot) break;
      const existingBoardCard = boardEl.querySelector(`.slot .card[data-participant-id="${participant.id}"]`);
      if (existingBoardCard) {
        removeBoardCard(existingBoardCard);
      }
      const boardCard = createBoardCard(participant);
      placeCardInSlot(boardCard, targetSlot);
      if (cardId) {
        removeWaitlistCardById(cardId);
      } else {
        removeWaitlistEntries(participant.id);
      }
    }
    handleWaitlistRowDragEnd(row);
    closeWaitlistCourtMenu(row);
    schedulePersist();
  };

  const createListCard = (member) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = !isReadOnlyMode;
    card.id = `participant-${member.id}`;
    card.dataset.participantId = member.id;
    const color = member.color || 'blue';
    card.dataset.color = color;
    const grade = normalizeParticipantGrade(member.grade);
    card.dataset.grade = grade;
    attachNameResetHold(card, member.id);

    const meta = document.createElement('div');
    meta.className = 'meta';

    const infoRow = document.createElement('div');
    infoRow.className = 'card-info';

    const nameBlock = document.createElement('div');
    nameBlock.className = 'name-block';

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = member.name;

    const statsEl = document.createElement('div');
    statsEl.className = 'today-count';
    statsEl.dataset.participantStats = member.id;
    statsEl.textContent = formatTodayCount(getParticipantTodayCount(member.id));

    const nameRow = document.createElement('div');
    nameRow.className = 'name-row';
    const gradeBadge = createGradeBadgeElement(grade);
    nameRow.appendChild(gradeBadge);
    nameRow.appendChild(nameEl);

    nameBlock.appendChild(nameRow);
    nameBlock.appendChild(statsEl);

    const actions = document.createElement('div');
    actions.className = 'card-actions card-actions-inline';

    const shuttleBtn = createShuttleButton(member.id);
    const deleteBtn = createDeleteButton({
      label: `${member.name} 삭제`,
      onClick: () => removeParticipant(member.id),
    });

    actions.appendChild(shuttleBtn);
    actions.appendChild(deleteBtn);

    infoRow.appendChild(nameBlock);
    infoRow.appendChild(actions);

    meta.appendChild(infoRow);

    card.appendChild(meta);
    applySubmissionState(card, member.status || 'pending');

    if (!isReadOnlyMode) {
      card.addEventListener('dragstart', (event) => handleListDragStart(event, card));
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    }
    card.addEventListener('click', () => openParticipantDetail(member.id));

    return card;
  };

  const createBoardCard = (member) => {
    const card = document.createElement('div');
    card.className = 'card on-board';
    card.draggable = !isReadOnlyMode;
    card.id = `board-${member.id}-${boardCardSeq++}`;
    card.dataset.participantId = member.id;
    card.dataset.previousSlotId = '';
    const color = member.color || 'blue';
    card.dataset.color = color;
    const grade = normalizeParticipantGrade(member.grade);
    card.dataset.grade = grade;
    attachNameResetHold(card, member.id);

    const meta = document.createElement('div');
    meta.className = 'meta';

    const infoRow = document.createElement('div');
    infoRow.className = 'card-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = member.name;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const shuttleBtn = createShuttleButton(member.id);
    const deleteBtn = createDeleteButton({
      label: `${member.name} 삭제`,
      onClick: () => removeBoardCard(card),
    });

    actions.appendChild(shuttleBtn);
    actions.appendChild(deleteBtn);

    infoRow.appendChild(nameEl);
    infoRow.appendChild(actions);

    meta.appendChild(infoRow);

    card.appendChild(meta);
    applySubmissionState(card, member.status || 'pending');

    if (!isReadOnlyMode) {
      card.addEventListener('dragstart', (event) => handleBoardDragStart(event, card));
      card.addEventListener('dragend', () => handleBoardDragEnd(card));
    }
    card.addEventListener('click', () => openParticipantDetail(member.id));

    return card;
  };

  const setDragPayload = (event, payload) => {
    const data = JSON.stringify(payload);
    event.dataTransfer.setData('application/json', data);
    event.dataTransfer.setData('text/plain', data);
  };

  const parseDragPayload = (event) => {
    const json = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const handleListDragStart = (event, card) => {
    const participantId = card.dataset.participantId;
    setDragPayload(event, { source: 'list', participantId });
    requestAnimationFrame(() => card.classList.add('dragging'));
  };

  const handleBoardDragStart = (event, card) => {
    const participantId = card.dataset.participantId;
    setDragPayload(event, { source: 'board', participantId, cardId: card.id });
    const slot = card.closest('.slot');
    if (slot) {
      slot.dataset.occupantId = '';
      slot.classList.remove('filled');
      card.dataset.previousSlotId = slot.dataset.slotId || '';
    }
    requestAnimationFrame(() => card.classList.add('dragging'));
  };

  const handleBoardDragEnd = (card) => {
    card.classList.remove('dragging');
    const slot = card.closest('.slot');
    if (slot) {
      card.dataset.previousSlotId = slot.dataset.slotId || '';
      return;
    }
    const prevSlotId = card.dataset.previousSlotId;
    if (prevSlotId) {
      const prevSlot = document.querySelector(`.slot[data-slot-id="${prevSlotId}"]`);
      if (prevSlot) {
        placeCardInSlot(card, prevSlot);
        return;
      }
    }
    removeBoardCard(card);
  };

  const enableListDrop = () => {
    participantsListEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      participantsListEl.classList.add('highlight-list');
    });

    participantsListEl.addEventListener('dragleave', (event) => {
      const nextTarget = event.relatedTarget;
      if (!nextTarget || !participantsListEl.contains(nextTarget)) {
        participantsListEl.classList.remove('highlight-list');
      }
    });

    participantsListEl.addEventListener('drop', (event) => {
      event.preventDefault();
      participantsListEl.classList.remove('highlight-list');
      const payload = parseDragPayload(event);
      if (!payload) return;
      if (payload.source === 'board' && payload.cardId) {
        removeBoardCardById(payload.cardId);
      } else if (payload.source === 'waitlist' && payload.cardId) {
        removeWaitlistCardById(payload.cardId);
      }
    });
  };

  const handleAddParticipant = () => {
    if (isReadOnlyMode) return;
    if (!participantNameInput) return;
    const name = participantNameInput.value.trim();
    if (!name) {
      window.alert('참가자 이름을 입력하세요.');
      return;
    }
    const color = getSelectedColor();
    const grade = getSelectedGrade();
    const newParticipant = {
      id: `p${Date.now()}`,
      name,
      color,
      status: 'pending',
      grade,
    };
    participants.push(newParticipant);
    setParticipantJoinedAt(newParticipant.id, new Date());
    renderParticipants();
    participantNameInput.value = '';
    participantNameInput.focus();
    if (participantGradeSelect) {
      participantGradeSelect.value = DEFAULT_PARTICIPANT_GRADE;
    }
    schedulePersist();
  };

  const getSelectedColor = () => {
    const selected = document.querySelector('input[name="participantColor"]:checked');
    return selected?.value || 'blue';
  };

  const getSelectedGrade = () => {
    if (!participantGradeSelect) return DEFAULT_PARTICIPANT_GRADE;
    return normalizeParticipantGrade(participantGradeSelect.value);
  };

  const removeParticipant = (participantId) => {
    const index = participants.findIndex((member) => member.id === participantId);
    if (index >= 0) {
      participants.splice(index, 1);
    }
    const card = document.getElementById(`participant-${participantId}`);
    if (card) {
      unobserveListCardActionLayout(card);
      card.remove();
    }
    removeBoardCardsByParticipant(participantId);
    removeWaitlistEntries(participantId);
    renderParticipants();
    schedulePersist();
  };

  const removeBoardCardsByParticipant = (participantId) => {
    const cards = boardEl.querySelectorAll(`.slot .card[data-participant-id="${participantId}"]`);
    cards.forEach((card) => removeBoardCard(card));
  };

  const handleAddCourt = () => {
    if (isReadOnlyMode) {
      window.alert('뷰어 모드에서는 코트를 추가할 수 없습니다.');
      return;
    }
    const number = requestCourtNumber({
      message: '추가할 코트 번호를 입력하세요.',
      defaultValue: '',
      currentNumber: null,
    });
    if (number === null) return;
    createCourt(number);
  };

  const requestCourtNumber = ({ message, defaultValue = '', currentNumber = null }) => {
    const value = window.prompt(message, defaultValue);
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      window.alert('1 이상의 숫자를 입력해주세요.');
      return null;
    }
    if (usedCourtNumbers.has(parsed) && parsed !== currentNumber) {
      window.alert('이미 존재하는 코트 번호입니다.');
      return null;
    }
    return parsed;
  };

  const createCourt = (courtNumber) => {
    usedCourtNumbers.add(courtNumber);
    courtCount += 1;
    const court = document.createElement('div');
    court.className = 'court';
    court.dataset.courtId = `court-${courtCount}`;
    court.dataset.number = String(courtNumber);

    const label = document.createElement('div');
    label.className = 'court-label';
    label.textContent = `코트 ${courtNumber}`;
    label.setAttribute('role', 'button');
    label.setAttribute('tabindex', '0');
    label.setAttribute('aria-label', `코트 ${courtNumber} 이름 수정`);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'court-remove';
    removeBtn.setAttribute('aria-label', `코트 ${courtNumber} 삭제`);
    removeBtn.innerHTML = '&times;';

    if (isReadOnlyMode) {
      label.setAttribute('aria-disabled', 'true');
      label.setAttribute('tabindex', '-1');
      label.classList.add('is-disabled');
    } else {
      label.addEventListener('click', () => handleEditCourtNumber(court));
      label.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleEditCourtNumber(court);
        }
      });
    }

    const completeBtn = document.createElement('button');
    completeBtn.type = 'button';
    completeBtn.className = 'court-complete';
    completeBtn.textContent = '게임 완료';
    completeBtn.addEventListener('click', () => handleCourtGameComplete(court));

    court.appendChild(label);
    court.appendChild(completeBtn);
    court.appendChild(removeBtn);

    const slotsWrapper = document.createElement('div');
    slotsWrapper.className = 'court-slots';

    for (let col = 0; col < 2; col += 1) {
      const column = document.createElement('div');
      column.className = 'slot-column';
      for (let row = 0; row < 2; row += 1) {
        const slotIndex = col * 2 + row + 1;
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.slotId = `${court.dataset.courtId}-slot-${slotIndex}`;
        slot.dataset.slotType = 'court';
        column.appendChild(slot);
        bindSlot(slot);
      }
      slotsWrapper.appendChild(column);
    }

    court.appendChild(slotsWrapper);
    boardEl.appendChild(court);

    removeBtn.addEventListener('click', () => removeCourt(court));
    court.addEventListener('dragover', (event) => {
      const payload = parseDragPayload(event);
      if (payload?.source === 'waitlistRow') {
        event.preventDefault();
        court.classList.add('highlight');
      }
    });
    court.addEventListener('dragleave', (event) => {
      const nextTarget = event.relatedTarget;
      if (!nextTarget || !court.contains(nextTarget)) {
        court.classList.remove('highlight');
      }
    });
    court.addEventListener('drop', (event) => {
      const payload = parseDragPayload(event);
      if (!payload) return;
      court.classList.remove('highlight');
      if (payload.source === 'waitlistRow') {
        event.preventDefault();
        handleWaitlistRowDropOnCourt(payload, court);
        event.stopPropagation();
      }
    });
    schedulePersist();
  };

  const handleEditCourtNumber = (court) => {
    if (isReadOnlyMode) return;
    const current = Number(court.dataset.number);
    if (!Number.isInteger(current)) return;

    const nextNumber = requestCourtNumber({
      message: '새 코트 번호를 입력하세요.',
      defaultValue: String(current),
      currentNumber: current,
    });

    if (nextNumber === null || nextNumber === current) return;

    usedCourtNumbers.delete(current);
    usedCourtNumbers.add(nextNumber);
    court.dataset.number = String(nextNumber);

    const label = court.querySelector('.court-label');
    if (label) {
      label.textContent = `코트 ${nextNumber}`;
      label.setAttribute('aria-label', `코트 ${nextNumber} 이름 수정`);
    }
    const removeBtn = court.querySelector('.court-remove');
    if (removeBtn) {
      removeBtn.setAttribute('aria-label', `코트 ${nextNumber} 삭제`);
    }
    schedulePersist();
  };

  const bindSlot = (slot) => {
    if (isReadOnlyMode) return;
    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      slot.classList.add('slot-active');
    });

    slot.addEventListener('dragleave', (event) => {
      const nextTarget = event.relatedTarget;
      if (!nextTarget || !slot.contains(nextTarget)) {
        slot.classList.remove('slot-active');
      }
    });

    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('slot-active');

      const payload = parseDragPayload(event);
      if (!payload) return;
      if (payload.source === 'list') {
        const member = getParticipantById(payload.participantId);
        if (!member) return;
        const existing = boardEl.querySelector(`.slot .card[data-participant-id="${member.id}"]`);
        if (existing) {
          removeBoardCard(existing);
        }
        const boardCard = createBoardCard(member);
        placeCardInSlot(boardCard, slot);
      } else if (payload.source === 'board' && payload.cardId) {
        const card = document.getElementById(payload.cardId);
        if (!card) return;
        placeCardInSlot(card, slot);
      } else if (payload.source === 'waitlistRow') {
        const court = slot.closest('.court');
        if (!court) return;
        handleWaitlistRowDropOnCourt(payload, court, slot);
        event.stopPropagation();
      } else if (payload.source === 'waitlist' && payload.cardId) {
        const waitCard = document.getElementById(payload.cardId);
        if (!waitCard) return;
        const participantId = waitCard.dataset.participantId;
        if (!participantId) return;
        removeWaitlistCard(waitCard);
        const member = getParticipantById(participantId);
        if (!member) return;
        const existing = boardEl.querySelector(`.slot .card[data-participant-id="${member.id}"]`);
        if (existing) {
          removeBoardCard(existing);
        }
        const boardCard = createBoardCard(member);
        placeCardInSlot(boardCard, slot);
      }
    });

    slot.addEventListener('click', (event) => handleSlotClick(event, slot));
  };

  const handleSlotClick = (event, slot) => {
    if (isReadOnlyMode) return;
    if (!slot || slot.dataset.occupantId) return;
    if (event.defaultPrevented) return;
    openSlotParticipantPicker(slot);
  };

  const placeCardInSlot = (card, slot) => {
    const existingId = slot.dataset.occupantId;
    if (existingId && existingId !== card.id) {
      const existingCard = document.getElementById(existingId);
      if (existingCard) {
        removeBoardCard(existingCard);
      }
    }
    freeSlot(card);
    slot.dataset.occupantId = card.id;
    slot.classList.add('filled');
    card.classList.add('on-board');
    card.style.left = '';
    card.style.top = '';
    card.dataset.previousSlotId = slot.dataset.slotId || '';
    slot.appendChild(card);
    if (slotPickerActiveSlot === slot) {
      closeSlotParticipantPicker();
    }
    const participantId = card.dataset.participantId;
    if (participantId) {
      updateParticipantLessonHighlight(participantId);
    }
    schedulePersist();
  };

  const freeSlot = (card) => {
    const slot = card.closest('.slot');
    if (!slot) return;
    slot.dataset.occupantId = '';
    slot.classList.remove('filled');
  };

  const removeBoardCard = (card) => {
    freeSlot(card);
    card.dataset.previousSlotId = '';
    card.remove();
    schedulePersist();
  };

  const removeBoardCardById = (cardId) => {
    const card = document.getElementById(cardId);
    if (card) {
      removeBoardCard(card);
    }
  };

  const resetBoardPositions = () => {
    const placedCards = boardEl.querySelectorAll('.card.on-board');
    placedCards.forEach((card) => removeBoardCard(card));
    schedulePersist();
  };

  const removeCourt = (court) => {
    const number = Number(court.dataset.number);
    if (number) {
      usedCourtNumbers.delete(number);
    }
    if (slotPickerActiveSlot && court.contains(slotPickerActiveSlot)) {
      closeSlotParticipantPicker();
    }
    const cards = court.querySelectorAll('.card.on-board');
    cards.forEach((card) => removeBoardCard(card));
    court.remove();
    schedulePersist();
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  badmintonBoard.init()?.catch((error) => {
    console.error('보드 초기화에 실패했습니다.', error);
  });
});
