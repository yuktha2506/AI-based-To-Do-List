// AI Smart To-Do List Application
class AITodoApp {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('aiTodos')) || [];
        this.currentFilter = 'all';

        document.addEventListener("DOMContentLoaded", () => {
            this.requestNotificationPermission();
        });

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderTodos();
        this.updateStats();
        this.loadSampleData();

        // Check reminders every minute (or more frequently for testing)
        setInterval(() => this.checkReminders(), 60000); // 60000 ms = 1 minute
    }

    setupEventListeners() {
        document.getElementById('addBtn').addEventListener('click', () => this.addTodo());
        document.getElementById('todoInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });

        document.getElementById('aiSuggestBtn').addEventListener('click', () => this.showAISuggestions());
        document.getElementById('smartCategorizeBtn').addEventListener('click', () => this.smartCategorize());
        document.getElementById('prioritizeBtn').addEventListener('click', () => this.prioritizeTasks());
        document.getElementById('estimateBtn').addEventListener('click', () => this.estimateTime());
        document.getElementById('insightsBtn').addEventListener('click', () => this.showInsights());

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentFilter = e.target.dataset.filter;
                this.updateFilterButtons();
                this.renderTodos();
            });
        });

        const modal = document.getElementById('aiModal');
        const closeBtn = document.querySelector('.close');
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        document.getElementById('todoList').addEventListener('click', (e) => {
            const target = e.target;
            const listItem = target.closest('.todo-item');
            if (!listItem) return;
            const todoId = parseInt(listItem.dataset.id);

            if (target.classList.contains('delete-btn')) {
                this.deleteTodo(todoId);
            } else if (target.type === 'checkbox') {
                this.toggleComplete(todoId);
            }
        });
    }

    // 🆕 Request notification permission
    requestNotificationPermission() {
        if ('Notification' in window) {
            // Check if permission has not been granted or denied yet
            if (Notification.permission === 'default') {
                // Request permission only after a user interaction
                document.body.addEventListener('click', () => {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            this.showNotification('System notifications are enabled!', 'success');
                        }
                    });
                }, { once: true }); // Use { once: true } to ensure it only runs once
            }
        }
    }

    addTodo() {
        const input = document.getElementById('todoInput');
        const dateInput = document.getElementById('todoDate');
        const text = input.value.trim();
        const dueDate = dateInput.value;

        if (text) {
            const todo = {
                id: Date.now(),
                text,
                completed: false,
                category: this.detectCategory(text),
                priority: this.calculatePriority(text),
                createdAt: new Date().toISOString(),
                estimatedTime: this.estimateTaskTime(text),
                dueDate: dueDate || null
            };

            this.todos.unshift(todo);
            this.saveTodos();
            this.renderTodos();
            this.updateStats();

            input.value = '';
            dateInput.value = '';

            this.showNotification('Task added successfully!', 'success');
            this.showSystemNotification('Task Added', text);
        }
    }

    toggleComplete(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveTodos();
            this.renderTodos();
            this.updateStats();
            this.showNotification(
                todo.completed ? 'Task completed! 🎉' : 'Task marked as pending.', 
                todo.completed ? 'success' : 'info'
            );
        }
    }

    deleteTodo(id) {
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveTodos();
        this.renderTodos();
        this.updateStats();
        this.showNotification('Task deleted.', 'error');
    }

    renderTodos() {
        const todoList = document.getElementById('todoList');
        todoList.innerHTML = '';
        const filteredTodos = this.todos.filter(todo => 
            this.currentFilter === 'all' || todo.category === this.currentFilter
        );

        if (filteredTodos.length === 0) {
            todoList.innerHTML = '<div class="empty-state">No tasks to display! Add a new task above.</div>';
            return;
        }

        filteredTodos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.priority}`;
            li.dataset.id = todo.id;
            
            const dateDisplay = todo.dueDate ? `<span class="due-date"><i class="far fa-calendar-alt"></i> ${todo.dueDate}</span>` : '';
            
            li.innerHTML = `
                <div class="todo-content">
                    <input type="checkbox" ${todo.completed ? 'checked' : ''}>
                    <div class="todo-text-group">
                        <span class="todo-text">${todo.text}</span>
                        <div class="todo-meta">
                            <span class="category-tag">${todo.category}</span>
                            ${dateDisplay}
                        </div>
                    </div>
                </div>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            todoList.appendChild(li);
        });
    }

    updateStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(t => t.completed).length;
        const pending = total - completed;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('pendingTasks').textContent = pending;
    }

    updateFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === this.currentFilter) {
                btn.classList.add('active');
            }
        });
    }

    // 🔹 Detect category based on keywords
    detectCategory(text) {
        const categories = {
            work: ['meeting', 'report', 'email', 'project', 'deadline', 'presentation', 'client', 'office', 'notes'],
            personal: ['family', 'friend', 'birthday', 'anniversary', 'hobby', 'exercise', 'read'],
            shopping: ['buy', 'purchase', 'grocery', 'shopping', 'store', 'market', 'mall'],
            health: ['doctor', 'appointment', 'exercise', 'gym', 'workout', 'medicine', 'health']
        };

        const lowerText = text.toLowerCase();
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                return category;
            }
        }
        return 'personal';
    }

    // 🔹 Priority calculation
    calculatePriority(text) {
        const urgentWords = ['urgent', 'asap', 'emergency', 'deadline', 'important'];
        const lowerText = text.toLowerCase();

        if (urgentWords.some(word => lowerText.includes(word))) return 'high';
        if (lowerText.includes('meeting') || lowerText.includes('appointment')) return 'medium';
        return 'low';
    }

    estimateTaskTime(text) {
        const timeEstimates = {
            meeting: 60, email: 15, call: 30,
            exercise: 45, shopping: 90, reading: 30,
            cooking: 45, cleaning: 60
        };

        const lowerText = text.toLowerCase();
        for (const [keyword, minutes] of Object.entries(timeEstimates)) {
            if (lowerText.includes(keyword)) return minutes;
        }
        return 30;
    }
    
    // 🔹 Heuristic (for GBFS)
    heuristic(task) {
        let score = task.priority === 'high' ? 1 : task.priority === 'medium' ? 5 : 10;
        if (task.dueDate) {
            const today = new Date();
            const due = new Date(task.dueDate);
            const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) score -= 2;
            else if (diffDays <= 2) score -= 1;
        }
        return Math.max(score, 0);
    }

    greedyBestFirstSearch() {
        let openList = [...this.todos];
        let ordered = [];
        while (openList.length > 0) {
            openList.sort((a, b) => this.heuristic(a) - this.heuristic(b));
            ordered.push(openList.shift());
        }
        return ordered;
    }

    prioritizeTasks() {
        if (!this.todos.length) {
            this.showNotification('No tasks to prioritize!', 'info');
            return;
        }
        this.todos = this.greedyBestFirstSearch();
        this.saveTodos();
        this.renderTodos();
        this.showNotification('Tasks prioritized!', 'success');
        this.showSystemNotification('AI Smart To-Do', 'Tasks prioritized successfully!');
    }

    // 🔹 Check reminders
    checkReminders() {
        const today = new Date();
        this.todos.forEach(todo => {
            if (todo.dueDate && !todo.completed) {
                const due = new Date(todo.dueDate);
                const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

                if (diffDays === 3) {
                    this.showNotification(`Reminder: "${todo.text}" is due in 3 days!`, 'warning');
                    this.showSystemNotification('Task Reminder', `${todo.text} is due in 3 days!`);
                }
                if (diffDays === 0) {
                    this.showNotification(`Reminder: "${todo.text}" is due today!`, 'error');
                    this.showSystemNotification('Task Reminder', `${todo.text} is due today!`);
                }
            }
        });
    }

    // 🔹 Save
    saveTodos() {
        localStorage.setItem('aiTodos', JSON.stringify(this.todos));
    }

    // 🔹 In-app notification
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container') 
            || (() => {
                const div = document.createElement('div');
                div.id = 'notification-container';
                div.style.cssText = `position:fixed;top:20px;right:20px;z-index:2000;`;
                document.body.appendChild(div);
                return div;
            })();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            background: ${type === 'success' ? '#28a745' 
                : type === 'error' ? '#dc3545' 
                : type === 'warning' ? '#ffc107' 
                : '#17a2b8'};
            padding: 12px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            margin-bottom: 10px;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            cursor: pointer;
        `;
        notification.textContent = message;

        notification.onclick = () => notification.remove();

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000); // Increased timeout for visibility
    }

    // 🔹 System notification (corrected)
    showSystemNotification(title, message) {
        if (!("Notification" in window)) return;
        
        // Check if permission is granted before trying to create a new notification
        if (Notification.permission === "granted") {
            // Create a new notification. Use an absolute URL for the icon.
            new Notification(title, {
                body: message,
                icon: "/path/to/your/icon.png" // ⚠️ Replace with the correct path to your icon
            });
        } else if (Notification.permission === "denied") {
            // Inform the user that permissions are denied
            console.warn("Notification permission was denied by the user.");
            this.showNotification('System notifications are blocked. Please enable them in your browser settings.', 'warning');
        }
    }

    // 🔹 AI Suggestions (placeholder)
    showAISuggestions() {
        this.showNotification('AI suggestions feature is under development.', 'info');
        const modal = document.getElementById('aiModal');
        const suggestionsList = document.getElementById('aiSuggestions');
        suggestionsList.innerHTML = `
            <ul>
                <li>Plan a workout routine for the week.</li>
                <li>Schedule a weekly team sync-up meeting.</li>
                <li>Create a grocery list based on popular recipes.</li>
            </ul>
        `;
        modal.style.display = 'block';
    }

    // 🔹 Smart Categorize (placeholder)
    smartCategorize() {
        this.showNotification('Categorizing all tasks...', 'info');
        // In a real app, this would re-run detectCategory on all todos
        this.todos.forEach(todo => {
            todo.category = this.detectCategory(todo.text);
        });
        this.saveTodos();
        this.renderTodos();
        this.showNotification('Tasks have been smartly categorized.', 'success');
    }

    // 🔹 Estimate Time (placeholder)
    estimateTime() {
        this.showNotification('Estimating time for all tasks...', 'info');
        this.todos.forEach(todo => {
            todo.estimatedTime = this.estimateTaskTime(todo.text);
        });
        this.saveTodos();
        this.renderTodos();
        this.showNotification('Time estimates updated.', 'success');
    }

    // 🔹 Show Insights (placeholder)
    showInsights() {
        this.showNotification('Productivity insights feature is under development.', 'info');
    }


    // 🔹 Sample data with relative dates
    loadSampleData() {
        if (this.todos.length === 0) {
            const today = new Date();
            const addDays = (d) => {
                const date = new Date();
                date.setDate(today.getDate() + d);
                return date.toISOString().split("T")[0];
            };
            this.todos = [
                { id: 1, text: 'Complete project presentation', completed: false, category: 'work', priority: 'high', createdAt: new Date().toISOString(), estimatedTime: 60, dueDate: addDays(2) },
                { id: 2, text: 'Buy groceries for the week', completed: false, category: 'shopping', priority: 'medium', createdAt: new Date().toISOString(), estimatedTime: 90, dueDate: addDays(4) }
            ];
            this.saveTodos();
            this.renderTodos();
            this.updateStats();
        }
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
.empty-state { text-align:center; padding:40px; color:#6c757d; font-style:italic; }
`;
document.head.appendChild(style);

// Start app
const app = new AITodoApp();
