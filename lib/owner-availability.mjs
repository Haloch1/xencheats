export const OWNER_UNAVAILABLE_TICKET_COPY =
  "The owner is not available right now. He will check back as soon as he is available.";

export function ownerAvailabilityRouting(available, ownerPingRequested = false) {
  const isAvailable = available === true;
  return {
    includeOwnerMention: Boolean(ownerPingRequested) || !isAvailable,
    notifyOwner: isAvailable && Boolean(ownerPingRequested),
    unavailableCopy: isAvailable ? null : OWNER_UNAVAILABLE_TICKET_COPY,
  };
}

export function parseOwnerAvailabilityCommand(value) {
  const match = /^!available(?:\s+(true|false))?$/i.exec(String(value || "").trim());
  if (!match) return null;
  return match[1]
    ? { action: "set", available: match[1].toLowerCase() === "true" }
    : { action: "get" };
}
