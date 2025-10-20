
// تنظیمات API
const API_BASE_URL = "https://web-production-b86d.up.railway.app";

// گرفتن توکن ذخیره‌شده
function getToken() {
    return localStorage.getItem("token");
}

// تنظیم هدر احراز هویت
function authHeaders() {
    const token = getToken();
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}
