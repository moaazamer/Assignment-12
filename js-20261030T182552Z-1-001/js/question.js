export default class Question {
  constructor(quiz, container, onQuizEnd, sound) {
    this.quiz = quiz;
    this.container = container;
    this.onQuizEnd = onQuizEnd;
    this.sound = sound;

    this.questionData = quiz.getCurrentQuestion();
    this.correctAnswer = this.decodeHtml(
      this.questionData.correct_answer
    );

    this.allAnswers = this.shuffleAnswers();
    this.answered = false;
    this.timeRemaining = 15;
    this.timerInterval = null;
    this.transitionTimeout = null;

    this.keyboardHandler = event => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }

      const button = this.buttons[Number(event.key) - 1];

      if (/^[1-4]$/.test(event.key) && button) {
        event.preventDefault();
        this.checkAnswer(button);
      }
    };
  }

  decodeHtml(text) {
    return new DOMParser()
      .parseFromString(text, "text/html")
      .documentElement.textContent;
  }

  shuffleAnswers() {
    const answers = [
      ...this.questionData.incorrect_answers.map(answer => {
        return this.decodeHtml(answer);
      }),
      this.correctAnswer
    ];

    if (this.questionData.type === "boolean") {
      return ["True", "False"];
    }

    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [answers[i], answers[j]] = [answers[j], answers[i]];
    }

    return answers;
  }

  displayQuestion() {
    const number = this.quiz.currentQuestionIndex + 1;
    const total = this.quiz.numberOfQuestions;

    this.container.innerHTML = `
      <div class="game-card question-card">
        <div class="xp-bar-container">
          <div class="xp-bar-header">
            <span class="xp-label">Progress</span>

            <span class="xp-value">
              Question ${number}/${total}
            </span>
          </div>

          <div class="xp-bar">
            <div
              class="xp-bar-fill"
              style="width: ${(number / total) * 100}%"
            ></div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-badge category"></div>
          <div class="stat-badge difficulty"></div>

          <div class="stat-badge timer">
            <span class="timer-value">15</span>s
          </div>

          <div class="stat-badge counter">
            ${number}/${total}
          </div>
        </div>

        <h2 class="question-text" tabindex="-1"></h2>

        <div class="answers-grid"></div>

        <p class="keyboard-hint">
          Press 1–${this.allAnswers.length} to select
        </p>

        <p class="feedback" role="status"></p>

        <div class="score-panel">
          <div class="score-item">
            <div class="score-item-label">Score</div>

            <div class="score-item-value">
              ${this.quiz.score}
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector(".question-text").textContent =
      this.decodeHtml(this.questionData.question);

    this.container.querySelector(".category").textContent =
      this.decodeHtml(this.questionData.category);

    const difficulty = this.container.querySelector(".difficulty");

    difficulty.textContent = this.questionData.difficulty;

    if (
      ["easy", "medium", "hard"].includes(this.questionData.difficulty)
    ) {
      difficulty.classList.add(this.questionData.difficulty);
    }

    this.buttons = this.allAnswers.map((answer, index) => {
      const button = document.createElement("button");

      button.className = "answer-btn";
      button.dataset.answer = answer;

      button.innerHTML = `
        <span class="answer-key">${index + 1}</span>
        <span class="answer-text"></span>
      `;

      button.querySelector(".answer-text").textContent = answer;

      button.addEventListener("click", () => {
        this.checkAnswer(button);
      });

      this.container.querySelector(".answers-grid").append(button);

      return button;
    });

    document.addEventListener("keydown", this.keyboardHandler);

    this.container.querySelector(".question-text").focus({
      preventScroll: true
    });

    this.startTimer();
  }

  startTimer() {
    this.deadline = Date.now() + 15000;

    this.timerInterval = setInterval(() => {
      this.timeRemaining = Math.max(
        0,
        Math.ceil((this.deadline - Date.now()) / 1000)
      );

      this.container.querySelector(".timer-value").textContent =
        this.timeRemaining;

      this.container.querySelector(".timer").classList.toggle(
        "warning",
        this.timeRemaining <= 5
      );

      if (this.timeRemaining === 0) {
        this.handleTimeUp();
      }
    }, 200);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  removeEventListeners() {
    document.removeEventListener("keydown", this.keyboardHandler);
  }

  lockAnswers() {
    this.answered = true;

    this.stopTimer();
    this.removeEventListeners();

    this.buttons.forEach(button => {
      button.disabled = true;
    });
  }

  highlightCorrectAnswer() {
    this.buttons.forEach(button => {
      if (button.dataset.answer === this.correctAnswer) {
        button.classList.add("correct-reveal");
      } else if (!button.classList.contains("wrong")) {
        button.classList.add("disabled");
      }
    });
  }

  handleTimeUp() {
    if (this.answered) {
      return;
    }

    this.lockAnswers();
    this.highlightCorrectAnswer();

    const feedback = this.container.querySelector(".feedback");

    feedback.classList.add("time-up-message");
    feedback.textContent = "Time's up!";

    this.sound.play(false);
    this.animateQuestion();
  }

  checkAnswer(button) {
    if (this.answered) {
      return;
    }

    if (Date.now() >= this.deadline) {
      this.handleTimeUp();
      return;
    }

    this.lockAnswers();

    const correct = button.dataset.answer === this.correctAnswer;

    button.classList.add(correct ? "correct" : "wrong");

    if (correct) {
      this.quiz.incrementScore();
    }

    this.highlightCorrectAnswer();

    this.container.querySelector(".score-item-value").textContent =
      this.quiz.score;

    this.container.querySelector(".feedback").textContent = correct
      ? "Correct! +1 point"
      : "Incorrect — the correct answer is highlighted.";

    this.sound.play(correct);
    this.animateQuestion();
  }

  animateQuestion() {
    this.transitionTimeout = setTimeout(() => {
      this.container.querySelector(".question-card").classList.add("exit");

      this.transitionTimeout = setTimeout(() => {
        this.getNextQuestion();
      }, 400);
    }, 1500);
  }

  getNextQuestion() {
    this.destroy();

    if (this.quiz.nextQuestion()) {
      new Question(
        this.quiz,
        this.container,
        this.onQuizEnd,
        this.sound
      ).displayQuestion();
    } else {
      this.quiz.endQuiz(this.container, this.onQuizEnd);
    }
  }

  destroy() {
    this.stopTimer();
    this.removeEventListeners();
    clearTimeout(this.transitionTimeout);
  }
}