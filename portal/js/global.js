document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/account', {
            method: 'GET',
            credentials: 'include'
        });
        let data;
        try {
            data = await response.json();
        }
        catch {
            throw new Error('There was an error parsing the JSON. Please contact the administrator.');
        }

        if (response.ok) {
            const menu = document.querySelector('#profile p');
            menu.textContent = data.username;
        }
        else {
            if (!data) {
                throw new Error('There was an error parsing the JSON. Please contact the administrator.');
            }
            if (typeof data !== 'object') {
                throw new Error('There was an error parsing the JSON. Please contact the administrator.');
            }
            if (!Object.hasOwn(data, 'message')) {
                throw new Error('There was an error parsing the JSON. Please contact the administrator.');
            }
            if (data.message === 'Unauthorised') {
                document.querySelector('#error').textContent = 'You must be logged in to see this page';
                document.querySelector('#error').style.display = 'inline-block';
                return setTimeout(() => {
                    window.location.replace('https://teamblitz.pages.dev/portal/login');
                }, 1000);
            }

            throw new Error(data.message);
        }
    }
    catch (error) {
        document.querySelector('#error').textContent = error.message;
        document.querySelector('#error').style.display = 'inline-block';
        console.error(error);
    }
});

window.addEventListener('load', () => {
    const menu = document.querySelector('#profile-menu');
    const profile = document.querySelector('#profile');
    menu.style.width = `${profile.offsetWidth}px`;
});

const logout = async () => {
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            window.location.replace('https://teamblitz.uk');
        }
        else {
            throw new Error();
        }
    }
    catch (error) {
        console.error(error);
    }
}

const unroll = async () => {
    document.getElementById("nav").classList.toggle("opened");

    const button = document.querySelector('.fah');

    if (button.className === 'fa-solid fah fa-chevron-down') {
        button.className = 'fa-solid fah fa-chevron-up'
    }
    else {
        button.className = 'fa-solid fah fa-chevron-down'
    }
}