const form = document.querySelector('#car-info');
const error = document.querySelector('#metadata-error');
const carName = document.querySelector('#name');
const dateCreated = document.querySelector('#date');
const frontalArea = document.querySelector('#frontal-area');
const dragCoefficient = document.querySelector('#drag-coefficient');
const scrutineerer = document.querySelector('input[name="scrutineerer"]:checked');
const derivedCar = document.querySelector('#derived-car');
const changelog = document.querySelector('#changelog');
const addDetails = document.querySelector('#add-notes');
const carModel = document.querySelector('#car-model');
const iso = document.querySelector('#iso');
const planes = document.querySelector('#planes');

const calcDrag = (cd, fa) => {
    return 0.5 * 1.196 * 400 * Number(fa) * Number(cd) / 1000000;
}

const unfurl = async (iteration) => {
    document.querySelector(`.i${iteration}`).classList.toggle('hidden');
    const button = document.querySelector(`.i${iteration}`).parentNode.querySelector('.buttons .button button');

    if (button.textContent === ' See more details') {
        button.innerText = ' See fewer details';
        button.querySelector('i').className = 'fa-solid fa-caret-up';
    }
    else if (button.textContent === ' See fewer details') {
        button.innerText = ' See more details';
        button.querySelector('i').className = 'fa-solid fa-caret-down';
    }
}

