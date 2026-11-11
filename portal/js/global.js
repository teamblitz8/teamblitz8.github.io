const fetchProfile = async (username) => {
    const endpoint = new URL('https://back.teamblitz.workers.dev/api/profile');
    endpoint.search = new URLSearchParams({ username: username }).toString();

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) return await parseBlob(response);
        else return showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
    }
    catch (error) {
        console.error(error);
        await showError(error, false, false);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.href.startsWith('https://teamblitz.pages.dev/portal/login')) return;
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/account', {
            method: 'GET',
            credentials: 'include'
        });

        let data;

        if (response.ok) {
            data = await parseJSON(response, ['username', 'name']);
            if (!data) showError('Failed to parse JSON', response, false);

            const profileURL = await fetchProfile(data.username);
            document.querySelector('#profile p').innerText = data.username;
            document.querySelector('#profile img').src = profileURL;
            await waitForUsername();
        }
        else showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
    }
    catch (error) {
        console.error(error);
        await showError(error, false, false);
    }
});

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const waitForUsername = async () => {
    const menu = document.querySelector('#profile-menu');
    const profile = document.querySelector('#profile');
    const username = document.querySelector('#profile p');
    const nav = document.querySelector('#nav');

    while (username.textContent.trim() === '') await wait(100);

    nav.style.display = 'flex';
    menu.style.width = `${profile.offsetWidth}px`;
}

const showPassword = (field) => {
    const element = document.getElementById(field);
    const div = element.parentNode;
    const i = div.querySelector('i');
    
    if (element.type === 'password') {
        element.type = 'text';
        i.className = 'fa-solid fa-eye-slash';
    }
    else if (element.type === 'text') {
        element.type = 'password';
        i.className = 'fa-solid fa-eye';
    }
}

const logout = async () => {
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) window.location.replace('https://teamblitz.pages.dev');
        else showError(undefined, response, false);
    }
    catch (error) {
        console.error(error);
        await showError(error, false, false);
    }
}

const unroll = () => {
    document.getElementById("nav").classList.toggle("opened");

    const button = document.querySelector('.fah');

    if (button.className === 'fa-solid fah fa-chevron-down') {
        button.className = 'fa-solid fah fa-chevron-up'
    }
    else {
        button.className = 'fa-solid fah fa-chevron-down'
    }
}

const showError = async (error, response, redirect, url, statusCondition) => {
    const err = document.querySelector('.error');
    let msg;
    if (response === false) msg = error.message;
    else {
        msg = await parseJSON(response, ['message']);
        if (!msg) msg = 'There was an unexpected error.';
        else msg = msg.message;
        console.error(`${response.status}: ${response.message}`);
    }

    err.innerText = msg;
    err.classList.toggle('visible');

    if (redirect && (response.status === statusCondition)) window.location.replace(url);

    return false;
}

const sanitiseObject = (object) => {
    if (object === 'null') return null;
    if (object === 'undefined') return undefined;
    if (typeof object === 'boolean') {
        if (object) return true;
        else return false;
    }
    if (typeof object === 'string' || typeof object === 'number') return DOMPurify.sanitize(object);
    if (Array.isArray(object)) {
        const arr = [];
        for (let i of object) {
            arr.push(sanitiseObject(i));
        }
        return arr;
    }
    const cleanObject = {};

    for (let [key, value] of Object.entries(object)) {
        const newKey = sanitiseObject(key);
        const newValue = sanitiseObject(value);

        cleanObject[newKey] = newValue;
    }

    return cleanObject;
}

const parseJSON = async (response, requiredFields) => {
    let text;
    let value;

    try {
        if (response.headers.get('Content-Type') === null) throw new Error();
        if (!response.headers.get('Content-Type').startsWith('application/json')) throw new Error();
        if (Number(response.headers.get('Content-Length')) > 25000000) throw new Error();
        text = await response.json();
        if (text === null) throw new Error();
        if (typeof text !== object) throw new Error();
        if (Array.isArray(text)) throw new Error();
        for (let i of requiredFields) if (!Object.hasOwn(text, i)) throw new Error();
        Object.keys(text).forEach(property => {
            if (!requiredFields.includes(property)) delete text[property];
            if (text[property] === null) throw new Error();
            if (typeof text[property] === 'number') {
                if (text[property] > 1000000 || text[property] < 0) throw new Error();
            }
            else if (typeof text[property] === 'string') {
                if (text[property].length > 10000 || text[property].length === 0) throw new Error();
            }
            else if (Array.isArray(text[property])) {
                if (text[property].length > 100) throw new Error();
                else {
                    for (let i of text[property]) {
                        if (typeof i === 'number') {
                            if (i > 1000000) throw new Error();
                        }
                        else if (typeof i === 'string') {
                            if (i.length > 10000 || text[property].length === 0) throw new Error();
                        }
                        else if (Array.isArray(i)) throw new Error();
                    }
                }
            }
        });
        value = await sanitiseObject(text);
    }
    catch {
        return false;
    };

    return value;
}

const parseBlob = async (response) => {
    let blob;
    try {
        blob = await response.blob();
        return URL.createObjectURL(blob);
    }
    catch (error) {
        await showError(error, false);
        return false;
    }
}