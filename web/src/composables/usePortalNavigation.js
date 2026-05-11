import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export function usePortalNavigation({
  summary,
  analysisSessionId,
  currentPath,
  recentActiveSession,
  hasSavedDatasets,
  folderSearchInputRef,
  showToast,
  loadRecentActiveSession,
  restoreSessionFromUrl,
  syncPortalUrl,
}) {
  const currentPortalPage = ref('dashboard');
  const isSidebarCollapsed = ref(false);
  const isSidebarOpen = ref(true);
  const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth);

  const portalNavigationItems = [
    {
      key: 'dashboard',
      title: 'Dashboard',
      description: 'Overview and recent session',
      icon: '\u229E',
    },
    {
      key: 'upload',
      title: 'Upload',
      description: 'Select and analyze a folder',
      icon: '\u21EA',
    },
    {
      key: 'datasets',
      title: 'Datasets',
      description: 'Browse files and hierarchy',
      icon: '\u229F',
    },
    {
      key: 'workspace-datasets',
      title: 'Workspace Datasets',
      description: 'Manage and switch saved datasets',
      icon: '\u2632',
    },
    {
      key: 'analytics',
      title: 'Analytics & Activity',
      description: 'Usage, ignored files, and session actions',
      icon: '\u25D4',
    },
    {
      key: 'about',
      title: 'About & Privacy',
      description: 'Local behavior and storage',
      icon: '\u24D8',
    },
  ];

  const currentPortalPageLabel = computed(() => ({
    dashboard: 'Dashboard',
    upload: 'Upload',
    datasets: 'Datasets',
    'workspace-datasets': 'Workspace Datasets',
    'dataset-detail': 'Dataset Detail',
    analytics: 'Analytics & Activity',
    about: 'About & Privacy',
  }[currentPortalPage.value] || 'Dashboard'));

  const sidebarStatusMessage = computed(() => {
    if (!analysisSessionId.value) {
      if (hasSavedDatasets.value) {
        return 'Saved datasets are available in this browser workspace.';
      }

      return 'No analyzed dataset is active yet.';
    }

    const locationLabel = currentPath.value
      ? `Current path: ${currentPath.value}`
      : 'Ready at the dataset root.';

    if (recentActiveSession.value?.folderName) {
      return `${recentActiveSession.value.folderName} active. ${locationLabel}`;
    }

    return `Local dataset ready. ${locationLabel}`;
  });

  const showSidebarOverlay = computed(() => (
    isSidebarOpen.value && viewportWidth.value <= 980
  ));

  function getPortalPageFromHash() {
    const normalizedHash = window.location.hash.replace(/^#\/?/, '');
    return ['dashboard', 'upload', 'datasets', 'workspace-datasets', 'dataset-detail', 'analytics', 'about'].includes(normalizedHash)
      ? normalizedHash
      : 'dashboard';
  }

  function syncPortalPageFromHash() {
    currentPortalPage.value = getPortalPageFromHash();
  }

  function syncSidebarMode() {
    viewportWidth.value = typeof window === 'undefined' ? viewportWidth.value : window.innerWidth;

    if (viewportWidth.value <= 980) {
      isSidebarCollapsed.value = false;
      isSidebarOpen.value = false;
    } else {
      isSidebarOpen.value = true;
    }
  }

  function toggleSidebar() {
    if (viewportWidth.value <= 980) {
      isSidebarOpen.value = !isSidebarOpen.value;
      return;
    }

    isSidebarCollapsed.value = !isSidebarCollapsed.value;
    isSidebarOpen.value = true;
  }

  function closeSidebarOnMobile() {
    if (viewportWidth.value <= 980) {
      isSidebarOpen.value = false;
    }
  }

  function navigateToPortalPage(pageKey) {
    if (pageKey === 'datasets' && !summary.value && !hasSavedDatasets.value) {
      showToast('Analyze a folder first to unlock the datasets workspace.', 'info', 'Upload needed');
    }

    currentPortalPage.value = pageKey;
    if (typeof syncPortalUrl === 'function') {
      syncPortalUrl(pageKey);
    } else {
      window.location.hash = `#/${pageKey}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeSidebarOnMobile();
  }

  function scrollToDatasetsArea(areaId) {
    const target = document.getElementById(areaId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function isEditableTarget(target) {
    if (!target) {
      return false;
    }

    const tagName = target.tagName?.toLowerCase();
    return tagName === 'input'
      || tagName === 'textarea'
      || tagName === 'select'
      || target.isContentEditable === true;
  }

  function focusCurrentFolderSearch() {
    if (!summary.value || !folderSearchInputRef.value) {
      return;
    }

    folderSearchInputRef.value.focus();
    folderSearchInputRef.value.select();
  }

  function handleSearchShortcut(event) {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    event.preventDefault();
    focusCurrentFolderSearch();
  }

  onMounted(() => {
    loadRecentActiveSession();
    syncSidebarMode();
    syncPortalPageFromHash();
    window.addEventListener('keydown', handleSearchShortcut);
    window.addEventListener('resize', syncSidebarMode);
    window.addEventListener('hashchange', syncPortalPageFromHash);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleSearchShortcut);
    window.removeEventListener('resize', syncSidebarMode);
    window.removeEventListener('hashchange', syncPortalPageFromHash);
  });

  return {
    currentPortalPage,
    isSidebarCollapsed,
    isSidebarOpen,
    viewportWidth,
    portalNavigationItems,
    currentPortalPageLabel,
    sidebarStatusMessage,
    showSidebarOverlay,
    syncPortalPageFromHash,
    syncSidebarMode,
    toggleSidebar,
    closeSidebarOnMobile,
    navigateToPortalPage,
    scrollToDatasetsArea,
  };
}
