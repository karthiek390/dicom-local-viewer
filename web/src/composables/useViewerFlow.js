import { computed, ref, watch } from 'vue';

export function useViewerFlow({ navigateToPortalPage, showToast }) {
  const viewerMode = ref(localStorage.getItem('viewer-mode') || 'same-tab');
  const viewerUrl = ref('');

  watch(viewerMode, (value) => {
    localStorage.setItem('viewer-mode', value);
  });

  const viewerModeTitle = computed(() => (
    viewerMode.value === 'same-tab' ? 'Open inside this page' : 'Open in a new browser tab'
  ));

  const viewerModeHint = computed(() => (
    viewerMode.value === 'same-tab'
      ? 'Keeps OHIF embedded below the portal so you can continue browsing your dataset in one place.'
      : 'Opens OHIF in a separate tab while leaving the portal available for uploads, analytics, and folder browsing.'
  ));

  const viewerActionLabel = computed(() => (
    viewerMode.value === 'same-tab' ? 'Open Here' : 'Open in New Tab'
  ));

  function getViewerLaunchMessage() {
    return viewerMode.value === 'new-tab'
      ? 'OHIF is opening in a new tab.'
      : 'OHIF is ready below on this page.';
  }

  function closeViewer() {
    viewerUrl.value = '';
  }

  function buildViewerUrl(importedItems) {
    if (!importedItems || importedItems.length === 0) {
      return '/ohif/';
    }

    const uniqueStudyUids = [...new Set(importedItems.map((item) => item.studyUid).filter(Boolean))];
    if (uniqueStudyUids.length === 0) {
      return '/ohif/';
    }

    const searchParams = new URLSearchParams();
    searchParams.set('StudyInstanceUIDs', uniqueStudyUids.join(','));

    const uniqueSeriesUids = [...new Set(importedItems.map((item) => item.seriesUid).filter(Boolean))];
    if (uniqueSeriesUids.length > 0) {
      searchParams.set('SeriesInstanceUIDs', uniqueSeriesUids.join(','));
      searchParams.set('initialSeriesInstanceUID', uniqueSeriesUids[0]);
    }

    if (importedItems.length === 1 && importedItems[0].sopInstanceUid) {
      searchParams.set('initialSopInstanceUID', importedItems[0].sopInstanceUid);
    }

    return `/ohif/viewer/?${searchParams.toString()}`;
  }

  function openDashboardViewerLink(viewerLink) {
    if (!viewerLink) {
      showToast('No viewer link is available for that item yet.', 'error', 'Viewer unavailable');
      return;
    }

    if (viewerMode.value === 'new-tab') {
      window.open(viewerLink, '_blank', 'noopener,noreferrer');
    } else {
      viewerUrl.value = viewerLink;
      navigateToPortalPage('datasets');
    }
  }

  return {
    viewerMode,
    viewerUrl,
    viewerModeTitle,
    viewerModeHint,
    viewerActionLabel,
    getViewerLaunchMessage,
    closeViewer,
    buildViewerUrl,
    openDashboardViewerLink,
  };
}
