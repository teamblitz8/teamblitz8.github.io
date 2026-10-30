const fetchpfpurl = async (username) => {
    try {
        const endpoint = new URL('https://back.teamblitz.workers.dev/api/profile');
        endpoint.search = new URLSearchParams({ username: username }).toString();

        const response = await fetch(endpoint, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const data = await response.json();
            if (!data) {
                throw new Error('502 Bad Gateway');
            }
            if (typeof data !== 'object') {
                throw new Error('Server responded with invalid data');
            }
            if (!Object.hasOwn(data, 'message')) {
                throw new Error('Server responded with invalid data');
            }

            throw new Error(data.message);
        }

        let data;
        try {
            data = await response.blob();
        }
        catch {
            throw new Error('failed to blob');
        }

        return URL.createObjectURL(data);
    }
    catch (error) {
        console.log(error);
        return false;
    }
}

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
            const pfpurl = await fetchpfpurl(data.username);
            const menu = document.querySelector('#profile p');
            menu.textContent = data.username;

            document.querySelector('#profile img').src = pfpurl;
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
                document.querySelector('#main-error').textContent = 'You must be logged in to see this page';
                document.querySelector('#main-error').style.display = 'inline-block';
                return setTimeout(() => {
                    window.location.replace('https://teamblitz.pages.dev/portal/login');
                }, 1000);
            }

            throw new Error(data.message);
        }
    }
    catch (error) {
        document.querySelector('#main-error').textContent = error.message;
        document.querySelector('#main-error').style.display = 'inline-block';
        console.error(error);
    }
});

window.addEventListener('load', async () => {
    const menu = document.querySelector('#profile-menu');
    const profile = document.querySelector('#profile');
    const username = document.querySelector('#profile p');
    const nav = document.querySelector('#nav');

    const wait = (milliseconds) =>
        new Promise(resolve => setTimeout(resolve, milliseconds));

    const waitForUsername = async () => {
        while (username.textContent.trim() === '') {
            await wait(100);
        }

        nav.style.display = 'flex';
        menu.style.width = `${profile.offsetWidth}px`;
    };

    waitForUsername();
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