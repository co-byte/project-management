document.addEventListener('DOMContentLoaded', () => {
    const activityNameInput = document.getElementById('activity-name') as HTMLInputElement;
    const addActivityBtn = document.getElementById('add-activity') as HTMLButtonElement;
    const activityList = document.getElementById('activity-list') as HTMLUListElement;
    const startSimulationBtn = document.getElementById('start-simulation') as HTMLButtonElement;

    addActivityBtn.addEventListener('click', () => {
        if (activityNameInput.value.trim()) {
            const li = document.createElement('li');
            li.textContent = activityNameInput.value;
            activityList.appendChild(li);
            activityNameInput.value = '';
        }
    });

    startSimulationBtn.addEventListener('click', () => {
        alert('Simulation started with ' + activityList.children.length + ' activities.');
    });
});

