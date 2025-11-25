// =========================================================
//  ADMIN.JS — Full Admin Logic
//  Works with admin.html (latest version)
// =========================================================

// ---------------------------------------------------------
// SUPABASE INIT
// ---------------------------------------------------------
const SUPABASE_URL = "https://hnymqvkfmythdxtjqeam.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhueW1xdmtmbXl0aGR4dGpxZWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMjE3NTUsImV4cCI6MjA3ODY5Nzc1NX0.4ww5fKNnbhNzNrkJZLa466b6BsKE_yYMO2YH6-auFlI";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ---------------------------------------------------------
// UTILITY HELPERS
// ---------------------------------------------------------
function byId(id) {
  return document.getElementById(id);
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------
// PANEL SWITCHER
// ---------------------------------------------------------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    byId(tab).classList.add("active");
  };
});

// ---------------------------------------------------------
// INITIAL DROPDOWN DATA (Products, Types, Durations)
// ---------------------------------------------------------
async function loadDropdowns() {
  // products
  const { data: products } = await sb.from("products").select("*").order("name", { ascending: true });
  const selProd = byId("stock-product");
  selProd.innerHTML = `<option value="">Select Product</option>`;
  products.forEach((p) => {
    selProd.innerHTML += `<option value="${p.product_id}">${p.icon} ${p.name}</option>`;
  });

  // account types
  const { data: types } = await sb.from("account_types").select("*").order("account_type");
  const selType = byId("stock-type");
  selType.innerHTML = `<option value="">Select Type</option>`;
  types.forEach((t) => {
    selType.innerHTML += `<option value="${t.account_type}">${t.account_type}</option>`;
  });

  // durations
  const { data: durations } = await sb.from("durations").select("*").order("duration_code");
  const selDur = byId("stock-duration");
  selDur.innerHTML = `<option value="">Select Duration</option>`;
  durations.forEach((d) => {
    selDur.innerHTML += `<option value="${d.duration_code}">${d.duration_code}</option>`;
  });
}

