/**
 * TaskFlow - Application State & Logic
 */

// Centralized Application State
let state = {
  tasks: [],
  filter: 'all',         // 'all' | 'active' | 'completed'
  searchQuery: '',       // Search string
  sortBy: 'created-desc', // 'created-desc' | 'created-asc' | 'due-asc' | 'due-desc'
  theme: 'dark'          // 'dark' | 'light'
};

// UI Ephemeral State (Does not need to persist in LocalStorage)
let editingTaskId = null;
let taskIdToDelete = null;
let lastFocusedElementBeforeModal = null;

// LocalStorage Keys
const LOCAL_STORAGE_KEY = 'taskflow_app_state';

// DOM Elements Cache
const elements = {
  themeToggleBtn: document.getElementById('theme-toggle'),
  themeToggleText: document.querySelector('.theme-toggle-text'),
  
  // Stats
  statTotal: document.getElementById('stat-total'),
  statActive: document.getElementById('stat-active'),
  statCompleted: document.getElementById('stat-completed'),
  statOverdue: document.getElementById('stat-overdue'),
  progressBar: document.getElementById('progress-bar'),
  progressPercentage: document.getElementById('progress-percentage'),
  
  // Controls & Form
  taskSearch: document.getElementById('task-search'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  filterTabs: document.querySelectorAll('.filter-tab'),
  taskSort: document.getElementById('task-sort'),
  clearCompletedBtn: document.getElementById('clear-completed-btn'),
  taskForm: document.getElementById('task-form'),
  taskInput: document.getElementById('task-input'),
  charCounter: document.getElementById('char-counter'),
  taskDueDateInput: document.getElementById('task-due-date-input'),
  
  // List Area
  taskList: document.getElementById('task-list'),
  emptyState: document.getElementById('empty-state'),
  
  // Modal
  modalBackdrop: document.getElementById('modal-backdrop'),
  deleteModal: document.getElementById('delete-confirm-modal'),
  modalTaskPreview: document.getElementById('modal-task-preview'),
  confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
  confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
  
  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// -----------------------------------------
// Initialization & Startup
// -----------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromLocalStorage();
  setupTheme();
  setupEventListeners();
  render();
});

// -----------------------------------------
// LocalStorage Persistence
// -----------------------------------------
function saveStateToLocalStorage() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

function loadStateFromLocalStorage() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure basic structure safety
      state = {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        filter: ['all', 'active', 'completed'].includes(parsed.filter) ? parsed.filter : 'all',
        searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
        sortBy: ['created-desc', 'created-asc', 'due-asc', 'due-desc'].includes(parsed.sortBy) ? parsed.sortBy : 'created-desc',
        theme: ['dark', 'light'].includes(parsed.theme) ? parsed.theme : 'dark'
      };
    }
  } catch (error) {
    console.error('Failed to parse state from localStorage:', error);
    // Keep initial defaults on error
  }
}

// -----------------------------------------
// Theme Management
// -----------------------------------------
function setupTheme() {
  // Check system preferences if no saved theme
  if (!localStorage.getItem(LOCAL_STORAGE_KEY)) {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    state.theme = prefersLight ? 'light' : 'dark';
  }
  
  applyTheme(state.theme);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const isDark = theme === 'dark';
  
  elements.themeToggleBtn.setAttribute('aria-pressed', !isDark);
  elements.themeToggleText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  
  // Save state theme
  state.theme = theme;
  saveStateToLocalStorage();
}

function toggleTheme() {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  showToast(`Theme switched to ${nextTheme} mode!`, 'info');
}

