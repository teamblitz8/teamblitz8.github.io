const form = document.querySelector('#car-info');
let nextIteration;
let newCarID;

const calcDrag = (cd, fa) => {
    return 0.5 * 1.196 * 225 * Number(fa) * Number(cd) / 1000000;
}

const unfurl = async (iteration) => {
    const details = document.querySelector(`.i${iteration}`);
    const button = details.parentNode.querySelector('.buttons .button button');
    const expanded = !details.classList.toggle('hidden');
    const icon = button.querySelector('i');

    button.lastChild.textContent = expanded ? ' See fewer details' : ' See more details';
    icon.className = expanded ? 'fa-solid fa-caret-up' : 'fa-solid fa-caret-down';
}

const fetchSelects = async () => {
    try {
        const response = await fetch('https://back.teamblitz.workers.dev/api/all-cars', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await parseJSON(response, ['message', 'cars']);
            const select = document.querySelector('#derived-car');
            for (let i of data.cars) {
                const newOption = document.createElement('option');
                newOption.innerText = i;
                newOption.value = i.split('#')[1].split(')')[0];

                if (i === data.cars.at(-1)) newOption.innerText = `Latest iteration: ${i.split('(')[0].trim()}`;

                select.appendChild(newOption);
            }
        }
        else await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401, false, '#main-error');
    }
    catch (error) {
        console.error(error);
        await showError(error, false, false, undefined, undefined, false, '#main-error');
    }
}

const showPopup = () => document.querySelector('.popup-shroud').classList.toggle('popup-open');

document.addEventListener('DOMContentLoaded', async () => {
    const carModel = document.querySelector('#car-model');
    const iso = document.querySelector('#iso');
    const planes = document.querySelector('#planes');
    const preview = document.querySelector('#preview');

    await processFullCar(0);

    await fetchSelects();

    document.querySelector('#drag-coefficient').addEventListener('input', () => document.querySelector('#drag-calc').innerText = `Based on your values, we have calculated drag to be ${calcDrag(document.querySelector('#drag-coefficient').value, document.querySelector('#frontal-area').value)}N`);
    document.querySelector('#frontal-area').addEventListener('input', () => document.querySelector('#drag-calc').innerText = `Based on your values, we have calculated drag to be ${calcDrag(document.querySelector('#drag-coefficient').value, document.querySelector('#frontal-area').value)}N`);
    form.addEventListener('change', () => {
        const currentValue = form.elements['scrutineerer'].value;
        if (currentValue !== 'chen' && currentValue) document.querySelector('#funny').style.display = 'inline';
        else document.querySelector('#funny').style.display = 'none';
    });

    for (let [key, value] of Object.entries({ carModel: carModel, iso: iso, planes: planes, preview: preview })) {
        value.addEventListener('change', () => {
            if (value.files.length !== 0) document.getElementById(`${key}-button`).innerText = `File selected: ${value.files[0].name}, ${value.files[0].size} bytes`;
        })
    }

    hideError('#metadata-error');

    if (name) {
        document.querySelector('#greeting').innerText = `Hello, ${name}`;
        document.querySelector('#logged-username').innerText = `Logged in as ${username}`;
    }
});

