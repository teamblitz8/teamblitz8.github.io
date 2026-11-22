const swap = (type, arg, dom) => {
    document.querySelector(`#${type}`).querySelector(`.enabled`).classList.remove('enabled');
    dom.classList.add('enabled');
    let m = type;
    let n = arg;

    if (type === 'type') {
        document.querySelectorAll('.active')[1].classList.remove('active');
        document.querySelector(`#${arg}`).classList.add('active');
        m = arg;
        n = document.querySelector(`#${arg}`).querySelector('.enabled').id
        console.log(n);
    }

    document.querySelector('.shown').classList.remove('shown');
    document.querySelector(`.${m}.${n}`).classList.add('shown');
    switchActive(dom, document.querySelector(`#${type}`));
}

const switchActive = (newButton, parentDOM) => {
    const bg = parentDOM.querySelector('.active-indicator');
    bg.style.width = `${newButton.offsetWidth}px`;
    bg.style.height = `${newButton.offsetHeight}px`;
    bg.style.transform = `translate(${newButton.offsetLeft}px, ${newButton.offsetTop}px)`;
}

const initialiseLeaderboard = (userArray) => {
    const result = {};
    for (let i of userArray) {
        document.querySelector('#people').innerHTML += `<button onclick="swap('people', '${i.name.toLowerCase().split(' ').join('')}', this)" id="${i.name.toLowerCase().split(' ').join('')}">${i.name}</button>`;
        result[i.userid] = [];
    }

    return result;
}

const mapUsernamesToProfile = async (users) => {
    let result = {};
    for (let i of users) {
        result[i.userid] = await fetchProfile(i.username);
    }
    return result;
}

const sortAndCategorise = (criteria, array, categorisedObject, categories, type) => {
    const arr = sortBy(array, type, criteria);
    let obj = categorisedObject;

    for (let i of arr) {
        const creator = categories[categories.findIndex(a => a.userid === i.creatorid)];
        if (creator.lowestDrag > i['drag_force']) creator.lowestDrag = i['drag_force'];

        obj[i.creatorid].push(i);
    }

    return obj;
}

const sortBy = (array, type, criteria) => {
    let arr;
    if (type === 'ascending') arr = array.toSorted((a, b) => a[criteria] - b[criteria]);
    else if (type === 'descending') arr = array.toSorted((a, b) => b[criteria] - a[criteria]);

    return arr;
}

