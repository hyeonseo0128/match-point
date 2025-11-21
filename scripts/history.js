(() => {
  const STATE_API_ENDPOINT = '/api/state';
  const CAPABILITIES_ENDPOINT = '/api/capabilities';
  const REFRESH_INTERVAL = 15000;
  const tableBody = document.getElementById('historyTableBody');
  const summaryTeamAWinsEl = document.getElementById('summaryTeamAWins');
  const summaryTeamBWinsEl = document.getElementById('summaryTeamBWins');

  let refreshTimer = null;
  let isSaving = false;
  let draggedCard = null;
  let dragOriginZone = null;
  let isReadOnlyMode = false;

  const formatTimeLabel = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const dateLabel = date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    const timeLabel = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dateLabel} ${timeLabel}`;
  };

  const normalizeGameRecords = (records) => {
    if (!Array.isArray(records)) return [];
    return records
      .filter((record) => record && typeof record === 'object')
      .sort((a, b) => {
        const timeA = new Date(a.completedAt || 0).getTime();
        const timeB = new Date(b.completedAt || 0).getTime();
        return timeB - timeA;
      });
  };

  const createTeamCard = (recordId, teamKey, member = {}) => {
    const card = document.createElement('div');
    card.className = 'history-team-card';
    card.draggable = !isReadOnlyMode;
    card.dataset.recordId = recordId;
    card.dataset.team = teamKey;
    card.dataset.participantId = member.id || '';
    card.dataset.name = member.name || '이름 미상';
    card.dataset.color = member.color || 'blue';
    card.dataset.grade = member.grade || '';
    if (!isReadOnlyMode) {
      card.addEventListener('dragstart', handleCardDragStart);
      card.addEventListener('dragend', handleCardDragEnd);
    }

    const name = document.createElement('div');
    name.className = 'history-team-card-name';
    name.textContent = card.dataset.name;

    const grade = document.createElement('div');
    grade.className = 'history-team-card-grade';
    grade.textContent = card.dataset.grade;

    card.appendChild(name);
    card.appendChild(grade);
    return card;
  };

  const updateDropzoneState = (zone) => {
    if (!zone) return;
    const hasCard = Boolean(zone.querySelector('.history-team-card'));
    zone.classList.toggle('is-empty', !hasCard);
  };

  const handleCardDragStart = (event) => {
    draggedCard = event.currentTarget;
    dragOriginZone = draggedCard.parentElement;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedCard.dataset.participantId || '');
    window.setTimeout(() => draggedCard.classList.add('is-dragging'), 0);
  };

  const handleCardDragEnd = () => {
    if (draggedCard) {
      draggedCard.classList.remove('is-dragging');
    }
    draggedCard = null;
    if (dragOriginZone) {
      updateDropzoneState(dragOriginZone);
    }
    dragOriginZone = null;
  };

  const handleZoneDragOver = (event) => {
    if (!draggedCard) return;
    const zone = event.currentTarget;
    if (zone.dataset.recordId !== draggedCard.dataset.recordId) return;
    event.preventDefault();
    zone.classList.add('is-hovered');
  };

  const handleZoneDragLeave = (event) => {
    const zone = event.currentTarget;
    const related = event.relatedTarget;
    if (related && zone.contains(related)) return;
    zone.classList.remove('is-hovered');
  };

  const handleZoneDrop = (event) => {
    if (!draggedCard) return;
    const zone = event.currentTarget;
    zone.classList.remove('is-hovered');
    if (zone.dataset.recordId !== draggedCard.dataset.recordId) return;
    event.preventDefault();
    const originalZone = draggedCard.parentElement;
    zone.appendChild(draggedCard);
    draggedCard.dataset.team = zone.dataset.team;
    updateDropzoneState(zone);
    if (originalZone && originalZone !== zone) {
      updateDropzoneState(originalZone);
    }
  };

  const buildTeamDropzone = (record, teamKey) => {
    const zone = document.createElement('div');
    zone.className = 'history-team-dropzone';
    zone.dataset.recordId = record.id;
    zone.dataset.team = teamKey;
    if (isReadOnlyMode) {
      zone.classList.add('is-readonly');
    } else {
      zone.addEventListener('dragover', handleZoneDragOver);
      zone.addEventListener('dragleave', handleZoneDragLeave);
      zone.addEventListener('drop', handleZoneDrop);
    }
    (record?.teams?.[teamKey] || []).forEach((member) => {
      zone.appendChild(createTeamCard(record.id, teamKey, member));
    });
    updateDropzoneState(zone);
    return zone;
  };

  const createScoreInput = (teamKey, value) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.placeholder = '0';
    input.className = 'history-score-input';
    input.dataset.team = teamKey;
    if (value !== null && value !== undefined) {
      input.value = value;
    }
    return input;
  };

  const createScoreCell = (record) => {
    const cell = document.createElement('td');
    const wrapper = document.createElement('div');
    wrapper.className = 'history-score-inputs';
    const scoreA = createScoreInput('A', record?.score?.A ?? null);
    const separator = document.createElement('span');
    separator.className = 'history-score-separator';
    separator.textContent = ':';
    const scoreB = createScoreInput('B', record?.score?.B ?? null);
    if (isReadOnlyMode) {
      scoreA.disabled = true;
      scoreB.disabled = true;
      scoreA.classList.add('is-disabled');
      scoreB.classList.add('is-disabled');
    }
    wrapper.appendChild(scoreA);
    wrapper.appendChild(separator);
    wrapper.appendChild(scoreB);
    cell.appendChild(wrapper);
    return cell;
  };

  const createNotesCell = (record) => {
    const cell = document.createElement('td');
    const textarea = document.createElement('textarea');
    textarea.className = 'history-notes-input';
    textarea.placeholder = '경기 메모를 남겨 주세요';
    textarea.value = record?.notes || '';
    if (isReadOnlyMode) {
      textarea.disabled = true;
      textarea.classList.add('is-disabled');
    }
    cell.appendChild(textarea);
    return cell;
  };

  const createActionCell = () => {
    const cell = document.createElement('td');
    const wrapper = document.createElement('div');
    wrapper.className = 'history-table-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn secondary';
    saveBtn.dataset.action = 'save-record';
    saveBtn.textContent = '저장';
    if (isReadOnlyMode) {
      saveBtn.disabled = true;
      saveBtn.setAttribute('aria-disabled', 'true');
    }
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn ghost';
    deleteBtn.dataset.action = 'delete-record';
    deleteBtn.textContent = '삭제';
    if (isReadOnlyMode) {
      deleteBtn.disabled = true;
      deleteBtn.setAttribute('aria-disabled', 'true');
    }
    wrapper.appendChild(saveBtn);
    wrapper.appendChild(deleteBtn);
    cell.appendChild(wrapper);
    return cell;
  };

  const renderTable = (records) => {
    if (!tableBody) return;
    updateWinSummary(records);
    tableBody.innerHTML = '';
    if (!records.length) {
      const row = document.createElement('tr');
      row.dataset.emptyRow = 'true';
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.className = 'history-table-empty';
      cell.textContent = '아직 기록이 없습니다. 경기가 끝나면 결과를 남겨 주세요.';
      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }
    records.forEach((record) => {
      const row = document.createElement('tr');
      row.dataset.recordId = record.id;
      const timeCell = document.createElement('td');
      timeCell.textContent = formatTimeLabel(record.completedAt);
      const courtCell = document.createElement('td');
      courtCell.textContent = record.courtNumber ? `${record.courtNumber}번 코트` : '-';
      const teamACell = document.createElement('td');
      teamACell.appendChild(buildTeamDropzone(record, 'A'));
      const teamBCell = document.createElement('td');
      teamBCell.appendChild(buildTeamDropzone(record, 'B'));
      const scoreCell = createScoreCell(record);
      const notesCell = createNotesCell(record);
      const actionCell = createActionCell();
      row.appendChild(timeCell);
      row.appendChild(courtCell);
      row.appendChild(teamACell);
      row.appendChild(teamBCell);
      row.appendChild(scoreCell);
      row.appendChild(notesCell);
      row.appendChild(actionCell);
      tableBody.appendChild(row);
    });
  };

  const fetchState = async () => {
    try {
      const response = await fetch(STATE_API_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error('STATE_FETCH_FAILED');
      const payload = await response.json();
      return payload?.state || null;
    } catch (error) {
      console.error('게임 기록을 불러오지 못했습니다.', error);
      return null;
    }
  };

  const persistState = async (nextState) => {
    const response = await fetch(STATE_API_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: nextState }),
    });
    if (!response.ok) {
      throw new Error(`STATE_SAVE_FAILED_${response.status}`);
    }
  };

  const loadCapabilities = async () => {
    if (typeof window === 'undefined') return { readOnly: false };
    try {
      const response = await fetch(CAPABILITIES_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error('CAP_FETCH_FAILED');
      return response.json();
    } catch (error) {
      console.error('권한 정보를 불러오지 못했습니다.', error);
      return { readOnly: false };
    }
  };

  const applyReadOnlyState = () => {
    if (!isReadOnlyMode) return;
    document.body?.classList.add('history-read-only');
  };

  const calculateWinTotals = (records) => {
    return records.reduce(
      (totals, record) => {
        const scoreA = Number(record?.score?.A);
        const scoreB = Number(record?.score?.B);
        if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) {
          if (scoreA > scoreB) {
            totals.A += 1;
          } else if (scoreB > scoreA) {
            totals.B += 1;
          }
        }
        return totals;
      },
      { A: 0, B: 0 },
    );
  };

  const updateWinSummary = (records) => {
    const totals = calculateWinTotals(records);
    if (summaryTeamAWinsEl) {
      summaryTeamAWinsEl.textContent = String(totals.A);
      const container = summaryTeamAWinsEl.closest('.history-team-score');
      container?.classList.toggle('is-leading', totals.A > totals.B);
      container?.classList.toggle('is-trailing', totals.A < totals.B);
    }
    if (summaryTeamBWinsEl) {
      summaryTeamBWinsEl.textContent = String(totals.B);
      const container = summaryTeamBWinsEl.closest('.history-team-score');
      container?.classList.toggle('is-leading', totals.B > totals.A);
      container?.classList.toggle('is-trailing', totals.B < totals.A);
    }
  };

  const refresh = async () => {
    const state = await fetchState();
    const records = normalizeGameRecords(state?.gameRecords);
    renderTable(records);
  };

  const parseScoreValue = (value) => {
    if (!value && value !== 0 && value !== '0') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  };

  const collectTeamMembers = (row, teamKey) => {
    const zone = row.querySelector(`.history-team-dropzone[data-team="${teamKey}"]`);
    if (!zone) return [];
    return [...zone.querySelectorAll('.history-team-card')].map((card, index) => ({
      id: card.dataset.participantId || `manual-${teamKey}-${index}`,
      name: card.dataset.name || '이름 미상',
      color: card.dataset.color || 'blue',
      grade: card.dataset.grade || '',
    }));
  };

  const handleTableClick = async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !tableBody) return;
    const row = button.closest('tr[data-record-id]');
    if (!row || isSaving) return;
    const inputs = row.querySelectorAll('.history-score-input');
    const scoreAInput = [...inputs].find((input) => input.dataset.team === 'A');
    const scoreBInput = [...inputs].find((input) => input.dataset.team === 'B');
    const notesInput = row.querySelector('.history-notes-input');
    const updates = {
      scoreA: parseScoreValue(scoreAInput?.value ?? null),
      scoreB: parseScoreValue(scoreBInput?.value ?? null),
      notes: (notesInput?.value || '').trim(),
    };
    const actionType = button.dataset.action;
    if (isReadOnlyMode) {
      window.alert('뷰어 모드에서는 기록을 수정할 수 없습니다.');
      return;
    }
    if (actionType === 'delete-record') {
      const recordId = row.dataset.recordId;
      const confirmed = window.confirm('이 경기 기록을 삭제하시겠습니까?');
      if (!confirmed) return;
      button.disabled = true;
      button.textContent = '삭제 중...';
      isSaving = true;
      try {
        const latestState = await fetchState();
        if (!latestState) throw new Error('STATE_MISSING');
        const records = Array.isArray(latestState.gameRecords) ? latestState.gameRecords : [];
        const nextRecords = records.filter((record) => record.id !== recordId);
        latestState.gameRecords = nextRecords;
        await persistState(latestState);
        button.textContent = '삭제됨';
        setTimeout(() => {
          button.textContent = '삭제';
        }, 1200);
        const normalized = normalizeGameRecords(nextRecords);
        renderTable(normalized);
      } catch (error) {
        console.error('게임 기록을 삭제하지 못했습니다.', error);
        button.textContent = '뷰어는 삭제할 수 없습니다.';
      } finally {
        button.disabled = false;
        isSaving = false;
      }
      return;
    }
    if (actionType !== 'save-record') return;
    const recordId = row.dataset.recordId;

    button.disabled = true;
    button.textContent = '저장 중...';
    isSaving = true;
    try {
      const latestState = await fetchState();
      if (!latestState) {
        throw new Error('STATE_MISSING');
      }
      const records = Array.isArray(latestState.gameRecords) ? latestState.gameRecords : [];
      const target = records.find((record) => record.id === recordId);
      if (!target) {
        throw new Error('RECORD_NOT_FOUND');
      }
      target.teams = {
        A: collectTeamMembers(row, 'A'),
        B: collectTeamMembers(row, 'B'),
      };
      target.score = {
        A: updates.scoreA,
        B: updates.scoreB,
      };
      target.notes = updates.notes;
      await persistState(latestState);
      button.textContent = '저장됨';
      setTimeout(() => {
        button.textContent = '저장';
      }, 1200);
      const normalized = normalizeGameRecords(latestState.gameRecords);
      renderTable(normalized);
    } catch (error) {
      console.error('게임 기록을 업데이트하지 못했습니다.', error);
      button.textContent = '실패, 재시도';
    } finally {
      button.disabled = false;
      isSaving = false;
    }
  };

  const init = async () => {
    if (!tableBody) return;
    const capabilities = await loadCapabilities();
    isReadOnlyMode = Boolean(capabilities?.readOnly);
    applyReadOnlyState();
    refresh();
    tableBody.addEventListener('click', handleTableClick);
    refreshTimer = window.setInterval(() => {
      if (!isSaving) {
        refresh();
      }
    }, REFRESH_INTERVAL);
    window.addEventListener('beforeunload', () => {
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
