// ./assets/components/feedback.js

// CONFIG — Replace these with your EmailJS values
//unsafe for now i know please don't abuse it till find a solution 
// which we do but i have to find actual work so.....
const EMAILJS_USER_ID = "attaI75BX2I65OjNW";
const EMAILJS_SERVICE_ID = "templator x";
const EMAILJS_TEMPLATE_ID = "template_bsay8q3";
const YOUR_EMAIL = "itharmarv@gmail.com";

import { init as emailjsInit, send as emailjsSend } from '@emailjs/browser';
emailjsInit(EMAILJS_USER_ID);

let modal;

export function createFeedbackModal() {
  const wrapper = document.createElement("div");
  wrapper.id = "feedbackModal";
  wrapper.className =
    "fixed inset-0 bg-black/50 flex items-center justify-center z-50";

  //  Added loading state placeholder
  wrapper.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
      <h2 id="feedbackTitle" class="text-lg font-semibold mb-4">
        Submit Feedback
      </h2>

      <form id="feedbackForm" class="space-y-4">
        <input type="hidden" id="feedbackType" />

        <div>
          <label class="block text-sm font-medium text-gray-700">Title</label>
          <input
            id="feedbackTitleInput"
            type="text"
            required
            class="w-full mt-1 px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-indigo-200"
            placeholder="Short summary"
          />
        </div>

        <!-- Bug severity (bugs only) -->
        <div id="severityWrapper" class="hidden">
          <label class="block text-sm font-medium text-gray-700">Severity</label>
          <select
            id="feedbackSeverity"
            class="w-full mt-1 px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-indigo-200"
          >
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Details</label>
          <textarea
            id="feedbackBody"
            required
            rows="4"
            class="w-full mt-1 px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-indigo-200"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">
            Attachments (optional)
          </label>
          <input
            id="feedbackAttachments"
            type="text"
            class="w-full mt-1 px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-indigo-200"
            placeholder="Comma-separated URLs or IDs"
          />
        </div>

        <div class="flex justify-end gap-2 pt-4">
          <button
            type="button"
            id="cancelFeedback"
            class="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            Cancel
          </button>

          <!-- Updated submit button with spinner -->
          <button
            type="submit"
            id="submitFeedbackBtn"
            class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
          >
            <span id="submitText">Submit</span>
            <svg id="spinner" class="hidden h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(wrapper);
  return wrapper;
}

export function openFeedbackModal(type) {
  modal = createFeedbackModal();

  const form = modal.querySelector("#feedbackForm");
  const typeInput = modal.querySelector("#feedbackType");
  const titleInput = modal.querySelector("#feedbackTitleInput");
  const bodyInput = modal.querySelector("#feedbackBody");
  const modalTitle = modal.querySelector("#feedbackTitle");
  const cancelBtn = modal.querySelector("#cancelFeedback");
  const severityWrapper = modal.querySelector("#severityWrapper");
  const severityInput = modal.querySelector("#feedbackSeverity");
  const attachmentsInput = modal.querySelector("#feedbackAttachments");
  const submitBtn = modal.querySelector("#submitFeedbackBtn");
  const submitText = modal.querySelector("#submitText");
  const spinner = modal.querySelector("#spinner");

  typeInput.value = type;

  modalTitle.textContent =
    type === "suggestion"
      ? "Submit a Suggestion"
      : type === "bug"
      ? "Report a Bug"
      : "Submit Feedback";

  severityWrapper.classList.toggle("hidden", type !== "bug");

  bodyInput.placeholder =
    type === "bug"
      ? "Describe the issue, steps to reproduce, expected vs actual behavior"
      : type === "suggestion"
      ? "Describe your suggestion and its benefit"
      : "Describe your feedback";

  cancelBtn.onclick = closeFeedbackModal;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    //Disable form & show spinner
    submitBtn.disabled = true;
    submitText.textContent = "Sending...";
    spinner.classList.remove("hidden");

    const metadata = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      app: "TemplatorX",
      severity: type === "bug" ? severityInput.value : null,
      attachments: attachmentsInput.value
        ? attachmentsInput.value.split(",").map(v => v.trim())
        : [],
      timestamp: new Date().toISOString()
    };

    const emailData = {
      to_email: YOUR_EMAIL,
      feedback_type: type,
      title: titleInput.value.trim(),
      message: bodyInput.value.trim(),
      metadata: JSON.stringify(metadata, null, 2)
    };

    try {
      await emailjsSend(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailData
      );

      closeFeedbackModal();
      alert("Thank you! Your feedback was submitted.");

    } catch (err) {
      console.error("Feedback submission failed:", err);
      alert("Failed to submit feedback. Please try again later.");
    } finally {
      // Re-enable button & hide spinner
      submitBtn.disabled = false;
      submitText.textContent = "Submit";
      spinner.classList.add("hidden");
    }
  });
}

function closeFeedbackModal() {
  if (modal) {
    modal.remove();
    modal = null;
  }
}