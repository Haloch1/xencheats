export function checkoutCustomerEmail(session) {
  const value = session?.customer_details?.email || session?.customer_email || "";
  const email = String(value).trim();
  return email || null;
}

export function normalizeCustomerDeliveryEmail(value) {
  const email = String(value || "").trim();
  if (!hasCustomerEmail(email) || email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function hasCustomerEmail(value) {
  const email = String(value || "").trim();
  return Boolean(email && email.toLowerCase() !== "unknown");
}

export function customerDeliveryComplete({ emailRequired, emailDelivered, discordDelivered }) {
  return emailRequired ? Boolean(emailDelivered) : Boolean(discordDelivered);
}

export function buildCartItemCheckoutSession(session, orderId) {
  return {
    id: `${session?.id || ""}:${orderId}`,
    stripe_session_id: session?.id || null,
    payment_intent: session?.payment_intent || null,
    customer_details: session?.customer_details || null,
    customer_email: session?.customer_email || null,
    metadata: { orderId, cartItem: "true" },
  };
}
