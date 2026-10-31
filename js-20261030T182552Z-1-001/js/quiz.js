export default class Quiz {
  constructor(category, difficulty, numberOfQuestions, playerName, type = "") {
    Object.assign(this, {
      category,
      difficulty,
      numberOfQuestions,
      playerName,
      type
    });

    this.score = 0;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.saved = false;
  }

  buildApiUrl() {
    const params = new URLSearchParams({
      amount: this.numberOfQuestions,
      difficulty: this.difficulty
    });

    if (this.category) {
      params.set("category", this.category);
    }

    if (this.type) {
      params.set("type", this.type);
    }

    return `https://opentdb.com/api.php?${params}`;
  }

  async getQuestions() {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);

    try {
      const response = await fetch(this.buildApiUrl(), {
        signal: controller.signal
      });

      if (response.status === 429) {
        throw new Error(
          "Too many requests. Wait 5 seconds and try again."
        );
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load questions. Please try again."
        );
      }

      const data = await response.json();

      if (data.response_code === 1) {
        throw new Error(
          "Not enough questions. Choose fewer questions or another category."
        );
      }

      if (data.response_code === 5) {
        throw new Error(
          "Please wait 5 seconds before trying again."
        );
      }

      if (
        data.response_code !== 0 ||
        !Array.isArray(data.results) ||
        !data.results.length
      ) {
        throw new Error(
          "No questions received. Please change your settings."
        );
      }

      this.questions = data.results;
      this.numberOfQuestions = this.questions.length;

      return this.questions;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Request timed out. Check your connection and try again."
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  incrementScore() {
    this.score++;
  }

  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] || null;
  }

  nextQuestion() {
    this.currentQuestionIndex++;

    return !this.isComplete();
  }

  isComplete() {
    return this.currentQuestionIndex >= this.questions.length;
  }

  getScorePercentage() {
    return Math.round(
      (this.score / this.numberOfQuestions) * 100
    );
  }

  getHighScores() {
    try {
      const scores = JSON.parse(
        localStorage.getItem("quizHighScores") || "[]"
      );

      if (!Array.isArray(scores)) {
        return [];
      }

      return scores
        .filter(score => {
          return (
            score &&
            typeof score.name === "string" &&
            Number.isFinite(score.percentage)
          );
        })
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  isHighScore() {
    const scores = this.getHighScores();

    return (
      scores.length < 10 ||
      this.getScorePercentage() > scores[scores.length - 1].percentage
    );
  }

  saveHighScore() {
    if (this.saved) {
      return true;
    }

    const scores = this.getHighScores();

    scores.push({
      name: this.playerName,
      score: this.score,
      total: this.numberOfQuestions,
      percentage: this.getScorePercentage(),
      difficulty: this.difficulty,
      date: new Date().toISOString()
    });

    scores.sort((a, b) => b.percentage - a.percentage);

    try {
      localStorage.setItem(
        "quizHighScores",
        JSON.stringify(scores.slice(0, 10))
      );

      this.saved = true;

      return true;
    } catch {
      return false;
    }
  }

  endQuiz(container, onRestart) {
    const qualifies = this.isHighScore();
    const saved = this.saveHighScore();

    container.innerHTML = `
      <div class="game-card results-card">
        <h2 class="results-title">Quiz Complete!</h2>

        <p class="results-score-display">
          ${this.score}/${this.numberOfQuestions}
        </p>

        <p class="results-percentage">
          ${this.getScorePercentage()}% Accuracy
        </p>

        ${qualifies && saved
        ? '<div class="new-record-badge">Top 10 Score!</div>'
        : ""
      }

        <div class="leaderboard">
          <h3 class="leaderboard-title">Leaderboard</h3>
          <ul class="leaderboard-list"></ul>
        </div>

        <p class="storage-message"></p>

        <div class="action-buttons">
          <button class="btn-restart">Play Again</button>
        </div>
      </div>
    `;

    this.getHighScores().forEach((score, index) => {
      const item = document.createElement("li");

      item.className = `leaderboard-item ${["gold", "silver", "bronze"][index] || ""
        }`;

      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-name"></span>
        <span class="leaderboard-score">
          ${score.percentage}%
        </span>
      `;

      item.querySelector(".leaderboard-name").textContent = score.name;

      container.querySelector(".leaderboard-list").append(item);
    });

    if (!saved) {
      container.querySelector(".storage-message").textContent =
        "Your score could not be saved in this browser.";
    }

    container
      .querySelector(".btn-restart")
      .addEventListener("click", onRestart);
  }
}