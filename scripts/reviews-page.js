import { getCurrentSession } from "./supabase-client.js";
import { initReveal } from "./site.js";

initReveal();

const purchasesSection = document.getElementById("myPurchases");
const purchasesList = document.getElementById("purchasesList");
const reviewsList = document.getElementById("reviewsList");
const reviewModal = document.getElementById("reviewModal");
const reviewForm = document.getElementById("reviewForm");
const reviewOrderId = document.getElementById("reviewOrderId");
const reviewProductName = document.getElementById("reviewProductName");
const reviewRating = document.getElementById("reviewRating");
const reviewText = document.getElementById("reviewText");
const reviewMessage = document.getElementById("reviewMessage");
const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");
const starRating = document.getElementById("starRating");

function esc(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(val) {
  if (!val) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(val));
}

function stars(count) {
  return "&#9733;".repeat(count) + "&#9734;".repeat(5 - count);
}

function showMessage(el, text, type) {
  el.style.display = "block";
  el.className = `review-msg review-msg-${type}`;
  el.textContent = text;
}

function hideMessage(el) {
  el.style.display = "none";
}

// Star rating interaction
let selectedRating = 0;

starRating?.addEventListener("click", (e) => {
  const star = e.target.closest("[data-star]");
  if (!star) return;
  selectedRating = parseInt(star.dataset.star, 10);
  reviewRating.value = selectedRating;
  updateStars();
});

starRating?.addEventListener("mouseover", (e) => {
  const star = e.target.closest("[data-star]");
  if (!star) return;
  highlightStars(parseInt(star.dataset.star, 10));
});

starRating?.addEventListener("mouseleave", () => {
  updateStars();
});

function highlightStars(count) {
  starRating.querySelectorAll("[data-star]").forEach((s) => {
    s.classList.toggle("star-active", parseInt(s.dataset.star, 10) <= count);
  });
}

function updateStars() {
  highlightStars(selectedRating);
}

// Open review modal
function openReviewModal(orderId, productName) {
  reviewOrderId.value = orderId;
  reviewProductName.textContent = productName;
  selectedRating = 0;
  reviewRating.value = "0";
  reviewText.value = "";
  hideMessage(reviewMessage);
  updateStars();
  reviewModal.hidden = false;
  document.body.classList.add("modal-open");
  reviewText.focus();
}

function closeReviewModal() {
  reviewModal.hidden = true;
  document.body.classList.remove("modal-open");
}

// Close modal handlers
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-review]")) {
    closeReviewModal();
    return;
  }
  if (e.target === reviewModal) {
    closeReviewModal();
    return;
  }
  const reviewBtn = e.target.closest("[data-write-review]");
  if (reviewBtn) {
    openReviewModal(reviewBtn.dataset.orderId, reviewBtn.dataset.productName);
    return;
  }
});

// Submit review
reviewForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const orderId = reviewOrderId.value;
  const rating = parseInt(reviewRating.value, 10);
  const text = reviewText.value.trim();

  if (!rating || rating < 1 || rating > 5) {
    showMessage(reviewMessage, "Please select a star rating.", "error");
    return;
  }

  if (text.length < 10) {
    showMessage(reviewMessage, "Review must be at least 10 characters.", "error");
    return;
  }

  reviewSubmitBtn.disabled = true;
  reviewSubmitBtn.textContent = "Checking review...";
  hideMessage(reviewMessage);

  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, rating, reviewText: text }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 422) {
        showMessage(
          reviewMessage,
          `Review not approved: ${data.reason || "Did not meet guidelines."}`,
          "error"
        );
      } else {
        showMessage(reviewMessage, data.error || "Failed to submit review.", "error");
      }
      return;
    }

    closeReviewModal();
    loadPurchases();
    loadReviews();
  } catch (err) {
    showMessage(reviewMessage, "Something went wrong. Try again.", "error");
  } finally {
    reviewSubmitBtn.disabled = false;
    reviewSubmitBtn.textContent = "Submit Review";
  }
});

// Load user's purchases
async function loadPurchases() {
  try {
    const session = await getCurrentSession();
    if (!session) return;

    const res = await fetch("/api/reviews/my-purchases", {
      credentials: "same-origin",
    });

    if (!res.ok) return;

    const data = await res.json();
    const purchases = data.purchases || [];

    if (!purchases.length) return;

    purchasesSection.style.display = "block";

    purchasesList.innerHTML = purchases
      .map((p) => {
        let actionHtml;

        if (p.reviewStatus === "approved") {
          actionHtml = '<span class="member-chip member-chip-resolved">Reviewed</span>';
        } else if (p.reviewStatus === "rejected") {
          actionHtml = `
            <div>
              <span class="member-chip member-chip-closed">Rejected</span>
              <p class="review-rejection">${esc(p.rejectionReason || "Did not meet guidelines.")}</p>
              <button class="button button-small" data-write-review data-order-id="${esc(p.orderId)}" data-product-name="${esc(p.productName + (p.variantName ? " - " + p.variantName : ""))}">Try Again</button>
            </div>`;
        } else {
          actionHtml = `<button class="button button-primary button-small" data-write-review data-order-id="${esc(p.orderId)}" data-product-name="${esc(p.productName + (p.variantName ? " - " + p.variantName : ""))}">Write Review</button>`;
        }

        return `
          <div class="purchase-card">
            <div class="purchase-info">
              <strong>${esc(p.productName)}</strong>
              ${p.variantName ? `<span class="purchase-variant">${esc(p.variantName)}</span>` : ""}
              <span class="purchase-date">Purchased ${fmtDate(p.purchasedAt)}</span>
            </div>
            <div class="purchase-action">${actionHtml}</div>
          </div>`;
      })
      .join("");
  } catch {
    // Not logged in or error, just don't show purchases
  }
}

// Load public reviews
async function loadReviews() {
  try {
    const res = await fetch("/api/reviews");
    const data = await res.json();
    const reviews = data.reviews || [];

    if (!reviews.length) {
      reviewsList.innerHTML = '<div class="member-empty">No reviews yet. Be the first to leave a review!</div>';
      return;
    }

    reviewsList.innerHTML = reviews
      .map(
        (r) => `
        <div class="review-card">
          <div class="review-header">
            <span class="review-stars">${stars(r.rating)}</span>
            <span class="review-product">${esc(r.product_slug)}</span>
          </div>
          <p class="review-body">${esc(r.review_text)}</p>
          <span class="review-date">${fmtDate(r.created_at)}</span>
        </div>`
      )
      .join("");
  } catch {
    reviewsList.innerHTML = '<div class="member-empty">Unable to load reviews.</div>';
  }
}

loadPurchases();
loadReviews();
