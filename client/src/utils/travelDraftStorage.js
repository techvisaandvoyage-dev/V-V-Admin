const KEY_PREFIX = "vb-travel-draft-";

export const travelDraftStorageKey = (countryId) =>
  countryId ? `${KEY_PREFIX}${countryId}` : "";

export function saveTravelDraft(countryId, draft) {
  if (!countryId || !draft) return;
  try {
    sessionStorage.setItem(
      travelDraftStorageKey(countryId),
      JSON.stringify({
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
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadTravelDraft(countryId) {
  if (!countryId) return null;
  try {
    const raw = sessionStorage.getItem(travelDraftStorageKey(countryId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearTravelDraft(countryId) {
  if (!countryId) return;
  try {
    sessionStorage.removeItem(travelDraftStorageKey(countryId));
  } catch {
    /* ignore */
  }
}
