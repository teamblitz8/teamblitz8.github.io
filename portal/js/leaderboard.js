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

            if (!data) throw new Error(await showError('There was an unexpected error.', false, false, undefined, undefined, false, '#main-error'));

            for (let i of data.users) {
                const pfp = await fetchProfile(i.username);
                pfpMapping[i.username] = pfp;
                carMapping[i.username] = 'TBC';
            }

            data.cars = data.cars.toSorted((a, b) => a['drag_force'] - b['drag_force']);

            for (let i of data.cars) {
                carMapping[i['car_name']] = i.creatorUsername;
                if (!lowestDragMapping[i.creatorUsername]) lowestDragMapping[i.creatorUsername] = i['drag_force'];
            }

            let add = '<div class="people all leaderboard shown"><h2></h2><h2>Stinky person</h2><h2>Cars created</h2><h2>Cars scrutineered</h2><h2>Lowest drag achieved</h2><h2>Wheels created</h2><h2>Lowest MoI achieved</h2>';

            let increment = 1;
            data.users = data.users.toSorted((a, b) => lowestDragMapping[a.username] - lowestDragMapping[b.username]);
            for (let i of data.users) {
                add += `<p class="number">${increment}</p><div class="person a${i.userid}"><img src="${pfpMapping[i.username]}"><p>${i.name}</p></div><p class="cars-created a${i.userid}">${i.iterations || '0'}</p><p class="cars-scrutineered a${i.userid}">${i.scrutineers || '0'}</p><p class="lowest-drag a${i.userid}">${lowestDragMapping[i.username] || 'N/A'}</p><p class="wheels-created a${i.userid}">TBC</p><p class="lowest-moi a${i.userid}">TBC</p>`;
                increment++;
            }

            increment = 0;
            container.innerHTML += `${add}</div>`;

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