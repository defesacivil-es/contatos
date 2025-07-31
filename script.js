// IMPORTANTE:
// A aplicação agora busca dados de duas abas de uma planilha do Google Sheets.
// COMPDEC_URL: Contatos dos municípios.
// REPDEC_URL: Informações das Regionais de Proteção e Defesa Civil.
// Verifique se os links e GIDs estão corretos.
const COMPDEC_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZ25h1B9vD1IUmYVbD1-s4Adxg-BYtUojWfHbtT-1MtMCoT8oNMkelZgavVzJZFkP7c5Qj5Z9xmsn2/pub?gid=0&single=true&output=csv';
const REPDEC_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZ25h1B9vD1IUmYVbD1-s4Adxg-BYtUojWfHbtT-1MtMCoT8oNMkelZgavVzJZFkP7c5Qj5Z9xmsn2/pub?gid=752420072&single=true&output=csv';

const nameInput = document.getElementById('name-input');
const citySelect = document.getElementById('city-select');
const regionalSelect = document.getElementById('regional-select');
const searchBtn = document.getElementById('search-btn');
const searchRegionalBtn = document.getElementById('search-regional-btn');

const resultsContainer = document.getElementById('results-container');
const messageArea = document.getElementById('message-area');
const tabCoordinator = document.getElementById('tab-coordinator');
const tabRegional = document.getElementById('tab-regional');
const searchCoordinatorForm = document.getElementById('search-coordinator-form');
const searchRegionalForm = document.getElementById('search-regional-form');

let compdecData = [];
let repdecData = [];
let compdecHeaders = [];
let repdecHeaders = [];

/**
 * Normalizes a string by converting to lowercase and removing diacritical marks (accents).
 * @param {string} str The string to normalize.
 * @returns {string} The normalized string.
 */
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Parses a CSV text into an array of objects.
 * @param {string} csvText The raw CSV string.
 * @returns {{headers: string[], data: object[]}} An object containing headers and parsed data.
 */
function parseCsv(csvText) {
    const rows = csvText.split('\n').map(row => row.trim());
    const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const data = rows.slice(1).map(row => {
        // Simple regex to handle commas inside quoted fields
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const record = {};
        headers.forEach((header, index) => {
            const value = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
            record[header] = value;
        });
        return record;
    });

    return { headers, data };
}

async function fetchAndParseData() {
    messageArea.textContent = 'Carregando dados da planilha...';
    try {
        // Fetch both datasets concurrently for better performance
        const [compdecResponse, repdecResponse] = await Promise.all([
            fetch(COMPDEC_URL),
            fetch(REPDEC_URL)
        ]);

        if (!compdecResponse.ok || !repdecResponse.ok) {
            throw new Error(`Erro na rede: COMPDEC Status ${compdecResponse.status}, REPDEC Status ${repdecResponse.status}`);
        }

        const compdecCsvText = await compdecResponse.text();
        const repdecCsvText = await repdecResponse.text();

        // Parse COMPDEC (municipal contacts) data
        const compdecParsed = parseCsv(compdecCsvText);
        compdecHeaders = compdecParsed.headers;
        compdecData = compdecParsed.data.filter(c => c.Coordenador || c.Municipio); // Filter out empty rows

        // Parse REPDEC (regional info) data
        const repdecParsed = parseCsv(repdecCsvText);
        repdecHeaders = repdecParsed.headers;
        repdecData = repdecParsed.data.filter(r => r.REPDEC); // Filter out empty rows

        populateCityDropdown();
        populateRegionalDropdown();
        messageArea.textContent = 'Dados carregados. Pronto para buscar.';
    } catch (error) {
        console.error('Falha ao carregar ou processar os dados:', error);
        messageArea.textContent = 'Erro ao carregar os dados. Verifique o link da planilha e sua conexão.';
        resultsContainer.innerHTML = '';
    }
}

