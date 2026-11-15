const form = document.querySelector('form');

form.addEventListener('submit', async (e) => {
    hideError();
    e.preventDefault();

    const username = document.querySelector('#username');
    const password = document.querySelector('#password');
    const rememberMe = document.querySelector('#forever').checked;
    const submit = document.querySelector('#submit');

    try {
        if (!username.value || !password.value) throw new Error('You must provide both a username and password.');
        if (username.value.length > 25 || password.value.length > 128) throw new Error('Invalid username or password.');
        throw new Error();
    }
    catch (error) {
        if (error.message) showError(error, false);
        else {
            submit.disabled = true;
            try {
                const response = await fetch('https://back.teamblitz.workers.dev/api/auth', {
                    method: 'POST',
                    body: JSON.stringify({ username: username.value, password: password.value, rememberMe: rememberMe }),
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                if (response.ok) {
                    await showError('Logging in..', false, true, 'https://teamblitz.pages.dev/portal/', 200, true);
                    setTimeout(() => {
                        window.location.replace('https://teamblitz.pages.dev/portal/');
                    });
                }
                else {
                    await showError(undefined, response);
                    submit.disabled = false;
                }
            }
            catch (error) {
                console.error(error);
                showError(error, false, false);
                submit.disabled = false;
            }
        }
    }
});

const goAway = () => {
    const box = document.querySelector('#cookie-notice-box');
    box.className = 'slidAway';
}