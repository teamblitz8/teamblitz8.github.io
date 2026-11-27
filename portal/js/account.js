const form = document.querySelector('form');

form.addEventListener('submit', async (e) => {
    hideError('#password-error');
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
        await showError(error.message, false, false, undefined, undefined, false, '#password-error');
        throw new Error();
    }

    submit.disabled = true;
    showError('Updating password..', false, false, undefined, undefined, true, '#password-error');

    try {
        await toggleFullScreen();
        await toggleLoading('Processing..', true);
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
            await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401, false, '#password-error');
            toggleFullScreen();
            toggleLoading('', false);
        }
        else {
            await toggleLoading('', false);
            await toggleFullScreen();
            await showError('Password change successful.', false, false, undefined, undefined, true, '#password-error');
            setTimeout(() => {
                window.location.replace('https://teamblitz.pages.dev/portal/');
            }, 1000);
        }
    }
    catch (error) {
        await toggleLoading('', false);
        await toggleFullScreen();
        submit.disabled = false;
        await showError(error.message, false, false, undefined, undefined, false, '#password-error');
    }
});

const switchMenu = (menu) => {
    for (let i of ['security']) {
        const j = document.querySelector(`#${i}`);
        j.style.display = 'none';
    }
    document.querySelector(`#${menu}`).style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', async () => {
    await toggleFullScreen();
    await toggleLoading('Fetching account data..', true);

    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/sessions', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const msg = await showError(undefined, response, false, undefined, undefined, false, '#main-error');
            throw new Error(msg);
        }
        else {
            let data;
            data = await parseJSON(response, ['message', 'array']);

            if (!data) {
                const msg = await showError('There was an unexpected error.', false, false, undefined, undefined, false, '#main-error');
                throw new Error(msg);
            }
            else {
                const box = document.querySelector('#sessions');
                for (let session of data.array) {
                    const id = await waitFor('tokenid');
                    if (id === session['token_id']) box.innerHTML += `<div class="session a${session['token_id']}"><h1>${session.browser || 'Unknown device'}</h1><p class="current-session success">Your device</p><p><i class="fa-solid fa-location-dot"></i> ${session.geolocation || 'Location not available'}</p><p><i class="fa-solid fa-mobile-screen-button"></i> ${session.ip || 'IP address not available'}</p><p><i class="fa-solid fa-calendar-days"></i> Last accessed ${session['last_accessed'] || 'on an unknown day'}</p></div>`;
                    else box.innerHTML += `<div class="session a${session['token_id']}"><h1>${session.browser || 'Unknown device'}</h1><p><i class="fa-solid fa-location-dot"></i> ${session.geolocation || 'Location not available'}</p><p><i class="fa-solid fa-mobile-screen-button"></i> ${session.ip || 'IP address not available'}</p><p><i class="fa-solid fa-calendar-days"></i> Last accessed ${session['last_accessed'] || 'on an unknown day'}</p><button onclick="logoutDevice('${session['token_id']}')" class="kick">Log out of this device</button></div>`;
                }
                box.innerHTML += '<div class="session"><button onclick="logoutAll()"><i class="fa-solid fa-right-from-bracket"></i> Log out of all devices (causes sign-out)</button></div>';
            }

            await toggleLoading('', false)
            const params = new URLSearchParams(window.location.search);
            if (params.get('redirect') === 'true') showError('Your password has expired; please change it.', false, false, undefined, undefined, false, '#password-error');
            await toggleFullScreen();
        }
    }
    catch (error) {
        await toggleLoading('', false);
        showError(error, false, false, undefined, undefined, false, '#main-error');
    }
});

const logoutDevice = async (tokenID) => {
    const buttons = document.querySelectorAll('.kick');
    for (let i of buttons) {
        i.disabled = true;
    }

    await toggleFullScreen();
    await toggleLoading('Processing..', true);
    
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/sessions', {
            method: 'POST',
            body: JSON.stringify({ tokenID: tokenID }),
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401, false, '#session-error');
            toggleFullScreen();
            toggleLoading('', false);
        }
        else {
            const box = document.querySelector(`.a${tokenID}`);
            await showError(`Successfully logged out of ${box.querySelector('h1').textContent}.`, false, false, undefined, undefined, true, '#session-error');
            box.remove();

            await toggleLoading('', false);
            await toggleFullScreen();
        }
    }
    catch (error) {
        await toggleLoading('', false);
        await toggleFullScreen();
        await showError(error.message, false, false, undefined, undefined, false, '#session-error');
    }

    for (let i of buttons) {
        i.disabled = false;
    }
}

const logoutAll = async () => {
    const buttons = document.querySelectorAll('.kick');
    for (let i of buttons) {
        i.disabled = true;
    }

    await toggleFullScreen();
    await toggleLoading('Processing..', true);
    
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/clear-all-sessions', {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401, false, '#session-error');
            toggleFullScreen();
            toggleLoading('', false);
        }
        else {
            await toggleLoading('', false);
            await toggleFullScreen();
            await showError('Successfully logged out of all devices. Please log in again.', false, false, undefined, undefined, true, '#session-error');
            setTimeout(() => {
                window.location.replace('https://teamblitz.pages.dev/portal/login');
            });
        }
    }
    catch (error) {
        await toggleLoading('', false);
        await toggleFullScreen();
        await showError(error.message, false, false, undefined, undefined, false, '#session-error');
    }

    for (let i of buttons) {
        i.disabled = false;
    }
}