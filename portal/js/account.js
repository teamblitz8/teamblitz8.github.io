const form = document.querySelector('form');
const error = document.querySelector('.error');
const currentPassword = document.querySelector('#current-password');
const newPassword = document.querySelector('#new-password');
const confirmPassword = document.querySelector('#confirm-password');
const username = document.querySelector('#profile p').value;

form.addEventListener('submit', async (e) => {
    let errored = false;
    const errors = [];
    e.preventDefault();

    if (!currentPassword.value) {
        errored = true;
        errors.push('You must enter your current password.');
    }
    if (!newPassword.value) {
        errored = true;
        errors.push('You must enter a new password.');
    }
    if (!confirmPassword.value) {
        errored = true;
        errors.push('New password and confirm password must match.');
    }

    if (currentPassword.value.length > 128) {
        errored = true;
        errors.push('Current password is incorrect.');
    }
    if (newPassword.value.length > 128) {
        errored = true;
        errors.push('New password must be less than 128 characters long.');
    }

    if (newPassword.value.length < 10) {
        errored = true;
        errors.push('New password must be more than 10 characters long.');
    }
    if (newPassword.value.toLowerCase() === newPassword.value) {
        errored = true;
        errors.push('New password must contain at least one uppercase letter.');
    }
    if (newPassword.value.toUpperCase() === newPassword.value) {
        errored = true;
        errors.push('New password must contain at least one lowercase letter.');
    }
    if (!/\d/.test(newPassword.value)) {
        errored = true;
        errors.push('New password must contain at least one number.');
    }
    if (!/^[a-zA-Z0-9!@#\$%\^\&*\)\(+=._-]+$/g.test(newPassword.value)) {
        errored = true;
        errors.push('New password must contain at least one special character.');
    }
    if (newPassword.value.includes('password')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('abc')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('qwerty')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('admin')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('welcome')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('letmein')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('blitz')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('login')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }
    if (newPassword.value.includes('test')) {
        errored = true;
        errors.push('New password must not contain easily guessable words.')
    }

    if (newPassword.value !== confirmPassword.value) {
        errored = true;
        errors.push('New password and confirm password must match.');
    }

    if (errored) {
        let text = '';
        for (let i of errors) {
            text += `${i} `;
        }
        error.innerText = text;
        error.style.display = 'inline-block';
    }
    else {
        submit.disabled = true;
        error.innerText = 'Updating password..'
        error.style.display = 'inline-block';

        try {
            if (username === null) {
                throw new Error('There was an unexpected error. Please refresh the page.');
            }
            const response = await fetch('https://back.teamblitz.workers.dev/api/auth', {
                method: 'POST',
                body: JSON.stringify({ username: username, password: currentPassword.value }),
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
        }
        catch (err) {
            submit.disabled = false;
            error.innerText = err;
            error.style.display = 'inline-block';
        }
    }
});