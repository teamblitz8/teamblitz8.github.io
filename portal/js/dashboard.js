document.addEventListener('DOMContentLoaded', async () => {
    try {
        const dashboardURL = new URL('https://back.teamblitz.workers.dev/api/dashboard');
        dashboardURL.search = new URLSearchParams({ iterationNumbers: 'latest' }).toString();

        const response = await fetch(dashboardURL, {
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
            const greeting = document.querySelector('#greeting');
            greeting.textContent = `Hello, ${data.name}`;

            const menu = document.querySelector('#profile p');
            menu.textContent = data.username;

            const devContainer = document.querySelector('#development-container');

            for (const car of data.cars) {
                let changelog = '';

                for (let i of car.changelog) {
                    changelog += `<li>${i}</li>`;
                }

                // add support for glb files soon
                // switch from innerhtml asap

                devContainer.innerHTML += `<div class="car ${car.iteration}">
                <div class="details">
                    <h3>${car['car_name']} - Iteration #${car.iteration}</h3>
                    <div class="creator">
                        <img src="${car.creatorProfile}" class="portrait">
                        <div class="person">
                            <h3>${car.creatorName}</h3>
                            <p>Created ${car['date_created']}</p>
                            <p>Scrutineered by ${car.scrutineerName}</p>
                        </div>
                    </div>
                    <p>Frontal Area: ${car['frontal_area']}mm2</p>
                    <p>Drag Coefficient: ${car['drag_coefficient']}</p>
                    <p class="drag">Drag: ${car['drag_force']}N</p>
                    <div class="buttons">
                        <div class="download"><a href="${car['car_model_file_path']}"><i class="fa-solid fa-file-arrow-down"></i>  Download .f3z file</a></div>
                        <div class="button"><button onclick="unfurl(${car.iteration})"><i class="fa-solid fa-caret-down"></i> See more details</button></div>
                    </div>
                    <div class="hidden">
                        <div class="iso-surfaces">
                            <h3>Iso Surfaces</h3>
                            <img src="${car['iso_surfaces_file_path']}">
                        </div>
                        <div class="planes">
                            <h3>Planes</h3>
                            <img src="${car['planes_file_path']}">
                        </div>
                        <div class="changes">
                            <h3>Changes</h3>
                            <p>This design was derived from iteration #${car.derivedCarIteration}, ${car.derivedCarName}. Changes include:</p>
                            <ul>
                                ${changelog}
                            </ul>
                        </div>
                        <div class="notes">
                            <h3>Additional notes</h3>
                            <p>${car['additional_notes']}</p>
                        </div>
                    </div>
                </div>
                <div class="image">
                    <img src="${car['car_preview_file_path']}">
                </div>
            </div>`;
            }
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
            if (!Object.hasOwn(data, 'name') || !Object.hasOwn(data, 'username')) {
                throw new Error('There was an error parsing the JSON. Please contact the administrator.');
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

const unfurl = async (iteration) => {
    const div = document.querySelector(`${iteration}`);
    
}

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