// -----------------------------------------
// Event Listeners Registration
// -----------------------------------------
function setupEventListeners() {
  // Theme toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

  // Live Search
  elements.taskSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    
    if (state.searchQuery.trim().length > 0) {
      elements.clearSearchBtn.classList.remove('hidden');
    } else {
      elements.clearSearchBtn.classList.add('hidden');
    }
    
    // Renders list dynamically on typing
    renderListOnly();
  });
  
  // Clear Search
  elements.clearSearchBtn.addEventListener('click', () => {
    elements.taskSearch.value = '';
    state.searchQuery = '';
    elements.clearSearchBtn.classList.add('hidden');
    elements.taskSearch.focus();
    renderListOnly();
  });

  // Filter Tabs (Event Delegation on Navigation)
  const tabsContainer = document.querySelector('.filter-tabs');
  tabsContainer.addEventListener('click', (e) => {
    const tabButton = e.target.closest('.filter-tab');
    if (!tabButton) return;
    
    elements.filterTabs.forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });
    
    tabButton.classList.add('active');
    tabButton.setAttribute('aria-selected', 'true');
    
    state.filter = tabButton.dataset.filter;
    
    // Update live region label for screen readers
    elements.taskList.setAttribute('aria-labelledby', tabButton.id);
    
    saveStateToLocalStorage();
    renderListOnly();
  });

  // Sort Selection
  elements.taskSort.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    saveStateToLocalStorage();
    renderListOnly();
  });

  // Clear Completed
  elements.clearCompletedBtn.addEventListener('click', () => {
    const completedCount = state.tasks.filter(t => t.completed).length;
    if (completedCount === 0) return;
    
    state.tasks = state.tasks.filter(t => !t.completed);
    saveStateToLocalStorage();
    render();
    showToast(`Cleared ${completedCount} completed task(s).`, 'success');
  });

  // Task creation Form Submission
  elements.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddTask();
  });

  // Character counter for task input
  elements.taskInput.addEventListener('input', (e) => {
    const len = e.target.value.length;
    elements.charCounter.textContent = `${len} / 120`;
    if (len >= 120) {
      elements.charCounter.style.color = 'var(--color-danger)';
    } else {
      elements.charCounter.style.color = 'var(--text-muted)';
    }
  });

  // Due Date custom picker helper: sync styles on select
  elements.taskDueDateInput.addEventListener('change', (e) => {
    const input = e.target;
    const placeholder = input.nextElementSibling;
    if (input.value) {
      input.classList.add('has-value');
      if (placeholder) placeholder.style.display = 'none';
    } else {
      input.classList.remove('has-value');
      if (placeholder) placeholder.style.display = 'block';
    }
  });

  // --- Task List Interactions (EVENT DELEGATION) ---
  elements.taskList.addEventListener('click', handleTaskListClicks);
  elements.taskList.addEventListener('keydown', handleTaskListKeys);

  // --- Modal Confirmation listeners ---
  elements.confirmCancelBtn.addEventListener('click', closeModal);
  elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  elements.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === elements.modalBackdrop) closeModal();
  });
  elements.modalBackdrop.addEventListener('keydown', handleModalKeys);
}

// -----------------------------------------
// CRUD Actions
// -----------------------------------------

// CREATE Task
function handleAddTask() {
  const title = elements.taskInput.value.trim();
  const dueDate = elements.taskDueDateInput.value;
  
  if (!title) {
    showToast('Task title cannot be empty!', 'warning');
    elements.taskInput.focus();
    return;
  }
  
  const newTask = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    title: title,
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate: dueDate || ''
  };
  
  state.tasks.push(newTask);
  saveStateToLocalStorage();
  
  // Reset fields
  elements.taskInput.value = '';
  elements.taskDueDateInput.value = '';
  elements.taskDueDateInput.classList.remove('has-value');
  const datePlaceholder = elements.taskDueDateInput.nextElementSibling;
  if (datePlaceholder) datePlaceholder.style.display = 'block';
  elements.charCounter.textContent = '0 / 120';
  elements.charCounter.style.color = 'var(--text-muted)';
  
  render();
  showToast('Task created successfully!', 'success');
}

// UPDATE Task Checkbox Toggle
function toggleTask(id) {
  state.tasks = state.tasks.map(task => {
    if (task.id === id) {
      const updatedStatus = !task.completed;
      showToast(
        updatedStatus ? 'Task completed! Keep it up!' : 'Task set to active.',
        updatedStatus ? 'success' : 'info'
      );
      return { ...task, completed: updatedStatus };
    }
    return task;
  });
  
  saveStateToLocalStorage();
  render();
}

// UPDATE Task Title (Save Inline Edit)
function saveTaskEdit(id, newTitle) {
  newTitle = newTitle.trim();
  if (!newTitle) {
    showToast('Task title cannot be empty!', 'warning');
    return;
  }
  
  state.tasks = state.tasks.map(task => {
    if (task.id === id) {
      if (task.title !== newTitle) {
        showToast('Task updated successfully.', 'info');
      }
      return { ...task, title: newTitle };
    }
    return task;
  });
  
  editingTaskId = null;
  saveStateToLocalStorage();
  render();
}

// DELETE Task triggers confirmation modal
function triggerDeleteConfirmation(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  taskIdToDelete = id;
  lastFocusedElementBeforeModal = document.activeElement;
  
  // Set modal text
  elements.modalTaskPreview.textContent = task.title;
  
  // Open modal
  elements.modalBackdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Lock background scrolling
  
  // Accessibility Focus Trap setup
  elements.confirmCancelBtn.focus();
}

