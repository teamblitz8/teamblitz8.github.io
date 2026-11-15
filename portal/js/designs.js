const unfurl = async (iteration) => {
    const details = document.querySelector(`.i${iteration}`);
    const button = details.parentNode.querySelector('.buttons .button button');
    const expanded = !details.classList.toggle('hidden');
    const icon = button.querySelector('i');

    button.lastChild.textContent = expanded ? ' See fewer details' : ' See more details';
    icon.className = expanded ? 'fa-solid fa-caret-up' : 'fa-solid fa-caret-down';
}


document.addEventListener('DOMContentLoaded', async () => {
    const carModel = document.querySelector('#car-model');
    const iso = document.querySelector('#iso');
    const planes = document.querySelector('#planes');
    const preview = document.querySelector('#preview');
    await processFullCar(0);

    document.querySelector('#drag-coefficient').addEventListener('input', () => document.querySelector('#drag-calc').innerText = `Based on your values, we have calculated drag to be ${calcDrag(document.querySelector('#drag-coefficient').value, document.querySelector('#frontal-area').value)}N`);
    document.querySelector('#frontal-area').addEventListener('input', () => document.querySelector('#drag-calc').innerText = `Based on your values, we have calculated drag to be ${calcDrag(document.querySelector('#drag-coefficient').value, document.querySelector('#frontal-area').value)}N`);
    form.addEventListener('change', () => {
        const currentValue = form.elements['scrutineerer'].value;
        if (currentValue !== 'chen') document.querySelector('#funny').style.display = 'inline';
        else document.querySelector('#funny').style.display = 'none';
    });

    for (let [key, value] of Object.entries({ carModel, iso, planes, preview })) {
        value.addEventListener('change', () => {
            if (value.files.length !== 0) document.getElementById(`${key}-button`).innerText = `File selected: ${value.files[0].name}, ${value.files[0].size} bytes`;
        })
    }

    hideError();
});