form.addEventListener('submit', async (e) => {
    hideError('#metadata-error');
    e.preventDefault();

    const carName = document.querySelector('#name').value?.trim();
    const dateCreated = new Date(document.querySelector('#date').value);
    const scrutineerer = document.querySelector('input[name="scrutineerer"]:checked')?.value;
    const derivedCar = document.querySelector('#derived-car').value;
    const changelog = document.querySelector('#changelog').value?.trim();
    const addDetails = document.querySelector('#add-notes').value?.trim();
    const frontalArea = document.querySelector('#frontal-area').valueAsNumber;
    const dragCoefficient = document.querySelector('#drag-coefficient').valueAsNumber;
    const carModel = document.querySelector('#car-model').files[0];
    const iso = document.querySelector('#iso').files[0];
    const planes = document.querySelector('#planes').files[0];
    const preview = document.querySelector('#preview').files[0];
    const submit = document.querySelector('#submit');

    try {
        for (let i of [carName, dateCreated, scrutineerer, derivedCar, changelog, frontalArea, dragCoefficient, carModel, iso, planes, preview]) {
            if (!i || i === '' || i === null) throw new Error('Please fill in all required fields. ');
        }

        const upperBound = new Date('2028-01-01');
        const lowerBound = new Date('2026-10-01');

        if (carName.length > 50 || (carName.length < 3 && carName.length > 0)) throw new Error('Please enter a car name between 3 and 50 characters long.');
        if (Number.isNaN(dateCreated.getTime())) throw new Error('There was an unexpected error. Please refresh the page.');
        if (dateCreated > upperBound || dateCreated < lowerBound) throw new Error('Please enter a valid date.');
        if (frontalArea > 5000 || frontalArea < 1000) throw new Error('Please enter a valid frontal area.');
        if (dragCoefficient > 2 || dragCoefficient < 0) throw new Error('Please enter a valid drag coefficient.');
        if (!['chen', 'yash', 'pranit', 'josh'].includes(scrutineerer)) throw new Error('There was an unexpected error. Please refresh the page.');
        if (changelog.length < 10 || changelog.length > 1000) throw new Error('Please ensure your changelog is between 10 and 1000 characters long.');  
        if (addDetails.length > 1000) throw new Error('Please ensure any additional information is less than 1000 characters long.');
        if (carModel.name.split('.')[1].toLowerCase() !== 'f3d' && carModel.name.split('.')[1].toLowerCase() !== 'f3z') throw new Error('Please ensure your car model file is either a .f3z or a .f3d file.');
        if (carModel.size > 100000000) throw new Error('Please ensure your car model file does not exceed 100MB.');
        if (iso.name.split('.')[1].toLowerCase() !== 'png') throw new Error('Please ensure your iso surfaces file is a .png file.');
        if (iso.size > 5000000) throw new Error('Please ensure your iso surfaces file does not exceed 5MB.');
        if (planes.name.split('.')[1].toLowerCase() !== 'png') throw new Error('Please ensure your planes file is a .png file.');
        if (planes.size > 5000000) throw new Error('Please ensure your planes file does not exceed 5MB.');
        if (preview.name.split('.')[1].toLowerCase() !== 'png' && preview.name.split('.')[1].toLowerCase() !== 'glb') throw new Error('Please ensure your car preview file is either a .png or a .glb file.');
        if (preview.size > 100000000) throw new Error('Please ensure your car preview file does not exceed 100MB.');
        if (!/^-?\d+$/.test(derivedCar)) throw new Error('There was an unexpected error. Please refresh the page.');
    }
    catch (error) {
        await showError(error.message, false, false, undefined, undefined, false, '#metadata-error');
        throw new Error();
    }

    submit.disabled = true;
    await showError('Uploading data..', false, false, false, false, true, '#main-error');

    try {
        await toggleFullScreen();
        toggleLoading('Uploading data..', true);
        await upload('fullworks', {
            metadata: {
                carName: carName,
                dateCreated: dateCreated.toISOString(),
                frontalArea: frontalArea,
                dragCoefficient: dragCoefficient,
                scrutineerer: scrutineerer.toLowerCase(),
                derivedCar: Number(derivedCar),
                changelog: changelog,
                addDetails: addDetails
            },
            carModel: carModel,
            iso: iso,
            planes: planes,
            preview: preview
        }, { carModel: carModel.name.split('.')[1].toLowerCase(), preview: preview.name.split('.')[1].toLowerCase() });

        await showError('Upload successful!', false, false, false, false, true, '#main-error');
        setTimeout(() => {
            window.location.replace('https://teamblitz.pages.dev/portal/');
        }, 1000);
    }
    catch (error) {
        submit.disabled = false;
        toggleFullScreen();
        toggleLoading('', false);
        await showError(error.message, false, false, undefined, undefined, false, '#main-error');
    }
});