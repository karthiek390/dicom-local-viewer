import { computed, nextTick, ref, watch } from 'vue';

const DEFAULT_FOLDER_PREFERENCES = {
  sortBy: 'name',
  sortDir: 'asc',
  pageSize: '25',
};

const defaultCurrentFolderControls = {
  search: '',
  searchScope: 'descendants',
  extension: 'all',
  sizeRange: 'all',
  sortBy: DEFAULT_FOLDER_PREFERENCES.sortBy,
  sortDir: DEFAULT_FOLDER_PREFERENCES.sortDir,
  pageSize: DEFAULT_FOLDER_PREFERENCES.pageSize,
};

function readStoredFolderPreferences() {
  const storedSortBy = localStorage.getItem('current-folder-sort-by');
  const storedSortDir = localStorage.getItem('current-folder-sort-dir');
  const storedPageSize = localStorage.getItem('current-folder-page-size');

  return {
    sortBy: ['name', 'size', 'dicomCount', 'type'].includes(storedSortBy)
      ? storedSortBy
      : DEFAULT_FOLDER_PREFERENCES.sortBy,
    sortDir: storedSortDir === 'desc' ? 'desc' : DEFAULT_FOLDER_PREFERENCES.sortDir,
    pageSize: ['25', '50', '100'].includes(storedPageSize)
      ? storedPageSize
      : DEFAULT_FOLDER_PREFERENCES.pageSize,
  };
}

