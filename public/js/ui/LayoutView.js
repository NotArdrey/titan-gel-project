export class LayoutView {
  constructor(doc = document) {
    this.doc = doc;
  }

  toggleDrawer() {
    const drawer = this.doc.getElementById("mobile-drawer");
    if (!drawer) {
      return;
    }

    drawer.classList.toggle("hidden");
  }
}
