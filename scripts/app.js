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
  participants.forEach((member) => {
    member.status = member.status || 'pending';
    member.sessions = member.sessions || {};
  });
  const normalizeParticipants = () => {
    participants.forEach((member) => {
      member.status = member.status || 'pending';
      member.sessions = member.sessions || {};
    });
  };
  normalizeParticipants();
  const NAME_RESET_HOLD_DURATION = 2000;
  const SHUTTLE_IMAGE = './assets/image/shuttlecock.png';
  const STORAGE_KEY = 'badmintonBoardState';
  const history = {};
  let isRestoringState = false;
  let saveTimer = null;
  let boardEl;
  let participantsListEl;
  let addCourtBtn;
  let resetBtn;
  let participantNameInput;
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
  let activeDetailParticipantId = null;
  const usedCourtNumbers = new Set();
  let courtCount = 0;
  let boardCardSeq = 0;
  let waitlistRowSeq = 0;
  let waitlistCardSeq = 0;
  let currentWaitlistDropTarget = null;
  const LIST_CARD_ACTION_STACK_WIDTH = 320;
  let listCardResizeObserver = null;

  const getParticipantById = (id) => participants.find((member) => member.id === id);

  const init = () => {
    boardEl = document.getElementById('gameBoard');
    participantsListEl = document.getElementById('participantsList');
    addCourtBtn = document.getElementById('addCourtBtn');
    resetBtn = document.getElementById('resetBoardBtn');
    participantNameInput = document.getElementById('participantNameInput');
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

    if (!boardEl || !participantsListEl) return;

    const savedState = loadState();
    if (savedState?.participants?.length) {
      participants.length = 0;
      savedState.participants.forEach((member) => {
        participants.push({ ...member });
      });
    }
    normalizeParticipants();
    if (savedState?.history) {
      Object.keys(history).forEach((key) => {
        delete history[key];
      });
      Object.entries(savedState.history).forEach(([key, value]) => {
        history[key] = value;
      });
    }
    renderParticipants();
    enableListDrop();
    if (savedState) {
      applySavedState(savedState);
    } else {
      ensureWaitlistRow();
      createCourt(3);
      createCourt(4);
      schedulePersist();
    }

    addCourtBtn?.addEventListener('click', handleAddCourt);
    resetBtn?.addEventListener('click', resetBoardPositions);
    addParticipantBtn?.addEventListener('click', handleAddParticipant);
    addWaitlistRowBtn?.addEventListener('click', handleAddWaitlistRow);
    downloadHistoryBtn?.addEventListener('click', handleDownloadHistory);
    hardResetBtn?.addEventListener('click', handleHardReset);
    participantNameInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddParticipant();
      }
    });
    bindWaitlistReorderEvents();
    bindParticipantDetailModal();
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
    participantDetailSaveBtn?.addEventListener('click', handleParticipantDetailSave);
    participantDetailCountIncreaseBtn?.addEventListener('click', () => adjustParticipantDetailCount(1));
    participantDetailCountDecreaseBtn?.addEventListener('click', () => adjustParticipantDetailCount(-1));
    participantDetailCountInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleParticipantDetailSave();
      }
    });
    document.addEventListener('keydown', handleParticipantDetailKeydown);
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

  const openParticipantDetail = (participantId) => {
    if (!participantDetailModal) return;
    const participant = getParticipantById(participantId);
    if (!participant) return;
    activeDetailParticipantId = participantId;
    participantDetailModal.classList.add('is-open');
    participantDetailModal.setAttribute('aria-hidden', 'false');
    if (participantDetailNameEl) {
      participantDetailNameEl.textContent = participant.name;
    }
    const session = getParticipantTodaySession(participantId);
    setDetailCountInputValue(session?.count || 0);
    if (participantDetailArrivalEl) {
      const arrivalLabel = formatArrivalTime(session?.joinedAt || null);
      participantDetailArrivalEl.textContent = arrivalLabel;
    }
    participantDetailCountInput?.focus();
    participantDetailCountInput?.select();
  };

  const closeParticipantDetail = () => {
    if (!participantDetailModal) return;
    participantDetailModal.classList.remove('is-open');
    participantDetailModal.setAttribute('aria-hidden', 'true');
    activeDetailParticipantId = null;
  };

  const handleParticipantDetailSave = () => {
    if (!activeDetailParticipantId) {
      closeParticipantDetail();
      return;
    }
    const count = getDetailCountInputValue();
    setParticipantTodayCount(activeDetailParticipantId, count);
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

  const renderParticipants = () => {
    if (!participantsListEl) return;
    resetListCardActionObserver();
    participantsListEl.innerHTML = '';
    participants.forEach((member) => {
      const card = createListCard(member);
      participantsListEl.appendChild(card);
      observeListCardActionLayout(card);
    });
    updateAllParticipantStats();
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

  const normalizeCountValue = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.floor(numericValue));
  };

  const getParticipantSessionForDate = (participantId, dateKey = null) => {
    const participant = getParticipantById(participantId);
    if (!participant) return null;
    const targetDate = dateKey || getTodayKey();
    participant.sessions = participant.sessions || {};
    let entry = participant.sessions[targetDate];
    if (typeof entry === 'number') {
      entry = { count: normalizeCountValue(entry), joinedAt: null };
    } else if (!entry || typeof entry !== 'object') {
      entry = { count: 0, joinedAt: null };
    } else {
      entry.count = normalizeCountValue(entry.count);
      entry.joinedAt = entry.joinedAt || null;
    }
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

  const syncParticipantCards = (participantId) => {
    const status = getParticipantStatus(participantId);
    const cards = document.querySelectorAll(`.card[data-participant-id="${participantId}"]`);
    cards.forEach((card) => applySubmissionState(card, status));
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

    button.addEventListener('pointerdown', stopEvent);
    button.addEventListener('pointerup', stopEvent);
    button.addEventListener('dragstart', (event) => event.preventDefault());

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      markParticipantSubmitted(participantId);
    });

    return button;
  };

  const createDeleteButton = ({ label, onClick }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-delete';
    button.setAttribute('aria-label', label);
    button.innerHTML = '&times;';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
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

  const handleHardReset = () => {
    const confirmed = window.confirm('전체 초기화를 진행하시겠습니까? 모든 데이터가 삭제됩니다.');
    if (!confirmed) return;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
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
    if (isRestoringState) return;
    if (typeof window === 'undefined') return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistState, 200);
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

  const persistState = () => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const data = buildState();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('상태 저장에 실패했습니다.', error);
    }
  };

  const buildState = () => {
    const state = {
      participants: participants.map(({ id, name, color, status, sessions }) => ({
        id,
        name,
        color,
        status,
        sessions: sessions ? { ...sessions } : {},
      })),
      courts: [],
      waitlist: [],
      history: JSON.parse(JSON.stringify(history)),
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

  const loadState = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
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

  const applySavedState = (state) => {
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
      schedulePersist();
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
    title.addEventListener('dragstart', (event) => handleWaitlistRowDragStart(event, row));
    title.addEventListener('dragend', () => handleWaitlistRowDragEnd(row));
    title.addEventListener('dragenter', (event) => event.preventDefault());

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
    row.remove();
    refreshWaitlistRowLabels();
    ensureWaitlistRow();
    schedulePersist();
  };

  const createWaitlistCard = (member) => {
    const card = document.createElement('div');
    card.className = 'wait-card';
    card.draggable = true;
    card.id = `wait-card-${waitlistCardSeq++}`;
    card.dataset.participantId = member.id;
    card.dataset.previousSlotId = '';
    attachNameResetHold(card, member.id);

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = member.name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'wait-card-remove';
    removeBtn.setAttribute('aria-label', `${member.name} 대기 해제`);
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      removeWaitlistCard(card);
    });

    card.appendChild(nameEl);
    card.appendChild(removeBtn);

    card.addEventListener('dragstart', (event) => handleWaitlistDragStart(event, card));
    card.addEventListener('dragend', () => handleWaitlistDragEnd(card));

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
    participants.forEach(({ participantId, card }) => {
      incrementParticipantGameCount(participantId);
      removeBoardCard(card);
    });
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
    schedulePersist();
  };

  const createListCard = (member) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.id = `participant-${member.id}`;
    card.dataset.participantId = member.id;
    const color = member.color || 'blue';
    card.dataset.color = color;
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

    nameBlock.appendChild(nameEl);
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

    card.addEventListener('dragstart', (event) => handleListDragStart(event, card));
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
    card.addEventListener('click', () => openParticipantDetail(member.id));

    return card;
  };

  const createBoardCard = (member) => {
    const card = document.createElement('div');
    card.className = 'card on-board';
    card.draggable = true;
    card.id = `board-${member.id}-${boardCardSeq++}`;
    card.dataset.participantId = member.id;
    card.dataset.previousSlotId = '';
    const color = member.color || 'blue';
    card.dataset.color = color;
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

    card.addEventListener('dragstart', (event) => handleBoardDragStart(event, card));
    card.addEventListener('dragend', () => handleBoardDragEnd(card));
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
    if (!participantNameInput) return;
    const name = participantNameInput.value.trim();
    if (!name) {
      window.alert('참가자 이름을 입력하세요.');
      return;
    }
    const color = getSelectedColor();
    const newParticipant = {
      id: `p${Date.now()}`,
      name,
      color,
      status: 'pending',
    };
    participants.push(newParticipant);
    const card = createListCard(newParticipant);
    participantsListEl.appendChild(card);
    observeListCardActionLayout(card);
    setParticipantJoinedAt(newParticipant.id, new Date());
    participantNameInput.value = '';
    participantNameInput.focus();
    schedulePersist();
  };

  const getSelectedColor = () => {
    const selected = document.querySelector('input[name="participantColor"]:checked');
    return selected?.value || 'blue';
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
    schedulePersist();
  };

  const removeBoardCardsByParticipant = (participantId) => {
    const cards = boardEl.querySelectorAll(`.slot .card[data-participant-id="${participantId}"]`);
    cards.forEach((card) => removeBoardCard(card));
  };

  const handleAddCourt = () => {
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

    label.addEventListener('click', () => handleEditCourtNumber(court));
    label.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleEditCourtNumber(court);
      }
    });

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
    const cards = court.querySelectorAll('.card.on-board');
    cards.forEach((card) => removeBoardCard(card));
    court.remove();
    schedulePersist();
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', badmintonBoard.init);
