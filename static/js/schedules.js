
/* SYPLab schedule management — Supabase v2 */

const SUPABASE_URL = "https://gbsjyqpmyqjdlonovrnx.supabase.co";
const SUPABASE_KEY = "sb_publishable_eryywsqnvT0JmQS-Fdv7zA_pSxTMfI7";

// 允许的行高亮颜色（存入数据库的值）
const HIGHLIGHT = "#eaf1f6";   // 主题色：本周 / 当前
const NOTE = "#fff6dc";        // 次要色：备注

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

// Today as YYYY-MM-DD in the visitor's local time
function todayString() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(value) {
    return value ? value.replaceAll("-", "/") : "—";
}

function showMessage(message) {
    $("#schedule-message").textContent = message;
}

function renderTables() {
    const today = todayString();

    for (const [category, config] of Object.entries(configs)) {
        const card = getCard(category);
        if (!card) continue;

        const table = $(".syplab-table", card);
        const thead = $("thead", table);
        const tbody = $("tbody", table);
        const records = entries
            .filter(x => x.category === category)
            .sort((a, b) => {
                return b.start_date.localeCompare(a.start_date);
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

            // 根据 Supabase 中保存的颜色设置整行高亮
            if (record.row_color) {
                // 旧记录里的任意颜色（例如原来的黄色）统一显示为主题色
                tr.classList.add(record.row_color === NOTE ? "is-note" : "is-highlight");
            } else if ((record.end_date || record.start_date) < today) {
                // 已经过去的安排显示为浅灰色
                tr.classList.add("is-past");
            }

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
        if (count) count.textContent = `${records.length} ${records.length === 1 ? "Record" : "Records"}`;

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
    showMessage("");
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
        <label for="schedule-row-color">Row highlight</label>
        <select id="schedule-row-color">
            <option value="">None</option>
            <option value="${HIGHLIGHT}">Current (blue)</option>
            <option value="${NOTE}">Note (amber)</option>
        </select>

        <div class="schedule-form-actions">
          <button type="button" id="schedule-cancel" class="admin-logout-button">Cancel</button>
          <button type="submit" id="schedule-save" class="admin-login-button">Save</button>
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

    const color = record?.row_color;
    $("#schedule-row-color").value =
        !color ? "" : (color === NOTE ? NOTE : HIGHLIGHT);

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
    payload.row_color = $("#schedule-row-color").value || null;

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

// 新记录保存成功后，或旧记录编辑成功后
// 如果启用了高亮，自动清除同一张表中其他行的高亮
    if (!result.error && payload.row_color) {
        const {error: clearError} = await db
            .from("schedule_entries")
            .update({row_color: null})
            .eq("category", category)
            .neq("id", id ? Number(id) : 0)
            .not("row_color", "is", null);

        if (clearError) {
            result.error = clearError;
        }
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

    // 登录后的状态条：放在日程表格上方
    const panel = make("div", "schedule-admin-panel");
    panel.innerHTML = `
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
`;
    section.insertBefore(panel, $(".schedule-section", section));

    // 状态提示仍然放在日程板块末尾
    const message = make("p");
    message.id = "schedule-message";
    message.setAttribute("role", "status");
    section.append(message);

    // 登录弹窗：从页脚的 Admin sign-in 打开
    const dialog = make("dialog", "schedule-dialog admin-dialog");
    dialog.id = "admin-dialog";
    dialog.setAttribute("aria-labelledby", "admin-dialog-title");
    dialog.innerHTML = `
  <h3 id="admin-dialog-title">Admin sign-in</h3>
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

    <p id="admin-login-error" role="alert"></p>

    <div class="schedule-form-actions">
      <button type="button" id="admin-cancel" class="admin-logout-button">Cancel</button>
      <button type="submit" class="admin-login-button">Sign in</button>
    </div>
  </form>
`;
    document.body.append(dialog);

    const loginError = text => {
        $("#admin-login-error").textContent = text;
        showMessage(text);
    };

    $("#admin-open").onclick = () => {
        $("#admin-login-error").textContent = "";
        dialog.showModal();
        $("#admin-email").focus();
    };

    $("#admin-cancel").onclick = () => {
        $("#admin-password").value = "";
        dialog.close();
    };

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
            loginError("登录失败：" + error.message);
            return;
        }

        currentUser = data.user;

        if (!isAdmin()) {
            loginError("当前账号没有管理员权限。");
        } else {
            dialog.close();
        }

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

    $("#schedule-admin-logged").hidden = !admin;
    $("#admin-open").hidden = admin;

    if (admin) {
        $("#admin-password").value = "";
        showMessage("");
    } else if (currentUser) {
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