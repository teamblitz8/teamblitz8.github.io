const form = document.querySelector('#car-info');
const error = document.querySelector('#metadata-error');
const frontalArea = document.querySelector('#frontal-area');
const dragCoefficient = document.querySelector('#drag-coefficient');
const carModel = document.querySelector('#car-model');
const iso = document.querySelector('#iso');
const planes = document.querySelector('#planes');
const preview = document.querySelector('#preview');
let nextIteration;
let theCar;

const upload = async (type, data, carid, fileType) => {
    let body;
    let contentHeader;

    if (type === 'fullworks') {
        const metadata = await upload('text', data.metadata, theCar, fileType);
        if (!metadata.success) return { success: false, error: metadata.error };
        const carModel = await upload('f3d', data.carModel, theCar, fileType);
        if (!carModel.success) return { success: false, error: carModel.error };
        const iso = await upload('iso', data.iso, theCar, fileType);
        if (!iso.success) return { success: false, error: iso.error };
        const planes = await upload('planes', data.planes, theCar, fileType);
        if (!planes.success) return { success: false, error: planes.error };
        const preview = await upload('preview', data.preview, theCar, fileType);
        if (!preview.success) return { success: false, error: preview.error };

        return { success: true };
    }
    else if (type === 'text') {
        body = JSON.stringify(data);
        contentHeader = 'application/json';
    }
    else if (type === 'f3d') {
        body = data;
        contentHeader = 'application/octet-stream';
    }
    else if (type === 'iso') {
        body = data;
        contentHeader = 'image/png';
    }
    else if (type === 'planes') {
        body = data;
        contentHeader = 'image/png';
    }
    else if (type === 'preview') {
        body = data;
        if (data.name.split('.')[1] === 'png') {
            contentHeader = 'image/png';
        }
        else if (data.name.split('.')[1] === 'glb') {
            contentHeader = 'model/gltf-binary';
        }
    }
    else {
        return { success: false, error: 'Incorrect upload type.' };
    }

    try {
        const url = new URL(`https://back.teamblitz.workers.dev/api/dashboard/${type}`);
        url.search = new URLSearchParams({ carid: carid, fileType: fileType });
        const response = await fetch(url, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': contentHeader
            },
            credentials: 'include'
        });

        let data;
        try {
            data = await response.json();
            if (!response.ok) {
                console.error(data.message);
                throw new Error('There was an error uploading the car data to the server. Please contact the administrator.');
            }
            else {
                theCar = data.carid;
                return { success: true }
            }
        }
        catch {
            console.error(`Malformed JSON response from server when uploading ${type}`);
            throw new Error(`Malformed JSON response from server when uploading ${type}`)
        }
    }
    catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

const calcDrag = (cd, fa) => {
    return 0.5 * 1.196 * 225 * Number(fa) * Number(cd) / 1000000;
}

const unfurl = async (iteration) => {
    document.querySelector(`.i${iteration}`).classList.toggle('hidden');
    const button = document.querySelector(`.i${iteration}`).parentNode.querySelector('.buttons .button button');

    if (button.textContent === ' See more details') {
        button.innerText = '<i class="fa-solid fa-caret-up"></i>  See fewer details';
    }
    else if (button.textContent === ' See fewer details') {
        button.innerText = '<i class="fa-solid fa-caret-down"></i>  See more details';
    }
}

