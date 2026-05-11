<template>
  <div class="app-shell-frame">
    <header class="topbar">
      <div
        class="topbar-progress"
        :class="{ active: isLoading }"
        :style="{ width: loadingPercent > 0 ? loadingPercent + '%' : (isLoading ? '40%' : '0%') }"
        aria-hidden="true"
      ></div>

      <div class="topbar-brand">
        <button
          type="button"
          class="sidebar-toggle"
          :aria-expanded="String(!isSidebarCollapsed)"
          aria-label="Toggle navigation sidebar"
          @click="$emit('toggle-sidebar')"
        >
          <span></span><span></span><span></span>
        </button>
        <button type="button" class="brand-badge">
          <span class="brand-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="11" height="11" rx="3" stroke="currentColor" stroke-width="1.5"/>
              <rect x="16" y="1" width="11" height="11" rx="3" stroke="currentColor" stroke-width="1.5" opacity="0.65"/>
              <rect x="1" y="16" width="11" height="11" rx="3" stroke="currentColor" stroke-width="1.5" opacity="0.65"/>
              <rect x="16" y="16" width="11" height="11" rx="3" stroke="currentColor" stroke-width="1.5"/>
              <line x1="14" y1="5" x2="14" y2="23" stroke="currentColor" stroke-width="1" opacity="0.35"/>
              <line x1="5" y1="14" x2="23" y2="14" stroke="currentColor" stroke-width="1" opacity="0.35"/>
            </svg>
          </span>
          <span class="brand-copy">
            <strong>DICOM Local Viewer</strong>
            <small>Local-first imaging workspace</small>
          </span>
        </button>
      </div>

      <div class="topbar-actions">
        <span class="topbar-status">Local-only</span>
        <button
          type="button"
          class="theme-toggle"
          :aria-label="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
          :title="theme === 'light' ? 'Dark mode' : 'Light mode'"
          @click="$emit('toggle-theme')"
        >
          <svg v-if="theme === 'light'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>
      </div>
    </header>

    <div
      v-if="showSidebarOverlay"
      class="sidebar-overlay"
      @click="$emit('close-sidebar-mobile')"
    ></div>

    <div class="portal-shell" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
      <aside class="portal-sidebar" :class="{ open: isSidebarOpen }">
        <div class="portal-sidebar-header">
          <p class="portal-sidebar-kicker">Workspace</p>
          <h2>Navigation</h2>
          <p>Jump straight to the part of the local viewer you need.</p>
        </div>

        <nav class="portal-nav" aria-label="Primary">
          <button
            v-for="item in navigationItems"
            :key="item.key"
            type="button"
            class="portal-nav-item"
            :class="{ active: currentPortalPage === item.key }"
            :title="item.title"
            :aria-label="item.title"
            @click="$emit('navigate', item.key)"
          >
            <span class="portal-nav-icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="portal-nav-content">
              <span class="portal-nav-title">{{ item.title }}</span>
              <small>{{ item.description }}</small>
            </span>
          </button>
        </nav>

        <div class="portal-sidebar-card">
          <span class="portal-sidebar-label">Current page</span>
          <strong>{{ currentPortalPageLabel }}</strong>
          <p>{{ sidebarStatusMessage }}</p>
        </div>
      </aside>

      <main class="page-shell">
        <slot></slot>

        <footer class="portal-footer">
          <span>Local-first DICOM workspace for upload, browsing, analytics, and OHIF viewing.</span>
          <button
            type="button"
            class="portal-footer-link"
            @click="$emit('navigate', 'about')"
          >
            About & Privacy
          </button>
        </footer>
      </main>
    </div>
  </div>
</template>

<script setup>
defineProps({
  theme: { type: String, required: true },
  currentPortalPage: { type: String, required: true },
  currentPortalPageLabel: { type: String, required: true },
  sidebarStatusMessage: { type: String, required: true },
  isSidebarCollapsed: { type: Boolean, required: true },
  isSidebarOpen: { type: Boolean, required: true },
  showSidebarOverlay: { type: Boolean, required: true },
  navigationItems: { type: Array, required: true },
  isLoading: { type: Boolean, default: false },
  loadingPercent: { type: Number, default: 0 },
});

defineEmits(['toggle-theme', 'toggle-sidebar', 'close-sidebar-mobile', 'navigate']);
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
}

.topbar-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  width: 0%;
  background: linear-gradient(90deg, #4a9eff, #7fd0af, #4a9eff);
  background-size: 200% 100%;
  border-radius: 0 2px 2px 0;
  transition: width 0.4s ease, opacity 0.3s ease;
  opacity: 0;
  pointer-events: none;
}

.topbar-progress.active {
  opacity: 1;
  animation: progress-slide 1.6s ease-in-out infinite;
}

@keyframes progress-slide {
  0%   { background-position: 0% center; }
  100% { background-position: 200% center; }
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  height: 2.3rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--topbar-fg, #e8f2ff);
  cursor: pointer;
  transition: background 180ms ease, transform 250ms ease;
  padding: 0;
  flex-shrink: 0;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: rotate(20deg);
}
</style>
