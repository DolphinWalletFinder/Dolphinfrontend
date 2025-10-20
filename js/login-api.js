const API_BASE_URL = "https://web-production-b86d.up.railway.app/api";

// ثبت‌نام کاربر
async function register(username, email, password) {
    const res = await fetch(API_BASE_URL + "/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
    });
    return res.json();
}

// ورود کاربر
async function login(username, password) {
    const res = await fetch(API_BASE_URL + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.token) {
        // ذخیره توکن
        localStorage.setItem("token", data.token);

        // گرفتن role از JWT
        try {
            const payload = JSON.parse(atob(data.token.split('.')[1]));
            const role = payload.role || "user";
            localStorage.setItem("role", role);
            localStorage.setItem("username", payload.username);

            // هدایت بر اساس نقش
            if (role === "admin") {
                window.location.href = "/pages/admin-licenses.html"; // پنل ادمین
            } else {
                window.location.href = "/pages/scan.html"; // صفحه اسکن
            }
        } catch (err) {
            console.error("JWT parsing error:", err);
            alert("Invalid token format");
        }
    } else {
        alert(data.error || "Login failed");
    }

    return data;
}

// خروج کاربر
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "/pages/login.html";
}
