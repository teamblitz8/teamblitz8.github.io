const swap = (type, arg, dom) => {
    document.querySelector(`#${type}`).querySelector(`.enabled`).classList.remove('enabled');
    dom.classList.add('enabled');
    let m = type;
    let n = arg;

    if (type === 'type') {
        document.querySelectorAll('.active')[1].classList.remove('active');
        document.querySelector(`#${arg}`).classList.add('active');
        m = arg;
        if (m === 'people') n = 'all';
        if (m === 'cars') n = 'drag';
        if (m === 'wheels') n = 'moi';
    }

    document.querySelector('.shown').classList.remove('shown');
    document.querySelector(`.${m}.${n}`).classList.add('shown');
}