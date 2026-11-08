const form = document.querySelector('form');
const errorText = document.querySelector('.error');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const rememberMe = document.querySelector('#forever');
const submit = document.querySelector('#submit');

form.addEventListener('submit', async (e) => {
    let errorPresent = false;
    errorText.className = 'error';
    e.preventDefault();
    let selected = false;

    if (rememberMe.value === 'remember-me') selected = true;

    try {
        if (!username.value || !password.value) {
            errorText.textContent = 'You must provide both a username and password.';
            errorPresent = true;
            throw new Error();
        }

        if (username.value.length > 25 || password.value.length > 128) {
            errorText.textContent = 'Invalid username or password.';
            errorPresent = true;
            throw new Error();
        }

        throw new Error();
    }
    catch {
        if (errorPresent) {
            errorText.className = 'error visible';
        }
        else {
            submit.disabled = true;
            let errorMessage = 'There was a network issue. Please try again.';
            try {
                const response = await fetch('https://back.teamblitz.workers.dev/api/auth', {
                    method: 'POST',
                    body: JSON.stringify({ username: username.value, password: password.value, rememberMe: selected }),
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                if (response.ok) {
                    errorText.textContent = 'Logging in..';
                    errorText.className = 'error visible success';
                    setTimeout(() => {
                        window.location.replace('https://teamblitz.pages.dev/portal/');
                    }, 1000);
                }
                else {
                    try {
                        const data = await response.json();
                        errorMessage = data.message;
                    }
                    catch (error) {
                        console.error(error);
                    }
                    console.error(response.status);
                    throw new Error();
                }
            }
            catch {
                errorText.textContent = errorMessage;
                errorText.className = 'error visible';
                submit.disabled = false;
            }
        }
    }
});

const goAway = () => {
    const box = document.querySelector('#cookie-notice-box');
    box.className = 'slidAway';
}