function populateCityDropdown() {
    const municipalities = [...new Set(
        compdecData
            .map(contact => contact.Municipio)
            .filter(Boolean) // Remove empty/null values
    )].sort((a, b) => a.localeCompare(b)); // Sort alphabetically

    // Keep the first option ("Selecione um Município")
    citySelect.innerHTML = '<option value="">Selecione um Município</option>';

    municipalities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });
}

function populateRegionalDropdown() {
    const regionals = [...new Set(
        repdecData
            .map(regional => regional.REPDEC)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    regionalSelect.innerHTML = '<option value="">Selecione uma Regional</option>';

    regionals.forEach(regional => {
        const option = document.createElement('option');
        option.value = regional;
        option.textContent = regional;
        regionalSelect.appendChild(option);
    });
}

function performSearch() {
    const nameQuery = normalizeString(nameInput.value.trim());
    const cityQuery = citySelect.value; // Exact value from dropdown

    resultsContainer.innerHTML = '';
    messageArea.textContent = '';
    
    if (!nameQuery && !cityQuery) {
        messageArea.textContent = 'Por favor, digite um nome ou selecione um município para buscar.';
        return;
    }

    const filteredData = compdecData.filter(contact => {
        const coordinatorName = normalizeString(contact.Coordenador);
        const cityName = contact.Municipio || '';

        const nameMatch = nameQuery ? coordinatorName.includes(nameQuery) : true;
        const cityMatch = cityQuery ? cityName === cityQuery : true;

        return nameMatch && cityMatch;
    });

    displayResults(filteredData);
}

function performRegionalSearch() {
    const regionalQuery = regionalSelect.value;
    resultsContainer.innerHTML = '';
    messageArea.textContent = '';

    if (!regionalQuery) {
        messageArea.textContent = 'Por favor, selecione uma regional para buscar.';
        return;
    }

    // Find contacts from COMPDEC data that belong to the selected region
    const regionalContacts = compdecData.filter(contact => contact.REPDEC === regionalQuery);

    // Find the detailed info for the selected region from REPDEC data
    const regionalInfo = repdecData.find(r => r.REPDEC === regionalQuery);
    
    displayRegionalResults(regionalQuery, regionalInfo, regionalContacts);
}

function displayRegionalResults(regionalName, regionalInfo, municipalData) {
    if (!regionalInfo && municipalData.length === 0) {
        messageArea.textContent = `Nenhum dado encontrado para a ${regionalName}.`;
        return;
    }

    // Display regional chief/auxiliary info card
    if (regionalInfo) {
        const regionalInfoCard = document.createElement('div');
        regionalInfoCard.className = 'regional-info-card';
        // Note: Using new column names from REPDEC sheet like 'CH_REPDEC', 'CH_Contato' etc.
        regionalInfoCard.innerHTML = `
      <h2> ${regionalName}</h2>
    
      <div class="info-pair">
        <span><strong>Chefe REPDEC:</strong> ${regionalInfo['CH_REPDEC'] || '---'}</span>
        <span><strong>Contato:</strong> ${regionalInfo['CH_Contato'] || '---'}</span>
      </div>
    
      <div class="info-pair">
        <span><strong>Auxiliar REPDEC:</strong> ${regionalInfo['AUX_REPDEC'] || '---'}</span>
        <span><strong>Contato:</strong> ${regionalInfo['AUX_Contato'] || '---'}</span>
      </div>
    
      <div class="info-pair">
        <span><strong>Email REPDEC:</strong> ${regionalInfo['Email_REPDEC'] || '---'}</span>
      </div>
    `;
        resultsContainer.appendChild(regionalInfoCard);
    }

    if (municipalData.length === 0) {
        const noContactsMessage = document.createElement('p');
        noContactsMessage.textContent = 'Nenhum município associado a esta regional foi encontrado.';
        resultsContainer.appendChild(noContactsMessage);
        return;
    }
    
    // Display table with contacts for the municipalities in that region
    const tableContainer = document.createElement('div');
    tableContainer.className = 'regional-table-container';

    const table = document.createElement('table');
    table.className = 'regional-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Município</th>
                <th>Coordenador</th>
                <th>Telefone</th>
                <th>Outros Telefones</th>
                <th>Email Institucional</th>
                <th>Email</th>
            </tr>
        </thead>
        <tbody>
            ${municipalData.map(contact => `
                <tr>
                    <td>${contact.Municipio || ''}</td>
                    <td>${contact.Coordenador || ''}</td>
                    <td>${contact.Telefone || ''}</td>
                    <td>${contact['Outros Contatos'] || ''}</td>
                    <td>${contact['Email COMPDEC'] || ''}</td>
                    <td>${contact['Email'] || ''}</td>
                </tr>
            `).join('')}
        </tbody>
    `;

    tableContainer.appendChild(table);
    resultsContainer.appendChild(tableContainer);
}

function displayResults(data) {
    if (data.length === 0) {
        messageArea.textContent = 'Nenhum contato encontrado com os critérios informados.';
        return;
    }

    data.forEach(contact => {
        const card = document.createElement('div');
        card.className = 'contact-card';

        // Find the corresponding regional information from the globally available repdecData
        const regionalInfo = repdecData.find(r => r.REPDEC === contact.REPDEC);

        // Use COMPDEC headers to build the card details dynamically
        const contactDetailsHtml = compdecHeaders
            .filter(header => !['Coordenador', 'Municipio', 'REPDEC'].includes(header)) // Don't repeat what's already in the header, or REPDEC as it's a link
            .map(header => {
                const value = contact[header] || 'Não informado';
                return `<p><strong>${header}:</strong> ${value}</p>`;
            }).join('');
        
        let regionalInfoHtml = '';
        if (regionalInfo) {
            regionalInfoHtml = `
                <div class="regional-details">
                    <h4>${regionalInfo.REPDEC}</h4>
                    <p><strong>Chefe REPDEC:</strong> ${regionalInfo['CH_REPDEC'] || '---'}</p>  
                    <p><strong>Contato Chefe:</strong> ${regionalInfo['CH_Contato'] || '---'}</p>
                    <p><strong>Auxiliar REPDEC:</strong> ${regionalInfo['AUX_REPDEC'] || '---'}</p>
                    <p><strong>Contato Auxiliar:</strong> ${regionalInfo['AUX_Contato'] || '---'}</p>
                </div>
            `;
        }

        card.innerHTML = `
            <h2>${contact.Coordenador || 'Nome não informado'}</h2>
            <p class="municipio-subhead">${contact.Municipio || 'Município não informado'}</p>
            <div class="details">
                ${contactDetailsHtml}
            </div>
            ${regionalInfoHtml}
        `;
        resultsContainer.appendChild(card);
    });
}

function switchTab(tab) {
    resultsContainer.innerHTML = '';
    messageArea.textContent = 'Pronto para buscar.';
    nameInput.value = '';
    citySelect.value = '';
    regionalSelect.value = '';

    if (tab === 'coordinator') {
        tabCoordinator.classList.add('active');
        tabRegional.classList.remove('active');
        searchCoordinatorForm.classList.add('active');
        searchRegionalForm.classList.remove('active');
    } else { // regional
        tabCoordinator.classList.remove('active');
        tabRegional.classList.add('active');
        searchCoordinatorForm.classList.remove('active');
        searchRegionalForm.classList.add('active');
    }
}

searchBtn.addEventListener('click', performSearch);
searchRegionalBtn.addEventListener('click', performRegionalSearch);

nameInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        performSearch();
    }
});

regionalSelect.addEventListener('change', performRegionalSearch);

tabCoordinator.addEventListener('click', () => switchTab('coordinator'));
tabRegional.addEventListener('click', () => switchTab('regional'));

// Carrega os dados assim que a página é aberta
fetchAndParseData();