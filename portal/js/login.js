const form = document.querySelector('form');
const errorText = document.querySelector('.error');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const rememberMe = document.querySelector('#forever');
const submit = document.querySelector('#submit');
let attempts = 0;

form.addEventListener('submit', async (e) => {
    let errorPresent = false;
    e.preventDefault();
    if (attempts > 5) {
        errorText.textContent = 'You have been blocked from making further attempts. Please contact the administrator.';
        errorPresent = true;
    }

    if (!username.value || !password.value) {
        errorText.textContent = 'You must provide both a username and password.';
        attempts++;
        errorPresent = true;
    }

    if (username.value.length > 25 || password.value.length > 128) {
        errorText.textContent = 'Invalid username or password.';
        attempts++;
        errorPresent = true;
    }

    if (errorPresent) {
        errorText.className = 'error visible';
        return;
    }
    else {
        errorText.className = 'error';
        try {
            submit.disabled = true;
            const response = await fetch('https://back.teamblitz.workers.dev/api/auth/', {
                method: 'POST',
                body: JSON.stringify({ username: username.value, password: password.value }),
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            let data;
            try {
                data = await response.json();
            }
            catch {
                data = {
                    message: 'An unexpected error occurred. Please contact the administrator.'
                };
            }

            errorText.className = 'error visible';
            if (response.ok) {
                attempts++;
                errorText.textContent = 'Logging in..';
                errorText.className = 'error visible success';
                setTimeout(() => {
                    window.location.replace('https://teamblitz.pages.dev/portal/');
                }, 1000);
            }
            else {
                attempts++;
                if (!data) {
                    errorText.textContent = data.message || 'An unexpected error occurred. Please contact the administrator.';
                    submit.disabled = false;
                }
                else if (typeof data === 'object' && Object.hasOwn(data, 'message')) {
                    errorText.textContent = data.message || 'An unexpected error occurred. Please contact the administrator.';
                    submit.disabled = false;
                }
                else {
                    errorText.textContent = 'An unexpected error occurred. Please contact the administrator.';
                    submit.disabled = false;
                }
            }

        }
        catch (e) {
            console.error(e);
            errorText.textContent = 'There is a network issue. Please try again.';
            attempts++;
            errorText.className = 'error visible';
            submit.disabled = false;
        }
    }
});

const goAway = () => {
    const box = document.querySelector('#cookie-notice-box');
    box.className = 'slidAway';
}