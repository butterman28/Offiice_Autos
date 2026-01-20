// ./assets/components/feedback.js

// ✅ CONFIG — Replace these with your EmailJS values
const EMAILJS_USER_ID = "YOUR_EMAILJS_USER_ID";        // e.g. "user_xxxxxx"
const EMAILJS_SERVICE_ID = "YOUR_EMAILJS_SERVICE_ID";  // e.g. "service_gmail"
const EMAILJS_TEMPLATE_ID = "YOUR_EMAILJS_TEMPLATE_ID"; // e.g. "template_feedback"
const YOUR_EMAIL = "youremail@gmail.com";             // 👈 where feedback goes

// ✅ Use the NEW official package
import { init as emailjsInit, send as emailjsSend } from '@emailjs/browser';

// Initialize once
emailjsInit(EMAILJS_USER_ID);

let modal;

// 👇 Keep your existing createFeedbackModal() exactly as-is
export function createFeedbackModal() {
  const wrapper = document.createElement("div");
  wrapper.id = "feedbackModal";
  wrapper.className =
    "fixed inset-0 bg-black/50 flex items-center justify-center z-50";

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

        <!-- Optional attachments (URLs or identifiers) -->
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

          <button
            type="submit"
            class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(wrapper);
  return wrapper;
}

// 👇 Keep your openFeedbackModal() structure — only change the submit handler
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

  // ✅ ONLY THIS PART CHANGES: replace Supabase with EmailJS
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    // ✅ Prepare email content (preserve your structure)
    const emailData = {
      to_email: YOUR_EMAIL,
      feedback_type: type,
      title: titleInput.value.trim(),
      message: bodyInput.value.trim(),
      metadata: JSON.stringify(metadata, null, 2)
    };

    try {
      // ✅ Send via EmailJS (no Supabase!)
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
    }
  });
}

function closeFeedbackModal() {
  if (modal) {
    modal.remove();
    modal = null;
  }
}