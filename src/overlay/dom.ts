// Even assigning the same attribute/text can invalidate style or restart image work in Chromium.
// Live GSI ticks should leave an unchanged overlay completely idle.
export function setText(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

export function setData(node: HTMLElement, key: string, value: string): void {
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

export function setHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}

export function setStyle(node: HTMLElement, property: string, value: string): void {
  if (node.style.getPropertyValue(property) !== value) node.style.setProperty(property, value);
}

export function getRequiredChild(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing overlay element: ${selector}`);
  }

  return element;
}