// ---------------------------------------------------------
// PRODUCTS PANEL
// ---------------------------------------------------------
async function loadProducts() {
  const container = byId("products-table");
  container.innerHTML = `<div class="text-center text-muted py-4">Loading…</div>`;

  const { data, error } = await sb.from("products").select("*").order("name");
  if (error) return (container.innerHTML = "Error loading products");

  let html = `
    <table class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>Icon</th>
          <th>ID</th>
          <th>Name</th>
          <th>Category</th>
          <th width="120">Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((p) => {
    html += `
      <tr>
        <td>${p.icon}</td>
        <td>${p.product_id}</td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openEditProduct('${p.product_id}')">
            Edit
          </button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// SAVE PRODUCT
byId("btnSaveProduct").onclick = async () => {
  const id = byId("add-product-id").value.trim();
  const name = byId("add-product-name").value.trim();
  const category = byId("add-product-category").value;
  const icon = byId("add-product-icon").value.trim();

  if (!id || !name) return alert("Fill all fields");

  const { error } = await sb.from("products").insert({
    product_id: id,
    name,
    category,
    icon
  });

  if (error) return alert("Failed");

  document.querySelector("#modalAddProduct .btn-close").click();
  loadProducts();
  loadDropdowns();
};

// EDIT PRODUCT OPEN
window.openEditProduct = async function (id) {
  const { data } = await sb.from("products").select("*").eq("product_id", id).single();
  if (!data) return;

  byId("edit-product-id").value = data.product_id;
  byId("edit-product-name").value = data.name;
  byId("edit-product-category").value = data.category;
  byId("edit-product-icon").value = data.icon;

  new bootstrap.Modal(byId("modalEditProduct")).show();
};

// UPDATE PRODUCT
byId("btnUpdateProduct").onclick = async () => {
  const id = byId("edit-product-id").value;
  const name = byId("edit-product-name").value;
  const category = byId("edit-product-category").value;
  const icon = byId("edit-product-icon").value;

  await sb.from("products")
    .update({ name, category, icon })
    .eq("product_id", id);

  document.querySelector("#modalEditProduct .btn-close").click();
  loadProducts();
  loadDropdowns();
};

// DELETE PRODUCT
byId("btnDeleteProduct").onclick = async () => {
  const id = byId("edit-product-id").value;
  if (!confirm("Delete this product?")) return;

  await sb.from("products").delete().eq("product_id", id);

  document.querySelector("#modalEditProduct .btn-close").click();
  loadProducts();
  loadDropdowns();
};

// ---------------------------------------------------------
// STOCK PANEL
// ---------------------------------------------------------
async function loadStocks() {
  const container = byId("stocks-table");
  container.innerHTML = `<div class="text-center text-muted py-4">Loading…</div>`;

  const { data } = await sb.from("stocks").select("*").order("id", { ascending: false });

  let html = `
    <table class="table table-bordered table-hover">
      <thead>
        <tr>
          <th>ID</th>
          <th>Product</th>
          <th>Type</th>
          <th>Duration</th>
          <th>Qty</th>
          <th>Premium Until</th>
          <th>Archive After</th>
          <th width="150">Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((s) => {
    html += `
      <tr>
        <td>${s.id}</td>
        <td>${s.product_id}</td>
        <td>${s.account_type}</td>
        <td>${s.duration}</td>
        <td>${s.quantity}</td>
        <td>${formatDate(s.premium_until)}</td>
        <td>${s.archive_after_days || "-"}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openEditStock(${s.id})">Edit</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// SAVE STOCK
byId("btnSaveStock").onclick = async () => {
  const payload = {
    product_id: byId("stock-product").value,
    account_type: byId("stock-type").value,
    duration: byId("stock-duration").value,
    quantity: Number(byId("stock-quantity").value),
    premium_until: byId("stock-expiry").value || null,
    archive_after_days: Number(byId("stock-archivedays").value) || null
  };

  const { error } = await sb.from("stocks").insert(payload);
  if (error) return alert("Failed");

  document.querySelector("#modalAddStock .btn-close").click();
  loadStocks();
};

// OPEN EDIT STOCK
window.openEditStock = async function (id) {
  const { data } = await sb.from("stocks").select("*").eq("id", id).single();

  byId("edit-stock-id").value = data.id;
  byId("edit-stock-quantity").value = data.quantity;
  byId("edit-stock-expiry").value = data.premium_until?.slice(0, 10) || "";
  byId("edit-stock-archive").value = data.archive_after_days || "";

  new bootstrap.Modal(byId("modalEditStock")).show();
};

// UPDATE STOCK
byId("btnUpdateStock").onclick = async () => {
  const id = byId("edit-stock-id").value;

  await sb.from("stocks")
    .update({
      quantity: Number(byId("edit-stock-quantity").value),
      premium_until: byId("edit-stock-expiry").value || null,
      archive_after_days: Number(byId("edit-stock-archive").value) || null
    })
    .eq("id", id);

  document.querySelector("#modalEditStock .btn-close").click();
  loadStocks();
};

// DELETE STOCK
byId("btnDeleteStock").onclick = async () => {
  const id = byId("edit-stock-id").value;
  if (!confirm("Delete stock entry?")) return;

  await sb.from("stocks").delete().eq("id", id);
  document.querySelector("#modalEditStock .btn-close").click();
  loadStocks();
};

// ARCHIVE STOCK
byId("btnArchiveStock").onclick = async () => {
  const id = byId("edit-stock-id").value;

  await sb.from("stocks")
    .update({ is_archived: true })
    .eq("id", id);

  document.querySelector("#modalEditStock .btn-close").click();
  loadStocks();
};

// ---------------------------------------------------------
// ORDERS PANEL
// ---------------------------------------------------------
async function loadOrders() {
  const container = byId("orders-table");
  container.innerHTML = `<div class="text-center text-muted py-4">Loading…</div>`;

  const { data } = await sb.from("orders").select("*").order("created_at", { ascending: false });

  let html = `
    <table class="table table-bordered table-hover">
      <thead>
        <tr>
          <th>ID</th>
          <th>Buyer</th>
          <th>Product</th>
          <th>Type</th>
          <th>Duration</th>
          <th>Price</th>
          <th>Status</th>
          <th width="140">Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((o) => {
    html += `
      <tr>
        <td>${o.id}</td>
        <td>${o.buyer_email}</td>
        <td>${o.product_id}</td>
        <td>${o.account_type}</td>
        <td>${o.duration}</td>
        <td>₱${o.price}</td>
        <td><span class="badge bg-warning">${o.status}</span></td>
        <td>
          <button class="btn btn-sm btn-success" onclick="confirmOrder(${o.id})">Confirm</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// CONFIRM ORDER → assign stock + create record
window.confirmOrder = async function (orderId) {
  if (!confirm("Confirm order and deliver account?")) return;

  // 1. Load order
  const { data: order } = await sb.from("orders").select("*").eq("id", orderId).single();

  // 2. Find stock to use
  const { data: stock } = await sb
    .from("stocks")
    .select("*")
    .eq("product_id", order.product_id)
    .eq("account_type", order.account_type)
    .eq("duration", order.duration)
    .gt("quantity", 0)
    .order("id", { ascending: true })
    .limit(1);

  if (!stock?.length) return alert("No available stock");
  const st = stock[0];

  // 3. Decrease stock qty
  await sb.from("stocks")
    .update({ quantity: st.quantity - 1 })
    .eq("id", st.id);

  // 4. Create record
  const today = new Date().toISOString().slice(0, 10);
  await sb.from("records").insert({
    buyer: order.buyer_email,
    product_id: order.product_id,
    account_type: order.account_type,
    duration: order.duration,
    purchase_date: today,
    expiry_date: today, // updated later
    price: order.price,
    stock_id: st.id
  });

  // 5. Mark order delivered
  await sb.from("orders").update({ status: "delivered" }).eq("id", orderId);

  loadOrders();
  loadRecords();
};

// ---------------------------------------------------------
// RECORDS PANEL
// ---------------------------------------------------------
async function loadRecords() {
  const container = byId("records-table");
  container.innerHTML = `<div class="text-center text-muted py-4">Loading…</div>`;

  const { data } = await sb.from("records").select("*").order("id", { ascending: false });

  let html = `
    <table class="table table-bordered table-hover">
      <thead>
        <tr>
          <th>ID</th>
          <th>Buyer</th>
          <th>Product</th>
          <th>Type</th>
          <th>Duration</th>
          <th>Purchase</th>
          <th>Expiry</th>
          <th width="120">Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((r) => {
    html += `
      <tr>
        <td>${r.id}</td>
        <td>${r.buyer}</td>
        <td>${r.product_id}</td>
        <td>${r.account_type}</td>
        <td>${r.duration}</td>
        <td>${formatDate(r.purchase_date)}</td>
        <td>${formatDate(r.expiry_date)}</td>
        <td>
          <button class="btn btn-sm btn-primary"
            onclick="openRecordEdit(${r.id})">Edit</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// OPEN EDIT RECORD
window.openRecordEdit = async function (id) {
  const { data } = await sb.from("records").select("*").eq("id", id).single();

  byId("record-id").value = data.id;
  byId("record-add-days").value = "";
  byId("record-new-expiry").value = data.expiry_date || "";

  new bootstrap.Modal(byId("modalRecordEdit")).show();
};

// UPDATE RECORD
byId("btnUpdateRecord").onclick = async () => {
  const id = byId("record-id").value;
  const extraDays = Number(byId("record-add-days").value);
  let expiry = byId("record-new-expiry").value;

  if (extraDays && expiry) {
    expiry = addDaysToDate(expiry, extraDays);
  }

  await sb.from("records")
    .update({
      expiry_date: expiry
    })
    .eq("id", id);

  document.querySelector("#modalRecordEdit .btn-close").click();
  loadRecords();
};

// DELETE RECORD
byId("btnDeleteRecord").onclick = async () => {
  const id = byId("record-id").value;
  if (!confirm("Delete record?")) return;

  await sb.from("records").delete().eq("id", id);
  document.querySelector("#modalRecordEdit .btn-close").click();
  loadRecords();
};

// ---------------------------------------------------------
// RULES PANEL
// ---------------------------------------------------------
async function loadRules() {
  const container = byId("rules-table");
  container.innerHTML = `<div class="text-center text-muted py-4">Loading…</div>`;

  const { data } = await sb.from("rules").select("*").order("id", { ascending: false });

  let html = `
    <ul class="list-group">
  `;

  data.forEach((r) => {
    html += `
      <li class="list-group-item d-flex justify-content-between">
        <div>${r.rule_text}</div>
        <button class="btn btn-sm btn-danger" onclick="deleteRule(${r.id})">
          Delete
        </button>
      </li>
    `;
  });

  html += `</ul>`;
  container.innerHTML = html;
}

// ADD RULE
byId("btnSaveRule").onclick = async () => {
  const text = byId("add-rule-text").value.trim();
  if (!text) return alert("Enter text");

  await sb.from("rules").insert({ rule_text: text });
  byId("add-rule-text").value = "";
  document.querySelector("#modalAddRule .btn-close").click();
  loadRules();
};

// DELETE RULE
window.deleteRule = async function (id) {
  if (!confirm("Delete this rule?")) return;
  await sb.from("rules").delete().eq("id", id);
  loadRules();
};

// ---------------------------------------------------------
// FEEDBACK PANEL
// ---------------------------------------------------------
async function loadFeedback() {
  const container = byId("feedback-table");
  container.innerHTML = `<div class="text-center text-muted py-4">Loading…</div>`;

  const { data } = await sb.from("feedback").select("*").order("created_at", { ascending: false });

  let html = `
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>ID</th>
          <th>From</th>
          <th>Message</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((f) => {
    html += `
      <tr>
        <td>${f.id}</td>
        <td>${f.email}</td>
        <td>${f.message}</td>
        <td>${formatDate(f.created_at)}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ---------------------------------------------------------
// REPORTS PANEL
// ---------------------------------------------------------
async function loadReports() {
  const container = byId("reports-table");
  container.innerHTML = `<div class="text-center text-muted py-4">Loading…</div>`;

  const { data } = await sb.from("reports").select("*").order("created_at", { ascending: false });

  let html = `
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>ID</th>
          <th>Buyer</th>
          <th>Issue</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((r) => {
    html += `
      <tr>
        <td>${r.id}</td>
        <td>${r.buyer_email}</td>
        <td>${r.issue}</td>
        <td>${r.status}</td>
        <td>${formatDate(r.created_at)}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ---------------------------------------------------------
// INITIAL LOAD
// ---------------------------------------------------------
async function init() {
  await loadDropdowns();
  loadProducts();
  loadStocks();
  loadOrders();
  loadRecords();
  loadRules();
  loadFeedback();
  loadReports();
}

init();