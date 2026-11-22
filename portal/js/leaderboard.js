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
            const container = document.querySelector('#leaderboard-container');
            let pfpMapping = {};
            let carMapping = {};
            let lowestDragMapping = {};
            let userMapping = {};

            if (!data) throw new Error(await showError('There was an unexpected error.', false, false, undefined, undefined, false, '#main-error'));

            for (let i of data.users) {
                const pfp = await fetchProfile(i.username);
                pfpMapping[i.username] = pfp;
                carMapping[i.username] = 'TBC';
                userMapping[i.username] = [];

                document.querySelector('#people').innerHTML += `<button onclick="swap('people', '${i.name.toLowerCase()}', this)" id="${i.name.toLowerCase()}">${i.name[0].toUpperCase() + i.name.slice(1).toLowerCase()}</button>`
            }

            data.cars = data.cars.toSorted((a, b) => a['drag_force'] - b['drag_force']);

            for (let i of data.cars) {
                carMapping[i['car_name']] = i.creatorUsername;
                if (!lowestDragMapping[i.creatorUsername]) lowestDragMapping[i.creatorUsername] = i['drag_force'];
                userMapping[i.username].push(i);
            }

            let add = '<div class="people all leaderboard shown"><h2></h2><h2>Stinky person</h2><h2>Cars created</h2><h2>Cars scrutineered</h2><h2>Lowest drag achieved</h2><h2>Wheels created</h2><h2>Lowest MoI achieved</h2>';

            let increment = 1;
            data.users = data.users.toSorted((a, b) => lowestDragMapping[a.username] - lowestDragMapping[b.username]);
            for (let i of data.users) {
                add += `<p class="number">${increment}</p><div class="person a${i.userid}"><img src="${pfpMapping[i.username]}"><p>${i.name.toLowerCase()}</p></div><p class="cars-created a${i.userid}">${i.iterations || '0'}</p><p class="cars-scrutineered a${i.userid}">${i.scrutineers || '0'}</p><p class="lowest-drag a${i.userid}">${lowestDragMapping[i.username] || 'N/A'}</p><p class="wheels-created a${i.userid}">TBC</p><p class="lowest-moi a${i.userid}">TBC</p>`;
                increment++;
            }

            increment = 0;
            container.innerHTML += `${add}</div>`;

            add = '';

            // sort by date created
            for (let i of data.users) {
                if (userMapping[i.username].length === 0) add += `<div class="people ${i.name.toLowerCase()} leaderboard empty"><div class="error" id="empty-error">There appears to be no data. Try changing some of the filters.</div></div>`
                add += `<div class="people ${i.name.toLowerCase()} leaderboard"><h2>Design</h2><h2>Date created</h2><h2>Frontal area</h2><h2>Drag coefficient</h2><h2>Drag</h2><h2>Moment of inertia</h2><h2>Factor of safety</h2><h2>Preview</h2>`
                for (let j of userMapping[i.username]) {
                    add += `<p class="name car ${j.carid}">${j['car_name']}</p><p class="date car ${j.carid}">${new Date(j['date_created']).toDateString()}</p><p class="frontal-area car ${j.carid}">${j['frontal_area']}mm²</p><p class="cd car ${j.carid}">${j['drag_coefficient']}</p><p class="drag car ${j.carid}">${j['drag_force']}N</p><p class="moi car ${j.carid}">TBC</p><p class="fos car ${j.carid}">TBC</p><a class="preview car ${j.carid}" href="" target="_blank"><i class="fa-solid fa-up-right-from-square"></i> View in new tab</a>`;
                }
                add += '</div>';
            }

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