export function useCurrentFolderBrowser({
  treeRoot,
  currentPath,
  findNodeByPath,
  inspectorCardRef,
  fetchCurrentFolderResults,
  fetchCurrentFolderGroupedData,
  loadInspectorMetadata,
  syncHistoryState,
  syncRecentLocationForCurrentState,
  recordRecentLocation,
  captureNavigationState,
  isApplyingHistoryStateRef,
}) {
  const storedFolderPreferences = readStoredFolderPreferences();
  let folderSearchDebounceHandle = null;
  const expandedPaths = ref(new Set());
  const folderSearchInputRef = ref(null);
  const folderSearchInput = ref('');
  const debouncedFolderSearch = ref('');
  const currentFolderSearchScope = ref('descendants');
  const currentFolderExtensionFilter = ref('all');
  const currentFolderSizeRange = ref('all');
  const currentFolderSortBy = ref(storedFolderPreferences.sortBy);
  const currentFolderSortDir = ref(storedFolderPreferences.sortDir);
  const currentFolderPageSize = ref(storedFolderPreferences.pageSize);
  const currentFolderControls = ref({
    page: 1,
    pageSize: Number(storedFolderPreferences.pageSize),
    totalResults: 0,
    totalPages: 1,
  });
  const currentFolderViewMode = ref('grouped');
  const currentFolderEntries = ref([]);
  const currentFolderInfo = ref({
    folderCount: 0,
    fileCount: 0,
  });
  const currentFolderPageInput = ref('1');
  const currentFolderPageError = ref('');
  const currentFolderGroupedData = ref({
    studyCount: 0,
    directFileCount: 0,
    studies: [],
  });
  const currentFolderGroupedLoading = ref(false);
  const currentFolderGroupedError = ref('');
  const selectedInspectorItem = ref(null);
  const inspectorMetadataSummary = ref(null);
  const inspectorMetadataLoading = ref(false);
  const inspectorMetadataError = ref('');
  const recentLocations = ref([]);
  const currentFolderLoading = ref(false);

  function setFolderSearchInputRef(element) {
    folderSearchInputRef.value = element;
  }

  watch(currentFolderSortBy, (value) => {
    localStorage.setItem('current-folder-sort-by', value);
  });

  watch(currentFolderSortDir, (value) => {
    localStorage.setItem('current-folder-sort-dir', value);
  });

  watch(currentFolderPageSize, (value) => {
    localStorage.setItem('current-folder-page-size', value);
  });

  watch(folderSearchInput, (value) => {
    const trimmedValue = value.trim();
    window.clearTimeout(folderSearchDebounceHandle);
    folderSearchDebounceHandle = window.setTimeout(() => {
      debouncedFolderSearch.value = trimmedValue;
    }, 450);
  });

  const currentNode = computed(() => {
    if (!treeRoot.value) {
      return {
        label: 'Nothing selected',
        path: '',
        children: [],
        files: [],
        dicomCount: 0,
      };
    }

    return findNodeByPath(treeRoot.value, currentPath.value) || treeRoot.value;
  });

  const treeChildren = computed(() => treeRoot.value?.children || []);
  const expandedPathsList = computed(() => [...expandedPaths.value]);
  const currentFolderFolders = computed(() => (
    currentFolderEntries.value.filter((entry) => entry.type === 'folder')
  ));
  const currentFolderFiles = computed(() => (
    currentFolderEntries.value.filter((entry) => entry.type === 'file')
  ));
  const showGroupedFolderView = computed(() => (
    currentFolderViewMode.value === 'grouped' && !currentFolderControls.value.recursiveSearch
  ));
  const showTableFolderView = computed(() => currentFolderViewMode.value === 'table');
  const selectedInspectorNode = computed(() => {
    if (!selectedInspectorItem.value || !treeRoot.value) {
      return null;
    }

    if (selectedInspectorItem.value.type !== 'folder') {
      return null;
    }

    return findNodeByPath(treeRoot.value, selectedInspectorItem.value.path);
  });

  const breadcrumbs = computed(() => {
    const parts = currentPath.value ? currentPath.value.split('/') : [];
    const crumbs = [{ label: 'Root', path: '' }];
    let pathBuilder = '';

    for (const part of parts) {
      pathBuilder = pathBuilder ? `${pathBuilder}/${part}` : part;
      crumbs.push({ label: part, path: pathBuilder });
    }

    return crumbs;
  });

  const hasCurrentFolderOverrides = computed(() => (
    folderSearchInput.value.trim() !== defaultCurrentFolderControls.search
    || (
      folderSearchInput.value.trim()
      && currentFolderSearchScope.value !== defaultCurrentFolderControls.searchScope
    )
    || currentFolderExtensionFilter.value !== defaultCurrentFolderControls.extension
    || currentFolderSizeRange.value !== defaultCurrentFolderControls.sizeRange
    || currentFolderSortBy.value !== defaultCurrentFolderControls.sortBy
    || currentFolderSortDir.value !== defaultCurrentFolderControls.sortDir
    || currentFolderPageSize.value !== defaultCurrentFolderControls.pageSize
  ));

  function formatSortLabel(sortBy) {
    const labels = {
      name: 'Name',
      size: 'Size',
      dicomCount: 'DICOM count',
      type: 'Type',
    };

    return labels[sortBy] || sortBy;
  }

  function formatExtensionFilterLabel(extension) {
    const labels = {
      all: 'All',
      '.dcm': '.dcm only',
      folders: 'Folders only',
    };

    return labels[extension] || extension;
  }

  function formatSizeRangeLabel(sizeRange) {
    const labels = {
      all: 'All',
      lt1mb: 'Under 1 MB',
      '1to10mb': '1 MB to 10 MB',
      gt10mb: 'Over 10 MB',
    };

    return labels[sizeRange] || sizeRange;
  }

  const activeFilterChips = computed(() => {
    const chips = [];

    if (folderSearchInput.value.trim()) {
      chips.push({
        key: 'search',
        label: `Search: ${folderSearchInput.value.trim()}`,
      });

      if (currentFolderSearchScope.value !== defaultCurrentFolderControls.searchScope) {
        chips.push({
          key: 'searchScope',
          label: 'Scope: Current folder',
        });
      }
    }

    if (currentFolderSortBy.value !== defaultCurrentFolderControls.sortBy) {
      chips.push({
        key: 'sortBy',
        label: `Sort: ${formatSortLabel(currentFolderSortBy.value)}`,
      });
    }

    if (currentFolderSortDir.value !== defaultCurrentFolderControls.sortDir) {
      chips.push({
        key: 'sortDir',
        label: `Direction: ${currentFolderSortDir.value === 'desc' ? 'Descending' : 'Ascending'}`,
      });
    }

    if (currentFolderExtensionFilter.value !== defaultCurrentFolderControls.extension) {
      chips.push({
        key: 'extension',
        label: `Type: ${formatExtensionFilterLabel(currentFolderExtensionFilter.value)}`,
      });
    }

    if (currentFolderSizeRange.value !== defaultCurrentFolderControls.sizeRange) {
      chips.push({
        key: 'sizeRange',
        label: `Size: ${formatSizeRangeLabel(currentFolderSizeRange.value)}`,
      });
    }

    if (currentFolderPageSize.value !== defaultCurrentFolderControls.pageSize) {
      chips.push({
        key: 'pageSize',
        label: `Results: ${currentFolderPageSize.value}`,
      });
    }

    if (currentFolderViewMode.value === 'grouped' && !currentFolderControls.value.recursiveSearch) {
      chips.push({
        key: 'viewMode',
        label: 'View: Grouped',
      });
    }

    return chips;
  });

  watch(showGroupedFolderView, (value) => {
    if (value) {
      void fetchCurrentFolderGroupedData();
    }
  });

  watch(selectedInspectorItem, (item) => {
    void loadInspectorMetadata(item);

    if (!item) {
      return;
    }

    void nextTick(() => {
      inspectorCardRef.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  watch(
    [
      () => currentFolderControls.value.page,
      () => currentFolderControls.value.totalPages,
    ],
    ([page]) => {
      currentFolderPageInput.value = String(page || 1);
      currentFolderPageError.value = '';
    },
    { immediate: true },
  );

  watch([
    debouncedFolderSearch,
    currentFolderSearchScope,
    currentFolderExtensionFilter,
    currentFolderSizeRange,
    currentFolderSortBy,
    currentFolderSortDir,
    currentFolderPageSize,
  ], () => {
    if (isApplyingHistoryStateRef.value) {
      return;
    }

    syncRecentLocationForCurrentState({
      page: 1,
    });
    currentFolderControls.value = {
      ...currentFolderControls.value,
      page: 1,
    };
    void fetchCurrentFolderResults();
    syncHistoryState();
  });

  watch(currentPath, () => {
    if (isApplyingHistoryStateRef.value) {
      return;
    }

    recordRecentLocation(currentPath.value, {
      ...captureNavigationState(),
      page: 1,
    });
    currentFolderControls.value = {
      ...currentFolderControls.value,
      page: 1,
    };
    void fetchCurrentFolderResults();
    syncHistoryState();
  });

  function clearFolderSearch() {
    folderSearchInput.value = '';
  }

  function removeFilterChip(key) {
    if (key === 'search') {
      clearFolderSearch();
      return;
    }

    if (key === 'searchScope') {
      currentFolderSearchScope.value = defaultCurrentFolderControls.searchScope;
      return;
    }

    if (key === 'sortBy') {
      currentFolderSortBy.value = defaultCurrentFolderControls.sortBy;
      return;
    }

    if (key === 'extension') {
      currentFolderExtensionFilter.value = defaultCurrentFolderControls.extension;
      return;
    }

    if (key === 'sizeRange') {
      currentFolderSizeRange.value = defaultCurrentFolderControls.sizeRange;
      return;
    }

    if (key === 'sortDir') {
      currentFolderSortDir.value = defaultCurrentFolderControls.sortDir;
      return;
    }

    if (key === 'pageSize') {
      currentFolderPageSize.value = defaultCurrentFolderControls.pageSize;
      return;
    }

    if (key === 'viewMode') {
      currentFolderViewMode.value = 'grouped';
    }
  }

  function getInspectorItemKey(item) {
    if (!item) {
      return '';
    }

    return item.type === 'folder'
      ? `folder:${item.path || item.targetPath || ''}`
      : `file:${item.relativePath || item.path || item.targetPath || ''}`;
  }

  function resetCurrentFolderControls() {
    folderSearchInput.value = defaultCurrentFolderControls.search;
    debouncedFolderSearch.value = defaultCurrentFolderControls.search;
    currentFolderSearchScope.value = defaultCurrentFolderControls.searchScope;
    currentFolderExtensionFilter.value = defaultCurrentFolderControls.extension;
    currentFolderSizeRange.value = defaultCurrentFolderControls.sizeRange;
    currentFolderSortBy.value = defaultCurrentFolderControls.sortBy;
    currentFolderSortDir.value = defaultCurrentFolderControls.sortDir;
    currentFolderPageSize.value = defaultCurrentFolderControls.pageSize;
    currentFolderControls.value = {
      ...currentFolderControls.value,
      page: 1,
    };
    void fetchCurrentFolderResults();
  }

  function goToCurrentFolderPage(page) {
    const targetPage = Math.max(
      1,
      Math.min(Number(page) || 1, Number(currentFolderControls.value.totalPages) || 1),
    );

    if (targetPage === currentFolderControls.value.page) {
      currentFolderPageInput.value = String(targetPage);
      return;
    }

    currentFolderControls.value = {
      ...currentFolderControls.value,
      page: targetPage,
    };
    currentFolderPageInput.value = String(targetPage);
    currentFolderPageError.value = '';
    syncRecentLocationForCurrentState({ page: targetPage });
    void fetchCurrentFolderResults();
    syncHistoryState();
  }

  function submitCurrentFolderPage() {
    const parsedPage = Number.parseInt(currentFolderPageInput.value, 10);
    const totalPages = Number(currentFolderControls.value.totalPages) || 1;

    if (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > totalPages) {
      currentFolderPageError.value = `Choose a whole page number from 1 to ${totalPages}.`;
      return;
    }

    goToCurrentFolderPage(parsedPage);
  }

  function toggleFolder(path) {
    currentPath.value = path;

    const nextExpanded = new Set(expandedPaths.value);
    if (nextExpanded.has(path)) {
      nextExpanded.delete(path);
    } else {
      nextExpanded.add(path);
    }
    expandedPaths.value = nextExpanded;
  }

  function jumpToBreadcrumbPath(targetPath) {
    currentPath.value = targetPath;

    const nextExpanded = new Set(expandedPaths.value);
    const parts = targetPath ? targetPath.split('/') : [];
    let runningPath = '';

    parts.forEach((part) => {
      runningPath = runningPath ? `${runningPath}/${part}` : part;
      nextExpanded.add(runningPath);
    });

    expandedPaths.value = nextExpanded;
  }

  function buildBreadcrumbButtons(entry) {
    const labels = entry.breadcrumbParts || ['Root'];
    return labels.map((label, index) => {
      if (index === 0) {
        return { label, path: '' };
      }

      return {
        label,
        path: labels.slice(1, index + 1).join('/'),
      };
    });
  }

  function toggleOverflow(path, target) {
    if (!treeRoot.value) return;
    const node = findNodeByPath(treeRoot.value, path);
    if (!node) return;

    if (target === 'folders') {
      node.showAllFolders = !node.showAllFolders;
    }

    if (target === 'files') {
      node.showAllFiles = !node.showAllFiles;
    }
  }

  return {
    defaultCurrentFolderControls,
    expandedPaths,
    folderSearchInputRef,
    folderSearchInput,
    debouncedFolderSearch,
    currentFolderSearchScope,
    currentFolderExtensionFilter,
    currentFolderSizeRange,
    currentFolderSortBy,
    currentFolderSortDir,
    currentFolderPageSize,
    currentFolderControls,
    currentFolderViewMode,
    currentFolderEntries,
    currentFolderInfo,
    currentFolderPageInput,
    currentFolderPageError,
    currentFolderGroupedData,
    currentFolderGroupedLoading,
    currentFolderGroupedError,
    selectedInspectorItem,
    inspectorMetadataSummary,
    inspectorMetadataLoading,
    inspectorMetadataError,
    recentLocations,
    currentFolderLoading,
    setFolderSearchInputRef,
    currentNode,
    treeChildren,
    expandedPathsList,
    currentFolderFolders,
    currentFolderFiles,
    showGroupedFolderView,
    showTableFolderView,
    selectedInspectorNode,
    breadcrumbs,
    hasCurrentFolderOverrides,
    activeFilterChips,
    clearFolderSearch,
    removeFilterChip,
    getInspectorItemKey,
    resetCurrentFolderControls,
    goToCurrentFolderPage,
    submitCurrentFolderPage,
    toggleFolder,
    jumpToBreadcrumbPath,
    buildBreadcrumbButtons,
    toggleOverflow,
  };
}
