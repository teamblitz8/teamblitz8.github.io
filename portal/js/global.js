const fetchProfile = async (username) => {
    const endpoint = new URL('https://back.teamblitz.workers.dev/api/profile');
    endpoint.search = new URLSearchParams({ username: username }).toString();

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) return await parseBlob(response);
        else await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
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
            if (!data) return await showError('There was an unexpected error.', response, false);

            const profileURL = await fetchProfile(data.username);
            document.querySelector('#profile p').innerText = data.username;
            document.querySelector('#profile img').src = profileURL;
            await waitForUsername();
        }
        else await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
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
        else await showError(undefined, response, false);
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

const showError = async (error, response, redirect, url, statusCondition, success) => {
    const err = document.querySelectorAll('.error');
    let msg;
    if (response === false) msg = typeof error === 'string' ? error : error.message;
    else {
        msg = await parseJSON(response, ['message']);
        if (!msg) msg = 'There was an unexpected error.';
        else msg = msg.message;
        console.error(`${response.status}: ${msg}`);
    }

    for (let i of err) {
        i.innerText = msg;
        i.classList.add('visible');
        if (success) i.classList.add('success');
    }

    if (redirect && response && (response.status === statusCondition)) window.location.replace(url);

    return msg;
}

const hideError = () => {
    for (let i of document.querySelectorAll('.error')) {
        i.className = 'error';
    }
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
        if (typeof text !== 'object') throw new Error();
        if (Array.isArray(text)) throw new Error();
        for (let i of requiredFields) if (!Object.hasOwn(text, i)) throw new Error();
        Object.keys(text).forEach(property => {
            if (!requiredFields.includes(property)) delete text[property];
            if (text[property] === null && property !== 'derived_carid' && property !== 'additional_notes') throw new Error();
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
                            if (i.length > 10000 || i.length === 0) throw new Error();
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
    }
}

const getData = async (type, iterationNumber) => {
    if (type === 'fullworks') {
        try {
            const meta = await getData('text', iterationNumber);
            const model = await getData('f3d', iterationNumber);
            const preview = await getData('previews', iterationNumber);
            const iso = await getData('iso', iterationNumber);
            const planes = await getData('planes', iterationNumber);

            console.log(meta);

            return { ...meta.data, model: model, preview: preview, iso: iso, planes: planes };
        }
        catch (error) {
            const msg = await showError(error, false, false);
            throw new Error(msg); // pauses all remaining fetches if one fails.
        }
    }
    else {
        const dashboardURL = new URL(`https://back.teamblitz.workers.dev/api/dashboard/${type}`);
        dashboardURL.search = new URLSearchParams({ iterationNumber: iterationNumber }).toString();

        const response = await fetch(dashboardURL, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const msg = await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
            throw new Error(msg);
        }
        else {
            let data;
            if (type === 'text') data = await parseJSON(response, ['creatorid', 'scrutineerid', 'carid', 'derived_carid', 'car_name', 'iteration', 'date_created', 'frontal_area', 'drag_coefficient', 'drag_force', 'changelog', 'additional_notes', 'creatorName', 'creatorUsername', 'scrutineerName']);
            else if (['f3d', 'previews', 'iso', 'planes'].includes(type)) data = await parseBlob(response);

            if (!data) {
                const msg = await showError('There was an unexpected error.', false);
                throw new Error(msg);
            }
            else return { data: data, contentType: response.headers.get('Content-Type'), contentDisposition: response.headers.get('Content-Disposition') };
        }
    }
}

const upload = async (type, data, filetype) => {
    let body;
    let contentHeader;

    if (type === 'fullworks') {
        try {
            await upload('text', data.metadata, 'null');
            await upload('f3d', data.carModel, filetype.carModel);
            await upload('iso', data.iso, 'png');
            await upload('planes', data.planes, 'png');
            await upload('previews', data.preview, filetype.preview);
        }
        catch (error) {
            throw new Error(error.message);
        }
    }
    else if (type === 'text') {
        body = JSON.stringify(data);
        contentHeader = 'application/json';
    }
    else if (type === 'f3d') {
        body = data;
        contentHeader = 'application/octet-stream';
    }
    else if (type === 'iso' || type === 'planes') {
        body = data;
        contentHeader = 'image/png';
    }
    else if (type === 'previews') {
        body = data;
        if (data.name.split('.')[1] === 'png') contentHeader = 'image/png';
        else if (data.name.split('.')[1] === 'glb') contentHeader = 'model/gltf-binary';
        else throw new Error('Incorrect preview file type; please upload a .glb or .png file.')
    }
    else throw new Error('Incorrect upload type.');

    try {
        const url = new URL(`https://back.teamblitz.workers.dev/api/dashboard/${type}`);
        url.search = new URLSearchParams({ carid: newCarID, fileType: filetype });
        const response = await fetch(url, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': contentHeader
            },
            credentials: 'include'
        });

        if (response.ok) {
            const data = await parseJSON(response, ['carid']);
            newCarID = data.carid;
        }
        else {
            const err = await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401);
            throw new Error(err);
        }
    }
    catch (error) {
        throw new Error(error.message);
    }
}