function handleConfirmDelete() {
  if (!taskIdToDelete) return;
  
  state.tasks = state.tasks.filter(t => t.id !== taskIdToDelete);
  saveStateToLocalStorage();
  
  closeModal();
  render();
  showToast('Task deleted.', 'warning');
  
  // Restore focus to main container or list
  if (lastFocusedElementBeforeModal) {
    lastFocusedElementBeforeModal.focus();
  }
}

function closeModal() {
  elements.modalBackdrop.classList.add('hidden');
  document.body.style.overflow = ''; // Unlock scrolling
  taskIdToDelete = null;
  
  if (lastFocusedElementBeforeModal) {
    lastFocusedElementBeforeModal.focus();
  }
}

// -----------------------------------------
// Rendering Engines
// -----------------------------------------

// Main render coordinates both Stats dashboard and Lists
function render() {
  renderStats();
  renderListOnly();
  
  // Set sorting select state based on saved settings
  elements.taskSort.value = state.sortBy;
  elements.taskSearch.value = state.searchQuery;
  if (state.searchQuery.trim().length > 0) {
    elements.clearSearchBtn.classList.remove('hidden');
  }
}

// 1. Calculate & Draw Stats Section
function renderStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const active = total - completed;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const overdue = state.tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;
  
  // Update numbers
  elements.statTotal.textContent = total;
  elements.statActive.textContent = active;
  elements.statCompleted.textContent = completed;
  elements.statOverdue.textContent = overdue;
  
  // Warning border color/pulse on Overdue stats card
  const overdueCard = document.getElementById('stat-overdue-card');
  if (overdue > 0) {
    overdueCard.style.borderColor = 'rgba(244, 63, 94, 0.4)';
    overdueCard.style.boxShadow = '0 4px 14px rgba(244, 63, 94, 0.15)';
  } else {
    overdueCard.style.borderColor = '';
    overdueCard.style.boxShadow = '';
  }
  
  // Progress calculation
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  elements.progressPercentage.textContent = `${percentage}%`;
  
  elements.progressBar.style.width = `${percentage}%`;
  elements.progressBar.setAttribute('aria-valuenow', percentage);
  
  // Enable / disable Clear Completed
  elements.clearCompletedBtn.disabled = completed === 0;
}

