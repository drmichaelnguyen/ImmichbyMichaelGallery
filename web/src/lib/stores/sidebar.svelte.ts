import { mediaQueryManager } from '$lib/stores/media-query-manager.svelte';

class SidebarStore {
  /** Manual open state used on small screens (hamburger menu). */
  #mobileOpen = $state(false);

  /**
   * Desktop (≥850px): always open.
   * Phone/tablet: only open when the menu button toggles it.
   */
  get isOpen() {
    return mediaQueryManager.isFullSidebar || this.#mobileOpen;
  }

  /**
   * Reset the sidebar visibility to the default, based on the current screen width.
   */
  reset() {
    this.#mobileOpen = false;
  }

  /**
   * Toggles the sidebar visibility on small screens.
   */
  toggle() {
    if (mediaQueryManager.isFullSidebar) {
      this.#mobileOpen = false;
      return;
    }
    this.#mobileOpen = !this.#mobileOpen;
  }

  open() {
    if (!mediaQueryManager.isFullSidebar) {
      this.#mobileOpen = true;
    }
  }
}

export const sidebarStore = new SidebarStore();