const processFullCar = async (iterationNumber) => {
    await showError('Fetching car data...', false, false, false, false, true);

    try {
        const car = await getData('fullworks', iterationNumber);
        console.log(car);
        const devContainer = document.querySelector('#development-container');
        nextIteration = Number(car.iteration) - 1;

        let changelog = '';
        for (let i of car.changelog) {
            changelog += `<li>${i}</li>`;
        }

        let preview;
        if (car.preview.contentType === 'image/png') preview = `<img src="${car.preview.data}" class="model-viewer">`;
        else if (car.preview.contentType === 'model/gltf-binary') preview = `<model-viewer id="car-model" src="${car.preview.data}" class="model-viewer ii${car.iteration}" camera-controls></model-viewer>`;
        else preview = `<div class="error">There was an error loading the preview.</div>`;

        let derivation = '';
        if (car['derived_carid'] !== null) derivation = `<p>This design was derived from iteration #${car.derivedCarIteration}, ${car.derivedCarName}. Changes include:</p>`;

        let addNotes = '';
        if (car['additional_notes'] !== null) addNotes = `<div class="notes"><h3>Additional notes</h3><p>${car['additional_notes']}</p></div></div></div>`;

        const carModelType = car.model.contentDisposition.split('=')[1];
        const creatorProfileURL = await fetchProfile(car.creatorUsername);

        devContainer.innerHTML += `<div class="car"><div class="details"><h3>${car['car_name']} - Iteration #${car.iteration}</h3><div class="creator"><img src="${creatorProfileURL}" class="portrait"><div class="person"><h3>${car.creatorName}</h3><p class="date"><i class="fa-solid fa-calendar"></i> Created ${new Date(car['date_created']).toDateString()}</p><p><i class="fa-solid fa-magnifying-glass"></i> Scrutineered by ${car.scrutineerName}</p></div></div><p>Frontal Area: ${car['frontal_area']}mm²</p><p>Drag Coefficient: ${car['drag_coefficient']}</p><p class="drag">Drag: ${car['drag_force']}N</p><div class="buttons"><div class="download"><a href="${car.model.data}" download="${car['car_name']}.${carModelType}"><i class="fa-solid fa-file-arrow-down"></i>  Download .f3z/.f3d file</a></div><div class="button"><button onclick="unfurl(${car.iteration})"><i class="fa-solid fa-caret-down"></i> See more details</button></div></div><div class="i${car.iteration} hidden more-details"><div class="iso-surfaces"><h3>Iso Surfaces</h3><img src="${car.iso.data}"></div><div class="planes"><h3>Planes</h3><img src="${car.planes.data}"></div><div class="changes"><h3>Changes</h3>${derivation}<ul>${changelog}</ul></div>${addNotes}<div class="image">${preview}</div></div>`;
        hideError();

        document.getElementById('upload').style.display = 'inline-block';
        document.getElementById('title').innerText = 'Latest Cars';

        document.querySelector('.model-viewer').style.height = '100%';
        document.querySelector('.model-viewer').style.height = `${document.querySelector('.model-viewer').offsetHeight}px`;

        if (nextIteration !== 0) document.querySelector('#loadMore button').style.display = 'flex';
    }
    catch (error) {
        await showError(error, false);
    }
}