const getData = async (type, iterationNumber) => {
    if (iterationNumber < 1) return;
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
    document.querySelector('#loadMore button').innerText = 'Fetching car data..';

    try {
        const dat = await getData('fullworks', nextIteration);

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
            preview = `<img src="${data.preview.url}" class="model-viewer ii${data.iteration}">`;
        }
        else if (data.preview.contentType === 'model/gltf-binary') {
            preview = `<model-viewer id="car-model" src="${data.preview.url}" class="model-viewer ii${data.iteration}" camera-controls></model-viewer>`;
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

        let addNotes = '';
        if (data['additional_notes'] !== null) {
            addNotes = `<div class="notes"><h3>Additional notes</h3><p>${data['additional_notes']}</p></div></div></div>`;
        }

        nextIteration = Number(data.iteration) - 1;
        if (nextIteration !== 0) {
            document.querySelector('#loadMore button').style.display = 'flex';
        }
        else {
            document.querySelector('#loadMore button').style.display = 'none';
        }

        devContainer.innerHTML += `<div class="car"><div class="details"><h3>${data['car_name']} - Iteration #${data.iteration}</h3><div class="creator"><img src="${await fetchpfpurl(data.creatorUsername)}" class="portrait"><div class="person"><h3>${data.creatorName}</h3><p class="date"><i class="fa-solid fa-calendar"></i> Created ${(new Date(data['date_created'])).toDateString()}</p><p><i class="fa-solid fa-magnifying-glass"></i> Scrutineered by ${data.scrutineerName}</p></div></div><p>Frontal Area: ${data['frontal_area']}mm²</p><p>Drag Coefficient: ${data['drag_coefficient']}</p><p class="drag">Drag: ${data['drag_force']}N</p><div class="buttons"><div class="download"><a href="${data.model.url}" download="${data['car_name']}.f3z"><i class="fa-solid fa-file-arrow-down"></i>  Download .f3z/.f3d file</a></div><div class="button"><button onclick="unfurl(${data.iteration})"><i class="fa-solid fa-caret-down"></i> See more details</button></div></div><div class="i${data.iteration} hidden more-details"><div class="iso-surfaces"><h3>Iso Surfaces</h3><img src="${data.iso.url}"></div><div class="planes"><h3>Planes</h3><img src="${data.planes.url}"></div><div class="changes"><h3>Changes</h3>${derivation}<ul>${changelog}</ul></div>${addNotes}<div class="image">${preview}</div></div>`;
        
        document.querySelector(`.ii${data.iteration}`).style.height = '100%';
        document.querySelector(`.ii${data.iteration}`).style.height = `${document.querySelector(`.ii${data.iteration}`).offsetHeight}px`;
        document.querySelector('#loadMore button').innerText = '<i class="fa-solid fa-chevron-down"></i> Load more';
    }
    catch (error) {
        document.querySelector('#loadMore button').innerText = error.message;
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.querySelector('#main-error').innerText = 'Fetching car data..';
    document.querySelector('#loadMore button').style.display = 'none';

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
            preview = `<img src="${data.preview.url}" class="model-viewer">`;
        }
        else if (data.preview.contentType === 'model/gltf-binary') {
            preview = `<model-viewer id="car-model" src="${data.preview.url}" class="model-viewer" camera-controls></model-viewer>`;
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

        let addNotes = '';
        if (data['additional_notes'] !== null) {
            addNotes = `<div class="notes"><h3>Additional notes</h3><p>${data['additional_notes']}</p></div></div></div>`;
        }

        nextIteration = Number(data.iteration) - 1;

        devContainer.innerHTML += `<div class="car"><div class="details"><h3>${data['car_name']} - Iteration #${data.iteration}</h3><div class="creator"><img src="${await fetchpfpurl(data.creatorUsername)}" class="portrait"><div class="person"><h3>${data.creatorName}</h3><p class="date"><i class="fa-solid fa-calendar"></i> Created ${(new Date(data['date_created'])).toDateString()}</p><p><i class="fa-solid fa-magnifying-glass"></i> Scrutineered by ${data.scrutineerName}</p></div></div><p>Frontal Area: ${data['frontal_area']}mm²</p><p>Drag Coefficient: ${data['drag_coefficient']}</p><p class="drag">Drag: ${data['drag_force']}N</p><div class="buttons"><div class="download"><a href="${data.model.url}" download="${data['car_name']}.f3z"><i class="fa-solid fa-file-arrow-down"></i>  Download .f3z/.f3d file</a></div><div class="button"><button onclick="unfurl(${data.iteration})"><i class="fa-solid fa-caret-down"></i> See more details</button></div></div><div class="i${data.iteration} hidden more-details"><div class="iso-surfaces"><h3>Iso Surfaces</h3><img src="${data.iso.url}"></div><div class="planes"><h3>Planes</h3><img src="${data.planes.url}"></div><div class="changes"><h3>Changes</h3>${derivation}<ul>${changelog}</ul></div>${addNotes}<div class="image">${preview}</div></div>`;
        document.getElementById('main-error').style.display = 'none';
        document.getElementById('upload').style.display = 'inline-block';
        document.getElementById('title').innerText = 'Latest Cars';
        document.querySelector('.model-viewer').style.height = '100%';
        document.querySelector('.model-viewer').style.height = `${document.querySelector('.model-viewer').offsetHeight}px`;
        document.getElementById('logged-username').innerText = `Logged in as ${data.name}`;

        if (nextIteration !== 0) document.querySelector('#loadMore button').style.display = 'flex';
    }
    catch (error) {
        document.querySelector('#main-error').textContent = error.message;
        document.querySelector('#main-error').style.display = 'inline-block';
        console.error(error);
    }

    document.querySelector('#funny').style.display = 'none';

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
    });
    carModel.addEventListener('change', () => {
        if (carModel.files.length !== 0) {
            document.getElementById('car-model-button').innerText = `File selected: ${carModel.files[0].name}, ${carModel.files[0].size} bytes`;
        }
    });
    iso.addEventListener('change', () => {
        if (iso.files.length !== 0) {
            document.getElementById('iso-button').innerText = `File selected: ${iso.files[0].name}, ${iso.files[0].size} bytes`;
        }
    });
    planes.addEventListener('change', () => {
        if (planes.files.length !== 0) {
            document.getElementById('planes-button').innerText = `File selected: ${planes.files[0].name}, ${planes.files[0].size} bytes`;
        }
    });
    preview.addEventListener('change', () => {
        if (preview.files.length !== 0) {
            document.getElementById('preview-button').innerText = `File selected: ${preview.files[0].name}, ${preview.files[0].size} bytes`;
        }
    });
});

