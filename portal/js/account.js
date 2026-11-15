const form = document.querySelector('form');

form.addEventListener('submit', async (e) => {
    hideError();
    e.preventDefault();

    const currentPassword = document.querySelector('#current-password').value;
    const newPassword = document.querySelector('#new-password').value;
    const confirmPassword = document.querySelector('#confirm-password').value;
    const submit = document.querySelector('#submit');

    try {
        for (let i of [currentPassword, newPassword, confirmPassword]) {
            if (!i || i === '' || i === null) throw new Error('Please fill in all required fields. ');
        }

        if (currentPassword.length > 128) throw new Error('Incorrect current password.');
        if (newPassword.length < 10 || newPassword.length > 128) throw new Error('Please ensure your new password is between 10 and 128 characters long.');
        if (newPassword.toLowerCase() === newPassword) throw new Error('Please ensure your new password contains at least one uppercase letter.');
        if (newPassword.toUpperCase() === newPassword) throw new Error('Please ensure your new password contains at least one lowercase letter.');
        if (!/\d/.test(newPassword)) throw new Error('Please ensure your new password contains at least one number.');
        if (!/^[a-zA-Z0-9!@#\$%\^\&*\)\(+=._-]+$/g.test(newPassword)) throw new Error('Please ensure your new password contains at least one special character.');
        if (newPassword.includes('password') || newPassword.includes('abc') || newPassword.includes('qwerty') || newPassword.includes('admin') || newPassword.includes('welcome') || newPassword.includes('letmein') || newPassword.includes('blitz') || newPassword.includes('login') || newPassword.includes('test')) throw new Error('Please ensure your password does not contain any easily guessable words or phrases.');
        if (newPassword !== confirmPassword) throw new Error('Please ensure your new password and confirm password fields match.');
    }
    catch (error) {
        await showError(error.message, false);
        throw new Error();
    }

    submit.disabled = true;
    showError('Updating password..', false, false, undefined, undefined, true);

    try {
        if (username === null) throw new Error('There was an unexpected error. Please refresh the page.');
        const response = await fetch('https://back.teamblitz.workers.dev/api/auth', {
            method: 'POST',
            body: JSON.stringify({ username: username, password: currentPassword.value }),
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            submit.disabled = false;
            await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
        }
    }
    catch (error) {
        submit.disabled = false;
        await showError(error.message, false);
    }

    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword }),
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            submit.disabled = false;
            await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
        }
        else {
            await showError('Password change successful', false, false, undefined, undefined, true);
            setTimeout(() => {
                window.location.replace('https://teamblitz.pages.dev/portal/');
            }, 1000);
        }
    }
    catch (error) {
        submit.disabled = false;
        await showError(error.message, false);
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('redirect') === 'true') showError('Your password has expired; please change it.', false);
});