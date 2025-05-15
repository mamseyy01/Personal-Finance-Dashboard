const apiBase = "http://127.0.0.1:5000";

// Initialize charts
let pieChart, barChart;

// Toggle category dropdowns based on transaction type
function toggleCategoryDropdown() {
  const type = document.getElementById("type").value;
  const incomeCategory = document.getElementById("income-category");
  const expenseCategory = document.getElementById("expense-category");

  if (type === "income") {
    incomeCategory.style.display = "block";
    expenseCategory.style.display = "none";
  } else {
    incomeCategory.style.display = "none";
    expenseCategory.style.display = "block";
  }
}

// Load data on page load
window.onload = () => {
  loadData();
  toggleCategoryDropdown(); // Initialize category dropdown visibility
};

// Load transactions and update UI
function loadData() {
  fetch(`${apiBase}/transactions`)
    .then(res => res.json())
    .then(data => {
      let totalIncome = 0;
      let totalExpense = 0;

      data.forEach(t => {
        if (t.type === "income") totalIncome += t.amount;
        else totalExpense += t.amount;
      });

      document.getElementById("total-income").textContent = `Income: ₦${totalIncome}`;
      document.getElementById("total-expense").textContent = `Expenses: ₦${totalExpense}`;
      const balance = totalIncome - totalExpense;
      document.getElementById("total-balance").textContent = `Balance: ₦${balance}`;

      // Calculate spending by category
      const spendingByCategory = calculateSpendingByCategory(data);
      const budgetPercentages = getBudgetPercentages();
      const budgets = calculateBudgets(totalIncome, budgetPercentages);

      // Update charts
      updatePieChart(spendingByCategory);
      updateBarChart(spendingByCategory, budgets);

      // Generate predictive alerts
      loadAlert(data, balance, totalIncome, budgets);
    });
}

// Calculate spending by category
function calculateSpendingByCategory(transactions) {
  const categories = ["Relationship", "Gadgets", "Online Subscription", "Entertainment", "Groceries"];
  const spending = {};

  categories.forEach(category => {
    spending[category] = transactions
      .filter(t => t.type === "expense" && t.category === category)
      .reduce((sum, t) => sum + t.amount, 0);
  });

  return spending;
}

// Get user-defined budget percentages
function getBudgetPercentages() {
  return {
    "Relationship": parseFloat(document.getElementById("budget-relationship").value) / 100,
    "Gadgets": parseFloat(document.getElementById("budget-gadgets").value) / 100,
    "Online Subscription": parseFloat(document.getElementById("budget-online-subscription").value) / 100,
    "Entertainment": parseFloat(document.getElementById("budget-entertainment").value) / 100,
    "Groceries": parseFloat(document.getElementById("budget-groceries").value) / 100
  };
}

// Calculate budgets based on total income and percentages
function calculateBudgets(totalIncome, budgetPercentages) {
  const budgets = {};
  for (const category in budgetPercentages) {
    budgets[category] = totalIncome * budgetPercentages[category];
  }
  return budgets;
}

// Update pie chart (spending distribution)
function updatePieChart(spendingByCategory) {
  const ctx = document.getElementById("pie-chart").getContext("2d");
  const labels = Object.keys(spendingByCategory);
  const data = Object.values(spendingByCategory);
  const backgroundColors = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderColor: "#1f2a44",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#fff" }
        }
      }
    }
  });
}

// Update bar chart (spending vs budget)
function updateBarChart(spendingByCategory, budgets) {
  const ctx = document.getElementById("bar-chart").getContext("2d");
  const labels = Object.keys(spendingByCategory);
  const spendingData = Object.values(spendingByCategory);
  const budgetData = Object.values(budgets);

  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Spending",
          data: spendingData,
          backgroundColor: "#36A2EB",
          borderColor: "#1f2a44",
          borderWidth: 1
        },
        {
          label: "Budget",
          data: budgetData,
          backgroundColor: "#FF6384",
          borderColor: "#1f2a44",
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#fff" },
          grid: { color: "#3a4565" }
        },
        x: {
          ticks: { color: "#fff" },
          grid: { color: "#3a4565" }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#fff" }
        }
      }
    }
  });
}

