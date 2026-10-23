
/* SYPLab schedule management — Supabase v2 */

const SUPABASE_URL = "https://gbsjyqpmyqjdlonovrnx.supabase.co";
const SUPABASE_KEY = "sb_publishable_eryywsqnvT0JmQS-Fdv7zA_pSxTMfI7";

const ADMIN_UID = "8e90bbbb-adac-4ab7-8c82-10e36a0725d9";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const configs = {
    meeting: {
        title: "Team Meeting",
        fields: ["Date", "Presenter 1", "Presenter 2"],
        keys: ["start_date", "person_1", "person_2"]
    },
    cleaning: {
        title: "Cleaning Schedule",
        fields: ["Start Date", "End Date", "Student"],
        keys: ["start_date", "end_date", "person_1"]
    },
    fist: {
        title: "FIST危废处理",
        fields: ["Start Date", "End Date", "Student / Time"],
        keys: ["start_date", "end_date", "person_1"]
    }
};

let currentUser = null;
let entries = [];

const $ = (selector, root = document) =>
    root.querySelector(selector);

const make = (tag, className = "", text = "") => {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
};

const isAdmin = () => currentUser?.id === ADMIN_UID;

function getCard(category) {
    return [...document.querySelectorAll(".schedule-card")]
        .find(card =>
            $("h3", card)?.textContent.trim() === configs[category].title
        );
}

function formatDate(value) {
    return value ? value.replaceAll("-", "/") : "—";
}

function showMessage(message) {
    $("#schedule-message").textContent = message;
}

function renderTables() {
    for (const [category, config] of Object.entries(configs)) {
        const card = getCard(category);
        if (!card) continue;

        const table = $(".syplab-table", card);
        const thead = $("thead", table);
        const tbody = $("tbody", table);
        const records = entries
            .filter(x => x.category === category)
            .sort((a, b) => {
                if (category === "meeting") {
                    // Team Meeting：最新日期在最上面
                    return b.start_date.localeCompare(a.start_date);
                }

                // Cleaning 和 FIST：最早日期在最上面
                return a.start_date.localeCompare(b.start_date);
            });

        // 只在管理员登录后显示操作列
        thead.replaceChildren();
        const headerRow = make("tr");

        for (const field of config.fields) {
            headerRow.append(make("th", "", field));
        }

        if (isAdmin()) {
            headerRow.append(make("th", "", "Actions"));
        }

        thead.append(headerRow);
        tbody.replaceChildren();

        for (const record of records) {
            const tr = make("tr");

            for (const key of config.keys) {
                const value = key.endsWith("_date")
                    ? formatDate(record[key])
                    : (record[key] || "—");

                tr.append(make("td", "", value));
            }

            if (isAdmin()) {
                const td = make("td", "schedule-actions");

                const edit = make("button", "schedule-btn", "Edit");
                edit.type = "button";
                edit.onclick = () => openEditor(category, record);

                const del = make("button", "schedule-btn danger", "Delete");
                del.type = "button";
                del.onclick = () => deleteEntry(record);

                td.append(edit, del);
                tr.append(td);
            }

            tbody.append(tr);
        }

        if (!records.length) {
            const tr = make("tr");
            const td = make("td", "", "No records yet.");
            td.colSpan = config.fields.length + (isAdmin() ? 1 : 0);
            tr.append(td);
            tbody.append(tr);
        }

        const count = $(".meeting-count", card);
        if (count) count.textContent = `${records.length} Records`;

        let add = $(".schedule-add", card);

        if (isAdmin()) {
            if (!add) {
                add = make("button", "schedule-btn schedule-add", "+ Add");
                add.type = "button";
                $(".schedule-heading", card).append(add);
            }
            add.onclick = () => openEditor(category);
        } else {
            add?.remove();
        }
    }
}

async function loadEntries() {
    const { data, error } = await db
        .from("schedule_entries")
        .select("*")
        .order("start_date", { ascending: false })
        .order("id", { ascending: true });

    if (error) {
        // 保留原 HTML 数据，避免网络故障时显示空白表格
        showMessage("无法连接日程数据库：" + error.message);
        return;
    }

    entries = data || [];
    renderTables();
    showMessage("已更新");
}

function createEditor() {
    const dialog = make("dialog", "schedule-dialog");
    dialog.id = "schedule-editor";

    dialog.innerHTML = `
      <form id="schedule-edit-form" class="schedule-form">
        <h3 id="schedule-editor-title">Add Record</h3>

        <label id="schedule-label-1"></label>
        <input id="schedule-field-1" required>

        <label id="schedule-label-2"></label>
        <input id="schedule-field-2" required>

        <label id="schedule-label-3"></label>
        <input id="schedule-field-3" required maxlength="200">

        <div class="schedule-form-actions">
          <button type="button" id="schedule-cancel">Cancel</button>
          <button type="submit" id="schedule-save">Save</button>
        </div>
        <p id="schedule-editor-error" role="alert"></p>
      </form>
    `;

    document.body.append(dialog);

    $("#schedule-cancel").onclick = () => dialog.close();
}

