const SUPABASE_URL = "https://PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "PUBLIC_ANON_KEY";

const modal = document.getElementById("feedbackModal");
const form = document.getElementById("feedbackForm");

const typeInput = document.getElementById("feedbackType");
const titleInput = document.getElementById("feedbackTitleInput");
const bodyInput = document.getElementById("feedbackBody");
const modalTitle = document.getElementById("feedbackTitle");

document.getElementById("cancelFeedback").onclick = closeFeedbackModal;

function openFeedbackModal(type) {
  typeInput.value = type;

  modalTitle.textContent =
    type === "suggestion"
      ? "Submit a Suggestion"
      : type === "bug"
      ? "Report a Bug"
      : "Submit a Complaint";

  titleInput.value = "";
  bodyInput.value = "";

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeFeedbackModal() {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    p_title: titleInput.value.trim(),
    p_body: bodyInput.value.trim(),
    p_type: typeInput.value,
    p_metadata: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      app: "filecanvas"
    }
  };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/submit_complaint`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    closeFeedbackModal();
    alert("Thank you! Your feedback was submitted.");

  } catch (err) {
    console.error(err);
    alert("Failed to submit feedback.");
  }
});
