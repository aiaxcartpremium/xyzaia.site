import { sb } from "./supabase.js";
import { formatPHDate } from "./utils.js";

// DOM
const tabProducts = document.getElementById("tab-products");
const tabOrders = document.getElementById("tab-orders");
const tabDelivered = document.getElementById("tab-delivered");
const tabRules = document.getElementById("tab-rules");
const tabFeedback = document.getElementById("tab-feedback");
const tabLogin = document.getElementById("tab-login");

const panelProducts = document.getElementById("panel-products");
const panelOrders = document.getElementById("panel-orders");
const panelDelivered = document.getElementById("panel-delivered");
const panelRules = document.getElementById("panel-rules");
const panelFeedback = document.getElementById("panel-feedback");
const panelLogin = document.getElementById("panel-login");

const userLabel = document.getElementById("user-label");
const logoutBtn = document.getElementById("btn-logout");
const loginBtn = document.getElementById("btn-login");

const productList = document.getElementById("products-list");
const ordersList = document.getElementById("orders-list");
const deliveredList = document.getElementById("delivered-list");
const rulesBody = document.getElementById("rules-body");
const feedbackBody = document.getElementById("feedback-body");

// Checkout Modal Refs
const coProduct = document.getElementById("co-product");
const coType = document.getElementById("co-type");
const coDuration = document.getElementById("co-duration");
const coPrice = document.getElementById("co-price");
const coEmail = document.getElementById("co-email");
const coProof = document.getElementById("co-proof");
const coPreview = document.getElementById("co-proof-preview");
const btnSubmitOrder = document.getElementById("btnSubmitOrder");

let selectedProduct = null;
let selectedPlan = null;
let selectedPrice = null;

// Login
loginBtn?.addEventListener("click", async () => {
  await sb.auth.signInWithOAuth({ provider:"google" });
});

logoutBtn?.addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

async function checkAuth() {
  const { data:{ session } } = await sb.auth.getSession();

  if (session?.user) {
    userLabel.textContent = session.user.email;
    logoutBtn.classList.remove("d-none");
    tabLogin.style.display = "none";
  } else {
    userLabel.textContent = "";
    logoutBtn.classList.add("d-none");
    tabLogin.style.display = "inline-block";
  }
}

// Load products
async function loadProducts() {
  productList.innerHTML = `<div class="text-center text-muted py-3">Loading…</div>`;

  const { data: products, error } = await sb
    .from("products")
    .select("*")
    .order("name");

  if (!products || error) {
    productList.innerHTML = `<div class="text-center text-danger py-3">Failed to load products.</div>`;
    return;
  }

  let html = "";

  for (const p of products) {
    const { data: prices } = await sb
      .from("product_prices")
      .select("*")
      .eq("product_id", p.product_id)
      .order("price");

    const { data: stockRows } = await sb
      .from("stocks")
      .select("quantity")
      .eq("product_id", p.product_id)
      .eq("status","available");

    const totalStock = stockRows?.reduce((a,b)=>a+(b.quantity||0),0) || 0;

    html += `
      <div class="col-md-4">
        <div class="product-card">
          <h4>${p.icon} ${p.name}</h4>
          <div class="text-muted">${p.category}</div>

          ${
            totalStock > 0
            ? `<span class="badge bg-success mt-2">In Stock: ${totalStock}</span>`
            : `<span class="badge bg-danger mt-2">Out of Stock</span>`
          }

          <hr>

          ${
            prices?.length
            ? prices.map(pr => `
                <div class="plan-row">
                  <div>
                    <strong>${pr.account_type}</strong>
                    <div class="small text-muted">${pr.duration}</div>
                  </div>
                  <div>
                    <strong class="text-primary">₱${pr.price}</strong>
                    ${
                      totalStock > 0
                      ? `<button class="btn btn-dark btn-sm btn-buy"
                          data-product="${p.product_id}"
                          data-type="${pr.account_type}"
                          data-duration="${pr.duration}"
                          data-price="${pr.price}">
                          Buy
                        </button>`
                      : `<button class="btn btn-secondary btn-sm" disabled>Unavailable</button>`
                    }
                  </div>
                </div>
              `).join("")
            : `<div class="text-muted">No price plans.</div>`
          }
        </div>
      </div>
    `;
  }

  productList.innerHTML = html;
}

// BUY BUTTON
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("btn-buy")) return;

  const { product, type, duration, price } = e.target.dataset;

  selectedProduct = product;
  selectedPlan = { type, duration };
  selectedPrice = Number(price);

  coProduct.textContent = product;
  coType.textContent = type;
  coDuration.textContent = duration;
  coPrice.textContent = "₱" + price;

  const modal = new bootstrap.Modal("#modalCheckout");
  modal.show();
});

