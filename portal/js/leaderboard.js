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

window.addEventListener('load', () => {
    switchActive(document.querySelector('#type').querySelector('button'), document.querySelector('#type'));
    switchActive(document.querySelector('#people').querySelector('button'), document.querySelector('#people'));
    switchActive(document.querySelector('#cars').querySelector('button'), document.querySelector('#cars'));
    switchActive(document.querySelector('#wheels').querySelector('button'), document.querySelector('#wheels'));
});