let errored;

form.addEventListener('submit', async (e) => {
    error.style.display = 'none';
    e.preventDefault();
    const errors = [];
    errored = false;

    const carName = document.querySelector('#name');
    const dateCreated = document.querySelector('#date');
    const scrutineerer = document.querySelector('input[name="scrutineerer"]:checked');
    const derivedCar = document.querySelector('#derived-car');
    const changelog = document.querySelector('#changelog');
    let addDetails = document.querySelector('#add-notes');

    // check if everything exists
    const theGreatArray = [carName, dateCreated, frontalArea, dragCoefficient, scrutineerer, derivedCar, changelog, carModel, iso, planes, preview];
    const theGreatExistenceArray = [carName.value, dateCreated.value, frontalArea.value, dragCoefficient.value, scrutineerer, derivedCar.value, changelog.value, carModel.files[0], iso.files[0], planes.files[0], preview.files[0]];
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

    if (carName.value.trim().length > 50) {
        errored = true;
        errors.push('Please enter a shorter car name.');
    }
    if (carName.value.trim().length < 3 && carName.value.trim().length > 0) {
        errored = true;
        errors.push('Please enter a longer car name.');
    }

    const dateMade = new Date(dateCreated.value);
    const upperBound = new Date('2028-01-01');
    const lowerBound = new Date('2026-10-01');
    if (dateMade > upperBound) {
        errored = true;
        errors.push('Please enter a valid date.');
    }
    if (dateMade < lowerBound) {
        errored = true;
        errors.push('Please enter a valid date.');
    }

    if (frontalArea.valueAsNumber > 5000) {
        errored = true;
        errors.push('Please enter a valid frontal area.');
    }
    if (frontalArea.valueAsNumber < 1000) {
        errored = true;
        errors.push('Please enter a valid frontal area.');
    }

    if (dragCoefficient.valueAsNumber > 2) {
        errored = true;
        errors.push('Please enter a valid drag coefficient.');
    }
    if (dragCoefficient.valueAsNumber < 0) {
        errored = true;
        errors.push('Please enter a valid drag coefficient.');
    }

    if (scrutineerer) {
        if (!['chen', 'yash', 'pranit', 'josh'].includes(scrutineerer.value)) {
        errored = true;
        errors.push('Please enter a valid scrutineerer.');
        }
    }

    if (changelog.value.trim().length < 10) {
        errored = true;
        errors.push('Please enter more changes.');
    }
    
    if (changelog.value.trim().length > 1000) {
        errored = true;
        errors.push('Please enter fewer changes.');
    }

    const changes = changelog.value.trim().split('[BRK;]');

    for (let i of changes) {
        if (i.trim() === '') {
            errored = true;
            errors.push('Please do not put multiple separators in the changelog in a row.');
            break;
        } 
    }

    if (addDetails === null) {
        addDetails = 'null';
    }
    
    if (addDetails.value.trim().length > 1000) {
        errored = true;
        errors.push('Please enter less additional information.');
    }

    if (carModel.files[0]) {
        if (carModel.files[0].name.split('.')[1] !== 'f3d' && carModel.files[0].name.split('.')[1] !== 'f3z') {
            errored = true;
            errors.push('Please upload an .f3d or .f3z file for car model.');
        }

        if (carModel.files[0].size > 100000000) {
            errored = true;
            errors.push('Your car model file must not exceed 100MB.');
        }
    }

    if (iso.files[0]) {
        if (iso.files[0].name.split('.')[1] !== 'png') {
            errored = true;
            errors.push('Please upload a png file for iso surfaces.');
        }

        if (iso.files[0].size > 5000000) {
            errored = true;
            errors.push('Your iso surfaces image file must not exceed 5MB.');
        }
    }

    if (planes.files[0]) {
        if (planes.files[0].name.split('.')[1] !== 'png') {
            errored = true;
            errors.push('Please upload a png file for planes.');
        }

        if (planes.files[0].size > 5000000) {
            errored = true;
            errors.push('Your planes image file must not exceed 5MB.');
        }
    }

    if (preview.files[0]) {
        if (preview.files[0].name.split('.')[1] !== 'png' && preview.files[0].name.split('.')[1] !== 'glb') {
            errored = true;
            errors.push('Your car preview must be either a .glb or .png file.');
        }

        if (preview.files[0].size > 100000000) {
            errored = true;
            errors.push('Your car preview file must not exceed 100MB.');
        }
    }

    if (errored) {
        let text = '';
        for (let i of errors) {
            text += " ";
            text += i;
        }
        error.innerText = text;
        error.style.display = 'inline-block';
    }
    else {
        submit.disabled = true;

        error.innerText = 'Uploading data..';
        error.style.display = 'inline-block';

        const success = await upload('fullworks', {
            metadata: {
                carName: carName.value.trim(),
                dateCreated: dateMade.toISOString(),
                frontalArea: frontalArea.valueAsNumber,
                dragCoefficient: dragCoefficient.valueAsNumber,
                scrutineerer: scrutineerer.value.toLowerCase(),
                derivedCar: Number(derivedCar.value),
                changelog: changes,
                addDetails: addDetails.value.trim()
            },
            carModel: carModel.files[0],
            iso: iso.files[0],
            planes: planes.files[0],
            preview: preview.files[0]
        }, theCar, carModel.files[0].name.split('.')[1]);

        if (success.success) {
            error.innerText = 'Upload successful!';
            setTimeout(() => {
                window.location.replace('https://teamblitz.pages.dev/portal/');
            }, 1000);
        }
        else {
            error.innerText = success.error;
        }
    }
})