// Proof preview
coProof?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  coPreview.src = URL.createObjectURL(file);
  coPreview.style.display = "block";
});

// Submit Order
btnSubmitOrder?.addEventListener("click", async () => {
  const email = coEmail.value.trim();
  const {
    data:{ session }
  } = await sb.auth.getSession();

  if (!session) {
    alert("You must login first.");
    return;
  }
  if (!email) {
    alert("Enter email.");
    return;
  }

  const proofFile = coProof.files[0];
  let proofURL = null;

  if (proofFile) {
    const fileName = `proof_${Date.now()}.jpg`;
    const { data, error } = await sb.storage
      .from("proofs")
      .upload(fileName, proofFile);

    if (!error) {
      proofURL = sb.storage.from("proofs").getPublicUrl(fileName).data.publicUrl;
    }
  }

  await sb.from("orders").insert([{
    buyer_email: session.user.email,
    product_id: selectedProduct,
    account_type: selectedPlan.type,
    duration: selectedPlan.duration,
    price: selectedPrice,
    proof_url: proofURL,
    status: "pending",
    created_at: new Date().toISOString()
  }]);

  alert("Order submitted!");
  loadOrders();

  bootstrap.Modal.getInstance(document.getElementById("modalCheckout")).hide();
});

// Load Orders
async function loadOrders() {
  const { data:{ session } } = await sb.auth.getSession();
  if (!session) return;

  ordersList.innerHTML = `<div class="text-muted py-3">Loading…</div>`;

  const { data } = await sb
    .from("orders")
    .select("*")
    .eq("buyer_email", session.user.email)
    .order("created_at", { ascending:false });

  if (!data.length) {
    ordersList.innerHTML = `<div class="text-muted py-3">No orders yet.</div>`;
    return;
  }

  ordersList.innerHTML = data.map(o => `
    <div class="order-card">
      <h5>${o.product_id} — ₱${o.price}</h5>
      <div>${o.account_type} (${o.duration})</div>
      <span class="badge bg-warning">${o.status}</span>
      <div class="small text-muted mt-2">${formatPHDate(o.created_at)}</div>
    </div>
  `).join("");
}

// Load Delivered
async function loadDelivered() {
  const { data:{ session } } = await sb.auth.getSession();
  if (!session) return;

  deliveredList.innerHTML = `<div class="text-muted py-3">Loading…</div>`;

  const { data } = await sb
    .from("records")
    .select("*")
    .eq("buyer_email", session.user.email)
    .order("purchase_date", { ascending:false });

  if (!data.length) {
    deliveredList.innerHTML = `<div class="text-muted py-3">No delivered accounts.</div>`;
    return;
  }

  deliveredList.innerHTML = data.map(r => `
    <div class="delivered-card">
      <h4>${r.product_id}</h4>
      <div>${r.account_type} (${r.duration})</div>
      <div>Email: <strong>${r.account_email}</strong></div>
      <div>Password: <strong>${r.account_password}</strong></div>
      <div>Profile: ${r.profile || "-"}</div>
      <hr>
      <div class="small text-muted">
        Purchased: ${formatPHDate(r.purchase_date)}<br>
        Expiry: ${formatPHDate(r.expiry_date)}
      </div>
    </div>
  `).join("");
}

// Load Rules
async function loadRules() {
  const { data } = await sb.from("rules").select("*");
  rulesBody.innerHTML = data?.map(r => `
    <div class="mb-2">• ${r.rule_text}</div>
  `).join("") || "No rules yet.";
}

// Load Feedback
async function loadFeedback() {
  const { data } = await sb.from("feedback").select("*");
  feedbackBody.innerHTML = data?.map(f => `
    <div class="order-card">
      <strong>${f.user_email}</strong>
      <p>${f.message}</p>
    </div>
  `).join("") || "No feedback yet.";
}

// Tabs
const tabs = {
  "tab-products": panelProducts,
  "tab-orders": panelOrders,
  "tab-delivered": panelDelivered,
  "tab-rules": panelRules,
  "tab-feedback": panelFeedback,
  "tab-login": panelLogin,
};

document.querySelectorAll(".tabs-nav a").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs-nav a").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    Object.values(tabs).forEach(p => p.classList.remove("active"));
    tabs[btn.id].classList.add("active");

    if (btn.id === "tab-orders") loadOrders();
    if (btn.id === "tab-delivered") loadDelivered();
    if (btn.id === "tab-rules") loadRules();
    if (btn.id === "tab-feedback") loadFeedback();
  });
});

// Init
checkAuth();
loadProducts();