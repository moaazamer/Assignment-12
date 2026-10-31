import Quiz from "./quiz.js";
import Question from "./question.js";

const quizOptionsForm = document.getElementById("quizOptions");
const playerNameInput = document.getElementById("playerName");
const categoryInput = document.getElementById("categoryMenu");
const difficultyInput = document.getElementById("difficultyOptions");
const questionsNumberInput = document.getElementById("questionsNumber");
const typeInput = document.getElementById("questionType");
const startQuizBtn = document.getElementById("startQuiz");
const questionsContainer = document.getElementById("questionsContainer");

let currentQuiz = null;
let loading = false;

const sound = {
    context: null,

    init() {
        try {
            const AudioContext =
                window.AudioContext || window.webkitAudioContext;

            if (!this.context && AudioContext) {
                this.context = new AudioContext();
            }

            if (this.context?.state === "suspended") {
                this.context.resume().catch(() => { });
            }
        } catch { }
    },

    play(correct) {
        try {
            if (!this.context || this.context.state !== "running") {
                return;
            }

            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            const now = this.context.currentTime;

            oscillator.type = correct ? "sine" : "triangle";

            oscillator.frequency.setValueAtTime(
                correct ? 660 : 220,
                now
            );

            oscillator.frequency.setValueAtTime(
                correct ? 880 : 110,
                now + 0.12
            );

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            oscillator.connect(gain);
            gain.connect(this.context.destination);

            oscillator.start(now);
            oscillator.stop(now + 0.3);

            oscillator.onended = () => {
                oscillator.disconnect();
                gain.disconnect();
            };
        } catch { }
    }
};

function showLoading() {
    questionsContainer.innerHTML = `
    <div class="loading-overlay" role="status">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading Questions...</p>
    </div>
  `;
}

function showFormError(message) {
    quizOptionsForm.querySelector(".form-error")?.remove();

    const error = document.createElement("p");

    error.className = "form-error";
    error.setAttribute("role", "alert");
    error.textContent = message;

    startQuizBtn.before(error);
}

function resetToStart() {
    questionsContainer.replaceChildren();
    quizOptionsForm.classList.remove("hidden");

    currentQuiz = null;

    startQuizBtn.focus();
}

function showError(message) {
    questionsContainer.innerHTML = `
    <div class="game-card error-card">
      <h2 class="error-title">Unable to start</h2>

      <p class="error-message" role="alert"></p>

      <button class="btn-play retry-btn">
        Back to settings
      </button>
    </div>
  `;

    questionsContainer.querySelector(".error-message").textContent =
        message;

    questionsContainer
        .querySelector(".retry-btn")
        .addEventListener("click", resetToStart);
}

async function startQuiz() {
    if (loading) {
        return;
    }

    quizOptionsForm.querySelector(".form-error")?.remove();

    const amount = Number(questionsNumberInput.value);

    if (
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 50
    ) {
        showFormError(
            "Please enter a whole number between 1 and 50."
        );

        return;
    }

    sound.init();

    currentQuiz = new Quiz(
        categoryInput.value,
        difficultyInput.value,
        amount,
        playerNameInput.value.trim() || "Player",
        typeInput.value
    );

    loading = true;
    startQuizBtn.disabled = true;

    quizOptionsForm.classList.add("hidden");

    document.querySelectorAll(".custom-select.open").forEach(select => {
        select.classList.remove("open");
    });

    showLoading();

    try {
        await currentQuiz.getQuestions();

        new Question(
            currentQuiz,
            questionsContainer,
            resetToStart,
            sound
        ).displayQuestion();
    } catch (error) {
        showError(
            error.message === "Failed to fetch"
                ? "Network error. Check your connection and try again."
                : error.message
        );
    } finally {
        loading = false;
        startQuizBtn.disabled = false;
    }
}

startQuizBtn.addEventListener("click", startQuiz);

quizOptionsForm.addEventListener("submit", event => {
    event.preventDefault();
    startQuiz();
});

questionsNumberInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        startQuiz();
    }
});