const getData = async (type, iterationNumber) => {
    try {
        if (type === 'fullworks') {
            try {
                const meta = await getData('text', iterationNumber);
                const model = await getData('f3d', iterationNumber);
                const preview = await getData('preview', iterationNumber);
                const iso = await getData('iso', iterationNumber);
                const planes = await getData('planes', iterationNumber);

                if ((new Set([meta.success, model.success, preview.success, iso.success, planes.success]).size === 1) && (meta.success)) {
                    return {
                        success: true,
                        data: { ...meta.data, model: model, preview: preview, iso: iso, planes: planes }
                    }
                }
                else {
                    const errors = [meta, model, preview, iso, planes].filter(result => !result.success).map(result => result.data).filter(Boolean);
                    throw new Error(
                        errors.length > 0
                            ? errors.join('; ')
                            : 'An unexpected error occurred.'
                    );
                }
            }
            catch (error) {
                return {
                    success: false,
                    data: error.message
                };
            }
        }

        const dashboardURL = new URL(`https://back.teamblitz.workers.dev/api/dashboard/${type}`);
        dashboardURL.search = new URLSearchParams({ iterationNumber: iterationNumber }).toString();

        const response = await fetch(dashboardURL, {
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
            if (type === 'text') {
                data = await response.json();
            }
            else if (['f3d', 'preview', 'iso', 'planes'].includes(type)) {
                data = await response.blob();
            }
            else {
                throw new Error();
            }
        }
        catch {
            throw new Error('There was an error parsing the data. Please contact the administrator.');
        }

        if (type === 'text') {
            return {
                success: true,
                data: { ...data.car, name: data.name, username: data.username },
            };
        }
        else if (['f3d', 'preview', 'iso', 'planes'].includes(type)) {
            return {
                success: true,
                url: URL.createObjectURL(data),
                contentType: response.headers.get('Content-Type')
            };
        }
    }
    catch (error) {
        return {
            success: false,
            data: error.message
        };
    }
}

const showPopup = () => {
    document.querySelector('.popup-shroud').classList.toggle('popup-open');
}

const loadMore = async () => {
    // do nothing rn
}

document.addEventListener('DOMContentLoaded', async () => {
    document.querySelector('#main-error').innerText = 'Fetching car data..';

    try {
        const dat = await getData('fullworks', 'latest');

        if (!dat.success) {
            throw new Error(`There was an unexpected error when fetching car data. Please contact the administrator. Error logs: ${dat.data}`);
        }
        const data = dat.data;
        const greeting = document.querySelector('#greeting');
        greeting.textContent = `Hello, ${data.name}`;

        const devContainer = document.querySelector('#development-container');

        let changelog = '';
        for (let i of data.changelog) {
            changelog += `<li>${i}</li>`;
        }

        let preview;
        if (data.preview.contentType === 'image/png') {
            preview = `<img src="${data.preview.url}">`;
        }
        else if (data.preview.contentType === 'model/gltf-binary') {
            preview = `<model-viewer id="car-model" src="${data.preview.url}" camera-controls></model-viewer>`;
        }
        else {
            preview = `<div id="error">There was an error loading the preview.</div>`;
        }
        // switch from innerhtml asap

        let derivation;
        if (data.derivedCarIteration && data.derivedCarName) {
            derivation = `<p>This design was derived from iteration #${data.derivedCarIteration}, ${data.derivedCarName}. Changes include:</p>`;
        }
        else {
            derivation = '';
        }

        let addNotes;
        if (data['additional_notes']) {
            addNotes = `<div class="notes"><h3>Additional notes</h3><p>${data['additional_notes']}</p></div></div></div>`;
        }

        devContainer.innerHTML += `<div class="car"><div class="details"><h3>${data['car_name']} - Iteration #${data.iteration}</h3><div class="creator"><img src="${await fetchpfpurl(data.creatorUsername)}" class="portrait"><div class="person"><h3>${data.creatorName}</h3><p class="date"><i class="fa-solid fa-calendar"></i> Created ${(new Date(data['date_created'])).toDateString()}</p><p><i class="fa-solid fa-magnifying-glass"></i> Scrutineered by ${data.scrutineerName}</p></div></div><p>Frontal Area: ${data['frontal_area']}mm²</p><p>Drag Coefficient: ${data['drag_coefficient']}</p><p class="drag">Drag: ${data['drag_force']}N</p><div class="buttons"><div class="download"><a href="${data.model.url}" download="${data['car_name']}.f3z"><i class="fa-solid fa-file-arrow-down"></i>  Download .f3z file</a></div><div class="button"><button onclick="unfurl(${data.iteration})"><i class="fa-solid fa-caret-down"></i> See more details</button></div></div><div class="i${data.iteration} hidden more-details"><div class="iso-surfaces"><h3>Iso Surfaces</h3><img src="${data.iso.url}"></div><div class="planes"><h3>Planes</h3><img src="${data.planes.url}"></div><div class="changes"><h3>Changes</h3>${derivation}<ul>${changelog}</ul></div>${addNotes}<div class="image">${preview}</div></div>`;
        document.getElementById('error').style.display = 'none';
        document.getElementById('upload').style.display = 'inline-block';
        document.getElementById('title').innerText = 'Latest Cars';
        document.getElementById('loadMore').style.display = 'flex';
        document.querySelector('model-viewer').style.height = '100%';
        document.querySelector('model-viewer').style.height = `${document.querySelector('model-viewer').offsetHeight}px`;
        document.getElementById('logged-username').innerText = `Logged in as ${data.name}`;
    }
    catch (error) {
        document.querySelector('#main-error').textContent = error.message;
        document.querySelector('#main-error').style.display = 'inline-block';
        console.error(error);
    }

    dragCoefficient.addEventListener('input', () => {
        document.querySelector('#drag-calc').innerText = `Based on your values, we have calculated drag to be ${calcDrag(dragCoefficient.value, frontalArea.value)}N`
    });
    frontalArea.addEventListener('input', () => {
        document.querySelector('#drag-calc').innerText = `Based on your values, we have calculated drag to be ${calcDrag(dragCoefficient.value, frontalArea.value)}N`
    });
    form.addEventListener('change', () => {
        const currentValue = form.elements['scrutineerer'].value;
        if (currentValue !== 'chen') {
            document.querySelector('#funny').style.display = 'inline';
        }
        else {
            document.querySelector('#funny').style.display = 'none';
        }
    })
});
let errored;
form.addEventListener('submit', async (e) => {
    error.style.display = 'none';
    e.preventDefault();
    const errors = [];
    errored = false;

    // check if everything exists
    const theGreatArray = [carName, dateCreated, frontalArea, dragCoefficient, scrutineerer, derivedCar, changelog, carModel, iso, planes];
    const theGreatExistenceArray = [carName.value, dateCreated.value, frontalArea.value, dragCoefficient.value, scrutineerer, derivedCar.value, changelog.value, carModel.files[0], iso.files[0], planes.files[0]];
    if (!theGreatExistenceArray.every(Boolean)) {
        errored = true;
        for (let i of theGreatArray) {
            if (!i && i === scrutineerer) {
                errors.push('Please provide a value for the person who scrutineered your car.');
            }
            else if (!i.value) {
                errors.push(`Please provide a value for ${i.name}.`);
            }
        }
    }

    if (carName.value.length > 50) {
        errored = true;
        errors.push('Please enter a shorter car name.');
    }
    if (carName.value.length < 3 && carName.value.length > 0) {
        errored = true;
        errors.push('Please enter a longer car name.');
    }

    const dateCreated = new Date(dateCreated.value);
    const upperBound = new Date('2028-01-01');
    const lowerBound = new Date('2026-10-01');
    if (dateCreated > upperBound) {
        errored = true;
        errors.push('Please enter a valid date.');
    }
    if (dateCreated < lowerBound) {
        errored = true;
        errors.push('Please enter a valid date.');
    }

    if (frontalArea > 5000) {
        errored = true;
        errors.push('Please enter a valid frontal area.');
    }
    if (frontalArea < 1000) {
        errored = true;
        errors.push('Please enter a valid frontal area.');
    }

    if (dragCoefficient > 2) {
        errored = true;
        errors.push('Please enter a valid drag coefficient.');
    }
    if (dragCoefficient < 0) {
        errored = true;
        errors.push('Please enter a valid drag coefficient.');
    }

    if (scrutineerer)

    if (errored) {
        let text = '';
        for (let i of errors) {
            text += " ";
            text += i;
        }
        error.innerText = text;
        error.style.display = 'inline-block';
    }
})