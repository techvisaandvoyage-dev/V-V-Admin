const KEY_PREFIX = "vb-travel-draft-";

export const travelDraftStorageKey = (countryId) =>
  countryId ? `${KEY_PREFIX}${countryId}` : "";

export function saveTravelDraft(countryId, draft) {
  if (!countryId || !draft) return;
  try {
    const payload = JSON.stringify({
      applicationId: draft.applicationId ?? "",
      travelDateFrom: draft.travelDateFrom ?? "",
      travelDateTo: draft.travelDateTo ?? "",
      visaOption: draft.visaOption ?? "e-Visa",
      sharedDriveLink: draft.sharedDriveLink ?? "",
      travelers: Array.isArray(draft.travelers)
        ? draft.travelers.map((traveler) => ({
            ...traveler,
            name: traveler?.name ?? traveler?.fullName ?? "",
          }))
        : [],
      showTravelDetails: draft.showTravelDetails !== false,
    });
    localStorage.setItem(travelDraftStorageKey(countryId), payload);
    sessionStorage.setItem(travelDraftStorageKey(countryId), payload);
  } catch {
    /* quota / private mode */
  }
}

export function loadTravelDraft(countryId) {
  if (!countryId) return null;
  try {
    const key = travelDraftStorageKey(countryId);
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearTravelDraft(countryId) {
  if (!countryId) return;
  try {
    const key = travelDraftStorageKey(countryId);
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
