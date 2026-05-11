<template>
  <div class="tree-node">
    <button
      type="button"
      class="tree-folder"
      :class="{ selected: isSelected }"
      @click="$emit('toggle-folder', node.path)"
    >
      <span class="folder-caret" :class="{ expanded: isExpanded }"></span>
      <span class="folder-glyph" aria-hidden="true"></span>
      <span class="folder-copy">
        <strong>{{ node.label }}</strong>
        <small>{{ node.dicomCount }} DICOM{{ node.dicomCount === 1 ? '' : 's' }}</small>
      </span>
    </button>

    <Transition name="tree-slide">
      <div v-if="isExpanded" class="tree-branch">
        <div v-if="visibleChildren.length > 0" class="folder-children">
          <HierarchyNode
            v-for="child in visibleChildren"
            :key="child.path"
            :node="child"
            :expanded-paths="expandedPaths"
            :selected-path="selectedPath"
            @toggle-folder="$emit('toggle-folder', $event)"
          />
        </div>

        <button
          v-if="hasHiddenChildren"
          type="button"
          class="tree-overflow toggle-overflow"
          @click.stop="$emit('toggle-overflow', node.path, 'folders')"
        >
          {{ showAllFolders ? 'Show fewer folders' : `+ ${hiddenChildrenCount} more folder${hiddenChildrenCount === 1 ? '' : 's'}` }}
        </button>

        <div v-if="visibleFiles.length > 0" class="tree-files">
          <span
            v-for="file in visibleFiles"
            :key="file.relativePath"
            class="tree-file"
          >
            {{ file.name }}
          </span>
        </div>

        <button
          v-if="hasHiddenFiles"
          type="button"
          class="tree-overflow toggle-overflow"
          @click.stop="$emit('toggle-overflow', node.path, 'files')"
        >
          {{ showAllFiles ? 'Show fewer files' : `+ ${hiddenFilesCount} more file${hiddenFilesCount === 1 ? '' : 's'}` }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  expandedPaths: {
    type: Array,
    required: true,
  },
  selectedPath: {
    type: String,
    required: true,
  },
});

defineEmits(['toggle-folder', 'toggle-overflow']);

const PREVIEW_LIMIT = 5;

const isExpanded = computed(() => props.expandedPaths.includes(props.node.path));
const isSelected = computed(() => props.selectedPath === props.node.path);
const showAllFolders = computed(() => props.node.showAllFolders === true);
const showAllFiles = computed(() => props.node.showAllFiles === true);

const visibleChildren = computed(() => (
  showAllFolders.value ? props.node.children : props.node.children.slice(0, PREVIEW_LIMIT)
));

const visibleFiles = computed(() => (
  showAllFiles.value ? props.node.files : props.node.files.slice(0, PREVIEW_LIMIT)
));

const hiddenChildrenCount = computed(() => Math.max(props.node.children.length - PREVIEW_LIMIT, 0));
const hiddenFilesCount = computed(() => Math.max(props.node.files.length - PREVIEW_LIMIT, 0));

const hasHiddenChildren = computed(() => hiddenChildrenCount.value > 0);
const hasHiddenFiles = computed(() => hiddenFilesCount.value > 0);
</script>

<style scoped>
.tree-node + .tree-node {
  margin-top: 0.65rem;
}

.tree-folder {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.85rem 1rem;
  cursor: pointer;
  text-align: left;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
  min-width: 0;
}

.tree-folder:hover {
  transform: translateY(-1px);
  border-color: var(--accent-strong);
}

.tree-folder.selected {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.folder-caret {
  width: 0.55rem;
  height: 0.55rem;
  border-right: 2px solid var(--text-secondary);
  border-bottom: 2px solid var(--text-secondary);
  transform: rotate(-45deg);
  transition: transform 160ms ease;
  margin-top: -0.15rem;
}

.folder-caret.expanded {
  transform: rotate(45deg);
}

.folder-glyph {
  width: 1.1rem;
  height: 0.9rem;
  border: 2px solid var(--accent-strong);
  border-top-left-radius: 0.3rem;
  border-top-right-radius: 0.15rem;
  border-bottom-left-radius: 0.22rem;
  border-bottom-right-radius: 0.22rem;
  position: relative;
  flex: 0 0 auto;
}

.folder-glyph::before {
  content: "";
  position: absolute;
  left: 0.05rem;
  top: -0.36rem;
  width: 0.52rem;
  height: 0.28rem;
  border: 2px solid var(--accent-strong);
  border-bottom: 0;
  border-top-left-radius: 0.24rem;
  border-top-right-radius: 0.24rem;
  background: var(--surface-raised);
}

.folder-copy {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1 1 auto;
}

.folder-copy strong,
.folder-copy small {
  overflow-wrap: anywhere;
}

.folder-copy small {
  color: var(--text-secondary);
}

.tree-branch {
  margin-left: clamp(0.75rem, 1.8vw, 1.4rem);
  padding-left: clamp(0.65rem, 1.4vw, 0.95rem);
  border-left: 1px dashed var(--border-color);
  margin-top: 0.65rem;
  min-width: 0;
}

.folder-children {
  margin-bottom: 0.55rem;
}

.tree-files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.55rem;
  min-width: 0;
}

.tree-file,
.tree-overflow {
  border-radius: 999px;
  padding: 0.4rem 0.7rem;
  font-size: 0.92rem;
}

.tree-file {
  background: var(--surface-muted);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.toggle-overflow {
  margin-top: 0.55rem;
  border: 1px dashed var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.tree-slide-enter-active,
.tree-slide-leave-active {
  transition: all 180ms ease;
  transform-origin: top;
}

.tree-slide-enter-from,
.tree-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px) scaleY(0.98);
}
</style>
