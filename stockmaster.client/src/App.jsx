
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const navigation = [
    { id: "dashboard", icon: "◫", label: "Dashboard" },
    { id: "products", icon: "▣", label: "Products" },
    { id: "categories", icon: "▦", label: "Categories" },
    { id: "suppliers", icon: "♧", label: "Suppliers" },
    { id: "sales", icon: "▤", label: "Sales" },
    { id: "stock", icon: "⇄", label: "Stock Movements" },
    { id: "users", icon: "♙", label: "User Management", adminOnly: true },
];

// Set this to the HTTPS address shown when StockMaster.API runs.
// The frontend uses the Vite proxy to avoid browser CORS issues.
const API_BASE = "/api";

const productImagePath = (value) => {
    const path = String(value ?? "").trim();
    return /^\/products\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpg|jpeg|png|webp)$/i.test(path) ? path : "";
};

const productImageFiles = [
    "earbuds-airpods.jpg", "headset-hyperx-cloud.jpg", "headset-logitech-h390.jpg",
    "keyboard-hyperx-alloy.jpg", "keyboard-logitech-g413.jpg",
    "laptop-asus-rog.jpg", "laptop-dell-inspiron-15.jpg",
    "laptop-hp-pavilion-15.jpg", "laptop-lenovo-thinkpad.jpg",
    "laptop-macbook-air.jpg", "monitor-aoc-24.jpg", "monitor-asus-27.jpg",
    "monitor-dell-24.jpg", "monitor-lg-24.jpg", "monitor-samsung-27.jpg",
    "mouse-hyperx-pulsefire.jpg", "mouse-logitech-m330.jpg",
    "mouse-razer-deathadder.jpg", "speaker-jbl-flip.jpg",
    "webcam-logitech-c920.jpg",
];

function ProductPhoto({ src, name, className = "" }) {
    const [broken, setBroken] = useState(false);
    const imagePath = productImagePath(src);
    useEffect(() => { setBroken(false); }, [imagePath]);
    return (
        <div className={`sm-product-photo ${className}`}>
            {imagePath && !broken ? (
                <img src={imagePath} alt={name} loading="lazy" onError={() => setBroken(true)} />
            ) : (
                <span aria-label="No product image" role="img">▣</span>
            )}
        </div>
    );
}

const normalizeProducts = (payload, categoryNames = new Map()) => {
    const rows = Array.isArray(payload) ? payload : payload?.$values ?? payload?.items ?? payload?.data;
    if (!Array.isArray(rows)) throw new Error("Unexpected products response format.");
    return rows.map((p) => ({
        id: p.productId ?? p.ProductId ?? p.id,
        supplierId: p.supplierId ?? p.SupplierId ?? null,
        categoryId: p.categoryId ?? p.CategoryId ?? null,
        description: p.description ?? p.Description ?? "",
        imageUrl: p.imageUrl ?? p.ImageUrl ?? "",
        purchasePrice: Number(p.purchasePrice ?? p.PurchasePrice ?? 0),
        name: p.name ?? p.Name ?? "Unnamed product",
        sku: p.sku ?? p.SKU ?? "—",
        category: p.categoryName ?? p.CategoryName ?? p.category?.name ?? p.Category?.Name ?? categoryNames.get(Number(p.categoryId ?? p.CategoryId)) ?? "—",
        price: Number(p.sellingPrice ?? p.SellingPrice ?? p.price ?? 0),
        quantity: Number(p.quantity ?? p.Quantity ?? 0),
        minStockLevel: Number(p.minStockLevel ?? p.MinStockLevel ?? 10),
    }));
};

const normalizeSales = (payload) => {
    const rows = Array.isArray(payload) ? payload : payload?.$values ?? payload?.items ?? payload?.data;
    if (!Array.isArray(rows)) throw new Error("Unexpected sales response format.");
    return rows.map((sale) => ({
        id: sale.saleId ?? sale.SaleId ?? sale.id,
        date: sale.saleDate ?? sale.SaleDate ?? null,
        userId: sale.userId ?? sale.UserId ?? null,
        userName: sale.userName ?? sale.UserName ?? "—",
        totalAmount: Number(sale.totalAmount ?? sale.TotalAmount ?? 0),
    }));
};

const formatSaleDate = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", {
        year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(parsed);
};

const money = (value) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(value);

