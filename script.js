(() => {
    const $ = id => document.getElementById(id);

    const read = (key, fallback = []) => {
        try {
            return JSON.parse(localStorage.getItem("planner_" + key)) ?? fallback;
        } catch {
            return fallback;
        }
    };

    const save = (key, value) =>
        localStorage.setItem("planner_" + key, JSON.stringify(value));

    let tasks = read("tasks"),
        subjects = read("subjects"),
        slots = read("slots"),
        exams = read("exams"),
        reminders = read("reminders"),
        results = read("results"),
        resources = read("resources");

    let user = read("user", null);

    let taskChart = null,
        progressChart = null,
        resultChart = null;

    const today = new Date().toISOString().slice(0, 10);

    ["task-date", "exam-date", "reminder-date"].forEach(id => {
        $(id).min = today;
    });

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[c]));
    }

    function persist() {
        save("tasks", tasks);
        save("subjects", subjects);
        save("slots", slots);
        save("exams", exams);
        save("reminders", reminders);
        save("results", results);
        save("resources", resources);
    }

    function showApp() {
        $("auth-modal").classList.add("hidden");
        $("app-container").classList.remove("hidden");

        if (user) {
            $("welcome-heading").textContent = "Welcome, " + user.name + " 👋";
            $("profile-name").textContent = user.name;
            $("profile-email").textContent = user.email;
            $("profile-course").textContent = user.course;
            $("profile-prn").textContent = user.prn;
        }

        renderAll();
    }

    $("login-form").addEventListener("submit", e => {
        e.preventDefault();

        user = {
            name: $("login-name").value.trim(),
            course: $("login-course").value.trim(),
            prn: $("login-prn").value.trim(),
            mobileNumber : document.getElementById("mobile-number").value.trim(),
            email: $("login-email").value.trim()
        };

        save("user", user);
        showApp();
    });

    $("logout-btn").addEventListener("click", () => {
        $("app-container").classList.add("hidden");
        $("auth-modal").classList.remove("hidden");
    });

    if (user) showApp();

    function switchTab(name) {
        const selectedTab = $("tab-" + name);

        if (!selectedTab) return;

        document.querySelectorAll(".tab-content").forEach(el =>
            el.classList.add("hidden")
        );

        selectedTab.classList.remove("hidden");

        document.querySelectorAll(".nav-item").forEach(el => {
            const isActive = el.dataset.tab === name;
            el.classList.toggle("active", isActive);
            el.setAttribute("aria-current", isActive ? "page" : "false");
        });

        if (name === "results") renderResults();
        if (name === "overview") renderOverview();
    }

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.type = "button";
        btn.setAttribute("aria-current", btn.classList.contains("active") ? "page" : "false");
        btn.addEventListener("click", () =>
            switchTab(btn.dataset.tab)
        );
    });

    // THEME: remember the selected mode and apply it on every page load
    function setTheme(dark) {
        $("body").classList.toggle("dark-mode", dark);

        $("theme-btn").innerHTML = dark
            ? '<i class="fa-solid fa-sun text-amber-400"></i> Light Mode'
            : '<i class="fa-solid fa-moon text-amber-500"></i> Dark Mode';

        localStorage.setItem("planner_theme", dark ? "dark" : "light");

        if (typeof renderOverview === "function") renderOverview();

        if (typeof renderResults === "function") {
            if (!$("tab-results").classList.contains("hidden")) renderResults();
        }
    }

    setTheme(localStorage.getItem("planner_theme") === "dark");

    $("theme-btn").addEventListener("click", () => {
        const dark = !$("body").classList.contains("dark-mode");
        setTheme(dark);
    });

    $("profile-btn").addEventListener("click", () =>
        $("profile-popup").classList.toggle("hidden")
    );

    document.addEventListener("click", e => {
        if (
            !$("profile-btn").contains(e.target) &&
            !$("profile-popup").contains(e.target)
        ) {
            $("profile-popup").classList.add("hidden");
        }
    });

    // TASKS
    $("task-form").addEventListener("submit", e => {
        e.preventDefault();

        tasks.push({
            id: Date.now(),
            title: $("task-input").value.trim(),
            subject: $("task-subject-select").value,
            date: $("task-date").value,
            done: false
        });

        $("task-form").reset();
        persist();
        renderAll();
    });

    // SUBJECTS
    $("subject-form").addEventListener("submit", e => {
        e.preventDefault();

        const name = $("subject-input").value.trim();

        if (subjects.some(s => s.toLowerCase() === name.toLowerCase())) {
            return alert("This subject already exists.");
        }

        subjects.push(name);

        $("subject-form").reset();
        persist();
        renderAll();
    });

    // TIMETABLE
    $("slot-form").addEventListener("submit", e => {
        e.preventDefault();

        if ($("time-to").value <= $("time-from").value) {
            return alert("End time must be later than start time.");
        }

        slots.push({
            id: Date.now(),
            from: $("time-from").value,
            to: $("time-to").value,
            title: $("slot-title").value.trim()
        });

        $("slot-form").reset();
        persist();
        renderAll();
    });

    // EXAM TRACKER
    $("exam-form").addEventListener("submit", e => {
        e.preventDefault();

        exams.push({
            id: Date.now(),
            name: $("exam-name").value.trim(),
            subject: $("exam-subject").value.trim(),
            date: $("exam-date").value
        });

        $("exam-form").reset();
        persist();
        renderAll();
    });
        // REMINDERS
    $("reminder-form").addEventListener("submit", e => {
        e.preventDefault();

        const when = new Date(
            $("reminder-date").value + "T" + $("reminder-time").value
        );

        if (when.getTime() <= Date.now()) {
            return alert("Please choose a future date and time.");
        }

        reminders.push({
            id: Date.now(),
            title: $("reminder-title").value.trim(),
            date: $("reminder-date").value,
            time: $("reminder-time").value,
            notified: false
        });

        $("reminder-form").reset();
        persist();
        renderAll();

        if (
            "Notification" in window &&
            Notification.permission === "default"
        ) {
            Notification.requestPermission();
        }
    });

    // RESULTS
    $("result-form").addEventListener("submit", e => {
        e.preventDefault();

        const obtained = Number($("result-obtained").value);
        const total = Number($("result-total").value);

        if (total <= 0 || obtained < 0 || obtained > total) {
            return alert(
                "Enter valid marks. Obtained marks must be between 0 and total marks."
            );
        }

        results.push({
            id: Date.now(),
            exam: $("result-exam").value.trim(),
            subject: $("result-subject").value.trim(),
            obtained,
            total
        });

        $("result-form").reset();
        persist();
        renderResults();
    });

    $("result-filter").addEventListener("change", renderResults);

    // RESOURCES
    $("resource-form").addEventListener("submit", e => {
        e.preventDefault();

        resources.push({
            id: Date.now(),
            name: $("resource-name").value.trim(),
            url: $("resource-url").value.trim()
        });

        $("resource-form").reset();
        persist();
        renderResources();
    });

    // DELETE ITEMS
    function removeItem(arrayName, id) {
        const map = {
            tasks,
            slots,
            exams,
            reminders,
            results,
            resources
        };

        const arr = map[arrayName];
        const index = arr.findIndex(item => item.id === id);

        if (index !== -1) arr.splice(index, 1);

        persist();
        renderAll();
    }

    window.removePlannerItem = (name, id) =>
        removeItem(name, Number(id));

    window.toggleTask = id => {
        const task = tasks.find(t => t.id === Number(id));

        if (task) task.done = !task.done;

        persist();
        renderAll();
    };

    // RENDER TASKS
    function renderTasks() {
        $("task-badge").textContent =
            tasks.length + (tasks.length === 1 ? " task" : " tasks");

        $("tasks-list").innerHTML = tasks.length
            ? tasks.map(t => `
                <div class="surface flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border bg-gray-50">

                    <label class="flex items-center gap-3 min-w-0">
                        <input type="checkbox"
                            ${t.done ? "checked" : ""}
                            onchange="toggleTask(${t.id})">

                        <span class="${t.done ? "line-through text-gray-400" : ""} break-words">
                            ${escapeHTML(t.title)}

                            <small class="block text-gray-400">
                                ${escapeHTML(t.subject || "No subject")}
                                ${t.date ? " • " + escapeHTML(t.date) : ""}
                            </small>
                        </span>
                    </label>

                    <button onclick="removePlannerItem('tasks',${t.id})"
                        class="text-red-500 px-2"
                        aria-label="Delete task">
                        <i class="fa-solid fa-trash"></i>
                    </button>

                </div>
            `).join("")
            : '<p class="text-sm text-gray-400 py-3">Add your first study task!</p>';
    }

    // RENDER SUBJECTS
    function renderSubjects() {
        $("subjects-list").innerHTML = subjects.length
            ? subjects.map((s, i) => `
                <div class="surface border rounded-xl p-4 flex justify-between items-center">
                    <span>
                        <i class="fa-solid fa-book text-purple-500 mr-2"></i>
                        ${escapeHTML(s)}
                    </span>

                    <button onclick="removeSubject(${i})"
                        class="text-red-500">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `).join("")
            : '<p class="text-sm text-gray-400">Add subjects to organise your tasks.</p>';

        $("task-subject-select").innerHTML =
            '<option value="">No subject</option>' +
            subjects.map(s =>
                `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`
            ).join("");
    }

    window.removeSubject = i => {
        if (!confirm("Delete this subject? Existing tasks will remain.")) {
            return;
        }

        subjects.splice(i, 1);
        persist();
        renderAll();
    };

    // RENDER TIMETABLE
    function renderSlots() {
        slots.sort((a, b) => a.from.localeCompare(b.from));

        $("timetable-list").innerHTML = slots.length
            ? slots.map(s => `
                <div class="surface border rounded-xl p-4 flex justify-between items-center gap-3">

                    <div>
                        <span class="text-blue-600 font-semibold">
                            ${escapeHTML(s.from)} – ${escapeHTML(s.to)}
                        </span>

                        <p class="font-medium">
                            ${escapeHTML(s.title)}
                        </p>
                    </div>

                    <button onclick="removePlannerItem('slots',${s.id})"
                        class="text-red-500">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                                    </div>
            `).join("")
            : '<p class="text-sm text-gray-400">No slots scheduled yet.</p>';
    }

    // DAYS UNTIL EXAM
    function daysUntil(date) {
        const target = new Date(date + "T00:00:00");

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        return Math.ceil((target - start) / 86400000);
    }

    // RENDER EXAMS
    function renderExams() {
        exams.sort((a, b) => a.date.localeCompare(b.date));

        $("exams-list").innerHTML = exams.length
            ? exams.map(x => {
                const days = daysUntil(x.date);

                const label = days < 0
                    ? "Exam date passed"
                    : days === 0
                    ? "Exam is today!"
                    : `${days} day${days === 1 ? "" : "s"} remaining`;

                return `
                    <div class="surface border rounded-2xl p-5">

                        <div class="flex justify-between gap-3">

                            <div>
                                <p class="text-xs uppercase text-gray-400">
                                    ${escapeHTML(x.subject)}
                                </p>

                                <h3 class="font-bold text-lg">
                                    ${escapeHTML(x.name)}
                                </h3>

                                <p class="text-sm text-gray-500 mt-1">
                                    ${escapeHTML(x.date)}
                                </p>
                            </div>

                            <button onclick="removePlannerItem('exams',${x.id})"
                                class="text-red-500">
                                <i class="fa-solid fa-trash"></i>
                            </button>

                        </div>

                        <div class="mt-4 bg-blue-50 text-blue-700 rounded-xl p-3 font-semibold">
                            ${label}
                        </div>

                    </div>
                `;
            }).join("")
            : '<p class="text-sm text-gray-400">No exams added yet.</p>';

        const upcoming = exams
            .filter(x => daysUntil(x.date) >= 0)
            .slice(0, 4);

        $("overview-exams").innerHTML = upcoming.length
            ? upcoming.map(x => `
                <div class="flex justify-between border-b py-2 gap-3">
                    <span>
                        ${escapeHTML(x.name)}
                        <small class="text-gray-400">
                            (${escapeHTML(x.subject)})
                        </small>
                    </span>

                    <strong>${daysUntil(x.date)} days</strong>
                </div>
            `).join("")
            : "No upcoming exams.";
    }

    // RENDER REMINDERS
    function renderReminders() {
        reminders.sort((a, b) =>
            (a.date + a.time).localeCompare(b.date + b.time)
        );

        $("reminders-list").innerHTML = reminders.length
            ? reminders.map(r => {
                const passed =
                    new Date(r.date + "T" + r.time).getTime() < Date.now();

                return `
                    <div class="surface border rounded-xl p-4 flex justify-between items-center gap-3">

                        <div>
                            <p class="font-semibold">
                                ${escapeHTML(r.title)}
                            </p>

                            <p class="text-sm text-gray-500">
                                ${escapeHTML(r.date)} at ${escapeHTML(r.time)}
                                ${passed ? "• Time passed" : ""}
                            </p>
                        </div>

                        <button onclick="removePlannerItem('reminders',${r.id})"
                            class="text-red-500">
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>
                `;
            }).join("")
            : '<p class="text-sm text-gray-400">No reminders set yet.</p>';
    }

    // RENDER RESOURCES
    function renderResources() {
        $("resources-list").innerHTML = resources.length
            ? resources.map(r => `
                <div class="surface border rounded-xl p-4 flex justify-between items-center gap-3">

                    <a class="text-blue-600 font-medium break-all"
                        href="${escapeHTML(r.url)}"
                        target="_blank"
                        rel="noopener noreferrer">

                        <i class="fa-solid fa-link mr-2"></i>
                        ${escapeHTML(r.name)}

                    </a>

                    <button onclick="removePlannerItem('resources',${r.id})"
                        class="text-red-500">
                        <i class="fa-solid fa-trash"></i>
                    </button>

                </div>
            `).join("")
            : '<p class="text-sm text-gray-400">No resource links added yet.</p>';
    }

    // OVERVIEW DASHBOARD
    function renderOverview() {
        const completed = tasks.filter(t => t.done).length;
        const pending = tasks.length - completed;

        const pct = tasks.length
            ? Math.round(completed / tasks.length * 100)
            : 0;

        $("stat-completed").textContent = completed;
        $("stat-total").textContent = tasks.length + " total tasks";
        $("stat-subjects").textContent = subjects.length;

        $("stat-exams").textContent =
            exams.filter(x => daysUntil(x.date) >= 0).length;

        $("stat-progress").textContent = pct + "%";
        $("progress-bar").style.width = pct + "%";

        if (typeof Chart === "undefined") return;

        const textColor = $("body").classList.contains("dark-mode")
            ? "#e2e8f0"
            : "#475569";

        if (taskChart) taskChart.destroy();

        taskChart = new Chart($("task-chart"), {
            type: "doughnut",

            data: {
                labels: ["Completed", "Pending"],

                datasets: [{
                    data: [completed, pending],
                    backgroundColor: ["#22c55e", "#cbd5e1"],
                    borderWidth: 0
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: textColor }
                    }
                }
            }
        });

        if (progressChart) progressChart.destroy();

        progressChart = new Chart($("progress-chart"), {
            type: "bar",

            data: {
                labels: ["Task completion"],

                datasets: [{
                    label: "Progress (%)",
                    data: [pct],
                    backgroundColor: "#3b82f6",
                    borderRadius: 8
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y",

                scales: {
                    x: {
                        min: 0,
                        max: 100,
                        ticks: { color: textColor },
                        grid: { color: "rgba(148,163,184,.2)" }
                    },

                    y: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                },

                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
        // RESULTS REPORT
    function renderResults() {
        const filter = $("result-filter").value || "all";

        const examNames = [...new Set(results.map(r => r.exam))];

        $("result-filter").innerHTML =
            '<option value="all">All exams</option>' +
            examNames.map(n =>
                `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`
            ).join("");

        $("result-filter").value =
            examNames.includes(filter) ? filter : "all";

        const selected = filter === "all"
            ? results
            : results.filter(r => r.exam === filter);

        const obtained = selected.reduce(
            (sum, r) => sum + r.obtained, 0
        );

        const maximum = selected.reduce(
            (sum, r) => sum + r.total, 0
        );

        $("result-obtained-total").textContent = obtained;
        $("result-maximum-total").textContent = maximum;

        $("result-percentage").textContent =
            (maximum ? (obtained / maximum * 100).toFixed(1) : "0.0") + "%";

        $("results-list").innerHTML = selected.length
            ? `
                <table class="w-full text-sm text-left">

                    <thead>
                        <tr class="border-b text-gray-500">
                            <th class="p-3">Exam</th>
                            <th class="p-3">Subject</th>
                            <th class="p-3">Obtained</th>
                            <th class="p-3">Out of</th>
                            <th class="p-3">Percentage</th>
                            <th class="p-3">Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${selected.map(r => `
                            <tr class="border-b">

                                <td class="p-3">${escapeHTML(r.exam)}</td>
                                <td class="p-3">${escapeHTML(r.subject)}</td>
                                <td class="p-3">${r.obtained}</td>
                                <td class="p-3">${r.total}</td>

                                <td class="p-3 font-semibold">
                                    ${(r.obtained / r.total * 100).toFixed(1)}%
                                </td>

                                <td class="p-3">
                                    <button onclick="removePlannerItem('results',${r.id})"
                                        class="text-red-500">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </td>

                            </tr>
                        `).join("")}
                    </tbody>

                </table>
            `
            : '<p class="text-sm text-gray-400 py-4">No marks entered for this selection.</p>';

        if (resultChart) resultChart.destroy();

        if (typeof Chart !== "undefined") {
            const color = $("body").classList.contains("dark-mode")
                ? "#e2e8f0"
                : "#475569";

            resultChart = new Chart($("result-chart"), {
                type: "bar",

                data: {
                    labels: selected.map(r => r.subject),

                    datasets: [{
                        label: "Marks (%)",

                        data: selected.map(r =>
                            Number((r.obtained / r.total * 100).toFixed(1))
                        ),

                        backgroundColor: "#8b5cf6",
                        borderRadius: 6
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { color },
                            grid: { color: "rgba(148,163,184,.2)" }
                        },

                        x: {
                            ticks: { color },
                            grid: { display: false }
                        }
                    },

                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    }

    // RENDER ALL
    function renderAll() {
        renderSubjects();
        renderTasks();
        renderSlots();
        renderExams();
        renderReminders();
        renderResources();
        renderOverview();

        if (!$("tab-results").classList.contains("hidden")) {
            renderResults();
        }
    }

    // REMINDER ALERTS
    function checkReminders() {
        const now = Date.now();

        reminders.forEach(r => {
            const time = new Date(
                r.date + "T" + r.time
            ).getTime();

            if (
                !r.notified &&
                time <= now &&
                time > now - 60000
            ) {
                alert("Reminder: " + r.title);

                if (
                    "Notification" in window &&
                    Notification.permission === "granted"
                ) {
                    new Notification("Study Planner Reminder", {
                        body: r.title
                    });
                }

                r.notified = true;

                persist();
                renderReminders();
            }
        });
    }

    setInterval(checkReminders, 15000);

    renderAll();

})();