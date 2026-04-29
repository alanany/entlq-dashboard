document.addEventListener('DOMContentLoaded', function() {
    // Get translations from the data attribute on the body or a script tag
    // For simplicity, we can embed them as a global object in EJS
    const translations = window.loginTranslations || {
        signing_in: "Signing In...",
        sign_in_btn: "SIGN IN",
        login_success: "Login Successful!",
        login_failed: "Login Failed"
    };

    // Timezone Logic
    const hiddenInput = document.getElementById('timezoneHiddenInput');
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (hiddenInput) {
        hiddenInput.value = userTimeZone;
    }

    const saveBtn = document.getElementById("saveBtn");
    const originalButtonText = translations.sign_in_btn; 

    function startLoading() {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> ${translations.signing_in}`;
        }
    }

    function stopLoading() {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalButtonText; 
        }
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        let bgClass = 'bg-primary';
        if (type === 'success') bgClass = 'bg-success';
        if (type === 'error') bgClass = 'bg-danger';

        const toastElem = document.createElement('div');
        toastElem.className = `toast align-items-center text-white ${bgClass} border-0 mb-2`;
        toastElem.setAttribute('role', 'alert');
        toastElem.setAttribute('aria-live', 'assertive');
        toastElem.setAttribute('aria-atomic', 'true');
        toastElem.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>`;
        container.appendChild(toastElem);
        const bsToast = new bootstrap.Toast(toastElem);
        bsToast.show();
        toastElem.addEventListener('hidden.bs.toast', () => toastElem.remove());
    }

    window.handleSubmit = async function(event) {
        event.preventDefault(); 
        const userData = {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            role: 'student',
            timezone: userTimeZone
        };

        startLoading();

        try {
            const response = await axios.post('/student/login', userData);
            showToast(translations.login_success, 'success'); 
            setTimeout(() => window.location.href = '/dashboard', 1000);
        } catch (error) {
            stopLoading();
            const msg = error.response?.data?.error || translations.login_failed;
            showToast(msg, 'error');
        }
    }
});
