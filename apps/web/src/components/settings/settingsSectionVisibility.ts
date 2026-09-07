type VisibilityEntry = Pick<
  IntersectionObserverEntry,
  "intersectionRatio" | "isIntersecting" | "target"
>;

export type SettingsSectionVisibilityScope = {
  readonly path: string;
};

export type SettingsSectionVisibilityState = {
  readonly scope: SettingsSectionVisibilityScope;
  readonly targetIds: ReadonlySet<string>;
};

const EMPTY_VISIBLE_SETTINGS_SECTION_IDS: ReadonlySet<string> = new Set();

export function getVisibleSettingsSectionIds({
  activePath,
  scope,
  visibility,
}: {
  readonly activePath: string | undefined;
  readonly scope: SettingsSectionVisibilityScope | null;
  readonly visibility: SettingsSectionVisibilityState | null;
}): ReadonlySet<string> {
  if (!scope || activePath !== scope.path || visibility?.scope !== scope) {
    return EMPTY_VISIBLE_SETTINGS_SECTION_IDS;
  }
  return visibility.targetIds;
}

type ElementObserver = {
  observe(target: Element): void;
  unobserve(target: Element): void;
  disconnect(): void;
};

type MutationSubscription = {
  disconnect(): void;
};

export type SettingsSectionVisibilityEnvironment = {
  findRoot(container: Element): Element | null;
  findTarget(root: Element, targetId: string): Element | null;
  createIntersectionObserver(
    onEntries: (entries: ReadonlyArray<VisibilityEntry>) => void,
    root: Element,
  ): ElementObserver;
  createMutationObserver(onMutation: () => void, container: Element): MutationSubscription;
};

function createBrowserEnvironment(): SettingsSectionVisibilityEnvironment {
  return {
    findRoot(container) {
      return container.querySelector("[data-settings-page-scroll]");
    },
    findTarget(root, targetId) {
      const target = root.ownerDocument.getElementById(targetId);
      return target && root.contains(target) ? target : null;
    },
    createIntersectionObserver(onEntries, scrollRoot) {
      const observers = new Map<Element, { observer: IntersectionObserver; threshold: number }>();
      const updateObserver = (target: Element) => {
        // Require half a section, capped at a quarter of the viewport for tall sections.
        const threshold = Math.min(
          0.5,
          (scrollRoot.clientHeight * 0.25) / Math.max(1, target.getBoundingClientRect().height),
        );
        const previous = observers.get(target);
        if (previous?.threshold === threshold) return;
        previous?.observer.disconnect();
        const observer = new IntersectionObserver(
          (entries) => {
            if (observers.get(target)?.observer !== observer) return;
            onEntries(
              entries.map((entry) => ({
                target: entry.target,
                intersectionRatio: entry.intersectionRatio,
                isIntersecting: entry.isIntersecting && entry.intersectionRatio >= threshold,
              })),
            );
          },
          { root: scrollRoot, threshold },
        );
        observers.set(target, { observer, threshold });
        observer.observe(target);
      };
      const resizeObserver = new ResizeObserver(() => {
        for (const target of observers.keys()) updateObserver(target);
      });
      resizeObserver.observe(scrollRoot);
      return {
        observe(target) {
          updateObserver(target);
          resizeObserver.observe(target);
        },
        unobserve(target) {
          observers.get(target)?.observer.disconnect();
          observers.delete(target);
          resizeObserver.unobserve(target);
        },
        disconnect() {
          resizeObserver.disconnect();
          for (const { observer } of observers.values()) observer.disconnect();
          observers.clear();
        },
      };
    },
    createMutationObserver(onMutation, container) {
      const observer = new MutationObserver(onMutation);
      observer.observe(container, { childList: true, subtree: true });
      return observer;
    },
  };
}

export function observeSettingsSectionVisibility({
  container,
  targetIds,
  onChange,
  environment = createBrowserEnvironment(),
}: {
  readonly container: Element;
  readonly targetIds: ReadonlyArray<string>;
  readonly onChange: (visibleTargetIds: ReadonlyArray<string>) => void;
  readonly environment?: SettingsSectionVisibilityEnvironment;
}): () => void {
  const orderedTargetIds = [...new Set(targetIds)];
  const targetsById = new Map<string, Element>();
  const targetIdsByElement = new Map<Element, string>();
  const visibleTargetIds = new Set<string>();
  let lastEmission: string | null = null;
  let stopped = false;
  let root: Element | null = null;
  let intersectionObserver: ElementObserver | null = null;
  let observerGeneration = 0;

  const emit = () => {
    const visibleInOrder = orderedTargetIds.filter((targetId) => visibleTargetIds.has(targetId));
    const emissionKey = visibleInOrder.join("\0");
    if (emissionKey === lastEmission) return;
    lastEmission = emissionKey;
    onChange(visibleInOrder);
  };

  const handleEntries = (entries: ReadonlyArray<VisibilityEntry>, generation: number) => {
    if (stopped || generation !== observerGeneration) return;
    let changed = false;
    for (const entry of entries) {
      const targetId = targetIdsByElement.get(entry.target);
      if (!targetId || targetsById.get(targetId) !== entry.target) continue;
      const visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (visible === visibleTargetIds.has(targetId)) continue;
      changed = true;
      if (visible) {
        visibleTargetIds.add(targetId);
      } else {
        visibleTargetIds.delete(targetId);
      }
    }
    if (changed) emit();
  };

  const syncTargets = () => {
    if (stopped) return;
    let changed = false;
    const nextRoot = environment.findRoot(container);

    if (nextRoot !== root) {
      observerGeneration += 1;
      intersectionObserver?.disconnect();
      intersectionObserver = null;
      root = nextRoot;
      targetsById.clear();
      targetIdsByElement.clear();
      changed = visibleTargetIds.size > 0;
      visibleTargetIds.clear();

      if (root) {
        const generation = observerGeneration;
        intersectionObserver = environment.createIntersectionObserver(
          (entries) => handleEntries(entries, generation),
          root,
        );
      }
    }

    if (!root || !intersectionObserver) {
      if (changed) emit();
      return;
    }

    for (const targetId of orderedTargetIds) {
      const previousTarget = targetsById.get(targetId) ?? null;
      const nextTarget = environment.findTarget(root, targetId);
      if (previousTarget === nextTarget) continue;

      if (previousTarget) {
        intersectionObserver.unobserve(previousTarget);
        targetsById.delete(targetId);
        targetIdsByElement.delete(previousTarget);
        changed = visibleTargetIds.delete(targetId) || changed;
      }
      if (nextTarget) {
        targetsById.set(targetId, nextTarget);
        targetIdsByElement.set(nextTarget, targetId);
        intersectionObserver.observe(nextTarget);
      }
    }

    if (changed) emit();
  };

  const mutationObserver = environment.createMutationObserver(syncTargets, container);
  syncTargets();
  emit();

  return () => {
    stopped = true;
    observerGeneration += 1;
    intersectionObserver?.disconnect();
    mutationObserver.disconnect();
    targetsById.clear();
    targetIdsByElement.clear();
    visibleTargetIds.clear();
  };
}
