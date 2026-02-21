    
        // Spinner handling
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 100);

        // Timezone Logic
        const hiddenInput = document.getElementById('timezoneHiddenInput');
        const displaySpan = document.getElementById('timezoneDisplay');
        const userDefault = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        hiddenInput.value = userDefault;
        displaySpan.textContent = userDefault.replace('_', ' ');

        const saveBtn = document.getElementById("saveBtn");
        const originalButtonText = saveBtn.innerHTML; 

        function startLoading() {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> جاري المحاولة...';
        }

        function stopLoading() {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalButtonText; 
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            let bgClass = 'bg-primary';
            if (type === 'success') bgClass = 'bg-success';
            if (type === 'error') bgClass = 'bg-danger';

            const toastElem = document.createElement('div');
            toastElem.className = `toast align-items-center text-white ${bgClass} border-0 mb-3 animate__animated animate__slideInRight`;
            toastElem.setAttribute('role', 'alert');
            toastElem.setAttribute('aria-live', 'assertive');
            toastElem.setAttribute('aria-atomic', 'true');
            toastElem.innerHTML = `
                <div class="d-flex p-2">
                    <div class="toast-body fw-bold">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>`;
            container.appendChild(toastElem);
            const bsToast = new bootstrap.Toast(toastElem);
            bsToast.show();
            toastElem.addEventListener('hidden.bs.toast', () => toastElem.remove());
        }

        async function handleSubmit(event) {
            event.preventDefault(); 
            const userData = {
                role: document.querySelector('input[name="role"]:checked').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                timezone: userDefault
            };

            startLoading();
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw errorData; 
                }
                showToast("تم تسجيل الدخول بنجاح! جاري التحويل...", 'success'); 
                const result = await response.json();
                setTimeout(() => {
                    if (result.role === 'superadmin') {
                        window.location.href = '/superadmin';
                    } else {
                        window.location.href = '/';
                    }
                }, 1000);
            } catch (error) {
                stopLoading();
                const msg = error?.errors?.email || error?.errors?.password || error?.message || "فشل تسجيل الدخول";
                showToast("خطأ: " + msg, 'error');
            }
        }