// Analyze transactions and generate predictive alerts
function loadAlert(transactions, balance, totalIncome, budgets) {
  const alertBox = document.getElementById("alert-box");
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = 30; // Simplified assumption

  // Collect all alerts
  const alerts = [];

  // 1. Detect upcoming expenses (recurring charges)
  const upcomingExpenses = detectUpcomingExpenses(transactions);
  upcomingExpenses.forEach(expense => {
    const daysUntilDue = estimateDaysUntilNextExpense(expense, currentDay);
    if (daysUntilDue <= 3 && balance < expense.amount) {
      alerts.push({
        message: `An ${expense.category} charge of ₦${expense.amount} is coming up in ${daysUntilDue} day(s), but your balance is low (₦${balance}).`,
        type: "upcoming"
      });
    }
  });

  // 2. Calculate current spending rate and check for over-budget scenarios
  const spendingByCategory = calculateSpendingByCategory(transactions);
  for (const category in budgets) {
    const spending = spendingByCategory[category];
    const budget = budgets[category];

    if (currentDay === daysInMonth) {
      if (spending > budget) {
        alerts.push({
          message: `You’ve exceeded your ₦${Math.round(budget)} ${category} budget by ₦${Math.round(spending - budget)}.`,
          type: "over-budget"
        });
      }
    } else {
      const dailyRate = spending / currentDay;
      const projectedSpending = dailyRate * daysInMonth;
      if (projectedSpending > budget) {
        const daysToExceed = Math.ceil((budget - spending) / dailyRate) + currentDay;
        if (daysToExceed <= daysInMonth) {
          alerts.push({
            message: `You’re spending too much on ${category}; you may exceed your ₦${Math.round(budget)} budget by the ${daysToExceed}th.`,
            type: "over-budget"
          });
        }
      }
    }
  }

  // 3. Predict when the user will run out of money
  if (balance > 0 && transactions.length > 0) {
    const totalExpenses = transactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Find the earliest transaction date to calculate the time period
    const dates = transactions.map(t => new Date(t.date));
    const earliestDate = new Date(Math.min(...dates));
    const timeDiff = today - earliestDate;
    const daysSinceFirstTransaction = Math.max(1, Math.ceil(timeDiff / (1000 * 60 * 60 * 24))); // At least 1 day

    // Calculate daily spending rate
    const dailySpendingRate = totalExpenses / daysSinceFirstTransaction;

    // Project when balance will reach zero
    if (dailySpendingRate > 0) {
      const daysUntilZero = Math.floor(balance / dailySpendingRate);
      if (daysUntilZero > 0) { // Only show if the date is in the future
        const runOutDate = new Date(today);
        runOutDate.setDate(today.getDate() + daysUntilZero);
        const formattedDate = runOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        alerts.push({
          message: `At your current spending rate, you will run out of money by ${formattedDate}.`,
          type: "run-out"
        });
      }
    }
  }

  // Display all alerts as a list
  if (alerts.length === 0) {
    alertBox.innerHTML = '<ul class="alert-list"><li class="default">All good! No spending alerts at this time.</li></ul>';
  } else {
    const alertItems = alerts.map(alert => `<li class="${alert.type}">${alert.message}</li>`).join('');
    alertBox.innerHTML = `<ul class="alert-list">${alertItems}</ul>`;
  }
}

// Helper: Detect upcoming expenses by category
function detectUpcomingExpenses(transactions) {
  const expenses = {};
  transactions.forEach(t => {
    if (t.type === "expense") {
      if (!expenses[t.category]) {
        expenses[t.category] = { count: 0, amount: t.amount, dates: [] };
      }
      expenses[t.category].count += 1;
      expenses[t.category].dates.push(new Date(t.date).getDate());
    }
  });

  return Object.keys(expenses)
    .filter(category => expenses[category].count >= 2)
    .map(category => ({
      category,
      amount: expenses[category].amount,
      dates: expenses[category].dates
    }));
}

// Helper: Estimate days until next expense
function estimateDaysUntilNextExpense(expense, currentDay) {
  const sortedDays = expense.dates.sort((a, b) => a - b);
  const typicalDay = sortedDays[Math.floor(sortedDays.length / 2)]; // Median day
  const daysInMonth = 30;
  return (typicalDay > currentDay) ? typicalDay - currentDay : (typicalDay + daysInMonth) - currentDay;
}

// Handle transaction form submit
document.getElementById("transaction-form").addEventListener("submit", e => {
  e.preventDefault();

  const type = document.getElementById("type").value;
  const category = type === "income" ? document.getElementById("income-category").value : document.getElementById("expense-category").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("date").value;

  fetch(`${apiBase}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, category, amount, date })
  })
  .then(res => res.json())
  .then(() => {
    loadData();
    document.getElementById("transaction-form").reset();
    toggleCategoryDropdown(); // Reset dropdown visibility
  });
});

// Handle budget form submit
document.getElementById("budget-form").addEventListener("submit", e => {
  e.preventDefault();

  // Validate total percentage
  const percentages = [
    parseFloat(document.getElementById("budget-relationship").value),
    parseFloat(document.getElementById("budget-gadgets").value),
    parseFloat(document.getElementById("budget-online-subscription").value),
    parseFloat(document.getElementById("budget-entertainment").value),
    parseFloat(document.getElementById("budget-groceries").value)
  ];

  const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
  if (totalPercentage > 100) {
    alert("Total budget percentages cannot exceed 100%!");
    return;
  }

  // Show save confirmation
  const budgetForm = document.getElementById("budget-form");
  const confirmation = document.createElement("div");
  confirmation.textContent = "Budget Saved!";
  confirmation.style.cssText = `
    position: absolute;
    right: 10px;
    top: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    opacity: 1;
    transition: opacity 0.5s ease;
  `;
  budgetForm.style.position = "relative";
  budgetForm.appendChild(confirmation);

  // Fade out and remove confirmation, then collapse budget section
  setTimeout(() => {
    confirmation.style.opacity = "0";
    setTimeout(() => {
      confirmation.remove();
      const budgetSection = document.getElementById("budget-section");
      if (budgetSection) {
        budgetSection.style.display = "none";
      }
    }, 500);
  }, 1000);

  // Reload data to update charts and alerts with new budgets
  loadData();
});