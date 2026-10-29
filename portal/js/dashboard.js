const unfurl = async (iteration) => {
    const div = document.querySelector(`${iteration}`);
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

                if ((new Set([meta.success, model.success, preview.success, iso.success, planes.success]).length === 1) && (meta.success)) {
                    return {
                        success: true,
                        data: { ...meta.data, model: model, preview: preview, iso: iso, planes: planes }
                    }
                }
                else {
                    const errors = [];
                    switch ('string') {
                        case typeof meta.data:
                            errors.push(meta.data);
                            break;
                        case typeof model.data:
                            errors.push(model.data);
                            break;
                        case typeof preview.data:
                            errors.push(preview.data);
                            break;
                        case typeof iso.data:
                            errors.push(iso.data);
                            break;
                        case typeof planes.data:
                            errors.push(planes.data);
                            break;
                        default:
                            errors.push('An unexpected error occurred.');
                    }
                    throw new Error(errors);
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

document.addEventListener('DOMContentLoaded', async () => {
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
            derivation = 'Key features include:';
        }

        devContainer.innerHTML += `
        <div class="car ${data.iteration}">
            <div class="details">
                <h3>${data['car_name']} - Iteration #${data.iteration}</h3>
                <div class="creator">
                    <img src="../imgs/yash_lowres_square.JPG" class="portrait">
                    <div class="person">
                        <h3>${data.creatorName}</h3>
                        <p>Created ${data['date_created']}</p>
                        <p>Scrutineered by ${data.scrutineerName}</p>
                    </div>
                </div>
                <p>Frontal Area: ${data['frontal_area']}mm2</p>
                <p>Drag Coefficient: ${data['drag_coefficient']}</p>
                <p class="drag">Drag: ${data['drag_force']}N</p>
                <div class="buttons">
                    <div class="download"><a href="${data.model.url}"><i class="fa-solid fa-file-arrow-down"></i>  Download .f3z file</a></div>
                    <div class="button"><button onclick="unfurl(${data.iteration})"><i class="fa-solid fa-caret-down"></i> See more details</button></div>
                </div>
                <div class="hidden">
                    <div class="iso-surfaces">
                        <h3>Iso Surfaces</h3>
                        <img src="${data.iso.url}">
                    </div>
                    <div class="planes">
                        <h3>Planes</h3>
                        <img src="${data.planes.url}">
                    </div>
                    <div class="changes">
                        <h3>Changes</h3>
                        ${derivation}
                        <ul>
                            ${changelog}
                        </ul>
                    </div>
                    <div class="notes">
                        <h3>Additional notes</h3>
                        <p>${data['additional_notes']}</p>
                    </div>
                </div>
            </div>
            <div class="image">
                ${preview}
            </div>
        </div>`;
        }
    catch (error) {
        document.querySelector('#error').textContent = error.message;
        document.querySelector('#error').style.display = 'inline-block';
        console.error(error);
    }
});