function App() {
    // Keep the access token in memory, not localStorage.
    // Refreshing the browser requires logging in again.
    const [session, setSession] = useState(null);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginBusy, setLoginBusy] = useState(false);
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [activePage, setActivePage] = useState("dashboard");
    const [search, setSearch] = useState("");
    const [productView, setProductView] = useState("grid");
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [salesSearch, setSalesSearch] = useState("");
    const [salesError, setSalesError] = useState("");
    const [saleEditor, setSaleEditor] = useState(null);
    const [saleSaving, setSaleSaving] = useState(false);
    const [saleFormError, setSaleFormError] = useState("");
    const [saleNotice, setSaleNotice] = useState("");
    const [saleDetails, setSaleDetails] = useState(null);
    const [saleDetailsLoading, setSaleDetailsLoading] = useState(false);
    const [saleDetailsError, setSaleDetailsError] = useState("");
    const [categories, setCategories] = useState([]);
    const [categorySearch, setCategorySearch] = useState("");
    const [categoriesError, setCategoriesError] = useState("");
    const [suppliers, setSuppliers] = useState([]);
    const [supplierSearch, setSupplierSearch] = useState("");
    const [suppliersError, setSuppliersError] = useState("");
    const [stockMovements, setStockMovements] = useState([]);
    const [stockSearch, setStockSearch] = useState("");
    const [stockError, setStockError] = useState("");
    const [stockEditor, setStockEditor] = useState(null);
    const [stockSaving, setStockSaving] = useState(false);
    const [stockFormError, setStockFormError] = useState("");
    const [stockNotice, setStockNotice] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [productEditor, setProductEditor] = useState(null);
    const [productSaving, setProductSaving] = useState(false);
    const [productFormError, setProductFormError] = useState("");
    const [productNotice, setProductNotice] = useState("");
    const [categoryEditor, setCategoryEditor] = useState(null);
    const [categorySaving, setCategorySaving] = useState(false);
    const [categoryFormError, setCategoryFormError] = useState("");
    const [categoryNotice, setCategoryNotice] = useState("");
    const [categoryDeleting, setCategoryDeleting] = useState(null);
    const [supplierEditor, setSupplierEditor] = useState(null);
    const [supplierSaving, setSupplierSaving] = useState(false);
    const [supplierFormError, setSupplierFormError] = useState("");
    const [supplierNotice, setSupplierNotice] = useState("");
    const [supplierDeleting, setSupplierDeleting] = useState(null);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState("");
    const [usersNotice, setUsersNotice] = useState("");
    const [usersSearch, setUsersSearch] = useState("");
    const [userEditor, setUserEditor] = useState(null);
    const [userSaving, setUserSaving] = useState(false);
    const [userFormError, setUserFormError] = useState("");
    const [userStatusSaving, setUserStatusSaving] = useState(null);
    const isAdmin = (session?.user?.role ?? session?.user?.Role) === "Admin";
    const sessionToken = session?.token;

    const apiFetch = useCallback(async (url, options = {}) => {
        const headers = new Headers(options.headers || {});
        if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 && sessionToken) {
            setSession(null);
            setProducts([]);
            setSales([]);
            setCategories([]);
            setSuppliers([]);
            setStockMovements([]);
            setUsers([]);
            setActivePage("dashboard");
            setLoginPassword("");
            setLoginError("Your session expired or access was denied. Please sign in again.");
        }
        return response;
    }, [sessionToken]);

    const login = async (event) => {
        event.preventDefault();
        if (loginBusy) return;
        setLoginBusy(true);
        setLoginError("");
        try {
            const response = await fetch(`${API_BASE}/Auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
            });
            if (!response.ok) {
                if (response.status === 401) throw new Error("Invalid email or password.");
                throw new Error(await parseApiError(response));
            }
            const data = await response.json();
            const token = data.token ?? data.Token;
            const user = data.user ?? data.User;
            if (!token || !user) throw new Error("The login response did not contain a valid session.");
            setSession({ token, user });
            setLoginPassword("");
            setActivePage("dashboard");
        } catch (error) {
            setLoginError(error?.message ?? "Could not sign in.");
        } finally {
            setLoginBusy(false);
        }
    };

    const logout = () => {
        setSession(null);
        setLoginPassword("");
        setLoginError("");
        setProducts([]);
        setSales([]);
        setCategories([]);
        setSuppliers([]);
        setStockMovements([]);
        setUsers([]);
        setActivePage("dashboard");
    };

    const parseApiError = async (response) => {
        const raw = await response.text();
        try {
            const data = JSON.parse(raw);
            const detail = data.detail || data.message ||
                (data.errors ? Object.entries(data.errors).map(([key, value]) => `${key}: ${[].concat(value).join(", ")}`).join("; ") : null) ||
                data.title || raw;
            return `HTTP ${response.status}: ${detail}`;
        } catch {
            return `HTTP ${response.status}: ${raw || response.statusText}`;
        }
    };

    const refreshUsers = useCallback(async () => {
        if (!isAdmin) return;
        setUsersLoading(true);
        setUsersError("");
        try {
            const response = await apiFetch(`${API_BASE}/Users`, { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error(await parseApiError(response));
            const payload = await response.json();
            const rows = Array.isArray(payload) ? payload : payload?.$values ?? payload?.items ?? payload?.data;
            if (!Array.isArray(rows)) throw new Error("Unexpected users response format.");
            setUsers(rows.map(u => ({
                id: u.userId ?? u.UserId,
                fullName: u.fullName ?? u.FullName ?? "",
                email: u.email ?? u.Email ?? "",
                role: u.role ?? u.Role ?? "Employee",
                isActive: Boolean(u.isActive ?? u.IsActive),
            })));
        } catch (err) {
            setUsersError(err?.message ?? "Could not load users.");
        } finally {
            setUsersLoading(false);
        }
    }, [isAdmin, apiFetch]);

    const openUserEditor = (user = null) => {
        setUserFormError("");
        setUsersNotice("");
        setUserEditor({
            id: user?.id ?? null,
            fullName: user?.fullName ?? "",
            email: user?.email ?? "",
            role: user?.role ?? "Employee",
            password: "",
        });
    };

    const saveUser = async (event) => {
        event.preventDefault();
        if (!isAdmin || !userEditor || userSaving) return;
        const form = userEditor;
        const fullName = form.fullName.trim();
        const email = form.email.trim();
        if (!fullName || fullName.length > 150 || !email || email.length > 150 ||
            !["Admin", "Employee"].includes(form.role) ||
            (form.id === null && !form.password.trim())) {
            setUserFormError("Check name, email, role, and password for a new user.");
            return;
        }
        setUserSaving(true);
        setUserFormError("");
        try {
            const creating = form.id === null;
            const body = { fullName, email, role: form.role };
            if (creating) body.password = form.password;
            const response = await apiFetch(`${API_BASE}/Users${creating ? "" : `/${form.id}`}`, {
                method: creating ? "POST" : "PUT",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await parseApiError(response));
            setUserEditor(null);
            setUsersNotice(creating ? "User created successfully." : "User updated successfully.");
            await refreshUsers();
        } catch (err) {
            setUserFormError(err?.message ?? "Could not save user.");
        } finally {
            setUserSaving(false);
        }
    };

    const toggleUserStatus = async (user) => {
        if (!isAdmin || userStatusSaving !== null) return;
        const next = !user.isActive;
        if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${user.fullName}?`)) return;
        setUserStatusSaving(user.id);
        setUsersError("");
        setUsersNotice("");
        try {
            const response = await apiFetch(`${API_BASE}/Users/${user.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ isActive: next }),
            });
            if (!response.ok) throw new Error(await parseApiError(response));
            setUsersNotice(`User ${next ? "activated" : "deactivated"} successfully.`);
            await refreshUsers();
        } catch (err) {
            setUsersError(err?.message ?? "Could not update user status.");
        } finally {
            setUserStatusSaving(null);
        }
    };

    useEffect(() => {
        if (!session?.token || !isAdmin || activePage !== "users") return;
        let cancelled = false;
        Promise.resolve().then(() => {
            if (!cancelled) void refreshUsers();
        });
        return () => { cancelled = true; };
    }, [session?.token, isAdmin, activePage, refreshUsers]);

    const openSaleDetails = async (saleId) => {
        setSaleDetails({ id: saleId, data: null });
        setSaleDetailsLoading(true);
        setSaleDetailsError("");
        try {
            const response = await apiFetch(`${API_BASE}/Sales/${encodeURIComponent(saleId)}`, {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) throw new Error(await parseApiError(response));
            const sale = await response.json();
            const rawItems = sale.items ?? sale.Items ?? [];
            const items = Array.isArray(rawItems) ? rawItems : rawItems?.$values;
            if (!Array.isArray(items)) throw new Error("Unexpected sale items response format.");
            setSaleDetails(current => current?.id === saleId ? {
                id: saleId,
                data: {
                    id: sale.saleId ?? sale.SaleId ?? saleId,
                    date: sale.saleDate ?? sale.SaleDate,
                    userName: sale.userName ?? sale.UserName ?? "—",
                    userId: sale.userId ?? sale.UserId,
                    totalAmount: Number(sale.totalAmount ?? sale.TotalAmount ?? 0),
                    items: items.map(item => ({
                        id: item.saleItemId ?? item.SaleItemId,
                        productId: item.productId ?? item.ProductId,
                        productName: item.productName ?? item.ProductName ?? "—",
                        quantity: Number(item.quantity ?? item.Quantity ?? 0),
                        unitPrice: Number(item.unitPrice ?? item.UnitPrice ?? 0),
                        lineTotal: Number(item.lineTotal ?? item.LineTotal ?? 0),
                    })),
                },
            } : current);
        } catch (err) {
            setSaleDetailsError(err?.message ?? "Could not load sale details.");
        } finally {
            setSaleDetailsLoading(false);
        }
    };

    const openSaleEditor = () => {
        setSaleNotice("");
        setSaleFormError("");
        setSaleEditor({ items: [{ productId: "", quantity: "1" }] });
    };

    const saveSale = async (event) => {
        event.preventDefault();
        if (!saleEditor || saleSaving) return;
        const items = saleEditor.items.map(item => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
        }));
        const valid = items.length > 0 && items.every(item =>
            Number.isInteger(item.productId) && item.productId > 0 &&
            Number.isInteger(item.quantity) && item.quantity > 0 &&
            item.quantity <= 2147483647);
        if (!valid || new Set(items.map(item => item.productId)).size !== items.length) {
            setSaleFormError("Choose different products and enter positive whole-number quantities.");
            return;
        }
        for (const item of items) {
            const product = products.find(p => Number(p.id) === item.productId);
            if (!product || item.quantity > product.quantity) {
                setSaleFormError(`Insufficient stock for ${product?.name ?? `product #${item.productId}`}.`);
                return;
            }
        }
        const estimatedTotal = items.reduce((sum, item) => {
            const product = products.find(p => Number(p.id) === item.productId);
            return sum + (product?.price ?? 0) * item.quantity;
        }, 0);
        if (!window.confirm(`Create this test sale for ${money(estimatedTotal)}? This will deduct stock and record OUT movements in the connected database.`)) return;
        setSaleSaving(true);
        setSaleFormError("");
        let created = false;
        try {
            const response = await apiFetch(`${API_BASE}/Sales`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ items }),
            });
            if (!response.ok) throw new Error(await parseApiError(response));
            created = true;
            const result = await response.json();
            setSaleEditor(null);
            setSaleNotice(`Sale #${result.saleId ?? result.SaleId ?? "new"} created successfully. Stock updated.`);
            const [salesResponse, productsResponse, stockResponse] = await Promise.all([
                apiFetch(`${API_BASE}/Sales`), apiFetch(`${API_BASE}/Products`), apiFetch(`${API_BASE}/StockMovements`),
            ]);
            if (!salesResponse.ok || !productsResponse.ok || !stockResponse.ok) {
                throw new Error("Sale created, but refreshing data failed. Reload the page to see the latest data.");
            }
            setSales(normalizeSales(await salesResponse.json()));
            setSalesError("");
            const names = new Map(categories.map(c => [Number(c.id), c.name]));
            setProducts(normalizeProducts(await productsResponse.json(), names));
            const movementsPayload = await stockResponse.json();
            const rows = Array.isArray(movementsPayload) ? movementsPayload : movementsPayload?.$values ?? movementsPayload?.items ?? movementsPayload?.data;
            if (!Array.isArray(rows)) throw new Error("Sale created, but stock movements could not be refreshed.");
            setStockMovements(rows.map(movement => ({
                id: movement.movementId ?? movement.MovementId,
                productId: movement.productId ?? movement.ProductId,
                productName: movement.productName ?? movement.ProductName ?? "—",
                userName: movement.userName ?? movement.UserName ?? "—",
                type: movement.movementType ?? movement.MovementType ?? "—",
                quantity: Number(movement.quantity ?? movement.Quantity ?? 0),
                date: movement.movementDate ?? movement.MovementDate,
                notes: movement.notes ?? movement.Notes ?? "",
            })));
            setStockError("");
        } catch (err) {
            if (created) setSaleNotice(err?.message ?? "Sale created; refresh the page to verify.");
            else setSaleFormError(err?.message ?? "Could not create sale.");
        } finally {
            setSaleSaving(false);
        }
    };

    const openStockEditor = () => {
        setStockFormError("");
        setStockNotice("");
        setStockEditor({ productId: "", movementType: "IN", quantity: "1", notes: "" });
    };

    const saveStockMovement = async (event) => {
        event.preventDefault();
        if (!stockEditor || stockSaving) return;

        const productId = Number(stockEditor.productId);
        const quantity = Number(stockEditor.quantity);
        const movementType = stockEditor.movementType;
        const product = products.find(p => Number(p.id) === productId);

        if (!product || !Number.isInteger(productId) || productId <= 0 ||
            !Number.isInteger(quantity) || quantity <= 0 || quantity > 2147483647 ||
            !["IN", "OUT"].includes(movementType)) {
            setStockFormError("Select a product, movement type, and a positive whole-number quantity.");
            return;
        }
        if (movementType === "OUT" && quantity > product.quantity) {
            setStockFormError(`Insufficient stock for ${product.name}. Available: ${product.quantity}.`);
            return;
        }
        if (movementType === "IN" && quantity > 2147483647 - product.quantity) {
            setStockFormError("The resulting stock quantity exceeds the allowed maximum.");
            return;
        }

        if (!window.confirm(`Record ${movementType} movement of ${quantity} unit(s) for ${product.name}? This will update stock in the connected database.`)) return;

        setStockSaving(true);
        setStockFormError("");
        let created = false;
        try {
            const response = await apiFetch(`${API_BASE}/StockMovements`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    productId,
                    movementType,
                    quantity,
                    notes: stockEditor.notes.trim() || null,
                }),
            });
            if (!response.ok) throw new Error(await parseApiError(response));
            created = true;
            const result = await response.json();
            setStockEditor(null);
            setStockNotice(`Movement #${result.movementId ?? result.MovementId ?? "new"} recorded successfully. Stock updated.`);

            const [productsResponse, movementsResponse] = await Promise.all([
                apiFetch(`${API_BASE}/Products`, { headers: { Accept: "application/json" } }),
                apiFetch(`${API_BASE}/StockMovements`, { headers: { Accept: "application/json" } }),
            ]);
            if (!productsResponse.ok || !movementsResponse.ok) {
                throw new Error("Movement saved, but refreshing data failed. Reload the page to view current stock.");
            }
            const productPayload = await productsResponse.json();
            const movementPayload = await movementsResponse.json();
            const rows = Array.isArray(movementPayload) ? movementPayload : movementPayload?.$values ?? movementPayload?.items ?? movementPayload?.data;
            if (!Array.isArray(rows)) throw new Error("Movement saved, but the movement list response was unexpected. Reload the page.");
            const names = new Map(categories.map(c => [Number(c.id), c.name]));
            setProducts(normalizeProducts(productPayload, names));
            setStockMovements(rows.map(movement => ({
                id: movement.movementId ?? movement.MovementId,
                productId: movement.productId ?? movement.ProductId,
                productName: movement.productName ?? movement.ProductName ?? "—",
                userName: movement.userName ?? movement.UserName ?? "—",
                type: movement.movementType ?? movement.MovementType ?? "—",
                quantity: Number(movement.quantity ?? movement.Quantity ?? 0),
                date: movement.movementDate ?? movement.MovementDate,
                notes: movement.notes ?? movement.Notes ?? "",
            })));
            setStockError("");
        } catch (err) {
            if (created) setStockNotice(err?.message ?? "Movement saved. Reload the page to verify current stock.");
            else setStockFormError(err?.message ?? "Could not create stock movement.");
        } finally {
            setStockSaving(false);
        }
    };

    const refreshCategories = async () => {
        const response = await apiFetch(`${API_BASE}/Categories`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(await parseApiError(response));
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : payload?.$values ?? payload?.items ?? payload?.data;
        if (!Array.isArray(rows)) throw new Error("Unexpected categories response format.");
        const updated = rows.map(category => ({
            id: category.categoryId ?? category.CategoryId ?? category.id,
            name: category.name ?? category.Name ?? "",
            description: category.description ?? category.Description ?? "",
        }));
        setCategories(updated);
        setCategoriesError("");
        const names = new Map(updated.map(category => [Number(category.id), category.name]));
        setProducts(current => current.map(product => ({
            ...product, category: names.get(Number(product.categoryId)) ?? product.category,
        })));
    };

    const openCategoryEditor = (category = null) => {
        setCategoryNotice("");
        setCategoryFormError("");
        setCategoryEditor({ id: category?.id ?? null, name: category?.name ?? "", description: category?.description ?? "" });
    };

    const saveCategory = async (event) => {
        event.preventDefault();
        if (!categoryEditor || categorySaving) return;
        const form = categoryEditor;
        const name = form.name.trim();
        if (!name || name.length > 100) {
            setCategoryFormError("Category name is required and must not exceed 100 characters.");
            return;
        }
        setCategorySaving(true);
        setCategoryFormError("");
        try {
            const editing = form.id !== null;
            const response = await apiFetch(`${API_BASE}/Categories${editing ? `/${form.id}` : ""}`, {
                method: editing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ name, description: form.description.trim() }),
            });
            if (!response.ok) throw new Error(await parseApiError(response));
            setCategoryEditor(null);
            setCategoryNotice(editing ? "Category updated successfully." : "Category created successfully.");
            try { await refreshCategories(); }
            catch (err) { setCategoriesError(err?.message ?? "Could not refresh categories."); }
        } catch (err) {
            setCategoryFormError(err?.message ?? "Unable to save category.");
        } finally {
            setCategorySaving(false);
        }
    };

    const deleteCategory = async (category) => {
        if (categoryDeleting !== null || !window.confirm(`Delete category "${category.name}"? This cannot be undone.`)) return;
        setCategoryDeleting(category.id);
        setCategoryNotice("");
        setCategoriesError("");
        try {
            const response = await apiFetch(`${API_BASE}/Categories/${category.id}`, { method: "DELETE" });
            if (!response.ok) throw new Error(await parseApiError(response));
            setCategoryNotice("Category deleted successfully.");
            try { await refreshCategories(); }
            catch (err) { setCategoriesError(err?.message ?? "Could not refresh categories."); }
        } catch (err) {
            setCategoriesError(err?.message ?? "Unable to delete category.");
        } finally {
            setCategoryDeleting(null);
        }
    };


    const refreshSuppliers = async () => {
        const response = await apiFetch(`${API_BASE}/Suppliers`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(await parseApiError(response));
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : payload?.$values ?? payload?.items ?? payload?.data;
        if (!Array.isArray(rows)) throw new Error("Unexpected suppliers response format.");
        setSuppliers(rows.map(supplier => ({
            id: supplier.supplierId ?? supplier.SupplierId ?? supplier.id,
            name: supplier.name ?? supplier.Name ?? "",
            phone: supplier.phone ?? supplier.Phone ?? "",
            email: supplier.email ?? supplier.Email ?? "",
            address: supplier.address ?? supplier.Address ?? "",
        })));
        setSuppliersError("");
    };

    const openSupplierEditor = (supplier = null) => {
        setSupplierNotice("");
        setSupplierFormError("");
        setSupplierEditor({
            id: supplier?.id ?? null,
            name: supplier?.name ?? "",
            phone: supplier?.phone ?? "",
            email: supplier?.email ?? "",
            address: supplier?.address ?? "",
        });
    };

    const saveSupplier = async (event) => {
        event.preventDefault();
        if (!supplierEditor || supplierSaving) return;
        const form = supplierEditor;
        const name = form.name.trim();
        if (!name || name.length > 100) {
            setSupplierFormError("Supplier name is required and must not exceed 100 characters.");
            return;
        }
        setSupplierSaving(true);
        setSupplierFormError("");
        try {
            const editing = form.id !== null;
            const response = await apiFetch(`${API_BASE}/Suppliers${editing ? `/${form.id}` : ""}`, {
                method: editing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    name,
                    phone: form.phone.trim() || null,
                    email: form.email.trim() || null,
                    address: form.address.trim() || null,
                }),
            });
            if (!response.ok) throw new Error(await parseApiError(response));
            setSupplierEditor(null);
            setSupplierNotice(editing ? "Supplier updated successfully." : "Supplier created successfully.");
            try { await refreshSuppliers(); }
            catch (err) { setSuppliersError(err?.message ?? "Could not refresh suppliers."); }
        } catch (err) {
            setSupplierFormError(err?.message ?? "Unable to save supplier.");
        } finally {
            setSupplierSaving(false);
        }
    };

    const deleteSupplier = async (supplier) => {
        if (supplierDeleting !== null || !window.confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;
        setSupplierDeleting(supplier.id);
        setSupplierNotice("");
        setSuppliersError("");
        try {
            const response = await apiFetch(`${API_BASE}/Suppliers/${supplier.id}`, { method: "DELETE" });
            if (!response.ok) throw new Error(await parseApiError(response));
            setSupplierNotice("Supplier deleted successfully.");
            try { await refreshSuppliers(); }
            catch (err) { setSuppliersError(err?.message ?? "Could not refresh suppliers."); }
        } catch (err) {
            setSuppliersError(err?.message ?? "Unable to delete supplier.");
        } finally {
            setSupplierDeleting(null);
        }
    };

    const openProductEditor = (product = null) => {
        setProductFormError("");
        setProductNotice("");
        setProductEditor({
            id: product?.id ?? null,
            sku: product?.sku ?? "",
            name: product?.name ?? "",
            description: product?.description ?? "",
            imageUrl: product?.imageUrl ?? "",
            categoryId: String(product?.categoryId ?? ""),
            supplierId: String(product?.supplierId ?? ""),
            purchasePrice: String(product?.purchasePrice ?? ""),
            sellingPrice: String(product?.price ?? ""),
            quantity: String(product?.quantity ?? "0"),
            minStockLevel: String(product?.minStockLevel ?? "5"),
        });
    };

    const saveProduct = async (event) => {
        event.preventDefault();
        if (!productEditor || productSaving) return;
        const form = productEditor;
        const validMoney = (v) => /^\d+(\.\d{1,2})?$/.test(v.trim()) && Number.isFinite(Number(v)) && Number(v) <= 999999999999.99;
        const validInt = (v) => /^\d+$/.test(v.trim()) && Number.isSafeInteger(Number(v)) && Number(v) <= 2147483647;
        if (!form.sku.trim() || !form.name.trim() || !validInt(form.categoryId) || Number(form.categoryId) < 1 ||
            (form.supplierId !== "" && (!validInt(form.supplierId) || Number(form.supplierId) < 1)) ||
            !validMoney(form.purchasePrice) || !validMoney(form.sellingPrice) ||
            !validInt(form.quantity) || !validInt(form.minStockLevel)) {
            setProductFormError("Check required fields, prices (max 2 decimals), IDs and non-negative whole-number quantities.");
            return;
        }
        if (form.imageUrl && !productImagePath(form.imageUrl)) {
            setProductFormError("Choose a valid image from the local product image list.");
            return;
        }
        const body = {
            sku: form.sku.trim(), name: form.name.trim(), description: form.description.trim(),
            imageUrl: productImagePath(form.imageUrl) || null,
            categoryId: Number(form.categoryId),
            supplierId: form.supplierId === "" ? null : Number(form.supplierId),
            purchasePrice: Number(form.purchasePrice), sellingPrice: Number(form.sellingPrice),
            quantity: Number(form.quantity), minStockLevel: Number(form.minStockLevel),
        };
        setProductSaving(true);
        setProductFormError("");
        try {
            const editing = form.id !== null;
            const response = await apiFetch(`${API_BASE}/Products${editing ? `/${form.id}` : ""}`, {
                method: editing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const raw = await response.text();
                let detail = raw;
                try {
                    const parsed = JSON.parse(raw);
                    detail = parsed?.detail || parsed?.title || parsed?.message ||
                        (parsed?.errors ? Object.entries(parsed.errors).map(([k, v]) => `${k}: ${[].concat(v).join(", ")}`).join("; ") : raw);
                } catch { /* plain-text response */ }
                throw new Error(`HTTP ${response.status}: ${String(detail).slice(0, 500)}`);
            }
            const [productResponse, categoryResponse] = await Promise.all([
                apiFetch(`${API_BASE}/Products`, { headers: { Accept: "application/json" } }),
                apiFetch(`${API_BASE}/Categories`, { headers: { Accept: "application/json" } }),
            ]);
            if (!productResponse.ok || !categoryResponse.ok) throw new Error("Saved, but refreshing products failed. Reload the page to see the latest data.");
            const productPayload = await productResponse.json();
            const categoryPayload = await categoryResponse.json();
            const catRows = Array.isArray(categoryPayload) ? categoryPayload : categoryPayload?.$values ?? categoryPayload?.items ?? categoryPayload?.data;
            if (!Array.isArray(catRows)) throw new Error("Saved, but the category refresh returned an unexpected format.");
            const names = new Map(catRows.map(c => [Number(c.categoryId ?? c.CategoryId ?? c.id), c.name ?? c.Name]));
            setProducts(normalizeProducts(productPayload, names));
            setProductEditor(null);
            setProductNotice(editing ? "Product updated successfully." : "Product created successfully.");
        } catch (err) {
            setProductFormError(err?.message ?? "Unable to save product.");
        } finally {
            setProductSaving(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        async function fetchRows(endpoint) {
            const response = await apiFetch(`${API_BASE}/${endpoint}`, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(`${endpoint}: HTTP ${response.status}`);
            }

            const payload = await response.json();
            const rows = Array.isArray(payload)
                ? payload
                : payload?.$values ?? payload?.items ?? payload?.data;

            if (!Array.isArray(rows)) {
                throw new Error(`${endpoint}: unexpected response format`);
            }
            return rows;
        }

        async function loadDashboard() {
            setLoading(true);
            setError("");
            try {
                const results = await Promise.allSettled([
                    fetchRows("Products"),
                    fetchRows("Sales"),
                    fetchRows("Categories"),
                    fetchRows("Suppliers"),
                    fetchRows("StockMovements"),
                ]);
                if (!active) return;

                const [productResult, saleResult, categoryResult, supplierResult, stockResult] = results;
                const errors = [];
                const categoryNames = new Map();
                if (categoryResult.status === "fulfilled") {
                    setCategories(categoryResult.value.map((category) => ({
                        id: category.categoryId ?? category.CategoryId ?? category.id,
                        name: category.name ?? category.Name ?? "Unnamed category",
                        description: category.description ?? category.Description ?? "",
                    })));
                    setCategoriesError("");
                } else {
                    setCategories([]);
                    setCategoriesError(categoryResult.reason?.message ?? "Could not load categories");
                }

                if (supplierResult.status === "fulfilled") {
                    setSuppliers(supplierResult.value.map((supplier) => ({
                        id: supplier.supplierId ?? supplier.SupplierId ?? supplier.id,
                        name: supplier.name ?? supplier.Name ?? "Unnamed supplier",
                        phone: supplier.phone ?? supplier.Phone ?? "",
                        email: supplier.email ?? supplier.Email ?? "",
                        address: supplier.address ?? supplier.Address ?? "",
                    })));
                    setSuppliersError("");
                } else {
                    setSuppliers([]);
                    setSuppliersError(supplierResult.reason?.message ?? "Could not load suppliers");
                }

                if (categoryResult.status === "fulfilled") {
                    for (const category of categoryResult.value) {
                        categoryNames.set(
                            Number(category.categoryId ?? category.CategoryId),
                            category.name ?? category.Name ?? "—"
                        );
                    }
                } else {
                    errors.push(`Categories: ${categoryResult.reason?.message ?? "failed"}`);
                }

                if (productResult.status === "fulfilled") {
                    setProducts(normalizeProducts(productResult.value, categoryNames));
                } else {
                    setProducts([]);
                    errors.push(`Products: ${productResult.reason?.message ?? "failed"}`);
                }

                if (saleResult.status === "fulfilled") {
                    setSales(normalizeSales(saleResult.value));
                    setSalesError("");
                } else {
                    setSales([]);
                    setSalesError(saleResult.reason?.message ?? "Could not load sales");
                    errors.push(`Sales: ${saleResult.reason?.message ?? "failed"}`);
                }
                if (stockResult.status === "fulfilled") {
                    setStockMovements(stockResult.value.map((movement) => ({
                        id: movement.movementId ?? movement.MovementId,
                        productId: movement.productId ?? movement.ProductId,
                        productName: movement.productName ?? movement.ProductName ?? "—",
                        userName: movement.userName ?? movement.UserName ?? "—",
                        type: movement.movementType ?? movement.MovementType ?? "—",
                        quantity: Number(movement.quantity ?? movement.Quantity ?? 0),
                        date: movement.movementDate ?? movement.MovementDate,
                        notes: movement.notes ?? movement.Notes ?? "",
                    })));
                    setStockError("");
                } else {
                    setStockMovements([]);
                    setStockError(stockResult.reason?.message ?? "Could not load stock movements");
                }
                setError(errors.join(" | "));
            } catch (err) {
                if (active) setError(err?.message ?? "Could not load data");
            } finally {
                if (active) setLoading(false);
            }
        }

        if (session?.token) loadDashboard();
        return () => {
            active = false;
            controller.abort();
        };
    }, [session?.token, apiFetch]);

    const filteredProducts = products.filter((product) =>
        `${product.name} ${product.sku} ${product.category}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    const filteredCategories = categories.filter((category) =>
        `${category.name} ${category.description}`.toLowerCase().includes(categorySearch.toLowerCase())
    );

    const filteredSuppliers = suppliers.filter((supplier) =>
        `${supplier.name} ${supplier.phone} ${supplier.email} ${supplier.address}`
            .toLowerCase()
            .includes(supplierSearch.toLowerCase())
    );

    const filteredSales = sales.filter((sale) =>
        `${sale.id} ${sale.userName} ${sale.userId ?? ""} ${sale.date ?? ""} ${sale.totalAmount}`
            .toLowerCase()
            .includes(salesSearch.toLowerCase().trim())
    );

    const filteredStockMovements = stockMovements.filter((movement) =>
        `${movement.id} ${movement.productId} ${movement.productName} ${movement.userName} ${movement.type} ${movement.quantity} ${movement.date ?? ""} ${movement.notes}`
            .toLowerCase()
            .includes(stockSearch.toLowerCase().trim())
    );

    const salesTotal = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    const lowStockProducts = products.filter(
        (product) => product.quantity <= product.minStockLevel
    );

    const filteredUsers = users.filter(u =>
        `${u.id} ${u.fullName} ${u.email} ${u.role}`.toLowerCase().includes(usersSearch.toLowerCase())
    );

    const currentPage = navigation.find(
        (item) => item.id === activePage
    );

    if (!session) {
        return (
            <main className="sm-login-page">
                <style>{`
                    .sm-login-page { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); background: #fff; color: #17243b; font-family: inherit; }
                    .sm-login-visual { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: clamp(22px, 3vw, 46px); min-width: 0; background: linear-gradient(140deg, #0c1c3c 0%, #132e64 55%, #194b9d 100%); color: white; isolation: isolate; }
                    .sm-login-visual::before { content: ''; position: absolute; z-index: -1; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(75,147,255,.38), transparent 68%); right: -250px; top: 12%; }
                    .sm-login-visual::after { content: ''; position: absolute; z-index: -1; width: 440px; height: 440px; border: 1px solid rgba(255,255,255,.12); border-radius: 48px; transform: rotate(35deg); right: -120px; bottom: 10%; }
                    .sm-login-logo { display: flex; align-items: center; gap: 13px; font-size: 22px; font-weight: 750; letter-spacing: -.6px; }
                    .sm-login-mark { width: 43px; height: 43px; border-radius: 13px; display: grid; place-items: center; background: #3978ff; color: white; font-size: 25px; font-weight: 800; box-shadow: 0 8px 24px rgba(20,60,150,.25); }
                    .sm-login-story { max-width: 530px; margin: 20px auto; width: 100%; }
                    .sm-login-eyebrow { display: inline-flex; padding: 9px 13px; border-radius: 100px; background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.14); font-size: 12px; letter-spacing: 1.1px; font-weight: 700; text-transform: uppercase; }
                    .sm-login-story h2 { font-size: clamp(30px, 3.1vw, 46px); line-height: 1.14; letter-spacing: -1.4px; margin: 16px 0 14px; font-weight: 800; color: #ffffff; }
                    .sm-login-story h2 span { color: #85b8ff; }
                    .sm-login-story p { font-size: 14px; line-height: 1.55; color: #c5d5f1; max-width: 460px; }
                    .sm-login-preview { margin-top: 18px; padding: 14px; border: 1px solid rgba(255,255,255,.16); border-radius: 20px; background: rgba(255,255,255,.09); box-shadow: 0 18px 48px rgba(0,0,0,.12); backdrop-filter: blur(12px); max-width: 410px; }
                    .sm-login-preview-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #e2edff; margin-bottom: 10px; }
                    .sm-login-preview-bars { height: 55px; display: flex; align-items: flex-end; gap: 12px; }
                    .sm-login-preview-bars i { flex: 1; border-radius: 7px 7px 3px 3px; background: linear-gradient(180deg, #87bbff, #3677ed); opacity: .9; }
                    .sm-login-preview-note { margin-top: 8px; color: #bfd4f5; font-size: 12px; }
                    .sm-login-foot { color: #9eb7df; font-size: 13px; }
                    .sm-login-right { display: flex; align-items: center; justify-content: center; padding: 22px clamp(20px, 4vw, 56px); background: #fff; min-width: 0; }
                    .sm-login-panel { width: 100%; max-width: 430px; }
                    .sm-login-mobile-brand { display: none; }
                    .sm-login-welcome { color: #2763e7; font-size: 12px; letter-spacing: 1.5px; font-weight: 800; text-transform: uppercase; margin: 0 0 14px; }
                    .sm-login-panel h1 { margin: 0; font-size: clamp(27px, 2.5vw, 36px); letter-spacing: -1.5px; line-height: 1.2; color: #14233e; }
                    .sm-login-subtitle { margin: 10px 0 22px; color: #73819a; line-height: 1.7; font-size: 15px; }
                    .sm-login-field { display: block; margin-bottom: 15px; }
                    .sm-login-field-label { display: block; margin-bottom: 9px; font-size: 13px; font-weight: 700; color: #283650; }
                    .sm-login-input-wrap { position: relative; display: flex; align-items: center; }
                    .sm-login-input { width: 100%; height: 46px; padding: 0 16px; border: 1px solid #d9e1ed; background: #f9fbfe; color: #17243b; border-radius: 11px; font-size: 15px; outline: none; transition: border-color .2s, box-shadow .2s; }
                    .sm-login-input:focus { border-color: #3a73ed; background: white; box-shadow: 0 0 0 4px rgba(58,115,237,.12); }
                    .sm-login-input::placeholder { color: #9aa7b9; }
                    .sm-login-password-input { padding-right: 82px; }
                    .sm-login-toggle { position: absolute; right: 9px; border: 0; background: transparent; padding: 10px; color: #2c65d7; font-size: 12px; font-weight: 750; cursor: pointer; }
                    .sm-login-error { padding: 12px 14px; border-radius: 10px; background: #fff1f2; color: #b42335; border: 1px solid #fecdd3; font-size: 13px; margin: 0 0 18px; overflow-wrap: anywhere; }
                    .sm-login-submit { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 47px; background: #2866ed; color: white; border: none; border-radius: 11px; font-size: 15px; font-weight: 750; cursor: pointer; box-shadow: 0 12px 25px rgba(40,102,237,.22); transition: background .2s, transform .2s; }
                    .sm-login-submit:hover:not(:disabled) { background: #1954d5; transform: translateY(-1px); }
                    .sm-login-submit:disabled { opacity: .7; cursor: wait; }
                    .sm-login-secure { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #8b98aa; font-size: 12px; }
                    .sm-login-secure svg { flex-shrink: 0; }
                    @media (min-width: 851px) and (max-height: 760px) { .sm-login-page { height: 100dvh; } .sm-login-visual { padding: 18px 32px; } .sm-login-logo { font-size: 19px; } .sm-login-mark { width: 36px; height: 36px; font-size: 21px; } .sm-login-story { margin: 10px auto; } .sm-login-eyebrow { padding: 6px 10px; font-size: 10px; } .sm-login-story h2 { font-size: clamp(27px, 3vw, 38px); margin: 10px 0; } .sm-login-story p { font-size: 13px; line-height: 1.45; } .sm-login-preview { margin-top: 10px; padding: 11px; } .sm-login-preview-bars { height: 38px; } .sm-login-preview-head { margin-bottom: 6px; } .sm-login-preview-note { margin-top: 6px; } .sm-login-foot { font-size: 11px; } .sm-login-right { padding-top: 14px; padding-bottom: 14px; } .sm-login-welcome { margin-bottom: 8px; } .sm-login-panel h1 { font-size: 29px; } .sm-login-subtitle { margin: 8px 0 16px; font-size: 13px; } .sm-login-field { margin-bottom: 12px; } .sm-login-field-label { margin-bottom: 5px; } .sm-login-input { height: 43px; } .sm-login-submit { min-height: 44px; } .sm-login-secure { margin-top: 10px; } }
                    @media (min-width: 851px) and (max-height: 600px) { .sm-login-preview { display: none; } .sm-login-story { margin: 8px auto; } .sm-login-story h2 { font-size: 28px; } }
                    @media (max-width: 850px) { .sm-login-page { grid-template-columns: 1fr; } .sm-login-visual { display: none; } .sm-login-right { min-height: 100vh; padding: 35px 22px; background: #f6f9ff; } .sm-login-panel { padding: 32px 26px; background: white; border: 1px solid #edf1f7; border-radius: 20px; box-shadow: 0 16px 45px rgba(23,45,90,.06); } .sm-login-mobile-brand { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 800; margin-bottom: 35px; } }
                    @media (max-width: 420px) { .sm-login-panel { padding: 28px 20px; } .sm-login-panel h1 { font-size: 30px; } }
                `}</style>
                <section className="sm-login-visual" aria-label="StockMaster introduction">
                    <div className="sm-login-logo"><span className="sm-login-mark">S</span>StockMaster</div>
                    <div className="sm-login-story">
                        <span className="sm-login-eyebrow">Inventory management platform</span>
                        <h2>Manage your inventory <span>with confidence.</span></h2>
                        <p>Keep products, sales, suppliers, and stock movements connected in one organized workspace.</p>
                        <div className="sm-login-preview" aria-hidden="true">
                            <div className="sm-login-preview-head"><strong>Inventory overview</strong><span>● &nbsp; Your workspace</span></div>
                            <div className="sm-login-preview-bars">
                                {[42, 67, 54, 81, 64, 91, 73, 100].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
                            </div>
                            <div className="sm-login-preview-note">A clearer view of your business, all in one place.</div>
                        </div>
                    </div>
                    <div className="sm-login-foot">© {new Date().getFullYear()} StockMaster · Built for better inventory control</div>
                </section>
                <section className="sm-login-right">
                    <div className="sm-login-panel">
                        <div className="sm-login-mobile-brand"><span className="sm-login-mark">S</span>StockMaster</div>
                        <p className="sm-login-welcome">Welcome back</p>
                        <h1>Sign in to StockMaster</h1>
                        <p className="sm-login-subtitle">Enter your account details to access your inventory workspace.</p>
                        <form onSubmit={login}>
                            <label className="sm-login-field">
                                <span className="sm-login-field-label">Email address</span>
                                <span className="sm-login-input-wrap">
                                    <input className="sm-login-input" type="email" required autoComplete="username" placeholder="name@company.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} disabled={loginBusy} />
                                </span>
                            </label>
                            <label className="sm-login-field">
                                <span className="sm-login-field-label">Password</span>
                                <span className="sm-login-input-wrap">
                                    <input className="sm-login-input sm-login-password-input" type={showLoginPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} disabled={loginBusy} />
                                    <button className="sm-login-toggle" type="button" aria-label={showLoginPassword ? "Hide password" : "Show password"} aria-pressed={showLoginPassword} onClick={() => setShowLoginPassword(!showLoginPassword)}>{showLoginPassword ? "Hide" : "Show"}</button>
                                </span>
                            </label>
                            {loginError && <p className="sm-login-error" role="alert">{loginError}</p>}
                            <button className="sm-login-submit" type="submit" disabled={loginBusy}>{loginBusy ? "Signing in..." : "Sign in to workspace"}<span aria-hidden="true">→</span></button>
                        </form>
                        <div className="sm-login-secure">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                            Secure sign-in · Authorized users only
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    const currentUser = session.user;
    const currentName = currentUser.fullName ?? currentUser.FullName ?? "User";
    const currentRole = currentUser.role ?? currentUser.Role ?? "Employee";

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-icon">S</div>
                    <div>
                        <strong>StockMaster</strong>
                        <span>Inventory Management</span>
                    </div>
                </div>

                <div className="menu-label">WORKSPACE</div>

                <nav className="navigation">
                    {navigation.filter(item => !item.adminOnly || isAdmin).map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${activePage === item.id ? "active" : ""
                                }`}
                            onClick={() => setActivePage(item.id)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <div className="sidebar-help">
                        <strong>Manage smarter</strong>
                        <p>Keep your inventory organized in one place.</p>
                    </div>

                    <div className="profile">
                        <div className="avatar">AD</div>
                        <div>
                            <strong>{currentName}</strong>
                            <span>{currentRole}</span>
                        </div>
                        <button type="button" className="outline-button" onClick={logout}>Log out</button>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div className="breadcrumb">
                        Workspace <span>/</span>
                        <strong>{currentPage?.label}</strong>
                    </div>

                    <div className="topbar-right">
                        <span className="demo-label">StockMaster</span>
                        <div className="top-avatar">{currentName.slice(0, 2).toUpperCase()}</div>
                    </div>
                </header>

                <div className="page-content">
                    {activePage === "dashboard" ? (
                        <>
                            <div className="page-heading">
                                <div>
                                    <div className="eyebrow">OVERVIEW</div>
                                    <h1>Dashboard</h1>
                                    <p>
                                        Welcome back! Here's what's happening with
                                        your inventory.
                                    </p>
                                </div>
                                <span className="preview-tag">
                                    {loading ? "● Loading data" : error ? "● API unavailable" : "● Live API data"}
                                </span>
                            </div>

                            {error && <div role="alert" style={{ padding: 16, marginBottom: 20, background: "#fff2e6", borderRadius: 8, color: "#92400e" }}>
                                Could not load live data: {error}. Check that the API is running and the Vite proxy is configured.
                            </div>}
                            <section className="stats-grid">
                                <StatCard
                                    label="Total Products"
                                    value={products.length}
                                    icon="▣"
                                    note="Products in catalog"
                                    tone="blue"
                                />
                                <StatCard
                                    label="Total Sales"
                                    value={loading ? "…" : error ? "—" : sales.length}
                                    icon="▤"
                                    note="Sales recorded in database"
                                    tone="purple"
                                />
                                <StatCard
                                    label="Inventory Value"
                                    value={money(
                                        products.reduce(
                                            (sum, p) => sum + p.price * p.quantity,
                                            0
                                        )
                                    )}
                                    icon="$"
                                    note="Based on product selling prices"
                                    tone="green"
                                />
                                <StatCard
                                    label="Low Stock Items"
                                    value={lowStockProducts.length}
                                    icon="!"
                                    note="Products needing attention"
                                    tone="orange"
                                />
                            </section>

                            <section className="dashboard-grid">
                                <div className="panel">
                                    <div className="panel-header">
                                        <div>
                                            <h2>Inventory Overview</h2>
                                            <p>Current stock distribution</p>
                                        </div>
                                        <span className="small-tag">Live data</span>
                                    </div>

                                    <div className="inventory-chart">
                                        {products.map((product) => (
                                            <div className="chart-row" key={product.id}>
                                                <div className="chart-label">
                                                    <span>{product.name}</span>
                                                    <strong>{product.quantity}</strong>
                                                </div>
                                                <div className="chart-track">
                                                    <div
                                                        className="chart-fill"
                                                        style={{
                                                            width: `${Math.min(100, Math.max(0, (product.quantity / Math.max(1, ...products.map(p => p.quantity))) * 100))}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="panel">
                                    <div className="panel-header">
                                        <div>
                                            <h2>Stock Alerts</h2>
                                            <p>Items that need your attention</p>
                                        </div>
                                        <span className="alert-count">
                                            {lowStockProducts.length}
                                        </span>
                                    </div>

                                    <div className="alerts-list">
                                        {lowStockProducts.length === 0 && <div className="empty-state">No low-stock products.</div>}
                                        {lowStockProducts.map((product) => (
                                            <div className="alert-item" key={product.id}>
                                                <div className="alert-icon">!</div>
                                                <div>
                                                    <strong>{product.name}</strong>
                                                    <p>{product.sku}</p>
                                                </div>
                                                <span className="alert-quantity">
                                                    {product.quantity} left
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        className="text-button"
                                        onClick={() => setActivePage("products")}
                                    >
                                        View all products →
                                    </button>
                                </div>
                            </section>

                            <ProductsTable
                                products={filteredProducts}
                                search={search}
                                setSearch={setSearch}
                                onViewAll={() => setActivePage("products")}
                            />
                        </>
                    ) : activePage === "products" ? (
                        <>
                            <div className="page-heading">
                                <div>
                                    <div className="eyebrow">INVENTORY</div>
                                    <h1>Products</h1>
                                    <p>Browse your product catalog.</p>
                                </div>
                                <span className="preview-tag">
                                    {loading ? "● Loading data" : error ? "● API unavailable" : "● Live API data"}
                                </span>
                            </div>

                            {productNotice && <div role="status" style={{ padding: 14, marginBottom: 16, background: "#e9f8f0", borderRadius: 10, color: "#166534" }}>{productNotice}</div>}
                            <ProductsTable
                                products={filteredProducts}
                                search={search}
                                setSearch={setSearch}
                                onAdd={() => openProductEditor()}
                                onEdit={openProductEditor}
                                view={productView}
                                onViewChange={setProductView}
                            />
                        </>
                    ) : activePage === "categories" ? (
                        <>
                            <div className="page-heading">
                                <div>
                                    <div className="eyebrow">INVENTORY</div>
                                    <h1>Categories</h1>
                                    <p>Explore the categories in your inventory.</p>
                                </div>
                                <span className="preview-tag">
                                    {loading ? "● Loading data" : categoriesError ? "● API unavailable" : "● Live API data"}
                                </span>
                            </div>
                            {categoriesError && (
                                <div role="alert" style={{ padding: 16, marginBottom: 20, background: "#fff2e6", borderRadius: 8, color: "#92400e" }}>
                                    Could not load categories: {categoriesError}. Check that the API is running.
                                </div>
                            )}
                            <section className="panel products-panel">
                                <div className="panel-header products-header">
                                    <div>
                                        <h2>Categories Overview</h2>
                                        <p>Categories from the StockMaster database</p>
                                    </div>
                                    <button type="button" className="primary-button" onClick={() => openCategoryEditor()}>+ Add Category</button>
                                </div>
                                {categoryNotice && <div role="status" style={{ padding: 14, margin: "0 16px 12px", background: "#e9f8f0", borderRadius: 10, color: "#166534" }}>{categoryNotice}</div>}
                                <div className="table-toolbar">
                                    <input
                                        type="search"
                                        placeholder="Search categories..."
                                        aria-label="Search categories"
                                        value={categorySearch}
                                        onChange={(event) => setCategorySearch(event.target.value)}
                                    />
                                    <span>{filteredCategories.length} categories</span>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>CATEGORY</th>
                                                <th>DESCRIPTION</th>
                                                <th>PRODUCTS</th>
                                                <th>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCategories.map((category) => (
                                                <tr key={category.id}>
                                                    <td className="product-name">
                                                        <div className="product-cell">
                                                            <div className="product-thumbnail">▦</div>
                                                            {category.name}
                                                        </div>
                                                    </td>
                                                    <td>{category.description || "—"}</td>
                                                    <td>{products.filter((product) => Number(product.categoryId) === Number(category.id)).length}</td>
                                                    <td><div style={{ display: "flex", gap: 8 }}>
                                                        <button type="button" className="outline-button" onClick={() => openCategoryEditor(category)}>Edit</button>
                                                        <button type="button" className="outline-button" disabled={categoryDeleting !== null} onClick={() => deleteCategory(category)} style={{ color: "#b91c1c" }}>{categoryDeleting === category.id ? "Deleting..." : "Delete"}</button>
                                                    </div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!loading && !categoriesError && filteredCategories.length === 0 && (
                                        <div className="empty-state">
                                            {categorySearch ? "No categories match your search." : "No categories to display."}
                                        </div>
                                    )}
                                    {loading && <div className="empty-state">Loading categories...</div>}
                                </div>
                            </section>
                        </>
                    ) : activePage === "suppliers" ? (
                        <>
                            <div className="page-heading">
                                <div>
                                    <div className="eyebrow">INVENTORY</div>
                                    <h1>Suppliers</h1>
                                    <p>Browse the suppliers in your inventory.</p>
                                </div>
                                <span className="preview-tag">
                                    {loading ? "● Loading data" : suppliersError ? "● API unavailable" : "● Live API data"}
                                </span>
                            </div>
                            {suppliersError && (
                                <div role="alert" style={{ padding: 16, marginBottom: 20, background: "#fff2e6", borderRadius: 8, color: "#92400e" }}>
                                    {suppliersError}
                                </div>
                            )}
                            <section className="panel products-panel">
                                <div className="panel-header products-header">
                                    <div>
                                        <h2>Suppliers Overview</h2>
                                        <p>Suppliers from the StockMaster database</p>
                                    </div>
                                    <button type="button" className="primary-button" onClick={() => openSupplierEditor()}>+ Add Supplier</button>
                                </div>
                                {supplierNotice && <div role="status" style={{ padding: 14, margin: "0 16px 12px", background: "#e9f8f0", borderRadius: 10, color: "#166534" }}>{supplierNotice}</div>}
                                <div className="table-toolbar">
                                    <input
                                        type="search"
                                        placeholder="Search suppliers..."
                                        aria-label="Search suppliers"
                                        value={supplierSearch}
                                        onChange={(event) => setSupplierSearch(event.target.value)}
                                    />
                                    <span>{filteredSuppliers.length} suppliers</span>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>SUPPLIER</th>
                                                <th>PHONE</th>
                                                <th>EMAIL</th>
                                                <th>ADDRESS</th>
                                                <th>PRODUCTS</th>
                                                <th>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSuppliers.map((supplier) => (
                                                <tr key={supplier.id}>
                                                    <td className="product-name">
                                                        <div className="product-cell">
                                                            <div className="product-thumbnail">♧</div>
                                                            {supplier.name}
                                                        </div>
                                                    </td>
                                                    <td>{supplier.phone || "—"}</td>
                                                    <td>{supplier.email || "—"}</td>
                                                    <td>{supplier.address || "—"}</td>
                                                    <td>{products.filter((product) => Number(product.supplierId) === Number(supplier.id)).length}</td>
                                                    <td><div style={{ display: "flex", gap: 8 }}>
                                                        <button type="button" className="outline-button" onClick={() => openSupplierEditor(supplier)}>Edit</button>
                                                        <button type="button" className="outline-button" disabled={supplierDeleting !== null} onClick={() => deleteSupplier(supplier)} style={{ color: "#b91c1c" }}>{supplierDeleting === supplier.id ? "Deleting..." : "Delete"}</button>
                                                    </div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!loading && !suppliersError && filteredSuppliers.length === 0 && (
                                        <div className="empty-state">
                                            {supplierSearch ? "No suppliers match your search." : "No suppliers to display."}
                                        </div>
                                    )}
                                    {loading && <div className="empty-state">Loading suppliers...</div>}
                                </div>
                            </section>
                        </>
                    ) : activePage === "sales" ? (
                        <>
                            <div className="page-heading">
                                <div>
                                    <div className="eyebrow">SALES</div>
                                    <h1>Sales</h1>
                                    <p>Review and create local development sales.</p>
                                </div>
                                <span className="preview-tag">
                                    {loading ? "● Loading data" : salesError ? "● API unavailable" : "● Live API data"}
                                </span>
                            </div>
                            {salesError && (
                                <div role="alert" style={{ padding: 16, marginBottom: 20, background: "#fff2e6", borderRadius: 8, color: "#92400e" }}>
                                    Could not load sales: {salesError}. Check that the API is running.
                                </div>
                            )}
                            <section className="stats-grid" style={{ marginBottom: 24 }}>
                                <StatCard label="Total Sales" value={loading ? "…" : salesError ? "—" : sales.length} icon="▤" note="Recorded invoices" tone="blue" />
                                <StatCard label="Sales Revenue" value={loading || salesError ? "—" : money(salesTotal)} icon="$" note="Total amount of recorded sales" tone="green" />
                            </section>
                            <section className="panel products-panel">
                                <div className="panel-header products-header">
                                    <div>
                                        <h2>Sales Overview</h2>
                                        <p>Sales from the StockMaster database</p>
                                    </div>
                                    <button type="button" className="primary-button" onClick={openSaleEditor} disabled={loading || !!salesError || !!error || products.length === 0}>+ New Sale</button>
                                </div>
                                {saleNotice && <div role="status" style={{ padding: 14, margin: "12px 16px", background: "#e7f8ee", color: "#166534", borderRadius: 8 }}>{saleNotice}</div>}
                                <div className="table-toolbar">
                                    <input
                                        type="search"
                                        placeholder="Search sales by ID, user, date or amount..."
                                        aria-label="Search sales"
                                        value={salesSearch}
                                        onChange={(event) => setSalesSearch(event.target.value)}
                                    />
                                    <span>{filteredSales.length} sales</span>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>SALE ID</th>
                                                <th>DATE</th>
                                                <th>USER</th>
                                                <th>TOTAL AMOUNT</th>
                                                <th>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSales.map((sale) => (
                                                <tr key={sale.id}>
                                                    <td className="product-name">
                                                        <div className="product-cell">
                                                            <div className="product-thumbnail">▤</div>
                                                            #{sale.id}
                                                        </div>
                                                    </td>
                                                    <td>{formatSaleDate(sale.date)}</td>
                                                    <td>{sale.userName}</td>
                                                    <td className="product-name">{money(sale.totalAmount)}</td>
                                                    <td><button type="button" className="outline-button" onClick={() => openSaleDetails(sale.id)}>View Details</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {loading && <div className="empty-state">Loading sales...</div>}
                                    {!loading && !salesError && filteredSales.length === 0 && (
                                        <div className="empty-state">
                                            {salesSearch ? "No sales match your search." : "No sales to display."}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </>
                    ) : activePage === "stock" ? (
                        <>
                            <div className="page-heading">
                                <div>
                                    <span className="eyebrow">INVENTORY</span>
                                    <h1>Stock Movements</h1>
                                    <p>Review and record local development stock movements.</p>
                                </div>
                                <span className="preview-tag">
                                    {loading ? "● Loading data" : stockError ? "● API unavailable" : "● Live API data"}
                                </span>
                            </div>
                            {stockError && (
                                <div className="error-banner">
                                    Could not load stock movements: {stockError}. Check that the API is running.
                                </div>
                            )}
                            <section className="panel products-panel">
                                <div className="panel-header products-header">
                                    <div>
                                        <h2>Stock Movements Overview</h2>
                                        <p>Stock history from the StockMaster database</p>
                                    </div>
                                    <button type="button" className="primary-button" onClick={openStockEditor} disabled={loading || !!stockError || products.length === 0}>+ New Movement</button>
                                </div>
                                {stockNotice && <div role="status" style={{ padding: 14, margin: "12px 16px", background: "#e7f8ee", color: "#166534", borderRadius: 8 }}>{stockNotice}</div>}
                                <div className="table-toolbar">
                                    <input
                                        type="search"
                                        placeholder="Search movements by product, user, type or notes..."
                                        aria-label="Search stock movements"
                                        value={stockSearch}
                                        onChange={(event) => setStockSearch(event.target.value)}
                                    />
                                    <span>{filteredStockMovements.length} movements</span>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>MOVEMENT ID</th>
                                                <th>PRODUCT</th>
                                                <th>TYPE</th>
                                                <th>QUANTITY</th>
                                                <th>DATE</th>
                                                <th>USER</th>
                                                <th>NOTES</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStockMovements.map((movement) => (
                                                <tr key={movement.id}>
                                                    <td className="product-name">#{movement.id}</td>
                                                    <td className="product-name">{movement.productName}</td>
                                                    <td>{movement.type}</td>
                                                    <td>{movement.quantity}</td>
                                                    <td>{formatSaleDate(movement.date)}</td>
                                                    <td>{movement.userName}</td>
                                                    <td>{movement.notes || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {loading && <div className="empty-state">Loading stock movements...</div>}
                                    {!loading && !stockError && filteredStockMovements.length === 0 && (
                                        <div className="empty-state">
                                            {stockSearch ? "No movements match your search." : "No stock movements to display."}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </>
                    ) : activePage === "users" && isAdmin ? (
                        <>
                            <div className="page-heading">
                                <div><div className="eyebrow">ADMINISTRATION</div><h1>User Management</h1><p>Manage employee accounts, roles, and access.</p></div>
                                <span className="preview-tag">● Admin only</span>
                            </div>
                            {usersError && <div role="alert" style={{ padding: 14, marginBottom: 16, background: "#fff1f2", color: "#9f1239", borderRadius: 10 }}>{usersError}</div>}
                            {usersNotice && <div role="status" style={{ padding: 14, marginBottom: 16, background: "#e9f8f0", color: "#166534", borderRadius: 10 }}>{usersNotice}</div>}
                            <section className="panel products-panel">
                                <div className="panel-header products-header">
                                    <div><h2>Users Overview</h2><p>Authorized StockMaster accounts</p></div>
                                    <button type="button" className="primary-button" onClick={() => openUserEditor()}>+ Add User</button>
                                </div>
                                <div className="table-toolbar">
                                    <input type="search" placeholder="Search users..." aria-label="Search users" value={usersSearch} onChange={e => setUsersSearch(e.target.value)} />
                                    <span>{filteredUsers.length} users</span>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead><tr><th>USER</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                                        <tbody>{filteredUsers.map(user => (
                                            <tr key={user.id}>
                                                <td className="product-name"><div className="product-cell"><div className="product-thumbnail">♙</div>{user.fullName}</div></td>
                                                <td>{user.email}</td><td>{user.role}</td>
                                                <td><span className={`status ${user.isActive ? "available" : "low"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
                                                <td><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    <button type="button" className="outline-button" onClick={() => openUserEditor(user)}>Edit</button>
                                                    <button type="button" className="outline-button" disabled={userStatusSaving !== null || Number(user.id) === Number(session.user.userId ?? session.user.UserId)} onClick={() => toggleUserStatus(user)}>{userStatusSaving === user.id ? "Saving..." : user.isActive ? "Deactivate" : "Activate"}</button>
                                                </div></td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                    {usersLoading && <div className="empty-state">Loading users...</div>}
                                    {!usersLoading && !usersError && filteredUsers.length === 0 && <div className="empty-state">No users to display.</div>}
                                </div>
                            </section>
                        </>
                    ) : (
                        <div className="placeholder-page">
                            <div className="placeholder-icon">▦</div>
                            <h1>{currentPage?.label}</h1>
                            <p>
                                This section is ready for the next development
                                stage. We'll connect it to the StockMaster API.
                            </p>
                            <button
                                className="primary-button"
                                onClick={() => setActivePage("dashboard")}
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </main>
            {userEditor && isAdmin && (
                <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <section role="dialog" aria-modal="true" aria-label={userEditor.id === null ? "Add User" : "Edit User"} style={{ background: "white", width: "min(500px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
                        <h2 style={{ marginTop: 0 }}>{userEditor.id === null ? "Add User" : "Edit User"}</h2>
                        <form onSubmit={saveUser}>
                            {[["fullName", "Full Name", "text"], ["email", "Email", "email"]].map(([field, label, type]) => (
                                <label key={field} style={{ display: "grid", gap: 7, marginBottom: 16 }}>{label}
                                    <input type={type} required maxLength={150} value={userEditor[field]} onChange={e => setUserEditor(u => ({ ...u, [field]: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }} />
                                </label>
                            ))}
                            <label style={{ display: "grid", gap: 7, marginBottom: 16 }}>Role
                                <select value={userEditor.role} onChange={e => setUserEditor(u => ({ ...u, role: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }}><option value="Employee">Employee</option><option value="Admin">Admin</option></select>
                            </label>
                            {userEditor.id === null && <label style={{ display: "grid", gap: 7, marginBottom: 16 }}>Initial Password
                                <input type="password" required autoComplete="new-password" value={userEditor.password} onChange={e => setUserEditor(u => ({ ...u, password: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }} />
                            </label>}
                            {userFormError && <div role="alert" style={{ padding: 12, borderRadius: 8, background: "#fff1f2", color: "#9f1239" }}>{userFormError}</div>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                <button type="button" className="outline-button" disabled={userSaving} onClick={() => setUserEditor(null)}>Cancel</button>
                                <button type="submit" className="primary-button" disabled={userSaving}>{userSaving ? "Saving..." : userEditor.id === null ? "Create User" : "Save Changes"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
            {stockEditor && (
                <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <section role="dialog" aria-modal="true" aria-label="New Stock Movement" style={{ background: "white", width: "min(520px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
                        <h2 style={{ marginTop: 0 }}>New Stock Movement</h2>
                        <p style={{ color: "#64748b" }}>Local testing only. Saving will update the connected database's stock quantity.</p>
                        <form onSubmit={saveStockMovement}>
                            <label style={{ display: "grid", gap: 7, marginBottom: 16 }}>Product
                                <select required value={stockEditor.productId} onChange={e => setStockEditor(current => ({ ...current, productId: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8, width: "100%" }}>
                                    <option value="">Select product</option>
                                    {products.map(product => <option key={product.id} value={product.id}>{product.name} — {product.quantity} in stock</option>)}
                                </select>
                            </label>
                            <label style={{ display: "grid", gap: 7, marginBottom: 16 }}>Movement Type
                                <select value={stockEditor.movementType} onChange={e => setStockEditor(current => ({ ...current, movementType: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }}>
                                    <option value="IN">IN — Receive stock</option>
                                    <option value="OUT">OUT — Remove stock</option>
                                </select>
                            </label>
                            <label style={{ display: "grid", gap: 7, marginBottom: 16 }}>Quantity
                                <input required type="number" min="1" max="2147483647" step="1" value={stockEditor.quantity} onChange={e => setStockEditor(current => ({ ...current, quantity: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }} />
                            </label>
                            <label style={{ display: "grid", gap: 7, marginBottom: 16 }}>Notes (optional)
                                <textarea rows={3} value={stockEditor.notes} onChange={e => setStockEditor(current => ({ ...current, notes: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8, resize: "vertical" }} />
                            </label>
                            {stockFormError && <div role="alert" style={{ padding: 12, borderRadius: 8, background: "#fff1f2", color: "#9f1239", overflowWrap: "anywhere" }}>{stockFormError}</div>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                <button type="button" className="outline-button" disabled={stockSaving} onClick={() => setStockEditor(null)}>Cancel</button>
                                <button type="submit" className="primary-button" disabled={stockSaving}>{stockSaving ? "Saving..." : "Create Movement"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
            {saleDetails && (
                <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <section role="dialog" aria-modal="true" aria-label={`Sale #${saleDetails.id} details`} style={{ background: "white", width: "min(760px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 }}>
                            <div>
                                <div className="eyebrow">SALES / INVOICE</div>
                                <h2 style={{ margin: "6px 0 0" }}>Sale #{saleDetails.id}</h2>
                            </div>
                            <button type="button" className="outline-button" onClick={() => setSaleDetails(null)}>Close</button>
                        </div>
                        {saleDetailsLoading && <p role="status">Loading invoice details...</p>}
                        {saleDetailsError && <div role="alert" style={{ padding: 14, background: "#fff1f2", color: "#9f1239", borderRadius: 8 }}>{saleDetailsError}</div>}
                        {saleDetails.data && (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, padding: 18, borderRadius: 12, background: "#f8fafc", marginBottom: 22 }}>
                                    <div><div style={{ color: "#64748b", fontSize: 12 }}>Date</div><strong>{formatSaleDate(saleDetails.data.date)}</strong></div>
                                    <div><div style={{ color: "#64748b", fontSize: 12 }}>Created by</div><strong>{saleDetails.data.userName}</strong></div>
                                    <div><div style={{ color: "#64748b", fontSize: 12 }}>Total Amount</div><strong>{money(saleDetails.data.totalAmount)}</strong></div>
                                </div>
                                <h3 style={{ marginBottom: 12 }}>Invoice Items</h3>
                                <div className="table-scroll">
                                    <table>
                                        <thead><tr><th>PRODUCT</th><th>QUANTITY</th><th>UNIT PRICE</th><th>LINE TOTAL</th></tr></thead>
                                        <tbody>
                                            {saleDetails.data.items.map((item, index) => (
                                                <tr key={item.id ?? `${item.productId}-${index}`}>
                                                    <td className="product-name">{item.productName}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>{money(item.unitPrice)}</td>
                                                    <td className="product-name">{money(item.lineTotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20, fontSize: 18 }}>
                                    <span>Total:</span><strong>{money(saleDetails.data.totalAmount)}</strong>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}
            {saleEditor && (
                <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <section role="dialog" aria-modal="true" aria-label="New Sale" style={{ background: "white", width: "min(680px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
                        <h2 style={{ marginTop: 0 }}>New Sale</h2>
                        <p style={{ color: "#64748b" }}>Local development only. Confirming creates a real sale in the connected test database and deducts stock.</p>
                        <form onSubmit={saveSale}>
                            {saleEditor.items.map((item, index) => (
                                <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(100px,1fr) auto", gap: 10, alignItems: "end", marginBottom: 14 }}>
                                    <label style={{ display: "grid", gap: 6 }}>Product
                                        <select required value={item.productId} onChange={e => setSaleEditor(current => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, productId: e.target.value } : row) }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8, minWidth: 0 }}>
                                            <option value="">Select product</option>
                                            {products.filter(p => p.quantity > 0).map(p => <option key={p.id} value={p.id}>{p.name} — {p.quantity} in stock — {money(p.price)}</option>)}
                                        </select>
                                    </label>
                                    <label style={{ display: "grid", gap: 6 }}>Quantity
                                        <input type="number" min="1" max="2147483647" step="1" required value={item.quantity} onChange={e => setSaleEditor(current => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row) }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8, minWidth: 0 }} />
                                    </label>
                                    <button type="button" className="outline-button" disabled={saleEditor.items.length === 1 || saleSaving} onClick={() => setSaleEditor(current => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}>Remove</button>
                                </div>
                            ))}
                            <button type="button" className="outline-button" disabled={saleSaving || saleEditor.items.length >= products.length} onClick={() => setSaleEditor(current => ({ ...current, items: [...current.items, { productId: "", quantity: "1" }] }))}>+ Add Item</button>
                            <p style={{ marginTop: 18, fontWeight: 700 }}>Estimated total: {money(saleEditor.items.reduce((sum, item) => { const p = products.find(p => String(p.id) === String(item.productId)); return sum + (p?.price ?? 0) * (Number(item.quantity) || 0); }, 0))}</p>
                            {saleFormError && <div role="alert" style={{ padding: 12, borderRadius: 8, background: "#fff1f2", color: "#9f1239", overflowWrap: "anywhere" }}>{saleFormError}</div>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                <button type="button" className="outline-button" disabled={saleSaving} onClick={() => setSaleEditor(null)}>Cancel</button>
                                <button type="submit" className="primary-button" disabled={saleSaving}>{saleSaving ? "Creating..." : "Create Sale"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
            {supplierEditor && (
                <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <section role="dialog" aria-modal="true" aria-label={supplierEditor.id === null ? "Add Supplier" : "Edit Supplier"} style={{ background: "white", width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
                        <h2 style={{ marginTop: 0 }}>{supplierEditor.id === null ? "Add Supplier" : "Edit Supplier"}</h2>
                        <form onSubmit={saveSupplier}>
                            {[
                                ["name", "Supplier Name", "text", true, 100],
                                ["phone", "Phone", "tel", false, 50],
                                ["email", "Email", "email", false, 150],
                                ["address", "Address", "text", false, 250],
                            ].map(([field, label, type, required, maxLength]) => (
                                <label key={field} style={{ display: "grid", gap: 7, marginBottom: 16 }}>
                                    {label}
                                    <input type={type} required={required} maxLength={maxLength} value={supplierEditor[field]}
                                        onChange={e => setSupplierEditor(current => ({ ...current, [field]: e.target.value }))}
                                        style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }} />
                                </label>
                            ))}
                            {supplierFormError && <div role="alert" style={{ padding: 12, borderRadius: 8, background: "#fff1f2", color: "#9f1239", overflowWrap: "anywhere" }}>{supplierFormError}</div>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                <button type="button" className="outline-button" disabled={supplierSaving} onClick={() => setSupplierEditor(null)}>Cancel</button>
                                <button type="submit" className="primary-button" disabled={supplierSaving}>{supplierSaving ? "Saving..." : supplierEditor.id === null ? "Create Supplier" : "Save Changes"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
            {categoryEditor && (
                <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <section role="dialog" aria-modal="true" aria-label={categoryEditor.id === null ? "Add Category" : "Edit Category"} style={{ background: "white", width: "min(480px, 100%)", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
                        <h2 style={{ marginTop: 0 }}>{categoryEditor.id === null ? "Add Category" : "Edit Category"}</h2>
                        <form onSubmit={saveCategory}>
                            <label style={{ display: "grid", gap: 7, marginBottom: 16 }}>Category Name
                                <input required maxLength={100} value={categoryEditor.name} onChange={e => setCategoryEditor(current => ({ ...current, name: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }} />
                            </label>
                            <label style={{ display: "grid", gap: 7 }}>Description
                                <textarea rows={3} value={categoryEditor.description} onChange={e => setCategoryEditor(current => ({ ...current, description: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8, resize: "vertical" }} />
                            </label>
                            {categoryFormError && <div role="alert" style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "#fff1f2", color: "#9f1239", overflowWrap: "anywhere" }}>{categoryFormError}</div>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                <button type="button" className="outline-button" disabled={categorySaving} onClick={() => setCategoryEditor(null)}>Cancel</button>
                                <button type="submit" className="primary-button" disabled={categorySaving}>{categorySaving ? "Saving..." : categoryEditor.id === null ? "Create Category" : "Save Changes"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
            {productEditor && (
                <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <section role="dialog" aria-modal="true" aria-label={productEditor.id === null ? "Add Product" : "Edit Product"} style={{ background: "white", width: "min(720px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
                        <h2 style={{ marginTop: 0 }}>{productEditor.id === null ? "Add Product" : `Edit Product #${productEditor.id}`}</h2>
                        <p style={{ color: "#64748b", marginBottom: 20 }}>Enter product details. Changes will be sent to the live API.</p>
                        <form onSubmit={saveProduct}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                                {[
                                    ["sku", "SKU", "text"], ["name", "Product Name", "text"],
                                    ["purchasePrice", "Purchase Price", "number"], ["sellingPrice", "Selling Price", "number"],
                                    ["quantity", "Quantity", "number"], ["minStockLevel", "Minimum Stock Level", "number"],
                                ].map(([field, label, type]) => (
                                    <label key={field} style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600, color: "#334155" }}>
                                        {label}
                                        <input required type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? (field.toLowerCase().includes("price") ? "0.01" : "1") : undefined}
                                            maxLength={field === "sku" ? 50 : field === "name" ? 150 : undefined}
                                            value={productEditor[field]}
                                            onChange={e => setProductEditor(current => ({ ...current, [field]: e.target.value }))}
                                            style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8, width: "100%", boxSizing: "border-box" }} />
                                    </label>
                                ))}
                                <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600, color: "#334155" }}>
                                    Category
                                    <select required value={productEditor.categoryId} onChange={e => setProductEditor(current => ({ ...current, categoryId: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }}>
                                        <option value="">Select category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </label>
                                <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600, color: "#334155" }}>
                                    Supplier (optional)
                                    <select value={productEditor.supplierId} onChange={e => setProductEditor(current => ({ ...current, supplierId: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }}>
                                        <option value="">No supplier</option>
                                        {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                                    </select>
                                </label>
                            </div>
                            <label style={{ display: "grid", gap: 7, marginTop: 16, fontSize: 13, fontWeight: 600, color: "#334155" }}>
                                Product Image (optional)
                                <select value={productEditor.imageUrl} onChange={e => setProductEditor(current => ({ ...current, imageUrl: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8 }}>
                                    <option value="">No image</option>
                                    {productImageFiles.map(file => <option key={file} value={`/products/${file}`}>{file.replace(/\.jpg$/i, "").replaceAll("-", " ")}</option>)}
                                </select>
                            </label>
                            {productEditor.imageUrl && <ProductPhoto src={productEditor.imageUrl} name="Selected product preview" className="sm-editor-preview" />}
                            <label style={{ display: "grid", gap: 7, marginTop: 16, fontSize: 13, fontWeight: 600, color: "#334155" }}>
                                Description
                                <textarea maxLength={2000} rows={3} value={productEditor.description} onChange={e => setProductEditor(current => ({ ...current, description: e.target.value }))} style={{ padding: 11, border: "1px solid #dbe3ee", borderRadius: 8, resize: "vertical" }} />
                            </label>
                            {productFormError && <div role="alert" style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "#fff1f2", color: "#9f1239", overflowWrap: "anywhere" }}>{productFormError}</div>}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                                <button type="button" disabled={productSaving} onClick={() => setProductEditor(null)} style={{ border: "1px solid #dbe3ee", borderRadius: 8, background: "white", padding: "11px 20px", cursor: "pointer" }}>Cancel</button>
                                <button type="submit" disabled={productSaving} style={{ border: 0, borderRadius: 8, background: "#2563eb", color: "white", padding: "11px 20px", cursor: "pointer" }}>{productSaving ? "Saving..." : productEditor.id === null ? "Create Product" : "Save Changes"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, note, tone }) {
    return (
        <div className="stat-card">
            <div className="stat-top">
                <span>{label}</span>
                <div className={`stat-icon ${tone}`}>{icon}</div>
            </div>
            <strong className="stat-value">{value}</strong>
            <p>{note}</p>
        </div>
    );
}

function ProductsTable({
    products,
    search,
    setSearch,
    onViewAll,
    onAdd,
    onEdit,
    view = "table",
    onViewChange,
}) {
    return (
        <section className="panel products-panel">
            <div className="panel-header products-header">
                <div>
                    <h2>Products Overview</h2>
                    <p>Monitor product availability and pricing</p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {onViewAll && <button className="outline-button" onClick={onViewAll}>View All</button>}
                    {onAdd && <button className="primary-button" onClick={onAdd}>+ Add Product</button>}
                </div>
            </div>

            <div className="table-toolbar">
                <input
                    type="search"
                    placeholder="Search products..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search products"
                />
                <div className="sm-toolbar-actions">
                    <span>{products.length} products</span>
                    {onViewChange && <div className="sm-view-switch" aria-label="Product view">
                        <button type="button" className={view === "grid" ? "selected" : ""} onClick={() => onViewChange("grid")}>Grid</button>
                        <button type="button" className={view === "table" ? "selected" : ""} onClick={() => onViewChange("table")}>Table</button>
                    </div>}
                </div>
            </div>

            {view === "grid" ? (
                <div className="sm-products-grid">
                    {products.map(product => (
                        <article className="sm-product-card" key={product.id}>
                            <ProductPhoto src={product.imageUrl} name={product.name} className="sm-card-photo" />
                            <div className="sm-product-card-body">
                                <span className="sm-product-category">{product.category}</span>
                                <h3 title={product.name}>{product.name}</h3>
                                <p className="sm-product-sku">SKU: {product.sku}</p>
                                <div className="sm-card-bottom">
                                    <strong>{money(product.price)}</strong>
                                    <span className={`status ${product.quantity <= product.minStockLevel ? "low" : "available"}`}>
                                        {product.quantity <= product.minStockLevel ? "Low Stock" : `${product.quantity} in stock`}
                                    </span>
                                </div>
                                {onEdit && <button type="button" className="outline-button sm-card-edit" onClick={() => onEdit(product)}>Edit Product</button>}
                            </div>
                        </article>
                    ))}
                    {products.length === 0 && <div className="empty-state">No products to display.</div>}
                </div>
            ) : <div className="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>PRODUCT</th>
                            <th>SKU</th>
                            <th>CATEGORY</th>
                            <th>PRICE</th>
                            <th>STOCK</th>
                            <th>STATUS</th>
                            {onEdit && <th>ACTIONS</th>}
                        </tr>
                    </thead>

                    <tbody>
                        {products.map((product) => (
                            <tr key={product.id}>
                                <td className="product-name">
                                    <div className="product-cell">
                                        <ProductPhoto src={product.imageUrl} name={product.name} className="sm-table-photo" />
                                        {product.name}
                                    </div>
                                </td>
                                <td>{product.sku}</td>
                                <td>{product.category}</td>
                                <td>{money(product.price)}</td>
                                <td>{product.quantity}</td>
                                <td>
                                    <span
                                        className={`status ${product.quantity <= product.minStockLevel
                                            ? "low"
                                            : "available"
                                            }`}
                                    >
                                        {product.quantity <= product.minStockLevel
                                            ? "Low Stock"
                                            : "In Stock"}
                                    </span>
                                </td>
                                {onEdit && <td><button type="button" className="outline-button" onClick={() => onEdit(product)}>Edit</button></td>}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {products.length === 0 && (
                    <div className="empty-state">
                        No products to display.
                    </div>
                )}
            </div>}
        </section>
    );
}

export default App;
