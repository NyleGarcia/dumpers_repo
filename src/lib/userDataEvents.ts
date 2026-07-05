export const PERSONAL_RESOURCES_WIPED_EVENT = 'dumpers:personal-resources-wiped'

export function notifyPersonalResourcesWiped(): void {
  window.dispatchEvent(new Event(PERSONAL_RESOURCES_WIPED_EVENT))
}