function openEditor(category, record = null) {
    if (!isAdmin()) return;

    const config = configs[category];
    const dialog = $("#schedule-editor");
    const form = $("#schedule-edit-form");

    form.dataset.category = category;
    form.dataset.id = record ? String(record.id) : "";

    $("#schedule-editor-title").textContent =
        `${record ? "Edit" : "Add"} · ${config.title}`;

    config.fields.forEach((label, i) => {
        const input = $(`#schedule-field-${i + 1}`);
        $(`#schedule-label-${i + 1}`).textContent = label;

        input.type = config.keys[i].endsWith("_date") ? "date" : "text";
        input.maxLength = 200;
        input.required = !(category === "meeting" && i === 2);
        input.value = record?.[config.keys[i]] || "";
    });

    $("#schedule-editor-error").textContent = "";
    dialog.showModal();
}

async function saveEntry(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const form = event.currentTarget;
    const category = form.dataset.category;
    const config = configs[category];
    const id = form.dataset.id;

    const payload = { category };

    config.keys.forEach((key, i) => {
        const value = $(`#schedule-field-${i + 1}`).value.trim();
        payload[key] = value || null;
    });

    if (!payload.start_date ||
        !payload.person_1 ||
        (payload.end_date && payload.end_date < payload.start_date)) {
        $("#schedule-editor-error").textContent =
            "请填写必填项，并确认结束日期不早于开始日期。";
        return;
    }

    const saveButton = $("#schedule-save");
    saveButton.disabled = true;

    let result;

    if (id) {
        result = await db.from("schedule_entries")
            .update(payload)
            .eq("id", Number(id));
    } else {
        result = await db.from("schedule_entries")
            .insert(payload);
    }

    saveButton.disabled = false;

    if (result.error) {
        $("#schedule-editor-error").textContent = result.error.message;
        return;
    }

    $("#schedule-editor").close();
    await loadEntries();
}

async function deleteEntry(record) {
    if (!isAdmin()) return;

    if (!confirm("确定删除这条日程记录吗？此操作无法撤销。")) {
        return;
    }

    const { error } = await db.from("schedule_entries")
        .delete()
        .eq("id", record.id);

    if (error) {
        showMessage("删除失败：" + error.message);
        return;
    }

    await loadEntries();
}

function createAdminPanel() {
    const section = $("#list");
    const panel = make("div", "schedule-admin-panel");


    panel.innerHTML = `
  <details class="admin-disclosure" id="admin-disclosure">
    <summary class="admin-trigger">
      <span class="admin-trigger-icon">⌘</span>
      <span class="admin-trigger-text">
        <strong>Admin Access</strong>
        <small>Authorized personnel only</small>
      </span>
      <span class="admin-chevron"></span>
    </summary>

    <div class="admin-expand-content">
      <div class="admin-divider"></div>

      <p class="admin-description">
        Sign in to manage SYPLab schedules and records.
      </p>

      <form id="schedule-login-form" class="admin-login-form">
        <div class="admin-input-group">
          <label for="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            placeholder="Enter your email"
            autocomplete="username"
            required
          >
        </div>

        <div class="admin-input-group">
          <label for="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            placeholder="Enter your password"
            autocomplete="current-password"
            required
          >
        </div>

        <button type="submit" class="admin-login-button">
          Sign in <span aria-hidden="true">→</span>
        </button>
      </form>
    </div>
  </details>

  <div id="schedule-admin-logged"
       class="admin-logged-panel"
       hidden>
    <span class="admin-status-indicator"></span>
    <span class="admin-logged-text">
      <strong>Administrator</strong>
      <small>Schedule editing enabled</small>
    </span>

    <button id="schedule-logout"
            type="button"
            class="admin-logout-button">
      Log out
    </button>
  </div>

  <p id="schedule-message" role="status"></p>
`;


    section.append(panel);

    $("#schedule-login-form").addEventListener("submit", async event => {
        event.preventDefault();

        const email = $("#admin-email").value.trim();
        const password = $("#admin-password").value;

        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        // 尽快清除表单中的密码
        $("#admin-password").value = "";

        if (error) {
            showMessage("登录失败：" + error.message);
            return;
        }

        currentUser = data.user;
        updateLoginUI();
        await loadEntries();
    });

    $("#schedule-logout").onclick = async () => {
        const { error } = await db.auth.signOut();
        if (error) {
            showMessage("退出失败：" + error.message);
            return;
        }
        currentUser = null;
        updateLoginUI();
        await loadEntries();
    };
}


function updateLoginUI() {
    const admin = isAdmin();
    const disclosure = $("#admin-disclosure");

    disclosure.hidden = admin;
    $("#schedule-admin-logged").hidden = !admin;

    // 登录成功后自动折叠登录表单
    if (admin) {
        disclosure.open = false;
        $("#admin-password").value = "";
        showMessage("");
    } else if (currentUser) {
        disclosure.open = true;
        showMessage("当前账号没有管理员权限。");
    }

    renderTables();
}


async function initSchedules() {
    createAdminPanel();
    createEditor();

    $("#schedule-edit-form").addEventListener("submit", saveEntry);

    const { data: { user }, error } = await db.auth.getUser();
    currentUser = error ? null : user;

    updateLoginUI();
    await loadEntries();

    db.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        updateLoginUI();
    });
}

document.addEventListener("DOMContentLoaded", initSchedules);