// 2. Filter, Sort, and Draw List Dynamic elements
function renderListOnly() {
  // Clear active DOM items
  elements.taskList.innerHTML = '';
  
  // Filter Tasks
  let filtered = state.tasks.filter(task => {
    // 1. Filter by Status Tab
    if (state.filter === 'active' && task.completed) return false;
    if (state.filter === 'completed' && !task.completed) return false;
    
    // 2. Search Title filter
    if (state.searchQuery.trim().length > 0) {
      const q = state.searchQuery.toLowerCase();
      if (!task.title.toLowerCase().includes(q)) return false;
    }
    
    return true;
  });
  
  // Sort Tasks
  filtered.sort((a, b) => {
    if (state.sortBy === 'created-desc') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (state.sortBy === 'created-asc') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    if (state.sortBy === 'due-asc') {
      // Empty due dates go last
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (state.sortBy === 'due-desc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return b.dueDate.localeCompare(a.dueDate);
    }
    return 0;
  });
  
  // Toggle empty state visual
  if (filtered.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.setAttribute('aria-hidden', 'false');
    elements.taskList.style.display = 'none';
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  elements.emptyState.setAttribute('aria-hidden', 'true');
  elements.taskList.style.display = 'flex';
  
  // Generate cards dynamically
  filtered.forEach(task => {
    const isEditing = editingTaskId === task.id;
    const taskItem = document.createElement('li');
    taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
    taskItem.dataset.id = task.id;
    
    // Build dates details
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = !task.completed && task.dueDate && task.dueDate < todayStr;
    
    // HTML Template Builder
    let cardHTML = `
      <!-- Checkbox -->
      <label class="checkbox-container">
        <input type="checkbox" class="task-checkbox-native" data-action="toggle" ${task.completed ? 'checked' : ''} aria-label="Mark task '${escapeHTML(task.title)}' as ${task.completed ? 'active' : 'complete'}">
        <span class="task-checkbox-custom" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
      </label>
      
      <!-- Content Details -->
      <div class="task-content">
        <div class="task-title-wrapper">
    `;
    
    if (isEditing) {
      cardHTML += `
          <input type="text" class="task-edit-input" data-action="edit-input" value="${escapeHTML(task.title)}" aria-label="Edit task title" maxlength="120">
      `;
    } else {
      cardHTML += `
          <span class="task-title" tabindex="0">${escapeHTML(task.title)}</span>
      `;
    }
    
    cardHTML += `
        </div>
        <div class="task-meta">
          <span class="badge badge-created">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Created ${formatDateTime(task.createdAt)}
          </span>
    `;
    
    if (task.dueDate) {
      const overdueClass = isOverdue ? 'overdue' : '';
      const dueLabel = isOverdue ? 'Overdue' : 'Due';
      cardHTML += `
          <span class="badge badge-due ${overdueClass}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${dueLabel} ${formatDate(task.dueDate)}
          </span>
      `;
    }
    
    if (task.completed) {
      cardHTML += `
          <span class="badge badge-completed">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Completed
          </span>
      `;
    }
    
    cardHTML += `
        </div>
      </div>
      
      <!-- Operations Buttons -->
      <div class="task-actions">
    `;
    
    if (isEditing) {
      cardHTML += `
        <button class="btn-icon btn-edit-save" data-action="save" aria-label="Save changes to task title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <button class="btn-icon" data-action="cancel-edit" aria-label="Cancel editing">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="12"></line>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      `;
    } else {
      cardHTML += `
        <button class="btn-icon btn-edit-save" data-action="edit" aria-label="Edit task title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </button>
      `;
    }
    
    cardHTML += `
        <button class="btn-icon btn-delete" data-action="delete" aria-label="Delete task">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    `;
    
    taskItem.innerHTML = cardHTML;
    elements.taskList.appendChild(taskItem);
  });
  
  // Set immediate focus on active input if editing is initialized
  if (editingTaskId) {
    const editInput = elements.taskList.querySelector('.task-edit-input');
    if (editInput) {
      editInput.focus();
      // Position cursor at end of input
      const length = editInput.value.length;
      editInput.setSelectionRange(length, length);
    }
  }
}

// -----------------------------------------
// Event Delegation Action router
// -----------------------------------------
function handleTaskListClicks(e) {
  const target = e.target;
  const actionButton = target.closest('[data-action]');
  if (!actionButton) return;
  
  const taskItem = target.closest('.task-item');
  if (!taskItem) return;
  
  const taskId = taskItem.dataset.id;
  const action = actionButton.dataset.action;
  
  if (action === 'toggle') {
    toggleTask(taskId);
  } else if (action === 'edit') {
    editingTaskId = taskId;
    renderListOnly();
  } else if (action === 'cancel-edit') {
    editingTaskId = null;
    renderListOnly();
  } else if (action === 'save') {
    const editInput = taskItem.querySelector('.task-edit-input');
    if (editInput) {
      saveTaskEdit(taskId, editInput.value);
    }
  } else if (action === 'delete') {
    triggerDeleteConfirmation(taskId);
  }
}

// Inline input keyboard event interception
function handleTaskListKeys(e) {
  const target = e.target;
  if (target.dataset.action === 'edit-input') {
    const taskItem = target.closest('.task-item');
    if (!taskItem) return;
    const taskId = taskItem.dataset.id;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTaskEdit(taskId, target.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editingTaskId = null;
      renderListOnly();
    }
  }
}

// -----------------------------------------
// Accessible Dialog Focus Trap & Escape Hooks
// -----------------------------------------
function handleModalKeys(e) {
  if (elements.modalBackdrop.classList.contains('hidden')) return;
  
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
    return;
  }
  
  if (e.key === 'Tab') {
    const focusable = elements.deleteModal.querySelectorAll('button');
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    
    if (e.shiftKey) { // Shift + Tab
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else { // Tab
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }
}

// -----------------------------------------
// Toast Notification Engine
// -----------------------------------------
function showToast(message, type = 'success') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon selections
  let iconHTML = '';
  if (type === 'success') {
    iconHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 16 14"/>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    `;
  } else if (type === 'info') {
    iconHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    `;
  } else if (type === 'warning') {
    iconHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    `;
  }
  
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${iconHTML}</span>
    <span class="toast-message">${escapeHTML(message)}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Remove toast after duration
  const timer = setTimeout(() => {
    toast.classList.add('toast-exit');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 3000);
}

// -----------------------------------------
// Helper & Sanitizer functions
// -----------------------------------------
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00'); // Prevent timezone shifts
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return '';
  const date = new Date(dateTimeString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
