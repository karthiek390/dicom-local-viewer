<template>
  <section class="analysis-card about-page-card">
    <div class="help-card about-page-panel">
      <div class="help-header">
        <div>
          <p class="eyebrow">About</p>
          <h3>Local Help and Privacy</h3>
          <p>What stays in your browser, what stays in the local API session, and what stays in Orthanc.</p>
        </div>
        <button
          type="button"
          class="secondary-action"
          @click="$emit('toggle-help-panel')"
        >
          {{ showHelpPanel ? 'Hide Details' : 'Show Details' }}
        </button>
      </div>

      <div v-if="showHelpPanel" class="help-grid">
        <div class="help-item">
          <span>Browser State</span>
          <p>
            Theme, viewer mode, the active dataset pointer, recent resume pointers, recent locations,
            opened-item history, usage snapshots, and some navigation preferences stay in this browser only.
            They are lightweight helpers, not the saved dataset catalog.
          </p>
        </div>
        <div class="help-item">
          <span>Saved Dataset Registry</span>
          <p>
            Saved dataset records live in the backend-managed <strong>datasets-registry.json</strong> file.
            That file keeps dataset labels, source paths, summary counts, session-availability status,
            and duplicate-detection manifest data so saved datasets do not depend on browser storage.
          </p>
        </div>
        <div class="help-item">
          <span>API Session Files</span>
          <p>
            Analyzed DICOM files are staged in the local API container for the active session so
            browsing, metadata summaries, downloads, and imports can work without rereading your
            original folder.
          </p>
        </div>
        <div class="help-item">
          <span>Orthanc Storage</span>
          <p>
            Files are only imported into local Orthanc when you explicitly open them in OHIF.
            Those imported studies stay there until you clear them.
          </p>
        </div>
        <div class="help-item">
          <span>What Clear Does</span>
          <p>
            <strong>Clear Imported Studies</strong> removes only the studies imported into Orthanc for
            this session. <strong>Clear Current Session</strong> removes the staged session files,
            resets the UI state, and also clears imported Orthanc studies for this session.
          </p>
        </div>
        <div class="help-item">
          <span>Stack Shutdown</span>
          <p>
            <strong>docker compose down</strong> keeps the saved dataset registry and browser preferences,
            but live API sessions are lost and saved datasets may come back as stale records until they
            are re-analyzed. Orthanc imports normally remain because Orthanc uses a Docker volume.
          </p>
        </div>
        <div class="help-item">
          <span>What the URL Means</span>
          <p>
            The URL stores a pointer to the active local analysis session and your current folder
            navigation state. Removing the query parameters resets the UI, but it does not by
            itself clear Orthanc.
          </p>
        </div>
        <div class="help-item">
          <span>Privacy Scope</span>
          <p>
            This app is local-first. The workflow uses your browser plus the local Docker stack
            inside this app folder. It does not require a remote backend or cloud storage.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps(['showHelpPanel']);
defineEmits(['toggle-help-panel']);
</script>
