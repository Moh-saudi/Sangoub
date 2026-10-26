export function goShop(href: string) {
  history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (location.hash)
    window.setTimeout(
      () => document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      100,
    );
}