window.addEventListener('load', async () => {
    try {
        toggleFullScreen();
        toggleLoading('Fetching data...', true);
        
        const response = await fetch('https://back.teamblitz.workers.dev/api/leaderboard', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) throw new Error(await showError(undefined, response, true, 'https://teamblitz.pages.dev/portal/login', 401, false, '#main-error'));
        else {
            let data = await parseJSON(response, ['cars', 'users']);
            if (!data) throw new Error(await showError('There was an unexpected error.', false, false, undefined, undefined, false, '#main-error'));

            const container = document.querySelector('#leaderboard-container');
            const pfpMapping = await mapUsernamesToProfile(data.users);

            let add = '<div class="people all leaderboard shown"><h2></h2><h2>Stinky person</h2><h2>Cars created</h2><h2>Cars scrutineered</h2><h2>Lowest drag achieved</h2><h2>Wheels created</h2><h2>Lowest MoI achieved</h2>';
            let increment = 1;
            data.users = data.users.toSorted((a, b) => a.lowestDrag - b.lowestDrag);
            for (let i of data.users) {
                add += `<p class="number">${increment}</p><div class="person a${i.userid}"><img src="${pfpMapping[i.userid]}"><p>${i.name}</p></div><p class="cars-created a${i.userid}">${i.iterations || '0'}</p><p class="cars-scrutineered a${i.userid}">${i.scrutineers || '0'}</p><p class="lowest-drag a${i.userid}">${i.lowestDrag || 'N/A'}</p><p class="wheels-created a${i.userid}">TBC</p><p class="lowest-moi a${i.userid}">TBC</p>`;
                increment++;
            }
            container.innerHTML += `${add}</div>`;

            add = '';
            const initialisedUserObject = initialiseLeaderboard(data.users);
            const userCars = sortAndCategorise('date_created', data.cars, initialisedUserObject, data.users, 'descending');
            for (let i of data.users) {
                increment = 1;
                if (userCars[i.creatorid].length === 0) add += `<div class="people ${i.name.toLowerCase().split(' ').join('')} leaderboard empty"><div class="error" id="empty-error">There appears to be no data. Try changing some of the filters.</div></div>`
                add += `<div class="people ${i.name.toLowerCase().split(' ').join('')} leaderboard"><h2></h2><h2>Design</h2><h2>Date created</h2><h2>Frontal area</h2><h2>Drag coefficient</h2><h2>Drag</h2><h2>Moment of inertia</h2><h2>Factor of safety</h2><h2>Preview</h2>`
                for (let j of userCars[i.creatorid]) {
                    add += `<p class="number">${increment}</p><p class="name car a${j.carid}">${j['car_name']}</p><p class="date car a${j.carid}">${new Date(j['date_created']).toDateString()}</p><p class="frontal-area car a${j.carid}">${j['frontal_area']}mm²</p><p class="cd car a${j.carid}">${j['drag_coefficient']}</p><p class="drag car a${j.carid}">${j['drag_force']}N</p><p class="moi car a${j.carid}">TBC</p><p class="fos car a${j.carid}">TBC</p><a class="preview car a${j.carid}" href="" target="_blank"><i class="fa-solid fa-up-right-from-square"></i> View in new tab</a>`;
                    increment++;
                }
                add += '</div>';
            }
            container.innerHTML += add;

            add = '';
            for (let i of ['drag', 'frontal-area', 'cd', 'car-date']) {
                let j;
                let order = 'ascending'
                if (i === 'drag') j = i;
                else if (i === 'frontal-area') j = 'frontal_area';
                else if (i === 'cd') j = 'drag_coefficient';
                else if (i === 'car-date') {
                    order = 'descending';
                    j = 'date_created';
                }

                data.cars = sortBy(data.cars, order, j);
                increment = 1;

                add += `<div class="cars ${i} leaderboard"><h2></h2><h2>Design</h2><h2>Creator</h2><h2>Scrutineer</h2><h2>Date created</h2><h2>Frontal area</h2><h2>Drag coefficient</h2><h2>Drag</h2><h2>Preview</h2>`;
                for (let j of data.cars) {
                    add += `<p class="number">${increment}</p><p class="name car a${j.carid}">${j['car_name']}</p><div class="creator person a${j.creatorid}"><img src="${pfpMapping[j.creatorUsername]}"><p>${j.creatorName}</p></div><div class="scrutineer person a${j.scrutineerid}"><img src="${pfpMapping[j.scrutineerUsername]}"><p>${j.scrutineerName}</p></div><p class="date car a${j.carid}">${new Date(j['date_created']).toDateString()}</p><p class="frontal-area car a${j.carid}">${j['frontal_area']}mm²</p><p class="cd car a${j.carid}">${j['drag_coefficient']}</p><p class="drag car a${j.carid}">${j['drag_force']}N</p><a class="preview car a${j.carid}" href="" target="_blank"><i class="fa-solid fa-up-right-from-square"></i> View in new tab</a>`
                    increment++;
                }
                add += '</div>';
            }

            container.innerHTML += add;
            document.getElementById('options').style.display = 'flex';

            switchActive(document.querySelector('#type').querySelector('button'), document.querySelector('#type'));
            switchActive(document.querySelector('#people').querySelector('button'), document.querySelector('#people'));
            switchActive(document.querySelector('#cars').querySelector('button'), document.querySelector('#cars'));
            switchActive(document.querySelector('#wheels').querySelector('button'), document.querySelector('#wheels'));

            toggleFullScreen();
            toggleLoading('', false);
        }
    }
    catch (error) {
        await toggleLoading('', false);
        await showError(error, false, false, undefined, undefined, false, '#main-error');
    }
});